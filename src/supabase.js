import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwmxmldpyuruiyabxjyb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_J4XrqXXPefgfMCCCxjxCIQ_HWDdB02f';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'dtb-supabase-auth',
  },
});

let cachedUserId = null;

function getRedirectTo() {
  return window.location.origin + window.location.pathname;
}

const GOOGLE_CLIENT_ID = '260153692177-3m6mukkrtsnv68hib6uvppbk451a6kg5.apps.googleusercontent.com';

export async function signInWithGoogle() {
  const rawNonce = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem('dtb-google-nonce', rawNonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  const hashedNonce = [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectTo(),
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: hashedNonce,
    prompt: 'select_account',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function signOut() {
  cachedUserId = null;
  return supabase.auth.signOut();
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange(cb);
}

export async function ensureSession() {
  // Try getSession first (fast, from local storage)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    cachedUserId = session.user.id;
    return session;
  }
  // Fallback: verify with server in case local storage hasn't persisted yet
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    cachedUserId = user.id;
    // Re-fetch session now that getUser has refreshed the client state
    const { data: { session: s2 } } = await supabase.auth.getSession();
    return s2;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  cachedUserId = data.session?.user?.id || data.user?.id || null;
  if (!cachedUserId) throw new Error('익명 로그인 응답에 user id가 없습니다');
  console.log('[supabase] anonymous user id:', cachedUserId);
  return data.session;
}

async function userIdSync() {
  if (cachedUserId) return cachedUserId;
  const { data } = await supabase.auth.getUser();
  cachedUserId = data.user?.id || null;
  return cachedUserId;
}

const CUSTOM_BG_BUCKET = 'custom-bg';

// 회원(비익명)인지 확인. 익명 로그인 유저는 false.
export async function getMemberUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;
  return user;
}

// 이미지를 캔버스로 리사이즈/압축해 Blob 반환 (기본 1920px, WebP ~0.82품질)
async function compressImage(file, maxDim = 1920, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('이미지 압축에 실패했습니다');
  return blob;
}

// 사용자당 1장: 항상 같은 경로로 덮어쓰기
function bgPath(uid) {
  return `${uid}/background.webp`;
}

export async function uploadCustomBg(file) {
  const user = await getMemberUser();
  if (!user) throw new Error('로그인한 회원만 사용할 수 있는 기능입니다');
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다');
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하 이미지만 업로드할 수 있습니다');

  const blob = await compressImage(file);
  const path = bgPath(user.id);
  const { error } = await supabase.storage
    .from(CUSTOM_BG_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;

  const url = getCustomBgUrl(user.id);
  // 캐시 무력화용 버전 토큰을 prefs에 저장
  const versioned = `${url}?v=${Date.now()}`;
  await cloudStorage.set('dtb-custom-bg', versioned);
  return versioned;
}

export function getCustomBgUrl(uid) {
  const { data } = supabase.storage.from(CUSTOM_BG_BUCKET).getPublicUrl(bgPath(uid));
  return data.publicUrl;
}

export async function removeCustomBg() {
  const user = await getMemberUser();
  if (!user) throw new Error('로그인한 회원만 사용할 수 있는 기능입니다');
  await supabase.storage.from(CUSTOM_BG_BUCKET).remove([bgPath(user.id)]);
  await cloudStorage.remove('dtb-custom-bg');
}

function localGet(key) {
  try { const v = localStorage.getItem('dtb:' + key); return v !== null ? { value: v } : null; } catch (e) { return null; }
}
function localSet(key, value) {
  try { localStorage.setItem('dtb:' + key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {}
}
function localRemove(key) {
  try { localStorage.removeItem('dtb:' + key); } catch (e) {}
}

export const cloudStorage = {
  async get(key) {
    const uid = await userIdSync();
    if (!uid) return localGet(key);
    if (key.startsWith('timeboxes:')) {
      const date = key.slice('timeboxes:'.length);
      const { data, error } = await supabase
        .from('timeboxes')
        .select('data')
        .eq('user_id', uid)
        .eq('date', date)
        .maybeSingle();
      if (error || !data) {
        const local = localGet(key);
        if (local) {
          this.set(key, local.value).catch(() => {});
        }
        return local;
      }
      const val = JSON.stringify(data.data);
      localSet(key, val);
      return { value: val };
    }
    const { data, error } = await supabase
      .from('user_prefs')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return localGet(key);
    const v = data.data?.[key];
    if (v !== undefined) localSet(key, v);
    return v === undefined ? localGet(key) : { value: v };
  },

  async set(key, value) {
    localSet(key, value);
    const uid = await userIdSync();
    if (!uid) { console.warn('[storage.set] no user'); return false; }
    if (key.startsWith('timeboxes:')) {
      const date = key.slice('timeboxes:'.length);
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      const { error } = await supabase
        .from('timeboxes')
        .upsert({ user_id: uid, date, data: parsed, updated_at: new Date().toISOString() });
      if (error) console.error('[storage.set timeboxes]', error);
      return !error;
    }
    const { data: cur, error: ge } = await supabase
      .from('user_prefs')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (ge) console.error('[storage.set prefs get]', ge);
    const merged = { ...(cur?.data || {}), [key]: value };
    const { error } = await supabase
      .from('user_prefs')
      .upsert({ user_id: uid, data: merged, updated_at: new Date().toISOString() });
    if (error) console.error('[storage.set prefs]', error);
    return !error;
  },

  async remove(key) {
    localRemove(key);
    const uid = await userIdSync();
    if (!uid) return false;
    if (key.startsWith('timeboxes:')) {
      const date = key.slice('timeboxes:'.length);
      await supabase.from('timeboxes').delete().eq('user_id', uid).eq('date', date);
      return true;
    }
    const { data: cur } = await supabase
      .from('user_prefs')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (!cur) return true;
    const next = { ...(cur.data || {}) };
    delete next[key];
    await supabase.from('user_prefs').upsert({ user_id: uid, data: next, updated_at: new Date().toISOString() });
    return true;
  },
};

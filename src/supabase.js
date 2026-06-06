import { createClient } from '@supabase/supabase-js';
import { Vibrant } from 'node-vibrant/browser';

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

// 이미지를 캔버스로 리사이즈/압축. { blob, dataUrl } 반환(dataUrl은 색 분석용 압축본).
async function compressImage(file, maxDim = 1920, quality = 0.82) {
  const srcUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = srcUrl;
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
  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}

// Vibrant.js로 이미지 팔레트 분석. { avgLum, accent, tint } 반환.
async function analyzePalette(dataUrl) {
  const FALLBACK = { avgLum: 0.5, accent: '#D97757', tint: { r: 128, g: 128, b: 128 } };
  try {
    const palette = await Vibrant.from(dataUrl).getPalette();
    // accent: 채도 높은 Vibrant 계열 우선
    const accentSw = palette.Vibrant || palette.LightVibrant || palette.DarkVibrant || palette.Muted;
    // tint(표면 틴팅): 채도 있는 Vibrant 계열을 그대로 사용해야 라이트/다크 기본색과 구분됨
    const tintSw = palette.Vibrant || palette.DarkVibrant || palette.LightVibrant || palette.Muted || accentSw;
    if (!accentSw) return FALLBACK;
    // 전체 밝기: 인구수(population) 가중 평균
    let lumSum = 0, popSum = 0;
    for (const sw of Object.values(palette)) {
      if (!sw) continue;
      const [r, g, b] = sw.rgb;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lumSum += lum * sw.population; popSum += sw.population;
    }
    const avgLum = popSum ? lumSum / popSum : 0.5;
    const [tr, tg, tb] = (tintSw || accentSw).rgb;
    return { avgLum, accent: accentSw.hex, tint: { r: Math.round(tr), g: Math.round(tg), b: Math.round(tb) } };
  } catch (e) {
    console.warn('[custom-bg] 팔레트 분석 실패, 폴백 사용', e);
    return FALLBACK;
  }
}

// 대표색/밝기로부터 앱 전체 색상 세트(THEMES와 동일 구조) 생성.
// 표면색(카드/박스/버튼 배경 등)에 사진 대표색을 틴팅한다.
export function buildCustomColors(palette) {
  const dark = palette.avgLum < 0.5;
  const base = dark ? {
    bg: 'rgba(10,10,10,0.75)', card: 'rgba(30,28,25,0.85)', cardAlt: 'rgba(22,20,18,0.85)',
    border: 'rgba(58,54,50,0.6)', borderStrong: '#524C44',
    text: '#F5F4EE', textMid: '#A8A59B', textDim: '#6B6962',
    hover: 'rgba(51,48,43,0.7)', indicator: '#F87171', indicatorSoft: 'rgba(248,113,113,0.22)',
    slotBg: 'rgba(58, 54, 50, 0.35)', inputBg: 'rgba(22,20,18,0.85)', inputBorder: '#524C44', scheme: 'dark',
  } : {
    bg: 'rgba(245,244,238,0.6)', card: 'rgba(255,255,255,0.72)', cardAlt: 'rgba(250,249,245,0.72)',
    border: 'rgba(229,227,218,0.6)', borderStrong: '#D6D3CA',
    text: '#1F1E1D', textMid: '#4A4640', textDim: '#6B6962',
    hover: 'rgba(235,233,224,0.6)', indicator: '#EF4444', indicatorSoft: 'rgba(239,68,68,0.18)',
    slotBg: 'rgba(235, 233, 224, 0.3)', inputBg: 'rgba(255,255,255,0.72)', inputBorder: '#D6D3CA', scheme: 'light',
  };
  // Vibrant가 뽑은 Muted 계열(차분한 대표색)을 틴팅색으로 사용
  const tint = palette.tint || { r: 128, g: 128, b: 128 };
  // 표면별 틴팅 강도(글씨/지표색은 가독성 위해 제외).
  // 카드/박스 등 좁은 표면은 또렷하게, 전체 뒷배경(bg)은 사진이 이미 보이므로 약하게.
  const amts = { bg: 0.12, card: 0.26, cardAlt: 0.26, border: 0.3, borderStrong: 0.3, hover: 0.3, slotBg: 0.3, inputBg: 0.26, inputBorder: 0.3 };
  const tinted = { ...base };
  for (const k of Object.keys(amts)) tinted[k] = tintColor(base[k], tint, amts[k]);
  const accent = palette.accent;
  return { ...tinted, accent, accentHover: shade(accent, dark ? 0.12 : -0.1), accentActive: shade(accent, dark ? 0.24 : -0.2) };
}

// rgba(...) 또는 #hex 색의 RGB를 tint쪽으로 amt만큼 섞음(알파는 보존)
function tintColor(color, tint, amt) {
  if (color.startsWith('#')) {
    const m = color.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    return `#${toHex(r * (1 - amt) + tint.r * amt)}${toHex(g * (1 - amt) + tint.g * amt)}${toHex(b * (1 - amt) + tint.b * amt)}`;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
  if (!m) return color;
  const r = Math.round(+m[1] * (1 - amt) + tint.r * amt);
  const g = Math.round(+m[2] * (1 - amt) + tint.g * amt);
  const b = Math.round(+m[3] * (1 - amt) + tint.b * amt);
  return m[4] ? `rgba(${r},${g},${b},${m[4]})` : `rgb(${r},${g},${b})`;
}

// hex 색을 amt(-1~1)만큼 밝게(+)/어둡게(-)
function shade(hex, amt) {
  const m = hex.replace('#', '');
  let r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const adj = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
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

  const { blob, dataUrl } = await compressImage(file);
  const palette = await analyzePalette(dataUrl);
  const path = bgPath(user.id);
  const { error } = await supabase.storage
    .from(CUSTOM_BG_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;

  const url = getCustomBgUrl(user.id);
  // 캐시 무력화용 버전 토큰 + 추출한 색상 세트를 함께 저장
  const value = { url: `${url}?v=${Date.now()}`, colors: buildCustomColors(palette) };
  await cloudStorage.set('dtb-custom-bg', JSON.stringify(value));
  return value;
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

export async function fetchTimeboxRange(startDateStr, endDateStr) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return {};
  const { data, error } = await supabase
    .from('timeboxes')
    .select('date,data')
    .eq('user_id', uid)
    .gte('date', startDateStr)
    .lte('date', endDateStr);
  if (error || !data) return {};
  const result = {};
  for (const row of data) {
    try {
      result[row.date] = Array.isArray(row.data) ? row.data : JSON.parse(row.data);
    } catch (e) {
      result[row.date] = [];
    }
  }
  return result;
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

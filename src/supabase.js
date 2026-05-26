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

export const cloudStorage = {
  async get(key) {
    const uid = await userIdSync();
    if (!uid) return null;
    if (key.startsWith('timeboxes:')) {
      const date = key.slice('timeboxes:'.length);
      const { data, error } = await supabase
        .from('timeboxes')
        .select('data')
        .eq('user_id', uid)
        .eq('date', date)
        .maybeSingle();
      if (error || !data) return null;
      return { value: JSON.stringify(data.data) };
    }
    const { data, error } = await supabase
      .from('user_prefs')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    const v = data.data?.[key];
    return v === undefined ? null : { value: v };
  },

  async set(key, value) {
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

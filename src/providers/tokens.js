import { supabase } from '../supabase.js';

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function getConnection(provider) {
  const u = await uid();
  if (!u) return null;
  const { data, error } = await supabase
    .from('music_connections')
    .select('*')
    .eq('user_id', u)
    .eq('provider', provider)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function saveConnection(provider, { access_token, refresh_token = null, expires_in = null, scope = null }) {
  const u = await uid();
  if (!u) throw new Error('not signed in');
  const expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;
  const { error } = await supabase
    .from('music_connections')
    .upsert({
      user_id: u,
      provider,
      access_token,
      refresh_token,
      expires_at,
      scope,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return true;
}

export async function removeConnection(provider) {
  const u = await uid();
  if (!u) return false;
  await supabase.from('music_connections').delete().eq('user_id', u).eq('provider', provider);
  return true;
}

export function isExpired(conn) {
  if (!conn?.expires_at) return false;
  return new Date(conn.expires_at).getTime() <= Date.now() + 30_000;
}

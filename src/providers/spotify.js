import { getConnection, saveConnection, removeConnection, isExpired } from './tokens.js';

const CLIENT_ID = '40e06fb59101458d8c51f9b9c45657ff';
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const VERIFIER_KEY = 'dtb-spotify-pkce-verifier';
const STATE_KEY = 'dtb-spotify-oauth-state';

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function randomString(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => ('0' + b.toString(16)).slice(-2)).join('').slice(0, len);
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(buf);
}

function base64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function beginAuth() {
  const verifier = randomString(64);
  const challenge = base64urlEncode(await sha256(verifier));
  const state = 'spotify:' + randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    state,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });
  window.location.assign('https://accounts.spotify.com/authorize?' + params.toString());
}

export async function handleCallback(code, state) {
  const savedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!savedState || savedState !== state) throw new Error('state mismatch');
  if (!verifier) throw new Error('PKCE verifier missing');
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('spotify token exchange failed: ' + (await r.text()));
  const data = await r.json();
  await saveConnection('spotify', {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
  });
  return true;
}

async function refresh(conn) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token,
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('spotify refresh failed');
  const data = await r.json();
  await saveConnection('spotify', {
    access_token: data.access_token,
    refresh_token: data.refresh_token || conn.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
  });
  return data.access_token;
}

export async function getValidToken() {
  const conn = await getConnection('spotify');
  if (!conn) return null;
  if (!isExpired(conn)) return conn.access_token;
  try {
    return await refresh(conn);
  } catch (e) {
    return null;
  }
}

export async function disconnect() {
  await removeConnection('spotify');
}

async function api(path, init = {}, token) {
  const t = token || await getValidToken();
  if (!t) throw new Error('not connected');
  const headers = { 'Authorization': 'Bearer ' + t, ...(init.headers || {}) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const r = await fetch('https://api.spotify.com' + path, { ...init, headers });
  if (!r.ok) {
    const text = await r.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error?.message || j.error?.reason || j.message || text;
    } catch (e) {}
    console.warn('[spotify api err]', r.status, path, msg);
    const err = new Error('Spotify ' + r.status + ': ' + msg);
    err.status = r.status;
    throw err;
  }
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

export async function getMe(token) { return api('/v1/me', {}, token); }

export async function getCurrentPlayback() {
  return api('/v1/me/player');
}

export async function listPlaylists() {
  const all = [];
  let url = '/v1/me/playlists?limit=50';
  while (url) {
    const data = await api(url);
    for (const it of data.items) all.push(it);
    if (data.next) url = data.next.replace('https://api.spotify.com', '');
    else url = null;
  }
  return all;
}

export async function transferPlayback(deviceId, play = false) {
  return api('/v1/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

export async function playPlaylist(playlistId, deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/play${q}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
  });
}

export async function pause(deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/pause${q}`, { method: 'PUT' });
}

export async function resume(deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/play${q}`, { method: 'PUT' });
}

export async function next(deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/next${q}`, { method: 'POST' });
}

export async function previous(deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/previous${q}`, { method: 'POST' });
}

export async function seek(positionMs, deviceId) {
  const q = new URLSearchParams({ position_ms: String(Math.floor(positionMs)) });
  if (deviceId) q.set('device_id', deviceId);
  return api(`/v1/me/player/seek?${q.toString()}`, { method: 'PUT' });
}

export async function searchTracks(query, limit = 20) {
  const q = (query || '').trim();
  if (!q) return [];
  const lim = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const token = await getValidToken();
  if (!token) throw new Error('not connected');
  const u = new URL('https://api.spotify.com/v1/search');
  u.searchParams.set('q', q);
  u.searchParams.set('type', 'track');
  u.searchParams.set('limit', String(lim));
  console.log('[searchTracks] absolute URL:', u.toString());
  const r = await fetch(u.toString(), {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!r.ok) {
    const text = await r.text();
    console.warn('[searchTracks] err:', r.status, text);
    throw new Error('Spotify ' + r.status + ': ' + text);
  }
  const data = await r.json();
  return data?.tracks?.items || [];
}

export async function playUris(uris, deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return api(`/v1/me/player/play${q}`, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  });
}

// --- Web Playback SDK ---

let sdkPromise = null;
function loadSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.Spotify) return resolve(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => reject(new Error('failed to load Spotify SDK'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

let playerInstance = null;
let deviceIdValue = null;
let playerListeners = new Set();

export function onPlayerState(cb) {
  playerListeners.add(cb);
  return () => playerListeners.delete(cb);
}

function emit(state) {
  for (const cb of playerListeners) {
    try { cb(state); } catch (e) {}
  }
}

export async function initPlayer() {
  if (playerInstance) return { player: playerInstance, deviceId: deviceIdValue };
  const SpotifyNs = await loadSdk();
  const player = new SpotifyNs.Player({
    name: 'Daily Time Boxing',
    getOAuthToken: async (cb) => {
      const t = await getValidToken();
      cb(t);
    },
    volume: 0.5,
  });
  playerInstance = player;

  return new Promise((resolve, reject) => {
    const onReady = ({ device_id }) => {
      deviceIdValue = device_id;
      player.removeListener('ready', onReady);
      resolve({ player, deviceId: device_id });
    };
    const onError = (e) => {
      reject(new Error(e?.message || 'player init failed'));
    };
    player.addListener('ready', onReady);
    player.addListener('initialization_error', onError);
    player.addListener('authentication_error', onError);
    player.addListener('account_error', (e) => {
      const err = new Error('premium_required');
      err.code = 'premium_required';
      err.detail = e?.message;
      emit({ error: err });
    });
    player.addListener('player_state_changed', (state) => {
      if (!state) return;
      const track = state.track_window?.current_track;
      emit({
        playing: !state.paused,
        track: track ? {
          name: track.name,
          artist: (track.artists || []).map(a => a.name).join(', '),
          albumArt: track.album?.images?.[0]?.url || null,
          uri: track.uri,
        } : null,
        position: state.position,
        duration: state.duration,
      });
    });
    player.connect();
  });
}

export function getDeviceId() { return deviceIdValue; }

export async function sdkActivate() {
  if (!playerInstance) return;
  if (typeof playerInstance.activateElement === 'function') {
    try { await playerInstance.activateElement(); } catch (e) {}
  }
}

export async function sdkResume() {
  if (!playerInstance) return;
  await playerInstance.resume();
}

export async function sdkPause() {
  if (!playerInstance) return;
  await playerInstance.pause();
}

export async function sdkTogglePlay() {
  if (!playerInstance) return;
  await playerInstance.togglePlay();
}

export async function sdkNext() {
  if (!playerInstance) return;
  await playerInstance.nextTrack();
}

export async function sdkPrevious() {
  if (!playerInstance) return;
  await playerInstance.previousTrack();
}

export async function sdkSeek(positionMs) {
  if (!playerInstance) return;
  await playerInstance.seek(Math.floor(positionMs));
}

export async function getSdkState() {
  if (!playerInstance) return null;
  return playerInstance.getCurrentState();
}

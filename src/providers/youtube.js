import { getConnection, saveConnection, removeConnection, isExpired } from './tokens.js';

// PR1에서 등록한 동일 Google OAuth Client ID
// Google Cloud Console에서 발급받은 값을 여기에 입력 필요
const CLIENT_ID = '260153692177-3m6mukkrtsnv68hib6uvppbk451a6kg5.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const STATE_KEY = 'dtb-youtube-oauth-state';

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function randomString(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => ('0' + b.toString(16)).slice(-2)).join('').slice(0, len);
}

export function isConfigured() {
  return CLIENT_ID && !CLIENT_ID.startsWith('__');
}

export async function beginAuth() {
  if (!isConfigured()) throw new Error('Google OAuth Client ID가 설정되지 않았어요');
  const state = 'youtube:' + randomString(16);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: getRedirectUri(),
    scope: SCOPE,
    state,
    include_granted_scopes: 'true',
    prompt: 'consent select_account',
  });
  window.location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

export async function handleCallbackHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state = params.get('state') || '';
  const savedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!savedState || savedState !== state) throw new Error('state mismatch');
  const access_token = params.get('access_token');
  const expires_in = parseInt(params.get('expires_in') || '3600', 10);
  const scope = params.get('scope') || SCOPE;
  if (!access_token) throw new Error('no access_token');
  await saveConnection('youtube', { access_token, expires_in, scope });
  return true;
}

export async function getValidToken() {
  const conn = await getConnection('youtube');
  if (!conn) return null;
  if (isExpired(conn)) return null; // implicit flow엔 refresh가 없음 → 재인증 필요
  return conn.access_token;
}

export async function disconnect() {
  await removeConnection('youtube');
}

async function api(path, init = {}) {
  const t = await getValidToken();
  if (!t) {
    const err = new Error('youtube_reauth');
    err.code = 'reauth';
    throw err;
  }
  const url = 'https://www.googleapis.com/youtube/v3' + path;
  const r = await fetch(url, {
    ...init,
    headers: { 'Authorization': 'Bearer ' + t, ...(init.headers || {}) },
  });
  if (r.status === 401) {
    const err = new Error('youtube_reauth');
    err.code = 'reauth';
    throw err;
  }
  if (!r.ok) throw new Error('youtube api: ' + r.status + ' ' + (await r.text()));
  return r.json();
}

export async function listPlaylists() {
  const out = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await api('/playlists?' + q.toString());
    for (const it of data.items || []) out.push(it);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

// --- IFrame Player API ---

let iframeApiPromise = null;
function loadIframeApi() {
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const existingCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (existingCb) try { existingCb(); } catch (e) {}
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => reject(new Error('failed to load YouTube IFrame API'));
    document.head.appendChild(s);
  });
  return iframeApiPromise;
}

let ytPlayer = null;
let ytListeners = new Set();

export function onPlayerState(cb) {
  ytListeners.add(cb);
  return () => ytListeners.delete(cb);
}

function emit(payload) {
  for (const cb of ytListeners) {
    try { cb(payload); } catch (e) {}
  }
}

export async function initPlayer(containerId) {
  const YT = await loadIframeApi();
  if (ytPlayer) return ytPlayer;
  return new Promise((resolve) => {
    ytPlayer = new YT.Player(containerId, {
      width: '100%', height: '100%',
      playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, playsinline: 1 },
      events: {
        onReady: () => resolve(ytPlayer),
        onStateChange: (e) => {
          const PLAYING = 1, PAUSED = 2, ENDED = 0;
          const v = ytPlayer.getVideoData ? ytPlayer.getVideoData() : null;
          emit({
            playing: e.data === PLAYING,
            ended: e.data === ENDED,
            track: v ? { name: v.title || '', artist: v.author || '', videoId: v.video_id } : null,
          });
        },
      },
    });
  });
}

export function playPlaylist(playlistId) {
  if (!ytPlayer) return;
  ytPlayer.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0 });
}

export function play() { ytPlayer?.playVideo?.(); }
export function pause() { ytPlayer?.pauseVideo?.(); }
export function next() { ytPlayer?.nextVideo?.(); }
export function previous() { ytPlayer?.previousVideo?.(); }
export function seek(seconds) {
  if (!ytPlayer?.seekTo) return;
  ytPlayer.seekTo(seconds, true);
}
export function getProgress() {
  if (!ytPlayer?.getCurrentTime) return { position: 0, duration: 0 };
  try {
    return {
      position: (ytPlayer.getCurrentTime() || 0) * 1000,
      duration: (ytPlayer.getDuration() || 0) * 1000,
    };
  } catch (e) {
    return { position: 0, duration: 0 };
  }
}

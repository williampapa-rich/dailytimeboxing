import { getConnection, saveConnection, removeConnection, isExpired } from './tokens.js';

const CLIENT_ID = '260153692177-3m6mukkrtsnv68hib6uvppbk451a6kg5.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const STATE_KEY = 'dtb-gcal-oauth-state';

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
  const state = 'gcal:' + randomString(16);
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
  await saveConnection('google_calendar', { access_token, expires_in, scope });
  return true;
}

export async function getValidToken() {
  const conn = await getConnection('google_calendar');
  if (!conn) return null;
  if (isExpired(conn)) return null;
  return conn.access_token;
}

export async function disconnect() {
  await removeConnection('google_calendar');
}

export async function isConnected() {
  const conn = await getConnection('google_calendar');
  return !!(conn && !isExpired(conn));
}

async function api(path, init = {}) {
  const t = await getValidToken();
  if (!t) {
    const err = new Error('google_calendar_reauth');
    err.code = 'reauth';
    throw err;
  }
  const url = 'https://www.googleapis.com/calendar/v3' + path;
  const r = await fetch(url, {
    ...init,
    headers: { 'Authorization': 'Bearer ' + t, ...(init.headers || {}) },
  });
  if (r.status === 401) {
    const err = new Error('google_calendar_reauth');
    err.code = 'reauth';
    throw err;
  }
  if (!r.ok) throw new Error('google_calendar api: ' + r.status + ' ' + (await r.text()));
  return r.json();
}

export async function listEvents(dateStr) {
  // dateStr: 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

  const q = new URLSearchParams({
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const data = await api('/calendars/primary/events?' + q.toString());
  const items = data.items || [];

  const boxes = [];
  for (const event of items) {
    // 시간 있는 이벤트만 (allDay 제외)
    if (!event.start?.dateTime) continue;

    const startDt = new Date(event.start.dateTime);
    const endDt = new Date(event.end?.dateTime || event.start.dateTime);

    // 해당 날짜 로컬 자정 기준 분 계산
    const dayStartMs = dayStart.getTime();
    let startMin = Math.round((startDt.getTime() - dayStartMs) / 60000);
    let endMin = Math.round((endDt.getTime() - dayStartMs) / 60000);

    // 멀티데이 clamp
    startMin = Math.max(0, Math.min(1440, startMin));
    endMin = Math.max(0, Math.min(1440, endMin));

    // 0길이 보정
    if (endMin <= startMin) endMin = startMin + 15;

    boxes.push({
      id: 'gcal-' + event.id,
      start: startMin,
      end: endMin,
      title: event.summary || '(제목 없음)',
      description: event.description || '',
      color: '#9CA3AF',
      tasks: [],
      source: 'gcal',
      readOnly: true,
      htmlLink: event.htmlLink || null,
    });
  }

  return boxes;
}

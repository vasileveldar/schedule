(() => {
'use strict';
/* Рекорды игр: отправка счёта и таблица лидеров в облаке.
   В Telegram имя берётся из бота (подпись initData), в PWA и APK игрок вводит ник. Без интернета счёт ждёт в очереди. */
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const cloud = String((read('app-config') || {}).cloudUrl || '').replace(/\/+$/, '');
const enabled = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud);
const bridge = window.AppPreferences;
const nativeNet = !!(bridge && typeof bridge.cloudRequest === 'function');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } },
};
const NICK_KEY = 'schedule-nick', DEVICE_KEY = 'schedule-device', PENDING_KEY = 'schedule-scores-pending';

function deviceId() {
  let id = store.get(DEVICE_KEY);
  if (!/^[a-f0-9]{24}$/.test(id || '')) {
    const bytes = new Uint8Array(12);
    (window.crypto || { getRandomValues: a => a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); }) }).getRandomValues(bytes);
    id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    store.set(DEVICE_KEY, id);
  }
  return id;
}
const initData = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
const inTelegram = () => !!initData();

// ---------- сеть: в APK через Android-часть (страница сама наружу не ходит), иначе fetch ----------
let seq = 0;
const waiting = new Map();
window.__cloudDone = (id, status, text) => { const f = waiting.get(id); if (f) { waiting.delete(id); f({ status, text }); } };
function request(method, path, body) {
  if (!enabled) return Promise.reject(new Error('off'));
  if (nativeNet) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('timeout')); }, 12000);
      waiting.set(id, r => { clearTimeout(timer); r.status > 0 ? resolve(r) : reject(new Error('net')); });
      try { bridge.cloudRequest(id, method, path, body ? JSON.stringify(body) : ''); } catch (e) { clearTimeout(timer); waiting.delete(id); reject(e); }
    }).then(r => ({ status: r.status, json: safeJson(r.text) }));
  }
  const headers = { 'content-type': 'application/json' };
  if (inTelegram()) headers['x-telegram-init-data'] = initData();
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
  return fetch(cloud + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store' })
    .then(async r => ({ status: r.status, json: safeJson(await r.text()) })).finally(() => clearTimeout(timer));
}
const safeJson = text => { try { return JSON.parse(text); } catch (_) { return null; } };

// ---------- очередь счёта ----------
const pending = () => { try { return JSON.parse(store.get(PENDING_KEY) || '{}') || {}; } catch (_) { return {}; } };
const savePending = p => store.set(PENDING_KEY, JSON.stringify(p));
const nick = () => store.get(NICK_KEY) || '';
const needNick = () => enabled && !inTelegram() && !nick();
let flushing = false;

async function flush() {
  if (!enabled || flushing || needNick()) return null;
  flushing = true;
  let last = null;
  try {
    for (const [game, score] of Object.entries(pending())) {
      const body = { game, score, device: deviceId() };
      if (!inTelegram()) body.nick = nick();
      const r = await request('POST', '/api/scores', body);
      if (r.status === 200) { const p = pending(); if (p[game] === score) delete p[game]; savePending(p); last = { game, board: r.json }; }
      else if (r.status === 409 || r.status === 400) { const p = pending(); delete p[game]; savePending(p); if (r.json && r.json.error === 'nick-taken') { store.set(NICK_KEY, ''); } }
      else break;
    }
  } catch (_) { /* нет связи — повторим позже */ } finally { flushing = false; }
  return last;
}

function submit(game, score) {
  score = Math.floor(Number(score));
  if (!enabled || !(score >= 1)) return Promise.resolve(null);
  const p = pending();
  if (!(p[game] >= score)) { p[game] = score; savePending(p); }
  return flush();
}

async function top(game) {
  const q = '/api/scores?game=' + encodeURIComponent(game) + (inTelegram() ? '' : '&device=' + deviceId());
  const r = await request('GET', q);
  return r.status === 200 ? r.json : null;
}

// ник: 2–16 символов, буквы/цифры/пробел/_ . -
const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{0,14}[\p{L}\p{N}]$/u;
const cleanNick = v => String(v || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
async function setNick(value) {
  const v = cleanNick(value);
  if (!NICK_RE.test(v)) return { ok: false, error: 'nick' };
  try {
    const r = await request('POST', '/api/scores', { game: 'jump', device: deviceId(), nick: v });
    if (r.status === 200) { store.set(NICK_KEY, v); flush(); return { ok: true, board: r.json }; }
    if (r.status === 409) return { ok: false, error: 'taken' };
    return { ok: false, error: 'nick' };
  } catch (_) { return { ok: false, error: 'net' }; }
}

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
window.scheduleCloud = { request, enabled, inTelegram, deviceId, native: nativeNet };
window.scheduleScores = { enabled, inTelegram, nick, needNick, setNick, submit, top, flush, hasPending: () => Object.keys(pending()).length > 0 };
})();

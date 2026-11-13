(() => {
'use strict';
/* Анонимная статистика: какие экраны и функции используются, на каких платформах, языках и версиях.
   Без имён, Telegram-ID и IP. Включена по умолчанию, выключается в «Настройки → Ещё → Анонимная статистика».
   События копятся на устройстве и уходят одной небольшой пачкой, когда приложение сворачивают или открывают. */
const cloud = window.scheduleCloud;
const i18n = window.scheduleI18n;
if (!cloud || !cloud.enabled || !i18n) return;

const L = {
  ru: {
    label: 'Анонимная статистика', note: 'Считаем только, какие экраны и функции открывают, без имён и личных данных. Помогает понять, что улучшать.',
    noticeTitle: 'Анонимная статистика', noticeText: 'Приложение считает, какие экраны и функции используются: платформа, язык, версия, число открытий. Имён, Telegram-ID и IP в статистике нет. Это нужно, чтобы понимать, что улучшать. Выключить можно в любой момент: «Настройки → Ещё».',
    ok: 'Понятно', off: 'Выключить', close: 'Закрыть',
  },
  en: {
    label: 'Anonymous statistics', note: 'We only count which screens and features are opened, with no names or personal data. It helps decide what to improve.',
    noticeTitle: 'Anonymous statistics', noticeText: 'The app counts which screens and features are used: platform, language, version, number of opens. There are no names, Telegram IDs or IP addresses in it. It helps decide what to improve. You can turn it off any time: Settings → More.',
    ok: 'Got it', off: 'Turn off', close: 'Close',
  },
  de: {
    label: 'Anonyme Statistik', note: 'Gezählt wird nur, welche Bildschirme und Funktionen geöffnet werden, ohne Namen oder persönliche Daten. Das hilft bei Verbesserungen.',
    noticeTitle: 'Anonyme Statistik', noticeText: 'Die App zählt, welche Bildschirme und Funktionen genutzt werden: Plattform, Sprache, Version, Anzahl der Aufrufe. Namen, Telegram-IDs und IP-Adressen sind nicht enthalten. Das hilft bei Verbesserungen. Jederzeit abschaltbar: Einstellungen → Mehr.',
    ok: 'Verstanden', off: 'Ausschalten', close: 'Schließen',
  },
};
const lang = () => i18n.getLanguage() || 'ru';
const tr = k => String((L[lang()] || L.ru)[k] ?? L.ru[k] ?? k);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } },
};
const OFF_KEY = 'schedule-stats', NOTICE_KEY = 'schedule-stats-notice', QUEUE_KEY = 'schedule-stats-queue';
const SCREENS = ['home', 'schedule', 'calendar', 'game', 'settings', 'homework', 'owner'];
const FEATURES = ['share', 'done', 'search', 'history', 'report'];
const enabled = () => store.get(OFF_KEY) !== 'off';

// ---------- очередь событий ----------
let queue = (() => { try { const q = JSON.parse(store.get(QUEUE_KEY) || '{}'); return q && typeof q === 'object' ? q : {}; } catch (_) { return {}; } })();
const saveQueue = () => store.set(QUEUE_KEY, JSON.stringify(queue));
function track(kind, name) {
  if (!enabled()) return;
  const list = kind === 'screen' ? SCREENS : FEATURES;
  if (!list.includes(name)) return;
  const key = kind + ':' + name;
  queue[key] = Math.min((queue[key] || 0) + 1, 500);
  saveQueue();
}

function platform() {
  if (cloud.native) return 'APK';
  if (cloud.inTelegram()) return 'Telegram';
  return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Web';
}
function appVersion() {
  try { const b = window.AppPreferences; if (b && typeof b.appVersion === 'function') { const v = String(b.appVersion() || ''); return /^\d{1,3}(\.\d{1,3}){1,3}$/.test(v) ? v : ''; } } catch (_) { /* старая версия приложения */ }
  return '';
}

let sending = false, lastSent = 0;
async function flush(force) {
  if (!enabled() || sending || (!force && Date.now() - lastSent < 60000)) return;
  sending = true;
  const taken = queue; queue = {};
  const events = Object.entries(taken).map(([key, c]) => { const [k, n] = key.split(':'); return { k, n, c }; }).slice(0, 30);
  try {
    const r = await cloud.request('POST', '/api/stats', {
      device: cloud.deviceId(), platform: platform(), lang: lang(), theme: document.documentElement.dataset.palette || '', version: appVersion(), events,
    });
    if (r.status === 200 || r.status === 400) { lastSent = Date.now(); saveQueue(); }
    else throw new Error(String(r.status));
  } catch (_) {
    // не дошло: возвращаем события в очередь (число ограничено)
    for (const [k, c] of Object.entries(taken)) queue[k] = Math.min((queue[k] || 0) + c, 500);
    saveQueue();
  } finally { sending = false; }
}

// ---------- что считаем ----------
let lastScreen = '';
const noteScreen = () => { const s = document.body.dataset.screen || 'home'; if (s !== lastScreen) { lastScreen = s; track('screen', s); } };
new MutationObserver(noteScreen).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
document.addEventListener('click', e => {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t) return;
  if (t.closest('.lesson-share')) track('feature', 'share');
  else if (t.closest('.hw-check')) track('feature', 'done');
}, true);
let lastSearch = 0;
document.addEventListener('focusin', e => {
  if (e.target && e.target.classList && e.target.classList.contains('fork-search-input') && Date.now() - lastSearch > 30000) { lastSearch = Date.now(); track('feature', 'search'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
window.addEventListener('pagehide', () => flush(true));
window.addEventListener('online', () => flush(false));

// ---------- выключатель в настройках ----------
let row = null, labelEl = null, noteEl = null, input = null;
function paintSwitch() {
  const box = document.getElementById('reports-settings') || document.getElementById('settings-screen');
  if (!box) return;
  if (!row) {
    row = el('div', 'settings-row');
    const copy = el('div', 'ed-subcopy'); labelEl = el('span'); noteEl = el('small'); copy.append(labelEl, noteEl);
    const sw = el('label', 'fork-switch'); input = el('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch');
    sw.append(input, el('span', 'fork-switch-track')); row.append(copy, sw); box.append(row);
    input.addEventListener('change', () => {
      if (input.checked) { store.set(OFF_KEY, 'on'); noteScreen(); flush(true); }
      else { store.set(OFF_KEY, 'off'); queue = {}; saveQueue(); }
    });
  }
  labelEl.textContent = tr('label'); noteEl.textContent = tr('note'); input.setAttribute('aria-label', tr('label')); input.checked = enabled();
}
window.addEventListener('language:change', paintSwitch);
paintSwitch();

// ---------- объявление при первом запуске ----------
function showNotice() {
  if (store.get(NOTICE_KEY) || !window.scheduleReports || !window.scheduleReports.openSheet) return;
  store.set(NOTICE_KEY, '1');
  const sheet = window.scheduleReports.openSheet(tr('noticeTitle'));
  const acts = el('div', 'rp-buttons');
  const ok = el('button', 'ed-primary', tr('ok')); ok.type = 'button';
  const off = el('button', 'choice settings-test', tr('off')); off.type = 'button';
  ok.addEventListener('click', sheet.close);
  off.addEventListener('click', () => { store.set(OFF_KEY, 'off'); queue = {}; saveQueue(); if (input) input.checked = false; sheet.close(); });
  acts.append(ok, off);
  sheet.body.append(el('p', 'rp-text', tr('noticeText')), acts);
}

noteScreen();
setTimeout(() => { flush(true); }, 4000);
setTimeout(showNotice, 6000);
window.scheduleStats = { track, flush, enabled };
})();

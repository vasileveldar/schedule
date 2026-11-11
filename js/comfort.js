(() => {
'use strict';
/* Мелочи удобства: «Поделиться» на карточке пары, плашка состояния связи, сообщение об обновлении, установка PWA. */
const i18n = window.scheduleI18n;
const bridge = window.AppPreferences;
const native = !!bridge;
const SITE = 'https://vasileveldar.github.io/schedule/';
const L = {
  ru: {
    share: 'Поделиться парой', copied: 'Скопировано', shareFail: 'Не удалось поделиться',
    offline: 'Нет связи. Показываю сохранённые данные.', stale: 'Не удалось обновить. Показываю сохранённое от {time}.', staleNoTime: 'Не удалось обновить. Показываю сохранённое.', retry: 'Повторить',
    update: 'Доступна новая версия', reload: 'Обновить', close: 'Закрыть',
    installTitle: 'Установка', installBtn: 'Установить приложение', installNote: 'Откроется как обычное приложение, расписание будет доступно без интернета.',
    iosNote: 'Чтобы установить: нажмите «Поделиться» в Safari и выберите «На экран Домой».', homework: 'Д/з',
  },
  en: {
    share: 'Share this class', copied: 'Copied', shareFail: 'Could not share',
    offline: 'No connection. Showing saved data.', stale: 'Could not refresh. Showing data saved at {time}.', staleNoTime: 'Could not refresh. Showing saved data.', retry: 'Retry',
    update: 'A new version is available', reload: 'Update', close: 'Close',
    installTitle: 'Install', installBtn: 'Install the app', installNote: 'It opens like a regular app and the timetable works offline.',
    iosNote: 'To install: tap Share in Safari and choose “Add to Home Screen”.', homework: 'Homework',
  },
  de: {
    share: 'Stunde teilen', copied: 'Kopiert', shareFail: 'Teilen nicht möglich',
    offline: 'Keine Verbindung. Gespeicherte Daten werden angezeigt.', stale: 'Aktualisierung fehlgeschlagen. Gespeicherte Daten von {time}.', staleNoTime: 'Aktualisierung fehlgeschlagen. Gespeicherte Daten werden angezeigt.', retry: 'Erneut',
    update: 'Neue Version verfügbar', reload: 'Aktualisieren', close: 'Schließen',
    installTitle: 'Installation', installBtn: 'App installieren', installNote: 'Öffnet sich wie eine normale App, der Stundenplan funktioniert offline.',
    iosNote: 'Installieren: In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen.', homework: 'Hausaufgabe',
  },
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k]).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const locale = () => ({ ru: 'ru-RU', en: 'en-GB', de: 'de-DE' }[lang()] || 'ru-RU');

// заглушка загрузки на главной больше не нужна: карточка «Следующая пара» уже построена
{ const skel = document.getElementById('home-skeleton'); if (skel) skel.remove(); }

// ---------- всплывающие сообщения ----------
let tray = null;
function ensureTray() {
  if (tray) return tray;
  tray = el('div', 'cf-tray'); tray.setAttribute('aria-live', 'polite');
  document.body.append(tray);
  return tray;
}
function toast(text, opts = {}) {
  const box = el('div', 'cf-toast' + (opts.sticky ? ' sticky' : ''));
  if (opts.id) { const old = ensureTray().querySelector('[data-id="' + opts.id + '"]'); if (old) old.remove(); box.dataset.id = opts.id; }
  box.append(el('span', 'cf-text', text));
  for (const a of opts.actions || []) {
    const b = el('button', 'cf-btn', a.label); b.type = 'button';
    b.addEventListener('click', () => { box.remove(); if (a.run) a.run(); });
    box.append(b);
  }
  if (opts.sticky) { const x = el('button', 'cf-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close')); x.addEventListener('click', () => box.remove()); box.append(x); }
  ensureTray().append(box);
  if (!opts.sticky) setTimeout(() => box.remove(), opts.ms || 2600);
  return box;
}
window.scheduleToast = toast;
function dropToast(id) { if (!tray) return; const n = tray.querySelector('[data-id="' + id + '"]'); if (n) n.remove(); }

// ---------- «Поделиться» парой ----------
const pad = n => String(n).padStart(2, '0');
function nextDateFor(dayName) {
  const data = JSON.parse(document.getElementById('schedule-data').textContent);
  const idx = (data.days || []).indexOf(dayName);
  const d = new Date();
  if (idx >= 0) for (let i = 0; i < 7; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return d;
}
function lessonText(card) {
  const d = nextDateFor(card.dataset.day);
  const date = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const lines = [date + ', ' + card.dataset.start + '–' + card.dataset.end];
  lines.push(i18n.content('subjects', card.dataset.subject) + (card.dataset.room ? ' · ' + i18n.room(card.dataset.room) : ''));
  if (card.dataset.teacher) lines.push(i18n.content('teachers', card.dataset.teacher));
  const hw = [...card.querySelectorAll('.hw-block:not(.hw-past) .hw-text')].map(n => n.textContent.trim()).filter(Boolean);
  for (const h of hw) lines.push(tr('homework') + ': ' + h);
  const url = !native && /^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE;
  lines.push(url);
  return lines.join('\n');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  try { const a = el('textarea'); a.value = text; a.style.cssText = 'position:fixed;opacity:0'; document.body.append(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (_) { return false; }
}
async function share(text) {
  try { if (bridge && typeof bridge.shareText === 'function') { bridge.shareText(text); return; } } catch (_) {}
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg && tg.initData && typeof tg.openTelegramLink === 'function') {
    const lines = text.split('\n'), url = lines.pop();
    try { tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(lines.join('\n'))); return; } catch (_) {}
  }
  toast(await copyText(text) ? tr('copied') : tr('shareFail'));
}
function addShareButtons() {
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    if (card.dataset.source === 'assessment' || card.querySelector('.lesson-share')) continue;
    const b = el('button', 'lesson-share'); b.type = 'button';
    b.setAttribute('aria-label', tr('share')); b.title = tr('share');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.8 7.1-3.6M8.2 13.2l7.1 3.6"/></svg>';
    b.addEventListener('click', e => { e.stopPropagation(); share(lessonText(card)); });
    card.append(b);
  }
}
document.addEventListener('schedule:render', addShareButtons);
addShareButtons(); // расписание уже отрисовано до загрузки этого файла
window.addEventListener('language:change', () => { for (const b of document.querySelectorAll('.lesson-share')) { b.setAttribute('aria-label', tr('share')); b.title = tr('share'); } });

// ---------- состояние связи ----------
function timeText(at) { return at ? new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(at)) : ''; }
function retry() { dropToast('net'); if (window.scheduleHomework && window.scheduleHomework.reload) window.scheduleHomework.reload(); }
let lastStatus = null;
function showStale(at) {
  lastStatus = { ok: false, at };
  toast(at ? tr('stale', { time: timeText(at) }) : tr('staleNoTime'), { id: 'net', sticky: true, actions: [{ label: tr('retry'), run: retry }] });
}
if (!native) {
  window.addEventListener('cloud:status', e => { const d = e.detail || {}; if (d.ok) { lastStatus = d; dropToast('net'); } else showStale(d.at); });
  if (window.scheduleCloudStatus && !window.scheduleCloudStatus.ok) showStale(window.scheduleCloudStatus.at); // событие могло прийти раньше загрузки этого файла
  window.addEventListener('offline', () => toast(tr('offline'), { id: 'net', sticky: true }));
  window.addEventListener('online', () => { dropToast('net'); if (window.scheduleHomework && window.scheduleHomework.reload) window.scheduleHomework.reload(); });
}

// ---------- новая версия сайта ----------
if (!native && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    toast(tr('update'), { id: 'update', sticky: true, actions: [{ label: tr('reload'), run: () => location.reload() }] });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    navigator.serviceWorker.getRegistration().then(r => { if (r) r.update().catch(() => {}); }).catch(() => {});
  });
}

// ---------- установка PWA ----------
{
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const settings = document.getElementById('settings-screen');
  if (!native && !standalone && settings) {
    const box = el('section', 'settings-group'); box.id = 'install-settings'; box.hidden = true;
    const h = el('h2'); const note = el('p', 'settings-note'); const btn = el('button', 'choice settings-test'); btn.type = 'button';
    box.append(h, btn, note); settings.append(box);
    const paint = () => { h.textContent = tr('installTitle'); btn.textContent = tr('installBtn'); note.textContent = btn.hidden ? tr('iosNote') : tr('installNote'); };
    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; box.hidden = false; paint(); });
    window.addEventListener('appinstalled', () => { box.hidden = true; deferred = null; });
    btn.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (_) {} deferred = null; box.hidden = true; });
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)) { btn.hidden = true; box.hidden = false; }
    paint();
    window.addEventListener('language:change', paint);
  }
}
})();

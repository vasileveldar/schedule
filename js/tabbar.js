(() => {
'use strict';
/* Нижняя панель вкладок: всегда включена (переключателя нет). Только на телефоне и планшете (ширину решает CSS). */
const i18n = window.scheduleI18n;
const app = window.scheduleApp;
if (!i18n || !app) return;
const L = {
  ru: { home: 'Главная', schedule: 'Пары', calendar: 'Календарь', game: 'Игры', settings: 'Настройки', homework: 'Д/з', aria: 'Разделы' },
  en: { home: 'Home', schedule: 'Timetable', calendar: 'Calendar', game: 'Games', settings: 'Settings', homework: 'Homework', aria: 'Sections' },
  de: { home: 'Start', schedule: 'Plan', calendar: 'Kalender', game: 'Spiele', settings: 'Mehr', homework: 'Hausaufg.', aria: 'Bereiche' },
};
const tr = k => (L[i18n.getLanguage()] || L.ru)[k];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
  schedule: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 14h2M12 14h2M8 17h2"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>',
  homework: '<path d="M5 19l1-4 9-9 3 3-9 9z"/><path d="M14 7l3 3"/>',
};
const bar = el('nav', 'tabbar'); bar.setAttribute('aria-label', tr('aria')); bar.hidden = true;
const buttons = new Map();
function make(name) {
  const b = el('button', 'tab'); b.type = 'button'; b.dataset.tab = name;
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg><span></span>';
  b.addEventListener('click', () => go(name));
  buttons.set(name, b); return b;
}
function go(name) {
  document.body.dataset.tabswitch = '1'; // переход из панели — без сдвига экрана
  if (name === 'home') { if (app.getScreen() !== 'home' && window.appNavigateBack) window.appNavigateBack(); return; }
  if (app.getScreen() === name) return;
  const trigger = name === 'settings' ? document.getElementById('open-settings') : name === 'homework' ? document.getElementById('hw-menu-card') : document.querySelector('#home-screen [data-open-screen="' + name + '"]');
  if (trigger) trigger.click(); else app.navigate(name);
}
function canHomework() { const r = window.scheduleHomework && window.scheduleHomework.role(); return r === 'owner' || r === 'editor'; }
function build() {
  bar.replaceChildren();
  const names = ['home', 'schedule', 'calendar', 'game'];
  if (canHomework()) names.push('homework');
  names.push('settings');
  for (const n of names) bar.append(make(n));
  paint();
}
function paint() {
  bar.setAttribute('aria-label', tr('aria'));
  const screen = app.getScreen();
  for (const [name, b] of buttons) { b.querySelector('span').textContent = tr(name); b.setAttribute('aria-current', name === screen ? 'page' : 'false'); }
}
function apply() {
  document.body.dataset.nav = 'bar';
  bar.hidden = false;
  build();
}
document.body.append(bar);
new MutationObserver(paint).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
window.addEventListener('language:change', paint);
window.addEventListener('role:change', build);

apply();
})();

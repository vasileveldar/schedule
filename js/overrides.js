(() => {
'use strict';
/* Изменения в расписании на конкретную дату (отмена пары, другая аудитория, преподаватель, перенос, заметка).
   Данные — из облака (/api/overrides), в APK их скачивает Android-часть. Показ: метки в карточках пар, «следующая пара» на главной. */
const i18n = window.scheduleI18n;
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const config = read('app-config') || {};
const cloud = String(config.cloudUrl || '').replace(/\/+$/, '');
if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud)) return;
const data = read('schedule-data');
if (!data) return;
const bridge = window.AppPreferences;
const nativeApp = !!(bridge && typeof bridge.refreshHomework === 'function');
const CACHE_KEY = 'schedule-overrides-cache';

const L = {
  ru: { cancel: 'Пара отменена', room: 'Аудитория: {v}', was: 'было {v}', teacher: 'Преподаватель: {v}', move: 'Перенос: {v}' },
  en: { cancel: 'Class cancelled', room: 'Room: {v}', was: 'was {v}', teacher: 'Teacher: {v}', move: 'Moved: {v}' },
  de: { cancel: 'Stunde entfällt', room: 'Raum: {v}', was: 'vorher {v}', teacher: 'Lehrkraft: {v}', move: 'Verschoben: {v}' },
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, v) => String((L[lang()] || L.ru)[k]).replace('{v}', v === undefined ? '' : v);
const locale = () => ({ ru: 'ru-RU', en: 'en-GB', de: 'de-DE' }[lang()] || 'ru-RU');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const clock = v => { const p = String(v || '').trim().split(':'); return p.length === 2 ? p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0') : String(v || ''); };
const keyOf = (day, start, subject, group) => [day, clock(start), subject, group || 'Общее'].join('|');

// ближайшая дата (сегодня или позже) для дня недели из расписания
function nextDate(dayName) {
  const idx = (data.days || []).indexOf(dayName);
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (idx >= 0) for (let i = 0; i < 7; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return d;
}

let list = [];
const find = (key, iso) => list.filter(o => o.lesson === key && o.date === iso);
const forEvent = (event, date) => find(keyOf(event.day, event.start, event.subject, event.group), isoOf(date));

function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}
function chipText(o) {
  if (o.kind === 'cancel') return tr('cancel');
  if (o.kind === 'room') return tr('room', o.value);
  if (o.kind === 'teacher') return tr('teacher', o.value);
  if (o.kind === 'move') return tr('move', o.value);
  return o.value;
}

function apply() {
  const today = isoOf(new Date());
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    card.querySelectorAll('.ov-box').forEach(n => n.remove());
    card.classList.remove('ov-cancelled');
    const roomNode = card.querySelector('.detail.room');
    if (roomNode) { if (roomNode.dataset.orig === undefined) roomNode.dataset.orig = roomNode.textContent; roomNode.textContent = roomNode.dataset.orig; roomNode.classList.remove('ov-changed'); }
    if (card.dataset.source === 'assessment') continue;
    const date = isoOf(nextDate(card.dataset.day));
    const mine = find(keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group), date);
    if (!mine.length) continue;
    const box = el('div', 'ov-box');
    for (const o of mine) {
      const chip = el('span', 'ov-chip ov-' + o.kind, (date !== today ? dateLabel(date) + ' · ' : '') + chipText(o));
      if (o.kind === 'room' && roomNode) {
        chip.textContent = (date !== today ? dateLabel(date) + ' · ' : '') + tr('room', o.value) + ' (' + tr('was', roomNode.dataset.orig.replace(/^\S+\s/, '')) + ')';
      }
      box.append(chip);
    }
    if (mine.some(o => o.kind === 'cancel')) card.classList.add('ov-cancelled');
    const room = mine.find(o => o.kind === 'room');
    if (room && roomNode) { roomNode.textContent = roomNode.dataset.orig.replace(/\S+$/, room.value); roomNode.classList.add('ov-changed'); }
    const details = card.querySelector('.details');
    if (details) details.prepend(box); else card.append(box);
  }
}

async function reload() {
  try {
    const r = await fetch(nativeApp ? './data/overrides.json' : cloud + '/api/overrides', { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const arr = await r.json();
    if (!Array.isArray(arr)) throw new Error('format');
    list = arr;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(arr)); } catch (_) {}
  } catch (_) {
    if (!list.length) { try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) list = saved; } catch (__) {} }
  }
  apply();
  document.dispatchEvent(new CustomEvent('overrides:change'));
}

window.scheduleOverrides = {
  items: () => list, reload, nextDate, keyOf, isoOf, clock,
  forEvent,
  cancelled: (event, date) => forEvent(event, date).some(o => o.kind === 'cancel'),
  roomFor: (event, date) => { const o = forEvent(event, date).find(x => x.kind === 'room'); return o ? o.value : ''; },
  forLesson: key => list.filter(o => o.lesson === key),
  chipText, dateLabel,
};

document.addEventListener('schedule:render', apply);
window.addEventListener('language:change', apply);
document.addEventListener('visibilitychange', () => { if (!document.hidden) reload(); });
setInterval(() => { if (!document.hidden) reload(); }, 5 * 60 * 1000);
try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) list = saved; } catch (_) {}
apply();
reload();
})();

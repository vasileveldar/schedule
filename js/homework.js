(() => {
'use strict';
/* Домашние задания: показ в карточках пар (всем) и форма для редакторов (Mini App в Telegram).
   Данные — из облака (Cloudflare Worker). Адрес — data/app-config.json (cloudUrl); пусто — функция выключена. */
const i18n = window.scheduleI18n;
const t = (k, p) => i18n.t(k, p);
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const config = read('app-config') || {};
const cloud = String(config.cloudUrl || '').replace(/\/+$/, '');
if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud)) return; // http — только для локальной отладки

const bridge = window.AppPreferences;
const nativeApp = !!(bridge && typeof bridge.refreshHomework === 'function'); // в APK данные получает Android-часть
const data = read('schedule-data');
const CACHE_KEY = 'schedule-homework-cache';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const clock = v => { const p = String(v || '').trim().split(':'); return p.length === 2 ? p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0') : String(v || ''); };
const keyOf = (day, start, subject, group) => [day, clock(start), subject, group || 'Общее'].join('|');
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayIso = () => isoDate(new Date());
const locale = () => ({ ru: 'ru-RU', en: 'en-GB', de: 'de-DE' }[i18n.getLanguage()] || 'ru-RU');

// личные отметки «сделано»: только на этом устройстве, по id задания
const DONE_KEY = 'schedule-hw-done';
const DL = {
  ru: { done: 'Сделано', undone: 'Вернуть', markDone: 'Отметить как сделанное', markUndone: 'Снять отметку «сделано»', photo: 'Фото к заданию', photos: 'Фото', addPhoto: '📷 Добавить фото', photoLimit: 'Не больше 3 фото', photoFail: 'Не удалось загрузить фото', removePhoto: 'Убрать фото', close: 'Закрыть' },
  en: { done: 'Done', undone: 'Undo', markDone: 'Mark as done', markUndone: 'Remove the done mark', photo: 'Homework photo', photos: 'Photos', addPhoto: '📷 Add photo', photoLimit: 'No more than 3 photos', photoFail: 'Could not upload the photo', removePhoto: 'Remove photo', close: 'Close' },
  de: { done: 'Erledigt', undone: 'Zurück', markDone: 'Als erledigt markieren', markUndone: 'Erledigt-Markierung entfernen', photo: 'Foto zur Aufgabe', photos: 'Fotos', addPhoto: '📷 Foto hinzufügen', photoLimit: 'Höchstens 3 Fotos', photoFail: 'Foto konnte nicht hochgeladen werden', removePhoto: 'Foto entfernen', close: 'Schließen' },
};
const dt = k => (DL[i18n.getLanguage()] || DL.ru)[k];
const doneSet = (() => { try { const a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (_) { return new Set(); } })();
const isDone = i => doneSet.has(i.id);
function syncDoneToApp() { try { if (bridge && typeof bridge.setHomeworkDone === 'function') bridge.setHomeworkDone(JSON.stringify([...doneSet])); } catch (_) {} } // виджету д/з нужны отметки
function saveDone() { try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneSet])); } catch (_) {} syncDoneToApp(); }
function setDone(i, on) {
  if (on) doneSet.add(i.id); else doneSet.delete(i.id);
  saveDone(); render();
  document.dispatchEvent(new CustomEvent('hw:done-change'));
}
function pruneDone() { // отметки к удалённым заданиям не копим
  const ids = new Set(items.map(i => i.id)); let changed = false;
  for (const id of [...doneSet]) if (!ids.has(id)) { doneSet.delete(id); changed = true; }
  if (changed) saveDone();
}
// ---------- фото к заданиям ----------
const MAX_PHOTOS = 3;
const photoUrl = id => (nativeApp ? './data/photos/' + id + '.jpg' : cloud + '/api/photos/' + id);
function openPhoto(src) {
  const box = el('div', 'hw-lightbox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
  const img = el('img'); img.src = src; img.alt = dt('photo');
  const x = el('button', 'hw-lightbox-x', '×'); x.type = 'button'; x.setAttribute('aria-label', dt('close'));
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  box.addEventListener('click', close); x.addEventListener('click', close); document.addEventListener('keydown', onKey);
  box.append(img, x); document.body.append(box); box.focus();
}
function photoStrip(item) {
  if (!item.photos || !item.photos.length) return null;
  const row = el('div', 'hw-photos');
  for (const id of item.photos) {
    const b = el('button', 'hw-photo-btn'); b.type = 'button'; b.setAttribute('aria-label', dt('photo'));
    const img = el('img', 'hw-photo'); img.src = photoUrl(id); img.loading = 'lazy'; img.alt = '';
    b.append(img); b.addEventListener('click', e => { e.stopPropagation(); openPhoto(photoUrl(id)); });
    row.append(b);
  }
  return row;
}
function loadImage(file) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('image')); };
    img.src = url;
  });
}
// сжатие на устройстве: до 1280 px по длинной стороне, JPEG; в облако уходит base64 не больше ~400 тыс. знаков
async function compressImage(file) {
  const img = await loadImage(file);
  let scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  for (let attempt = 0; attempt < 5; attempt++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', attempt ? 0.6 : 0.72);
    const b64 = data.slice(data.indexOf(',') + 1);
    if (b64.length <= 400000) return { b64, preview: data };
    scale *= 0.75;
  }
  throw new Error('too big');
}
async function uploadPhoto(hwId, b64) {
  const r = await fetch(cloud + '/api/homework/' + hwId + '/photos', { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ data: b64 }) });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).id;
}
async function deletePhoto(id) {
  const r = await fetch(cloud + '/api/photos/' + id, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error(String(r.status));
}

// выбор фото в форме: уже загруженные (можно убрать) и новые (сжимаются сразу, уходят после сохранения задания)
function photoPicker(existing = []) {
  const state = { keep: [...existing], gone: [], added: [] };
  const node = el('div', 'hw-picker');
  const strip = el('div', 'hw-photos edit');
  const add = el('button', 'choice hw-addphoto', dt('addPhoto')); add.type = 'button';
  const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.hidden = true;
  const msg = el('p', 'hw-hint');
  const count = () => state.keep.length + state.added.length;
  const thumb = (src, remove) => {
    const w = el('div', 'hw-thumb'), img = el('img', 'hw-photo'), x = el('button', 'hw-thumb-x', '×');
    img.src = src; img.alt = ''; x.type = 'button'; x.setAttribute('aria-label', dt('removePhoto')); x.addEventListener('click', remove);
    w.append(img, x); return w;
  };
  function paint() {
    strip.replaceChildren();
    for (const id of state.keep) strip.append(thumb(photoUrl(id), () => { state.keep = state.keep.filter(x => x !== id); state.gone.push(id); paint(); }));
    state.added.forEach((p, idx) => strip.append(thumb(p.preview, () => { state.added.splice(idx, 1); paint(); })));
    add.hidden = count() >= MAX_PHOTOS;
  }
  add.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    msg.textContent = '';
    for (const f of [...input.files]) {
      if (count() >= MAX_PHOTOS) { msg.textContent = dt('photoLimit'); break; }
      try { state.added.push(await compressImage(f)); } catch (_) { msg.textContent = dt('photoFail'); }
    }
    input.value = ''; paint();
  });
  node.append(strip, add, input, msg); paint();
  return { node, state };
}
async function applyPhotos(hwId, picker) {
  let ok = true;
  for (const id of picker.state.gone) { try { await deletePhoto(id); } catch (_) { ok = false; } }
  for (const p of picker.state.added) { try { await uploadPhoto(hwId, p.b64); } catch (_) { ok = false; } }
  return ok;
}

function checkButton(i) {
  const on = isDone(i);
  const b = el('button', 'hw-check' + (on ? ' on' : ''), on ? '✓ ' + dt('done') : '○ ' + dt('done'));
  b.type = 'button'; b.setAttribute('aria-pressed', String(on)); b.title = on ? dt('markUndone') : dt('markDone');
  b.addEventListener('click', e => { e.stopPropagation(); setDone(i, !on); });
  return b;
}

let items = [];
let role = null; // 'owner' | 'editor' | 'reader' | null
let me = null;   // ответ /api/me (роль, подписка, запрошены ли права)
let initData = '';
let editingId = null;

// ---------- загрузка ----------
function headers() {
  const h = { accept: 'application/json' };
  if (initData) h['x-telegram-init-data'] = initData;
  return h;
}
async function loadItems() {
  // сначала показываем сохранённое (экран не прыгает), затем обновляем из сети
  if (!items.length) { try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved) && saved.length) { items = saved; render(); } } catch (_) {} }
  try {
    const url = nativeApp ? './data/homework.json' : cloud + '/api/homework';
    const r = await fetch(url, { headers: nativeApp ? {} : headers(), cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error('format');
    items = list;
    const at = Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); localStorage.setItem(CACHE_KEY + '-at', String(at)); } catch (_) {}
    pruneDone();
    window.scheduleCloudStatus = { ok: true, at }; window.dispatchEvent(new CustomEvent('cloud:status', { detail: window.scheduleCloudStatus }));
  } catch (_) {
    let at = 0;
    try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) items = saved; at = Number(localStorage.getItem(CACHE_KEY + '-at')) || 0; } catch (__) {}
    window.scheduleCloudStatus = { ok: false, at }; window.dispatchEvent(new CustomEvent('cloud:status', { detail: window.scheduleCloudStatus }));
  }
  render();
}
async function loadMe() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  initData = tg.initData;
  try {
    const r = await fetch(cloud + '/api/me', { headers: headers() });
    if (r.ok) { me = await r.json(); role = me.role; }
  } catch (_) {}
  const can = role === 'owner' || role === 'editor';
  const card = document.getElementById('hw-menu-card');
  if (card) card.hidden = !can;
  if (can) { await loadItems(); buildForm(); }
  window.dispatchEvent(new CustomEvent('role:change', { detail: { role, me } }));
}

// ---------- показ в карточках ----------
function safeLink(href) {
  try { const u = new URL(href); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch (_) { return null; }
}
function dateText(iso) {
  const d = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(d);
}
const authorLine = item => el('p', 'hw-author', t('hw.addedBy', { name: item.author }));
function block(item) {
  const past = item.due < todayIso();
  const box = el('div', 'hw-block' + (past ? ' hw-past' : '') + (isDone(item) ? ' hw-done' : ''));
  const head = el('div', 'hw-head');
  head.append(el('span', 'hw-badge', '✎'), el('strong', '', t('hw.dueTo', { date: dateText(item.due) })));
  if (past) head.append(el('span', 'hw-late', t('hw.past')));
  else head.append(checkButton(item));
  box.append(head, el('p', 'hw-text', item.text));
  const strip = photoStrip(item); if (strip) box.append(strip);
  if (item.author) box.append(authorLine(item));
  for (const raw of item.links || []) {
    const href = safeLink(raw);
    if (!href) continue;
    const a = el('a', 'hw-link', new URL(href).hostname);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = t('hw.openLink');
    box.append(a);
  }
  return box;
}
// Карточка «Ближайшее д/з» на главной: свёрнута по умолчанию, внутри только актуальные задания (срок не прошёл)
const HOME_OPEN_KEY = 'schedule-hw-open';
function renderHome() {
  const home = document.getElementById('home-screen');
  if (!home) return;
  const wasOpen = (() => { try { return localStorage.getItem(HOME_OPEN_KEY) === '1'; } catch (_) { return false; } })();
  home.querySelectorAll('.hw-home').forEach(n => n.remove());
  const today = todayIso();
  const names = new Map(), ends = new Map();
  if (data) for (const e of data.events) { const k = keyOf(e.day, e.start, e.subject, e.group); names.set(k, i18n.content('subjects', e.subject)); ends.set(k, clock(e.end)); }
  // актуально: срок в будущем, а на сегодня — пока пара ещё не закончилась (без времени окончания — до конца дня)
  const now = new Date(), nowClock = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const actual = items.filter(i => !isDone(i) && (i.due > today || (i.due === today && (!ends.get(i.lesson) || ends.get(i.lesson) > nowClock))))
    .sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
  if (!actual.length) return;
  const box = el('details', 'hw-home');
  box.open = wasOpen;
  const sum = el('summary', 'hw-home-summary');
  sum.append(el('span', 'hw-badge', '✎'), el('strong', '', t('hw.homeTitle')), el('span', 'hw-count', String(actual.length)));
  box.append(sum);
  box.addEventListener('toggle', () => { try { localStorage.setItem(HOME_OPEN_KEY, box.open ? '1' : '0'); } catch (_) {} });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  for (const i of actual.slice(0, 8)) {
    const row = el('div', 'hw-home-row');
    const when = i.due === today ? t('hw.todayWord') : i.due === isoDate(tomorrow) ? t('hw.tomorrowWord') : dateText(i.due);
    const top = el('div', 'hw-home-top');
    top.append(el('strong', '', (names.get(i.lesson) || i.lesson.split('|')[2] || '') + ' — ' + when), checkButton(i));
    row.append(top, el('p', 'hw-text', i.text));
    const strip = photoStrip(i); if (strip) row.append(strip);
    if (i.author) row.append(authorLine(i));
    for (const raw of i.links || []) {
      const href = safeLink(raw);
      if (!href) continue;
      const a = el('a', 'hw-link', new URL(href).hostname); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      row.append(a);
    }
    box.append(row);
  }
  const next = home.querySelector('.fork-next-card');
  const grid = home.querySelector('.menu-grid');
  if (next) next.after(box); else if (grid) grid.before(box); else home.append(box);
}

function render() {
  renderHome();
  const cards = document.querySelectorAll('#schedule .lesson');
  cards.forEach(card => card.querySelectorAll('.hw-block').forEach(b => b.remove()));
  if (!items.length) { renderList(); return; }
  cards.forEach(card => {
    if (card.dataset.source === 'assessment') return;
    const key = keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group);
    const mine = items.filter(i => i.lesson === key);
    if (!mine.length) return;
    const holder = card.querySelector('.details') || card;
    mine.forEach(i => holder.append(block(i)));
  });
  renderList();
}
document.addEventListener('schedule:render', render);
window.addEventListener('load', () => setTimeout(renderHome, 600));
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHome(); });
setInterval(() => { if (!document.hidden) renderHome(); }, 60000); // задания исчезают, как только пара закончилась
window.addEventListener('language:change', () => { render(); if (formBuilt) buildForm(); });
window.scheduleHomeworkDone = { isDone, count: () => items.filter(i => !isDone(i) && i.due >= todayIso()).length };

// ---------- форма редактора ----------
const root = document.getElementById('homework-screen');
let formBuilt = false;
function lessonOptions() {
  if (!data) return [];
  const seen = new Set(); const out = [];
  for (const e of data.events) {
    if (e.source === 'assessment') continue;
    const k = keyOf(e.day, e.start, e.subject, e.group);
    if (seen.has(k)) continue;
    seen.add(k);
    const g = e.group && e.group !== 'Общее' ? ' (' + i18n.group(e.group) + ')' : '';
    out.push({ key: k, day: e.day, start: clock(e.start), label: i18n.day(e.day, true) + ' ' + clock(e.start) + ' · ' + i18n.content('subjects', e.subject) + g });
  }
  const order = data.days || [];
  return out.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || a.start.localeCompare(b.start));
}
function nextDateFor(dayName) {
  const idx = (data.days || []).indexOf(dayName); // понедельник = 0
  if (idx < 0) return todayIso();
  const d = new Date();
  for (let i = 0; i < 14; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return isoDate(d);
}
function field(labelKey, control) {
  const wrap = el('label', 'hw-field');
  wrap.append(el('span', 'hw-label', t(labelKey)), control);
  return wrap;
}
let refs = {};
function buildForm() {
  if (!root || !(role === 'owner' || role === 'editor')) return;
  formBuilt = true;
  root.replaceChildren();
  const card = el('section', 'hw-card');
  const title = el('h2', 'hw-title', t(editingId ? 'hw.editTitle' : 'hw.formTitle'));
  const lesson = el('select', 'hw-input');
  const opts = lessonOptions();
  opts.forEach(o => { const op = el('option', '', o.label); op.value = o.key; lesson.append(op); });
  const due = el('input', 'hw-input'); due.type = 'date';
  due.min = todayIso(); const max = new Date(); max.setDate(max.getDate() + 14); due.max = isoDate(max); due.value = opts[0] ? nextDateFor(opts[0].day) : todayIso();
  lesson.addEventListener('change', () => { const o = opts.find(x => x.key === lesson.value); if (o) due.value = nextDateFor(o.day); });
  const text = el('textarea', 'hw-input'); text.rows = 4; text.maxLength = 1000; text.placeholder = t('hw.textPh');
  const links = el('textarea', 'hw-input'); links.rows = 3; links.placeholder = 'https://…';
  const status = el('p', 'hw-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'choice hw-save', t(editingId ? 'hw.save' : 'hw.add')); save.type = 'button';
  const cancel = el('button', 'choice hw-cancel', t('hw.cancel')); cancel.type = 'button'; cancel.hidden = !editingId;
  const actions = el('div', 'hw-actions'); actions.append(save, cancel);
  const editing = editingId ? items.find(i => i.id === editingId) : null;
  const picker = photoPicker(editing ? editing.photos || [] : []);
  const photoField = el('div', 'hw-field'); photoField.append(el('span', 'hw-label', dt('photos')), picker.node);
  card.append(title, field('hw.lesson', lesson), field('hw.due', due), field('hw.text', text), field('hw.links', links), photoField, actions, status, el('p', 'hw-hint', t('hw.hint')));
  const list = el('section', 'hw-card hw-list');
  root.append(card, list);
  refs = { lesson, due, text, links, status, save, cancel, title, list, picker };

  save.addEventListener('click', submit);
  cancel.addEventListener('click', () => { editingId = null; buildForm(); });
  renderList();
}
function setStatus(msg, bad) { if (refs.status) { refs.status.textContent = msg || ''; refs.status.classList.toggle('hw-bad', !!bad); } }
function describeError(status, body) {
  if (status === 403) return t('hw.errForbidden');
  if (status === 429) return t('hw.errRate');
  const f = (body && body.fields) || [];
  if (f.includes('due-range')) return t('hw.errRange');
  if (f.includes('link') || f.includes('links-count')) return t('hw.errLink');
  if (status === 400) return t('hw.errInvalid');
  return t('hw.errNet');
}
async function submit() {
  const payload = {
    lesson: refs.lesson.value, due: refs.due.value, text: refs.text.value,
    links: refs.links.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
  };
  refs.save.disabled = true; setStatus('');
  try {
    const url = cloud + '/api/homework' + (editingId ? '/' + editingId : '');
    const r = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus(describeError(r.status, body), true); return; }
    const photosOk = await applyPhotos(body.id || editingId, refs.picker);
    editingId = null;
    await loadItems(); buildForm(); setStatus(photosOk ? t('hw.saved') : dt('photoFail'), !photosOk);
  } catch (_) { setStatus(t('hw.errNet'), true); }
  finally { if (refs.save) refs.save.disabled = false; }
}
function renderList() {
  if (!refs.list) return;
  refs.list.replaceChildren(el('h2', 'hw-title', t('hw.active')));
  const mine = items.filter(i => i.editable);
  if (!mine.length) { refs.list.append(el('p', 'hw-hint', t('hw.empty'))); return; }
  const names = new Map(lessonOptions().map(o => [o.key, o.label]));
  for (const i of mine) {
    const row = el('article', 'hw-row');
    row.append(el('strong', '', names.get(i.lesson) || i.lesson.split('|').slice(0, 3).join(' · ')), el('span', 'hw-due', t('hw.dueTo', { date: dateText(i.due) })), el('p', 'hw-text', i.text));
    const strip = photoStrip(i); if (strip) row.append(strip);
    if (i.author) row.append(authorLine(i));
    const edit = el('button', 'choice', t('hw.edit')); edit.type = 'button';
    const del = el('button', 'choice', t('hw.delete')); del.type = 'button';
    edit.addEventListener('click', () => {
      editingId = i.id; buildForm();
      refs.lesson.value = i.lesson; refs.due.value = i.due; refs.text.value = i.text; refs.links.value = (i.links || []).join('\n');
      window.scrollTo(0, 0);
    });
    del.addEventListener('click', async () => {
      if (!window.confirm(t('hw.confirmDelete'))) return;
      try {
        const r = await fetch(cloud + '/api/homework/' + i.id, { method: 'DELETE', headers: headers() });
        if (!r.ok) { setStatus(describeError(r.status), true); return; }
        await loadItems(); setStatus(t('hw.deleted'));
      } catch (_) { setStatus(t('hw.errNet'), true); }
    });
    const actions = el('div', 'hw-actions'); actions.append(edit, del);
    row.append(actions);
    refs.list.append(row);
  }
}

// ---------- запуск ----------
// карточка д/з всегда идёт сразу после карточки «Следующая пара» (её добавляет android.js чуть позже)
{
  const home = document.getElementById('home-screen');
  if (home) new MutationObserver(() => {
    const box = home.querySelector('.hw-home'), next = home.querySelector('.fork-next-card');
    if (box && next && next.nextElementSibling !== box) next.after(box);
  }).observe(home, { childList: true });
}
// быстрое добавление из карточки пары: создаёт задание и загружает фото; возвращает { ok, status, body, photosOk }
async function createHomework(payload, picker) {
  const r = await fetch(cloud + '/api/homework', { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, body, message: describeError(r.status, body) };
  const photosOk = picker ? await applyPhotos(body.id, picker) : true;
  await loadItems();
  return { ok: true, status: r.status, body, photosOk };
}
window.scheduleHomework = {
  reload: loadItems, role: () => role, me: () => me, cloud, headers, nativeApp, photoPicker, createHomework,
  nextDateFor: day => (data ? nextDateFor(day) : todayIso()), keyOf, todayIso, isoDate, items: () => items,
  setMe(patch) { me = { ...(me || {}), ...patch }; },
};
if (nativeApp) { try { bridge.refreshHomework(); } catch (_) {} syncDoneToApp(); }
loadItems();
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) loadMe();
else document.addEventListener('telegram:ready', loadMe, { once: true });
})();

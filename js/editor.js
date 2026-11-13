(() => {
'use strict';
/* Для редакторов и владельца (вход через Telegram Mini App): кнопки на карточке пары — «＋ д/з» и «⋯ Изменить» (отмена, замена аудитории и т.д.).
   Для всех: раздел «Мой доступ» в настройках. */
const hw = window.scheduleHomework;
const i18n = window.scheduleI18n;
if (!hw || !i18n) return;
const ov = () => window.scheduleOverrides;

const L = {
  ru: {
    addHw: '＋ Д/з', change: '⋯ Изменить', sheetHw: 'Новое д/з', sheetOv: 'Изменить пару', date: 'Дата', due: 'Срок сдачи', text: 'Текст задания', textPh: 'Что задано', links: 'Ссылки (по одной в строке)', photos: 'Фото',
    save: 'Сохранить', close: 'Закрыть', kind: 'Что изменилось', kCancel: 'Пара отменена', kRoom: 'Другая аудитория', kTeacher: 'Другой преподаватель', kMove: 'Перенос', kNote: 'Заметка',
    pRoom: 'Номер аудитории', pTeacher: 'Кто ведёт', pMove: 'Куда и когда перенесли', pNote: 'Текст заметки', notify: 'Сообщить подписавшимся в Telegram', existing: 'Уже стоит', remove: 'Снять',
    saved: 'Сохранено', savedN: 'Сохранено, сообщение получили: {n}', removed: 'Снято', hwSaved: 'Задание добавлено',
    errNet: 'Нет связи с облаком. Попробуйте ещё раз.', errForbidden: 'Нет прав на это действие.', errRate: 'Слишком много действий, попробуйте позже.', errRange: 'Дата должна быть в ближайшие 14 дней.', errInvalid: 'Проверьте поля.', photoFail: 'Задание сохранено, но фото загрузить не удалось.',
    accessTitle: 'Мой доступ', role: 'Роль', rReader: 'Читатель', rEditor: 'Редактор', rOwner: 'Владелец', rNone: 'Доступ не одобрен', sub: 'Оповещения в Telegram', subNote: 'Отмены и замены пар, напоминания о парах, обновления и объявления.',
    request: 'Запросить права редактора', requested: 'Запрос отправлен владельцу. Ответ придёт в Telegram.', requestWait: 'Запрос уже отправлен, повторить можно через сутки.', editorNote: 'Вы можете отмечать изменения прямо в карточках пар и добавлять д/з.',
  },
  en: {
    addHw: '＋ Homework', change: '⋯ Change', sheetHw: 'New homework', sheetOv: 'Change this class', date: 'Date', due: 'Due date', text: 'Task', textPh: 'What was assigned', links: 'Links (one per line)', photos: 'Photos',
    save: 'Save', close: 'Close', kind: 'What changed', kCancel: 'Class cancelled', kRoom: 'Different room', kTeacher: 'Different teacher', kMove: 'Moved', kNote: 'Note',
    pRoom: 'Room number', pTeacher: 'Who teaches', pMove: 'Where and when', pNote: 'Note text', notify: 'Notify subscribers in Telegram', existing: 'Already set', remove: 'Remove',
    saved: 'Saved', savedN: 'Saved, messages delivered: {n}', removed: 'Removed', hwSaved: 'Homework added',
    errNet: 'No connection to the cloud. Try again.', errForbidden: 'You are not allowed to do this.', errRate: 'Too many actions, try again later.', errRange: 'The date must be within the next 14 days.', errInvalid: 'Check the fields.', photoFail: 'Homework saved, but the photo could not be uploaded.',
    accessTitle: 'My access', role: 'Role', rReader: 'Reader', rEditor: 'Editor', rOwner: 'Owner', rNone: 'Access not approved', sub: 'Telegram notifications', subNote: 'Cancelled or changed classes, class reminders, updates and announcements.',
    request: 'Request editor access', requested: 'Request sent to the owner. The answer will come in Telegram.', requestWait: 'Already requested; you can ask again in a day.', editorNote: 'You can mark changes right on class cards and add homework.',
  },
  de: {
    addHw: '＋ Hausaufg.', change: '⋯ Ändern', sheetHw: 'Neue Hausaufgabe', sheetOv: 'Stunde ändern', date: 'Datum', due: 'Abgabe', text: 'Aufgabe', textPh: 'Was aufgegeben wurde', links: 'Links (einer pro Zeile)', photos: 'Fotos',
    save: 'Speichern', close: 'Schließen', kind: 'Was ist neu', kCancel: 'Stunde entfällt', kRoom: 'Anderer Raum', kTeacher: 'Andere Lehrkraft', kMove: 'Verschoben', kNote: 'Notiz',
    pRoom: 'Raumnummer', pTeacher: 'Wer unterrichtet', pMove: 'Wohin und wann', pNote: 'Text der Notiz', notify: 'Abonnenten in Telegram benachrichtigen', existing: 'Bereits gesetzt', remove: 'Entfernen',
    saved: 'Gespeichert', savedN: 'Gespeichert, Nachrichten zugestellt: {n}', removed: 'Entfernt', hwSaved: 'Hausaufgabe hinzugefügt',
    errNet: 'Keine Verbindung zur Cloud. Bitte erneut versuchen.', errForbidden: 'Dazu fehlt die Berechtigung.', errRate: 'Zu viele Aktionen, später erneut versuchen.', errRange: 'Das Datum muss in den nächsten 14 Tagen liegen.', errInvalid: 'Felder prüfen.', photoFail: 'Aufgabe gespeichert, Foto konnte nicht hochgeladen werden.',
    accessTitle: 'Mein Zugang', role: 'Rolle', rReader: 'Leser', rEditor: 'Editor', rOwner: 'Inhaber', rNone: 'Zugang nicht freigegeben', sub: 'Telegram-Benachrichtigungen', subNote: 'Entfallene oder geänderte Stunden, Erinnerungen, Updates und Ankündigungen.',
    request: 'Editor-Rechte anfragen', requested: 'Anfrage an den Inhaber gesendet. Die Antwort kommt in Telegram.', requestWait: 'Bereits angefragt, in einem Tag erneut möglich.', editorNote: 'Du kannst Änderungen direkt an den Stundenkarten markieren und Hausaufgaben hinzufügen.',
  },
};
const lang = () => i18n.getLanguage() || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k] ?? L.ru[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const toast = (text, opts) => (window.scheduleToast ? window.scheduleToast(text, opts) : null);
const canEdit = () => hw.role() === 'owner' || hw.role() === 'editor';
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

async function api(method, path, body) {
  const r = await fetch(hw.cloud + path, { method, headers: { ...hw.headers(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: json };
}
function errorText(res) {
  if (res.status === 403) return tr('errForbidden');
  if (res.status === 429) return tr('errRate');
  const f = (res.body && res.body.fields) || [];
  if (f.includes('date-range') || f.includes('due-range')) return tr('errRange');
  if (res.status === 400) return tr('errInvalid');
  return tr('errNet');
}

// ---------- окно (sheet) ----------
function openSheet(title) {
  const back = el('div', 'ed-back');
  const box = el('div', 'ed-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title); box.tabIndex = -1;
  const head = el('div', 'ed-head'); const h = el('h2', '', title);
  const x = el('button', 'ed-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close'));
  head.append(h, x);
  const body = el('div', 'ed-body');
  box.append(head, body); back.append(box); document.body.append(back);
  document.body.classList.add('ed-open');
  const close = () => { back.remove(); document.body.classList.remove('ed-open'); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  x.addEventListener('click', close); document.addEventListener('keydown', onKey);
  box.focus();
  return { body, close };
}
const field = (label, control) => { const w = el('label', 'ed-field'); w.append(el('span', 'ed-label', label), control); return w; };
const input = (type, cls = 'ed-input') => { const n = el('input', cls); n.type = type; return n; };

// ---------- «＋ д/з» ----------
function openHomeworkSheet(card) {
  const sheet = openSheet(tr('sheetHw'));
  const subject = el('p', 'ed-sub', i18n.content('subjects', card.dataset.subject) + ' · ' + card.dataset.start);
  const due = input('date'); const today = new Date(); due.min = iso(today); const max = new Date(); max.setDate(max.getDate() + 14); due.max = iso(max);
  due.value = hw.nextDateFor(card.dataset.day);
  const text = el('textarea', 'ed-input'); text.rows = 4; text.maxLength = 1000; text.placeholder = tr('textPh');
  const links = el('textarea', 'ed-input'); links.rows = 2; links.placeholder = 'https://…';
  const picker = hw.photoPicker([]);
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'ed-primary', tr('save')); save.type = 'button';
  const photosField = el('div', 'ed-field'); photosField.append(el('span', 'ed-label', tr('photos')), picker.node);
  sheet.body.append(subject, field(tr('due'), due), field(tr('text'), text), field(tr('links'), links), photosField, status, save);
  text.focus();
  save.addEventListener('click', async () => {
    status.textContent = ''; status.classList.remove('bad');
    save.disabled = true;
    try {
      const res = await hw.createHomework({
        lesson: hw.keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group), due: due.value, text: text.value,
        links: links.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      }, picker);
      if (!res.ok) { status.textContent = res.message || errorText(res); status.classList.add('bad'); return; }
      sheet.close();
      toast(res.photosOk ? tr('hwSaved') : tr('photoFail'));
    } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); }
    finally { save.disabled = false; }
  });
}

// ---------- «⋯ Изменить» ----------
const KINDS = ['cancel', 'room', 'teacher', 'move', 'note'];
const KIND_LABEL = { cancel: 'kCancel', room: 'kRoom', teacher: 'kTeacher', move: 'kMove', note: 'kNote' };
const KIND_PH = { room: 'pRoom', teacher: 'pTeacher', move: 'pMove', note: 'pNote' };

function openOverrideSheet(card) {
  const O = ov(); if (!O) return;
  const sheet = openSheet(tr('sheetOv'));
  const key = O.keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group);
  sheet.body.append(el('p', 'ed-sub', i18n.content('subjects', card.dataset.subject) + ' · ' + card.dataset.start));

  const date = input('date'); date.min = iso(new Date()); const max = new Date(); max.setDate(max.getDate() + 14); date.max = iso(max);
  date.value = O.isoOf(O.nextDate(card.dataset.day));
  let kind = 'cancel';
  const chips = el('div', 'ed-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', tr('kind'));
  const value = input('text'); value.maxLength = 80; value.hidden = true;
  const valueWrap = field('', value); valueWrap.hidden = true;
  const paint = () => {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    valueWrap.hidden = kind === 'cancel';
    if (kind !== 'cancel') { value.hidden = false; value.placeholder = tr(KIND_PH[kind]); valueWrap.firstChild.textContent = tr(KIND_LABEL[kind]); }
  };
  for (const k of KINDS) { const b = el('button', 'ed-chip', tr(KIND_LABEL[k])); b.type = 'button'; b.dataset.kind = k; b.addEventListener('click', () => { kind = k; paint(); if (k !== 'cancel') value.focus(); }); chips.append(b); }
  const notifyBox = input('checkbox', 'ed-check'); const notifyRow = el('label', 'ed-checkrow'); notifyRow.append(notifyBox, el('span', '', tr('notify')));
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'ed-primary', tr('save')); save.type = 'button';
  sheet.body.append(field(tr('date'), date), chips, valueWrap, notifyRow, status, save);

  const existing = el('div', 'ed-existing');
  const paintExisting = () => {
    existing.replaceChildren();
    const mine = O.forLesson(key);
    if (!mine.length) return;
    existing.append(el('h3', 'ed-sub', tr('existing')));
    for (const o of mine) {
      const row = el('div', 'ed-row');
      row.append(el('span', '', O.dateLabel(o.date) + ' · ' + O.chipText(o)));
      const rm = el('button', 'ed-ghost', tr('remove')); rm.type = 'button';
      rm.addEventListener('click', async () => {
        rm.disabled = true;
        try {
          const res = await api('DELETE', '/api/overrides/' + o.id + (notifyBox.checked ? '?notify=1' : ''));
          if (!res.ok) { status.textContent = errorText(res); status.classList.add('bad'); rm.disabled = false; return; }
          await O.reload(); paintExisting(); status.textContent = tr('removed'); status.classList.remove('bad');
        } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); rm.disabled = false; }
      });
      row.append(rm); existing.append(row);
    }
  };
  sheet.body.append(existing); paint(); paintExisting();

  save.addEventListener('click', async () => {
    status.textContent = ''; status.classList.remove('bad'); save.disabled = true;
    try {
      const res = await api('POST', '/api/overrides', { lesson: key, date: date.value, kind, value: kind === 'cancel' ? '' : value.value, notify: notifyBox.checked });
      if (!res.ok) { status.textContent = errorText(res); status.classList.add('bad'); return; }
      await O.reload();
      sheet.close();
      toast(res.body.notified ? tr('savedN', { n: res.body.notified }) : tr('saved'));
    } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); }
    finally { save.disabled = false; }
  });
}

// ---------- кнопки на карточках ----------
function addTools() {
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    const old = card.querySelector('.lesson-tools');
    if (!canEdit() || card.dataset.source === 'assessment') { if (old) old.remove(); continue; }
    if (old) continue;
    const row = el('div', 'lesson-tools');
    const add = el('button', 'ed-tool', tr('addHw')); add.type = 'button';
    const change = el('button', 'ed-tool', tr('change')); change.type = 'button';
    add.addEventListener('click', e => { e.stopPropagation(); openHomeworkSheet(card); });
    change.addEventListener('click', e => { e.stopPropagation(); openOverrideSheet(card); });
    row.append(add, change); card.append(row);
  }
}
document.addEventListener('schedule:render', addTools);
window.addEventListener('language:change', () => { document.querySelectorAll('.lesson-tools').forEach(n => n.remove()); addTools(); paintAccess(); });

// ---------- «Мой доступ» ----------
let accessBox = null, accessRows = null;
function buildAccess() {
  const settings = document.getElementById('settings-screen');
  if (!settings || accessBox) return;
  accessBox = el('section', 'settings-group'); accessBox.id = 'access-settings';
  accessBox.append(el('h2', '', ''));
  accessRows = el('div', 'ed-access');
  accessBox.append(accessRows);
  const notify = document.getElementById('notify-settings');
  if (notify) notify.before(accessBox); else settings.append(accessBox);
}
function roleLabel(role) { return role === 'owner' ? tr('rOwner') : role === 'editor' ? tr('rEditor') : role === 'reader' ? tr('rReader') : tr('rNone'); }
function paintAccess() {
  buildAccess();
  if (!accessBox) return;
  accessBox.firstChild.textContent = tr('accessTitle');
  accessRows.replaceChildren();
  const me = hw.me();
  accessBox.hidden = !me; // раздел только для Mini App: в APK и PWA его нет
  if (!me) return;
  const roleRow = el('div', 'settings-row'); roleRow.append(el('span', '', tr('role')), el('strong', '', roleLabel(me.role)));
  accessRows.append(roleRow);
  if (me.role === 'owner' || me.role === 'editor') accessRows.append(el('p', 'settings-note', tr('editorNote')));
  if (me.status === 'approved' || me.role) {
    const row = el('div', 'settings-row');
    const label = el('div', 'ed-subcopy'); label.append(el('span', '', tr('sub')), el('small', '', tr('subNote')));
    const sw = el('label', 'fork-switch'); const cb = el('input'); cb.type = 'checkbox'; cb.setAttribute('role', 'switch'); cb.setAttribute('aria-label', tr('sub')); cb.checked = !!me.subscribed;
    sw.append(cb, el('span', 'fork-switch-track')); row.append(label, sw); accessRows.append(row);
    cb.addEventListener('change', async () => {
      const want = cb.checked;
      try { const res = await api('POST', '/api/me/subscription', { on: want }); if (!res.ok) throw new Error(); hw.setMe({ subscribed: want }); }
      catch (_) { cb.checked = !want; toast(tr('errNet')); }
    });
  }
  if (me.role === 'reader') {
    if (me.requested) accessRows.append(el('p', 'settings-note', tr('requestWait')));
    else {
      const btn = el('button', 'choice settings-test', tr('request')); btn.type = 'button';
      const note = el('p', 'settings-note');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await api('POST', '/api/me/request-editor');
          if (res.ok) { hw.setMe({ requested: true }); btn.hidden = true; note.textContent = tr('requested'); }
          else { note.textContent = res.status === 429 ? tr('requestWait') : errorText(res); btn.disabled = false; }
        } catch (_) { note.textContent = tr('errNet'); btn.disabled = false; }
      });
      accessRows.append(btn, note);
    }
  }
}
window.addEventListener('role:change', () => { addTools(); paintAccess(); });
buildAccess(); paintAccess();
addTools();
})();

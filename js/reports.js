(() => {
'use strict';
/* «История д/з» (за последние 30 дней, поиск и фильтр по предмету).
   Работает везде: в APK запросы идут через Android-часть (только по списку разрешённых путей), в PWA и Telegram — напрямую. */
const cloud = window.scheduleCloud;
const i18n = window.scheduleI18n;
if (!cloud || !cloud.enabled || !i18n) return;

const L = {
  ru: {
    group: 'Ещё', history: '📚 История домашних заданий', close: 'Закрыть',
    histTitle: 'История д/з', histNote: 'Хранится 30 дней. Фото удаляются раньше, через 14 дней.', all: 'Все предметы', search: 'Поиск по тексту',
    dueTo: 'К {date}', added: 'добавил(а) {name}, {date}', more: 'Показать ещё', empty: 'Заданий не найдено.', offline: 'Нет связи. Показаны последние сохранённые.', loading: 'Загружаю…', errNet: 'Нет связи с облаком.',
  },
  en: {
    group: 'More', history: '📚 Homework history', close: 'Close',
    histTitle: 'Homework history', histNote: 'Kept for 30 days. Photos are removed earlier, after 14 days.', all: 'All subjects', search: 'Search text',
    dueTo: 'Due {date}', added: 'added by {name}, {date}', more: 'Show more', empty: 'No homework found.', offline: 'Offline. Showing the last saved list.', loading: 'Loading…', errNet: 'No connection to the cloud.',
  },
  de: {
    group: 'Mehr', history: '📚 Hausaufgaben-Verlauf', close: 'Schließen',
    histTitle: 'Hausaufgaben-Verlauf', histNote: '30 Tage gespeichert. Fotos werden früher gelöscht, nach 14 Tagen.', all: 'Alle Fächer', search: 'Text suchen',
    dueTo: 'Bis {date}', added: 'von {name}, {date}', more: 'Mehr anzeigen', empty: 'Keine Hausaufgaben gefunden.', offline: 'Offline. Zuletzt gespeicherte Liste.', loading: 'Lädt…', errNet: 'Keine Verbindung zur Cloud.',
  },
};
const lang = () => i18n.getLanguage() || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k] ?? L.ru[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const LOCALES = { ru: 'ru-RU', en: 'en-GB', de: 'de-DE' };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } },
};
const fmtDate = iso => { try { return new Intl.DateTimeFormat(LOCALES[lang()] || 'ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00')); } catch (_) { return iso; } };
const fmtStamp = sec => { try { return new Intl.DateTimeFormat(LOCALES[lang()] || 'ru-RU', { day: 'numeric', month: 'long' }).format(new Date(sec * 1000)); } catch (_) { return ''; } };
const safeLink = href => { try { const u = new URL(href); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch (_) { return null; } };

// ---------- окно ----------
function openSheet(title) {
  const back = el('div', 'ed-back');
  const box = el('div', 'ed-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title); box.tabIndex = -1;
  const head = el('div', 'ed-head'); const x = el('button', 'ed-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close'));
  head.append(el('h2', '', title), x);
  const body = el('div', 'ed-body');
  box.append(head, body); back.append(box); document.body.append(back);
  document.body.classList.add('ed-open');
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { back.remove(); document.body.classList.remove('ed-open'); document.removeEventListener('keydown', onKey); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  x.addEventListener('click', close); document.addEventListener('keydown', onKey);
  box.focus();
  return { body, close };
}

// ---------- история д/з ----------
const HIST_CACHE = 'schedule-hw-history';
function openHistory() {
  const sheet = openSheet(tr('histTitle'));
  const note = el('p', 'ed-sub', tr('histNote'));
  const subject = el('select', 'ed-input'); subject.setAttribute('aria-label', tr('all'));
  const search = el('input', 'ed-input'); search.type = 'search'; search.placeholder = tr('search'); search.setAttribute('aria-label', tr('search')); search.maxLength = 100;
  const bar = el('div', 'rp-bar'); bar.append(subject, search);
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const list = el('div', 'rp-list');
  const more = el('button', 'ed-primary', tr('more')); more.type = 'button'; more.hidden = true;
  sheet.body.append(note, bar, status, list, more);

  let offset = 0, token = 0, subjects = [];
  const fillSubjects = names => {
    const cur = subject.value; subject.replaceChildren();
    const all = el('option', '', tr('all')); all.value = ''; subject.append(all);
    for (const s of names) { const o = el('option', '', i18n.content('subjects', s)); o.value = s; subject.append(o); }
    subject.value = names.includes(cur) ? cur : '';
  };
  const card = it => {
    const box = el('article', 'rp-item');
    const head = el('div', 'rp-head'); head.append(el('strong', '', tr('dueTo', { date: fmtDate(it.due) })), el('span', 'rp-subject', i18n.content('subjects', it.subject)));
    box.append(head, el('p', 'rp-text', it.text));
    for (const raw of it.links || []) { const href = safeLink(raw); if (!href) continue; const a = el('a', 'hw-link', new URL(href).hostname); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a); }
    if (it.author || it.created) box.append(el('p', 'rp-meta', tr('added', { name: it.author || '—', date: fmtStamp(it.created) })));
    return box;
  };
  const show = (data, append) => {
    if (!append) list.replaceChildren();
    for (const it of data.items || []) list.append(card(it));
    if (!list.children.length) list.append(el('p', 'rp-empty', tr('empty')));
    more.hidden = !data.more;
  };
  async function load(append) {
    const my = ++token;
    if (!append) { offset = 0; status.textContent = tr('loading'); status.classList.remove('bad'); }
    const q = '?limit=20&offset=' + offset + (subject.value ? '&subject=' + encodeURIComponent(subject.value) : '') + (search.value.trim() ? '&q=' + encodeURIComponent(search.value.trim()) : '');
    try {
      const r = await cloud.request('GET', '/api/homework/history' + q);
      if (my !== token) return;
      if (r.status !== 200 || !r.json || !Array.isArray(r.json.items)) throw new Error(String(r.status));
      if (!append && !subject.value && !search.value.trim()) store.set(HIST_CACHE, JSON.stringify(r.json));
      if (!append || !subjects.length) { subjects = r.json.subjects || []; fillSubjects(subjects); }
      status.textContent = ''; offset += r.json.items.length; show(r.json, append);
    } catch (_) {
      if (my !== token) return;
      let saved = null; try { saved = JSON.parse(store.get(HIST_CACHE) || 'null'); } catch (__) { /* нет кэша */ }
      if (saved && !append && !subject.value && !search.value.trim()) { status.textContent = tr('offline'); status.classList.add('bad'); fillSubjects(saved.subjects || []); show(saved, false); more.hidden = true; }
      else { status.textContent = tr('errNet'); status.classList.add('bad'); }
    }
  }
  let timer = 0;
  subject.addEventListener('change', () => load(false));
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(false), 350); });
  more.addEventListener('click', () => load(true));
  load(false);
}

// ---------- кнопки в настройках ----------
let box = null, title = null, b1 = null;
function paint() {
  const settings = document.getElementById('settings-screen');
  if (!settings) return;
  if (!box) {
    box = el('section', 'settings-group'); box.id = 'reports-settings';
    title = el('h2'); b1 = el('button', 'choice settings-test');
    b1.type = 'button';
    b1.addEventListener('click', openHistory);
    const row = el('div', 'rp-buttons'); row.append(b1);
    box.append(title, row); settings.append(box);
  }
  title.textContent = tr('group'); b1.textContent = tr('history');
}
window.addEventListener('language:change', paint);
paint();
window.scheduleReports = { openHistory, openSheet };
})();

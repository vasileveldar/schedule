(() => {
'use strict';
/* «История д/з» (за последние 30 дней, поиск и фильтр по предмету) и «Сообщить об ошибке или идее».
   Работает везде: в APK запросы идут через Android-часть (только по списку разрешённых путей), в PWA и Telegram — напрямую. */
const cloud = window.scheduleCloud;
const i18n = window.scheduleI18n;
if (!cloud || !cloud.enabled || !i18n) return;

const L = {
  ru: {
    group: 'Ещё', history: '📚 История домашних заданий', report: '💬 Сообщить об ошибке или идее',
    histTitle: 'История д/з', histNote: 'Хранится 30 дней. Фото удаляются раньше, через 14 дней.', all: 'Все предметы', search: 'Поиск по тексту',
    dueTo: 'К {date}', added: 'добавил(а) {name}, {date}', more: 'Показать ещё', empty: 'Заданий не найдено.', offline: 'Нет связи. Показаны последние сохранённые.', loading: 'Загружаю…', errNet: 'Нет связи с облаком.',
    repTitle: 'Сообщить об ошибке или идее', kind: 'Тип', kBug: 'Ошибка', kIdea: 'Идея', kQuestion: 'Вопрос', text: 'Что случилось или что предлагаете', textPh: 'Опишите коротко: что, где, как повторить',
    nick: 'Подпись (необязательно)', nickPh: 'Ник или имя', attached: 'К сообщению приложатся: {info}. Других личных данных нет.', send: 'Отправить', sent: 'Отправлено. Спасибо!', close: 'Закрыть',
    errShort: 'Напишите хотя бы пару слов.', errRate: 'Слишком много сообщений. Попробуйте через час.', errBad: 'Не получилось отправить. Проверьте текст.',
  },
  en: {
    group: 'More', history: '📚 Homework history', report: '💬 Report a bug or suggest an idea',
    histTitle: 'Homework history', histNote: 'Kept for 30 days. Photos are removed earlier, after 14 days.', all: 'All subjects', search: 'Search text',
    dueTo: 'Due {date}', added: 'added by {name}, {date}', more: 'Show more', empty: 'No homework found.', offline: 'Offline. Showing the last saved list.', loading: 'Loading…', errNet: 'No connection to the cloud.',
    repTitle: 'Report a bug or suggest an idea', kind: 'Type', kBug: 'Bug', kIdea: 'Idea', kQuestion: 'Question', text: 'What happened or what do you suggest', textPh: 'Briefly: what, where, how to repeat',
    nick: 'Signature (optional)', nickPh: 'Nickname or name', attached: 'Attached to the message: {info}. No other personal data.', send: 'Send', sent: 'Sent. Thank you!', close: 'Close',
    errShort: 'Please write a few words.', errRate: 'Too many messages. Try again in an hour.', errBad: 'Could not send. Check the text.',
  },
  de: {
    group: 'Mehr', history: '📚 Hausaufgaben-Verlauf', report: '💬 Fehler melden oder Idee senden',
    histTitle: 'Hausaufgaben-Verlauf', histNote: '30 Tage gespeichert. Fotos werden früher gelöscht, nach 14 Tagen.', all: 'Alle Fächer', search: 'Text suchen',
    dueTo: 'Bis {date}', added: 'von {name}, {date}', more: 'Mehr anzeigen', empty: 'Keine Hausaufgaben gefunden.', offline: 'Offline. Zuletzt gespeicherte Liste.', loading: 'Lädt…', errNet: 'Keine Verbindung zur Cloud.',
    repTitle: 'Fehler melden oder Idee senden', kind: 'Art', kBug: 'Fehler', kIdea: 'Idee', kQuestion: 'Frage', text: 'Was ist passiert oder was schlägst du vor', textPh: 'Kurz: was, wo, wie wiederholbar',
    nick: 'Name (optional)', nickPh: 'Spitzname oder Name', attached: 'Wird mitgeschickt: {info}. Sonst keine persönlichen Daten.', send: 'Senden', sent: 'Gesendet. Danke!', close: 'Schließen',
    errShort: 'Bitte ein paar Worte schreiben.', errRate: 'Zu viele Nachrichten. Versuche es in einer Stunde erneut.', errBad: 'Senden nicht möglich. Text prüfen.',
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
  if (window.scheduleStats) window.scheduleStats.track('feature', 'history');
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

// ---------- обращение ----------
function techInfo() {
  const ua = navigator.userAgent || '';
  const os = (ua.match(/Android [\d.]+|iPhone OS [\d_]+|iPad; CPU OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+|Linux/) || [''])[0].replace(/_/g, '.');
  let version = '';
  try { if (window.AppPreferences && typeof window.AppPreferences.appVersion === 'function') version = String(window.AppPreferences.appVersion() || ''); } catch (_) { /* старая версия приложения */ }
  const platform = cloud.native ? 'APK' : cloud.inTelegram() ? 'Telegram' : (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Web');
  const info = { platform, lang: lang(), screen: document.body.dataset.screen || '', device: [os, window.innerWidth + 'x' + window.innerHeight].filter(Boolean).join(', ') };
  if (version) info.version = version;
  return info;
}
function openReport() {
  if (window.scheduleStats) window.scheduleStats.track('feature', 'report');
  const sheet = openSheet(tr('repTitle'));
  const kind = el('select', 'ed-input'); kind.setAttribute('aria-label', tr('kind'));
  for (const [v, k] of [['idea', 'kIdea'], ['bug', 'kBug'], ['question', 'kQuestion']]) { const o = el('option', '', tr(k)); o.value = v; kind.append(o); }
  const text = el('textarea', 'ed-input'); text.rows = 5; text.maxLength = 1000; text.placeholder = tr('textPh'); text.setAttribute('aria-label', tr('text'));
  const counter = el('p', 'rp-meta', '0 / 1000');
  text.addEventListener('input', () => { counter.textContent = text.value.length + ' / 1000'; });
  const nick = el('input', 'ed-input'); nick.type = 'text'; nick.maxLength = 40; nick.placeholder = tr('nickPh'); nick.value = store.get('schedule-nick') || ''; nick.setAttribute('aria-label', tr('nick'));
  const info = techInfo();
  const infoText = Object.entries(info).filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join(' · ');
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const send = el('button', 'ed-primary', tr('send')); send.type = 'button';
  const field = (label, control) => { const w = el('label', 'ed-field'); w.append(el('span', 'ed-label', label), control); return w; };
  sheet.body.append(field(tr('kind'), kind), field(tr('text'), text), counter);
  if (!cloud.inTelegram()) sheet.body.append(field(tr('nick'), nick));
  sheet.body.append(el('p', 'rp-meta', tr('attached', { info: infoText })), status, send);
  text.focus();
  send.addEventListener('click', async () => {
    status.textContent = ''; status.classList.remove('bad');
    if (text.value.trim().length < 3) { status.textContent = tr('errShort'); status.classList.add('bad'); return; }
    send.disabled = true;
    try {
      const body = { kind: kind.value, text: text.value.trim(), device: cloud.deviceId(), info };
      if (!cloud.inTelegram() && nick.value.trim()) body.nick = nick.value.trim();
      const r = await cloud.request('POST', '/api/feedback', body);
      if (r.status === 201) { status.textContent = tr('sent'); text.value = ''; counter.textContent = '0 / 1000'; setTimeout(sheet.close, 1400); return; }
      status.textContent = r.status === 429 ? tr('errRate') : r.status === 400 ? tr('errBad') : tr('errNet'); status.classList.add('bad');
    } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); }
    send.disabled = false;
  });
}

// ---------- кнопки в настройках ----------
let box = null, title = null, b1 = null, b2 = null;
function paint() {
  const settings = document.getElementById('settings-screen');
  if (!settings) return;
  if (!box) {
    box = el('section', 'settings-group'); box.id = 'reports-settings';
    title = el('h2'); b1 = el('button', 'choice settings-test'); b2 = el('button', 'choice settings-test');
    b1.type = 'button'; b2.type = 'button';
    b1.addEventListener('click', openHistory); b2.addEventListener('click', openReport);
    const row = el('div', 'rp-buttons'); row.append(b1, b2);
    box.append(title, row); settings.append(box);
  }
  title.textContent = tr('group'); b1.textContent = tr('history'); b2.textContent = tr('report');
}
window.addEventListener('language:change', paint);
paint();
window.scheduleReports = { openHistory, openReport, openSheet };
})();

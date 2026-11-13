(() => {
'use strict';
/* Раздел «Управление»: только для владельца (вход через Telegram Mini App; сервер проверяет подпись Telegram).
   Цифры, заявки, пользователи, рассылка подписавшимся, проверка облака. Сборка APK, публикация сайта и ключ подписи остаются на компьютере. */
const hw = window.scheduleHomework;
const card = document.getElementById('owner-menu-card');
const root = document.getElementById('owner-screen');
if (!hw || !card || !root) return;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const toast = (text, opts) => (window.scheduleToast ? window.scheduleToast(text, opts) : null);
const pad = n => String(n).padStart(2, '0');
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());

async function api(method, path, body) {
  const r = await fetch(hw.cloud + path, { method, headers: { ...hw.headers(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: json };
}

let stats = null, users = [], filter = '', loadedAt = 0, loading = false, summaryText = '', pingMs = null, release = null;
let broadcastText = '';
let analytics = null; // анонимная статистика
let feedback = [];   // обращения («Сообщить об ошибке или идее»)
let replyOpen = 0;   // id обращения, под которым открыто поле ответа
let replyText = '';

function isOwner() { return hw.role() === 'owner'; }
function applyRole() { card.hidden = !isOwner(); if (isOwner() && !root.dataset.built) { root.dataset.built = '1'; render(); } }
window.addEventListener('role:change', applyRole);
applyRole();

async function refresh(force) {
  if (!isOwner() || loading || (!force && Date.now() - loadedAt < 15000)) return;
  loading = true; render();
  try {
    const t0 = performance.now();
    const [s, u, rel, fb, an] = await Promise.all([api('GET', '/api/admin/stats'), api('GET', '/api/admin/users'), api('GET', '/api/release'), api('GET', '/api/admin/feedback'), api('GET', '/api/admin/analytics?days=14')]);
    pingMs = Math.round(performance.now() - t0);
    stats = s.ok ? s.body : null; users = u.ok && Array.isArray(u.body) ? u.body : []; release = rel.ok ? rel.body : null; feedback = fb.ok && Array.isArray(fb.body) ? fb.body : []; analytics = an.ok && an.body && an.body.now ? an.body : null;
    if (!s.ok || !u.ok) toast(s.status === 403 || u.status === 403 ? 'Нет доступа: откройте приложение из Telegram.' : 'Не удалось загрузить данные.');
    loadedAt = Date.now();
  } catch (_) { toast('Нет связи с облаком.'); }
  loading = false; render();
}
new MutationObserver(() => { if (document.body.dataset.screen === 'owner') refresh(false); }).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });

// ---------- вспомогательное ----------
function tile(value, label, tone) {
  const t = el('div', 'ow-tile' + (tone ? ' ' + tone : ''));
  t.append(el('strong', '', String(value)), el('span', '', label));
  return t;
}
function section(title) {
  const s = el('section', 'hw-card ow-section'); s.append(el('h2', 'hw-title', title)); return s;
}
function button(text, cls, run) {
  const b = el('button', cls || 'choice', text); b.type = 'button';
  b.addEventListener('click', async () => { b.disabled = true; try { await run(); } finally { b.disabled = false; } });
  return b;
}
async function setUser(u, patch, okText) {
  const res = await api('POST', '/api/admin/users/' + u.chat_id, patch);
  if (!res.ok) { toast('Не получилось: ' + (res.body.error || res.status)); return; }
  Object.assign(u, res.body); toast(okText); render(); refresh(true); // цифры сверху обновляются
}
async function removeUser(u) {
  if (!window.confirm('Удалить «' + u.name + '» из бота вместе с данными? Это нельзя отменить.')) return;
  const res = await api('DELETE', '/api/admin/users/' + u.chat_id);
  if (!res.ok) { toast('Не удалилось.'); return; }
  users = users.filter(x => x.chat_id !== u.chat_id); toast('Удалён'); render(); refresh(true);
}

// ---------- отрисовка ----------
function render() {
  const keepScroll = window.scrollY;
  root.replaceChildren();
  if (!isOwner()) { root.append(el('p', 'hw-hint', 'Раздел доступен владельцу при входе через Telegram.')); return; }

  const top = el('div', 'ow-top');
  top.append(el('span', 'ow-stamp', loading ? 'Обновляю…' : loadedAt ? 'Обновлено в ' + hhmm(new Date(loadedAt)) + (pingMs !== null ? ' · облако ответило за ' + pingMs + ' мс' : '') : ''));
  top.append(button('↻ Обновить', 'choice', () => refresh(true)));
  root.append(top);

  if (stats) {
    const u = stats.users;
    const grid = el('div', 'ow-grid');
    grid.append(
      tile(u.approved, 'в боте'), tile(u.pending, 'ждут решения', u.pending ? 'warn' : ''), tile(u.subscribed, 'подписаны'), tile(u.editors, 'редакторов'),
      tile(stats.homework, 'д/з активных'), tile(stats.photos.count + ' · ' + stats.photos.mb + ' МБ', 'фото'), tile(stats.overrides, 'изменений пар'), tile(release ? 'v' + release.version : '—', 'версия APK'), tile(feedback.filter(x => x.status === 'new').length, 'обращений новых', feedback.some(x => x.status === 'new') ? 'warn' : '')
    );
    root.append(grid);
    if (stats.errors && stats.errors.length) {
      const box = section('Ошибки бота (последние)');
      for (const e of stats.errors) box.append(el('p', 'ow-err', new Date(e.at * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' — ' + e.detail));
      root.append(box);
    }
  } else if (!loading) root.append(el('p', 'hw-hint', 'Данных пока нет. Нажмите «Обновить».'));

  // заявки
  const pending = users.filter(u => u.status === 'pending');
  if (pending.length) {
    const box = section('Заявки на доступ');
    for (const u of pending) {
      const row = el('div', 'ow-row');
      row.append(userLabel(u));
      const acts = el('div', 'ow-acts');
      acts.append(button('Одобрить', 'choice ow-yes', () => setUser(u, { status: 'approved' }, 'Одобрено')), button('Отклонить', 'choice', () => setUser(u, { status: 'rejected' }, 'Отклонено')));
      row.append(acts); box.append(row);
    }
    root.append(box);
  }

  renderFeedback();
  renderAnalytics();

  // пользователи
  const box = section('Пользователи');
  const search = el('input', 'hw-input'); search.type = 'search'; search.placeholder = 'Поиск по имени или @нику'; search.value = filter; search.setAttribute('aria-label', 'Поиск');
  search.addEventListener('input', () => { filter = search.value; renderUsers(list); });
  const list = el('div', 'ow-list');
  box.append(search, list); root.append(box);
  renderUsers(list);

  // рассылка
  const bc = section('Сообщение подписавшимся');
  const ta = el('textarea', 'hw-input'); ta.rows = 3; ta.maxLength = 500; ta.placeholder = 'Короткий текст (до 500 знаков). Получат только подписавшиеся на уведомления.'; ta.value = broadcastText;
  const count = el('p', 'hw-hint', ta.value.length + ' / 500');
  ta.addEventListener('input', () => { broadcastText = ta.value; count.textContent = ta.value.length + ' / 500'; });
  const send = button('Разослать…', 'choice ow-yes', async () => {
    const text = ta.value.trim();
    if (!text) { toast('Напишите текст.'); return; }
    const prev = await api('POST', '/api/admin/broadcast', { preview: true });
    if (!prev.ok) { toast('Не удалось проверить получателей.'); return; }
    if (!prev.body.recipients) { toast('Подписавшихся нет: слать некому.'); return; }
    if (!window.confirm('Отправить сообщение ' + prev.body.recipients + ' подписавшимся?\n\n«' + text + '»\n\nДействие необратимо.')) return;
    const res = await api('POST', '/api/admin/broadcast', { text });
    if (res.ok) { toast('Отправлено: ' + res.body.sent + ' из ' + res.body.total + (res.body.failed ? ', не дошло: ' + res.body.failed : '')); broadcastText = ''; render(); }
    else toast(res.status === 429 ? 'Слишком часто: подождите минуту.' : 'Не получилось отправить.');
  });
  bc.append(ta, count, send); root.append(bc);

  // инструменты
  const tools = section('Инструменты');
  const row = el('div', 'ow-acts wrap');
  row.append(
    button('Сводка за неделю', 'choice', async () => { const r = await api('GET', '/api/admin/summary'); summaryText = r.ok ? r.body.text : 'Не удалось получить сводку.'; render(); }),
    button('Домашние задания', 'choice', async () => { const b = document.getElementById('hw-menu-card'); if (b) b.click(); }),
  );
  tools.append(row);
  if (summaryText) { const pre = el('pre', 'ow-pre', summaryText); tools.append(pre); }
  if (release) tools.append(el('p', 'hw-hint', 'Последний релиз: v' + release.version + (release.changelog ? '\n' + release.changelog : '')));
  tools.append(el('p', 'hw-hint', 'Сборка APK, публикация сайта, выкатка облака и резервная копия ключа подписи — только в центре управления на компьютере.'));
  root.append(tools);
  window.scrollTo(0, keepScroll);
}

// ---------- анонимная статистика ----------
const SCREEN_NAME = { home: 'Главная', schedule: 'Расписание', calendar: 'Календарь', game: 'Игры', settings: 'Настройки', homework: 'Д/з', owner: 'Управление' };
const FEATURE_NAME = { share: 'Поделиться парой', done: 'Отметка «Сделано»', search: 'Поиск', history: 'История д/з', report: 'Сообщить об ошибке' };
const LANG_NAME = { ru: 'Русский', en: 'English', de: 'Deutsch' };
function bars(title, list, names) {
  const wrap = el('div', 'ow-bars');
  wrap.append(el('h3', 'ow-subhead', title));
  const max = Math.max(1, ...list.map(x => x.n));
  if (!list.length) wrap.append(el('p', 'ow-meta', 'нет данных'));
  for (const x of list.slice(0, 8)) {
    const row = el('div', 'ow-bar');
    const fill = el('i'); fill.style.width = Math.max(3, Math.round(x.n / max * 100)) + '%';
    const track = el('span', 'ow-bar-track'); track.append(fill);
    row.append(el('span', 'ow-bar-name', (names && names[x.key]) || x.key), track, el('b', '', String(x.n)));
    wrap.append(row);
  }
  return wrap;
}
function renderAnalytics() {
  if (!analytics) return;
  const a = analytics;
  const box = section('Статистика (анонимная, ' + a.days + ' дн.)');
  if (!a.hasData) { box.append(el('p', 'hw-hint', 'Данных пока нет: статистика начинает копиться, когда люди откроют обновлённое приложение.')); root.append(box); return; }
  const grid = el('div', 'ow-grid');
  grid.append(tile(a.now.day, 'активных сегодня'), tile(a.now.week, 'за неделю' + (a.now.prevWeek ? ' (прошлая: ' + a.now.prevWeek + ')' : '')), tile(a.now.month, 'за месяц'), tile(a.returning, 'вернулись за ' + a.days + ' дн.'));
  box.append(grid);
  // активные по дням
  const maxDay = Math.max(1, ...a.series.map(x => x.n));
  const spark = el('div', 'ow-spark'); spark.setAttribute('role', 'img'); spark.setAttribute('aria-label', 'Активные устройства по дням');
  for (const d of a.series) { const c = el('div', 'ow-spark-col'); const i = el('i'); i.style.height = Math.max(4, Math.round(d.n / maxDay * 100)) + '%'; c.title = d.day + ': ' + d.n; c.append(i, el('span', '', d.day.slice(8))); spark.append(c); }
  box.append(el('h3', 'ow-subhead', 'Активные по дням'), spark);
  box.append(bars('Платформы', a.platform), bars('Версии приложения', a.version.map(x => ({ ...x, key: 'v' + x.key }))), bars('Экраны', a.screen, SCREEN_NAME), bars('Функции', a.feature, FEATURE_NAME), bars('Языки', a.lang, LANG_NAME), bars('Темы', a.theme));
  // часы активности
  const maxHour = Math.max(1, ...a.hour.map(x => x.n));
  const hours = el('div', 'ow-spark ow-hours');
  for (const h of a.hour) { const c = el('div', 'ow-spark-col'); const i = el('i'); i.style.height = Math.max(h.n ? 4 : 1, Math.round(h.n / maxHour * 100)) + '%'; c.title = h.key + ':00 — ' + h.n; c.append(i, el('span', '', Number(h.key) % 3 === 0 ? h.key : '')); hours.append(c); }
  box.append(el('h3', 'ow-subhead', 'Часы активности (Алматы)'), hours);
  box.append(el('p', 'hw-hint', 'Считаются только устройства без имён и ID. Каждый человек — максимум раз в день. Выключатель у пользователей: «Настройки → Ещё».'));
  root.append(box);
}

// ---------- обращения ----------
const KIND_ICON = { bug: '🐞 Ошибка', idea: '💡 Идея', question: '❓ Вопрос' };
async function setFeedback(f, patch, okText) {
  const res = await api('POST', '/api/admin/feedback/' + f.id, patch);
  if (!res.ok) { toast(res.status === 409 ? 'Автор не вошёл через Telegram: ответить нельзя.' : 'Не получилось: ' + (res.body.error || res.status)); return false; }
  if (patch.reply !== undefined && res.body.delivered === false) { toast('Telegram не принял ответ (возможно, человек остановил бота).'); return false; }
  toast(okText); replyOpen = 0; replyText = ''; refresh(true); return true;
}
function renderFeedback() {
  if (!feedback.length) return;
  const box = section('Обращения');
  const fresh = feedback.filter(f => f.status === 'new'), done = feedback.filter(f => f.status === 'done').slice(0, 5);
  for (const f of [...fresh, ...done]) {
    const item = el('div', 'ow-row ow-fb' + (f.status === 'done' ? ' ow-fb-done' : ''));
    const head = el('div', 'ow-user');
    head.append(el('strong', '', (KIND_ICON[f.kind] || f.kind) + ' · ' + (f.author || 'аноним')));
    head.append(el('span', 'ow-meta', new Date(f.created * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (f.status === 'done' ? ' · решено' : '')));
    item.append(head, el('p', 'ow-fb-text', f.text));
    const info = ['version', 'platform', 'lang', 'screen', 'device'].filter(k => f.info && f.info[k]).map(k => f.info[k]).join(' · ');
    if (info) item.append(el('p', 'ow-meta', info));
    if (f.reply) item.append(el('p', 'ow-fb-reply', '↩ Ответ: ' + f.reply));
    const acts = el('div', 'ow-acts wrap');
    if (f.identified) acts.append(button(replyOpen === f.id ? 'Скрыть' : 'Ответить', 'choice', () => { replyOpen = replyOpen === f.id ? 0 : f.id; replyText = ''; render(); }));
    acts.append(button(f.status === 'done' ? 'Вернуть в новые' : 'Решено', 'choice', () => setFeedback(f, { status: f.status === 'done' ? 'new' : 'done' }, 'Готово')));
    item.append(acts);
    if (replyOpen === f.id) {
      const ta = el('textarea', 'hw-input'); ta.rows = 3; ta.maxLength = 1000; ta.placeholder = 'Ответ придёт автору от бота'; ta.value = replyText;
      ta.addEventListener('input', () => { replyText = ta.value; });
      item.append(ta, button('Отправить ответ', 'choice ow-yes', async () => {
        const text = ta.value.trim(); if (!text) { toast('Напишите ответ.'); return; }
        await setFeedback(f, { reply: text }, 'Ответ отправлен');
      }));
    }
    box.append(item);
  }
  root.append(box);
}

function userLabel(u) {
  const wrap = el('div', 'ow-user');
  const name = el('strong', '', u.name || ('id ' + u.chat_id));
  wrap.append(name);
  const meta = [];
  if (u.username) meta.push('@' + u.username);
  if (u.role === 'owner') meta.push('владелец'); else if (u.role === 'editor') meta.push('редактор');
  if (u.platform) meta.push(u.platform === 'ios' ? 'iPhone' : 'Android');
  if (u.status === 'blocked') meta.push('заблокирован'); else if (u.status === 'rejected') meta.push('отклонён');
  if (u.subscribed === 1) meta.push('🔔');
  wrap.append(el('span', 'ow-meta', meta.join(' · ')));
  return wrap;
}
function renderUsers(list) {
  list.replaceChildren();
  const q = filter.trim().toLowerCase();
  const shown = users.filter(u => u.status !== 'pending' && (!q || (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)));
  if (!shown.length) { list.append(el('p', 'hw-hint', q ? 'Никого не найдено.' : 'Пользователей пока нет.')); return; }
  for (const u of shown) {
    const row = el('div', 'ow-row');
    row.append(userLabel(u));
    if (u.role !== 'owner') {
      const acts = el('div', 'ow-acts');
      acts.append(
        button(u.role === 'editor' ? 'Снять права' : 'Сделать редактором', 'choice', () => setUser(u, { role: u.role === 'editor' ? 'reader' : 'editor' }, u.role === 'editor' ? 'Права сняты' : 'Теперь редактор')),
        button(u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать', 'choice', () => setUser(u, { status: u.status === 'blocked' ? 'approved' : 'blocked' }, u.status === 'blocked' ? 'Разблокирован' : 'Заблокирован')),
        button('Удалить', 'choice ow-del', () => removeUser(u)),
      );
      row.append(acts);
    }
    list.append(row);
  }
}
})();

(() => {
'use strict';
/* Отдельное Mini App «Управление» (открывается кнопкой «🛠 Управление» в боте; кнопку видит только владелец).
   Здесь: цифры, заявки, люди и роли, «Написать всем», сводка. Доступ проверяет облако по подписи Telegram: страница без подписи ничего не покажет.
   Сборка APK, публикация сайта, выкатка облака и ключ подписи остаются на компьютере. */
const root = document.getElementById('admin-root');
const toastBox = document.getElementById('adm-toast');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const pad = n => String(n).padStart(2, '0');
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
let toastTimer = 0;
function toast(text) { toastBox.textContent = text; toastBox.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastBox.hidden = true; }, 3200); }

let cloud = '', initData = '';
async function api(method, path, body) {
  const headers = { accept: 'application/json', 'content-type': 'application/json' };
  if (initData) headers['x-telegram-init-data'] = initData;
  const r = await fetch(cloud + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: json };
}

const state = { role: null, stats: null, users: [], release: null, filter: '', loadedAt: 0, ping: null, loading: false, summary: '', broadcast: '' };
const isOwner = () => state.role === 'owner';

async function start() {
  try {
    const cfg = await (await fetch('../data/app-config.json', { cache: 'no-cache' })).json();
    cloud = String(cfg.cloudUrl || '').replace(/\/+$/, '');
  } catch (_) { /* нет настроек */ }
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { initData = tg.initData || ''; try { tg.ready(); tg.expand(); } catch (_) { /* не критично */ } }
  if (!cloud || !initData) { render(); return; }
  const me = await api('GET', '/api/me').catch(() => null);
  state.role = me && me.ok ? me.body.role : null;
  render();
  if (isOwner()) refresh(true);
}
// Telegram подгружается отдельным скриптом: даём ему секунду на запуск
setTimeout(start, 400);

async function refresh(force) {
  if (!isOwner() || state.loading || (!force && Date.now() - state.loadedAt < 15000)) return;
  state.loading = true; render();
  try {
    const t0 = performance.now();
    const [s, u, rel] = await Promise.all([api('GET', '/api/admin/stats'), api('GET', '/api/admin/users'), api('GET', '/api/release')]);
    state.ping = Math.round(performance.now() - t0);
    state.stats = s.ok ? s.body : null; state.users = u.ok && Array.isArray(u.body) ? u.body : []; state.release = rel.ok ? rel.body : null;
    if (!s.ok || !u.ok) toast(s.status === 403 || u.status === 403 ? 'Нет доступа.' : 'Не удалось загрузить данные.');
    state.loadedAt = Date.now();
  } catch (_) { toast('Нет связи с облаком.'); }
  state.loading = false; render();
}

// ---------- вспомогательное ----------
const tile = (value, label, tone) => { const t = el('div', 'ow-tile' + (tone ? ' ' + tone : '')); t.append(el('strong', '', String(value)), el('span', '', label)); return t; };
const section = title => { const s = el('section', 'hw-card ow-section'); s.append(el('h2', 'hw-title', title)); return s; };
function button(text, cls, run) {
  const b = el('button', cls || 'choice', text); b.type = 'button';
  b.addEventListener('click', async () => { b.disabled = true; try { await run(); } finally { b.disabled = false; } });
  return b;
}
async function setUser(u, patch, okText) {
  const res = await api('POST', '/api/admin/users/' + u.chat_id, patch);
  if (!res.ok) { toast('Не получилось: ' + (res.body.error || res.status)); return; }
  Object.assign(u, res.body); toast(okText); render(); refresh(true);
}
async function removeUser(u) {
  if (!window.confirm('Удалить «' + u.name + '» из бота вместе с данными? Это нельзя отменить.')) return;
  const res = await api('DELETE', '/api/admin/users/' + u.chat_id);
  if (!res.ok) { toast('Не удалилось.'); return; }
  state.users = state.users.filter(x => x.chat_id !== u.chat_id); toast('Удалён'); render(); refresh(true);
}
const ROLE_NAME = { reader: 'Читатель', editor: 'Редактор', headman: 'Староста', owner: 'Владелец' };

function userLabel(u) {
  const wrap = el('div', 'ow-user');
  wrap.append(el('strong', '', u.name || ('id ' + u.chat_id)));
  const meta = [];
  if (u.username) meta.push('@' + u.username);
  if (u.role && u.role !== 'reader') meta.push(ROLE_NAME[u.role] || u.role);
  if (u.platform) meta.push(u.platform === 'ios' ? 'iPhone' : 'Android');
  if (u.status === 'blocked') meta.push('заблокирован'); else if (u.status === 'rejected') meta.push('отклонён');
  if (u.subscribed === 1) meta.push('⏰ напоминания');
  wrap.append(el('span', 'ow-meta', meta.join(' · ')));
  return wrap;
}
function roleSwitch(u) {
  const box = el('div', 'adm-roles'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Роль: ' + (u.name || ''));
  for (const role of ['reader', 'editor', 'headman']) {
    const b = el('button', '', ROLE_NAME[role]); b.type = 'button'; b.setAttribute('aria-pressed', String(u.role === role));
    b.addEventListener('click', () => { if (u.role !== role) setUser(u, { role }, 'Теперь: ' + ROLE_NAME[role].toLowerCase()); });
    box.append(b);
  }
  return box;
}
function renderUsers(list) {
  list.replaceChildren();
  const q = state.filter.trim().toLowerCase();
  const shown = state.users.filter(u => u.status !== 'pending' && (!q || (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)));
  if (!shown.length) { list.append(el('p', 'hw-hint', q ? 'Никого не найдено.' : 'Пользователей пока нет.')); return; }
  for (const u of shown) {
    const row = el('div', 'ow-row');
    row.append(userLabel(u));
    if (u.role !== 'owner') {
      const acts = el('div', 'ow-acts wrap');
      if (u.status === 'approved') acts.append(roleSwitch(u));
      acts.append(
        button(u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать', 'choice', () => setUser(u, { status: u.status === 'blocked' ? 'approved' : 'blocked' }, u.status === 'blocked' ? 'Разблокирован' : 'Заблокирован')),
        button('Удалить', 'choice ow-del', () => removeUser(u)),
      );
      row.append(acts);
    }
    list.append(row);
  }
}

// ---------- отрисовка ----------
function render() {
  const keepScroll = window.scrollY;
  root.replaceChildren();
  if (!cloud || !initData) { root.append(el('p', 'hw-hint', 'Откройте эту страницу кнопкой «🛠 Управление» в боте внутри Telegram.')); return; }
  if (state.role === null) { root.append(el('p', 'hw-hint', 'Загрузка…')); return; }
  if (!isOwner()) { root.append(el('p', 'hw-hint', 'Раздел доступен только владельцу.')); return; }

  const top = el('div', 'ow-top');
  top.append(el('span', 'ow-stamp', state.loading ? 'Обновляю…' : state.loadedAt ? 'Обновлено в ' + hhmm(new Date(state.loadedAt)) + (state.ping !== null ? ' · облако ответило за ' + state.ping + ' мс' : '') : ''));
  top.append(button('↻ Обновить', 'choice', () => refresh(true)));
  root.append(top);

  if (state.stats) {
    const u = state.stats.users;
    const grid = el('div', 'ow-grid');
    grid.append(
      tile(u.approved, 'в боте'), tile(u.pending, 'ждут решения', u.pending ? 'warn' : ''), tile(u.subscribed, 'включили напоминания'), tile(u.editors, 'редакторов и старост'),
      tile(state.stats.homework, 'д/з активных'), tile(state.stats.photos.count + ' · ' + state.stats.photos.mb + ' МБ', 'фото'), tile(state.stats.overrides, 'изменений пар'), tile(state.release ? 'v' + state.release.version : '—', 'версия APK')
    );
    root.append(grid);
    if (state.stats.errors && state.stats.errors.length) {
      const box = section('Ошибки бота (последние)');
      for (const e of state.stats.errors) box.append(el('p', 'ow-err', new Date(e.at * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' — ' + e.detail));
      root.append(box);
    }
  } else if (!state.loading) root.append(el('p', 'hw-hint', 'Данных пока нет. Нажмите «Обновить».'));

  const pending = state.users.filter(u => u.status === 'pending');
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

  const people = section('Люди и роли');
  const search = el('input', 'hw-input'); search.type = 'search'; search.placeholder = 'Поиск по имени или @нику'; search.value = state.filter; search.setAttribute('aria-label', 'Поиск');
  const list = el('div', 'ow-list');
  search.addEventListener('input', () => { state.filter = search.value; renderUsers(list); });
  people.append(search, list); root.append(people);
  renderUsers(list);

  const bc = section('Написать всем');
  const ta = el('textarea', 'hw-input'); ta.rows = 3; ta.maxLength = 500; ta.placeholder = 'Ваше сообщение (до 500 знаков). Получат все, кто пользуется ботом.'; ta.value = state.broadcast;
  const count = el('p', 'hw-hint', ta.value.length + ' / 500');
  ta.addEventListener('input', () => { state.broadcast = ta.value; count.textContent = ta.value.length + ' / 500'; });
  bc.append(ta, count, button('Отправить…', 'choice ow-yes', async () => {
    const text = ta.value.trim();
    if (!text) { toast('Напишите текст.'); return; }
    const prev = await api('POST', '/api/admin/broadcast', { preview: true });
    if (!prev.ok) { toast('Не удалось проверить получателей.'); return; }
    if (!prev.body.recipients) { toast('Некому отправлять.'); return; }
    if (!window.confirm('Отправить сообщение ' + prev.body.recipients + ' пользователям бота?\n\n«' + text + '»\n\nДействие необратимо.')) return;
    const res = await api('POST', '/api/admin/broadcast', { text });
    if (res.ok) { toast('Отправлено: ' + res.body.sent + ' из ' + res.body.total + (res.body.failed ? ', не дошло: ' + res.body.failed : '')); state.broadcast = ''; render(); }
    else toast(res.status === 429 ? 'Слишком часто: подождите минуту.' : 'Не получилось отправить.');
  }));
  root.append(bc);

  const tools = section('Инструменты');
  const row = el('div', 'ow-acts wrap');
  row.append(button('Сводка за неделю', 'choice', async () => { const r = await api('GET', '/api/admin/summary'); state.summary = r.ok ? r.body.text : 'Не удалось получить сводку.'; render(); }));
  tools.append(row);
  if (state.summary) tools.append(el('pre', 'ow-pre', state.summary));
  if (state.release) tools.append(el('p', 'hw-hint', 'Последний релиз: v' + state.release.version + (state.release.changelog ? '\n' + state.release.changelog : '')));
  tools.append(el('p', 'hw-hint', 'Сборка APK, публикация сайта, выкатка облака и резервная копия ключа подписи — только в центре управления на компьютере.'));
  root.append(tools);
  window.scrollTo(0, keepScroll);
}
})();

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

function isOwner() { return hw.role() === 'owner'; }
function applyRole() { card.hidden = !isOwner(); if (isOwner() && !root.dataset.built) { root.dataset.built = '1'; render(); } }
window.addEventListener('role:change', applyRole);
applyRole();

async function refresh(force) {
  if (!isOwner() || loading || (!force && Date.now() - loadedAt < 15000)) return;
  loading = true; render();
  try {
    const t0 = performance.now();
    const [s, u, rel] = await Promise.all([api('GET', '/api/admin/stats'), api('GET', '/api/admin/users'), api('GET', '/api/release')]);
    pingMs = Math.round(performance.now() - t0);
    stats = s.ok ? s.body : null; users = u.ok && Array.isArray(u.body) ? u.body : []; release = rel.ok ? rel.body : null;
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
      tile(stats.homework, 'д/з активных'), tile(stats.photos.count + ' · ' + stats.photos.mb + ' МБ', 'фото'), tile(stats.overrides, 'изменений пар'), tile(release ? 'v' + release.version : '—', 'версия APK')
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

(() => {
'use strict';
/* 2048: свайп или стрелки. Состояние сохраняется, счёт уходит в таблицу рекордов при завершении партии и при выходе из игры. */
const arc = () => window.scheduleArcade;
const host = document.querySelector('#game-screen .arc-extra');
if (!host || !arc()) return;
const N = 4, SAVE = 'schedule-2048-state', BEST = 'schedule-2048-best';
const L = {
  ru: { score: 'Счёт', best: 'Рекорд', fresh: 'Новая игра', undo: 'Отменить ход', over: 'Ходов больше нет', win: 'Получилось 2048! Можно играть дальше.', hint: 'Сдвигайте плитки свайпом или стрелками. Одинаковые числа складываются.', aria: 'Игровое поле 2048' },
  en: { score: 'Score', best: 'Best', fresh: 'New game', undo: 'Undo move', over: 'No more moves', win: 'You made 2048! Keep going if you like.', hint: 'Swipe or use arrow keys. Equal numbers merge.', aria: '2048 game board' },
  de: { score: 'Punkte', best: 'Rekord', fresh: 'Neues Spiel', undo: 'Zug zurück', over: 'Keine Züge mehr', win: '2048 geschafft! Du kannst weiterspielen.', hint: 'Wischen oder Pfeiltasten benutzen. Gleiche Zahlen verschmelzen.', aria: '2048-Spielfeld' },
};
const lang = () => (window.scheduleI18n && window.scheduleI18n.getLanguage()) || 'ru';
const tr = k => (L[lang()] || L.ru)[k];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } } };

const wrap = el('section', 'g-wrap'); wrap.id = 'game-2048'; wrap.hidden = true;
const head = el('div', 'g-head');
const scoreBox = el('div', 'jg-stat'); const scoreLabel = el('span'); const scoreVal = el('strong', '', '0'); scoreBox.append(scoreLabel, scoreVal);
const bestBox = el('div', 'jg-stat jg-best'); const bestLabel = el('span'); const bestVal = el('strong', '', '0'); bestBox.append(bestLabel, bestVal);
const scoresRow = el('div', 'jg-scores'); scoresRow.append(scoreBox, bestBox);
const btnNew = el('button', 'choice g-btn'); btnNew.type = 'button';
const btnUndo = el('button', 'choice g-btn'); btnUndo.type = 'button';
const actions = el('div', 'g-actions'); actions.append(btnUndo, btnNew);
head.append(scoresRow, actions);
const field = el('div', 'g-2048'); field.tabIndex = 0; field.setAttribute('role', 'application');
for (let i = 0; i < N * N; i++) { const cell = el('i', 'g-cell'); cell.style.setProperty('--r', Math.floor(i / N)); cell.style.setProperty('--c', i % N); field.append(cell); }
const layer = el('div', 'g-tiles'); field.append(layer);
const msg = el('div', 'g-msg'); msg.hidden = true; field.append(msg);
const hint = el('p', 'arc-note g-hint');
wrap.append(head, field, hint);
host.append(wrap);

let tiles = [], score = 0, best = Math.max(0, parseInt(store.get(BEST), 10) || 0), over = false, won = false, prev = null, nextId = 1, sent = 0, active = false;
const els = new Map();

const live = () => tiles.filter(t => !t.gone);
function snapshot() { return JSON.stringify({ tiles: live().map(t => ({ v: t.v, r: t.r, c: t.c })), score, won }); }
function restore(json) {
  const d = JSON.parse(json);
  tiles = d.tiles.map(t => ({ id: nextId++, v: t.v, r: t.r, c: t.c })); score = d.score | 0; won = !!d.won; over = false;
}
function spawn() {
  const taken = new Set(live().map(t => t.r * N + t.c)), free = [];
  for (let i = 0; i < N * N; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return;
  const i = free[Math.floor(Math.random() * free.length)];
  tiles.push({ id: nextId++, v: Math.random() < .9 ? 2 : 4, r: Math.floor(i / N), c: i % N, fresh: true });
}
function canMove() {
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  for (const t of live()) g[t.r][t.c] = t.v;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!g[r][c]) return true;
    if (c + 1 < N && g[r][c] === g[r][c + 1]) return true;
    if (r + 1 < N && g[r][c] === g[r + 1][c]) return true;
  }
  return false;
}
function newGame(keepSubmit) {
  if (!keepSubmit) submit();
  tiles = []; score = 0; over = false; won = false; prev = null; sent = 0;
  msg.hidden = true; for (const [, n] of els) n.remove(); els.clear();
  spawn(); spawn(); render(); persist();
}
function persist() { store.set(SAVE, over ? '' : snapshot()); }
function submit() { if (score > 0 && score > sent) { sent = score; window.dispatchEvent(new CustomEvent('arcade:score', { detail: { game: 'g2048', score } })); } }

// dir: 0 влево, 1 вверх, 2 вправо, 3 вниз
function move(dir) {
  if (over) return false;
  const before = snapshot();
  let moved = false, gained = 0;
  for (const t of tiles) { t.merged = false; t.fresh = false; }
  const horizontal = dir % 2 === 0;
  for (let line = 0; line < N; line++) {
    const items = live().filter(t => (horizontal ? t.r : t.c) === line).sort((a, b) => { const k = horizontal ? 'c' : 'r'; return dir < 2 ? a[k] - b[k] : b[k] - a[k]; });
    let idx = 0, last = null;
    for (const t of items) {
      if (last && last.v === t.v && !last.merged) {
        last.v *= 2; last.merged = true; gained += last.v; t.gone = true; t.r = last.r; t.c = last.c; moved = true;
      } else {
        const p = dir < 2 ? idx : N - 1 - idx;
        const nr = horizontal ? line : p, nc = horizontal ? p : line;
        if (t.r !== nr || t.c !== nc) { moved = true; t.r = nr; t.c = nc; }
        last = t; idx++;
      }
    }
  }
  if (!moved) return false;
  prev = before;
  score += gained;
  if (score > best) { best = score; store.set(BEST, String(best)); }
  spawn();
  const reached = live().some(t => t.v >= 2048);
  if (reached && !won) { won = true; showMessage(tr('win'), 2600); arc().sfx('win'); }
  else arc().sfx(gained ? 'merge' : 'move');
  if (gained >= 64) arc().haptic(15);
  render();
  setTimeout(() => { tiles = tiles.filter(t => !t.gone); render(); }, 140);
  if (!canMove()) { over = true; showMessage(tr('over'), 0); arc().sfx('over'); arc().haptic([40, 30, 60]); submit(); }
  persist();
  return true;
}
function showMessage(text, ms) {
  msg.textContent = text; msg.hidden = false;
  clearTimeout(showMessage.timer);
  if (ms) showMessage.timer = setTimeout(() => { msg.hidden = true; }, ms);
}
function hue(v) { return (Math.log2(v) * 41 + 18) % 360; }
function render() {
  const ids = new Set();
  for (const t of tiles) {
    ids.add(t.id);
    let node = els.get(t.id);
    if (!node) { node = el('div', 'g-tile'); els.set(t.id, node); layer.append(node); if (t.fresh) node.classList.add('new'); }
    node.style.setProperty('--r', t.r); node.style.setProperty('--c', t.c);
    node.textContent = t.v;
    const dark = document.documentElement.dataset.theme === 'dark';
    node.style.background = 'hsl(' + hue(t.v) + ' ' + (dark ? 38 : 58) + '% ' + (dark ? Math.max(22, 44 - Math.log2(t.v) * 1.5) : Math.max(42, 86 - Math.log2(t.v) * 3.5)) + '%)';
    node.style.color = (dark || t.v >= 128) ? '#fff' : '#2a2620';
    node.style.fontSize = t.v >= 1024 ? '1.05em' : t.v >= 128 ? '1.3em' : '1.7em';
    node.classList.toggle('pop', !!t.merged);
    node.style.zIndex = t.gone ? 1 : 2;
  }
  for (const [id, node] of els) if (!ids.has(id)) { node.remove(); els.delete(id); }
  scoreVal.textContent = score; bestVal.textContent = best;
  btnUndo.disabled = !prev;
}
function paintText() {
  scoreLabel.textContent = tr('score'); bestLabel.textContent = tr('best'); btnNew.textContent = tr('fresh'); btnUndo.textContent = tr('undo');
  hint.textContent = tr('hint'); field.setAttribute('aria-label', tr('aria'));
}

btnNew.addEventListener('click', () => { arc().unlockAudio(); newGame(); field.focus({ preventScroll: true }); });
btnUndo.addEventListener('click', () => { if (!prev) return; restore(prev); prev = null; msg.hidden = true; for (const [, n] of els) n.remove(); els.clear(); render(); persist(); });

// управление: свайп по полю и стрелки
let start = null;
field.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, id: e.pointerId }; arc().unlockAudio(); });
field.addEventListener('pointerup', e => {
  if (!start || e.pointerId !== start.id) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3));
});
field.addEventListener('pointercancel', () => { start = null; });
field.style.touchAction = 'none';
document.addEventListener('keydown', e => {
  if (!active || e.altKey || e.ctrlKey || e.metaKey) return;
  const map = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, a: 0, w: 1, d: 2, s: 3, A: 0, W: 1, D: 2, S: 3 };
  if (e.key in map) { e.preventDefault(); move(map[e.key]); }
});

// запуск
try { const saved = store.get(SAVE); if (saved) restore(saved); } catch (_) { tiles = []; }
if (!tiles.length) { spawn(); spawn(); } else if (!canMove()) { over = true; }
paintText(); render();
window.addEventListener('language:change', paintText);
arc().register({
  id: 'g2048', el: wrap,
  activate() { active = true; arc().unlockAudio(); render(); },
  deactivate() { active = false; submit(); },
  getState() { return { score, best, over }; },
});
})();

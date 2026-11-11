(() => {
'use strict';
/* «Игровой зал»: вкладки игр, звук/вибрация, дневной рекорд и таблица рекордов под игрой. */
const root = window;
const screen = document.getElementById('game-screen');
if (!screen) return;
const L = {
  ru: { jump: 'Прыжки', g2048: '2048', board: 'Таблица рекордов', today: 'Сегодня', best: 'Рекорд', empty: 'Пока никого. Станьте первым!', you: 'вы', rank: 'Ваше место', nick: 'Ваш ник', save: 'Сохранить', nickHint: 'Ник нужен, чтобы попасть в таблицу рекордов (2–16 символов).', tg: 'Имя берётся из Telegram: {name}', saved: 'Ник сохранён', taken: 'Такой ник уже занят', bad: 'Допустимы 2–16 символов: буквы, цифры, пробел, _ . -', net: 'Нет связи, попробуйте позже', offline: 'Таблица рекордов недоступна', pend: 'Счёт отправится, когда появится связь', sound: 'Звук', haptic: 'Вибрация', ctlTouch: 'Кнопки и свайп', ctlTilt: 'Гироскоп', ctl: 'Управление', games: 'Выбор игры', change: 'Изменить', loading: 'Загрузка…' },
  en: { jump: 'Jump', g2048: '2048', board: 'Leaderboard', today: 'Today', best: 'Best', empty: 'Nobody yet. Be the first!', you: 'you', rank: 'Your rank', nick: 'Your nickname', save: 'Save', nickHint: 'A nickname puts you on the leaderboard (2–16 characters).', tg: 'Name comes from Telegram: {name}', saved: 'Nickname saved', taken: 'This nickname is taken', bad: '2–16 characters: letters, digits, space, _ . -', net: 'No connection, try later', offline: 'Leaderboard unavailable', pend: 'Score will be sent when online', sound: 'Sound', haptic: 'Vibration', ctlTouch: 'Buttons & swipe', ctlTilt: 'Gyroscope', ctl: 'Controls', games: 'Choose a game', change: 'Change', loading: 'Loading…' },
  de: { jump: 'Sprung', g2048: '2048', board: 'Bestenliste', today: 'Heute', best: 'Rekord', empty: 'Noch niemand. Sei der Erste!', you: 'du', rank: 'Dein Platz', nick: 'Dein Spitzname', save: 'Speichern', nickHint: 'Mit einem Spitznamen erscheinst du in der Bestenliste (2–16 Zeichen).', tg: 'Name stammt von Telegram: {name}', saved: 'Spitzname gespeichert', taken: 'Dieser Spitzname ist vergeben', bad: '2–16 Zeichen: Buchstaben, Ziffern, Leerzeichen, _ . -', net: 'Keine Verbindung, später versuchen', offline: 'Bestenliste nicht verfügbar', pend: 'Punkte werden bei Verbindung gesendet', sound: 'Ton', haptic: 'Vibration', ctlTouch: 'Tasten & Wischen', ctlTilt: 'Gyroskop', ctl: 'Steuerung', games: 'Spiel wählen', change: 'Ändern', loading: 'Laden…' },
};
const lang = () => (window.scheduleI18n && window.scheduleI18n.getLanguage && window.scheduleI18n.getLanguage()) || 'ru';
const tr = (k, p) => { const s = (L[lang()] || L.ru)[k] || L.ru[k] || k; return p ? s.replace(/\{(\w+)\}/g, (_, n) => p[n]) : s; };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } } };
const scores = () => window.scheduleScores;

// ---------- звук и вибрация ----------
const FX_KEY = 'schedule-game-fx';
const fx = { sound: true, haptic: true, tilt: false };
try { Object.assign(fx, JSON.parse(store.get(FX_KEY) || '{}')); } catch (_) { /* значения по умолчанию */ }
let audio = null;
function unlockAudio() {
  if (audio || !fx.sound) { if (audio && audio.state === 'suspended') audio.resume().catch(() => {}); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx) { try { audio = new Ctx(); } catch (_) { audio = null; } }
}
const SOUNDS = {
  bounce: [[320, .05, 'sine', .05]], spring: [[300, .07, 'triangle', .09], [620, .1, 'triangle', .09]], jetpack: [[200, .18, 'sawtooth', .06], [420, .2, 'sawtooth', .06]],
  coin: [[880, .05, 'square', .04], [1320, .08, 'square', .04]], stomp: [[240, .06, 'square', .08], [140, .1, 'square', .08]], over: [[330, .14, 'sawtooth', .08], [220, .18, 'sawtooth', .08], [140, .3, 'sawtooth', .08]],
  move: [[260, .03, 'sine', .03]], merge: [[520, .06, 'triangle', .07], [780, .08, 'triangle', .07]], eat: [[600, .05, 'square', .04], [900, .06, 'square', .04]], win: [[520, .1, 'triangle', .08], [660, .1, 'triangle', .08], [880, .2, 'triangle', .08]],
};
function sfx(name) {
  if (!fx.sound || !audio || !SOUNDS[name]) return;
  try {
    let at = audio.currentTime;
    for (const [freq, dur, type, vol] of SOUNDS[name]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(vol, at); gain.gain.exponentialRampToValueAtTime(.0001, at + dur);
      osc.connect(gain); gain.connect(audio.destination); osc.start(at); osc.stop(at + dur + .02);
      at += dur * .8;
    }
  } catch (_) { /* звук не критичен */ }
}
function haptic(pattern) { if (fx.haptic && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) { /* не поддерживается */ } } }

// ---------- вкладки ----------
const games = [];
let current = null, active = false;
const tabs = el('div', 'arc-tabs'); tabs.setAttribute('role', 'tablist');
const tools = el('div', 'arc-tools');
const bar = el('div', 'arc-bar'); bar.append(tabs, tools);
const ctl = el('div', 'arc-ctl'); ctl.setAttribute('role', 'group');
const ctlButtons = [['touch', 'ctlTouch'], ['tilt', 'ctlTilt']].map(([mode, label]) => {
  const b = el('button', 'arc-tab'); b.type = 'button'; b.dataset.mode = mode; b.dataset.label = label;
  b.addEventListener('click', () => {
    const tilt = mode === 'tilt';
    if (tilt && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(() => {});
    fx.tilt = tilt; store.set(FX_KEY, JSON.stringify(fx)); paintTools();
  });
  ctl.append(b); return b;
});
function paintControl() {
  const isJump = !!current && current.id === 'jump';
  ctl.hidden = !isJump || !('DeviceOrientationEvent' in window);
  if (ctl.hidden && fx.tilt && isJump) fx.tilt = false;
  ctl.setAttribute('aria-label', tr('ctl'));
  for (const b of ctlButtons) { b.textContent = (b.dataset.mode === 'tilt' ? '🧭 ' : '👆 ') + tr(b.dataset.label); b.setAttribute('aria-selected', String((b.dataset.mode === 'tilt') === !!fx.tilt)); }
  if (jumpHost) jumpHost.dataset.control = fx.tilt ? 'tilt' : 'touch';
}
const board = el('section', 'arc-board'); board.setAttribute('aria-live', 'polite');
const stage = el('div', 'arc-extra');
const jumpHost = document.getElementById('jump-game');
screen.insertBefore(bar, screen.firstChild);
bar.after(ctl);
screen.append(stage, board);

function toolButton(key, icon, label) {
  const b = el('button', 'arc-tool', icon); b.type = 'button'; b.dataset.key = key;
  b.addEventListener('click', () => {
    fx[key] = !fx[key];
    store.set(FX_KEY, JSON.stringify(fx));
    if (key === 'sound' && fx.sound) { unlockAudio(); sfx('coin'); }
    if (key === 'haptic' && fx.haptic) haptic(30);
    paintTools();
  });
  b.dataset.label = label; return b;
}
const toolButtons = [toolButton('sound', '🔊', 'sound'), toolButton('haptic', '📳', 'haptic')];
tools.append(...toolButtons);
function paintTools() {
  paintControl();
  for (const b of toolButtons) {
    const on = !!fx[b.dataset.key];
    b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
    b.title = tr(b.dataset.label); b.setAttribute('aria-label', b.title);
    b.hidden = b.dataset.key === 'haptic' && !navigator.vibrate;
  }
}

function register(game) {
  games.push(game);
  if (game.el) { game.el.hidden = game.id !== (current && current.id); }
  renderTabs();
  if (!current) select(game.id, true);
  else if (store.get('schedule-game-current') === game.id) select(game.id);
}
function renderTabs() {
  tabs.textContent = '';
  tabs.setAttribute('aria-label', tr('games'));
  for (const g of games) {
    const b = el('button', 'arc-tab', tr(g.id)); b.type = 'button'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(!!current && current.id === g.id));
    b.addEventListener('click', () => select(g.id));
    tabs.append(b);
  }
}
function select(id, silent) {
  const next = games.find(g => g.id === id);
  if (!next || (current && current.id === id && !silent)) return;
  if (current && active) current.deactivate();
  current = next;
  store.set('schedule-game-current', id);
  for (const g of games) if (g.el) g.el.hidden = g.id !== id;
  renderTabs(); paintTools();
  if (active) { current.activate(); }
  refreshBoard();
}
const arcade = {
  fx, sfx, haptic, unlockAudio, register,
  activate() { active = true; if (current) current.activate(); paintTools(); refreshBoard(); },
  deactivate() { if (current) current.deactivate(); active = false; },
  getState() { return current && current.getState ? current.getState() : {}; },
  current: () => current && current.id,
};
window.scheduleArcade = arcade;

// ---------- рекорды: дневной и общий ----------
const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function daily(game, score) {
  const key = 'schedule-daily-' + game;
  let rec; try { rec = JSON.parse(store.get(key) || 'null'); } catch (_) { rec = null; }
  if (!rec || rec.d !== dayKey()) rec = { d: dayKey(), s: 0 };
  if (score !== undefined && score > rec.s) { rec.s = score; store.set(key, JSON.stringify(rec)); }
  return rec.s;
}
let latest = null, lastGameShown = null, status = '';
window.addEventListener('arcade:score', async event => {
  const { game, score } = event.detail || {};
  if (!game || !(score > 0)) return;
  daily(game, score);
  const s = scores();
  if (s && s.enabled) { const r = await s.submit(game, score); if (r && r.board && r.game === current.id) latest = r.board; }
  refreshBoard();
});
async function refreshBoard() {
  const s = scores();
  if (!current) return;
  lastGameShown = current.id;
  paintBoard();
  if (!s || !s.enabled) return;
  try { const data = await s.top(current.id); if (lastGameShown === current.id) { latest = data; status = data ? '' : 'offline'; paintBoard(); } } catch (_) { latest = null; status = 'offline'; paintBoard(); }
}
const fmt = n => new Intl.NumberFormat(lang() === 'de' ? 'de-DE' : lang() === 'en' ? 'en-GB' : 'ru-RU').format(n);
function paintBoard() {
  const s = scores();
  board.textContent = '';
  if (!s || !s.enabled || !current) { board.hidden = true; return; }
  board.hidden = false;
  const head = el('div', 'arc-board-head');
  head.append(el('h3', '', tr('board') + ' · ' + tr(current.id)), el('span', 'arc-today', tr('today') + ': ' + fmt(daily(current.id))));
  board.append(head);
  if (latest === null && status === 'offline') board.append(el('p', 'arc-note', tr('offline')));
  else if (latest === null) board.append(el('p', 'arc-note', tr('loading')));
  else if (!latest.top.length) board.append(el('p', 'arc-note', tr('empty')));
  else {
    const list = el('ol', 'arc-list');
    latest.top.forEach((row, i) => {
      const li = el('li', row.me ? 'arc-me' : '');
      li.append(el('span', 'arc-rank', String(i + 1)), el('span', 'arc-name', row.name + (row.me ? ' (' + tr('you') + ')' : '')), el('strong', '', fmt(row.score)));
      list.append(li);
    });
    board.append(list);
    if (latest.me && latest.me.rank > latest.top.length) board.append(el('p', 'arc-note', tr('rank') + ': ' + latest.me.rank + ' · ' + fmt(latest.me.score)));
  }
  if (s.hasPending()) board.append(el('p', 'arc-note', tr('pend')));
  board.append(nickBlock(s));
}
function nickBlock(s) {
  const box = el('div', 'arc-nick');
  if (s.inTelegram()) {
    const mine = latest && latest.me ? latest.me.name : '';
    box.append(el('p', 'arc-note', tr('tg', { name: mine || '—' })));
    return box;
  }
  const label = el('label', '', tr('nick')); const input = el('input', 'arc-input'); input.type = 'text'; input.maxLength = 16; input.autocomplete = 'nickname'; input.value = s.nick(); input.placeholder = tr('nick');
  const save = el('button', 'arc-save', tr('save')); save.type = 'button';
  const msg = el('p', 'arc-note', s.needNick() ? tr('nickHint') : '');
  const row = el('div', 'arc-nick-row'); row.append(input, save);
  const apply = async () => {
    save.disabled = true; msg.textContent = tr('loading');
    const r = await s.setNick(input.value);
    save.disabled = false;
    if (r.ok) { msg.textContent = tr('saved'); latest = r.board || latest; refreshBoard(); }
    else msg.textContent = r.error === 'taken' ? tr('taken') : r.error === 'net' ? tr('net') : tr('bad');
  };
  save.addEventListener('click', apply);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  label.append(row);
  box.append(label, msg);
  return box;
}
window.addEventListener('language:change', () => { renderTabs(); paintTools(); paintBoard(); });
document.addEventListener('arcade:needs-nick', () => { board.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
register({ id: 'jump', el: jumpHost, activate() { window.scheduleGame.activate(); }, deactivate() { window.scheduleGame.deactivate(); } });
paintTools();
})();

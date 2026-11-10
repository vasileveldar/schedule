(() => {
'use strict';
/* Темы: режим светлая / тёмная / как в системе, фиксированные палитры и «Своя тема» (один основной цвет). */
const root = document.documentElement;
const i18n = window.scheduleI18n;
const bridge = window.AppPreferences;
const FIXED = { sunset: 'dark', forest: 'light', ocean: 'light', graphite: 'dark', sakura: 'light' }; // у этих тем режим не переключается
const MODE_KEY = 'schedule-mode', CSS_KEY = 'schedule-custom-css', ACCENT_KEY = 'schedule-custom-accent';
const DEFAULT_ACCENT = '#3d6dcc';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const KEYS = {
  ink: '--ink', muted: '--muted', line: '--line', paper: '--paper', surface: '--surface', controls: '--controls',
  header: '--header', header2: '--header-shade', accent: '--burgundy', red: '--red', focus: '--focus',
  button: '--button', border: '--button-border', hover: '--button-hover', selected: '--selected', selText: '--selected-text',
  rule: '--rule', cardEdge: '--card-edge', incEdge: '--inclusive-edge', incBg: '--inclusive-bg', incInk: '--inclusive-ink',
  conflictEdge: '--conflict-edge', conflictBg: '--conflict-bg', conflictInk: '--conflict-ink', tag: '--tag',
  srspBg: '--srsp-bg', srspInk: '--srsp-ink', groupBg: '--group-bg', room: '--room', gold: '--gold', softGold: '--soft-gold',
  time: '--time-bg', menu: '--menu-tint', grid: '--portal-grid', shadow: '--shadow', pshadow: '--portal-shadow', hl: '--card-highlight',
};

// ---------- цвета ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = parseInt(m ? m[1] : DEFAULT_ACCENT.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s * 100, l * 100];
}
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
function toCss(selector, scheme, v) {
  return selector + '{color-scheme:' + scheme + ';' + Object.keys(KEYS).map(k => KEYS[k] + ':' + v[k]).join(';') + '}';
}
// По одному цвету строим две схемы (светлую и тёмную): текст всегда контрастный, остальное — оттенки того же тона.
function buildCustomCss(accent) {
  const [h, s0] = hexToHsl(accent);
  const s = clamp(s0, 30, 85), H = d => h + d;
  const light = {
    ink: hsl(h, 45, 16), muted: hsl(h, 18, 40), line: hsl(h, 25, 89), paper: hsl(h, 40, 97), surface: '#ffffff', controls: hsl(h, 40, 98),
    header: hsl(h, clamp(s, 30, 70), 24), header2: hsl(h, clamp(s, 30, 70), 33), accent: hsl(h, clamp(s, 45, 85), 46), red: hsl(h, 70, 44), focus: hsl(h, 70, 46),
    button: hsl(h, 35, 95), border: hsl(h, 28, 87), hover: hsl(h, 32, 91), selected: hsl(h, clamp(s, 30, 70), 24), selText: '#ffffff',
    rule: hsl(h, 25, 86), cardEdge: hsl(h, 28, 78), incEdge: hsl(H(150), 40, 38), incBg: hsl(H(150), 40, 94), incInk: hsl(H(150), 50, 24),
    conflictEdge: '#e9b1bd', conflictBg: '#fff0f1', conflictInk: '#a02037', tag: hsl(h, 25, 94), srspBg: '#f1ead9', srspInk: '#6b5330',
    groupBg: hsl(h, 40, 90), room: hsl(h, 28, 30), gold: hsl(H(35), 60, 52), softGold: hsl(H(35), 55, 90), time: hsl(h, 30, 94), menu: hsl(h, 35, 97),
    grid: hsl(h, 40, 20) + '06', shadow: '0 12px 30px ' + hsl(h, 50, 20) + '14', pshadow: '0 12px 30px ' + hsl(h, 50, 20) + '14', hl: '#ffffff',
  };
  const dark = {
    ink: hsl(h, 30, 93), muted: hsl(h, 18, 72), line: hsl(h, 22, 24), paper: hsl(h, 28, 9), surface: hsl(h, 24, 13), controls: hsl(h, 26, 11),
    header: hsl(h, clamp(s, 30, 60), 14), header2: hsl(h, clamp(s, 30, 60), 22), accent: hsl(h, clamp(s, 50, 90), 62), red: hsl(h, 85, 72), focus: hsl(h, 80, 72),
    button: hsl(h, 22, 18), border: hsl(h, 20, 28), hover: hsl(h, 22, 23), selected: hsl(h, 50, 85), selText: hsl(h, 40, 14),
    rule: hsl(h, 20, 26), cardEdge: hsl(h, 18, 36), incEdge: hsl(H(150), 40, 60), incBg: hsl(H(150), 30, 15), incInk: hsl(H(150), 45, 82),
    conflictEdge: '#835061', conflictBg: '#35212b', conflictInk: '#ffb3c0', tag: hsl(h, 20, 19), srspBg: '#3e372c', srspInk: '#ecd9b8',
    groupBg: hsl(h, 28, 26), room: hsl(h, 25, 82), gold: hsl(H(35), 60, 62), softGold: hsl(H(35), 30, 18), time: hsl(h, 25, 18), menu: hsl(h, 26, 14),
    grid: hsl(h, 30, 85) + '06', shadow: '0 12px 28px #0006', pshadow: '0 12px 28px #0006', hl: '#ffffff06',
  };
  return toCss(':root[data-palette="custom"]', 'light', light) + '\n' + toCss(':root[data-palette="custom"][data-theme="dark"]', 'dark', dark);
}

// ---------- состояние ----------
const read = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const savedMode = () => {
  const m = read(MODE_KEY);
  if (m === 'light' || m === 'dark' || m === 'system') return m;
  return read('schedule-theme') === 'dark' ? 'dark' : 'light';
};
function systemDark() {
  try { if (bridge && typeof bridge.isSystemDark === 'function') return !!bridge.isSystemDark(); } catch (_) {}
  return !!(mq && mq.matches);
}
const isFixed = () => Object.prototype.hasOwnProperty.call(FIXED, root.dataset.palette);

function ensureCustomStyle() {
  let el = document.getElementById('custom-theme-style');
  if (!el) { el = document.createElement('style'); el.id = 'custom-theme-style'; document.head.appendChild(el); }
  return el;
}
function applyCustom(accent) {
  const css = buildCustomCss(accent);
  ensureCustomStyle().textContent = css;
  write(CSS_KEY, css); write(ACCENT_KEY, accent);
}

const modeSelect = document.getElementById('mode-select');
const modeRow = document.getElementById('mode-row');
const modeNote = document.getElementById('mode-note');
const customRow = document.getElementById('custom-row');
const customInput = document.getElementById('custom-accent');
const customReset = document.getElementById('custom-reset');

function resolve() {
  if (root.dataset.palette === 'custom' && !document.getElementById('custom-theme-style')) applyCustom(read(ACCENT_KEY) || DEFAULT_ACCENT);
  const fixed = FIXED[root.dataset.palette];
  const mode = savedMode();
  const theme = fixed || (mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode);
  root.dataset.theme = theme;
  if (modeSelect) { modeSelect.value = mode; modeSelect.disabled = !!fixed; }
  if (modeNote) modeNote.hidden = !fixed;
  if (customRow) customRow.hidden = root.dataset.palette !== 'custom';
  i18n.syncChrome();
}

if (modeSelect) modeSelect.addEventListener('change', () => { write(MODE_KEY, modeSelect.value); resolve(); });
if (customInput) {
  customInput.value = read(ACCENT_KEY) || DEFAULT_ACCENT;
  customInput.addEventListener('input', () => { applyCustom(customInput.value); resolve(); });
}
if (customReset) customReset.addEventListener('click', () => { customInput.value = DEFAULT_ACCENT; applyCustom(DEFAULT_ACCENT); resolve(); });
window.addEventListener('palette:change', resolve);
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (savedMode() === 'system') resolve(); });

// первая отрисовка: если своя тема уже выбрана, но стиль ещё не подключён
if (root.dataset.palette === 'custom' && !document.getElementById('custom-theme-style')) applyCustom(read(ACCENT_KEY) || DEFAULT_ACCENT);
window.scheduleTheme = { resolve, systemChanged: () => { if (savedMode() === 'system') resolve(); }, isFixed, buildCustomCss };
resolve();
})();

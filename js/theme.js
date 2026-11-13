(() => {
'use strict';
/* Темы: режим светлая / тёмная / как в системе и готовые палитры. */
const root = document.documentElement;
const i18n = window.scheduleI18n;
const bridge = window.AppPreferences;
const FIXED = { sunset: 'dark', forest: 'light', ocean: 'light', graphite: 'dark', sakura: 'light' }; // у этих тем режим не переключается
const MODE_KEY = 'schedule-mode';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

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

const modeSelect = document.getElementById('mode-select');
const modeRow = document.getElementById('mode-row');
const modeNote = document.getElementById('mode-note');

function resolve() {
  const fixed = FIXED[root.dataset.palette];
  const mode = savedMode();
  const theme = fixed || (mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode);
  root.dataset.theme = theme;
  if (modeSelect) { modeSelect.value = mode; modeSelect.disabled = !!fixed; }
  if (modeNote) modeNote.hidden = !fixed;
  i18n.syncChrome();
}

if (modeSelect) modeSelect.addEventListener('change', () => { write(MODE_KEY, modeSelect.value); resolve(); });
window.addEventListener('palette:change', resolve);
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (savedMode() === 'system') resolve(); });

window.scheduleTheme = { resolve, systemChanged: () => { if (savedMode() === 'system') resolve(); }, isFixed };
resolve();
})();

(() => {
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
// режим анимаций (data-anim на <html>: full | off) ставит fx.js: полные, а при «уменьшить движение» в системе — выключены
const reduced = () => { const m = document.documentElement.dataset.anim; return m ? m === 'off' : preference.matches; };
const animations = new Set();
const reveals = new Set();
const elementAnimations = new WeakMap();
const easing = 'cubic-bezier(.2,.75,.25,1)';
const actionable = '.menu-card, .choice, .language-select, .palette-select, #back-menu, #jump-game .jg-primary, #jump-game .jg-pause';

function visible(element) {
  return element && element.isConnected && !element.closest('[hidden]') && document.visibilityState !== 'hidden';
}

function cancel(collection) {
  for (const animation of [...collection]) animation.cancel();
  collection.clear();
}

function play(element, frames, options = {}, collection) {
  if (reduced() || !visible(element) || typeof element.animate !== 'function') return;
  try {
    const previous = elementAnimations.get(element);
    if (previous) previous.cancel();
    const animation = element.animate(frames, {
      duration: 240, easing, fill: 'backwards', ...options
    });
    animations.add(animation);
    elementAnimations.set(element, animation);
    if (collection) collection.add(animation);
    const forget = () => {
      animations.delete(animation);
      if (collection) collection.delete(animation);
      if (elementAnimations.get(element) === animation) elementAnimations.delete(element);
    };
    animation.addEventListener('finish', forget, { once: true });
    animation.addEventListener('cancel', forget, { once: true });
  } catch (_) {
    // The interface remains fully visible if this WebView lacks animation support.
  }
}

function revealSchedule() {
  cancel(reveals);
  const schedule = document.getElementById('schedule-screen');
  if (!visible(schedule) || reduced()) return;
  const lessons = [...schedule.querySelectorAll('#schedule .lesson')].slice(0, 12);
  lessons.forEach((lesson, index) => play(lesson, [
    { opacity: 0, transform: 'translateY(9px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 260, delay: Math.min(index * 18, 162) }, reveals));
}

function revealGamePanel() {
  play(document.querySelector('#jump-game .jg-panel'), [
    { opacity: 0, transform: 'translateY(8px) scale(.98)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' }
  ], { duration: 280 });
}

// dir: 'forward' — открыли раздел (экран приходит справа), 'back' — вернулись (слева). Из нижней панели — без сдвига.
function enter(screen, dir) {
  cancel(animations);
  reveals.clear();
  if (!visible(screen) || reduced()) return;
  const tab = document.body.dataset.tabswitch === '1';
  if (tab) delete document.body.dataset.tabswitch;
  const dx = tab ? 0 : dir === 'back' ? -26 : 26;
  play(document.getElementById('page-title'), [
    { opacity: .35, transform: 'translateY(4px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 200 });
  play(screen, [
    { opacity: dx ? .15 : .55, transform: dx ? 'translateX(' + dx + 'px)' : 'translateY(5px)' },
    { opacity: 1, transform: 'translateX(0) translateY(0)' }
  ], { duration: dx ? 320 : 220 });
  if (screen.id === 'home-screen') {
    screen.querySelectorAll('.menu-card').forEach((card, index) => play(card, [
      { opacity: 0, transform: 'translateY(14px) scale(.985)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 340, delay: 40 + Math.min(index * 45, 220) }));
  } else if (screen.id === 'schedule-screen') {
    revealSchedule();
  } else if (screen.id === 'game-screen') {
    revealGamePanel();
  }
}
function feedback(event) {
  if (event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key))) return;
  if (event.type === 'pointerdown' && event.button !== 0) return;
  const button = event.target.closest && event.target.closest(actionable);
  if (!button || button.disabled) return;
  play(button, [
    { transform: 'scale(1)' },
    { transform: 'scale(.978)', offset: .38 },
    { transform: 'scale(1)' }
  ], { duration: 190 });
}

document.addEventListener('pointerdown', feedback, { passive: true });
document.addEventListener('keydown', feedback);
document.addEventListener('schedule:render', revealSchedule);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cancel(animations);
});
const preferenceChanged = () => {
  if (reduced()) cancel(animations);
};
if (preference.addEventListener) preference.addEventListener('change', preferenceChanged);
else if (preference.addListener) preference.addListener(preferenceChanged);

const overlay = document.getElementById('jg-overlay');
if (overlay && typeof MutationObserver === 'function') {
  new MutationObserver(() => {
    if (visible(overlay)) revealGamePanel();
  }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
}
window.interfaceMotion = { enter };
})();

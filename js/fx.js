(() => {
'use strict';
/* Эффекты и анимации интерфейса: всегда полные. Единственное исключение — системная настройка «уменьшить движение»: тогда движения нет. */
const root = document.documentElement;
const i18n = window.scheduleI18n;
const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let mode = mq.matches ? 'off' : 'full';
root.dataset.anim = mode;
const full = () => mode === 'full';
const on = () => mode !== 'off';
window.scheduleFx = { mode: () => mode, full, on };

const L = {
  ru: {
    morning: 'Доброе утро', day: 'Добрый день', evening: 'Добрый вечер', night: 'Доброй ночи', gap: 'окно {n} мин', gapH: 'окно {h} ч {m} мин',
    back: 'Назад',
  },
  en: {
    morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening', night: 'Good night', gap: 'break {n} min', gapH: 'break {h} h {m} min',
    back: 'Back',
  },
  de: {
    morning: 'Guten Morgen', day: 'Guten Tag', evening: 'Guten Abend', night: 'Gute Nacht', gap: 'Pause {n} Min.', gapH: 'Pause {h} Std. {m} Min.',
    back: 'Zurück',
  },
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k]).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const locale = () => ({ ru: 'ru-RU', en: 'en-GB', de: 'de-DE' }[lang()] || 'ru-RU');
const buzz = ms => { if (on() && navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) { /* не поддерживается */ } } };

// ---------- 1. иконки на плитках главной ----------
const ICON = {
  schedule: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.2V12l3.2 2"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.6"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8.5 14h2M13.5 14h2"/>',
  game: '<rect x="2.8" y="7.6" width="18.4" height="10.4" rx="5"/><path d="M8 10.6v4.2M5.9 12.7h4.2"/><circle cx="15.6" cy="11.6" r=".7" fill="currentColor"/><circle cx="17.8" cy="13.8" r=".7" fill="currentColor"/>',
  moodle: '<path d="M2.8 9.4 12 5l9.2 4.4L12 13.8z"/><path d="M6.6 11.6v4.2c0 1.3 2.5 2.7 5.4 2.7s5.4-1.4 5.4-2.7v-4.2"/><path d="M21.2 9.4v5"/>',
  platonus: '<rect x="3.4" y="5.5" width="17.2" height="13" rx="2.6"/><circle cx="9" cy="11" r="2.1"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.6M14.5 13.2h3.6"/>',
  homework: '<path d="M5 19.2l.9-4 9.6-9.6 3.1 3.1-9.6 9.6z"/><path d="M14 7.2l3 3"/>',
  owner: '<path d="M12 3.2 4.6 6v5.6c0 4.4 3 7.6 7.4 9.2 4.4-1.6 7.4-4.8 7.4-9.2V6z"/><path d="M9 12l2.2 2.2L15.4 10"/>',
};
const ICON_FOR = { '.schedule-card': 'schedule', '.academic-calendar-card': 'calendar', '.game-card': 'game', '.moodle-card': 'moodle', '.platonus-card': 'platonus', '.homework-menu-card': 'homework', '.owner-menu-card': 'owner' };
for (const [sel, name] of Object.entries(ICON_FOR)) {
  const sym = document.querySelector('#home-screen ' + sel + ' .menu-symbol');
  if (!sym) continue;
  sym.classList.add('fx-icon');
  sym.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
}

// ---------- 2. отклик на нажатие: волна и вибрация ----------
const RIPPLE = '.menu-card, .choice, .tabbar .tab, .ed-tool, .ed-primary, .arc-tab, .hw-check, .back-menu, .settings-btn';
document.addEventListener('pointerdown', e => {
  if (!full() || e.button) return;
  const host = e.target.closest && e.target.closest(RIPPLE);
  if (!host || host.disabled) return;
  const r = host.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.7;
  const wave = el('span', 'fx-ripple');
  wave.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
  host.classList.add('fx-rip-host'); host.append(wave); // overflow скрыт только на время волны, чтобы не обрезать рамку фокуса
  wave.addEventListener('animationend', () => { wave.remove(); if (!host.querySelector('.fx-ripple')) host.classList.remove('fx-rip-host'); });
}, { passive: true });
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.hw-check, .ed-chip, .tabbar .tab, .arc-tab')) buzz(8);
});
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('.fork-switch input')) buzz(12); });

// ---------- 3. шапка: параллакс, мини-панель, время суток ----------
const heading = document.getElementById('page-title');
const mini = el('div', 'fx-mini'); mini.setAttribute('aria-hidden', 'true');
const miniBack = el('button', 'fx-mini-back', '‹'); miniBack.type = 'button'; miniBack.tabIndex = -1;
const miniTitle = el('span', 'fx-mini-title');
mini.append(miniBack, miniTitle); document.body.append(mini);
miniBack.addEventListener('click', () => { if (window.appNavigateBack) window.appNavigateBack(); });
const syncMini = () => {
  miniTitle.textContent = heading ? heading.textContent : '';
  const home = document.body.dataset.screen === 'home';
  mini.classList.toggle('home', home);
  mini.setAttribute('aria-hidden', 'true');
};
if (heading) new MutationObserver(syncMini).observe(heading, { childList: true, characterData: true, subtree: true });
new MutationObserver(syncMini).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
syncMini();

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY || 0;
    if (full()) root.style.setProperty('--fx-par', Math.round(Math.min(y, 280) * 0.2) + 'px');
    mini.classList.toggle('show', on() && y > 160);
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

const header = document.querySelector('header');
const glow = el('div', 'fx-glow'); glow.setAttribute('aria-hidden', 'true');
if (header) header.prepend(glow);
const eyebrow = document.getElementById('header-eyebrow');
function tod(h = new Date().getHours()) {
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}
function paintGreeting() {
  const now = new Date(), t = tod(now.getHours());
  root.dataset.tod = t;
  if (!eyebrow) return;
  const date = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  eyebrow.textContent = tr(t) + ' · ' + date;
}
paintGreeting();
window.addEventListener('language:change', () => { paintGreeting(); });
setInterval(paintGreeting, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) paintGreeting(); });

// ---------- 4. расписание: окна между парами, сегодняшний день, прокрутка недели ----------
const toMin = v => { const p = String(v || '').split(':'); return p.length === 2 ? Number(p[0]) * 60 + Number(p[1]) : NaN; };
function decorateSchedule() {
  const stamp = document.querySelector('#schedule .current-day-date');
  const today = stamp ? stamp.closest('.day-section') : null;
  document.querySelectorAll('#schedule .day-section').forEach(s => s.classList.toggle('is-today', s === today));
  for (const stack of document.querySelectorAll('#schedule .day-stack')) {
    stack.querySelectorAll('.fx-gap').forEach(n => n.remove());
    const cards = [...stack.querySelectorAll('.lesson[data-start]')];
    let maxEnd = NaN;
    for (const c of cards) {
      const s = toMin(c.dataset.start), e = toMin(c.dataset.end);
      if (!Number.isNaN(maxEnd) && s - maxEnd >= 20) {
        const gap = s - maxEnd;
        const note = el('div', 'fx-gap', tr('gap', { n: gap }));
        note.setAttribute('aria-hidden', 'true');
        stack.insertBefore(note, c);
      }
      if (Number.isNaN(maxEnd) || e > maxEnd) maxEnd = e;
    }
  }
  revealOnScroll();
}
document.addEventListener('schedule:render', decorateSchedule);
const weekBtn = document.querySelector('#days');
if (weekBtn) weekBtn.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-value="week"]');
  if (!b || !full()) return;
  setTimeout(() => { const t = document.querySelector('#schedule .day-section.is-today'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
});

// ---------- 5. свайп между днями (на телефоне) ----------
{
  const screen = document.getElementById('schedule-screen');
  let sx = 0, sy = 0, st = 0, ok = false;
  const dayButtons = () => [...document.querySelectorAll('#days .choice')].filter(b => b.dataset.value !== 'today' && b.dataset.value !== 'week');
  if (screen) {
    screen.addEventListener('touchstart', e => {
      const t = e.touches[0];
      ok = e.touches.length === 1 && !e.target.closest('.controls, .fork-search-panel, input, textarea, select, .button-group');
      sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });
    screen.addEventListener('touchend', e => {
      if (!ok) return; ok = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 55 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - st > 600) return;
      const btns = dayButtons(), idx = btns.findIndex(b => b.getAttribute('aria-pressed') === 'true');
      if (idx < 0) return; // выбрана неделя
      const next = btns[idx + (dx < 0 ? 1 : -1)];
      if (!next) return;
      const box = document.getElementById('schedule'), sign = dx < 0 ? -1 : 1;
      if (full() && box && box.animate) {
        box.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(' + sign * 36 + 'px)' }], { duration: 130, easing: 'ease-in' }).finished.then(() => {
          next.click();
          const nb = document.getElementById('schedule');
          if (nb && nb.animate) nb.animate([{ opacity: 0, transform: 'translateX(' + -sign * 36 + 'px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 220, easing: 'cubic-bezier(.2,.75,.25,1)' });
        }).catch(() => next.click());
      } else next.click();
      buzz(6);
    }, { passive: true });
  }
}

// ---------- 6. появление при прокрутке ----------
let io = null;
function revealOnScroll() {
  if (!full() || !('IntersectionObserver' in window)) return;
  if (!io) io = new IntersectionObserver(items => { for (const it of items) if (it.isIntersecting) { it.target.classList.add('fx-in'); io.unobserve(it.target); } }, { rootMargin: '0px 0px -6% 0px' });
  for (const n of document.querySelectorAll('#schedule .lesson:not(.fx-seen), .settings-group:not(.fx-seen)')) {
    n.classList.add('fx-seen');
    const r = n.getBoundingClientRect();
    if (!r.height || r.top < window.innerHeight * 0.9) continue; // уже на экране или скрыт — без эффекта
    n.classList.add('fx-reveal'); io.observe(n);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) revealOnScroll(); });

// ---------- 7. игры: ползунок вкладок, счётчик, конфетти ----------
{
  const tabs = document.querySelector('.arc-tabs');
  if (tabs) {
    const ind = el('span', 'fx-ind'); ind.setAttribute('aria-hidden', 'true'); tabs.prepend(ind);
    const place = () => { const b = tabs.querySelector('[aria-selected="true"]'); if (!b || !b.offsetWidth) return; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = 'translateX(' + b.offsetLeft + 'px)'; ind.classList.add('on'); };
    // игра перестраивает кнопки вкладок целиком — ползунок возвращаем на место
    new MutationObserver(() => { if (!tabs.contains(ind)) tabs.prepend(ind); place(); }).observe(tabs, { childList: true, attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
    window.addEventListener('resize', place); window.addEventListener('language:change', () => setTimeout(place, 50));
    place();
  }
  function watchCounter(node) {
    let shown = parseInt(node.textContent.replace(/\D/g, ''), 10) || 0, raf = 0, internal = false;
    const obs = new MutationObserver(() => {
      if (internal) return;
      const to = parseInt(node.textContent.replace(/\D/g, ''), 10);
      if (Number.isNaN(to)) return;
      if (!full() || Math.abs(to - shown) < 2) { shown = to; return; }
      cancelAnimationFrame(raf);
      const from = shown, t0 = performance.now(), dur = 420;
      const write = v => { internal = true; node.textContent = String(v); obs.takeRecords(); internal = false; shown = v; };
      write(from);
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); write(Math.round(from + (to - from) * e)); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    });
    obs.observe(node, { childList: true, characterData: true, subtree: true });
  }
  document.querySelectorAll('.g-wrap .jg-stat strong').forEach(watchCounter);

  // конфетти при новом рекорде
  let canvas = null, ctx = null, parts = [], running = false;
  function confetti() {
    if (!full() || document.body.dataset.screen !== 'game') return;
    if (!canvas) { canvas = el('canvas', 'fx-confetti'); canvas.setAttribute('aria-hidden', 'true'); document.body.append(canvas); ctx = canvas.getContext('2d'); }
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#e8b14a', '#d6455f', '#3a9d8f', '#4a78d6', '#f2f0ea'];
    for (let i = 0; i < 80; i++) parts.push({ x: canvas.width / 2 + (Math.random() - .5) * 120, y: canvas.height * .38, vx: (Math.random() - .5) * 9, vy: -Math.random() * 10 - 3, r: Math.random() * 5 + 3, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: colors[i % colors.length], life: 1 });
    if (!running) { running = true; requestAnimationFrame(loop); }
    buzz([20, 40, 20]);
  }
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += .28; p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx *= .99; p.life -= .011;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  const readyAt = Date.now() + 3000; let lastBurst = 0;
  const bests = [...document.querySelectorAll('#jg-best, .g-wrap .jg-best strong')];
  for (const n of bests) {
    let prev = parseInt(n.textContent.replace(/\D/g, ''), 10) || 0;
    new MutationObserver(() => {
      const v = parseInt(n.textContent.replace(/\D/g, ''), 10) || 0;
      if (v > prev && prev > 0 && Date.now() > readyAt && Date.now() - lastBurst > 20000) { lastBurst = Date.now(); confetti(); }
      prev = v;
    }).observe(n, { childList: true, characterData: true, subtree: true });
  }
}

// ---------- 8. смена темы: плавное перекрашивание ----------
for (const id of ['mode-select', 'palette-select']) {
  const n = document.getElementById(id);
  if (!n) continue;
  n.addEventListener('change', () => {
    if (!on()) return;
    root.classList.add('fx-theme'); clearTimeout(root._fxTheme);
    root._fxTheme = setTimeout(() => root.classList.remove('fx-theme'), 520);
  }, true);
}

// следим за системной настройкой «уменьшить движение»
if (mq.addEventListener) mq.addEventListener('change', () => { mode = mq.matches ? 'off' : 'full'; root.dataset.anim = mode; });
onScroll();
decorateSchedule();
})();

(function (root) {
'use strict';
const FIXED_STEP = 1 / 120;
const GRAVITY = 1500;
const JUMP_SPEED = 660;
const SPRING_SPEED = 980;
const RUN_SPEED = 300;
const JETPACK_DURATION = 2.15;
const JETPACK_SPEED = 780;

class JumpGameEngine {
  constructor(options = {}) {
    this.width = options.width || 360;
    this.height = options.height || 470;
    this.random = options.random || Math.random;
    this.reset();
  }
  reset() {
    this.player = { x: this.width / 2, y: 34, vx: 0, vy: JUMP_SPEED, width: 27, height: 35 };
    this.camera = 0;
    this.maxHeight = 34;
    this.score = 0;
    this.status = 'playing';
    this.time = 0;
    this.platforms = [{ id: 0, x: this.width / 2 - 65, y: 34, width: 130, type: 'normal', broken: false, pulse: 0 }];
    this.fragments = [];
    this.lastX = this.width / 2 - 37;
    this.lastY = 34;
    this.sequence = 0;
    this.nextId = 1;
    this.lastLanding = null;
    this.jetpackTime = 0;
    this.jetpacksCollected = 0;
    this.nextJetpackSequence = 18 + Math.floor(this.random() * 6);
    this.fillPlatforms();
  }
  pause() { if (this.status === 'playing') this.status = 'paused'; }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  fillPlatforms() {
    while (this.lastY < this.camera + this.height + 370) {
      this.sequence++;
      const difficulty = Math.min(16, this.lastY / 800);
      const gap = 76 + this.random() * 20 + difficulty;
      const width = Math.max(52, 74 - difficulty * 1.35);
      const maxShift = 100 + difficulty * 1.25;
      const nextX = Math.max(12, Math.min(this.width - width - 12, this.lastX + (this.random() * 2 - 1) * maxShift));
      this.lastY += gap;
      this.lastX = nextX;
      const jetpack = this.sequence === this.nextJetpackSequence;
      if (jetpack) this.nextJetpackSequence += 28 + Math.floor(this.random() * 12);
      this.platforms.push({ id: this.nextId++, x: nextX, y: this.lastY, width, type: this.sequence % 8 === 5 ? 'spring' : 'normal', broken: false, pulse: 0, jetpack });
      // Fragile side routes never replace the reachable, permanent route.
      if (this.sequence % 3 === 2) {
        const sideX = nextX < this.width / 2 - width / 2 ? Math.min(this.width - 73, nextX + width + 36) : Math.max(9, nextX - 102);
        this.platforms.push({ id: this.nextId++, x: sideX, y: this.lastY - 24, width: 64, type: 'breakable', broken: false, pulse: 0 });
      }
    }
  }
  step(dt, input = {}) {
    if (this.status !== 'playing') return;
    dt = Math.min(1 / 30, Math.max(0, dt));
    this.time += dt;
    const p = this.player;
    let axis = Math.max(-1, Math.min(1, Number(input.axis) || 0));
    if (Number.isFinite(input.targetX)) axis = Math.max(-1, Math.min(1, (input.targetX - p.x) / 30));
    p.vx += (axis * RUN_SPEED - p.vx) * Math.min(1, dt * 18);
    p.x += p.vx * dt;
    if (p.x < -p.width / 2) p.x = this.width + p.width / 2;
    if (p.x > this.width + p.width / 2) p.x = -p.width / 2;
    const oldY = p.y;
    if (this.jetpackTime > 0) {
      const poweredTime = Math.min(dt, this.jetpackTime);
      this.jetpackTime = Math.max(0, this.jetpackTime - dt);
      p.vy = JETPACK_SPEED - GRAVITY * (dt - poweredTime);
    } else p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.vy < 0) {
      // Highest crossed platform wins even during a fast spring descent.
      const crossed = this.platforms.filter(platform => !platform.broken && oldY >= platform.y && p.y <= platform.y && p.x + p.width * .43 > platform.x && p.x - p.width * .43 < platform.x + platform.width).sort((a, b) => b.y - a.y);
      for (const platform of crossed) {
        p.y = platform.y;
        p.vy = platform.type === 'spring' ? SPRING_SPEED : JUMP_SPEED;
        platform.pulse = 1;
        this.lastLanding = platform.type;
        if (platform.type === 'breakable') {
          platform.broken = true;
          this.fragments.push({ x: platform.x, y: platform.y, width: platform.width, age: 0 });
        }
        break;
      }
    }
    // Swept body bounds catch the pack while ascending, descending or landing.
    for (const platform of this.platforms) {
      // Packs cannot refuel an active flight; otherwise aligned routes can fly forever.
      if (this.jetpackTime > 0) break;
      if (!platform.jetpack || platform.broken) continue;
      const packX = platform.x + platform.width / 2;
      if (Math.abs(p.x - packX) < p.width / 2 + 12 && Math.max(oldY, p.y) + p.height >= platform.y + 14 && Math.min(oldY, p.y) <= platform.y + 43) {
        platform.jetpack = false;
        this.jetpackTime = JETPACK_DURATION;
        this.jetpacksCollected++;
        p.vy = JETPACK_SPEED;
      }
    }
    this.maxHeight = Math.max(this.maxHeight, p.y);
    this.score = Math.floor((this.maxHeight - 34) / 10);
    this.camera = Math.max(this.camera, p.y - this.height * .54);
    for (const platform of this.platforms) platform.pulse = Math.max(0, platform.pulse - dt * 4);
    for (const fragment of this.fragments) fragment.age += dt;
    this.fragments = this.fragments.filter(f => f.age < .75);
    this.platforms = this.platforms.filter(platform => platform.y > this.camera - 90 && !platform.broken);
    this.fillPlatforms();
    if (p.y < this.camera - 60) this.status = 'gameover';
  }
  getState() {
    return { score: this.score, status: this.status, player: { ...this.player }, camera: this.camera, maxHeight: this.maxHeight, lastLanding: this.lastLanding, jetpackTime: this.jetpackTime, jetpackDuration: JETPACK_DURATION, jetpackActive: this.jetpackTime > 0, jetpacksCollected: this.jetpacksCollected, platforms: this.platforms.map(p => ({ ...p })), fragments: this.fragments.map(f => ({ ...f })) };
  }
}
JumpGameEngine.constants = { FIXED_STEP, GRAVITY, JUMP_SPEED, SPRING_SPEED, RUN_SPEED, JETPACK_DURATION, JETPACK_SPEED };
root.JumpGameEngine = JumpGameEngine;
if (typeof document === 'undefined') return;

const host = document.getElementById('jump-game');
if (!host) return;
const canvas = host.querySelector('#jg-canvas');
const context = canvas.getContext('2d', { alpha: false });
const overlay = host.querySelector('#jg-overlay');
const scoreNode = host.querySelector('#jg-score');
const bestNode = host.querySelector('#jg-best');
const message = host.querySelector('#jg-message');
const description = host.querySelector('#jg-description');
const primary = host.querySelector('#jg-primary');
const pauseButton = host.querySelector('#jg-pause');
const pauseLabel = host.querySelector('#jg-pause-label');
const legend = host.querySelector('#jg-legend');
const leftButton = host.querySelector('#jg-left');
const rightButton = host.querySelector('#jg-right');
const announcement = host.querySelector('#jg-announcement');
const fuel = host.querySelector('#jg-fuel');
const fuelTrack = fuel.querySelector('[role="progressbar"]');
const fuelFill = host.querySelector('#jg-fuel-fill');
const fallbackText = {
  'game.pause': 'Пауза', 'game.resume': 'Продолжить',
  'game.pauseAria': 'Поставить игру на паузу', 'game.resumeAria': 'Продолжить игру',
  'game.pausedTitle': 'Небольшая передышка',
  'game.pausedDescription': 'Игра на паузе. Ваш счёт: {score}. Можно продолжить с этого места.',
  'game.recordTitle': 'Новая высота!', 'game.gameoverTitle': 'Попробуем ещё?',
  'game.gameoverDescription': 'Ваш счёт: {score}. Рекорд: {best}. Пружины и ракетный ранец помогут подняться выше.',
  'game.retry': 'Играть снова', 'game.readyTitle': 'Каждая ступень — выше',
  'game.readyDescription': 'Прыжки автоматические. Хрупкая платформа выдержит один прыжок. Подберите ракетный ранец для полёта.',
  'game.start': 'Начать игру',
  'game.overAnnouncement': 'Игра окончена. Счёт: {score}. Рекорд: {best}.',
  'game.startAnnouncement': 'Игра началась. Прыжки автоматические.',
  'game.resumeAnnouncement': 'Игра продолжается.',
  'game.jetpackAnnouncement': 'Ракетный ранец активирован! Продолжайте двигаться влево и вправо.'
};
function t(key, params = {}) {
  if (root.scheduleI18n) return root.scheduleI18n.t(key, params);
  return (fallbackText[key] || key).replace(/\{(\w+)\}/g, (match, name) => params[name] === undefined ? match : String(params[name]));
}
const engine = new JumpGameEngine();
const recordKey = 'schedule-jump-best-v1';
let best = 0;
try { best = Math.max(0, parseInt(localStorage.getItem(recordKey), 10) || 0); } catch (error) {}
bestNode.textContent = best;
let active = false;
let mode = 'ready';
let frameId = null;
let lastFrame = null;
let accumulator = 0;
let left = false;
let right = false;
let targetX = null;
let dragPointer = null;
let palette = {};
let currentAnnouncement = null;
let announcedJetpacks = 0;

function announce(key, params = {}) {
  currentAnnouncement = { key, params };
  announcement.textContent = t(key, params);
}

function readPalette() {
  const css = getComputedStyle(host);
  const pick = name => css.getPropertyValue(name).trim();
  palette = { sky: pick('--jg-sky'), grid: pick('--jg-grid'), ink: pick('--ink'), muted: pick('--muted'), teal: pick('--jg-teal'), gold: pick('--jg-gold'), rust: pick('--jg-rust'), characterInk: pick('--jg-character-ink'), characterAccent: pick('--jg-character-accent'), margin: pick('--jg-margin'), shadow: pick('--jg-shadow'), dark: document.documentElement.dataset.theme === 'dark' };
}
function rounded(x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}
function render() {
  if (!context) return;
  const w = engine.width, h = engine.height;
  context.fillStyle = palette.sky || '#f4f5ef';
  context.fillRect(0, 0, w, h);
  context.strokeStyle = palette.grid || '#dae0e4';
  context.lineWidth = .7;
  context.beginPath();
  for (let x = 18; x < w; x += 24) { context.moveTo(x, 0); context.lineTo(x, h); }
  const gridOffset = (h + engine.camera) % 24;
  for (let y = gridOffset; y < h; y += 24) { context.moveTo(0, y); context.lineTo(w, y); }
  context.stroke();
  context.strokeStyle = palette.margin;
  context.beginPath(); context.moveTo(36, 0); context.lineTo(36, h); context.stroke();
  context.save();
  context.font = '600 10px sans-serif';
  context.fillStyle = palette.muted;
  context.globalAlpha = .65;
  for (let mark = Math.ceil(engine.camera / 500) * 500; mark < engine.camera + h; mark += 500) {
    if (!mark) continue;
    const y = h - (mark - engine.camera);
    context.fillText(String(Math.floor(mark / 10)), 7, y - 5);
  }
  context.restore();
  for (const platform of engine.platforms) {
    const y = h - (platform.y - engine.camera);
    if (y < -35 || y > h + 20) continue;
    const color = platform.type === 'breakable' ? palette.rust : palette.teal;
    context.fillStyle = palette.shadow;
    rounded(platform.x, y + 3, platform.width, 9, 4); context.fill();
    context.fillStyle = color;
    rounded(platform.x, y, platform.width, 8, 4); context.fill();
    context.fillStyle = '#ffffff40';
    rounded(platform.x + 5, y + 1, platform.width - 10, 2, 1); context.fill();
    if (platform.type === 'breakable') {
      const cx = platform.x + platform.width * .55;
      context.strokeStyle = palette.sky; context.lineWidth = 2.5;
      context.beginPath(); context.moveTo(cx + 3, y - 1); context.lineTo(cx - 2, y + 3); context.lineTo(cx + 1, y + 6); context.lineTo(cx - 3, y + 12); context.stroke();
    }
    if (platform.type === 'spring') {
      const cx = platform.x + platform.width / 2;
      const tall = 15 + platform.pulse * 10;
      context.strokeStyle = palette.gold; context.lineWidth = 2.4;
      context.beginPath(); context.moveTo(cx - 7, y); context.lineTo(cx + 6, y - tall * .25); context.lineTo(cx - 6, y - tall * .5); context.lineTo(cx + 6, y - tall * .75); context.lineTo(cx - 6, y - tall); context.stroke();
      context.fillStyle = palette.gold; rounded(cx - 10, y - tall - 4, 20, 4, 2); context.fill();
    }
    if (platform.jetpack) {
      const cx = platform.x + platform.width / 2;
      const cy = y - 29 + Math.sin(engine.time * 3.5 + platform.id) * 2;
      context.save();
      context.fillStyle = palette.gold; context.globalAlpha = .16;
      context.beginPath(); context.arc(cx, cy, 23, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1;
      context.fillStyle = palette.characterInk;
      rounded(cx - 12, cy - 10, 8, 25, 4); context.fill(); rounded(cx + 4, cy - 10, 8, 25, 4); context.fill();
      context.fillStyle = palette.gold;
      rounded(cx - 10, cy - 8, 4, 14, 2); context.fill(); rounded(cx + 6, cy - 8, 4, 14, 2); context.fill();
      context.fillStyle = palette.characterAccent; rounded(cx - 6, cy - 12, 12, 23, 4); context.fill();
      context.strokeStyle = '#fff8ed'; context.lineWidth = 1.7;
      context.beginPath(); context.moveTo(cx, cy + 5); context.lineTo(cx, cy - 5); context.moveTo(cx - 3, cy - 2); context.lineTo(cx, cy - 5); context.lineTo(cx + 3, cy - 2); context.stroke();
      context.restore();
    }
  }
  for (const fragment of engine.fragments) {
    const t = fragment.age;
    context.save(); context.globalAlpha = Math.max(0, 1 - t / .75); context.fillStyle = palette.rust;
    for (const side of [-1, 1]) {
      context.save(); context.translate(fragment.x + fragment.width / 2 + side * (fragment.width / 4 + t * 22), h - (fragment.y - engine.camera) + t * t * 400); context.rotate(side * t * 2);
      rounded(-fragment.width / 4 + 1, 0, fragment.width / 2 - 2, 8, 2); context.fill(); context.restore();
    }
    context.restore();
  }
  const p = engine.player;
  const drawBackpack = x => {
    const y = h - (p.y - engine.camera) - p.height;
    context.save(); context.translate(x, y + p.height / 2); context.rotate(Math.max(-.12, Math.min(.12, p.vx / 1500)));
    if (engine.jetpackTime > 0) {
      for (const side of [-1, 1]) {
        const flame = 20 + Math.sin(engine.time * 42 + side) * 7;
        const fx = side * 14;
        context.fillStyle = palette.characterAccent;
        context.beginPath(); context.moveTo(fx - 6, 9); context.quadraticCurveTo(fx - 9, 21, fx, 25 + flame); context.quadraticCurveTo(fx + 9, 21, fx + 6, 9); context.fill();
        context.fillStyle = palette.gold;
        context.beginPath(); context.moveTo(fx - 3, 11); context.lineTo(fx, 23 + flame * .65); context.lineTo(fx + 3, 11); context.fill();
        context.fillStyle = '#fff8ed';
        context.beginPath(); context.moveTo(fx - 2, 12); context.lineTo(fx, 23); context.lineTo(fx + 2, 12); context.fill();
      }
    }
    context.fillStyle = palette.characterInk;
    rounded(-10, 13, 7, 7, 3); context.fill(); rounded(3, 13, 7, 7, 3); context.fill();
    context.strokeStyle = palette.grid; context.lineWidth = 3;
    context.beginPath(); context.arc(0, -15, 7, Math.PI, 0); context.stroke();
    context.fillStyle = palette.characterInk; rounded(-17, -7, 34, 22, 5); context.fill();
    context.fillStyle = palette.gold; rounded(-14, -17, 28, 35, 8); context.fill();
    context.fillStyle = '#efd8ad'; rounded(-11, -14, 22, 9, 5); context.fill();
    context.fillStyle = palette.characterAccent; rounded(-10, 3, 20, 12, 4); context.fill();
    context.strokeStyle = '#fff1d6'; context.lineWidth = 1.3;
    context.beginPath(); context.moveTo(-6, 7); context.lineTo(6, 7); context.stroke();
    context.fillStyle = palette.characterInk; context.beginPath(); context.arc(-5, -2, 1.7, 0, Math.PI * 2); context.arc(5, -2, 1.7, 0, Math.PI * 2); context.fill();
    if (engine.jetpackTime > 0) {
      context.fillStyle = palette.characterInk; rounded(-21, -7, 8, 22, 4); context.fill(); rounded(13, -7, 8, 22, 4); context.fill();
      context.fillStyle = palette.gold; rounded(-19, -4, 4, 11, 2); context.fill(); rounded(15, -4, 4, 11, 2); context.fill();
    } else if (p.vy > JUMP_SPEED + 20) {
      context.strokeStyle = palette.gold; context.lineWidth = 2; context.globalAlpha = .8;
      context.beginPath(); context.moveTo(-5, 24); context.lineTo(-5, 35); context.moveTo(4, 27); context.lineTo(4, 41); context.stroke();
    }
    context.restore();
  };
  drawBackpack(p.x);
  if (p.x < 20) drawBackpack(p.x + w);
  if (p.x > w - 20) drawBackpack(p.x - w);
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = 360;
  const height = Math.round(width * rect.height / rect.width);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  engine.resize(width, height);
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  readPalette();
  render();
}
function clearInput() {
  left = false; right = false; targetX = null; dragPointer = null;
  leftButton.dataset.held = 'false'; rightButton.dataset.held = 'false';
}
function cancelFrame() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null; lastFrame = null; accumulator = 0;
}
function saveBest() {
  if (engine.score <= best) return;
  best = engine.score; bestNode.textContent = best;
  try { localStorage.setItem(recordKey, String(best)); } catch (error) {}
}
function setOverlay() {
  overlay.hidden = mode === 'playing';
  legend.hidden = mode !== 'ready';
  pauseButton.disabled = mode === 'ready' || mode === 'gameover';
  pauseLabel.textContent = t(mode === 'paused' ? 'game.resume' : 'game.pause');
  pauseButton.setAttribute('aria-label', t(mode === 'paused' ? 'game.resumeAria' : 'game.pauseAria'));
  if (mode === 'paused') {
    message.textContent = t('game.pausedTitle');
    description.textContent = t('game.pausedDescription', { score: engine.score });
    primary.textContent = t('game.resume');
  } else if (mode === 'gameover') {
    message.textContent = t(engine.score > 0 && engine.score >= best ? 'game.recordTitle' : 'game.gameoverTitle');
    description.textContent = t('game.gameoverDescription', { score: engine.score, best });
    primary.textContent = t('game.retry');
  } else {
    message.textContent = t('game.readyTitle');
    description.textContent = t('game.readyDescription');
    primary.textContent = t('game.start');
  }
  updateFuel();
}
function updateFuel() {
  fuel.hidden = engine.jetpackTime <= 0 || mode === 'ready' || mode === 'gameover';
  const percent = Math.round(engine.jetpackTime / JETPACK_DURATION * 100);
  fuelFill.style.transform = 'scaleX(' + (engine.jetpackTime / JETPACK_DURATION) + ')';
  fuelTrack.setAttribute('aria-valuenow', String(percent));
}
function refreshLanguage() {
  if (root.scheduleI18n) {
    host.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    host.querySelectorAll('[data-i18n-aria-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
  }
  setOverlay();
  if (currentAnnouncement) announcement.textContent = t(currentAnnouncement.key, currentAnnouncement.params);
  readPalette();
  if (active) render();
}
function tick(timestamp) {
  frameId = null;
  if (!active || mode !== 'playing') return;
  if (lastFrame !== null) accumulator += Math.min(.08, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  while (accumulator >= FIXED_STEP && engine.status === 'playing') {
    engine.step(FIXED_STEP, { axis: Number(right) - Number(left), targetX: targetX === null ? undefined : targetX });
    accumulator -= FIXED_STEP;
  }
  scoreNode.textContent = engine.score;
  if (engine.score > best) bestNode.textContent = engine.score;
  updateFuel();
  if (engine.jetpacksCollected > announcedJetpacks) {
    announcedJetpacks = engine.jetpacksCollected;
    announce('game.jetpackAnnouncement');
  }
  render();
  if (engine.status === 'gameover') {
    mode = 'gameover'; saveBest(); clearInput(); setOverlay(); cancelFrame();
    announce('game.overAnnouncement', { score: engine.score, best });
    return;
  }
  frameId = requestAnimationFrame(tick);
}
function play() {
  active = true;
  const resumed = mode === 'paused';
  if (mode === 'ready' || mode === 'gameover') { engine.reset(); announcedJetpacks = 0; }
  engine.resume();
  mode = 'playing'; clearInput(); setOverlay(); resize(); cancelFrame();
  scoreNode.textContent = engine.score;
  announce(resumed ? 'game.resumeAnnouncement' : 'game.startAnnouncement');
  frameId = requestAnimationFrame(tick);
}
function pause() {
  if (mode === 'playing') { mode = 'paused'; engine.pause(); saveBest(); clearInput(); cancelFrame(); setOverlay(); render(); }
}
root.scheduleGame = {
  activate() { active = true; resize(); setOverlay(); if (mode === 'playing' && frameId === null) frameId = requestAnimationFrame(tick); },
  deactivate() { pause(); active = false; clearInput(); cancelFrame(); },
  getState() { return { active, mode, score: engine.score, best: Math.max(best, engine.score), frameScheduled: frameId !== null, ...engine.getState() }; }
};
primary.addEventListener('click', play);
pauseButton.addEventListener('click', () => mode === 'paused' ? play() : pause());
function bindDirection(button, direction) {
  button.addEventListener('pointerdown', event => {
    if (!active || mode !== 'playing') return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    if (direction < 0) left = true; else right = true;
    targetX = null; button.dataset.held = 'true';
  });
  const release = () => { if (direction < 0) left = false; else right = false; button.dataset.held = 'false'; };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
bindDirection(leftButton, -1); bindDirection(rightButton, 1);
const pointerPosition = event => { const rect = canvas.getBoundingClientRect(); return Math.max(0, Math.min(engine.width, (event.clientX - rect.left) / rect.width * engine.width)); };
canvas.addEventListener('pointerdown', event => {
  if (!active || mode !== 'playing') return;
  event.preventDefault(); dragPointer = event.pointerId; canvas.setPointerCapture(event.pointerId); targetX = pointerPosition(event);
});
canvas.addEventListener('pointermove', event => { if (event.pointerId === dragPointer && mode === 'playing') { event.preventDefault(); targetX = pointerPosition(event); } });
const endDrag = event => { if (event.pointerId === dragPointer) { dragPointer = null; targetX = null; } };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
const keyDirection = (key, code) => key === 'ArrowLeft' || code === 'KeyA' || key.toLowerCase() === 'a' ? -1 : key === 'ArrowRight' || code === 'KeyD' || key.toLowerCase() === 'd' ? 1 : 0;
document.addEventListener('keydown', event => {
  if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
  const direction = keyDirection(event.key, event.code);
  if (direction && mode === 'playing') { event.preventDefault(); targetX = null; if (direction < 0) left = true; else right = true; }
  if ((event.key === 'Escape' || event.code === 'KeyP' || event.key === 'p' || event.key === 'P') && mode === 'playing') { event.preventDefault(); pause(); }
});
document.addEventListener('keyup', event => { const direction = keyDirection(event.key, event.code); if (direction < 0) left = false; if (direction > 0) right = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) root.scheduleGame.deactivate(); });
window.addEventListener('blur', () => root.scheduleGame.deactivate());
window.addEventListener('pagehide', () => root.scheduleGame.deactivate());
window.addEventListener('resize', () => { if (active) resize(); });
root.addEventListener('language:change', refreshLanguage);
new MutationObserver(() => { readPalette(); if (active) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'lang'] });
if ('ResizeObserver' in window) new ResizeObserver(() => { if (active) resize(); }).observe(canvas.parentElement);
refreshLanguage();
})(typeof window !== 'undefined' ? window : globalThis);

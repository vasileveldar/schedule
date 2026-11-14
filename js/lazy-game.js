/* js/game.js */
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
    this.enemies = [];
    this.nextEnemySequence = 14 + Math.floor(this.random() * 5);
    this.coins = 0;
    this.stomps = 0;
    this.cause = null;
    this.events = [];
    this.fillPlatforms();
  }
  die(cause) { this.status = 'gameover'; this.cause = cause; this.events.push('over'); }
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
      let type = this.sequence % 8 === 5 ? 'spring' : 'normal';
      if (type === 'normal' && this.lastY > 1500 && this.sequence % 7 === 3) type = 'moving';
      const platform = { id: this.nextId++, x: nextX, y: this.lastY, width, type, broken: false, pulse: 0, jetpack, coin: !jetpack && type !== 'spring' && this.sequence % 4 === 1 };
      if (type === 'moving') { platform.vx = (this.random() < .5 ? -1 : 1) * (45 + difficulty * 3); platform.min = 12; platform.max = Math.max(13, this.width - width - 12); }
      this.platforms.push(platform);
      if (this.sequence >= this.nextEnemySequence && this.lastY > 1800) {
        this.nextEnemySequence = this.sequence + 10 + Math.floor(this.random() * 8);
        this.enemies.push({ id: this.nextId++, x: Math.max(20, Math.min(this.width - 20, this.width - nextX - width / 2)), y: this.lastY - gap / 2 - 10, vx: (this.random() < .5 ? -1 : 1) * (50 + difficulty * 2), w: 34, h: 20, dead: false, age: 0 });
      }
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
    for (const platform of this.platforms) {
      if (!platform.vx) continue;
      platform.x += platform.vx * dt;
      if (platform.x < platform.min) { platform.x = platform.min; platform.vx = Math.abs(platform.vx); }
      if (platform.x > platform.max) { platform.x = platform.max; platform.vx = -Math.abs(platform.vx); }
    }
    for (const e of this.enemies) {
      e.age += dt;
      if (e.dead) continue;
      e.x += e.vx * dt;
      if (e.x < 18) { e.x = 18; e.vx = Math.abs(e.vx); }
      if (e.x > this.width - 18) { e.x = this.width - 18; e.vx = -Math.abs(e.vx); }
    }
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
        this.events.push(platform.type === 'spring' ? 'spring' : 'bounce');
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
        this.events.push('jetpack');
      }
    }
    for (const platform of this.platforms) {
      if (!platform.coin || platform.broken) continue;
      const cx = platform.x + platform.width / 2, cy = platform.y + 24;
      if (Math.abs(p.x - cx) < p.width * .5 + 9 && Math.max(oldY, p.y) + p.height >= cy - 9 && Math.min(oldY, p.y) <= cy + 9) {
        platform.coin = false; this.coins++; this.events.push('coin');
      }
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const hitX = Math.abs(p.x - e.x) < p.width * .4 + e.w / 2;
      const hitY = Math.min(oldY, p.y) < e.y + e.h && Math.max(oldY, p.y) + p.height > e.y;
      if (!hitX || !hitY) continue;
      if (this.jetpackTime > 0) { e.dead = true; e.age = 0; this.stomps++; this.events.push('stomp'); }
      else if (p.vy < 0 && oldY >= e.y + e.h * .4) { e.dead = true; e.age = 0; this.stomps++; p.y = Math.max(p.y, e.y + e.h); p.vy = JUMP_SPEED; this.events.push('stomp'); }
      else { this.die('bird'); return; }
    }
    this.maxHeight = Math.max(this.maxHeight, p.y);
    this.heightScore = Math.floor((this.maxHeight - 34) / 10);
    this.score = this.heightScore + this.coins * 3 + this.stomps * 10;
    this.camera = Math.max(this.camera, p.y - this.height * .54);
    for (const platform of this.platforms) platform.pulse = Math.max(0, platform.pulse - dt * 4);
    for (const fragment of this.fragments) fragment.age += dt;
    this.fragments = this.fragments.filter(f => f.age < .75);
    this.platforms = this.platforms.filter(platform => platform.y > this.camera - 90 && !platform.broken);
    this.enemies = this.enemies.filter(e => e.y > this.camera - 90 && !(e.dead && e.age > .6));
    this.fillPlatforms();
    if (p.y < this.camera - 60) this.die('fall');
  }
  getState() {
    return { score: this.score, status: this.status, player: { ...this.player }, camera: this.camera, maxHeight: this.maxHeight, heightScore: this.heightScore || 0, coins: this.coins, stomps: this.stomps, cause: this.cause, enemies: this.enemies.map(e => ({ ...e })), lastLanding: this.lastLanding, jetpackTime: this.jetpackTime, jetpackDuration: JETPACK_DURATION, jetpackActive: this.jetpackTime > 0, jetpacksCollected: this.jetpacksCollected, platforms: this.platforms.map(p => ({ ...p })), fragments: this.fragments.map(f => ({ ...f })) };
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
  'game.jetpackAnnouncement': 'Ракетный ранец активирован! Продолжайте двигаться влево и вправо.',
  'game.zoneAnnouncement': 'Новая зона: {zone}.', 'game.ghost': 'рекорд',
  'zone.notebook': 'Тетрадь', 'zone.lecture': 'Аудитория', 'zone.space': 'Космос'
};
function t(key, params = {}) {
  if (root.scheduleI18n) { const v = root.scheduleI18n.t(key, params); if (v !== key) return v; }
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
let tiltAxis = 0;
const arcade = () => root.scheduleArcade;
const tiltMode = () => !!(arcade() && arcade().fx.tilt);
window.addEventListener('deviceorientation', event => {
  const a = arcade();
  if (!active || mode !== 'playing' || !a || !a.fx.tilt || event.gamma === null) { tiltAxis = 0; return; }
  const angle = (screen.orientation && screen.orientation.angle) || 0;
  const g = angle === 90 ? -event.beta : angle === 270 || angle === -90 ? event.beta : event.gamma;
  tiltAxis = Math.max(-1, Math.min(1, (g || 0) / 18));
});
function drainEvents() {
  const a = arcade();
  for (const name of engine.events.splice(0)) {
    if (!a) continue;
    if (name === 'bounce') a.sfx('bounce');
    else if (name === 'spring') { a.sfx('spring'); a.haptic(25); }
    else if (name === 'jetpack') { a.sfx('jetpack'); a.haptic(60); }
    else if (name === 'coin') { a.sfx('coin'); a.haptic(10); }
    else if (name === 'stomp') { a.sfx('stomp'); a.haptic(40); }
    else if (name === 'over') { a.sfx('over'); a.haptic([60, 40, 90]); }
  }
}

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
  drawZone(w, h);
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
    const color = platform.type === 'breakable' ? palette.rust : platform.type === 'moving' ? palette.characterAccent : palette.teal;
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
    if (platform.coin) {
      const cx = platform.x + platform.width / 2, cy = y - 24 + Math.sin(engine.time * 4 + platform.id) * 1.5;
      context.fillStyle = palette.gold; context.beginPath(); context.arc(cx, cy, 7, 0, Math.PI * 2); context.fill();
      context.strokeStyle = palette.characterInk; context.lineWidth = 1.4; context.stroke();
      context.fillStyle = '#ffffff80'; context.beginPath(); context.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2); context.fill();
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
  for (const e of engine.enemies) {
    const ey = h - (e.y - engine.camera);
    if (ey < -40 || ey > h + 40) continue;
    context.save(); context.translate(e.x, ey - e.h / 2);
    if (e.dead) { context.globalAlpha = Math.max(0, 1 - e.age / .6); context.translate(0, e.age * 160); context.rotate(e.age * 6); }
    const flap = Math.sin(engine.time * 16 + e.id) * 8;
    context.fillStyle = palette.rust;
    context.beginPath(); context.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.moveTo(-4, -2); context.lineTo(-18, -12 - flap); context.lineTo(-8, 2); context.moveTo(4, -2); context.lineTo(18, -12 - flap); context.lineTo(8, 2); context.fill();
    context.fillStyle = palette.characterInk; context.beginPath(); context.arc(e.vx > 0 ? 8 : -8, -2, 2, 0, Math.PI * 2); context.fill();
    context.fillStyle = palette.gold; context.beginPath(); const bx = e.vx > 0 ? 13 : -13; context.moveTo(bx, 0); context.lineTo(bx + (e.vx > 0 ? 7 : -7), 2); context.lineTo(bx, 4); context.fill();
    context.restore();
  }
  drawGhost(w, h);
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
  drawBanner();
  if (engine.coins) { context.save(); context.fillStyle = palette.gold; context.beginPath(); context.arc(w - 46, 22, 6, 0, Math.PI * 2); context.fill(); context.fillStyle = palette.ink; context.font = '700 13px sans-serif'; context.textAlign = 'left'; context.fillText(String(engine.coins), w - 36, 27); context.restore(); }
}
const smooth = (v, a, b) => { const x = Math.max(0, Math.min(1, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
const ZONES = [{ from: 0, key: 'zone.notebook' }, { from: 150, key: 'zone.lecture' }, { from: 400, key: 'zone.space' }];
function zoneIndex(score) { let z = 0; ZONES.forEach((zone, i) => { if (score >= zone.from) z = i; }); return z; }
function drawZone(w, h) {
  const hs = engine.heightScore || 0;
  const a1 = smooth(hs, 110, 190), a2 = smooth(hs, 340, 440);
  if (a1 > 0 && a2 < 1) {
    context.fillStyle = palette.dark ? 'rgba(255,196,120,' + (.07 * a1 * (1 - a2)) + ')' : 'rgba(150,100,50,' + (.12 * a1 * (1 - a2)) + ')';
    context.fillRect(0, 0, w, h);
    context.strokeStyle = palette.dark ? 'rgba(255,255,255,' + (.07 * a1 * (1 - a2)) + ')' : 'rgba(60,40,20,' + (.10 * a1 * (1 - a2)) + ')'; context.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const y = ((engine.camera * .25 + i * 190) % 570); context.strokeRect(w - 118, h - y + 40, 92, 62); }
  }
  if (a2 > 0) {
    context.fillStyle = 'rgba(8,10,34,' + (.82 * a2) + ')';
    context.fillRect(0, 0, w, h);
    context.fillStyle = '#fff';
    for (let i = 0; i < 38; i++) {
      const sx = (i * 97.3) % w, base = (i * 61.7) % h;
      const sy = h - ((base + engine.camera * (.12 + (i % 3) * .06)) % h);
      context.globalAlpha = a2 * (.35 + (i % 4) * .15); context.fillRect(sx, sy, 1.6, 1.6);
    }
    context.globalAlpha = 1;
  }
}
let zoneShown = 0, zoneBanner = null;
function checkZone() {
  const z = zoneIndex(engine.heightScore || 0);
  if (z > zoneShown) { zoneShown = z; zoneBanner = { text: t(ZONES[z].key), until: performance.now() + 2200 }; announce('game.zoneAnnouncement', { zone: t(ZONES[z].key) }); }
}
// «Призрак»: лучший прошлый забег показывается полупрозрачным рюкзаком
const ghostKey = 'schedule-jump-ghost-v1';
let ghost = null, run = [], runClock = 0;
try { const g = JSON.parse(localStorage.getItem(ghostKey) || 'null'); if (g && Array.isArray(g.run) && g.run.length > 5) ghost = g; } catch (error) {}
function recordRun(dt) {
  runClock += dt;
  while (run.length < 4000 && run.length * .1 <= runClock) run.push([Math.round(engine.player.x), Math.round(engine.player.y)]);
}
function saveGhost() {
  if (!run.length || engine.score < 1 || (ghost && ghost.score >= engine.score)) return;
  ghost = { score: engine.score, run: run.slice() };
  try { localStorage.setItem(ghostKey, JSON.stringify(ghost)); } catch (error) {}
}
function drawGhost(w, h) {
  if (!ghost || mode !== 'playing') return;
  const i = Math.min(ghost.run.length - 1, Math.floor(runClock / .1));
  const [gx, gy] = ghost.run[i];
  const y = h - (gy - engine.camera) - 35;
  if (y < -40 || y > h + 20) return;
  context.save(); context.globalAlpha = .32; context.fillStyle = palette.gold; rounded(gx - 14, y - 4, 28, 35, 8); context.fill();
  context.globalAlpha = .55; context.fillStyle = palette.muted; context.font = '600 9px sans-serif'; context.textAlign = 'center'; context.fillText(t('game.ghost'), gx, y - 8);
  context.restore();
}
function drawBanner() {
  if (!zoneBanner || performance.now() > zoneBanner.until) { zoneBanner = null; return; }
  const left = Math.min(1, (zoneBanner.until - performance.now()) / 500);
  context.save(); context.globalAlpha = left; context.textAlign = 'center'; context.font = '700 17px sans-serif';
  const tw = context.measureText(zoneBanner.text).width + 28;
  context.fillStyle = palette.dark ? '#000000a0' : '#ffffffd0'; rounded(engine.width / 2 - tw / 2, 14, tw, 30, 15); context.fill();
  context.fillStyle = palette.ink; context.fillText(zoneBanner.text, engine.width / 2, 35);
  context.restore();
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
    const manual = tiltMode() ? 0 : Number(right) - Number(left);
    engine.step(FIXED_STEP, { axis: manual || tiltAxis, targetX: targetX === null || tiltMode() ? undefined : targetX });
    recordRun(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }
  drainEvents();
  checkZone();
  scoreNode.textContent = engine.score;
  if (engine.score > best) bestNode.textContent = engine.score;
  updateFuel();
  if (engine.jetpacksCollected > announcedJetpacks) {
    announcedJetpacks = engine.jetpacksCollected;
    announce('game.jetpackAnnouncement');
  }
  render();
  if (engine.status === 'gameover') {
    mode = 'gameover'; saveGhost(); saveBest(); clearInput(); setOverlay(); cancelFrame();
    root.dispatchEvent(new CustomEvent('arcade:score', { detail: { game: 'jump', score: engine.score } }));
    announce('game.overAnnouncement', { score: engine.score, best });
    return;
  }
  frameId = requestAnimationFrame(tick);
}
function play() {
  active = true;
  const resumed = mode === 'paused';
  if (mode === 'ready' || mode === 'gameover') { engine.reset(); announcedJetpacks = 0; run = []; runClock = 0; zoneShown = 0; zoneBanner = null; }
  if (root.scheduleArcade) root.scheduleArcade.unlockAudio();
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
  engine,
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
  if (!active || mode !== 'playing' || tiltMode()) return;
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
;
/* js/arcade.js */
(() => {
'use strict';
/* «Игровой зал»: вкладки игр, звук/вибрация, дневной рекорд и таблица рекордов под игрой. */
const root = window;
const screen = document.getElementById('game-screen');
if (!screen) return;
const L = {
  ru: { jump: 'Прыжки', board: 'Таблица рекордов', today: 'Сегодня', best: 'Рекорд', empty: 'Пока никого. Станьте первым!', you: 'вы', rank: 'Ваше место', nick: 'Ваш ник', save: 'Сохранить', nickHint: 'Ник нужен, чтобы попасть в таблицу рекордов (2–16 символов).', tg: 'Имя берётся из Telegram: {name}', saved: 'Ник сохранён', taken: 'Такой ник уже занят', bad: 'Допустимы 2–16 символов: буквы, цифры, пробел, _ . -', net: 'Нет связи, попробуйте позже', offline: 'Таблица рекордов недоступна', pend: 'Счёт отправится, когда появится связь', sound: 'Звук', haptic: 'Вибрация', ctlTouch: 'Кнопки и свайп', ctlTilt: 'Гироскоп', ctl: 'Управление', games: 'Выбор игры', change: 'Изменить', loading: 'Загрузка…' },
  en: { jump: 'Jump', board: 'Leaderboard', today: 'Today', best: 'Best', empty: 'Nobody yet. Be the first!', you: 'you', rank: 'Your rank', nick: 'Your nickname', save: 'Save', nickHint: 'A nickname puts you on the leaderboard (2–16 characters).', tg: 'Name comes from Telegram: {name}', saved: 'Nickname saved', taken: 'This nickname is taken', bad: '2–16 characters: letters, digits, space, _ . -', net: 'No connection, try later', offline: 'Leaderboard unavailable', pend: 'Score will be sent when online', sound: 'Sound', haptic: 'Vibration', ctlTouch: 'Buttons & swipe', ctlTilt: 'Gyroscope', ctl: 'Controls', games: 'Choose a game', change: 'Change', loading: 'Loading…' },
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
  tabs.hidden = games.length < 2; // одна игра — вкладки не нужны
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
const fmt = n => new Intl.NumberFormat(lang() === 'en' ? 'en-GB' : 'ru-RU').format(n);
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

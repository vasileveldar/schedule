/* js/i18n.js */
(() => {
'use strict';
const catalogue=JSON.parse(document.getElementById('translation-data').textContent);
const valid=['ru','en'];
const palettes=['en','sunset','forest','ocean','graphite','sakura','amoled'];
let language=valid.includes(document.documentElement.dataset.language)?document.documentElement.dataset.language:'ru';
let palette=palettes.includes(document.documentElement.dataset.palette)?document.documentElement.dataset.palette:'en';
let hasSavedPalette=palettes.includes(document.documentElement.dataset.palette);
try {const stored=localStorage.getItem('schedule-language');if(valid.includes(stored))language=stored;else if(window.AppPreferences){const native=window.AppPreferences.getLocale();if(valid.includes(native))language=native;}} catch (_) {}
try {const stored=localStorage.getItem('schedule-palette');if(palettes.includes(stored)){palette=stored;hasSavedPalette=true;}} catch (_) {}
if(!hasSavedPalette){
  palette='en';
  try {localStorage.setItem('schedule-palette',palette);} catch (_) {}
}
function t(key,params={}) {
  const value=catalogue.ui[language][key] ?? catalogue.ui.ru[key] ?? key;
  if(Array.isArray(value))return value;
  return String(value).replace(/\{(\w+)\}/g,(_,name)=>params[name]===undefined?'{'+name+'}':String(params[name]));
}
function content(kind,value) {
  if(!value||language==='ru')return value;
  return catalogue.content[kind]?.[value]?.[language] ?? value;
}
function day(value,short=false) {
  const index=catalogue.ui.ru['days.full'].indexOf(value);
  return index<0?value:t(short?'days.short':'days.full')[index];
}
function group(value) {return language==='ru'?value:String(value).replace(/^РА-/, 'RA-').replace(/^ИН-/, 'IN-');}
function room(value) {
  const translated=content('rooms',String(value));
  return /^(ск\.|Спорткомплекс)/i.test(String(value))?translated:t('schedule.room',{room:translated});
}
function applyStatic(scope=document) {
  scope.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
  scope.querySelectorAll('[data-i18n-label]').forEach(node=>node.setAttribute('label',t(node.getAttribute('data-i18n-label'))));
  for(const attr of ['aria-label','title'])scope.querySelectorAll('[data-i18n-'+attr+']').forEach(node=>node.setAttribute(attr,t(node.getAttribute('data-i18n-'+attr))));
  const languageSelect=scope.querySelector?.('#language-select');
  if(languageSelect)languageSelect.value=language;
  const paletteSelect=scope.querySelector?.('#palette-select');
  if(paletteSelect)paletteSelect.value=palette;
  document.title=t('app.title');
}
function syncChrome() {
  const dark=document.documentElement.dataset.theme==='dark';
  const styles=getComputedStyle(document.documentElement);
  const header=styles.getPropertyValue('--header').trim() || '#182d49';
  const paper=styles.getPropertyValue('--paper').trim() || '#f6f4ef';
  const themeColor=document.getElementById('app-theme-color');
  if(themeColor)themeColor.content=header;
  try {
    if(window.AppPreferences){
      window.AppPreferences.setLocale(language);
      window.AppPreferences.setChromeColors(header,paper,dark);
    }
  } catch (_) {}
}
function setLanguage(next,announce=true) {
  if(!valid.includes(next))return;
  language=next;
  document.documentElement.lang=next;
  document.documentElement.dataset.language=next;
  try {localStorage.setItem('schedule-language',next);} catch (_) {}
  applyStatic();syncChrome();
  window.dispatchEvent(new CustomEvent('language:change',{detail:{language:next}}));
  if(announce)document.getElementById('language-status').textContent=t('language.changed');
}
function setPalette(next,announce=true) {
  if(!palettes.includes(next))return;
  palette=next;
  document.documentElement.dataset.palette=next;
  try {localStorage.setItem('schedule-palette',next);} catch (_) {}
  applyStatic();syncChrome();
  window.dispatchEvent(new CustomEvent('palette:change',{detail:{palette:next}}));
  if(announce)document.getElementById('palette-status').textContent=t('palette.changed.'+next);
}
window.scheduleI18n={t,content,day,group,room,applyStatic,syncChrome,setLanguage,setPalette,getLanguage:()=>language,getPalette:()=>palette};
document.getElementById('language-select').addEventListener('change',event=>setLanguage(event.currentTarget.value));
document.getElementById('palette-select').addEventListener('change',event=>setPalette(event.currentTarget.value));
document.documentElement.dataset.palette=palette;
setLanguage(language,false);
})();
;
/* js/theme.js */
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
;
/* js/ui.js */
(() => {
'use strict';
const i18n=window.scheduleI18n;
const t=(key,params)=>i18n.t(key,params);
/* тема: см. theme.js */
const data=JSON.parse(document.getElementById('schedule-data').textContent);
const assessment=JSON.parse(document.getElementById('assessment-data').textContent);
function currentScheduleDay(date=new Date()){
  const index=(date.getDay()+6)%7;
  return data.days[index]||'week';
}
const assessmentLessons=assessment.events.map(event=>{
  const original=data.events.find(item=>item.subject===event.subject&&item.source==='academic');
  return {...original,...event,type:'',source:'assessment',conflict:false,conflictNote:'',group:'Общее'};
});
// Keep the complete regular timetable; assessments replace only overlapping time slots.
const assessmentEvents=assessmentLessons.concat(data.events
  .filter(event=>!assessmentLessons.some(control=>control.day===event.day&&event.start<control.end&&control.start<event.end))
  .map(event=>({...event,conflict:false,conflictNote:''})));
const days=data.days;
const groups=[...new Set(data.events.map(e=>e.group).filter(g=>g&&g!=='Общее'))].sort((a,b)=>a.localeCompare(b,'ru'));
let trackedScheduleDay=currentScheduleDay();
const state={group:'all',day:trackedScheduleDay,mode:'regular'};
const storageKey='combined-schedule-2026-2027-v1';
try{const old=JSON.parse(localStorage.getItem(storageKey)||'null');if(old&& (old.group==='all'||groups.includes(old.group)))state.group=old.group;}catch(_){}
try{localStorage.removeItem('schedule-mode');}catch(_){}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function persistState(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(_){}}
function choose(kind,value){if(kind==='day'&&value==='today')value=currentScheduleDay();if(state[kind]===value)return;state[kind]=value;persistState();render();}
function choice(value,kind){const button=el('button','choice'+(kind==='day'?' day':'')+(value==='today'?' today-choice':''));button.type='button';button.dataset.value=value;button.addEventListener('click',()=>choose(kind,value));return button;}
function clock(value){const parts=String(value||'').trim().split(':');return parts.length===2?parts[0].padStart(2,'0')+':'+parts[1].padStart(2,'0'):String(value||'');}
function minute(value){const [h,m]=String(value).split(':').map(Number);return h*60+m;}
function drawEvent(event){
  const inclusive=event.source==='added';
  const card=el('article','lesson'+(inclusive?' inclusive':'')+(event.conflict?' conflict':''));
  card.dataset.day=event.day;card.dataset.start=clock(event.start);card.dataset.end=clock(event.end);card.dataset.subject=event.subject||'';card.dataset.teacher=event.teacher||'';card.dataset.room=event.room||'';card.dataset.group=event.group||'Общее';card.dataset.source=event.source||'';
  const time=el('div','time',clock(event.start));time.append(el('span','until',clock(event.end)));card.append(time);
  const details=el('div','details'),tags=el('div','tags');
  if(event.conflict)tags.append(el('span','tag conflict-tag',t('schedule.conflict')));
  if(event.offsite)tags.append(el('span','tag offsite-tag',t('schedule.offsite'))); // занятие в другом месте (например, академическая мобильность)
  if(event.source==='assessment')tags.append(el('span','tag assessment-tag',t('schedule.rk1')));
  if(event.source==='srsp'){const tag=el('span','tag srsp',t('schedule.srsp'));tag.title=t('schedule.srspFull');tags.append(tag);}
  if(event.group&&event.group!=='Общее')tags.append(el('span','tag group',i18n.group(event.group)));
  if(tags.childNodes.length)details.append(tags);
  details.append(el('h3','subject',i18n.content('subjects',event.subject)));
  if(event.type&&!(event.source==='srsp'&&event.type.trim().toUpperCase()==='СРСП'))details.append(el('div','detail',i18n.content('types',event.type)));
  if(event.teacher)details.append(el('div','detail',i18n.content('teachers',event.teacher)));
  if(event.room)details.append(el('div','detail room',i18n.room(event.room)));
  if(event.offsite&&event.place)details.append(el('div','detail place','📍 '+event.place));
  if(event.conflictNote&&event.conflict)details.append(el('p','conflict-note',i18n.content('conflictNotes',event.conflictNote)));
  card.append(details);return card;
}
function render(){
  const modeBox=document.getElementById('schedule-modes');
  if(!modeBox.childNodes.length)modeBox.append(choice('regular','mode'),choice('rk1','mode'));
  [...modeBox.children].forEach(button=>{button.textContent=t(button.dataset.value==='rk1'?'schedule.rk1':'schedule.regular');button.setAttribute('aria-pressed',String(state.mode===button.dataset.value));});
  document.getElementById('assessment-notice').hidden=state.mode!=='rk1';
  const currentEvents=state.mode==='rk1'?assessmentEvents:data.events;
  const groupBox=document.getElementById('groups'),dayBox=document.getElementById('days');
  if(!groupBox.childNodes.length)groupBox.append(choice('all','group'),...groups.map(group=>choice(group,'group')));
  if(!dayBox.childNodes.length)dayBox.append(choice('today','day'),choice('week','day'),...days.map(day=>choice(day,'day')));
  [...groupBox.children].forEach(button=>{const value=button.dataset.value;button.textContent=value==='all'?t('schedule.bothGroups'):i18n.group(value);button.setAttribute('aria-pressed',String(state.group===value));});
  [...dayBox.children].forEach(button=>{const value=button.dataset.value;button.textContent=value==='today'?t('schedule.today'):value==='week'?t('schedule.week'):i18n.day(value,true);button.setAttribute('aria-label',value==='today'?t('schedule.todayAria'):value==='week'?t('schedule.week'):i18n.day(value));button.setAttribute('aria-pressed',String(value==='today'?state.day===currentScheduleDay()&&currentScheduleDay()!=='week':state.day===value));});
  const container=document.getElementById('schedule');container.replaceChildren();container.classList.toggle('single',state.day!=='week');
  const shownDays=state.day==='week'?days:[state.day];let count=0;
  for(const day of shownDays){
    const events=currentEvents.filter(e=>e.day===day&&(state.group==='all'||!e.group||e.group==='Общее'||e.group===state.group)).sort((a,b)=>minute(a.start)-minute(b.start)||minute(a.end)-minute(b.end)||String(a.group||'').localeCompare(String(b.group||''),'ru'));
    if(!events.length&&state.day==='week')continue;
    const section=el('section','day-section'),heading=el('div','day-heading');section.dataset.day=day;
    const number=el('span','day-number',String(days.indexOf(day)+1).padStart(2,'0'));number.setAttribute('aria-hidden','true');heading.append(number,el('h2','',i18n.day(day)));section.append(heading);
    if(state.mode!=='rk1'&&day===currentScheduleDay()){
      const now=new Date(),locale={ru:'ru-RU',en:'en-GB'}[i18n.getLanguage()];
      const date=el('time','current-day-date',new Intl.DateTimeFormat(locale,{day:'numeric',month:'long'}).format(now));
      date.dateTime=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      heading.append(date);
    }
    if(state.mode==='rk1'){
      const date=el('time','assessment-day-date',new Intl.DateTimeFormat({ru:'ru-RU',en:'en-GB'}[i18n.getLanguage()],{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(assessment.dates[day]+'T12:00:00Z')));
      date.dateTime=assessment.dates[day];heading.append(date);
    }
    const stack=el('div','day-stack');if(!events.length)stack.append(el('p','empty',t('schedule.empty')));else for(const event of events)stack.append(drawEvent(event));
    section.append(stack);container.append(section);count+=events.length;
  }
  if(!container.childNodes.length)container.append(el('p','empty',t('schedule.empty')));
  document.getElementById('status').textContent=t(state.mode==='rk1'?'schedule.rk1':'schedule.regular')+'. '+t('schedule.summary',{day:state.day==='week'?t('schedule.week'):i18n.day(state.day),group:state.group==='all'?t('schedule.allGroups'):i18n.group(state.group),count});
  document.dispatchEvent(new CustomEvent('schedule:render'));
}
window.addEventListener('language:change',render);
function refreshTrackedDate(){
  const current=currentScheduleDay();
  if(current===trackedScheduleDay)return;
  trackedScheduleDay=current;
  state.day=current;
  persistState();
  render();
}
function trackMidnight(){
  const now=new Date();
  const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  setTimeout(()=>{refreshTrackedDate();trackMidnight();},Math.max(1000,midnight.getTime()-now.getTime()+250));
}
window.addEventListener('focus',refreshTrackedDate);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')refreshTrackedDate();});
trackMidnight();
render();
})();
;
/* js/scores.js */
(() => {
'use strict';
/* Рекорды игр: отправка счёта и таблица лидеров в облаке.
   В Telegram имя берётся из бота (подпись initData), в PWA и APK игрок вводит ник. Без интернета счёт ждёт в очереди. */
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const cloud = String((read('app-config') || {}).cloudUrl || '').replace(/\/+$/, '');
const enabled = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud);
const bridge = window.AppPreferences;
const nativeNet = !!(bridge && typeof bridge.cloudRequest === 'function');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } },
};
const NICK_KEY = 'schedule-nick', DEVICE_KEY = 'schedule-device', PENDING_KEY = 'schedule-scores-pending';

function deviceId() {
  let id = store.get(DEVICE_KEY);
  if (!/^[a-f0-9]{24}$/.test(id || '')) {
    const bytes = new Uint8Array(12);
    (window.crypto || { getRandomValues: a => a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); }) }).getRandomValues(bytes);
    id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    store.set(DEVICE_KEY, id);
  }
  return id;
}
const initData = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
const inTelegram = () => !!initData();

// ---------- сеть: в APK через Android-часть (страница сама наружу не ходит), иначе fetch ----------
let seq = 0;
const waiting = new Map();
window.__cloudDone = (id, status, text) => { const f = waiting.get(id); if (f) { waiting.delete(id); f({ status, text }); } };
function request(method, path, body) {
  if (!enabled) return Promise.reject(new Error('off'));
  if (nativeNet) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('timeout')); }, 12000);
      waiting.set(id, r => { clearTimeout(timer); r.status > 0 ? resolve(r) : reject(new Error('net')); });
      try { bridge.cloudRequest(id, method, path, body ? JSON.stringify(body) : ''); } catch (e) { clearTimeout(timer); waiting.delete(id); reject(e); }
    }).then(r => ({ status: r.status, json: safeJson(r.text) }));
  }
  const headers = { 'content-type': 'application/json' };
  if (inTelegram()) headers['x-telegram-init-data'] = initData();
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
  return fetch(cloud + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store' })
    .then(async r => ({ status: r.status, json: safeJson(await r.text()) })).finally(() => clearTimeout(timer));
}
const safeJson = text => { try { return JSON.parse(text); } catch (_) { return null; } };

// ---------- очередь счёта ----------
const pending = () => { try { return JSON.parse(store.get(PENDING_KEY) || '{}') || {}; } catch (_) { return {}; } };
const savePending = p => store.set(PENDING_KEY, JSON.stringify(p));
const nick = () => store.get(NICK_KEY) || '';
const needNick = () => enabled && !inTelegram() && !nick();
let flushing = false;

async function flush() {
  if (!enabled || flushing || needNick()) return null;
  flushing = true;
  let last = null;
  try {
    for (const [game, score] of Object.entries(pending())) {
      const body = { game, score, device: deviceId() };
      if (!inTelegram()) body.nick = nick();
      const r = await request('POST', '/api/scores', body);
      if (r.status === 200) { const p = pending(); if (p[game] === score) delete p[game]; savePending(p); last = { game, board: r.json }; }
      else if (r.status === 409 || r.status === 400) { const p = pending(); delete p[game]; savePending(p); if (r.json && r.json.error === 'nick-taken') { store.set(NICK_KEY, ''); } }
      else break;
    }
  } catch (_) { /* нет связи — повторим позже */ } finally { flushing = false; }
  return last;
}

function submit(game, score) {
  score = Math.floor(Number(score));
  if (!enabled || !(score >= 1)) return Promise.resolve(null);
  const p = pending();
  if (!(p[game] >= score)) { p[game] = score; savePending(p); }
  return flush();
}

async function top(game) {
  const q = '/api/scores?game=' + encodeURIComponent(game) + (inTelegram() ? '' : '&device=' + deviceId());
  const r = await request('GET', q);
  return r.status === 200 ? r.json : null;
}

// ник: 2–16 символов, буквы/цифры/пробел/_ . -
const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{0,14}[\p{L}\p{N}]$/u;
const cleanNick = v => String(v || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
async function setNick(value) {
  const v = cleanNick(value);
  if (!NICK_RE.test(v)) return { ok: false, error: 'nick' };
  try {
    const r = await request('POST', '/api/scores', { game: 'jump', device: deviceId(), nick: v });
    if (r.status === 200) { store.set(NICK_KEY, v); flush(); return { ok: true, board: r.json }; }
    if (r.status === 409) return { ok: false, error: 'taken' };
    return { ok: false, error: 'nick' };
  } catch (_) { return { ok: false, error: 'net' }; }
}

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
window.scheduleCloud = { request, enabled, inTelegram, deviceId, native: nativeNet };
window.scheduleScores = { enabled, inTelegram, nick, needNick, setNick, submit, top, flush, hasPending: () => Object.keys(pending()).length > 0 };
})();
;
/* js/motion.js */
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
;
/* js/navigation.js */
(() => {
const screens = {home:document.getElementById('home-screen'),schedule:document.getElementById('schedule-screen'),calendar:document.getElementById('calendar-screen'),game:document.getElementById('game-screen'),settings:document.getElementById('settings-screen'),homework:document.getElementById('homework-screen')};
const titles={home:'app.name',schedule:'app.title',calendar:'nav.calendar',game:'nav.game',settings:'nav.settings',homework:'nav.homework'};
const announcements={home:'nav.home',schedule:'nav.openedSchedule',calendar:'nav.openedCalendar',game:'nav.openedGame',settings:'nav.openedSettings',homework:'nav.openedHomework'};
const heading=document.getElementById('page-title');
const back=document.getElementById('back-menu');
const eyebrow=document.getElementById('header-eyebrow');
const t=(key)=>window.scheduleI18n.t(key);
let current='home';
let depth=0; // сколько экранов открыто поверх главного (записи в истории браузера)
function refreshLabels(){
  heading.textContent=t(titles[current]);
  document.getElementById('subtitle').textContent=t('app.subtitle');
  document.getElementById('screen-status').textContent=t(announcements[current]);
}
function navigate(next,focus=true,fromHistory=false){
  if(!screens[next])return;
  if(!fromHistory&&next!=='home'){depth+=1;try{history.pushState({screen:next,depth},'');}catch(_){}}
  if(current==='game'&&(window.scheduleArcade||window.scheduleGame))(window.scheduleArcade||window.scheduleGame).deactivate();
  current=next;
  for(const [key,screen] of Object.entries(screens))screen.hidden=key!==next;
  document.body.dataset.screen=next;
  back.hidden=next==='home';
  eyebrow.hidden=next!=='home';
  refreshLabels();
  window.scrollTo(0,0);
  if(focus)heading.focus({preventScroll:true});
  if(next==='game'){
    // игры подгружаются при первом открытии (boot.js); в сборке без загрузчика они уже на месте
    const open=()=>{const g=window.scheduleArcade||window.scheduleGame;if(g&&current==='game')g.activate();};
    if(window.scheduleArcade||window.scheduleGame||!window.scheduleLazy)open();else window.scheduleLazy.load('game').then(open,()=>{});
  }
  if(window.interfaceMotion)window.interfaceMotion.enter(screens[next],(next==='home'||fromHistory)?'back':'forward');
  syncTelegramBack();
}
const setScheduleMode=mode=>{const button=document.querySelector('#schedule-modes [data-value="'+mode+'"]');if(button)button.click();};
// The regular timetable is the only default mode; the RK1 view opens solely from the academic calendar.
document.querySelectorAll('[data-open-screen]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.openScreen==='schedule')setScheduleMode('regular');
  navigate(button.dataset.openScreen);
}));
document.querySelectorAll('[data-open-assessment]').forEach(button=>button.addEventListener('click',()=>{
  setScheduleMode('rk1');
  document.querySelector('#days [data-value="week"]').click();
  navigate('schedule');
}));
const exitAssessment=document.getElementById('assessment-exit');
if(exitAssessment)exitAssessment.addEventListener('click',()=>setScheduleMode('regular'));
// «Назад»: жест/кнопка системы и кнопка Telegram возвращают на предыдущий экран, а не закрывают приложение
function goHome(){
  if(current==='home')return false;
  if(depth>0){try{history.go(-depth);return true;}catch(_){}}
  depth=0;navigate('home',true,true);return true;
}
window.addEventListener('popstate',event=>{
  const st=event.state;
  if(st&&st.screen&&screens[st.screen]){depth=st.depth||1;navigate(st.screen,false,true);}
  else{depth=0;navigate('home',false,true);}
});
function syncTelegramBack(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg||!tg.BackButton)return;
  try{if(current==='home')tg.BackButton.hide();else tg.BackButton.show();}catch(_){}
}
let tgBound=false;
function bindTelegram(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg||!tg.BackButton||tgBound)return;
  tgBound=true;
  try{tg.BackButton.onClick(()=>{if(depth>1){history.back();}else goHome();});}catch(_){}
  syncTelegramBack();
}
document.addEventListener('telegram:ready',bindTelegram);
bindTelegram();
back.addEventListener('click',goHome);
window.appNavigateBack=()=>goHome();
window.scheduleApp={navigate,getScreen:()=>current};
// Внешние ссылки (Moodle, Platonus, ссылки из д/з) не должны уводить само приложение со страницы:
// в Telegram открываем через openLink (внешний браузер), на сайте/PWA — в новой вкладке. В APK это делает Android-часть.
document.addEventListener('click',event=>{
  const a=event.target.closest&&event.target.closest('a[href]');
  if(!a||window.AppPreferences||event.defaultPrevented)return;
  let url;try{url=new URL(a.href,location.href);}catch(_){return;}
  if(url.origin===location.origin||(url.protocol!=='https:'&&url.protocol!=='http:'))return;
  const tg=window.Telegram&&window.Telegram.WebApp;
  if(tg&&typeof tg.openLink==='function'){
    event.preventDefault();
    try{tg.openLink(url.toString());}catch(_){window.open(url.toString(),'_blank','noopener');}
  }else{a.target='_blank';a.rel='noopener noreferrer';}
});
window.addEventListener('language:change',refreshLabels);
navigate('home',false);
})();
;
/* js/homework.js */
(() => {
'use strict';
/* Домашние задания: показ в карточках пар (всем) и форма для редакторов (Mini App в Telegram).
   Данные — из облака (Cloudflare Worker). Адрес — data/app-config.json (cloudUrl); пусто — функция выключена. */
const i18n = window.scheduleI18n;
const t = (k, p) => i18n.t(k, p);
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const config = read('app-config') || {};
const cloud = String(config.cloudUrl || '').replace(/\/+$/, '');
if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud)) return; // http — только для локальной отладки

const bridge = window.AppPreferences;
const nativeApp = !!(bridge && typeof bridge.refreshHomework === 'function'); // в APK данные получает Android-часть
const data = read('schedule-data');
const CACHE_KEY = 'schedule-homework-cache' + (window.scheduleClass && !window.scheduleClass.isDefault ? ':' + window.scheduleClass.id : '');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const clock = v => { const p = String(v || '').trim().split(':'); return p.length === 2 ? p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0') : String(v || ''); };
const keyOf = (day, start, subject, group) => [day, clock(start), subject, group || 'Общее'].join('|');
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayIso = () => isoDate(new Date());
const locale = () => ({ ru: 'ru-RU', en: 'en-GB' }[i18n.getLanguage()] || 'ru-RU');

// личные отметки «сделано»: только на этом устройстве, по id задания
const DONE_KEY = 'schedule-hw-done';
const DL = {
  ru: { done: 'Сделано', undone: 'Вернуть', markDone: 'Отметить как сделанное', markUndone: 'Снять отметку «сделано»' },
  en: { done: 'Done', undone: 'Undo', markDone: 'Mark as done', markUndone: 'Remove the done mark' },
};
const dt = k => (DL[i18n.getLanguage()] || DL.ru)[k];
const doneSet = (() => { try { const a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (_) { return new Set(); } })();
const isDone = i => doneSet.has(i.id);
function syncDoneToApp() { try { if (bridge && typeof bridge.setHomeworkDone === 'function') bridge.setHomeworkDone(JSON.stringify([...doneSet])); } catch (_) {} } // виджету д/з нужны отметки
function saveDone() { try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneSet])); } catch (_) {} syncDoneToApp(); }
let justToggled = null; // id задания, у которого только что нажали «Сделано» (кнопка при перерисовке получает «хлопок»)
function setDone(i, on) {
  if (on) doneSet.add(i.id); else doneSet.delete(i.id);
  saveDone();
  justToggled = i.id; setTimeout(() => { justToggled = null; }, 700);
  document.dispatchEvent(new CustomEvent('hw:done-change'));
  // отмеченное задание на главной сначала плавно сворачивается, потом список перерисовывается
  const row = on ? document.querySelector('.hw-home-row[data-hw="' + i.id + '"]') : null;
  const motion = document.documentElement.dataset.anim;
  if (row && motion && motion !== 'off' && row.animate) {
    row.style.overflow = 'hidden';
    row.animate([{ opacity: 1, maxHeight: row.offsetHeight + 'px', transform: 'translateX(0)' }, { opacity: 0, maxHeight: '0px', paddingTop: '0px', paddingBottom: '0px', transform: 'translateX(40px)' }], { duration: 280, easing: 'ease-in', fill: 'forwards' }).finished.then(render).catch(render);
  } else render();
}
function pruneDone() { // отметки к удалённым заданиям не копим
  const ids = new Set(items.map(i => i.id)); let changed = false;
  for (const id of [...doneSet]) if (!ids.has(id)) { doneSet.delete(id); changed = true; }
  if (changed) saveDone();
}
function checkButton(i) {
  const on = isDone(i);
  const b = el('button', 'hw-check' + (on ? ' on' : '') + (justToggled === i.id ? ' pop' : ''), on ? '✓ ' + dt('done') : '○ ' + dt('done'));
  b.type = 'button'; b.setAttribute('aria-pressed', String(on)); b.title = on ? dt('markUndone') : dt('markDone');
  b.addEventListener('click', e => { e.stopPropagation(); setDone(i, !on); });
  return b;
}

let items = [];
let role = null; // 'owner' | 'headman' | 'editor' | 'reader' | null
let me = null;   // ответ /api/me (роль, подписка, запрошены ли права)
let initData = '';
let editingId = null;

// ---------- загрузка ----------
function headers() {
  const h = { accept: 'application/json' };
  if (initData) h['x-telegram-init-data'] = initData;
  return h;
}
async function loadItems() {
  // сначала показываем сохранённое (экран не прыгает), затем обновляем из сети
  if (!items.length) { try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved) && saved.length) { items = saved; render(); } } catch (_) {} }
  try {
    const url = nativeApp ? './data/homework.json' : cloud + '/api/homework' + (window.scheduleClass ? window.scheduleClass.query() : '');
    const r = await fetch(url, { headers: nativeApp ? {} : headers(), cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error('format');
    items = list;
    const at = Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); localStorage.setItem(CACHE_KEY + '-at', String(at)); } catch (_) {}
    pruneDone();
    window.scheduleCloudStatus = { ok: true, at }; window.dispatchEvent(new CustomEvent('cloud:status', { detail: window.scheduleCloudStatus }));
  } catch (_) {
    let at = 0;
    try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) items = saved; at = Number(localStorage.getItem(CACHE_KEY + '-at')) || 0; } catch (__) {}
    window.scheduleCloudStatus = { ok: false, at }; window.dispatchEvent(new CustomEvent('cloud:status', { detail: window.scheduleCloudStatus }));
  }
  render();
}
async function loadMe() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  initData = tg.initData;
  try {
    const r = await fetch(cloud + '/api/me', { headers: headers() });
    if (r.ok) { me = await r.json(); role = me.role; }
  } catch (_) {}
  const can = role === 'owner' || role === 'headman' || role === 'editor';
  const card = document.getElementById('hw-menu-card');
  if (card) card.hidden = !can;
  if (can) { await loadItems(); buildForm(); }
  window.dispatchEvent(new CustomEvent('role:change', { detail: { role, me } }));
}

// ---------- показ в карточках ----------
function safeLink(href) {
  try { const u = new URL(href); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch (_) { return null; }
}
function dateText(iso) {
  const d = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(d);
}
const authorLine = item => el('p', 'hw-author', t('hw.addedBy', { name: item.author }));
function block(item) {
  const past = item.due < todayIso();
  const box = el('div', 'hw-block' + (past ? ' hw-past' : '') + (isDone(item) ? ' hw-done' : ''));
  const head = el('div', 'hw-head');
  head.append(el('span', 'hw-badge', '✎'), el('strong', '', t('hw.dueTo', { date: dateText(item.due) })));
  if (past) head.append(el('span', 'hw-late', t('hw.past')));
  else head.append(checkButton(item));
  box.append(head, el('p', 'hw-text', item.text));
  if (item.author) box.append(authorLine(item));
  for (const raw of item.links || []) {
    const href = safeLink(raw);
    if (!href) continue;
    const a = el('a', 'hw-link', new URL(href).hostname);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = t('hw.openLink');
    box.append(a);
  }
  return box;
}
// Карточка «Ближайшее д/з» на главной: свёрнута по умолчанию, внутри только актуальные задания (срок не прошёл)
const HOME_OPEN_KEY = 'schedule-hw-open';
let lastCount = null; // число заданий в карточке на главной (при изменении цифра «подпрыгивает»)
function renderHome() {
  const home = document.getElementById('home-screen');
  if (!home) return;
  const wasOpen = (() => { try { return localStorage.getItem(HOME_OPEN_KEY) === '1'; } catch (_) { return false; } })();
  home.querySelectorAll('.hw-home').forEach(n => n.remove());
  const today = todayIso();
  const names = new Map(), ends = new Map();
  if (data) for (const e of data.events) { const k = keyOf(e.day, e.start, e.subject, e.group); names.set(k, i18n.content('subjects', e.subject)); ends.set(k, clock(e.end)); }
  // актуально: срок в будущем, а на сегодня — пока пара ещё не закончилась (без времени окончания — до конца дня)
  const now = new Date(), nowClock = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const actual = items.filter(i => !isDone(i) && (i.due > today || (i.due === today && (!ends.get(i.lesson) || ends.get(i.lesson) > nowClock))))
    .sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
  if (!actual.length) return;
  const box = el('details', 'hw-home');
  box.open = wasOpen;
  const sum = el('summary', 'hw-home-summary');
  const count = el('span', 'hw-count' + (lastCount !== null && lastCount !== actual.length ? ' bump' : ''), String(actual.length));
  lastCount = actual.length;
  sum.append(el('span', 'hw-badge', '✎'), el('strong', '', t('hw.homeTitle')), count);
  box.append(sum);
  box.addEventListener('toggle', () => { try { localStorage.setItem(HOME_OPEN_KEY, box.open ? '1' : '0'); } catch (_) {} });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  for (const i of actual.slice(0, 8)) {
    const row = el('div', 'hw-home-row'); row.dataset.hw = i.id;
    const when = i.due === today ? t('hw.todayWord') : i.due === isoDate(tomorrow) ? t('hw.tomorrowWord') : dateText(i.due);
    const top = el('div', 'hw-home-top');
    top.append(el('strong', '', (names.get(i.lesson) || i.lesson.split('|')[2] || '') + ' — ' + when), checkButton(i));
    row.append(top, el('p', 'hw-text', i.text));
    if (i.author) row.append(authorLine(i));
    for (const raw of i.links || []) {
      const href = safeLink(raw);
      if (!href) continue;
      const a = el('a', 'hw-link', new URL(href).hostname); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      row.append(a);
    }
    box.append(row);
  }
  const next = home.querySelector('.fork-next-card');
  const grid = home.querySelector('.menu-grid');
  if (next) next.after(box); else if (grid) grid.before(box); else home.append(box);
}

function render() {
  renderHome();
  const cards = document.querySelectorAll('#schedule .lesson');
  cards.forEach(card => card.querySelectorAll('.hw-block').forEach(b => b.remove()));
  if (!items.length) { renderList(); return; }
  cards.forEach(card => {
    if (card.dataset.source === 'assessment') return;
    const key = keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group);
    const mine = items.filter(i => i.lesson === key);
    if (!mine.length) return;
    const holder = card.querySelector('.details') || card;
    mine.forEach(i => holder.append(block(i)));
  });
  renderList();
}
document.addEventListener('schedule:render', render);
window.addEventListener('load', () => setTimeout(renderHome, 600));
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHome(); });
setInterval(() => { if (!document.hidden) renderHome(); }, 60000); // задания исчезают, как только пара закончилась
window.addEventListener('language:change', () => { render(); if (formBuilt) buildForm(); });
window.scheduleHomeworkDone = { isDone, count: () => items.filter(i => !isDone(i) && i.due >= todayIso()).length };

// ---------- форма редактора ----------
const root = document.getElementById('homework-screen');
let formBuilt = false;
function lessonOptions() {
  if (!data) return [];
  const seen = new Set(); const out = [];
  for (const e of data.events) {
    if (e.source === 'assessment') continue;
    const k = keyOf(e.day, e.start, e.subject, e.group);
    if (seen.has(k)) continue;
    seen.add(k);
    const g = e.group && e.group !== 'Общее' ? ' (' + i18n.group(e.group) + ')' : '';
    out.push({ key: k, day: e.day, start: clock(e.start), label: i18n.day(e.day, true) + ' ' + clock(e.start) + ' · ' + i18n.content('subjects', e.subject) + g });
  }
  const order = data.days || [];
  return out.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || a.start.localeCompare(b.start));
}
function nextDateFor(dayName) {
  const idx = (data.days || []).indexOf(dayName); // понедельник = 0
  if (idx < 0) return todayIso();
  const d = new Date();
  for (let i = 0; i < 14; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return isoDate(d);
}
function field(labelKey, control) {
  const wrap = el('label', 'hw-field');
  wrap.append(el('span', 'hw-label', t(labelKey)), control);
  return wrap;
}
let refs = {};
function buildForm() {
  if (!root || !(role === 'owner' || role === 'headman' || role === 'editor')) return;
  formBuilt = true;
  root.replaceChildren();
  const card = el('section', 'hw-card');
  const title = el('h2', 'hw-title', t(editingId ? 'hw.editTitle' : 'hw.formTitle'));
  const lesson = el('select', 'hw-input');
  const opts = lessonOptions();
  opts.forEach(o => { const op = el('option', '', o.label); op.value = o.key; lesson.append(op); });
  const due = el('input', 'hw-input'); due.type = 'date';
  due.min = todayIso(); const max = new Date(); max.setDate(max.getDate() + 14); due.max = isoDate(max); due.value = opts[0] ? nextDateFor(opts[0].day) : todayIso();
  lesson.addEventListener('change', () => { const o = opts.find(x => x.key === lesson.value); if (o) due.value = nextDateFor(o.day); });
  const text = el('textarea', 'hw-input'); text.rows = 4; text.maxLength = 1000; text.placeholder = t('hw.textPh');
  const links = el('textarea', 'hw-input'); links.rows = 3; links.placeholder = 'https://…';
  const status = el('p', 'hw-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'choice hw-save', t(editingId ? 'hw.save' : 'hw.add')); save.type = 'button';
  const cancel = el('button', 'choice hw-cancel', t('hw.cancel')); cancel.type = 'button'; cancel.hidden = !editingId;
  const actions = el('div', 'hw-actions'); actions.append(save, cancel);
  const editing = editingId ? items.find(i => i.id === editingId) : null;
  card.append(title, field('hw.lesson', lesson), field('hw.due', due), field('hw.text', text), field('hw.links', links), actions, status, el('p', 'hw-hint', t('hw.hint')));
  const list = el('section', 'hw-card hw-list');
  root.append(card, list);
  refs = { lesson, due, text, links, status, save, cancel, title, list };

  save.addEventListener('click', submit);
  cancel.addEventListener('click', () => { editingId = null; buildForm(); });
  renderList();
}
function setStatus(msg, bad) { if (refs.status) { refs.status.textContent = msg || ''; refs.status.classList.toggle('hw-bad', !!bad); } }
function describeError(status, body) {
  if (status === 403) return t('hw.errForbidden');
  if (status === 429) return t('hw.errRate');
  const f = (body && body.fields) || [];
  if (f.includes('due-range')) return t('hw.errRange');
  if (f.includes('link') || f.includes('links-count')) return t('hw.errLink');
  if (status === 400) return t('hw.errInvalid');
  return t('hw.errNet');
}
async function submit() {
  const payload = {
    lesson: refs.lesson.value, due: refs.due.value, text: refs.text.value,
    links: refs.links.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
  };
  refs.save.disabled = true; setStatus('');
  try {
    const url = cloud + '/api/homework' + (editingId ? '/' + editingId : '');
    const r = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus(describeError(r.status, body), true); return; }
    editingId = null;
    await loadItems(); buildForm(); setStatus(t('hw.saved'));
  } catch (_) { setStatus(t('hw.errNet'), true); }
  finally { if (refs.save) refs.save.disabled = false; }
}
function renderList() {
  if (!refs.list) return;
  refs.list.replaceChildren(el('h2', 'hw-title', t('hw.active')));
  const mine = items.filter(i => i.editable);
  if (!mine.length) { refs.list.append(el('p', 'hw-hint', t('hw.empty'))); return; }
  const names = new Map(lessonOptions().map(o => [o.key, o.label]));
  for (const i of mine) {
    const row = el('article', 'hw-row');
    row.append(el('strong', '', names.get(i.lesson) || i.lesson.split('|').slice(0, 3).join(' · ')), el('span', 'hw-due', t('hw.dueTo', { date: dateText(i.due) })), el('p', 'hw-text', i.text));
    if (i.author) row.append(authorLine(i));
    const edit = el('button', 'choice', t('hw.edit')); edit.type = 'button';
    const del = el('button', 'choice', t('hw.delete')); del.type = 'button';
    edit.addEventListener('click', () => {
      editingId = i.id; buildForm();
      refs.lesson.value = i.lesson; refs.due.value = i.due; refs.text.value = i.text; refs.links.value = (i.links || []).join('\n');
      window.scrollTo(0, 0);
    });
    del.addEventListener('click', async () => {
      if (!window.confirm(t('hw.confirmDelete'))) return;
      try {
        const r = await fetch(cloud + '/api/homework/' + i.id, { method: 'DELETE', headers: headers() });
        if (!r.ok) { setStatus(describeError(r.status), true); return; }
        await loadItems(); setStatus(t('hw.deleted'));
      } catch (_) { setStatus(t('hw.errNet'), true); }
    });
    const actions = el('div', 'hw-actions'); actions.append(edit, del);
    row.append(actions);
    refs.list.append(row);
  }
}

// ---------- запуск ----------
// карточка д/з всегда идёт сразу после карточки «Следующая пара» (её добавляет home.js чуть позже)
{
  const home = document.getElementById('home-screen');
  if (home) new MutationObserver(() => {
    const box = home.querySelector('.hw-home'), next = home.querySelector('.fork-next-card');
    if (box && next && next.nextElementSibling !== box) next.after(box);
  }).observe(home, { childList: true });
}
// быстрое добавление из карточки пары: создаёт задание; возвращает { ok, status, body }
async function createHomework(payload) {
  const r = await fetch(cloud + '/api/homework', { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, body, message: describeError(r.status, body) };
  await loadItems();
  return { ok: true, status: r.status, body };
}
window.scheduleHomework = {
  reload: loadItems, role: () => role, me: () => me, cloud, headers, nativeApp, createHomework,
  nextDateFor: day => (data ? nextDateFor(day) : todayIso()), keyOf, todayIso, isoDate, items: () => items,
  setMe(patch) { me = { ...(me || {}), ...patch }; },
};
if (nativeApp) { try { bridge.refreshHomework(); } catch (_) {} syncDoneToApp(); }
loadItems();
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) loadMe();
else document.addEventListener('telegram:ready', loadMe, { once: true });
})();
;
/* js/overrides.js */
(() => {
'use strict';
/* Изменения в расписании на конкретную дату (отмена пары, другая аудитория, преподаватель, перенос, заметка).
   Данные — из облака (/api/overrides), в APK их скачивает Android-часть. Показ: метки в карточках пар, «следующая пара» на главной. */
const i18n = window.scheduleI18n;
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const config = read('app-config') || {};
const cloud = String(config.cloudUrl || '').replace(/\/+$/, '');
if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cloud)) return;
const data = read('schedule-data');
if (!data) return;
const bridge = window.AppPreferences;
const nativeApp = !!(bridge && typeof bridge.refreshHomework === 'function');
const CACHE_KEY = 'schedule-overrides-cache' + (window.scheduleClass && !window.scheduleClass.isDefault ? ':' + window.scheduleClass.id : '');

const L = {
  ru: { cancel: 'Пара отменена', room: 'Аудитория: {v}', was: 'было {v}', teacher: 'Преподаватель: {v}', move: 'Перенос: {v}' },
  en: { cancel: 'Class cancelled', room: 'Room: {v}', was: 'was {v}', teacher: 'Teacher: {v}', move: 'Moved: {v}' },
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, v) => String((L[lang()] || L.ru)[k]).replace('{v}', v === undefined ? '' : v);
const locale = () => ({ ru: 'ru-RU', en: 'en-GB' }[lang()] || 'ru-RU');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const clock = v => { const p = String(v || '').trim().split(':'); return p.length === 2 ? p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0') : String(v || ''); };
const keyOf = (day, start, subject, group) => [day, clock(start), subject, group || 'Общее'].join('|');

// ближайшая дата (сегодня или позже) для дня недели из расписания
function nextDate(dayName) {
  const idx = (data.days || []).indexOf(dayName);
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (idx >= 0) for (let i = 0; i < 7; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return d;
}

let list = [];
const find = (key, iso) => list.filter(o => o.lesson === key && o.date === iso);
const forEvent = (event, date) => find(keyOf(event.day, event.start, event.subject, event.group), isoOf(date));

function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}
function chipText(o) {
  if (o.kind === 'cancel') return tr('cancel');
  if (o.kind === 'room') return tr('room', o.value);
  if (o.kind === 'teacher') return tr('teacher', o.value);
  if (o.kind === 'move') return tr('move', o.value);
  return o.value;
}

function apply() {
  const today = isoOf(new Date());
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    card.querySelectorAll('.ov-box').forEach(n => n.remove());
    card.classList.remove('ov-cancelled');
    const roomNode = card.querySelector('.detail.room');
    if (roomNode) { if (roomNode.dataset.orig === undefined) roomNode.dataset.orig = roomNode.textContent; roomNode.textContent = roomNode.dataset.orig; roomNode.classList.remove('ov-changed'); }
    if (card.dataset.source === 'assessment') continue;
    const date = isoOf(nextDate(card.dataset.day));
    const mine = find(keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group), date);
    if (!mine.length) continue;
    const box = el('div', 'ov-box');
    for (const o of mine) {
      const chip = el('span', 'ov-chip ov-' + o.kind, (date !== today ? dateLabel(date) + ' · ' : '') + chipText(o));
      if (o.kind === 'room' && roomNode) {
        chip.textContent = (date !== today ? dateLabel(date) + ' · ' : '') + tr('room', o.value) + ' (' + tr('was', roomNode.dataset.orig.replace(/^\S+\s/, '')) + ')';
      }
      box.append(chip);
    }
    if (mine.some(o => o.kind === 'cancel')) card.classList.add('ov-cancelled');
    const room = mine.find(o => o.kind === 'room');
    if (room && roomNode) { roomNode.textContent = roomNode.dataset.orig.replace(/\S+$/, room.value); roomNode.classList.add('ov-changed'); }
    const details = card.querySelector('.details');
    if (details) details.prepend(box); else card.append(box);
  }
}

async function reload() {
  try {
    const r = await fetch(nativeApp ? './data/overrides.json' : cloud + '/api/overrides' + (window.scheduleClass ? window.scheduleClass.query() : ''), { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const arr = await r.json();
    if (!Array.isArray(arr)) throw new Error('format');
    list = arr;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(arr)); } catch (_) {}
  } catch (_) {
    if (!list.length) { try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) list = saved; } catch (__) {} }
  }
  apply();
  document.dispatchEvent(new CustomEvent('overrides:change'));
}

window.scheduleOverrides = {
  items: () => list, reload, nextDate, keyOf, isoOf, clock,
  forEvent,
  cancelled: (event, date) => forEvent(event, date).some(o => o.kind === 'cancel'),
  roomFor: (event, date) => { const o = forEvent(event, date).find(x => x.kind === 'room'); return o ? o.value : ''; },
  forLesson: key => list.filter(o => o.lesson === key),
  chipText, dateLabel,
};

document.addEventListener('schedule:render', apply);
window.addEventListener('language:change', apply);
document.addEventListener('visibilitychange', () => { if (!document.hidden) reload(); });
setInterval(() => { if (!document.hidden) reload(); }, 5 * 60 * 1000);
try { const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); if (Array.isArray(saved)) list = saved; } catch (_) {}
apply();
reload();
})();
;
/* js/editor.js */
(() => {
'use strict';
/* Для редакторов и владельца (вход через Telegram Mini App): кнопки на карточке пары — «＋ д/з» и «⋯ Изменить» (отмена, замена аудитории и т.д.).
   Для всех: раздел «Мой доступ» в настройках. */
const hw = window.scheduleHomework;
const i18n = window.scheduleI18n;
if (!hw || !i18n) return;
const ov = () => window.scheduleOverrides;

const L = {
  ru: {
    addHw: '＋ Д/з', change: '⋯ Изменить', sheetHw: 'Новое д/з', sheetOv: 'Изменить пару', date: 'Дата', due: 'Срок сдачи', text: 'Текст задания', textPh: 'Что задано', links: 'Ссылки (по одной в строке)',
    save: 'Сохранить', close: 'Закрыть', kind: 'Что изменилось', kCancel: 'Пара отменена', kRoom: 'Другая аудитория', kTeacher: 'Другой преподаватель', kMove: 'Перенос', kNote: 'Заметка',
    pRoom: 'Номер аудитории', pTeacher: 'Кто ведёт', pMove: 'Куда и когда перенесли', pNote: 'Текст заметки', existing: 'Уже стоит', remove: 'Снять',
    saved: 'Сохранено', removed: 'Снято', hwSaved: 'Задание добавлено',
    errNet: 'Нет связи с облаком. Попробуйте ещё раз.', errForbidden: 'Нет прав на это действие.', errRate: 'Слишком много действий, попробуйте позже.', errRange: 'Дата должна быть в ближайшие 14 дней.', errInvalid: 'Проверьте поля.',
    accessTitle: 'Мой доступ', role: 'Роль', rReader: 'Читатель', rEditor: 'Редактор', rHeadman: 'Староста', rOwner: 'Владелец', rNone: 'Доступ не одобрен', sub: 'Напоминания о парах в Telegram', subNote: 'Бот напишет за 5 минут до начала пары. Включаете только вы.',
    request: 'Запросить права редактора', requested: 'Запрос отправлен владельцу. Ответ придёт в Telegram.', requestWait: 'Запрос уже отправлен, повторить можно через сутки.', editorNote: 'Вы можете отмечать изменения прямо в карточках пар и добавлять д/з.',
  },
  en: {
    addHw: '＋ Homework', change: '⋯ Change', sheetHw: 'New homework', sheetOv: 'Change this class', date: 'Date', due: 'Due date', text: 'Task', textPh: 'What was assigned', links: 'Links (one per line)',
    save: 'Save', close: 'Close', kind: 'What changed', kCancel: 'Class cancelled', kRoom: 'Different room', kTeacher: 'Different teacher', kMove: 'Moved', kNote: 'Note',
    pRoom: 'Room number', pTeacher: 'Who teaches', pMove: 'Where and when', pNote: 'Note text', existing: 'Already set', remove: 'Remove',
    saved: 'Saved', removed: 'Removed', hwSaved: 'Homework added',
    errNet: 'No connection to the cloud. Try again.', errForbidden: 'You are not allowed to do this.', errRate: 'Too many actions, try again later.', errRange: 'The date must be within the next 14 days.', errInvalid: 'Check the fields.',
    accessTitle: 'My access', role: 'Role', rReader: 'Reader', rEditor: 'Editor', rHeadman: 'Class representative', rOwner: 'Owner', rNone: 'Access not approved', sub: 'Class reminders in Telegram', subNote: 'The bot messages you 5 minutes before a class. Only you turn it on.',
    request: 'Request editor access', requested: 'Request sent to the owner. The answer will come in Telegram.', requestWait: 'Already requested; you can ask again in a day.', editorNote: 'You can mark changes right on class cards and add homework.',
  },
};
const lang = () => i18n.getLanguage() || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k] ?? L.ru[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const toast = (text, opts) => (window.scheduleToast ? window.scheduleToast(text, opts) : null);
const canEdit = () => ['owner', 'headman', 'editor'].includes(hw.role());
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

async function api(method, path, body) {
  const r = await fetch(hw.cloud + path, { method, headers: { ...hw.headers(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: json };
}
function errorText(res) {
  if (res.status === 403) return tr('errForbidden');
  if (res.status === 429) return tr('errRate');
  const f = (res.body && res.body.fields) || [];
  if (f.includes('date-range') || f.includes('due-range')) return tr('errRange');
  if (res.status === 400) return tr('errInvalid');
  return tr('errNet');
}

// ---------- окно (sheet) ----------
function openSheet(title) {
  const back = el('div', 'ed-back');
  const box = el('div', 'ed-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title); box.tabIndex = -1;
  const head = el('div', 'ed-head'); const h = el('h2', '', title);
  const x = el('button', 'ed-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close'));
  head.append(h, x);
  const body = el('div', 'ed-body');
  box.append(head, body); back.append(box); document.body.append(back);
  document.body.classList.add('ed-open');
  const close = () => { back.remove(); document.body.classList.remove('ed-open'); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  x.addEventListener('click', close); document.addEventListener('keydown', onKey);
  box.focus();
  return { body, close };
}
const field = (label, control) => { const w = el('label', 'ed-field'); w.append(el('span', 'ed-label', label), control); return w; };
const input = (type, cls = 'ed-input') => { const n = el('input', cls); n.type = type; return n; };

// ---------- «＋ д/з» ----------
function openHomeworkSheet(card) {
  const sheet = openSheet(tr('sheetHw'));
  const subject = el('p', 'ed-sub', i18n.content('subjects', card.dataset.subject) + ' · ' + card.dataset.start);
  const due = input('date'); const today = new Date(); due.min = iso(today); const max = new Date(); max.setDate(max.getDate() + 14); due.max = iso(max);
  due.value = hw.nextDateFor(card.dataset.day);
  const text = el('textarea', 'ed-input'); text.rows = 4; text.maxLength = 1000; text.placeholder = tr('textPh');
  const links = el('textarea', 'ed-input'); links.rows = 2; links.placeholder = 'https://…';
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'ed-primary', tr('save')); save.type = 'button';
  sheet.body.append(subject, field(tr('due'), due), field(tr('text'), text), field(tr('links'), links), status, save);
  text.focus();
  save.addEventListener('click', async () => {
    status.textContent = ''; status.classList.remove('bad');
    save.disabled = true;
    try {
      const res = await hw.createHomework({
        lesson: hw.keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group), due: due.value, text: text.value,
        links: links.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      });
      if (!res.ok) { status.textContent = res.message || errorText(res); status.classList.add('bad'); return; }
      sheet.close();
      toast(tr('hwSaved'));
    } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); }
    finally { save.disabled = false; }
  });
}

// ---------- «⋯ Изменить» ----------
const KINDS = ['cancel', 'room', 'teacher', 'move', 'note'];
const KIND_LABEL = { cancel: 'kCancel', room: 'kRoom', teacher: 'kTeacher', move: 'kMove', note: 'kNote' };
const KIND_PH = { room: 'pRoom', teacher: 'pTeacher', move: 'pMove', note: 'pNote' };

function openOverrideSheet(card) {
  const O = ov(); if (!O) return;
  const sheet = openSheet(tr('sheetOv'));
  const key = O.keyOf(card.dataset.day, card.dataset.start, card.dataset.subject, card.dataset.group);
  sheet.body.append(el('p', 'ed-sub', i18n.content('subjects', card.dataset.subject) + ' · ' + card.dataset.start));

  const date = input('date'); date.min = iso(new Date()); const max = new Date(); max.setDate(max.getDate() + 14); date.max = iso(max);
  date.value = O.isoOf(O.nextDate(card.dataset.day));
  let kind = 'cancel';
  const chips = el('div', 'ed-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', tr('kind'));
  const value = input('text'); value.maxLength = 80; value.hidden = true;
  const valueWrap = field('', value); valueWrap.hidden = true;
  const paint = () => {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    valueWrap.hidden = kind === 'cancel';
    if (kind !== 'cancel') { value.hidden = false; value.placeholder = tr(KIND_PH[kind]); valueWrap.firstChild.textContent = tr(KIND_LABEL[kind]); }
  };
  for (const k of KINDS) { const b = el('button', 'ed-chip', tr(KIND_LABEL[k])); b.type = 'button'; b.dataset.kind = k; b.addEventListener('click', () => { kind = k; paint(); if (k !== 'cancel') value.focus(); }); chips.append(b); }
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const save = el('button', 'ed-primary', tr('save')); save.type = 'button';
  sheet.body.append(field(tr('date'), date), chips, valueWrap, status, save);

  const existing = el('div', 'ed-existing');
  const paintExisting = () => {
    existing.replaceChildren();
    const mine = O.forLesson(key);
    if (!mine.length) return;
    existing.append(el('h3', 'ed-sub', tr('existing')));
    for (const o of mine) {
      const row = el('div', 'ed-row');
      row.append(el('span', '', O.dateLabel(o.date) + ' · ' + O.chipText(o)));
      const rm = el('button', 'ed-ghost', tr('remove')); rm.type = 'button';
      rm.addEventListener('click', async () => {
        rm.disabled = true;
        try {
          const res = await api('DELETE', '/api/overrides/' + o.id + '');
          if (!res.ok) { status.textContent = errorText(res); status.classList.add('bad'); rm.disabled = false; return; }
          await O.reload(); paintExisting(); status.textContent = tr('removed'); status.classList.remove('bad');
        } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); rm.disabled = false; }
      });
      row.append(rm); existing.append(row);
    }
  };
  sheet.body.append(existing); paint(); paintExisting();

  save.addEventListener('click', async () => {
    status.textContent = ''; status.classList.remove('bad'); save.disabled = true;
    try {
      const res = await api('POST', '/api/overrides', { lesson: key, date: date.value, kind, value: kind === 'cancel' ? '' : value.value });
      if (!res.ok) { status.textContent = errorText(res); status.classList.add('bad'); return; }
      await O.reload();
      sheet.close();
      toast(tr('saved'));
    } catch (_) { status.textContent = tr('errNet'); status.classList.add('bad'); }
    finally { save.disabled = false; }
  });
}

// ---------- кнопки на карточках ----------
function addTools() {
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    const old = card.querySelector('.lesson-tools');
    if (!canEdit() || card.dataset.source === 'assessment') { if (old) old.remove(); continue; }
    if (old) continue;
    const row = el('div', 'lesson-tools');
    const add = el('button', 'ed-tool', tr('addHw')); add.type = 'button';
    const change = el('button', 'ed-tool', tr('change')); change.type = 'button';
    add.addEventListener('click', e => { e.stopPropagation(); openHomeworkSheet(card); });
    change.addEventListener('click', e => { e.stopPropagation(); openOverrideSheet(card); });
    row.append(add, change); card.append(row);
  }
}
document.addEventListener('schedule:render', addTools);
window.addEventListener('language:change', () => { document.querySelectorAll('.lesson-tools').forEach(n => n.remove()); addTools(); paintAccess(); });

// ---------- «Мой доступ» ----------
let accessBox = null, accessRows = null;
function buildAccess() {
  const settings = document.getElementById('settings-screen');
  if (!settings || accessBox) return;
  accessBox = el('section', 'settings-group'); accessBox.id = 'access-settings';
  accessBox.append(el('h2', '', ''));
  accessRows = el('div', 'ed-access');
  accessBox.append(accessRows);
  const notify = document.getElementById('notify-settings');
  if (notify) notify.before(accessBox); else settings.append(accessBox);
}
function roleLabel(role) { return role === 'owner' ? tr('rOwner') : role === 'headman' ? tr('rHeadman') : role === 'editor' ? tr('rEditor') : role === 'reader' ? tr('rReader') : tr('rNone'); }
function paintAccess() {
  buildAccess();
  if (!accessBox) return;
  accessBox.firstChild.textContent = tr('accessTitle');
  accessRows.replaceChildren();
  const me = hw.me();
  accessBox.hidden = !me; // раздел только для Mini App: в APK и PWA его нет
  if (!me) return;
  const roleRow = el('div', 'settings-row'); roleRow.append(el('span', '', tr('role')), el('strong', '', roleLabel(me.role)));
  accessRows.append(roleRow);
  if (['owner', 'headman', 'editor'].includes(me.role)) accessRows.append(el('p', 'settings-note', tr('editorNote')));
  if (me.status === 'approved' || me.role) {
    const row = el('div', 'settings-row');
    const label = el('div', 'ed-subcopy'); label.append(el('span', '', tr('sub')), el('small', '', tr('subNote')));
    const sw = el('label', 'fork-switch'); const cb = el('input'); cb.type = 'checkbox'; cb.setAttribute('role', 'switch'); cb.setAttribute('aria-label', tr('sub')); cb.checked = !!me.subscribed;
    sw.append(cb, el('span', 'fork-switch-track')); row.append(label, sw); accessRows.append(row);
    cb.addEventListener('change', async () => {
      const want = cb.checked;
      try { const res = await api('POST', '/api/me/subscription', { on: want }); if (!res.ok) throw new Error(); hw.setMe({ subscribed: want }); }
      catch (_) { cb.checked = !want; toast(tr('errNet')); }
    });
  }
  if (me.role === 'reader') {
    if (me.requested) accessRows.append(el('p', 'settings-note', tr('requestWait')));
    else {
      const btn = el('button', 'choice settings-test', tr('request')); btn.type = 'button';
      const note = el('p', 'settings-note');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await api('POST', '/api/me/request-editor');
          if (res.ok) { hw.setMe({ requested: true }); btn.hidden = true; note.textContent = tr('requested'); }
          else { note.textContent = res.status === 429 ? tr('requestWait') : errorText(res); btn.disabled = false; }
        } catch (_) { note.textContent = tr('errNet'); btn.disabled = false; }
      });
      accessRows.append(btn, note);
    }
  }
}
window.addEventListener('role:change', () => { addTools(); paintAccess(); });
buildAccess(); paintAccess();
addTools();
})();
;
/* js/reports.js */
(() => {
'use strict';
/* «История д/з» (за последние 30 дней, поиск и фильтр по предмету).
   Работает везде: в APK запросы идут через Android-часть (только по списку разрешённых путей), в PWA и Telegram — напрямую. */
const cloud = window.scheduleCloud;
const i18n = window.scheduleI18n;
if (!cloud || !cloud.enabled || !i18n) return;

const L = {
  ru: {
    group: 'Ещё', history: '📚 История домашних заданий', close: 'Закрыть',
    histTitle: 'История д/з', histNote: 'Хранится 30 дней. Фото удаляются раньше, через 14 дней.', all: 'Все предметы', search: 'Поиск по тексту',
    dueTo: 'К {date}', added: 'добавил(а) {name}, {date}', more: 'Показать ещё', empty: 'Заданий не найдено.', offline: 'Нет связи. Показаны последние сохранённые.', loading: 'Загружаю…', errNet: 'Нет связи с облаком.',
  },
  en: {
    group: 'More', history: '📚 Homework history', close: 'Close',
    histTitle: 'Homework history', histNote: 'Kept for 30 days. Photos are removed earlier, after 14 days.', all: 'All subjects', search: 'Search text',
    dueTo: 'Due {date}', added: 'added by {name}, {date}', more: 'Show more', empty: 'No homework found.', offline: 'Offline. Showing the last saved list.', loading: 'Loading…', errNet: 'No connection to the cloud.',
  },
};
const lang = () => i18n.getLanguage() || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k] ?? L.ru[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const LOCALES = { ru: 'ru-RU', en: 'en-GB' };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* нет хранилища */ } },
};
const fmtDate = iso => { try { return new Intl.DateTimeFormat(LOCALES[lang()] || 'ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00')); } catch (_) { return iso; } };
const fmtStamp = sec => { try { return new Intl.DateTimeFormat(LOCALES[lang()] || 'ru-RU', { day: 'numeric', month: 'long' }).format(new Date(sec * 1000)); } catch (_) { return ''; } };
const safeLink = href => { try { const u = new URL(href); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch (_) { return null; } };

// ---------- окно ----------
function openSheet(title) {
  const back = el('div', 'ed-back');
  const box = el('div', 'ed-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title); box.tabIndex = -1;
  const head = el('div', 'ed-head'); const x = el('button', 'ed-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close'));
  head.append(el('h2', '', title), x);
  const body = el('div', 'ed-body');
  box.append(head, body); back.append(box); document.body.append(back);
  document.body.classList.add('ed-open');
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { back.remove(); document.body.classList.remove('ed-open'); document.removeEventListener('keydown', onKey); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  x.addEventListener('click', close); document.addEventListener('keydown', onKey);
  box.focus();
  return { body, close };
}

// ---------- история д/з ----------
const HIST_CACHE = 'schedule-hw-history' + (window.scheduleClass && !window.scheduleClass.isDefault ? ':' + window.scheduleClass.id : '');
function openHistory() {
  const sheet = openSheet(tr('histTitle'));
  const note = el('p', 'ed-sub', tr('histNote'));
  const subject = el('select', 'ed-input'); subject.setAttribute('aria-label', tr('all'));
  const search = el('input', 'ed-input'); search.type = 'search'; search.placeholder = tr('search'); search.setAttribute('aria-label', tr('search')); search.maxLength = 100;
  const bar = el('div', 'rp-bar'); bar.append(subject, search);
  const status = el('p', 'ed-status'); status.setAttribute('aria-live', 'polite');
  const list = el('div', 'rp-list');
  const more = el('button', 'ed-primary', tr('more')); more.type = 'button'; more.hidden = true;
  sheet.body.append(note, bar, status, list, more);

  let offset = 0, token = 0, subjects = [];
  const fillSubjects = names => {
    const cur = subject.value; subject.replaceChildren();
    const all = el('option', '', tr('all')); all.value = ''; subject.append(all);
    for (const s of names) { const o = el('option', '', i18n.content('subjects', s)); o.value = s; subject.append(o); }
    subject.value = names.includes(cur) ? cur : '';
  };
  const card = it => {
    const box = el('article', 'rp-item');
    const head = el('div', 'rp-head'); head.append(el('strong', '', tr('dueTo', { date: fmtDate(it.due) })), el('span', 'rp-subject', i18n.content('subjects', it.subject)));
    box.append(head, el('p', 'rp-text', it.text));
    for (const raw of it.links || []) { const href = safeLink(raw); if (!href) continue; const a = el('a', 'hw-link', new URL(href).hostname); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a); }
    if (it.author || it.created) box.append(el('p', 'rp-meta', tr('added', { name: it.author || '—', date: fmtStamp(it.created) })));
    return box;
  };
  const show = (data, append) => {
    if (!append) list.replaceChildren();
    for (const it of data.items || []) list.append(card(it));
    if (!list.children.length) list.append(el('p', 'rp-empty', tr('empty')));
    more.hidden = !data.more;
  };
  async function load(append) {
    const my = ++token;
    if (!append) { offset = 0; status.textContent = tr('loading'); status.classList.remove('bad'); }
    const q = '?limit=20&offset=' + offset + (subject.value ? '&subject=' + encodeURIComponent(subject.value) : '') + (search.value.trim() ? '&q=' + encodeURIComponent(search.value.trim()) : '') + (window.scheduleClass ? window.scheduleClass.amp() : '');
    try {
      const r = await cloud.request('GET', '/api/homework/history' + q);
      if (my !== token) return;
      if (r.status !== 200 || !r.json || !Array.isArray(r.json.items)) throw new Error(String(r.status));
      if (!append && !subject.value && !search.value.trim()) store.set(HIST_CACHE, JSON.stringify(r.json));
      if (!append || !subjects.length) { subjects = r.json.subjects || []; fillSubjects(subjects); }
      status.textContent = ''; offset += r.json.items.length; show(r.json, append);
    } catch (_) {
      if (my !== token) return;
      let saved = null; try { saved = JSON.parse(store.get(HIST_CACHE) || 'null'); } catch (__) { /* нет кэша */ }
      if (saved && !append && !subject.value && !search.value.trim()) { status.textContent = tr('offline'); status.classList.add('bad'); fillSubjects(saved.subjects || []); show(saved, false); more.hidden = true; }
      else { status.textContent = tr('errNet'); status.classList.add('bad'); }
    }
  }
  let timer = 0;
  subject.addEventListener('change', () => load(false));
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(false), 350); });
  more.addEventListener('click', () => load(true));
  load(false);
}

// ---------- кнопки в настройках ----------
let box = null, title = null, b1 = null;
function paint() {
  const settings = document.getElementById('settings-screen');
  if (!settings) return;
  if (!box) {
    box = el('section', 'settings-group'); box.id = 'reports-settings';
    title = el('h2'); b1 = el('button', 'choice settings-test');
    b1.type = 'button';
    b1.addEventListener('click', openHistory);
    const row = el('div', 'rp-buttons'); row.append(b1);
    box.append(title, row); settings.append(box);
  }
  title.textContent = tr('group'); b1.textContent = tr('history');
}
window.addEventListener('language:change', paint);
paint();
window.scheduleReports = { openHistory, openSheet };
})();
;
/* js/tabbar.js */
(() => {
'use strict';
/* Нижняя панель вкладок: всегда включена (переключателя нет). Только на телефоне и планшете (ширину решает CSS). */
const i18n = window.scheduleI18n;
const app = window.scheduleApp;
if (!i18n || !app) return;
const L = {
  ru: { home: 'Главная', schedule: 'Пары', calendar: 'Календарь', game: 'Игры', settings: 'Настройки', homework: 'Д/з', aria: 'Разделы' },
  en: { home: 'Home', schedule: 'Timetable', calendar: 'Calendar', game: 'Games', settings: 'Settings', homework: 'Homework', aria: 'Sections' },
};
const tr = k => (L[i18n.getLanguage()] || L.ru)[k];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
  schedule: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 14h2M12 14h2M8 17h2"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>',
  homework: '<path d="M5 19l1-4 9-9 3 3-9 9z"/><path d="M14 7l3 3"/>',
};
const bar = el('nav', 'tabbar'); bar.setAttribute('aria-label', tr('aria')); bar.hidden = true;
const buttons = new Map();
function make(name) {
  const b = el('button', 'tab'); b.type = 'button'; b.dataset.tab = name;
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg><span></span>';
  b.addEventListener('click', () => go(name));
  buttons.set(name, b); return b;
}
function go(name) {
  document.body.dataset.tabswitch = '1'; // переход из панели — без сдвига экрана
  if (name === 'home') { if (app.getScreen() !== 'home' && window.appNavigateBack) window.appNavigateBack(); return; }
  if (app.getScreen() === name) return;
  const trigger = name === 'settings' ? document.getElementById('open-settings') : name === 'homework' ? document.getElementById('hw-menu-card') : document.querySelector('#home-screen [data-open-screen="' + name + '"]');
  if (trigger) trigger.click(); else app.navigate(name);
}
function canHomework() { const r = window.scheduleHomework && window.scheduleHomework.role(); return r === 'owner' || r === 'headman' || r === 'editor'; }
function build() {
  bar.replaceChildren();
  const names = ['home', 'schedule', 'calendar', 'game'];
  if (canHomework()) names.push('homework');
  names.push('settings');
  for (const n of names) bar.append(make(n));
  paint();
}
function paint() {
  bar.setAttribute('aria-label', tr('aria'));
  const screen = app.getScreen();
  for (const [name, b] of buttons) { b.querySelector('span').textContent = tr(name); b.setAttribute('aria-current', name === screen ? 'page' : 'false'); }
}
function apply() {
  document.body.dataset.nav = 'bar';
  bar.hidden = false;
  build();
}
document.body.append(bar);
new MutationObserver(paint).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
window.addEventListener('language:change', paint);
window.addEventListener('role:change', build);

apply();
})();
;
/* js/touch.js */

/* Тактильный отклик: волна и вибрация при нажатии, анимация выбора. Раньше файл назывался feedback.js; поведение не менялось. */
(() => {
const pulse = (element, className) => {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  const clear = () => element.classList.remove(className);
  element.addEventListener('animationend', clear, { once: true });
  window.setTimeout(clear, 650);
};
document.addEventListener('change', event => {
  if (event.target.matches('.language-select, .palette-select')) {
    pulse(event.target, 'selection-feedback');
    pulse(document.querySelector('header'), 'theme-feedback');
  }
});
window.addEventListener('palette:change', () => pulse(document.querySelector('header'), 'theme-feedback'));
window.addEventListener('language:change', () => pulse(document.querySelector('header'), 'theme-feedback'));
})();
;
/* js/home.js */
/* Главный экран: карточка ближайшей/текущей пары с отсчётом, шкала дня, поиск по расписанию, напоминания о парах (в APK).
   Раньше файл назывался android.js; поведение не менялось. */
(() => {
  'use strict';

  const labels = {
    ru: {
      next: 'Следующая пара', now: 'Сейчас идёт', today: 'Сегодня', noClass: 'Ближайших занятий нет',
      starts: 'Начнётся через {time}', ends: 'Закончится через {time}',
      search: 'Поиск по расписанию', searchPlaceholder: 'Предмет, преподаватель или аудитория',
      searchEmpty: 'Совпадений не найдено. Измените запрос.', current: 'Сейчас',
      reminder: 'Напоминать о парах', reminderHint: 'Уведомление за 5 минут до начала пары',
      testBtn: 'Проверить уведомление', testSent: 'Отправлено. Посмотрите шторку уведомлений.',
      testPermission: 'Разрешите уведомления в окне Android — проверка отправится сама.',
      testBlocked: 'Уведомления отключены. Включите их в настройках Android для этого приложения.',
      weekdays: ['понедельник','вторник','среду','четверг','пятницу','субботу','воскресенье'],
      dayIn: 'Следующая пара: {day}, {date}',
      dayLine: 'Сегодня: {total} · осталось: {left} · конец в {end}', dayGap: 'Сейчас окно · осталось пар: {left} · конец в {end}', dayOver: 'Сегодня пары закончились (всего {total})', dayNone: 'Сегодня пар нет',
    },
    en: {
      next: 'Next class', now: 'In progress', today: 'Today', noClass: 'No upcoming classes',
      starts: 'Starts in {time}', ends: 'Ends in {time}',
      search: 'Search timetable', searchPlaceholder: 'Subject, teacher, or room',
      searchEmpty: 'No matches. Try another search.', current: 'Now',
      reminder: 'Class reminders', reminderHint: 'Notification 5 minutes before class',
      testBtn: 'Send test notification', testSent: 'Sent. Check your notification shade.',
      testPermission: 'Allow notifications in the Android prompt — the test will be sent automatically.',
      testBlocked: 'Notifications are turned off. Enable them for this app in Android settings.',
      weekdays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      dayIn: 'Next class: {day}, {date}',
      dayLine: 'Today: {total} · left: {left} · ends at {end}', dayGap: 'Break now · classes left: {left} · ends at {end}', dayOver: 'Classes are over for today ({total} total)', dayNone: 'No classes today',
    },
  };

  const language = () => {
    const value = document.documentElement.dataset.language || document.documentElement.lang || 'ru';
    return labels[value] ? value : 'ru';
  };
  const t = key => labels[language()][key];
  const replace = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  const readJSON = id => {
    const element = document.getElementById(id);
    if (!element) return null;
    try { return JSON.parse(element.textContent); } catch (_) { return null; }
  };
  const data = readJSON('schedule-data');
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.days)) return;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const timeMinutes = value => {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return hours * 60 + minutes;
  };
  const localDate = (year, month, day) => new Date(year, month, day, 0, 0, 0, 0);
  const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const selectedGroup = () => {
    try { return JSON.parse(localStorage.getItem('combined-schedule-2026-2027-v1') || 'null')?.group || 'all'; }
    catch (_) { return 'all'; }
  };
  const groupMatches = event => {
    const group = selectedGroup();
    return group === 'all' || !event.group || event.group === 'Общее' || event.group === group;
  };

  function upcoming(now = new Date()) {
    const items = [];
    for (let offset = 0; offset <= 14; offset++) {
      const date = localDate(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const index = (date.getDay() + 6) % 7;
      const day = data.days[index];
      if (!day) continue;
      for (const event of data.events) {
        if (event.day !== day || !groupMatches(event)) continue;
        const start = new Date(date); start.setMinutes(timeMinutes(event.start));
        const end = new Date(date); end.setMinutes(timeMinutes(event.end));
        if (end <= now) continue;
        if (window.scheduleOverrides && window.scheduleOverrides.cancelled(event, date)) continue; // пара отменена на эту дату
        items.push({ event, start, end });
      }
    }
    return items.sort((a, b) => a.start - b.start || a.end - b.end || String(a.event.group || '').localeCompare(String(b.event.group || '')));
  }

  function countdown(ms) {
    const minutes = Math.max(0, Math.ceil(ms / 60000));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours} ч ${remainder} мин`;
    if (hours) return `${hours} ч`;
    return `${minutes} мин`;
  }

  let nextCard, nextLabel, nextSubject, nextTime, nextStatus, dayText, dayBar, ringText;
  // смена текста с коротким «всплытием» (если анимации не выключены)
  function setText(node, text) {
    if (node.textContent === text) return;
    const had = node.textContent !== '';
    node.textContent = text;
    if (had) { node.classList.remove('fx-swap'); void node.offsetWidth; node.classList.add('fx-swap'); }
  }
  function createNextCard() {
    const home = document.getElementById('home-screen');
    const menu = home?.querySelector('.menu-grid');
    if (!home || !menu) return;
    nextCard = make('section', 'fork-next-card');
    nextCard.setAttribute('aria-live', 'polite');
    nextLabel = make('span', 'fork-next-label');
    nextSubject = make('strong', 'fork-next-subject');
    nextTime = make('div', 'fork-next-time');
    nextStatus = make('div', 'fork-next-status');
    dayText = make('div', 'fork-day-text');
    dayBar = make('div', 'fork-day-bar'); dayBar.setAttribute('aria-hidden', 'true');
    const ring = make('span', 'fork-ring'); ring.setAttribute('aria-hidden', 'true');
    ringText = make('span', 'fork-ring-text'); ring.append(ringText);
    nextCard.append(ring, nextLabel, nextSubject, nextTime, nextStatus, dayText, dayBar);
    home.insertBefore(nextCard, menu);
  }

  function renderNext(now = new Date()) {
    if (!nextCard) return;
    const entries = upcoming(now);
    const active = entries.find(item => item.start <= now && item.end > now);
    const item = active || entries.find(item => item.start > now);
    if (!item) {
      nextCard.classList.remove('is-current', 'is-soon');
      nextCard.classList.add('no-ring');
      setText(nextLabel, t('next'));
      setText(nextSubject, t('noClass'));
      setText(nextTime, '');
      nextStatus.textContent = '';
      return;
    }
    nextCard.classList.remove('no-ring');
    nextCard.classList.toggle('is-current', Boolean(active));
    // кольцо: у идущей пары — сколько прошло, у ближайшей — заполняется за последний час до начала
    const minutesTo = Math.max(0, Math.ceil(((active ? item.end : item.start) - now) / 60000));
    const progress = active ? (now - item.start) / (item.end - item.start) : 1 - Math.min(60, minutesTo) / 60;
    nextCard.style.setProperty('--nc', Math.max(0, Math.min(1, progress)).toFixed(3));
    nextCard.classList.toggle('is-soon', !active && minutesTo <= 5);
    ringText.textContent = minutesTo >= 100 ? `${Math.round(minutesTo / 60)}${language() === 'ru' ? 'ч' : 'h'}` : `${minutesTo}′`;
    setText(nextLabel, active ? t('now') : t('next'));
    setText(nextSubject, item.event.subject);
    const room = (window.scheduleOverrides && window.scheduleOverrides.roomFor(item.event, item.start)) || item.event.room;
    setText(nextTime, `${item.event.start}–${item.event.end}${room ? ` · ${room}` : ''}`);
    if (active) {
      nextStatus.textContent = replace(t('ends'), { time: countdown(item.end - now) });
    } else if (iso(item.start) === iso(now)) {
      nextStatus.textContent = replace(t('starts'), { time: countdown(item.start - now) });
    } else {
      const day = labels[language()].weekdays[item.start.getDay()];
      const date = new Intl.DateTimeFormat(language() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' }).format(item.start);
      nextStatus.textContent = replace(labels[language()].dayIn, { day, date });
    }
  }

  // Полоса дня: сколько пар сегодня, сколько осталось, во сколько конец; шкала времени с пройденными и оставшимися парами
  function todaySlots(now) {
    const day = data.days[(now.getDay() + 6) % 7];
    const map = new Map();
    for (const event of data.events) {
      if (event.day !== day || !groupMatches(event) || !event.start || !event.end) continue;
      if (window.scheduleOverrides && window.scheduleOverrides.cancelled(event, now)) continue;
      const key = event.start + '|' + event.end;
      if (!map.has(key)) map.set(key, { s: timeMinutes(event.start), e: timeMinutes(event.end), end: event.end });
    }
    return [...map.values()].sort((a, b) => a.s - b.s || a.e - b.e);
  }
  let daySig = '', dayPin = null;
  function renderDay(now = new Date()) {
    if (!dayText) return;
    const slots = todaySlots(now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    dayBar.hidden = !slots.length;
    if (!slots.length) { setText(dayText, t('dayNone')); daySig = ''; dayBar.replaceChildren(); return; }
    const left = slots.filter(slot => slot.e > minutes);
    const current = slots.some(slot => slot.s <= minutes && slot.e > minutes);
    const values = { total: slots.length, left: left.length, end: slots[slots.length - 1].end.replace(/^(\d):/, '0$1:') };
    setText(dayText, replace(t(!left.length ? 'dayOver' : current || !slots.some(slot => slot.e <= minutes) ? 'dayLine' : 'dayGap'), values));
    const from = slots[0].s, span = Math.max(1, slots[slots.length - 1].e - from);
    const sig = slots.map(slot => slot.s + '-' + slot.e).join(',');
    if (sig !== daySig) { // шкала строится заново только когда изменился набор пар; иначе указатель плавно едет
      daySig = sig; dayBar.replaceChildren();
      slots.forEach((slot, index) => {
        const part = make('i', 'fork-day-part');
        part.style.left = ((slot.s - from) / span * 100) + '%';
        part.style.width = ((slot.e - slot.s) / span * 100) + '%';
        part.style.setProperty('--i', index);
        dayBar.append(part);
      });
      dayPin = make('b', 'fork-day-pin'); dayBar.append(dayPin);
      dayBar.classList.add('draw'); setTimeout(() => dayBar.classList.remove('draw'), 1000);
    }
    dayBar.querySelectorAll('.fork-day-part').forEach((part, index) => {
      const slot = slots[index];
      part.className = 'fork-day-part ' + (slot.e <= minutes ? 'done' : slot.s <= minutes ? 'now' : 'next');
    });
    if (dayPin) {
      dayPin.hidden = !(minutes >= from && minutes <= from + span);
      dayPin.style.left = (Math.max(0, Math.min(1, (minutes - from) / span)) * 100) + '%';
    }
  }
  function createSearch() {
    const main = document.querySelector('#schedule-screen > main');
    const schedule = document.getElementById('schedule');
    if (!main || !schedule) return;
    const tools = make('div', 'fork-search-tools');
    const button = make('button', 'fork-search-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg>';
    const panel = make('div', 'fork-search-panel'); panel.hidden = true;
    const input = make('input', 'fork-search-input'); input.type = 'search'; input.autocomplete = 'off'; input.setAttribute('aria-label', t('searchPlaceholder'));
    input.placeholder = t('searchPlaceholder');
    const empty = make('p', 'fork-search-empty', t('searchEmpty')); empty.hidden = true;
    panel.append(input, empty); tools.append(button);
    main.insertBefore(tools, schedule); main.insertBefore(panel, schedule);
    const apply = () => {
      const query = input.value.trim().toLocaleLowerCase(language());
      let matches = 0;
      for (const card of document.querySelectorAll('#schedule .lesson')) {
        const fields = [card.dataset.subject, card.dataset.teacher, card.dataset.room, card.textContent].join(' ').toLocaleLowerCase(language());
        const visible = !query || fields.includes(query);
        card.hidden = !visible; if (visible) matches++;
      }
      for (const section of document.querySelectorAll('#schedule .day-section')) {
        const visibleCards = [...section.querySelectorAll('.lesson')].some(card => !card.hidden);
        section.hidden = Boolean(query) && !visibleCards;
      }
      empty.hidden = !query || matches > 0;
    };
    button.setAttribute('aria-label', t('search'));
    button.addEventListener('click', () => {
      const opened = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!opened)); panel.hidden = opened;
      if (!opened) input.focus();
    });
    input.addEventListener('input', apply);
    document.addEventListener('schedule:render', apply);
    window.addEventListener('language:change', () => {
      button.setAttribute('aria-label', t('search'));
      input.placeholder = t('searchPlaceholder');
      input.setAttribute('aria-label', t('searchPlaceholder'));
      empty.textContent = t('searchEmpty');
      apply();
    });
  }

  function reminderPayload() {
    const node = document.querySelector('time[data-i18n="calendar.end"]');
    const semesterEnd = (node && node.getAttribute('datetime')) || '2026-12-11';
    const dayIndex = new Map(data.days.map((day, index) => [day, index]));
    const seen = new Set();
    const items = [];
    for (const event of data.events) {
      if (!groupMatches(event)) continue;
      const weekday = dayIndex.get(event.day);
      if (weekday === undefined || !event.start) continue;
      const group = event.group && event.group !== 'Общее' ? event.group : '';
      const id = [weekday, event.start, event.subject, group, event.room || ''].join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      const key = [event.day, String(event.start).replace(/^(\d):/, '0$1:'), event.subject, group || 'Общее'].join('|'); // ключ пары (как в облаке): по нему находятся отмены и замены
      items.push({ id, weekday, start: event.start, end: event.end || '', subject: event.subject || '', room: event.room || '', group, semesterEnd, key });
    }
    return JSON.stringify(items);
  }

  let lastReminderKey = '';
  function syncReminders(force) {
    const bridge = window.AppPreferences;
    if (!bridge || typeof bridge.setClassNotifications !== 'function') return;
    try { if (!bridge.isClassNotificationsEnabled()) return; } catch (_) { return; }
    const payload = reminderPayload();
    const key = language() + '|' + payload;
    if (!force && key === lastReminderKey) return;
    lastReminderKey = key;
    try { bridge.setClassNotifications(payload, true, language()); } catch (_) {}
  }

  function createReminderControl() {
    const bridge = window.AppPreferences;
    const box = document.getElementById('notify-settings');
    if (!bridge || typeof bridge.setClassNotifications !== 'function' || !box) return;
    box.hidden = false;

    const card = make('div', 'fork-reminders');
    const copy = make('div', 'fork-reminder-copy');
    const title = make('strong', '', t('reminder'));
    const hint = make('span', '', t('reminderHint'));
    copy.append(title, hint);
    const label = make('label', 'fork-switch');
    const input = make('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', t('reminder'));
    const track = make('span', 'fork-switch-track');
    label.append(input, track);
    card.append(copy, label);

    const testButton = make('button', 'choice settings-test', t('testBtn'));
    testButton.type = 'button';
    const status = make('p', 'settings-status');
    status.setAttribute('aria-live', 'polite');
    let lastResult = '';
    const showResult = result => {
      lastResult = result;
      status.textContent = result === 'sent' ? t('testSent') : result === 'permission' ? t('testPermission') : result === 'blocked' ? t('testBlocked') : '';
    };
    box.append(card, testButton, status);

    try { input.checked = bridge.isClassNotificationsEnabled(); } catch (_) { input.checked = false; }
    input.addEventListener('change', () => {
      try { bridge.setClassNotifications(reminderPayload(), input.checked, language()); }
      catch (_) { input.checked = !input.checked; }
    });
    testButton.addEventListener('click', () => {
      if (typeof bridge.testNotification !== 'function') return;
      try { showResult(String(bridge.testNotification(language()))); } catch (_) { showResult('blocked'); }
    });
    window.scheduleNotifications = {
      onNativePermissionChanged(granted) {
        input.checked = Boolean(granted);
      },
      onTestResult(result) { showResult(String(result)); }
    };
    window.addEventListener('language:change', () => {
      title.textContent = t('reminder');
      hint.textContent = t('reminderHint');
      testButton.textContent = t('testBtn');
      input.setAttribute('aria-label', t('reminder'));
      if (lastResult) showResult(lastResult);
    });
  }
  function markCurrentLesson(now = new Date()) {
    const day = data.days[(now.getDay() + 6) % 7];
    const minutes = now.getHours() * 60 + now.getMinutes();
    for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
      const current = card.dataset.day === day && minutes >= timeMinutes(card.dataset.start) && minutes < timeMinutes(card.dataset.end);
      card.classList.toggle('fork-current-lesson', current);
      const old = card.querySelector('.fork-current-tag'); if (old) old.remove();
      if (current) {
        const tags = card.querySelector('.tags') || card.querySelector('.details');
        if (tags) {
          const tag = make('span', 'fork-current-tag', t('current'));
          tag.setAttribute('aria-label', t('now'));
          tags.prepend(tag);
        }
      }
    }
  }

  let previousDate = '';
  function followToday(now = new Date()) {
    const today = iso(now);
    if (previousDate && previousDate !== today) {
      const button = document.querySelector('#days [data-value="today"]');
      if (button) button.click();
    }
    previousDate = today;
  }

  function refresh() {
    const now = new Date();
    followToday(now);
    renderNext(now);
    renderDay(now);
    markCurrentLesson(now);
  }

  function start() {
    createNextCard();
    createSearch();
    createReminderControl();
    refresh();
    syncReminders(true);
    document.addEventListener('schedule:render', () => { refresh(); syncReminders(false); });
    document.addEventListener('overrides:change', () => { refresh(); syncReminders(false); });
    window.addEventListener('language:change', () => { refresh(); syncReminders(false); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('focus', refresh);
    window.setInterval(refresh, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
;
/* js/comfort.js */
(() => {
'use strict';
/* Мелочи удобства: «Поделиться» на карточке пары, плашка состояния связи, сообщение об обновлении, установка PWA. */
const i18n = window.scheduleI18n;
const bridge = window.AppPreferences;
const native = !!bridge;
const SITE = 'https://vasileveldar.github.io/schedule/';
const L = {
  ru: {
    share: 'Поделиться парой', copied: 'Скопировано', shareFail: 'Не удалось поделиться',
    offline: 'Нет связи. Показываю сохранённые данные.', stale: 'Не удалось обновить. Показываю сохранённое от {time}.', staleNoTime: 'Не удалось обновить. Показываю сохранённое.', retry: 'Повторить',
    update: 'Доступна новая версия', reload: 'Обновить', close: 'Закрыть',
    installTitle: 'Установка', installBtn: 'Установить приложение', installNote: 'Откроется как обычное приложение, расписание будет доступно без интернета.',
    iosNote: 'Чтобы установить: нажмите «Поделиться» в Safari и выберите «На экран Домой».', homework: 'Д/з',
  },
  en: {
    share: 'Share this class', copied: 'Copied', shareFail: 'Could not share',
    offline: 'No connection. Showing saved data.', stale: 'Could not refresh. Showing data saved at {time}.', staleNoTime: 'Could not refresh. Showing saved data.', retry: 'Retry',
    update: 'A new version is available', reload: 'Update', close: 'Close',
    installTitle: 'Install', installBtn: 'Install the app', installNote: 'It opens like a regular app and the timetable works offline.',
    iosNote: 'To install: tap Share in Safari and choose “Add to Home Screen”.', homework: 'Homework',
  },
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k]).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const locale = () => ({ ru: 'ru-RU', en: 'en-GB' }[lang()] || 'ru-RU');

// заглушка загрузки на главной больше не нужна: карточка «Следующая пара» уже построена
{ const skel = document.getElementById('home-skeleton'); if (skel) skel.remove(); }

// ---------- всплывающие сообщения ----------
let tray = null;
function ensureTray() {
  if (tray) return tray;
  tray = el('div', 'cf-tray'); tray.setAttribute('aria-live', 'polite');
  document.body.append(tray);
  return tray;
}
function toast(text, opts = {}) {
  const box = el('div', 'cf-toast' + (opts.sticky ? ' sticky' : ''));
  if (opts.id) { const old = ensureTray().querySelector('[data-id="' + opts.id + '"]'); if (old) old.remove(); box.dataset.id = opts.id; }
  box.append(el('span', 'cf-text', text));
  for (const a of opts.actions || []) {
    const b = el('button', 'cf-btn', a.label); b.type = 'button';
    b.addEventListener('click', () => { box.remove(); if (a.run) a.run(); });
    box.append(b);
  }
  if (opts.sticky) { const x = el('button', 'cf-x', '×'); x.type = 'button'; x.setAttribute('aria-label', tr('close')); x.addEventListener('click', () => box.remove()); box.append(x); }
  ensureTray().append(box);
  if (!opts.sticky) setTimeout(() => box.remove(), opts.ms || 2600);
  return box;
}
window.scheduleToast = toast;
function dropToast(id) { if (!tray) return; const n = tray.querySelector('[data-id="' + id + '"]'); if (n) n.remove(); }

// ---------- «Поделиться» парой ----------
const pad = n => String(n).padStart(2, '0');
function nextDateFor(dayName) {
  const data = JSON.parse(document.getElementById('schedule-data').textContent);
  const idx = (data.days || []).indexOf(dayName);
  const d = new Date();
  if (idx >= 0) for (let i = 0; i < 7; i++) { if ((d.getDay() + 6) % 7 === idx) break; d.setDate(d.getDate() + 1); }
  return d;
}
function lessonText(card) {
  const d = nextDateFor(card.dataset.day);
  const date = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const lines = [date + ', ' + card.dataset.start + '–' + card.dataset.end];
  lines.push(i18n.content('subjects', card.dataset.subject) + (card.dataset.room ? ' · ' + i18n.room(card.dataset.room) : ''));
  if (card.dataset.teacher) lines.push(i18n.content('teachers', card.dataset.teacher));
  const hw = [...card.querySelectorAll('.hw-block:not(.hw-past) .hw-text')].map(n => n.textContent.trim()).filter(Boolean);
  for (const h of hw) lines.push(tr('homework') + ': ' + h);
  const url = !native && /^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE;
  lines.push(url);
  return lines.join('\n');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  try { const a = el('textarea'); a.value = text; a.style.cssText = 'position:fixed;opacity:0'; document.body.append(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (_) { return false; }
}
async function share(text) {
  try { if (bridge && typeof bridge.shareText === 'function') { bridge.shareText(text); return; } } catch (_) {}
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg && tg.initData && typeof tg.openTelegramLink === 'function') {
    const lines = text.split('\n'), url = lines.pop();
    try { tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(lines.join('\n'))); return; } catch (_) {}
  }
  toast(await copyText(text) ? tr('copied') : tr('shareFail'));
}
function addShareButtons() {
  for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
    if (card.dataset.source === 'assessment' || card.querySelector('.lesson-share')) continue;
    const b = el('button', 'lesson-share'); b.type = 'button';
    b.setAttribute('aria-label', tr('share')); b.title = tr('share');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.8 7.1-3.6M8.2 13.2l7.1 3.6"/></svg>';
    b.addEventListener('click', e => { e.stopPropagation(); share(lessonText(card)); });
    card.append(b);
  }
}
document.addEventListener('schedule:render', addShareButtons);
addShareButtons(); // расписание уже отрисовано до загрузки этого файла
window.addEventListener('language:change', () => { for (const b of document.querySelectorAll('.lesson-share')) { b.setAttribute('aria-label', tr('share')); b.title = tr('share'); } });

// ---------- состояние связи ----------
function timeText(at) { return at ? new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(at)) : ''; }
function retry() { dropToast('net'); if (window.scheduleHomework && window.scheduleHomework.reload) window.scheduleHomework.reload(); }
let lastStatus = null;
function showStale(at) {
  lastStatus = { ok: false, at };
  toast(at ? tr('stale', { time: timeText(at) }) : tr('staleNoTime'), { id: 'net', sticky: true, actions: [{ label: tr('retry'), run: retry }] });
}
if (!native) {
  window.addEventListener('cloud:status', e => { const d = e.detail || {}; if (d.ok) { lastStatus = d; dropToast('net'); } else showStale(d.at); });
  if (window.scheduleCloudStatus && !window.scheduleCloudStatus.ok) showStale(window.scheduleCloudStatus.at); // событие могло прийти раньше загрузки этого файла
  window.addEventListener('offline', () => toast(tr('offline'), { id: 'net', sticky: true }));
  window.addEventListener('online', () => { dropToast('net'); if (window.scheduleHomework && window.scheduleHomework.reload) window.scheduleHomework.reload(); });
}

// ---------- новая версия сайта ----------
if (!native && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    toast(tr('update'), { id: 'update', sticky: true, actions: [{ label: tr('reload'), run: () => location.reload() }] });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    navigator.serviceWorker.getRegistration().then(r => { if (r) r.update().catch(() => {}); }).catch(() => {});
  });
}

// ---------- установка PWA ----------
{
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const settings = document.getElementById('settings-screen');
  if (!native && !standalone && settings) {
    const box = el('section', 'settings-group'); box.id = 'install-settings'; box.hidden = true;
    const h = el('h2'); const note = el('p', 'settings-note'); const btn = el('button', 'choice settings-test'); btn.type = 'button';
    box.append(h, btn, note); settings.append(box);
    const paint = () => { h.textContent = tr('installTitle'); btn.textContent = tr('installBtn'); note.textContent = btn.hidden ? tr('iosNote') : tr('installNote'); };
    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; box.hidden = false; paint(); });
    window.addEventListener('appinstalled', () => { box.hidden = true; deferred = null; });
    btn.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (_) {} deferred = null; box.hidden = true; });
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)) { btn.hidden = true; box.hidden = false; }
    paint();
    window.addEventListener('language:change', paint);
  }
}
})();
;
/* js/fx.js */
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
};
const lang = () => (i18n && i18n.getLanguage()) || 'ru';
const tr = (k, p) => String((L[lang()] || L.ru)[k]).replace(/\{(\w+)\}/g, (_, n) => (p && p[n] !== undefined ? p[n] : ''));
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const locale = () => ({ ru: 'ru-RU', en: 'en-GB' }[lang()] || 'ru-RU');
const buzz = ms => { if (on() && navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) { /* не поддерживается */ } } };

// ---------- 1. иконки на плитках главной ----------
const ICON = {
  schedule: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.2V12l3.2 2"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.6"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8.5 14h2M13.5 14h2"/>',
  game: '<rect x="2.8" y="7.6" width="18.4" height="10.4" rx="5"/><path d="M8 10.6v4.2M5.9 12.7h4.2"/><circle cx="15.6" cy="11.6" r=".7" fill="currentColor"/><circle cx="17.8" cy="13.8" r=".7" fill="currentColor"/>',
  moodle: '<path d="M2.8 9.4 12 5l9.2 4.4L12 13.8z"/><path d="M6.6 11.6v4.2c0 1.3 2.5 2.7 5.4 2.7s5.4-1.4 5.4-2.7v-4.2"/><path d="M21.2 9.4v5"/>',
  platonus: '<rect x="3.4" y="5.5" width="17.2" height="13" rx="2.6"/><circle cx="9" cy="11" r="2.1"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.6M14.5 13.2h3.6"/>',
  homework: '<path d="M5 19.2l.9-4 9.6-9.6 3.1 3.1-9.6 9.6z"/><path d="M14 7.2l3 3"/>',
};
const ICON_FOR = { '.schedule-card': 'schedule', '.academic-calendar-card': 'calendar', '.game-card': 'game', '.moodle-card': 'moodle', '.platonus-card': 'platonus', '.homework-menu-card': 'homework' };
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
// Игры подгружаются при первом открытии (boot.js), поэтому оформление навешивается сразу и ещё раз после подгрузки.
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
let lastBurst = 0;
function watchBest(n, readyAt) {
  let prev = parseInt(n.textContent.replace(/\D/g, ''), 10) || 0;
  new MutationObserver(() => {
    const v = parseInt(n.textContent.replace(/\D/g, ''), 10) || 0;
    if (v > prev && prev > 0 && Date.now() > readyAt && Date.now() - lastBurst > 20000) { lastBurst = Date.now(); confetti(); }
    prev = v;
  }).observe(n, { childList: true, characterData: true, subtree: true });
}
function gameFx(readyAt) {
  const tabs = document.querySelector('.arc-tabs');
  if (tabs && !tabs.querySelector('.fx-ind')) {
    const ind = el('span', 'fx-ind'); ind.setAttribute('aria-hidden', 'true'); tabs.prepend(ind);
    const place = () => { const b = tabs.querySelector('[aria-selected="true"]'); if (!b || !b.offsetWidth) return; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = 'translateX(' + b.offsetLeft + 'px)'; ind.classList.add('on'); };
    // игра перестраивает кнопки вкладок целиком — ползунок возвращаем на место
    new MutationObserver(() => { if (!tabs.contains(ind)) tabs.prepend(ind); place(); }).observe(tabs, { childList: true, attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
    window.addEventListener('resize', place); window.addEventListener('language:change', () => setTimeout(place, 50));
    place();
  }
  for (const n of document.querySelectorAll('#jg-best')) { if (!n._fxBest) { n._fxBest = true; watchBest(n, readyAt); } }
}
gameFx(Date.now() + 3000);
window.addEventListener('lazy:loaded', e => { if (e.detail === 'game') gameFx(Date.now() + 3000); });

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
;
/* js/groups.js */
(() => {
'use strict';
/* Выбор учебной группы в «Настройках». Список групп берётся из облака (GET /api/groups); пока группа одна, строка скрыта.
   Выбор запоминается на устройстве; в APK его ещё хранит приложение (оно скачивает расписание, д/з и изменения нужной группы);
   в Mini App выбор записывается и в облако (POST /api/me/class), поэтому бот присылает расписание этой же группы.
   Данные группы страница перечитывает перезагрузкой. */
const sc = window.scheduleClass;
if (!sc) return;
const read = id => { const e = document.getElementById(id); try { return e ? JSON.parse(e.textContent) : null; } catch (_) { return null; } };
const cloud = String((read('app-config') || {}).cloudUrl || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(cloud) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cloud)) return;
const row = document.getElementById('class-row'), select = document.getElementById('class-select');
if (!row || !select) return;
const GROUPS_KEY = 'schedule-groups';
const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

function fill(groups) {
  select.replaceChildren();
  const list = groups.slice();
  if (!list.some(g => g.id === sc.id)) list.push({ id: sc.id, title: sc.id }); // выбранная группа могла уйти в архив
  for (const g of list) { const o = document.createElement('option'); o.value = g.id; o.textContent = g.title || g.id; select.append(o); }
  select.value = sc.id;
  row.hidden = groups.length < 2;
}
function cached() { try { const a = JSON.parse(store.get(GROUPS_KEY) || '[]'); return Array.isArray(a) ? a.filter(g => g && sc.valid(g.id)) : []; } catch (_) { return []; } }

async function choose(id) {
  if (!sc.valid(id) || id === sc.id) return;
  store.set('schedule-class', id);
  try { if (window.AppPreferences && typeof window.AppPreferences.setSelectedClass === 'function') window.AppPreferences.setSelectedClass(id); } catch (_) {}
  // Mini App: запоминаем выбор в облаке (бот и напоминания берут группу оттуда)
  try {
    const hw = window.scheduleHomework;
    if (hw && hw.me && hw.me() && hw.headers && hw.headers()['x-telegram-init-data']) {
      await fetch(cloud + '/api/me/class', { method: 'POST', headers: { ...hw.headers(), 'content-type': 'application/json' }, body: JSON.stringify({ class: id }) });
    }
  } catch (_) {}
  location.reload();
}
select.addEventListener('change', () => { choose(select.value); });

fill(cached());
fetch(cloud + '/api/groups', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(list => {
  if (!Array.isArray(list)) return;
  const groups = list.filter(g => g && sc.valid(g.id)).map(g => ({ id: g.id, title: String(g.title || g.id) }));
  store.set(GROUPS_KEY, JSON.stringify(groups));
  fill(groups);
}).catch(() => {});

// Mini App: если человек сам группу здесь не выбирал, берём ту, что записана за ним в облаке (один раз за сеанс)
(function syncFromCloud() {
  if (store.get('schedule-class')) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const hw = window.scheduleHomework, me = hw && hw.me && hw.me();
    if (me && me.class) {
      clearInterval(timer);
      if (me.class !== sc.id && sc.valid(me.class)) {
        let done = null; try { done = sessionStorage.getItem('schedule-class-sync'); } catch (_) {}
        if (done) return;
        try { sessionStorage.setItem('schedule-class-sync', '1'); } catch (_) {}
        store.set('schedule-class', me.class);
        location.reload();
      }
    } else if (tries > 12) clearInterval(timer);
  }, 700);
})();
})();

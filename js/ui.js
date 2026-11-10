(() => {
'use strict';
const i18n=window.scheduleI18n;
const t=(key,params)=>i18n.t(key,params);
const themeToggle=document.getElementById('theme-toggle');
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  themeToggle.setAttribute('aria-checked',String(theme==='dark'));
  i18n.syncChrome();
}
applyTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
themeToggle.addEventListener('click',()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(next);
  try{localStorage.setItem('schedule-theme',next);}catch(_){}
});
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
  card.dataset.day=event.day;card.dataset.start=clock(event.start);card.dataset.end=clock(event.end);card.dataset.subject=event.subject||'';card.dataset.teacher=event.teacher||'';card.dataset.room=event.room||'';
  const time=el('div','time',clock(event.start));time.append(el('span','until',clock(event.end)));card.append(time);
  const details=el('div','details'),tags=el('div','tags');
  if(event.conflict)tags.append(el('span','tag conflict-tag',t('schedule.conflict')));
  if(event.source==='assessment')tags.append(el('span','tag assessment-tag',t('schedule.rk1')));
  if(event.source==='srsp'){const tag=el('span','tag srsp',t('schedule.srsp'));tag.title=t('schedule.srspFull');tags.append(tag);}
  if(event.group&&event.group!=='Общее')tags.append(el('span','tag group',i18n.group(event.group)));
  if(tags.childNodes.length)details.append(tags);
  details.append(el('h3','subject',i18n.content('subjects',event.subject)));
  if(event.type&&!(event.source==='srsp'&&event.type.trim().toUpperCase()==='СРСП'))details.append(el('div','detail',i18n.content('types',event.type)));
  if(event.teacher)details.append(el('div','detail',i18n.content('teachers',event.teacher)));
  if(event.room)details.append(el('div','detail room',i18n.room(event.room)));
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
      const now=new Date(),locale={ru:'ru-RU',en:'en-GB',de:'de-DE'}[i18n.getLanguage()];
      const date=el('time','current-day-date',new Intl.DateTimeFormat(locale,{day:'numeric',month:'long'}).format(now));
      date.dateTime=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      heading.append(date);
    }
    if(state.mode==='rk1'){
      const date=el('time','assessment-day-date',new Intl.DateTimeFormat({ru:'ru-RU',en:'en-GB',de:'de-DE'}[i18n.getLanguage()],{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(assessment.dates[day]+'T12:00:00Z')));
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

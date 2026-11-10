(() => {
const screens = {home:document.getElementById('home-screen'),schedule:document.getElementById('schedule-screen'),calendar:document.getElementById('calendar-screen'),game:document.getElementById('game-screen')};
const titles={home:'app.name',schedule:'app.title',calendar:'nav.calendar',game:'nav.game'};
const announcements={home:'nav.home',schedule:'nav.openedSchedule',calendar:'nav.openedCalendar',game:'nav.openedGame'};
const heading=document.getElementById('page-title');
const back=document.getElementById('back-menu');
const eyebrow=document.getElementById('header-eyebrow');
const t=(key)=>window.scheduleI18n.t(key);
let current='home';
function refreshLabels(){
  heading.textContent=t(titles[current]);
  document.getElementById('subtitle').textContent=t('app.subtitle');
  document.getElementById('screen-status').textContent=t(announcements[current]);
}
function navigate(next,focus=true){
  if(!screens[next])return;
  if(current==='game'&&window.scheduleGame)window.scheduleGame.deactivate();
  current=next;
  for(const [key,screen] of Object.entries(screens))screen.hidden=key!==next;
  document.body.dataset.screen=next;
  back.hidden=next==='home';
  eyebrow.hidden=next!=='home';
  refreshLabels();
  window.scrollTo(0,0);
  if(focus)heading.focus({preventScroll:true});
  if(next==='game'&&window.scheduleGame)window.scheduleGame.activate();
  if(window.interfaceMotion)window.interfaceMotion.enter(screens[next]);
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
back.addEventListener('click',()=>navigate('home'));
window.appNavigateBack=()=>{if(current==='home')return false;navigate('home');return true;};
window.scheduleApp={navigate,getScreen:()=>current};
window.addEventListener('language:change',refreshLabels);
navigate('home',false);
})();

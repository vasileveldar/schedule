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

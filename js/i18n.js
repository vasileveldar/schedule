(() => {
'use strict';
const catalogue=JSON.parse(document.getElementById('translation-data').textContent);
const valid=['ru','en','de'];
const palettes=['en','de'];
let language=valid.includes(document.documentElement.dataset.language)?document.documentElement.dataset.language:'ru';
let palette=palettes.includes(document.documentElement.dataset.palette)?document.documentElement.dataset.palette:'en';
let hasSavedPalette=palettes.includes(document.documentElement.dataset.palette);
try {const stored=localStorage.getItem('schedule-language');if(valid.includes(stored))language=stored;else if(window.AppPreferences){const native=window.AppPreferences.getLocale();if(valid.includes(native))language=native;}} catch (_) {}
try {const stored=localStorage.getItem('schedule-palette');if(palettes.includes(stored)){palette=stored;hasSavedPalette=true;}} catch (_) {}
if(!hasSavedPalette){
  palette=language==='de'?'de':'en';
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

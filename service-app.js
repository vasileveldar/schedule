import {DAY_NAMES,dateOnly,validDate,addDays,dayIndex,weekStart,normalizeLessons} from './service-model.mjs';

const root=document.getElementById('service-root');
const client=window.serviceClient;
const i18n=window.scheduleI18n;
const t=(key,values)=>i18n.t('service.'+key,values);
const fallback=normalizeLessons(JSON.parse(document.getElementById('schedule-data').textContent).events);
const state={session:null,membership:null,lessons:fallback,homework:[],lectures:[],progress:[],people:[],tab:'schedule',date:dateOnly(),group:'all',authMode:'login',loading:false,error:'',notice:'',updated:null,publicFallback:true,privateReady:false,epoch:0,recovery:false,search:'',subject:'all'};
let refreshPromise=null,authGeneration=0,dialog=null,dialogDirty=false,authFormDirty=false;
const active=()=>state.membership?.status==='active';
const owner=()=>active()&&state.membership.role==='owner';
const editor=()=>active()&&['owner','editor'].includes(state.membership.role);
const clock=value=>String(value||'').slice(0,5);
const fmtDate=(value,options={day:'numeric',month:'long'})=>new Intl.DateTimeFormat(i18n.getLanguage(),{...options,timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function labelNode(tag,key,className){const node=el(tag,className,t(key));node.dataset.svcText=key;return node;}
function button(key,action,className='',params){const node=el('button',className,t(key,params));node.type='button';if(!params)node.dataset.svcText=key;node.addEventListener('click',action);return node;}
function msg(key,className='svc-muted',params){return el('p',className,t(key,params));}
function field(form,key,name,value='',kind='text',options={}){
  const label=el('label','svc-field');label.append(labelNode('span',key));
  let input;
  if(kind==='select'){input=el('select');for(const [id,text] of options.choices||[]){const op=el('option','',text);op.value=id;input.append(op);}}
  else input=el(kind==='textarea'?'textarea':'input');
  if(kind!=='textarea'&&kind!=='select')input.type=kind;
  input.name=name;input.value=value??'';input.required=!!options.required;
  if(options.max)input.maxLength=options.max;if(options.autocomplete)input.autocomplete=options.autocomplete;
  if(options.min)input.minLength=options.min;if(options.rows)input.rows=options.rows;
  label.append(input);if(options.hint)label.append(labelNode('small',options.hint));form.append(label);return input;
}
function readForm(form){return Object.fromEntries(new FormData(form).entries());}
function errorKey(error){
  if(!navigator.onLine)return 'offline';
  const code=String(error?.code||''),message=String(error?.message||'').toLowerCase();
  if(code==='stale')return 'conflictChanged';
  if(code==='empty')return 'requiredFields';
  if(code==='date')return 'dateInvalid';
  if(code==='time')return 'timeInvalid';
  if(code==='23505')return 'alreadyExists';
  if(code==='invalid_credentials')return 'invalidCredentials';
  if(code==='email_not_confirmed')return 'confirmEmail';
  if(code.includes('rate_limit')||error?.status===429)return 'rateLimit';
  if(code==='user_already_exists')return 'accountExists';
  if(code==='weak_password'||message.includes('password should'))return 'passwordMinimum';
  if(code==='email_address_not_authorized'||code==='over_email_send_rate_limit'||message.includes('sending emails')||message.includes('email address is not authorized'))return 'emailDelivery';
  if(code==='42501'||error?.status===403)return 'noPermission';
  if(code==='42P01'||code==='PGRST205'||code==='PGRST202')return 'setupNeeded';
  if(message.includes('fetch')||message.includes('network'))return 'networkError';
  return 'requestFailed';
}
function unwrap(result){if(result.error)throw result.error;return result.data;}
function clearPrivate(){state.homework=[];state.lectures=[];state.progress=[];state.people=[];state.privateReady=false;}
function statusNode(){
  const box=el('div','svc-status');box.setAttribute('role','status');box.dataset.error=String(!!state.error||!navigator.onLine);
  const key=!navigator.onLine?'offline':state.loading?'loading':state.error||(!client?'setupNeeded':state.publicFallback?'fallback':'');
  if(key)box.append(el('span','',t(key)));else if(state.updated)box.append(el('span','',t('updated',{time:new Intl.DateTimeFormat(i18n.getLanguage(),{hour:'2-digit',minute:'2-digit'}).format(state.updated)})));
  if(state.error||!navigator.onLine||state.publicFallback)box.append(button('retry',()=>refresh(true),'svc-text-button'));
  return box;
}
function render(){
  if(authFormDirty&&state.tab==='account')return;
  root.replaceChildren();root.className='svc';
  const tabs=el('nav','svc-tabs');tabs.setAttribute('aria-label',t('sections'));
  const names=['schedule','library','account'];if(owner())names.push('members');
  if(!names.includes(state.tab))state.tab='schedule';
  for(const name of names){const b=button(name,()=>setTab(name));b.setAttribute('aria-pressed',String(state.tab===name));tabs.append(b);}
  root.append(tabs,statusNode());
  if(state.notice)root.append(el('p','svc-message',t(state.notice)));
  if(state.tab==='schedule')renderSchedule();else if(state.tab==='library')renderLibrary();else if(state.tab==='account')renderAccount();else renderMembers();
  const shortcut=document.getElementById('service-account');if(shortcut){shortcut.textContent=t(state.session?'myAccount':'signIn');shortcut.setAttribute('aria-label',t(state.session?'myAccount':'signIn'));}
}
function setTab(name){
  if(authFormDirty&&!confirm(t('discard')))return;
  authFormDirty=false;state.tab=name;state.notice='';render();
}
function locked(){
  const box=el('div','svc-empty');
  box.append(msg(!state.session?'privateInfo':state.membership?.status==='blocked'?'blocked':state.membership?.status==='pending'?'pending':'membershipLoading'));
  if(!state.session)box.append(button('signIn',()=>setTab('account'),'svc-primary'));
  return box;
}
function renderSchedule(){
  const start=weekStart(state.date),today=dateOnly(),toolbar=el('div','svc-toolbar');
  const groups=[...new Set(state.lessons.filter(l=>l.active).map(l=>l.group_name).filter(g=>g&&g!=='Общее'))];
  if(state.group!=='all'&&!groups.includes(state.group))state.group='all';
  const select=field(toolbar,'group','group',state.group,'select',{choices:[['all',t('allGroups')],...groups.map(g=>[g,i18n.group(g)])]});select.addEventListener('change',()=>{state.group=select.value;render();});
  if(owner())toolbar.append(button('addLesson',()=>lessonDialog(),'svc-text-button'));
  root.append(toolbar);
  const nav=el('div','svc-date-nav');nav.append(button('previousWeek',()=>changeDate(addDays(state.date,-7))));
  nav.append(el('strong','',`${fmtDate(start,{day:'numeric',month:'short'})} – ${fmtDate(addDays(start,6),{day:'numeric',month:'short',year:'numeric'})}`));
  nav.append(button('nextWeek',()=>changeDate(addDays(state.date,7))),button('today',()=>changeDate(today)));
  root.append(nav);const days=el('div','svc-weekdays');
  for(let n=0;n<7;n++){const date=addDays(start,n),b=el('button',date===today?'svc-today':'');b.type='button';b.setAttribute('aria-label',`${i18n.day(DAY_NAMES[n])}, ${fmtDate(date)}`);b.setAttribute('aria-pressed',String(date===state.date));b.append(el('span','',i18n.day(DAY_NAMES[n],true)),el('b','',String(Number(date.slice(-2)))));b.addEventListener('click',()=>changeDate(date));days.append(b);}
  root.append(days,el('h2','svc-title',`${i18n.day(DAY_NAMES[dayIndex(state.date)])}, ${fmtDate(state.date)}`));
  if(!active())root.append(locked());
  const lessons=state.lessons.filter(l=>l.active&&l.day_index===dayIndex(state.date)&&(state.group==='all'||!l.group_name||l.group_name==='Общее'||l.group_name===state.group)).sort((a,b)=>a.start_time.localeCompare(b.start_time));
  const stack=el('div','svc-stack');for(const lesson of lessons)stack.append(lessonCard(lesson));
  if(!lessons.length)stack.append(el('div','svc-empty',t('noLessons')));root.append(stack);
}
function changeDate(next){const old=weekStart(state.date);state.date=next;if(weekStart(next)!==old){state.epoch++;state.homework=[];state.progress=[];state.privateReady=false;}render();if(weekStart(next)!==old)refresh(true);}
function lessonCard(lesson){
  const card=el('article','svc-card svc-lesson'+(lesson.conflict?' conflict':''));
  card.append(el('div','svc-time',`${clock(lesson.start_time)} – ${clock(lesson.end_time)}`),el('h3','svc-subtitle',i18n.content('subjects',lesson.subject)));
  const meta=[i18n.content('types',lesson.type),i18n.content('teachers',lesson.teacher),lesson.room?i18n.room(lesson.room):''].filter(Boolean);for(const value of meta)card.append(el('div','svc-meta',value));
  if(lesson.group_name&&lesson.group_name!=='Общее')card.append(el('p','svc-meta',i18n.group(lesson.group_name)));
  if(lesson.conflict)card.append(el('p','svc-conflict',i18n.t('schedule.conflict')+(lesson.conflict_note?' · '+i18n.content('conflictNotes',lesson.conflict_note):'')));
  if(owner())card.append(button('editLesson',()=>lessonDialog(lesson),'svc-text-button'));
  if(!active())return card;
  const material=el('section','svc-material');material.append(el('h4','',t('prepare')));
  if(!state.privateReady){material.append(msg(state.error?'privateUnavailable':'loading'));card.append(material);return card;}
  const hw=state.homework.find(h=>h.lesson_id===lesson.id&&h.lesson_date===state.date);
  if(hw){
    material.append(el('p','svc-body',hw.body));
    const checked=el('label','svc-check'),input=el('input');input.type='checkbox';input.checked=state.progress.some(p=>p.homework_id===hw.id&&p.done);checked.append(input,el('span','',t('prepared')));
    input.addEventListener('change',()=>saveProgress(input,hw));material.append(checked);
    if(editor())material.append(button('editHomework',()=>homeworkDialog(lesson,state.date,hw),'svc-text-button'));
  }else{material.append(msg('noHomework'));if(editor())material.append(button('addHomework',()=>homeworkDialog(lesson,state.date),'svc-text-button'));}
  const lectures=state.lectures.filter(n=>n.lesson_id===lesson.id&&(!n.lesson_date||n.lesson_date===state.date));
  if(lectures.length){material.append(el('h4','',t('materials')));for(const note of lectures)material.append(noteButton(note));}
  if(editor())material.append(button('addLecture',()=>lectureDialog(null,lesson,state.date),'svc-text-button'));
  card.append(material);return card;
}
async function saveProgress(input,hw){
  const desired=input.checked,sessionId=state.session?.user.id,epoch=state.epoch;input.disabled=true;
  try{unwrap(await client.from('homework_progress').upsert({user_id:sessionId,homework_id:hw.id,done:desired},{onConflict:'user_id,homework_id'}));if(epoch!==state.epoch)return;state.progress=state.progress.filter(p=>p.homework_id!==hw.id);state.progress.push({homework_id:hw.id,done:desired});}
  catch(error){if(epoch===state.epoch){input.checked=!desired;state.error=errorKey(error);render();}}finally{input.disabled=false;}
}
function renderLibrary(){
  root.append(el('h2','svc-title',t('library')));if(!active()){root.append(locked());return;}
  const tools=el('div','svc-toolbar'),search=field(tools,'search','search',state.search,'search');search.addEventListener('input',()=>{state.search=search.value;renderNoteList(list);});
  const subjects=[...new Set(state.lectures.map(n=>n.subject))].sort();
  const subject=field(tools,'subject','subject',state.subject,'select',{choices:[['all',t('allSubjects')],...subjects.map(s=>[s,i18n.content('subjects',s)])]});subject.addEventListener('change',()=>{state.subject=subject.value;renderNoteList(list);});
  if(editor())tools.append(button('addLecture',()=>lectureDialog(),'svc-primary'));root.append(tools);
  const list=el('div','svc-stack');root.append(list);renderNoteList(list);
}
function renderNoteList(list){
  list.replaceChildren();if(!state.privateReady){list.append(msg(state.error?'privateUnavailable':'loading'));return;}
  const query=state.search.toLocaleLowerCase();
  const notes=state.lectures.filter(n=>(state.subject==='all'||n.subject===state.subject)&&(!query||`${n.title} ${n.subject} ${n.body}`.toLocaleLowerCase().includes(query))).sort((a,b)=>String(b.lesson_date||b.updated_at).localeCompare(String(a.lesson_date||a.updated_at)));
  if(!notes.length)list.append(el('div','svc-empty',t('noLectures')));
  for(const note of notes){const card=el('article','svc-card');card.append(el('p','svc-muted',i18n.content('subjects',note.subject)+(note.lesson_date?' · '+fmtDate(note.lesson_date,{day:'numeric',month:'long',year:'numeric'}):'')),noteButton(note));if(!note.published)card.append(el('span','svc-tag',t('draft')));list.append(card);}
}
function noteButton(note){const b=el('button','svc-lecture-link',note.title+(!note.published?' · '+t('draft'):''));b.type='button';b.addEventListener('click',()=>readLecture(note));return b;}
function readLecture(note){
  const box=openDialog('lecture');box.content.append(el('h3','svc-subtitle',note.title),el('p','svc-muted',i18n.content('subjects',note.subject)),el('div','svc-body',note.body));
  if(editor())box.content.append(button('editLecture',()=>{closeDialog(true);lectureDialog(note);},'svc-primary'));
}
function renderAccount(){
  const box=el('section','svc-card svc-account');root.append(box);box.append(el('h2','svc-title',t('account')));
  if(state.recovery){passwordForm(box);return;}
  if(state.session){
    box.append(el('p','',state.membership?.display_name||state.session.user.email),el('p','svc-muted',state.session.user.email||''));
    box.append(msg(!state.membership?'membershipLoading':state.membership.status==='pending'?'pending':state.membership.status==='blocked'?'blocked':'role'+state.membership.role));
    if(!state.membership)box.append(button('requestMembership',()=>requestMembership(),'svc-primary'));
    box.append(button('signOut',async()=>{const {error}=await client.auth.signOut();if(error){state.error=errorKey(error);render();}},'svc-text-button'));
    return;
  }
  if(!client){box.append(msg('setupNeeded'));return;}
  const mode=state.authMode,switches=el('div','svc-account-switch');
  for(const name of ['login','signup','reset']){const b=button(name,()=>{if(authFormDirty&&!confirm(t('discard')))return;authFormDirty=false;state.authMode=name;state.notice='';render();});b.setAttribute('aria-pressed',String(mode===name));switches.append(b);}box.append(switches);
  const form=el('form','svc-form');
  if(mode==='signup')field(form,'yourName','display_name','','text',{required:true,max:100,autocomplete:'name'});
  field(form,'email','email','','email',{required:true,max:254,autocomplete:'email'});
  if(mode!=='reset')field(form,'password','password','','password',{required:true,min:mode==='signup'?8:1,max:128,autocomplete:mode==='signup'?'new-password':'current-password',hint:mode==='signup'?'passwordMinimum':null});
  if(mode==='signup')form.append(msg('signupInfo'));
  const submit=button(mode==='reset'?'sendReset':mode==='signup'?'createAccount':'signIn',()=>{},'svc-primary');submit.type='submit';form.append(submit);const feedback=el('p','svc-message');feedback.setAttribute('role','status');form.append(feedback);box.append(form);
  form.addEventListener('input',()=>{authFormDirty=true;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;const values=readForm(form);submit.disabled=true;feedback.textContent=t('loading');
    try{
      const redirect=window.SERVICE_CONFIG.siteUrl;
      if(mode==='signup'){
        const result=await client.auth.signUp({email:values.email.trim(),password:values.password,options:{data:{display_name:values.display_name.trim()},emailRedirectTo:redirect}});unwrap(result);authFormDirty=false;state.notice=result.data.session?'signupPending':'checkEmail';
        if(result.data.session)await establishSession(result.data.session);else{form.reset();render();}
      }else if(mode==='reset'){unwrap(await client.auth.resetPasswordForEmail(values.email.trim(),{redirectTo:redirect}));authFormDirty=false;state.notice='resetSent';form.reset();render();}
      else {const result=await client.auth.signInWithPassword({email:values.email.trim(),password:values.password});unwrap(result);authFormDirty=false;await establishSession(result.data.session);}
    }catch(error){feedback.textContent=t(errorKey(error));feedback.className='svc-message svc-error';}finally{submit.disabled=false;}
  });
}
function passwordForm(box){
  box.append(msg('newPasswordInfo'));const form=el('form','svc-form');field(form,'newPassword','password','','password',{required:true,min:8,max:128,autocomplete:'new-password'});
  const submit=button('savePassword',()=>{},'svc-primary');submit.type='submit';form.append(submit);const feedback=el('p','svc-message');feedback.setAttribute('role','status');form.append(feedback);box.append(form);
  form.addEventListener('input',()=>{authFormDirty=true;});form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;try{unwrap(await client.auth.updateUser({password:readForm(form).password}));authFormDirty=false;state.recovery=false;state.notice='passwordSaved';render();}catch(error){feedback.textContent=t(errorKey(error));}finally{submit.disabled=false;}});
}
async function requestMembership(){try{unwrap(await client.rpc('request_membership',{p_display_name:state.session.user.user_metadata?.display_name||state.session.user.email?.split('@')[0]||'Student'}));await refresh(true);}catch(error){state.error=errorKey(error);render();}}
function renderMembers(){
  root.append(el('h2','svc-title',t('members')),msg('membersInfo'));const stack=el('div','svc-stack');root.append(stack);
  if(!state.people.length)stack.append(msg(state.error?'privateUnavailable':'noMembers'));
  const order={pending:0,active:1,blocked:2};
  for(const person of [...state.people].sort((a,b)=>(order[a.status]-order[b.status])||a.display_name.localeCompare(b.display_name))){
    const card=el('article','svc-card svc-person'),info=el('div');info.append(el('h3','svc-subtitle',person.display_name),el('p','svc-muted',person.email||''),el('p','svc-muted',t('status'+person.status)+' · '+t('role'+person.role)));card.append(info);
    if(person.role!=='owner'&&person.user_id!==state.session.user.id){const controls=el('div','svc-actions');
      if(person.status!=='active')controls.append(button('approve',()=>updateMember(person,{status:'active'}),'svc-primary'));
      if(person.status==='active')controls.append(button(person.role==='editor'?'makeMember':'makeEditor',()=>updateMember(person,{role:person.role==='editor'?'member':'editor'})));
      if(person.status!=='blocked')controls.append(button('block',()=>{if(confirm(t('confirmBlock',{name:person.display_name})))updateMember(person,{status:'blocked'});}));card.append(controls);}
    stack.append(card);
  }
}
async function updateMember(person,values){try{unwrap(await client.from('memberships').update(values).eq('user_id',person.user_id).select('user_id').single());await refresh(true);}catch(error){state.error=errorKey(error);render();}}
function openDialog(title){
  if(dialog)closeDialog(true);dialog=el('dialog','svc-dialog');dialog.setAttribute('aria-labelledby','svc-dialog-title');dialogDirty=false;
  const head=el('div','svc-dialog-head'),heading=labelNode('h2',title);heading.id='svc-dialog-title';head.append(heading,button('close',()=>closeDialog()));dialog.append(head);
  const content=el('div');dialog.append(content);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});dialog.addEventListener('input',()=>{dialogDirty=true;});dialog.showModal();return{dialog,content};
}
function closeDialog(force=false){if(!dialog)return true;if(!force&&dialogDirty&&!confirm(t('discard')))return false;dialog.close();dialog.remove();dialog=null;dialogDirty=false;return true;}
function editorForm(title,record){
  const box=openDialog(title),form=el('form','svc-form'),error=el('p','svc-message svc-error');error.setAttribute('role','alert');box.content.append(form);return{...box,form,error,record,epoch:state.epoch};
}
function formActions(view,save,remove){
  const actions=el('div','svc-actions'),submit=button('save',()=>{},'svc-primary');submit.type='submit';actions.append(submit,button('cancel',()=>closeDialog()));
  if(remove)actions.append(button('delete',async()=>{if(!confirm(t('confirmDelete')))return;await execute(remove);}));view.form.append(view.error,actions);
  async function execute(action){
    if(view.epoch!==state.epoch&&!active()){closeDialog(true);return;}
    const controls=[...view.form.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);view.error.textContent='';
    try{await action();if(dialog!==view.dialog)return;closeDialog(true);await refresh(true);}
    catch(error){if(dialog===view.dialog){view.error.textContent=t(errorKey(error));controls.forEach(b=>b.disabled=false);}}
  }
  view.form.addEventListener('submit',event=>{event.preventDefault();if(view.form.reportValidity())execute(()=>save(readForm(view.form)));});
}
async function updateExisting(table,row,values){
  let query=client.from(table).update(values).eq('id',row.id);if(row.updated_at)query=query.eq('updated_at',row.updated_at);
  const data=unwrap(await query.select('id'));if(!data?.length)throw{code:'stale'};
}
async function removeExisting(table,row){
  let query=client.from(table).delete().eq('id',row.id);if(row.updated_at)query=query.eq('updated_at',row.updated_at);
  const data=unwrap(await query.select('id'));if(!data?.length)throw{code:'stale'};
}
function homeworkDialog(lesson,date,record){
  if(!editor())return;const view=editorForm(record?'editHomework':'addHomework',record);
  view.form.append(el('p','svc-muted',`${i18n.content('subjects',lesson.subject)} · ${fmtDate(date,{day:'numeric',month:'long',year:'numeric'})} · ${clock(lesson.start_time)}`));
  field(view.form,'homeworkBody','body',record?.body||'','textarea',{required:true,max:12000,rows:7});
  formActions(view,async values=>{const body=values.body.trim();if(!body)throw{code:'empty'};if(record)await updateExisting('homework',record,{body});else unwrap(await client.from('homework').insert({lesson_id:lesson.id,lesson_date:date,body}));},record?()=>removeExisting('homework',record):null);
}
function lectureDialog(record,lesson,date){
  if(!editor())return;const view=editorForm(record?'editLecture':'addLecture',record);
  field(view.form,'lectureTitle','title',record?.title||'','text',{required:true,max:240});
  field(view.form,'subject','subject',record?.subject||lesson?.subject||'','text',{required:true,max:300});
  const lessons=state.lessons.filter(l=>l.active),choices=[['',t('notLinked')],...lessons.map(l=>[l.id,`${i18n.day(DAY_NAMES[l.day_index],true)} ${clock(l.start_time)} · ${i18n.content('subjects',l.subject)}${l.group_name&&l.group_name!=='Общее'?' · '+i18n.group(l.group_name):''}`])];
  if(record?.lesson_id&&!lessons.some(l=>l.id===record.lesson_id))choices.push([record.lesson_id,t('archivedLesson')]);
  field(view.form,'linkedLesson','lesson_id',record?.lesson_id||lesson?.id||'','select',{choices});
  field(view.form,'lectureDate','lesson_date',record?.lesson_date||date||'','date');
  field(view.form,'lectureBody','body',record?.body||'','textarea',{required:true,max:150000,rows:13});
  const check=el('label','svc-check'),publish=el('input');publish.type='checkbox';publish.name='published';publish.checked=record?record.published:true;check.append(publish,labelNode('span','publish'));view.form.append(check,msg('draftInfo'));
  formActions(view,async values=>{
    if(values.lesson_date&&!validDate(values.lesson_date))throw{code:'date'};
    const payload={title:values.title.trim(),subject:values.subject.trim(),body:values.body.trim(),lesson_id:values.lesson_id||null,lesson_date:values.lesson_date||null,published:publish.checked};
    if(!payload.title||!payload.subject||!payload.body)throw{code:'empty'};
    if(record)await updateExisting('lecture_notes',record,payload);else unwrap(await client.from('lecture_notes').insert(payload));
  },record?()=>removeExisting('lecture_notes',record):null);
}
function lessonDialog(record){
  if(!owner())return;const view=editorForm(record?'editLesson':'addLesson',record);view.form.append(msg('recurringWarning'));
  field(view.form,'subject','subject',record?.subject||'','text',{required:true,max:300});
  field(view.form,'day','day_index',record?.day_index??dayIndex(state.date),'select',{choices:DAY_NAMES.map((d,n)=>[n,i18n.day(d)])});
  const row=el('div','svc-form-grid');view.form.append(row);field(row,'start','start_time',clock(record?.start_time)||'09:30','time',{required:true});field(row,'end','end_time',clock(record?.end_time)||'10:20','time',{required:true});
  field(view.form,'lessonType','type',record?.type||'','text',{max:100});field(view.form,'teacher','teacher',record?.teacher||'','text',{max:200});field(view.form,'room','room',record?.room||'','text',{max:120});field(view.form,'group','group_name',record?.group_name||'Общее','text',{max:100});
  field(view.form,'lessonSource','source',record?.source||'academic','select',{choices:[['academic',t('sourceAcademic')],['srsp',i18n.t('schedule.srsp')],['added',t('sourceAdded')]]});
  const check=el('label','svc-check'),conflict=el('input');conflict.type='checkbox';conflict.checked=!!record?.conflict;check.append(conflict,labelNode('span','markConflict'));view.form.append(check);field(view.form,'conflictNote','conflict_note',record?.conflict_note||'','text',{max:600});
  formActions(view,async values=>{
    if(values.start_time>=values.end_time){view.error.textContent=t('timeInvalid');throw{code:'time'};}
    const payload={...values,day_index:Number(values.day_index),subject:values.subject.trim(),conflict:conflict.checked,active:true};
    if(!payload.subject)throw{code:'empty'};
    if(record)await updateExisting('schedule_lessons',record,payload);else unwrap(await client.from('schedule_lessons').insert({...payload,id:'lesson-'+crypto.randomUUID()}));
  },record?()=>updateExisting('schedule_lessons',record,{active:false}):null);
}
async function refresh(force=false){
  if(!client){state.error='setupNeeded';render();return;}
  if(refreshPromise){if(force)refreshPromise.finally(()=>refresh());return refreshPromise;}
  const epoch=state.epoch,uid=state.session?.user.id,start=weekStart(state.date);state.loading=true;state.error='';render();
  refreshPromise=(async()=>{
    try{
      const publicResult=await client.from('schedule_lessons').select('*').eq('active',true).order('day_index').order('start_time');
      if(epoch!==state.epoch)return;
      if(publicResult.error)state.error=errorKey(publicResult.error);else{state.lessons=normalizeLessons(publicResult.data||[]);state.publicFallback=false;}
      if(!uid){clearPrivate();state.updated=new Date();return;}
      const membership=unwrap(await client.from('memberships').select('*').eq('user_id',uid).maybeSingle());
      if(epoch!==state.epoch)return;const previousRole=state.membership?.role;state.membership=membership;
      if(!active()){clearPrivate();closeDialog(true);return;}
      if(['owner','editor'].includes(previousRole)&&membership.role==='member'){state.lectures=[];closeDialog(true);}
      const [hw,notes]=await Promise.all([
        client.from('homework').select('*').gte('lesson_date',start).lte('lesson_date',addDays(start,6)),
        client.from('lecture_notes').select('*').order('updated_at',{ascending:false}).limit(500)
      ]);
      if(epoch!==state.epoch)return;
      const homework=unwrap(hw),lectures=unwrap(notes);
      const progress=unwrap(await client.from('homework_progress').select('homework_id,done').eq('user_id',uid));
      if(epoch!==state.epoch)return;
      state.homework=homework;state.lectures=lectures;state.progress=progress;state.privateReady=true;
      if(owner()){const people=unwrap(await client.from('memberships').select('*').order('created_at'));if(epoch!==state.epoch)return;state.people=people;}
      else state.people=[];
      state.updated=new Date();
    }catch(error){if(epoch===state.epoch){state.error=errorKey(error);if(error?.code==='42501'||error?.status===403){clearPrivate();closeDialog(true);}}}
    finally{if(epoch===state.epoch){state.loading=false;render();}refreshPromise=null;}
  })();return refreshPromise;
}
async function establishSession(session){
  const generation=++authGeneration;
  if(session?.user.id===state.session?.user.id&&session&&state.membership){state.session=session;return;}
  state.epoch++;state.session=session;state.membership=null;clearPrivate();closeDialog(true);authFormDirty=false;state.error='';render();
  if(session){
    try{
      let member=unwrap(await client.from('memberships').select('*').eq('user_id',session.user.id).maybeSingle());
      if(generation!==authGeneration)return;
      if(!member){unwrap(await client.rpc('request_membership',{p_display_name:session.user.user_metadata?.display_name||session.user.email?.split('@')[0]||'Student'}));member=unwrap(await client.from('memberships').select('*').eq('user_id',session.user.id).maybeSingle());}
      if(generation!==authGeneration)return;state.membership=member;
    }catch(error){if(generation===authGeneration)state.error=errorKey(error);}
  }
  if(generation!==authGeneration)return;render();await refresh(true);
}
const themeToggle=document.getElementById('theme-toggle');
function applyTheme(theme){document.documentElement.dataset.theme=theme;themeToggle?.setAttribute('aria-checked',String(theme==='dark'));i18n.syncChrome();}
applyTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
themeToggle?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem('schedule-theme',next);}catch(_){}});
document.getElementById('service-account')?.addEventListener('click',()=>{window.scheduleApp.navigate('schedule');setTab('account');});
window.addEventListener('language:change',()=>{render();if(dialog)dialog.querySelectorAll('[data-svc-text]').forEach(node=>node.textContent=t(node.dataset.svcText));});
window.addEventListener('online',()=>refresh(true));window.addEventListener('offline',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
window.addEventListener('beforeunload',event=>{if(dialogDirty||authFormDirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('service:before-update',event=>{if(dialogDirty||authFormDirty)event.preventDefault();});
setInterval(()=>{if(!document.hidden&&navigator.onLine)refresh();},45000);
render();
if(client){
  client.auth.onAuthStateChange((event,session)=>{
    // Defer work until after the SDK releases its auth callback lock.
    if(event==='PASSWORD_RECOVERY'){state.recovery=true;state.tab='account';window.scheduleApp.navigate('schedule');}
    if(event==='SIGNED_OUT'){state.epoch++;state.session=null;state.membership=null;clearPrivate();closeDialog(true);authFormDirty=false;render();}
    setTimeout(()=>establishSession(session),0);
  });
  client.auth.getSession().then(({data,error})=>{if(error){state.error=errorKey(error);render();}else establishSession(data.session);});
}else state.error='setupNeeded';

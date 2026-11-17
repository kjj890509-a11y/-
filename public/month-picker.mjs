import {validMonth,todayKST} from './domain.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mounted=new WeakMap();
const monthText=value=>validMonth(value)?Number(value.slice(0,4))+'년 '+Number(value.slice(5))+'월':'';
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';
export function renderMonthPicker({id,name='',value='',label='월',required=false,disabled=false,min='1900-01',max='2199-12',rangeStartId='',inputAttributes='',emptyLabel='월 선택',clearLabel='선택 지우기'}){
 return `<div class="month-picker" data-month-picker data-month-label="${esc(label)}" data-month-required="${required}" data-month-min="${esc(min)}" data-month-max="${esc(max)}" data-month-start="${esc(rangeStartId)}" data-month-empty="${esc(emptyLabel)}" data-month-clear-label="${esc(clearLabel)}"><input type="hidden" data-month-value id="${esc(id)}" ${name?`name="${esc(name)}"`:''} value="${esc(value)}" ${disabled?'disabled':''} ${inputAttributes}><button type="button" id="${esc(id)}-button" class="month-picker-trigger ${value?'':'is-empty'}" data-month-trigger aria-haspopup="dialog" aria-expanded="false" aria-controls="moa-month-picker-panel" aria-label="${esc(label+' · '+(monthText(value)||emptyLabel))}" ${required?'aria-required="true"':''} ${disabled?'disabled':''}><span data-month-display>${esc(monthText(value)||emptyLabel)}</span>${icon}</button></div>`;
}
export function syncMonthPicker(input){
 const root=input?.closest('[data-month-picker]');if(!root)return;
 const trigger=root.querySelector('[data-month-trigger]'),text=monthText(input.value)||root.dataset.monthEmpty;
 trigger.querySelector('[data-month-display]').textContent=text;trigger.setAttribute('aria-label',root.dataset.monthLabel+' · '+text);trigger.classList.toggle('is-empty',!input.value);trigger.disabled=input.disabled;
}
const ordinal=value=>Number(value.slice(0,4))*12+Number(value.slice(5))-1;
const fromOrdinal=value=>Math.floor(value/12)+'-'+String(value%12+1).padStart(2,'0');
function limits(document,root){
 const start=document.getElementById(root.dataset.monthStart)?.value,min=validMonth(root.dataset.monthMin)?root.dataset.monthMin:'1900-01',max=validMonth(root.dataset.monthMax)?root.dataset.monthMax:'2199-12';
 return {min:validMonth(start)&&start>min?start:min,max};
}
export function closeMonthPicker(document,{restoreFocus=false}={}){mounted.get(document)?.close(restoreFocus);}
export function mountMonthPickers(document){
 if(mounted.has(document))return mounted.get(document).cleanup;
 const win=document.defaultView;let active=null;
 const close=(restoreFocus=false)=>{
  if(!active)return;const {panel,trigger}=active;active=null;
  try{if(typeof panel.hidePopover==='function')panel.hidePopover();}catch{}
  panel.remove();trigger.setAttribute('aria-expanded','false');if(restoreFocus&&trigger.isConnected)trigger.focus();
 };
 const place=()=>{
  if(!active?.native)return;const {panel,trigger}=active,box=trigger.getBoundingClientRect(),width=Math.min(304,(win.innerWidth||1024)-24);
  panel.style.width=width+'px';const height=panel.getBoundingClientRect().height;
  panel.style.left=Math.max(12,Math.min(box.left,(win.innerWidth||1024)-width-12))+'px';
  panel.style.top=Math.max(12,box.bottom+8+height<=(win.innerHeight||768)-12?box.bottom+8:box.top-height-8)+'px';
  panel.style.maxHeight=Math.max(180,(win.innerHeight||768)-24)+'px';
 };
 const availableFocus=preferred=>{
  const controls=[...active.panel.querySelectorAll('[data-month-option]')].filter(el=>!el.disabled),focus=controls.find(el=>el.dataset.monthOption===preferred)||controls.find(el=>el.getAttribute('aria-pressed')==='true')||controls[0];
  for(const control of controls)control.tabIndex=control===focus?0:-1;focus?.focus();
 };
 const draw=()=>{
  const {panel,root,input,year,invalid}=active,range=limits(document,root),current=todayKST();
  panel.querySelector('[data-month-prev]').disabled=year<=Number(range.min.slice(0,4));panel.querySelector('[data-month-next]').disabled=year>=Number(range.max.slice(0,4));
  const yearInput=panel.querySelector('[data-month-year]');yearInput.min=range.min.slice(0,4);yearInput.max=range.max.slice(0,4);yearInput.setAttribute('aria-invalid',String(Boolean(invalid)));
  const error=panel.querySelector('[data-month-error]');error.textContent=invalid?range.min.slice(0,4)+'~'+range.max.slice(0,4)+'년 사이의 연도를 입력해 주세요.':'';error.hidden=!invalid;
  const grid=panel.querySelector('[data-month-grid]');grid.setAttribute('aria-label',year+'년 월 선택');
  grid.innerHTML=Array.from({length:12},(_,i)=>{const value=year+'-'+String(i+1).padStart(2,'0'),selected=input.value===value;return `<button type="button" data-month-option="${value}" aria-label="${monthText(value)}" aria-pressed="${selected}" ${value===current?'aria-current="date"':''} tabindex="${selected?0:-1}" ${invalid||value<range.min||value>range.max?'disabled':''}>${i+1}월</button>`;}).join('');
  if(!grid.querySelector('[tabindex="0"]:not([disabled])')){const first=grid.querySelector('button:not([disabled])');if(first)first.tabIndex=0;}
  place();
 };
 const setYear=(value,{focus=false,preferred=''}={})=>{
  if(!active)return false;const range=limits(document,active.root),year=Number(value);
  const previousInvalid=active.invalid,previousYear=active.year;active.invalid=!/^\d{4}$/.test(String(value))||year<Number(range.min.slice(0,4))||year>Number(range.max.slice(0,4));
  if(!active.invalid){active.year=year;active.panel.querySelector('[data-month-year]').value=String(year);if(previousYear===year&&!previousInvalid){if(focus)availableFocus(preferred);return true;}}
  draw();if(focus&&!active.invalid)availableFocus(preferred);return !active.invalid;
 };
 const open=trigger=>{
  const root=trigger.closest('[data-month-picker]'),input=root.querySelector('[data-month-value]');if(trigger.disabled||input.disabled)return;
  if(active?.trigger===trigger){close(true);return;}close();
  const range=limits(document,root),initial=validMonth(input.value)?input.value:todayKST(),year=Math.max(Number(range.min.slice(0,4)),Math.min(Number(range.max.slice(0,4)),Number(initial.slice(0,4))));
  const panel=document.createElement('div');panel.id='moa-month-picker-panel';panel.className='month-picker-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',root.dataset.monthLabel+' 선택');panel.tabIndex=-1;
  panel.innerHTML=`<div class="month-picker-heading"><button type="button" class="month-picker-nav" data-month-prev aria-label="이전 연도">‹</button><label class="month-picker-year"><span class="sr-only">${esc(root.dataset.monthLabel)} 연도</span><input type="number" inputmode="numeric" data-month-year aria-label="${esc(root.dataset.monthLabel)} 연도" value="${year}" step="1"><span aria-hidden="true">년</span></label><button type="button" class="month-picker-nav" data-month-next aria-label="다음 연도">›</button><button type="button" class="month-picker-close" data-month-close aria-label="월 선택 닫기">×</button></div><div class="month-picker-grid" data-month-grid role="group"></div><p class="month-picker-error" data-month-error role="alert" hidden></p>${root.dataset.monthRequired==='false'?`<div class="month-picker-footer"><button type="button" class="text-button" data-month-clear>${esc(root.dataset.monthClearLabel)}</button></div>`:''}`;
  root.append(panel);active={root,input,trigger,panel,year,invalid:false,native:typeof panel.showPopover==='function'};
  if(active.native){panel.setAttribute('popover','manual');try{panel.showPopover();}catch{active.native=false;panel.removeAttribute('popover');}}
  if(!active.native)panel.classList.add('month-picker-inline');trigger.setAttribute('aria-expanded','true');draw();availableFocus(input.value||initial);
 };
 const commit=value=>{
  if(!active||active.input.disabled)return close();const {input,root}=active,range=limits(document,root);
  if(value&&(!validMonth(value)||value<range.min||value>range.max))return;
  if(!value&&root.dataset.monthRequired==='true')return;
  input.value=value;syncMonthPicker(input);close(true);
  input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));
 };
 const click=event=>{
  const trigger=event.target.closest?.('[data-month-trigger]');if(trigger){open(trigger);return;}
  if(!active||!active.panel.contains(event.target))return;const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-month-close')){close(true);return;}
  if(button.hasAttribute('data-month-clear')){commit('');return;}
  if(button.hasAttribute('data-month-prev')||button.hasAttribute('data-month-next')){setYear(String(active.year+(button.hasAttribute('data-month-prev')?-1:1)));return;}
  if(button.dataset.monthOption&&setYear(active.panel.querySelector('[data-month-year]').value))commit(button.dataset.monthOption);
 };
 const input=event=>{if(active?.panel.contains(event.target)&&event.target.matches('[data-month-year]')&&/^\d{4}$/.test(event.target.value))setYear(event.target.value);};
 const change=event=>{
  if(event.target.matches?.('[data-month-value]'))syncMonthPicker(event.target);
  if(event.target.matches?.('[data-month-year]')&&active?.panel.contains(event.target))setYear(event.target.value);
 };
 const pointerdown=event=>{if(active&&!active.root.contains(event.target))close();};
 const keydown=event=>{
  const trigger=event.target.closest?.('[data-month-trigger]');
  if(trigger&&!active&&['ArrowDown','Enter',' '].includes(event.key)){event.preventDefault();open(trigger);return;}
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
  if(!active.panel.contains(event.target))return;
  if(event.target.matches('[data-month-year]')&&event.key==='Enter'){event.preventDefault();setYear(event.target.value,{focus:true});return;}
  if(event.key==='Tab'){
   const controls=[...active.panel.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.tabIndex!==-1),index=controls.indexOf(event.target);
   if(event.shiftKey&&index<=0){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&index===controls.length-1){event.preventDefault();controls[0]?.focus();}return;
  }
  const value=event.target.dataset.monthOption;if(!value)return;
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4,PageUp:-12,PageDown:12}[event.key];
  if(offset===undefined&&!['Home','End'].includes(event.key))return;event.preventDefault();
  const range=limits(document,active.root),target=fromOrdinal(Math.max(ordinal(range.min),Math.min(ordinal(range.max),event.key==='Home'?active.year*12:event.key==='End'?active.year*12+11:ordinal(value)+offset)));
  setYear(target.slice(0,4),{focus:true,preferred:target});
 };
 const scroll=()=>{if(active&&!active.trigger.isConnected)close();else place();};
 const handlers={click,input,change,pointerdown,keydown,close:()=>close()};
 for(const [name,handler]of Object.entries(handlers))document.addEventListener(name,handler,true);
 win.addEventListener('resize',place);document.addEventListener('scroll',scroll,true);
 const cleanup=()=>{close();for(const [name,handler]of Object.entries(handlers))document.removeEventListener(name,handler,true);win.removeEventListener('resize',place);document.removeEventListener('scroll',scroll,true);mounted.delete(document);};
 mounted.set(document,{close,cleanup});return cleanup;
}

import {renderFinanceRecordIcon} from './finance-icons.mjs';
import {entryPresets} from './entry-hub.mjs';
import {KINDS,LABELS} from './domain.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='moa-page-coachmarks-v1';
const assets=['deposits','stocks','retirement','loans'];
const allPresets=entryPresets.map(p=>p.id);
const config={
 overview:{label:'홈',scope:KINDS,presets:allPresets,addTarget:'.m-home-add,[href="#entry"]',editTarget:'.m-home-asset-group,.home-stats'},
 entry:{label:'통합 입력·수정',scope:KINDS,presets:allPresets,addTarget:'.entry-mode-tabs,.m-inline-tabs',editTarget:'#entry-manager,.m-record-list,.m-menu-group'},
 workspace:{label:'맞춤 대시보드',scope:KINDS,presets:allPresets,editTarget:'.workspace-grid,.m-workspace-list'},
 assets:{label:'내 자산',scope:assets,presets:assets,editTarget:'.m-account-list,.asset-breakdown,.page-metrics'},
 deposits:{label:'예금·현금',scope:['deposits'],presets:['deposits']},
 stocks:{label:'주식·투자',scope:['stocks'],presets:['stocks']},
 retirement:{label:'퇴직금·연금',scope:['retirement'],presets:['retirement']},
 loans:{label:'대출',scope:['loans'],presets:['loans'],editTarget:'.m-account-list,.loan-management,.loan-overview'},
 cards:{label:'카드 청구',scope:['cards'],presets:['cards'],addTarget:'[data-action="mobile-card-bill"],[data-action="card-account-add"],#card-billing',editTarget:'.m-card-bills,#card-billing'},
 cashflow:{label:'수입·지출',scope:['cashflow'],presets:['salary','income','expense']},
 spending:{label:'가계부',scope:[],presets:[]},
 fixed:{label:'정기 지출',scope:['fixed'],presets:['fixed']},
 planned:{label:'예정 거래',scope:['cashflow'],presets:['planned-income','planned-expense']},
 records:{label:'전체 내역',scope:KINDS,presets:allPresets},
 schedule:{label:'입출금 달력',scope:KINDS,presets:['salary','income','expense','fixed','planned-income','planned-expense'],addTarget:'[data-action="calendar-add"],.m-calendar,.cf-calendar',editTarget:'.m-event-list,.m-detail-section,.cf-agenda'},
 budget:{label:'월 예산',scope:KINDS,presets:allPresets,addTarget:'[data-action="budget-form"],.m-budget-hero',editTarget:'.m-facts,.page-metrics'},
 history:{label:'자산 기록',scope:[],presets:[],addTarget:'[data-action="snapshot-form"]',editTarget:'.m-history-list,.history-view table'},
 forecast:{label:'월말 자산 전망',scope:KINDS,presets:allPresets,addTarget:'.m-forecast-summary,.planning-metrics',editTarget:'.m-detail-section,.forecast-banner'},
 payday:{label:'급여일 자산 전망',scope:KINDS,presets:['salary',...allPresets.filter(p=>p!=='salary')],addTarget:'.m-forecast-summary,.planning-metrics',editTarget:'.m-detail-section,.forecast-banner'},
 advisor:{label:'AI 상담',scope:KINDS,presets:allPresets,addTarget:'.m-consult-status,.advisor-status,.page-header',editTarget:'.m-consultation,.m-advisor,.page-content'},
 statistics:{label:'기간별 분석',scope:KINDS,presets:allPresets},
 menu:{label:'전체 메뉴',scope:KINDS,presets:allPresets,addTarget:'.m-menu-group'}
};
const validKey=key=>typeof key==='string'&&/^(mobile|desktop):[a-z]+(:detail)?$/.test(key)&&Object.hasOwn(config,key.split(':')[1]);
export const coachmarkViews=Object.keys(config);
export function createCoachmarkState(storage){
 let seen=[];try{const value=JSON.parse(storage?.getItem(storageKey)||'[]');if(Array.isArray(value))seen=value.filter(validKey).slice(0,100);}catch{}
 return{seen:new Set(seen),storage,activeKey:'',step:0,picker:null};
}
function coachmarkFrame({width,height,mobile,frame,viewport}){
 const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
 const right=left+(viewport?.width||width),bottom=top+(viewport?.height||height);
 if(mobile&&frame?.width>0){
  const start=Math.max(left,frame.left),end=Math.min(right,frame.right);
  if(end>start)return {left:start,right:end,top,bottom};
 }
 return {left,right,top,bottom};
}

export function coachmarkPosition(target,options){
 const {panelHeight=240,mobile=false,navTop}=options;
 const frame=coachmarkFrame(options);
 const navVisible=navTop>frame.top&&navTop<=frame.bottom;
 const spotBottom=navVisible?navTop:frame.bottom;
 const reservedBottom=navVisible?12:mobile&&navTop==null?102:0;
 const bottomLimit=Math.max(frame.top+1,spotBottom-reservedBottom);
 const availableHeight=bottomLimit-frame.top;
 const horizontalInset=Math.min(16,(frame.right-frame.left)/4);
 const verticalInset=Math.min(16,availableHeight/4);
 const leftEdge=frame.left+horizontalInset,rightEdge=frame.right-horizontalInset;
 const topEdge=frame.top+verticalInset,bottomEdge=bottomLimit-verticalInset;
 const cardWidth=Math.min(360,rightEdge-leftEdge);
 const visibleTarget=target&&target.left+target.width>frame.left&&target.left<frame.right
  &&target.bottom>frame.top&&target.top<bottomLimit;
 const center=visibleTarget?target.left+target.width/2:(frame.left+frame.right)/2;
 const left=Math.max(leftEdge,Math.min(rightEdge-cardWidth,center-cardWidth/2));

 const fullHeight=Math.max(1,bottomEdge-topEdge);
 const desiredHeight=Math.min(panelHeight,fullHeight);
 const above=visibleTarget?Math.max(0,Math.min(bottomEdge,target.top-12)-topEdge):0;
 const below=visibleTarget?Math.max(0,bottomEdge-Math.max(topEdge,target.bottom+12)):0;
 let maxHeight=fullHeight,top=topEdge;
 if(below>=desiredHeight||(below>=144&&below>=above)){
  maxHeight=below;
  top=bottomEdge-below;
 }else if(above>=desiredHeight||above>=144){
  maxHeight=above;
  top=topEdge+above-Math.min(desiredHeight,above);
 }else if(visibleTarget){
  top=topEdge+(fullHeight-desiredHeight)/2;
 }
 return {left,top,width:cardWidth,maxHeight,frame,spotBottom};
}
const saveStep=[{title:'저장 후 다른 화면에도 반영',body:'입력 창의 저장하기를 눌러야 내 계정에 반영됩니다. 같은 계정의 PC·모바일이 이 내역을 함께 사용합니다. 안내를 다시 보려면 입력·수정 안내를 누르세요.',target:'[data-mobile-sync],#save-state'}];
function stepsFor(view,detail,mobile){
 const page=config[view],lastStep=view==='entry'&&!mobile?[{title:'변경 목록을 저장하세요',body:'기존 내역 수정은 변경 목록에 담은 뒤 변경 저장을 눌러 일괄 반영합니다. 새 내역은 입력 창에서 저장합니다.',target:'#entry-manager'}]:saveStep;
 if(detail)return[{title:'이 내역 수정하기',body:'수정 버튼에서 현재 내역을 열 수 있습니다. 값을 바꾼 뒤 저장하기를 눌러 반영하세요.',action:'edit',label:'이 내역 수정',target:'[data-action="edit"],.m-balance-hero'},...lastStep];
 if(view==='history')return[{title:'월별 자산 기록 남기기',body:'선택한 월의 잔액을 기록합니다. 과거 월은 당시의 실제 잔액을 입력하세요.',action:'add',label:'자산 기록 입력',target:page.addTarget},{title:'기존 월 기록 수정하기',body:'수정할 월을 선택하면 저장된 기록이 열립니다.',action:'edit',label:'기록 선택',target:page.editTarget},...lastStep];
 if(view==='budget')return[{title:'이달 예산 입력·수정',body:'화면에서 선택한 월의 지출 한도와 저축 목표를 입력합니다. 기존 값이 있으면 수정할 수 있습니다.',action:'budget',label:'선택한 월 예산 열기',target:page.addTarget},{title:'지출 계획 수정하기',body:'수입·지출, 대출, 카드 내역을 고치면 예산과 전망에도 함께 반영됩니다.',action:'edit',label:'수정할 내역 선택',target:page.editTarget},...lastStep];
 if(view==='spending')return[
  {title:'실제 생활비 기록하기',body:'월을 선택하고 실제로 낸 고정비와 기타 생활비 합계를 적으세요.',target:'.spending-record'},
  {title:'월 단위로 반영하기',body:'반영을 선택하면 그 달의 생활비 계획을 가계부 합계로 대체합니다. 미반영으로 바꿔도 기록은 보관됩니다.',target:'.spending-apply'}
 ];
 const derived=['forecast','payday','advisor','statistics','workspace'].includes(view);
 return[{title:derived?'계산에 쓸 데이터 입력':view==='cards'?'카드와 월별 청구 입력':page.label+'에 내역 추가',body:derived?'이 화면의 결과는 등록한 자산과 수입·지출로 계산합니다. 필요한 내역을 여기서 바로 입력하세요.':view==='cards'?'카드는 한 번 등록하고, 등록한 카드를 선택해 매월 청구액을 입력할 수 있습니다.':'입력할 종류를 선택하면 이 화면에서 입력 창이 열립니다. 저장 전에는 내역이 추가되지 않습니다.',action:'add',label:'입력 시작',target:page.addTarget||'[data-action="add"],[data-action="add-planned"],.table-heading,.m-count-strip'},
 {title:'저장된 내역 수정',body:view==='entry'&&!mobile?'수정할 내역을 고른 뒤 변경 목록에 담으세요. 변경 저장을 누르면 한꺼번에 반영됩니다.':derived?'결과 금액을 직접 덮어쓰지 않고, 계산의 기준이 되는 내역을 선택해 수정합니다.':'수정할 내역을 직접 고르세요. 이름·금융기관으로 검색할 수 있고, 취소하면 기존 값이 유지됩니다.',action:'edit',label:'수정할 내역 선택',target:page.editTarget||'.m-account-list,.m-flow-list,.m-record-list,[data-ledger-scope],table'},...lastStep];
}
export function mountCoachmarks(root,state,{view,mobile=false,recordId='',getData,money,onStart,onEdit,onPlan,onCardAccount,onCardBill,onQuickAdd}){
 if(!Object.hasOwn(config,view))return()=>{};
 const doc=root.ownerDocument,win=doc.defaultView,page=config[view],key=(mobile?'mobile:':'desktop:')+view+(recordId?':detail':''),steps=stepsFor(view,Boolean(recordId),mobile);
 const quickLaunch=mobile&&onQuickAdd?root.querySelector('[data-asset-manage]'):null;
 const quickKind=quickLaunch?.dataset.assetManage;
 let portal=null,picker=null,focusBefore=null;
 const launch=doc.createElement('button');launch.type='button';launch.className='coach-launch';launch.dataset.coachOpen='';launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','coach-card');launch.setAttribute('aria-expanded','false');launch.innerHTML='<span aria-hidden="true">?</span> 입력·수정 안내';
 let bar=null,createdActions=null,host=mobile?null:root.querySelector('.page-header .heading-actions');
 if(!mobile&&!host){const header=root.querySelector('.page-header');if(header){createdActions=doc.createElement('div');createdActions.className='heading-actions';header.append(createdActions);host=createdActions;}}
 if(!host){bar=doc.createElement('div');bar.className='coach-launchbar';const header=mobile?root.querySelector('.m-header,.m-home-header,.m-menu-header'):root.querySelector('.page-header');if(header)header.after(bar);else root.prepend(bar);host=bar;}
 host.append(launch);
 const markSeen=()=>{state.seen.add(key);try{state.storage?.setItem(storageKey,JSON.stringify([...state.seen].filter(validKey).slice(-100)));}catch{}};
 const removePortal=()=>{portal?.remove();portal=null;};
 const close=(restore=true)=>{state.activeKey='';markSeen();removePortal();launch.setAttribute('aria-expanded','false');if(restore&&(focusBefore?.isConnected||launch.isConnected))(focusBefore?.isConnected?focusBefore:launch).focus?.();};
 const targetFor=step=>{
  if(quickLaunch&&step?.action==='add')return quickLaunch;
  const selector=step?.target;if(!selector)return launch;
  const candidates=[...root.querySelectorAll(selector)];if(selector.includes('#save-state')){const status=doc.getElementById('save-state');if(status)candidates.push(status);}
  return candidates.find(el=>!el.closest('[hidden]')&&(!el.getClientRects||el.getClientRects().length>0))||launch;
 };
 const position=()=>{
  if(!portal)return;
  const panel=portal.querySelector('.coach-card'),target=targetFor(steps[state.step]);
  const rect=target.getBoundingClientRect?.();
  const navRect=mobile?root.querySelector('.m-tabbar')?.getBoundingClientRect?.():null;
  const options={width:win?.innerWidth||393,height:win?.innerHeight||852,mobile,
   viewport:win?.visualViewport,frame:mobile?root.getBoundingClientRect?.():null,
   navTop:navRect?.height?navRect.top:undefined};
  const initial=coachmarkPosition(null,options),frame=initial.frame;
  Object.assign(portal.style,{left:frame.left+'px',top:frame.top+'px',
   width:(frame.right-frame.left)+'px',height:(frame.bottom-frame.top)+'px'});

  // Measure wrapped text after applying the width of the visible app frame.
  Object.assign(panel.style,{width:initial.width+'px',maxHeight:initial.maxHeight+'px'});
  const panelHeight=panel.offsetHeight||240;
  const pos=coachmarkPosition(rect,{...options,panelHeight});
  Object.assign(panel.style,{left:(pos.left-frame.left)+'px',top:(pos.top-frame.top)+'px',maxHeight:pos.maxHeight+'px'});

  const spot=portal.querySelector('.coach-spotlight');
  spot.hidden=true;
  if(rect?.width>0&&rect.height>0){
   const left=Math.max(frame.left+4,rect.left-5),top=Math.max(frame.top+4,rect.top-5);
   const right=Math.min(frame.right-4,rect.right+5),bottom=Math.min(pos.spotBottom,rect.bottom+5);
   const overlaps=left<pos.left+pos.width&&right>pos.left&&top<pos.top+Math.min(panelHeight,pos.maxHeight)&&bottom>pos.top;
   if(right>left&&bottom>top&&!overlaps){
    spot.hidden=false;
    Object.assign(spot.style,{left:(left-frame.left)+'px',top:(top-frame.top)+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   }
  }
  portal.classList.toggle('coach-unanchored',spot.hidden);
 };
 const draw=(scroll=true)=>{
  removePortal();const step=steps[state.step];if(!step)return close();
  portal=doc.createElement('div');portal.className='coach-portal';portal.innerHTML=`<div class="coach-spotlight" aria-hidden="true" hidden></div><section class="coach-card" id="coach-card" role="dialog" aria-modal="false" aria-labelledby="coach-title" aria-describedby="coach-body"><header><span>${esc(page.label)} · ${state.step+1}/${steps.length}</span><button type="button" data-coach="close" aria-label="안내 닫기">×</button></header><h2 id="coach-title">${esc(step.title)}</h2><p id="coach-body">${esc(step.body)}</p>${step.action?`<button type="button" class="coach-primary" data-coach="act">${esc(step.label)}</button>`:''}<footer>${state.step?'<button type="button" data-coach="previous">이전</button>':'<button type="button" data-coach="close">나중에</button>'}<button type="button" data-coach="next">${state.step===steps.length-1?'안내 마치기':'다음'}</button></footer></section>`;
  doc.body.append(portal);portal.addEventListener('click',controls);launch.setAttribute('aria-expanded','true');if(scroll)targetFor(step).scrollIntoView?.({block:'center',behavior:'auto'});position();portal.querySelector('[data-coach="act"],[data-coach="next"]')?.focus?.({preventScroll:true});
 };
 const open=()=>{if(doc.querySelector('dialog[open]'))return;focusBefore=doc.activeElement?.matches?.('button,a,input,select,textarea,[tabindex]')?doc.activeElement:launch;state.activeKey=key;state.step=0;markSeen();draw();};
 const closePicker=()=>{
  state.picker=null;
  if(!picker)return;
  const opener=picker.classList.contains('asset-manage-picker')?quickLaunch:launch;
  picker.close?.();picker.remove();picker=null;opener?.focus?.();
 };
 const execute=choice=>{
  closePicker();
  if(choice.type==='preset')onStart(choice.id);
  else if(choice.type==='plan')onPlan(choice.kind,choice.id);
  else if(choice.type==='card-account')onCardAccount(choice.id);
  else if(choice.type==='card-bill')onCardBill(choice.id);
  else onEdit(choice.kind,choice.id);
 };
 const addChoices=()=>{
  const rows=page.presets.map(id=>entryPresets.find(p=>p.id===id)).filter(Boolean).map(p=>({type:'preset',id:p.id,label:p.label,sub:p.note}));
  if(view==='cards'){const profiles=(getData().cardAccounts||[]).filter(r=>!r.archived);return[{type:'card-account',id:'',label:'카드 등록',sub:'한 번 등록한 카드로 매월 청구액을 입력합니다'},...profiles.map(p=>({type:'card-bill',id:p.id,label:p.name,sub:'월별 청구액 입력'})),...rows];}
  return rows;
 };
 const editChoices=(scope=page.scope,withIcons=false)=>{
  const data=getData();
  if(view==='history')return[...(data.snapshots||[])].sort((a,b)=>b.month.localeCompare(a.month)).map(r=>({type:'plan',kind:'snapshot',id:r.month,label:r.month+' 자산 기록',sub:r.asOf}));
  const rows=scope.flatMap(kind=>(data[kind]||[]).filter(r=>!recordId||r.id===recordId).map(r=>({type:'record',kind,id:r.id,label:r.name,icon:withIcons?renderFinanceRecordIcon(kind,r):'',sub:[LABELS[kind],r.institution,r.dueDate||r.date].filter(Boolean).join(' · '),amount:money(r.balance??r.valuation??r.amount??0)})));
  if(view==='cards'&&!recordId)rows.push(...(data.cardAccounts||[]).filter(r=>!r.archived).map(r=>({type:'card-account',id:r.id,label:r.name,sub:'카드 기본 정보 수정'})));
  if(['loans','statistics','records'].includes(view)&&!recordId)rows.push(...(data.loanPayments||[]).map(r=>({type:'record',kind:'loan-payment',id:r.id,label:r.name||'대출 상환 기록',sub:r.date||r.month||''})));
  return rows;
 };
 const choose=(mode,query='')=>{
  close(false);
  if(mode==='budget')return onPlan('budget','');
  if(mode==='add'&&view==='history')return onPlan('snapshot','');
  const managing=mode==='manage';
  if(managing&&!assets.includes(quickKind))return;
  const choices=mode==='add'?addChoices():managing?editChoices([quickKind],true).filter(row=>row.kind===quickKind):editChoices();
  if(mode==='add'&&choices.length===1)return execute(choices[0]);
  if(mode==='edit'&&recordId&&choices.length===1)return execute(choices[0]);
  if(doc.querySelector('dialog[open]'))return;
  const title=managing?config[quickKind].label+' 관리':mode==='add'?'입력할 종류 선택':'수정할 내역 선택';
  const searchable=mode==='edit'||(managing&&choices.length>0);
  picker=doc.createElement('dialog');
  picker.className=managing?'coach-picker asset-manage-picker':'coach-picker';
  picker.setAttribute('aria-labelledby','coach-picker-title');
  picker.innerHTML=`<header><h2 id="coach-picker-title">${esc(title)}</h2>
   <button type="button" data-coach-picker-close aria-label="선택 창 닫기">×</button></header>
   ${managing?'<button type="button" class="asset-manage-add" data-asset-quick-add>＋ 새 내역 추가</button><h3>기존 내역 수정</h3>':''}
   ${searchable?'<label class="coach-picker-search"><span class="sr-only">이름·금융기관 검색</span><input type="search" placeholder="이름·금융기관 검색" data-coach-search></label>':''}
   <p class="coach-picker-count" role="status"></p><div class="coach-picker-list"></div>
   ${managing?'':`<p class="coach-picker-note">${mode==='add'?'선택하면 입력 창이 열립니다.':'선택한 내역의 수정 창이 열립니다.'} 저장 전에는 변경되지 않습니다.</p>`}`;
  const list=picker.querySelector('.coach-picker-list'),count=picker.querySelector('.coach-picker-count');
  const renderChoices=query=>{
   const visible=choices.map((row,index)=>({row,index})).filter(({row})=>[row.label,row.sub].join(' ').toLowerCase().includes(query.toLowerCase()));
   count.textContent=visible.length>100?`${visible.length}건 중 100건 표시 · 이름을 검색해 범위를 좁혀 주세요.`:`${visible.length}건`;
   count.hidden=!searchable;
   list.innerHTML=visible.length?visible.slice(0,100).map(({row,index})=>`<button type="button" data-coach-choice="${index}">
    <span class="coach-picker-text">${row.icon||''}<span><strong>${esc(row.label)}</strong><small>${esc(row.sub)}</small></span></span>${row.amount?`<b>${esc(row.amount)}</b>`:''}
    <span aria-hidden="true">›</span></button>`).join(''):`<p class="coach-picker-empty">${choices.length?'검색 결과가 없습니다.':'아직 등록된 내역이 없습니다.'}</p>`;
  };
  state.picker={key,mode,query};renderChoices(query);const search=picker.querySelector('[data-coach-search]');if(search)search.value=query;doc.body.append(picker);
  picker.addEventListener('click',e=>{if(e.target.closest('[data-coach-picker-close]'))return closePicker();if(e.target.closest('[data-asset-quick-add]')){closePicker();onQuickAdd(quickKind);return;}const button=e.target.closest('[data-coach-choice]');if(button){const choice=choices[Number(button.dataset.coachChoice)];if(choice)execute(choice);}});
  picker.addEventListener('input',e=>{if(e.target.matches('[data-coach-search]')){state.picker.query=e.target.value;renderChoices(e.target.value);}});
  picker.addEventListener('cancel',e=>{e.preventDefault();closePicker();});if(picker.showModal)picker.showModal();else picker.setAttribute('open','');picker.querySelector(managing?'[data-asset-quick-add]':'input,button[data-coach-choice],button')?.focus?.();
 };
 function controls(e){const button=e.target.closest('[data-coach]');if(!button)return;const type=button.dataset.coach;if(type==='close')return close();if(type==='act')return choose(steps[state.step].action);if(type==='previous')state.step=Math.max(0,state.step-1);if(type==='next'){if(state.step===steps.length-1)return close();state.step++;}draw();}
 const keydown=e=>{if(e.key==='Escape'&&portal){e.preventDefault();close();}};
 const externalClick=e=>{if(portal&&!e.target.closest('.coach-portal,.coach-launch'))close(false);};
 const openQuick=()=>choose('manage');
 quickLaunch?.addEventListener('click',openQuick);
 launch.addEventListener('click',open);doc.addEventListener('keydown',keydown);doc.addEventListener('click',externalClick,true);win?.addEventListener('resize',position);win?.addEventListener('scroll',position,true);
 const visualViewport=win?.visualViewport;
 visualViewport?.addEventListener('resize',position);
 visualViewport?.addEventListener('scroll',position);
 if(state.activeKey&&state.activeKey!==key)state.activeKey='';
 if(state.picker&&state.picker.key!==key)state.picker=null;
 if(state.picker?.key===key)choose(state.picker.mode,state.picker.query);else if(state.activeKey===key&&!doc.querySelector('dialog[open]'))draw(false);else if(!state.seen.has(key)&&!doc.querySelector('dialog[open]'))open();
 return()=>{removePortal();if(picker){picker.close?.();picker.remove();picker=null;}quickLaunch?.removeEventListener('click',openQuick);launch.removeEventListener('click',open);launch.remove();bar?.remove();createdActions?.remove();doc.removeEventListener('keydown',keydown);doc.removeEventListener('click',externalClick,true);win?.removeEventListener('resize',position);win?.removeEventListener('scroll',position,true);visualViewport?.removeEventListener('resize',position);visualViewport?.removeEventListener('scroll',position);};
}

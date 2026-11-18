import {contextTip} from './context-tips.mjs';
import {totals, todayKST, paymentDate, forecastMonths, snapshotTotals, budgetPlan, paydayForecasts, validateDashboard} from './domain.mjs';
import {buildStatistics, statisticsKinds, statisticsMetrics, statisticsBases, statisticsOptions, statisticsPeriod, statisticsSeries, metricsForKind} from './statistics.mjs';
import {renderTrendChart} from './chart.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;
const workspaceDragDots='<span class="drag-nine-dots" aria-hidden="true">'+Array.from({length:9},()=>'<i></i>').join('')+'</span>';
const info=contextTip;
const button=(action,label,extra='')=>`<button type="button" class="button secondary small" data-board-action="${action}" ${extra}>${label}</button>`;
const common={type:'analysis',title:'내 통계',kind:'all',metric:'expense',bank:'',item:'',query:'',basis:'all',display:'trend',width:'standard'};
export const widgetTemplates=[
 {key:'cashflow',name:'수입과 지출',description:'같은 기간의 수입, 지출·상환액과 차액',config:{...common,title:'수입과 지출'}},
 {key:'loans',name:'대출 원금·이자',description:'은행이나 대출을 골라 상환액을 비교',config:{...common,title:'대출 원금·이자',kind:'loans',metric:'loanPayment'}},
 {key:'expenses',name:'지출 항목별 합계',description:'도치·보험·카드 등 항목별 지출',config:{...common,title:'지출 항목별 합계',kind:'expense',display:'breakdown'}},
 {key:'pension',name:'회사 퇴직연금 납입',description:'예금 입출금과 구분한 회사 납입 일정',config:{...common,title:'회사 퇴직연금 납입',kind:'retirement',metric:'retirementContribution',basis:'scheduled'}},
 {key:'custom',name:'맞춤 통계',description:'기간·은행·항목·금액 종류를 직접 선택',config:{...common}},
 {key:'composition',name:'보유 자산 구성',description:'현재 주식·예금·퇴직연금의 구성',config:{...common,type:'composition',title:'보유 자산 구성'}},
 {key:'forecast',name:'앞으로의 예금 잔액',description:'향후 12개월의 입출금 반영 잔액',config:{...common,type:'forecast',title:'앞으로의 예금 잔액'}},
 {key:'history',name:'기록한 순자산',description:'저장된 기준일의 실제 자산 기록',config:{...common,type:'history',title:'기록한 순자산'}},
 {key:'budget',name:'이번 달 지출 한도',description:'등록 지출과 직접 정한 한도 비교',config:{...common,type:'budget',title:'이번 달 지출 한도'}},
 {key:'payday',name:'다음 급여일 잔액',description:'다음 월급일이 끝났을 때의 예금 잔액',config:{...common,type:'payday',title:'다음 급여일 잔액'}},
 {key:'schedule',name:'다가오는 입출금',description:'오늘 이후 30일간 등록 일정과 대출 예상',config:{...common,type:'schedule',title:'다가오는 입출금'}}
];
export function defaultDashboard(today=todayKST()){
 return {version:1,period:{preset:'month',...statisticsPeriod('month',today.slice(0,7),today)},widgets:widgetTemplates.slice(0,4).map(template=>({...template.config,id:template.key}))};
}
export function dashboardPeriod(period,today=todayKST()){
 return period.preset==='custom'?{...period}:{preset:period.preset,...statisticsPeriod(period.preset,period.preset==='year'?today.slice(0,4):today.slice(0,7),today)};
}
export function createWorkspaceState(){return {editing:false,draft:null,period:null,dialog:'',editor:null,saving:false,error:''};}
export function dashboardConfig(data,state,today=todayKST()){
 const config=state.draft||data.dashboard||defaultDashboard(today);
 return {...config,period:state.period||dashboardPeriod(config.period,today)};
}
export function reorderWidgets(widgets,ids){
 const byId=new Map(widgets.map(widget=>[widget.id,widget]));
 if(ids.length!==widgets.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))return widgets;
 return ids.map(id=>byId.get(id));
}
function facts(items,money){return `<dl class="workspace-facts">${items.map(([label,value])=>`<div><dt>${label}</dt><dd>${typeof value==='number'?money(value):esc(value)}</dd></div>`).join('')}</dl>`;}
function bars(items,money){
 const max=Math.max(1,...items.map(row=>row.value));
 return `<div class="workspace-bars">${items.map(row=>`<div class="workspace-bar"><div><span>${esc(row.label)}</span><strong>${money(row.value)}</strong></div><div class="workspace-track" aria-hidden="true"><i style="width:${Math.max(0,row.value/max*100)}%"></i></div></div>`).join('')||'<p class="workspace-empty">합산할 금액이 없습니다.</p>'}</div>`;
}
function sourceDetails(result,money){
 return `<details class="workspace-sources"><summary>집계 기준·금액 확인</summary><p>등록 일정은 실제 입출금 완료를 뜻하지 않습니다. 과거 대출은 직접 남긴 상환 기록만 포함합니다. 회사 퇴직연금 납입은 예금 수입·지출에서 제외합니다.</p>${Object.entries(result.sources).filter(([,s])=>s.count).map(([key,s])=>`<div><strong>${esc(statisticsBases[key])} · ${s.count}건</strong>${facts([['수입',s.income],['지출·상환',s.expense],...(s.retirementContribution?[['회사 연금 납입',s.retirementContribution]]:[])],money)}</div>`).join('')}${result.totals.cardIncluded?`<p>카드 청구에 포함된 ${money(result.totals.cardIncluded)}은 지출 합계에서 중복 제외했습니다. 해당 카드 청구액을 등록해야 총지출에 반영됩니다.</p>`:''}</details>`;
}
function widgetContent(data,widget,period,{formatMoney,formatCompact,today}){
 const money=value=>esc(formatMoney(value));
 const chart=(points,title,seriesLabel=title)=>renderTrendChart(points,{formatMoney,formatCompact,title,seriesLabel});
 const t=totals(data);
 if(widget.type==='analysis'){
  const filters={...period,...widget};
  const result=buildStatistics(data,filters,today),s=result.totals;
  const options=statisticsOptions(data,widget.kind,widget.bank),selectedItem=options.find(item=>item.key===widget.item);
  const scope=[statisticsKinds[widget.kind],widget.bank,widget.item?(selectedItem?.name||'삭제된 항목'):null,widget.query?`검색: ${widget.query}`:null].filter(Boolean).map(esc).join(' · ');
  const value=s[widget.metric],groups=result.groups.filter(row=>row[widget.metric]>0).sort((a,b)=>b[widget.metric]-a[widget.metric]);
  return `<div class="widget-filter-label">${scope}</div><div class="widget-total"><span>${esc(statisticsMetrics[widget.metric])}</span><strong>${result.rows.length?money(value):'내역 없음'}</strong></div>${widget.kind==='all'?facts([['수입',s.income],['지출·상환',s.expense],['차액',s.income-s.expense]],money):widget.kind==='loans'?facts([['상환 원금',s.principal],['이자',s.interest]],money):widget.kind==='retirement'?'<p class="widget-context">회사 납입 일정 · 예금 잔액과 별도</p>':''}
  ${!result.rows.length?'<p class="workspace-empty">선택한 기간·조건에 등록된 내역이 없습니다. 과거 대출은 상환 기록을 추가해 주세요.</p>':widget.display==='breakdown'?bars(groups.slice(0,6).map(row=>({label:row.name,value:row[widget.metric]})),money)+(groups.length>6?`<details class="workspace-sources"><summary>나머지 ${groups.length-6}개 항목</summary>${bars(groups.slice(6).map(row=>({label:row.name,value:row[widget.metric]})),money)}</details>`:''):chart(statisticsSeries(result,widget.metric),widget.title,statisticsMetrics[widget.metric])}
  <span class="widget-basis">${esc(statisticsBases[widget.basis])} · ${result.rows.length}건</span>${sourceDetails(result,money)}`;
 }
 if(widget.type==='composition')return `<div class="widget-total"><span>총자산 · 부채 차감 전</span><strong>${money(t.gross)}</strong></div>${bars([['주식',t.stock],['예금',t.deposits],['퇴직연금·퇴직금',t.retirement]].map(([label,value])=>({label,value})),money)}${facts([['주식 평가손익',t.profit],['대출 잔액',t.loans],['미결제 카드',t.cards]],money)}`;
 if(widget.type==='forecast'){
  const rows=forecastMonths(data,today,12);
  return `<div class="widget-total"><span>${rows.at(-1).month} 말 예금 잔액</span><strong>${money(rows.at(-1).deposits)}</strong></div>${chart(rows.map(row=>({label:row.month.slice(2).replace('-','.'),detailLabel:paymentDate(row.month,31),value:row.deposits,forecast:true})),widget.title,'예금 잔액 예상')}${rows.some(row=>row.cashShortage)?'<p class="workspace-alert">예금이 부족해지는 달이 있습니다.</p>':''}<a class="panel-link" href="#forecast">월별 전망·계산 기준 보기 ↗</a>`;
 }
 if(widget.type==='history'){
  const rows=[...(data.snapshots||[])].sort((a,b)=>a.asOf.localeCompare(b.asOf)).slice(-12);
  return rows.length?`${chart(rows.map(row=>({label:row.month.slice(2).replace('-','.'),detailLabel:row.asOf,value:snapshotTotals(row).net,forecast:false})),widget.title,'기록된 순자산')}<a class="panel-link" href="#history">전체 자산 기록 ↗</a>`:'<p class="workspace-empty">저장된 자산 기록이 없습니다.</p><a class="panel-link" href="#history">자산 기록 남기기 ↗</a>';
 }
 if(widget.type==='budget'){
  const p=budgetPlan(data,today.slice(0,7));
  return `<div class="widget-total"><span>지출 한도에서 남는 금액</span><strong>${p.limit===null?'한도 미설정':money(p.remaining)}</strong></div>${facts([['지출 한도',p.limit===null?'미설정':p.limit],[p.actualApplied?'집계 지출':'등록 지출 계획',p.expense],['등록 수입 계획',p.income],['저축 목표',p.target||0]],money)}<a class="panel-link" href="#budget">수입·지출 계획 설정 ↗</a>`;
 }
 if(widget.type==='payday'){
  const row=paydayForecasts(data,today,1)[0];
  return row?`<div class="widget-total"><span>${row.date} 하루 종료 기준</span><strong>${money(row.deposits)}</strong></div>${facts([['당일 월급',row.salaryAmount],['예상 순자산',row.net]],money)}<a class="panel-link" href="#payday">급여일별 잔액 보기 ↗</a>`:'<p class="workspace-empty">앞으로 받을 월급 일정이 없습니다.</p><a class="panel-link" href="#cashflow">급여 일정 등록 ↗</a>';
 }
 const start=new Date(new Date(today+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10),end=new Date(new Date(today+'T00:00:00Z').getTime()+30*86400000).toISOString().slice(0,10);
 const rows=buildStatistics(data,{start,end},today).rows.filter(row=>row.status!=='결제 완료'&&!row.informational&&row.type!=='retirement').sort((a,b)=>a.date.localeCompare(b.date));
 return `<div class="workspace-events">${rows.slice(0,6).map(row=>`<div><span><strong>${esc(row.name)}</strong><small>${row.date} · ${esc(row.status)}</small></span><b>${money(row.amount)}</b></div>`).join('')||'<p class="workspace-empty">앞으로 30일 안의 일정이 없습니다.</p>'}</div><a class="panel-link" href="#schedule">입출금 달력 보기 ↗</a>`;
}
const scopeLabel=(widget,period,today)=>widget.type==='analysis'?`${period.start.replaceAll('-','.')} – ${period.end.replaceAll('-','.')}`:widget.type==='composition'?`${today} · 등록 잔액`:widget.type==='history'?'저장된 최근 12개 기록':widget.type==='forecast'?'오늘 이후 · 향후 12개월':widget.type==='budget'?today.slice(0,7)+' · 이번 달':widget.type==='schedule'?'오늘 이후 · 30일':'다음 급여일 · 예상';
function renderWidget(data,widget,index,config,state,options){
 let content;try{content=widgetContent(data,widget,config.period,options);}catch(error){content=`<p class="workspace-alert" role="alert">${esc(error.message)}</p>`;}
 return `<article class="panel workspace-widget ${widget.width==='wide'?'widget-wide':''}" data-widget-id="${esc(widget.id)}" aria-label="${esc(widget.title)}"><header class="workspace-widget-header"><div><span class="widget-period">${scopeLabel(widget,config.period,options.today)}</span><h3>${esc(widget.title)}</h3></div>${`<button type="button" class="widget-handle" aria-label="${esc(widget.title)} 순서 이동. 위아래 방향키로 이동" aria-describedby="workspace-drag-help">${workspaceDragDots}</button>`}</header><div class="workspace-widget-body">${content}</div>${`<div class="widget-edit-actions">${button('width',widget.width==='wide'?'기본 너비':'넓게',`data-id="${esc(widget.id)}"`)}${button('duplicate','복제',`data-id="${esc(widget.id)}"`)}${button('configure','조건 수정',`data-id="${esc(widget.id)}"`)}${button('move-up','앞으로',`data-id="${esc(widget.id)}" ${index===0?'disabled':''}`)}${button('move-down','뒤로',`data-id="${esc(widget.id)}" ${index===config.widgets.length-1?'disabled':''}`)}${button('remove','카드 제거',`data-id="${esc(widget.id)}"`)}</div>`}</article>`;
}
function dialogShell(id,title,body){return `<dialog id="${id}" class="workspace-dialog" aria-labelledby="${id}-title"><div class="dialog-heading"><h2 id="${id}-title">${title}</h2><button type="button" class="icon-button" data-board-action="close-dialog" aria-label="닫기">✕</button></div>${body}</dialog>`;}
function renderDialogs(data,state,config){
 if(state.dialog==='library')return dialogShell('workspace-library','통계 카드 추가',`<div class="widget-library">${widgetTemplates.map(template=>`<button type="button" data-board-action="choose-template" data-template="${template.key}"><strong>${template.name}</strong><span>${template.description}</span></button>`).join('')}</div>`);
 if(state.dialog==='period')return dialogShell('workspace-period','조회 기간',`<form id="workspace-period-form" class="workspace-form"><label>기간<select name="preset">${[['month','이번 달'],['year','올해'],['custom','날짜 직접 지정']].map(([v,n])=>option(v,n,config.period.preset)).join('')}</select></label><div class="workspace-date-fields" ${config.period.preset!=='custom'?'hidden':''}><label>시작일<input name="start" type="date" value="${config.period.start}" required></label><label>종료일<input name="end" type="date" value="${config.period.end}" required></label></div><p>기간을 사용하는 통계 카드에만 적용합니다. 현재 잔액과 미래 잔액 카드의 기준은 각 카드에 표시됩니다.</p><p data-workspace-error role="alert"></p><div class="dialog-actions">${button('close-dialog','취소')}<button type="submit" class="button primary">기간 적용</button></div></form>`);
 if(state.dialog!=='widget'||!state.editor)return '';
 const w=state.editor,banks=[...new Set([...data.loans,...(data.loanPayments||[])].map(row=>String(row.institution||'').trim()||'은행 미등록'))].sort((a,b)=>a.localeCompare(b,'ko'));
 const items=statisticsOptions(data,w.kind,w.bank);
 return dialogShell('workspace-card','통계 카드 설정',`<form id="workspace-card-form" class="workspace-form"><label>카드 이름<input name="title" value="${esc(w.title)}" maxlength="80" required></label><div class="workspace-form-grid"><label>카드 너비<select name="width">${option('standard','기본',w.width)}${option('wide','넓게',w.width)}</select></label>${w.type==='analysis'?`<label>표시 방식<select name="display">${option('trend','기간별 그래프',w.display)}${option('breakdown','항목별 합계',w.display)}</select></label><label>조회 항목<select name="kind">${Object.entries(statisticsKinds).map(([v,n])=>option(v,n,w.kind)).join('')}</select></label><label>표시할 금액<select name="metric">${Object.entries(metricsForKind(w.kind)).map(([v,n])=>option(v,n,w.metric)).join('')}</select></label><label class="field-wide">집계 기준<select name="basis">${Object.entries(statisticsBases).map(([v,n])=>option(v,n,w.basis)).join('')}</select></label><label>대출 은행<select name="bank" ${!['loans','all'].includes(w.kind)?'disabled':''}>${option('','모든 은행',w.bank)}${banks.map(bank=>option(bank,bank,w.bank)).join('')}</select></label><label>특정 항목<select name="item">${option('','모든 항목',w.item)}${items.map(item=>option(item.key,item.name+(item.institution?' · '+item.institution:''),w.item)).join('')}${w.item&&!items.some(item=>item.key===w.item)?option(w.item,'삭제된 항목 · 다시 선택해 주세요',w.item):''}</select></label><label class="field-wide">이름·메모 검색<input name="query" value="${esc(w.query)}" maxlength="100" placeholder="예: 도치, 보험료"></label>`:''}</div><p data-workspace-error role="alert"></p><div class="dialog-actions">${button('close-dialog','취소')}<button type="submit" class="button primary">카드 적용</button></div></form>`);
}
export function renderWorkspace(data,state,{formatMoney,formatCompact,today=todayKST()}){
 const config=dashboardConfig(data,state,today),t=totals(data),money=value=>esc(formatMoney(value));
 return `<div class="workspace-home"><div class="page-heading"><div><h1>맞춤 대시보드</h1></div><div class="heading-actions">${button('edit',state.editing?'편집 중':'화면 편집',state.editing?'disabled':'')}<button class="button primary" data-action="add">내역 추가</button></div></div>
 <section class="workspace-current" aria-label="등록한 현재 자산"><div class="workspace-section-heading"><h2>현재 자산</h2><span>조회일 ${today.replaceAll('-','.')} ${info('현재 자산','직접 입력한 잔액 기준입니다. 순자산은 주식·예금·퇴직연금에서 대출과 미결제 카드대금을 뺀 금액입니다. 미래 입출금 일정은 포함하지 않습니다.')}</span></div><div class="workspace-current-grid">${[['순자산',t.net,'gross'],['총자산',t.gross,''],['총부채',t.debt,''],['예금 잔액',t.deposits,'']].map(([label,value,cls])=>`<div class="workspace-current-stat ${cls}"><span>${label}</span><strong>${money(value)}</strong></div>`).join('')}</div><div class="workspace-quicklinks"><a href="#history">자산 기록 ↗</a><a href="#forecast">월별 전망 ↗</a><a href="#payday">급여일 전망 ↗</a><a href="#budget">월 예산 ↗</a></div></section>
 <div class="workspace-section-heading workspace-analysis-heading"><div><h2>내 통계</h2><span>보고 싶은 항목과 기간을 골라 비교하세요.</span></div><div class="heading-actions">${button('add','통계 카드 추가')}<a class="button secondary" href="#statistics">상세 통계 ↗</a></div></div>
 <div class="workspace-toolbar"><div class="workspace-period-controls">${button('month','이번 달',`aria-pressed="${config.period.preset==='month'}"`)}${button('year','올해',`aria-pressed="${config.period.preset==='year'}"`)}${button('period','기간 선택',`aria-haspopup="dialog"`)}</div><strong>${config.period.start.replaceAll('-','.')} – ${config.period.end.replaceAll('-','.')}</strong>${info('통계 기간','기간 통계 카드에 공통 적용됩니다. 현재 자산과 미래 예측 카드에는 각각의 기준일이 표시됩니다. 화면 편집 후 저장하면 기간 설정도 계정에 저장됩니다.')}</div>
 ${state.editing?`<div class="workspace-editbar"><p id="workspace-edit-help">⠿를 드래그해 순서를 바꾸세요. 방향키나 앞·뒤 버튼으로도 이동할 수 있어요.</p><div>${button('reset','기본 구성')}${button('cancel','취소',state.saving?'disabled':'')}<button type="button" class="button primary" data-board-action="save" ${state.saving?'disabled':''}>${state.saving?'저장 중…':'화면 저장'}</button></div></div>`:''}
 ${state.error?`<p class="workspace-alert" role="alert">${esc(state.error)}</p>`:''}<div class="workspace-grid" data-workspace-grid>${config.widgets.map((widget,index)=>renderWidget(data,widget,index,config,state,{formatMoney,formatCompact,today})).join('')}</div>
 ${!config.widgets.length?`<div class="workspace-empty-state"><h3>원하는 통계로 채워보세요.</h3><p>대출, 지출, 퇴직연금 등을 골라 나만의 화면을 만들 수 있어요.</p>${button(state.editing?'add':'edit','통계 카드 선택')}</div>`:''}<span class="sr-only" id="workspace-drag-help">손잡이를 드래그하거나 방향키로 이동하세요. 변경 후 화면 저장을 눌러 주세요.</span><div class="sr-only" aria-live="polite" id="workspace-live"></div>${renderDialogs(data,state,config)}</div>`;
}
const mounted=new WeakMap();
export function unmountWorkspace(root){const old=mounted.get(root);if(old){old.active=false;old.sortable?.destroy();root.removeEventListener('click',old.click);root.removeEventListener('keydown',old.key);mounted.delete(root);}}
export function mountWorkspace(root,data,state,{onRender,onSave,onFeedback=()=>{},today=todayKST(),loadSortable=()=>import('/sortable.mjs')}){
 unmountWorkspace(root);if(!root.querySelector('[data-workspace-grid]'))return;
 const lifecycle={active:true,sortable:null};mounted.set(root,lifecycle);
 const config=()=>dashboardConfig(data,state,today);
 const edit=()=>{if(!state.editing){state.editing=true;state.draft=structuredClone(config());}};
 const redraw=focus=>{onRender();if(focus)root.querySelector(focus)?.focus();};
 const move=(id,delta)=>{
  edit();const list=state.draft.widgets,index=list.findIndex(row=>row.id===id),target=index+delta;if(index<0||target<0||target>=list.length)return;
  [list[index],list[target]]=[list[target],list[index]];redraw(`[data-widget-id="${id}"] .widget-handle`);onFeedback(`${list[target].title} 카드를 ${target+1}번째로 옮겼어요.`);
 };
 lifecycle.click=async event=>{
  const target=event.target.closest('[data-board-action]');if(!target||target.disabled||state.saving)return;
  event.preventDefault();const action=target.dataset.boardAction,id=target.dataset.id;state.error='';
  if(action==='edit'){edit();redraw();return;}
  if(action==='cancel'){state.editing=false;state.draft=null;state.period=null;state.dialog='';redraw();return;}
  if(action==='save'){
   state.saving=true;redraw();
   try{await onSave(validateDashboard(config()));state.editing=false;state.draft=null;state.period=null;state.saving=false;redraw();onFeedback('대시보드 구성과 기간을 계정에 저장했어요.');}
   catch(error){state.saving=false;state.error=error.message;redraw();}return;
  }
  if(action==='reset'){state.draft=defaultDashboard(today);state.period=null;redraw();onFeedback('기본 구성으로 바꿨어요. 화면 저장을 누르면 반영됩니다.');return;}
  if(action==='month'||action==='year'){state.period={preset:action,...statisticsPeriod(action,action==='year'?today.slice(0,4):today.slice(0,7),today)};redraw();return;}
  if(action==='period'){state.dialog='period';redraw();return;}
  if(action==='close-dialog'){state.dialog='';state.editor=null;redraw();return;}
  if(action==='add'){edit();if(state.draft.widgets.length>=16){onFeedback('통계 카드는 최대 16개까지 추가할 수 있어요.');return;}state.dialog='library';redraw();return;}
  if(action==='choose-template'){
   const template=widgetTemplates.find(row=>row.key===target.dataset.template);if(!template)return;
   state.editor={...template.config,id:crypto.randomUUID()};state.dialog='widget';redraw();return;
  }
  if(['configure','remove','duplicate','width','move-up','move-down'].includes(action))edit();
  if(action==='width'){const widget=state.draft.widgets.find(row=>row.id===id);if(widget)widget.width=widget.width==='wide'?'standard':'wide';redraw();return;}
  if(action==='duplicate'){if(state.draft.widgets.length>=16){onFeedback('카드는 최대 16개입니다.');redraw();return;}const index=state.draft.widgets.findIndex(row=>row.id===id);if(index>=0)state.draft.widgets.splice(index+1,0,{...state.draft.widgets[index],id:crypto.randomUUID(),title:state.draft.widgets[index].title+' 복사'});redraw();return;}
  if(action==='configure'){state.editor={...config().widgets.find(row=>row.id===id)};state.dialog='widget';redraw();return;}
  if(action==='remove'){state.draft.widgets=state.draft.widgets.filter(row=>row.id!==id);redraw();onFeedback('카드를 대시보드에서 뺐어요. 원본 내역은 그대로 보관됩니다.');return;}
  if(action==='move-up'||action==='move-down')move(id,action==='move-up'?-1:1);
 };
 lifecycle.key=event=>{if(!event.target.matches('.widget-handle')||!['ArrowUp','ArrowDown'].includes(event.key)||state.saving)return;event.preventDefault();move(event.target.closest('[data-widget-id]').dataset.widgetId,event.key==='ArrowUp'?-1:1);};
 root.addEventListener('click',lifecycle.click);root.addEventListener('keydown',lifecycle.key);
 const dialog=root.querySelector('.workspace-dialog');
 if(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');dialog.addEventListener('cancel',()=>{state.dialog='';state.editor=null;});dialog.addEventListener('close',()=>{state.dialog='';state.editor=null;});}
 const periodForm=root.querySelector('#workspace-period-form');
 if(periodForm){periodForm.addEventListener('change',()=>{periodForm.querySelector('.workspace-date-fields').hidden=periodForm.elements?.preset?.value!=='custom'&&periodForm.querySelector('[name=preset]').value!=='custom';});periodForm.addEventListener('submit',event=>{
  event.preventDefault();const read=name=>periodForm.querySelector(`[name=${name}]`).value,preset=read('preset');
  const period={preset,...(preset==='custom'?{start:read('start'),end:read('end')}:statisticsPeriod(preset,preset==='year'?today.slice(0,4):today.slice(0,7),today))};
  try{validateDashboard({...config(),period});buildStatistics(data,{...period},today);state.period=period;state.dialog='';redraw();onFeedback('조회 기간을 적용했어요.');}catch(error){periodForm.querySelector('[data-workspace-error]').textContent=error.message;}
 });}
 const form=root.querySelector('#workspace-card-form');
 if(form){
  const read=()=>{const w={...state.editor};for(const field of form.querySelectorAll('[name]'))w[field.name]=field.disabled?'':field.value;return w;};
  form.addEventListener('change',event=>{if(!['kind','bank','item'].includes(event.target.name))return;const w=read();if(event.target.name==='kind'){w.bank='';w.metric=w.kind==='income'?'income':w.kind==='loans'?'loanPayment':w.kind==='retirement'?'retirementContribution':'expense';}else if(event.target.name==='bank'&&w.bank){w.kind='loans';w.metric='loanPayment';}else if(event.target.name==='item'&&w.item){const item=statisticsOptions(data).find(row=>row.key===w.item);if(item){w.kind=item.type;w.metric=Object.keys(metricsForKind(w.kind))[0];if(w.kind!=='loans')w.bank='';}}if(event.target.name!=='item')w.item='';state.editor=w;redraw(`#workspace-card-form [name=${event.target.name}]`);});
  form.addEventListener('submit',event=>{event.preventDefault();try{const w=read(),index=state.draft.widgets.findIndex(row=>row.id===w.id),widgets=[...state.draft.widgets];if(index<0)widgets.push(w);else widgets[index]=w;state.draft=validateDashboard({...config(),widgets});state.editor=null;state.dialog='';redraw();onFeedback('카드에 적용했어요. 화면 저장을 누르면 다음에도 유지됩니다.');}catch(error){form.querySelector('[data-workspace-error]').textContent=error.message;}});
 }
 if(!state.saving)loadSortable().then(({default:Sortable})=>{
  if(!lifecycle.active)return;
  lifecycle.sortable=Sortable.create(root.querySelector('[data-workspace-grid]'),{animation:root.ownerDocument.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:180,handle:'.widget-handle',draggable:'[data-widget-id]',dataIdAttr:'data-widget-id',ghostClass:'widget-ghost',chosenClass:'widget-chosen',delay:130,delayOnTouchOnly:true,touchStartThreshold:4,setData:transfer=>transfer.setData('text/plain',''),onEnd:()=>{
   if(!lifecycle.active)return;edit();state.draft.widgets=reorderWidgets(state.draft.widgets,[...root.querySelector('[data-workspace-grid]').children].map(element=>element.dataset.widgetId));redraw();onFeedback('카드 순서를 바꿨어요. 화면 저장을 누르면 다음에도 유지됩니다.');
  }});
 }).catch(()=>{if(lifecycle.active)onFeedback('드래그를 불러오지 못했어요. 앞·뒤 버튼이나 방향키로 순서를 바꿀 수 있습니다.');});
 return ()=>unmountWorkspace(root);
}

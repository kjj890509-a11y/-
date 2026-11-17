import {createWorkspaceState,renderWorkspace,mountWorkspace,unmountWorkspace,defaultDashboard,dashboardConfig,widgetTemplates} from '/workspace.mjs';
import {KINDS, LABELS, FLOW_LABELS, emptyPortfolio, todayKST, validatePortfolio, totals, eventsForMonth, cashflowForMonth, monthlyFlow, samplePortfolio, paymentDate, budgetPlan, forecastMonths, snapshotTotals, captureSnapshot, fixedForMonth, interestForLoan, estimatedMonthlyInterest, loanSchedule, paydayForecasts, scheduledCashflows, loanNextPayment, loanPlanSummary, shiftMonth} from '/domain.mjs';
import {renderTrendChart, mountTrendCharts} from '/chart.mjs';
import {renderLoanForecastPanel} from '/loan-forecast.mjs';
import {renderLoanCards,renderLoanManagement} from '/loans-page.mjs';
import {initialStatisticsFilters,renderStatisticsPage,mountStatisticsControls} from '/statistics-page.mjs';
import {initialAdvisorState,renderAdvisorPage,mountAdvisorControls} from '/advisor-page.mjs';
import {viewLabels, navigationGroups, groupForView, sectionTabs, searchDashboard, renderDashboardSearch, enhanceTableExports, tableCSV, createLedgerWorkspace, ledgerState, ledgerEntries, ledgerColumns, ledgerLabels, ledgerStatus, statusLabels, ledgerQuery, ledgerLayout, validateLedgerPreferences, mountLedger, unmountLedger, renderCashCalendar, shiftCalendarDay, entryPresets, entryGroups, renderEntryHub, createEntryManagerState, mountEntryManager, stageEntryRecord, entryDraftRow, mountFinancialMotion, unmountFinancialMotion, createCardBillingState, renderCardBilling, mountCardBilling, renderCardAccounts, saveCardAccount, setCardArchived} from '/navigation.mjs';
import {renderDashboard, renderAssets} from '/dashboard-view.mjs';
import {enhanceDisclosure,enhanceEditorHelp,expandSection,rememberDisclosure} from '/disclosure.mjs';
const icons = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  stocks:'<path d="m3 16 6-6 4 4 8-10M15 4h6v6"/><path d="M3 21h18"/>',
  loans:'<path d="m3 9 9-6 9 6M4 10h16M5 20h14M7 10v7m5-7v7m5-7v7M3 21h18"/>',
  retirement:'<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 12h16m-10 0v3h4v-3"/>',
  deposits:'<path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14v4M3 8h15a2 2 0 0 1 2 2v2"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>',
  cards:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
  planned:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 11h18m-12 5h6m-3-3v6"/>',
  payday:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 11h18m-13 4 2 2 4-4"/>',
  fixed:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M4 10h16m-12 4h3m-3 3h7"/>',
  cashflow:'<path d="M7 3v14m-4-4 4 4 4-4M17 21V7m-4 4 4-4 4 4"/>',
  budget:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h8m-8 3h5"/>',
  history:'<path d="M3 12a9 9 0 1 0 2-6M3 3v5h5m4-1v6l4 2"/>',
  statistics:'<path d="M4 20h17M7 16v-5m5 5V5m5 11V8"/>',
  advisor:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M8 10h8m-8 4h5"/>',
  forecast:'<path d="M3 20h18M4 16l5-5 4 3 7-10m-5 0h5v5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="m3 3 18 18M10.5 5.1A14 14 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3.2 4.2M6.6 6.6A18 18 0 0 0 2 12s3 7 10 7a13 13 0 0 0 5.4-1.2M10 10a3 3 0 0 0 4 4"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/>',
  delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const escapeHTML = val => String(val ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const wonFormat = new Intl.NumberFormat('ko-KR');
let portfolio = emptyPortfolio(), revision = 0, demo = false, realData = null, realRevision = 0, loading = true, saving = false;
let hidden = localStorage.getItem('moa-hide-amounts') === 'true';
let scheduledRange='upcoming',scheduledType='all';
let paydaySalaryId='all',paydaySelectedDate='';
let view = 'overview', month = todayKST().slice(0,7), query = '', editorKind, editingId;
let homeSelection='all';
let entryEditing=false,entryDetailEditing=false,entryActiveType='salary',entryDrafts={},entrySession=[];
let entryManagerState=createEntryManagerState();
let cardBillingState=createCardBillingState();
let calendarSelected='',calendarFilter='all',calendarCategory='all',calendarMode='month';
let chartHorizon=6,loanForecastId='',loanForecastPeriod='12';
let statisticsFilters;
let advisorState;
let workspaceState=createWorkspaceState();
let recordWorkspace=createLedgerWorkspace(),recordCleanups=[];
const navLabels = viewLabels;
function money(value, unit = '원') { return hidden ? '••••••' : `${wonFormat.format(value)}${unit}`; }
function compact(value) { if(hidden)return '••••'; if(Math.abs(value)>=1e8)return `${(value/1e8).toFixed(2)}억`; if(Math.abs(value)>=1e4)return `${wonFormat.format(Math.round(value/1e4))}만`;return wonFormat.format(value); }
function percent(value){return hidden?'••%':`${value>0?'+':''}${value.toFixed(2)}%`;}
const rowsCount = () => KINDS.reduce((n,k)=>n+portfolio[k].length,0);
const status = (label,error=false) => {$('save-state').innerHTML=`<i style="background:${error?'#c48365':'#7da367'}"></i>${escapeHTML(label)}`;};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function openDialog(id){const dialog=$(id);if(id==='editor')dialog.classList.toggle('history-editor',Boolean(dialog.querySelector('#plan-asOf')));enhanceEditorHelp(dialog);dialog.showModal();}
function confirmAction(title,body,label='삭제하기'){
  $('confirm-title').textContent=title;$('confirm-body').textContent=body;$('confirm-ok').textContent=label;openDialog('confirm-dialog');
  return new Promise(resolve=>{
    const end=value=>{ $('confirm-dialog').close();$('confirm-ok').onclick=null;$('confirm-cancel').onclick=null;$('confirm-dialog').oncancel=null;resolve(value);};
    $('confirm-ok').onclick=()=>end(true);$('confirm-cancel').onclick=()=>end(false);$('confirm-dialog').oncancel=e=>{e.preventDefault();end(false);};
  });
}
async function loadData(){
  loading=true;status('불러오는 중');
  try{
    const res=await fetch('/api/portfolio');const data=await res.json();
    if(!res.ok)throw new Error(data.error||'내역을 불러오지 못했습니다.');
    portfolio=validatePortfolio(data.data);revision=data.revision;loading=false;status('서버 저장됨');render();loadRecordPreferences();
  }catch(error){loading=false;status('연결 필요',true);$('main').innerHTML=`<div class="error-state"><span class="eyebrow">MY ASSET NOTE</span><h1>자산 노트에 연결해 주세요</h1><p>${escapeHTML(error.message)}</p><button class="button primary" data-action="retry">다시 시도</button> <a class="button secondary" href="/signin-with-chatgpt?return_to=/" target="_top">로그인하기</a><p style="margin-top:24px;font-size:11px">먼저 둘러보고 싶다면 예시 화면을 열어보세요.</p><button class="button secondary" data-action="demo">예시로 둘러보기 ↗</button></div>`;renderNav();}
}
async function persist(next,dashboardOnly=false){
  if(saving)throw new Error('저장 중입니다. 잠시만 기다려 주세요.');
  next=validatePortfolio(next);
  if(demo) {portfolio=next;render();status('예시 보기 중');return;}
  saving=true;status('저장하는 중');
  try{
    const res=await fetch('/api/portfolio',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dashboardOnly?{dashboard:next.dashboard,revision}:{data:next,revision})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'저장하지 못했습니다.');
    portfolio=validatePortfolio(data.data);revision=data.revision;status('서버 저장됨');render();
  }catch(error){status('저장 실패',true);throw error;}finally{saving=false;}
}
function renderNav(){
  const current=groupForView(view);
  $('main-nav').innerHTML=navigationGroups.map(group=>`<a href="#${group.defaultView}" class="nav-link ${group.id===current.id?'active':''}" ${group.id===current.id?'aria-current="page"':''}>${svg(group.icon)}<span>${group.label}</span></a>${group.id===current.id?`<div class="sidebar-subnav" aria-label="${group.label} 하위 메뉴">${group.views.map(key=>`<button type="button" data-action="navigate-view" data-view="${key}" aria-pressed="${key===view}">${navLabels[key]}</button>`).join('')}</div>`:''}`).join('');
  $('breadcrumb').textContent=current.label;
  $('privacy-toggle').innerHTML=svg(hidden?'eyeoff':'eye');$('privacy-toggle').setAttribute('aria-label',hidden?'금액 표시하기':'금액 숨기기');$('privacy-toggle').title=hidden?'금액 표시하기':'금액 숨기기';
}

function heading(title,subtitle,action=true){
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions"><span class="date-chip">${todayKST().replaceAll('-','. ')}</span>${action?`<button class="button primary" data-action="add" ${view!=='overview'?`data-kind="${view}"`:''}>${svg('plus')} 내역 추가</button>`:''}</div></div>`;
}
function demoBanner(){return demo?'<div class="demo-bar"><span>예시 모드 · 아래 금액은 기능 설명을 위한 가상 내역입니다.</span><button data-action="exit-demo">내 자산으로 돌아가기</button></div>':'';}
function metric(label,value,caption='',className=''){return `<div class="metric-box"><span class="label">${label}</span><strong class="${className}">${value}</strong>${caption?`<small>${caption}</small>`:''}</div>`;}
function paymentRow(item){
  const today=todayKST();const overdue=!item.paid&&item.date<today;
  const diff=Math.round((new Date(item.date+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000);
  const badge=item.paid?'결제 완료':overdue?'지난 일정':diff===0?'오늘':`D-${diff}`;
  return `<div class="payment-row"><div class="payment-date"><span>${Number(item.date.slice(5,7))}월</span><strong>${Number(item.date.slice(8))}</strong></div><div class="institution-icon ${item.type}">${escapeHTML(item.name.slice(0,1))}</div><div class="payment-info"><strong>${escapeHTML(item.name)}</strong><small>${item.type==='cashflow'?FLOW_LABELS[item.flowType]:item.type==='loans'?'대출 원금 + 이자':item.type==='fixed'?'고정지출 · 계좌 결제':'카드 결제예정액'}</small></div><span class="payment-amount ${item.income?'income-color':''}">${item.income?'+ ':''}${money(item.amount)}</span><span class="status-pill ${overdue?'overdue':item.paid?'paid':''}">${badge}</span></div>`;
}
function monthToolbar(){const [y,m]=month.split('-').map(Number);return `<div class="calendar-toolbar"><button data-action="prev-month" aria-label="이전 달">‹</button><strong>${y}년 ${m}월</strong><button data-action="next-month" aria-label="다음 달">›</button><button data-action="this-month" class="month-reset">이번 달</button></div>`;}
function flowSummary(selectedMonth,link=true){
 const f=monthlyFlow(portfolio,selectedMonth);
 return `<section class="panel flow-summary"><div class="panel-header"><div><h2>${Number(selectedMonth.slice(5))}월 수입과 지출</h2><p>월급과 기타 수입에서 예정 지출을 빼면 얼마가 남을까요?</p></div>${link?'<a class="panel-link" href="#cashflow">내역 관리 ↗</a>':''}</div><div class="flow-metrics"><div><span>수입 합계</span><strong class="income-color">${money(f.income)}</strong><small>월급 ${money(f.salary)} + 기타 ${money(f.otherIncome)}</small></div><div><span>등록 지출 계획</span><strong>${money(f.expense)}</strong><small>대출·카드 ${money(f.payments)} + 고정 ${money(f.fixedCash)} + 기타 ${money(f.otherExpense)}</small></div><div><span>수입·지출 차액</span><strong class="${f.balance<0?'negative':'income-color'}">${money(f.balance)}</strong><small>수입 합계 − 등록 지출 계획</small></div></div><p class="panel-note">기타 지출은 카드대금·대출상환액과 중복되지 않게 등록해 주세요. 예금 잔액은 자동 변경되지 않습니다.</p></section>`;
}
function planningHeader(title,subtitle,action,label){
 return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions">${action?`<button class="button primary" data-action="${action}">${svg('plus')}${label}</button>`:''}</div></div>`;
}
function assetTrend(horizon=6,historyOnly=false){
 const today=todayKST(),current=today.slice(0,7),t=totals(portfolio);
 const saved=(portfolio.snapshots||[]).filter(r=>historyOnly||r.month<current).slice(-6).map(r=>({label:r.month.slice(2).replace('-','.'),detailLabel:r.asOf.replaceAll('-','.')+' · 기록',value:snapshotTotals(r).net,forecast:false}));
 const points=historyOnly?saved:[...saved,{label:'현재',detailLabel:today.replaceAll('-','.')+' · 현재',value:t.net,forecast:false},...forecastMonths(portfolio,today,horizon).map(r=>({label:r.month.slice(2).replace('-','.')+' 말',detailLabel:paymentDate(r.month,31).replaceAll('-','.')+' · 월별 전망',value:r.net,forecast:true}))];
 return renderTrendChart(points,{formatMoney:money,formatCompact:compact,historyOnly});
}
function overview(){
 return renderDashboard(portfolio,{money,compact,svg,chart:homeSelection==='all'?assetTrend(chartHorizon):'',horizon:chartHorizon,hideAmounts:hidden,demoBanner:demoBanner(),selection:homeSelection,detail:homeSelection==='all'?'':homeDetail()});
}
function homeDetailHeading(title,description,kind){
 return `<div class="home-detail-heading"><div><h2 tabindex="-1" data-home-detail-title>${title}</h2><p class="subtitle">${description}</p></div>${kind?`<button class="button primary" data-action="add" data-kind="${kind}">${svg('plus')}${LABELS[kind]} 추가</button>`:''}</div>`;
}
function homeDetail(){
 const t=totals(portfolio);
 if(['deposits','stocks','retirement','cards'].includes(homeSelection))return category(homeSelection,{embedded:true});
 if(homeSelection==='net'){
  const parts=[['deposits','예금·현금',t.deposits,'자산'],['stocks','주식·투자',t.stock,'자산'],['retirement','퇴직금·연금',t.retirement,'자산'],['debt','대출 잔액',t.loans,'부채'],['cards','미결제 카드',t.cards,'부채']];
  return homeDetailHeading('순자산 상세','보유 자산에서 대출과 미결제 카드대금을 뺀 금액입니다.')+`<div class="planning-metrics">${metric('총자산',money(t.gross))}${metric('남은 부채',money(t.debt))}${metric('순자산',money(t.net))}</div><div class="home-primary-grid"><section class="panel home-chart"><div class="panel-header"><div><h2>순자산 흐름</h2><p>기록·현재 잔액과 앞으로의 예상</p></div><div class="segmented" aria-label="전망 기간">${[6,12].map(n=>`<button data-action="chart-range" data-range="${n}" aria-pressed="${chartHorizon===n}" class="${chartHorizon===n?'active':''}">${n===6?'6개월':'1년'}</button>`).join('')}</div></div>${assetTrend(chartHorizon)}</section><section class="panel"><div class="panel-header"><h2>순자산 구성</h2></div><div class="home-net-breakdown">${parts.map(([key,label,value,side])=>`<button type="button" data-action="home-detail" data-detail="${key}" aria-controls="home-dashboard"><span><strong>${label}</strong><small>${side} · 상세 보기</small></span><b>${side==='부채'?'− ':''}${money(value)}</b></button>`).join('')}</div></section></div>`;
 }
 if(homeSelection==='debt'){
  const cards=portfolio.cards.filter(row=>!row.paid).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  return homeDetailHeading('부채 상세','대출의 남은 원금과 미결제 카드대금을 함께 확인하세요.','loans')+`<div class="planning-metrics">${metric('남은 부채 합계',money(t.debt))}${metric('대출 잔액',money(t.loans))}${metric('미결제 카드대금',money(t.cards))}</div>`+recordLedgerHost('loans')+renderLoanManagement(portfolio,{formatMoney:money,query,forecastPanel:loanForecastPanel()})+`<section class="table-panel home-detail-table"><div class="table-heading"><h2>미결제 카드 <span>${cards.length}건</span></h2><button class="button secondary" data-action="add" data-kind="cards">카드 청구 추가</button></div>${cards.length?`<div class="table-scroll"><table><caption class="sr-only">미결제 카드 상세</caption><thead><tr>${tableHeaders.cards.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${cards.map(row=>rowHTML('cards',row)).join('')}</tbody></table></div>`:'<div class="empty-inline">미결제 카드대금이 없습니다.</div>'}</section>`;
 }
 if(homeSelection==='cashflow'){
  const events=eventsForMonth(portfolio,month).sort((a,b)=>a.date.localeCompare(b.date));
  return budgetPage({embedded:true})+`<section class="table-panel home-detail-table"><div class="table-heading"><h2>${month} 입출금 일정 <span>${events.length}건</span></h2></div>${events.length?`<div class="table-scroll"><table><caption class="sr-only">월 수입·지출 계획 상세</caption><thead><tr><th>날짜</th><th>항목</th><th>구분</th><th class="numeric">금액</th><th>상태</th></tr></thead><tbody>${events.map(row=>`<tr><td>${row.date}</td><td>${escapeHTML(row.name)}</td><td>${row.type==='loans'?'대출 원금·이자':row.type==='cards'?'카드 청구':row.type==='fixed'?'정기 지출':row.income?'수입':'기타 지출'}</td><td class="numeric ${row.income?'income-color':''}">${row.income?'+':'−'} ${money(row.amount)}</td><td>${row.paid?'결제 완료':'등록 일정'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-inline">이 달에 등록된 입출금 일정이 없습니다.</div>'}</section>`;
 }
 return '';
}
function selectHomeDetail(selection){
 if(view!=='overview'||!['all','net','deposits','debt','cashflow','stocks','retirement','cards'].includes(selection))return;
 homeSelection=selection;query='';if(selection==='cashflow')month=todayKST().slice(0,7);
 for(const cleanup of recordCleanups)cleanup();recordCleanups=[];
 rememberDisclosure($('main'));
 // Replace only the detail region so the summary controls and current route stay in place.
 const template=document.createElement('template');template.innerHTML=overview();
 $('home-dashboard').replaceWith(template.content.querySelector('#home-dashboard'));
 document.querySelectorAll('.home-stat').forEach(button=>{
  const selected=button.dataset.detail===selection;
  button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));button.querySelector('[data-home-indicator]').textContent=selected?'✓':'↓';
 });
 enhanceDisclosure($('main'),{view});enhanceTableExports($('main'),{onExport:downloadTable});mountRecordLedgers();mountTrendCharts($('main'));mountFinancialMotion($('main'),{revision,hideAmounts:hidden});
 const target=$('home-dashboard');target.querySelector('[data-home-detail-title]')?.focus({preventScroll:true});
 // Keep the summary cards visible on wide screens; bring details into view on smaller screens.
 const top=target.getBoundingClientRect().top;
 if(top<84||top>(window.innerHeight||800)*.7)target.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 if(selection==='all')document.querySelector('.home-stat')?.focus({preventScroll:true});
}
function recordLedgerHost(scope){return `<section class="table-panel record-ledger-panel"><div class="table-heading"><h2>${ledgerLabels[scope]} 목록</h2>${recordWorkspace.error?`<span class="form-error" role="alert">${escapeHTML(recordWorkspace.error)}</span><button class="button secondary small" data-action="retry-views">다시 연결</button>`:''}${KINDS.includes(scope)?`<button class="button primary small" data-action="add" data-kind="${scope}">내역 추가</button>`:''}</div><div data-ledger-scope="${scope}"></div></section>`;}
function recordsPage(){return heading('전체 내역','모든 카테고리의 내역을 필터·정렬하고 원하는 보기로 저장하세요.')+demoBanner()+recordLedgerHost('all');}
async function loadRecordPreferences(){
 if(recordWorkspace.loaded||demo)return;recordWorkspace.loaded=true;const targetWorkspace=recordWorkspace;
 try{const response=await fetch('/api/preferences'),result=await response.json();if(recordWorkspace!==targetWorkspace||demo)return;if(!response.ok)throw new Error(result.error||'보기 설정에 연결하지 못했습니다.');recordWorkspace.preferences=validateLedgerPreferences(result.data);recordWorkspace.ready=true;recordWorkspace.error='';recordWorkspace.revision=result.revision;for(const [scope,pref]of Object.entries(recordWorkspace.preferences.tables)){Object.assign(ledgerState(recordWorkspace,scope),pref);if(pref.rowOrder?.length)recordWorkspace.states[scope].sort='manual';}if(document.querySelector('[data-ledger-scope]'))render();}
 catch{if(recordWorkspace!==targetWorkspace)return;recordWorkspace.error='보기 설정 연결 실패';if(document.querySelector('[data-ledger-scope]'))render();}
}
async function saveRecordPreferences(scope,pref){
 if(!demo&&!recordWorkspace.ready)throw new Error('먼저 보기 설정을 불러온 뒤 저장해 주세요.');
 if(recordWorkspace.saving)throw new Error('보기 설정을 저장 중입니다.');
 const data=structuredClone(recordWorkspace.preferences);data.tables[scope]=pref;validateLedgerPreferences(data);
 if(demo){recordWorkspace.preferences=data;return;}
 recordWorkspace.saving=true;
 try{const response=await fetch('/api/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision:recordWorkspace.revision})}),result=await response.json();if(!response.ok)throw new Error(result.error||'보기 저장에 실패했습니다.');recordWorkspace.preferences=validateLedgerPreferences(result.data);recordWorkspace.revision=result.revision;}
 finally{recordWorkspace.saving=false;}
}
function ledgerCells(entry){
 const template=document.createElement('template');template.innerHTML='<table><tbody>'+rowHTML(entry.kind,entry.row)+'</tbody></table>';
 return [...template.content.querySelectorAll('td')].slice(0,-1).map(td=>td.innerHTML);
}
function ledgerCell(scope,entry,key){
 if(scope==='all'){
  if(key==='kind')return escapeHTML(ledgerLabels[entry.kind]);if(key==='amount')return money(entry.amount);if(key==='date')return entry.date||'—';if(key==='status')return escapeHTML(statusLabels[ledgerStatus(entry)]);return escapeHTML(entry.row[key]||'—');
 }
 if(scope==='planned'){
  if(key==='name')return `<strong>${escapeHTML(entry.row.name)}</strong><small>${escapeHTML(entry.row.note||'')}</small>`;
  if(key==='date')return entry.date;if(key==='amount')return money(entry.amount);if(key==='type')return entry.row.type==='expense'?'예정 지출':'추가 수입';return `<button class="status-pill" data-action="toggle-planned" data-id="${escapeHTML(entry.row.id)}">${entry.row.includeInForecast===false?'예상 제외':'예상 반영'} ↻</button>`;
 }
 return ledgerCells(entry)[ledgerColumns[scope].findIndex(([k])=>k===key)]||'—';
}
function mountRecordLedgers(){
 for(const root of document.querySelectorAll('[data-ledger-scope]')){
  const scope=root.dataset.ledgerScope,state=ledgerState(recordWorkspace,scope),data=scope==='cashflow'?{...portfolio,cashflow:cashflowForMonth(portfolio,month,true)}:scope==='fixed'?{...portfolio,fixed:fixedForMonth(portfolio,month)}:portfolio;
  const entries=ledgerEntries(data,scope,month);state.selected=state.selected.filter(key=>entries.some(entry=>entry.key===key));
  recordCleanups.push(mountLedger(root,entries,state,{scope,today:todayKST(),money,cell:(entry,key)=>ledgerCell(scope,entry,key),extraActions:entry=>entry.kind==='cards'&&!entry.row.cardAccountId?`<button type="button" class="button secondary small" data-action="card-account-from-bill" data-id="${escapeHTML(entry.row.id)}">내 카드로 등록</button>`:'',onEdit:entry=>openEditor(entry.kind,entry.row.id),onDetail:entry=>openRecordDetail(scope,entry),onSave:pref=>saveRecordPreferences(scope,pref),onFeedback:toast,onExport:(rows,keys)=>exportLedger(scope,rows,keys),onBulk:async(action,selected)=>{
   if(action==='delete'&&!await confirmAction(`${selected.length}개 내역을 삭제할까요?`,'선택한 내역을 삭제합니다. 필터 밖의 선택 항목도 포함될 수 있습니다.'))return;
   const next=structuredClone(portfolio);for(const entry of selected){const index=next[entry.kind].findIndex(row=>row.id===entry.row.id);if(index<0)continue;const row=next[entry.kind][index];if(action==='delete')next[entry.kind].splice(index,1);if(entry.kind==='cards'&&['paid','unpaid'].includes(action))row.paid=action==='paid';if(entry.kind==='cashflow'&&['include','exclude'].includes(action))row.includeInForecast=action==='include';}
   try{await persist(next);state.selected=[];render();toast('선택한 내역에 적용했어요.');}catch(error){toast(error.message);}
  }}));
 }
}
function exportLedger(scope,rows,keys){
 const template=document.createElement('template');template.innerHTML=`<table><thead><tr>${keys.map(key=>`<th>${escapeHTML(ledgerColumns[scope].find(([k])=>k===key)[1])}</th>`).join('')}</tr></thead><tbody>${rows.map(entry=>`<tr>${keys.map(key=>`<td>${ledgerCell(scope,entry,key)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 for(const button of template.content.querySelectorAll('tbody button'))button.replaceWith(document.createTextNode(button.textContent));
 downloadTable(tableCSV(template.content.querySelector('table')),ledgerLabels[scope]+' 조회');
}
function openRecordDetail(scope,entry){
 let dialog=$('record-detail');if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.id='record-detail';dialog.className='record-detail-drawer';dialog.setAttribute('aria-labelledby','record-detail-title');
 dialog.innerHTML=`<div class="dialog-heading"><div><small>${escapeHTML(ledgerLabels[entry.kind])}</small><h2 id="record-detail-title">${escapeHTML(entry.row.name)}</h2></div><button class="icon-button" data-close="record-detail" aria-label="상세 닫기">✕</button></div><dl class="record-detail-fields">${ledgerColumns[entry.kind].map(([key,label])=>`<div><dt>${escapeHTML(label)}</dt><dd>${ledgerCell(entry.kind,entry,key)}</dd></div>`).join('')}</dl>${entry.row.note?`<p>${escapeHTML(entry.row.note)}</p>`:''}<div class="dialog-actions"><button class="button primary" data-detail-edit>내역 수정</button></div>`;
 dialog.querySelector('[data-detail-edit]').onclick=()=>{dialog.close();openEditor(entry.kind,entry.row.id);};document.body.append(dialog);dialog.showModal();
}
function workspacePage(){return demoBanner()+renderWorkspace(portfolio,workspaceState,{formatMoney:money,formatCompact:compact});}
function assetsPage(){return renderAssets(portfolio,{money,svg,demoBanner:demoBanner()});}

function budgetPage({embedded=false}={}){
 const p=budgetPlan(portfolio,month),loans=eventsForMonth(portfolio,month).filter(e=>e.type==='loans').reduce((n,e)=>n+e.amount,0),cards=portfolio.cards.filter(r=>r.dueDate.startsWith(month)).reduce((n,r)=>n+r.amount,0);
 const ratio=p.limit===null?0:p.limit===0?(p.expense>0?100:0):Math.min(100,p.expense/p.limit*100);
 const target=p.target||0,goal=target?Math.max(0,Math.min(100,p.balance/target*100)):0;
 return `${embedded?homeDetailHeading('수입·지출 상세','월 수입과 지출 계획, 예산을 함께 확인하세요.')+`<div class="home-detail-actions"><button class="button secondary" data-action="budget-form">예산 수정</button><button class="button primary" data-action="add" data-kind="cashflow">수입·지출 추가</button></div>`:planningHeader('월 예산','지출 한도와 저축 목표를 정하고 등록한 계획을 비교하세요.','budget-form',p.limit===null?'예산 설정':'예산 수정')+demoBanner()}<div class="flow-month-bar"><span>예산을 확인할 월</span>${monthToolbar()}</div><div class="planning-metrics">${metric('예정 수입',money(p.income),'월급 + 기타 수입')}${metric('예정 지출',money(p.expense),'대출 · 카드 · 고정 · 기타 지출')}${metric('남는 금액 예상',money(p.balance),'예정 수입 − 예정 지출',p.balance<0?'text-danger':'income-color')}${metric('지출 예산 잔여',p.limit===null?'미설정':money(p.remaining),p.limit===null?'월별 지출 한도를 설정하세요.':'지출 예산 − 예정 지출',p.remaining<0?'text-danger':'')}</div><div class="planning-columns"><section class="panel"><div class="panel-header"><div><h2>이번 달 지출 계획</h2><p>결제 완료 카드도 해당 월 지출에 포함합니다.</p></div><span class="subtle-tag">BUDGET</span></div><div class="budget-total"><strong>${money(p.expense)}</strong><span>${p.limit===null?'예산 미설정':'예산 '+money(p.limit)}</span></div><div class="budget-progress"><i class="${p.remaining<0?'over-budget':''}" style="width:${ratio}%"></i></div><div class="breakdown-list">${[['대출 원금·이자',loans,'loans'],['카드 결제',cards,'cards'],['고정지출 · 계좌 결제',p.fixedCash,'fixed'],['기타 지출',p.otherExpense,'cashflow']].map(([label,value,icon])=>`<div class="breakdown-row"><span class="stat-icon">${svg(icon)}</span><div><strong>${label}</strong><div class="mini-progress"><i style="width:${p.expense?value/p.expense*100:0}%"></i></div></div><b>${money(value)}</b></div>`).join('')}</div><p class="panel-note">기타 지출은 카드대금·대출상환액과 겹치지 않게 입력해 주세요. 이 화면은 실제 사용액이 아닌 등록 내역에 따른 월간 계획입니다.</p></section><section class="panel savings-panel"><div class="panel-header"><div><h2>이번 달 남길 금액</h2><p>월별 저축 목표를 설정해 보세요.</p></div>${svg('target')}</div><div class="goal-ring" style="background:conic-gradient(var(--green) ${goal}%,var(--track) ${goal}%)"><div><span>목표 대비 예상</span><strong>${target?Math.round(goal)+'%':'—'}</strong></div></div><div class="goal-details"><div><span>남는 금액</span><strong>${money(p.balance)}</strong></div><div><span>저축 목표</span><strong>${target?money(target):'미설정'}</strong></div></div><p class="panel-note">${target?(p.balance>=target?'등록 내역 기준으로 목표를 달성할 수 있어요.':`목표까지 ${money(target-p.balance)}이 더 필요해요.`):'예산 수정에서 저축 목표를 입력하세요.'}</p></section></div>`;
}
function historyPage(){
 const rows=(portfolio.snapshots||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
 const selected=rows.find(r=>r.month===month),t=selected?snapshotTotals(selected):null;
 const previous=rows.find(r=>r.month<month),delta=t&&previous?t.net-snapshotTotals(previous).net:null;
 return `${planningHeader('자산 기록','지난달의 자산을 남겨두고, 변화를 확인하세요.','snapshot-form','자산 기록')}${demoBanner()}<div class="flow-month-bar"><span>확인할 월</span>${monthToolbar()}</div>${t?`<div class="planning-metrics">${metric('기록된 순자산',money(t.net),t.asOf.replaceAll('-','.')+' 기준')}${metric('기록된 총자산',money(t.gross))}${metric('기록된 총부채',money(t.debt))}${metric('이전 기록 대비',delta===null?'—':money(delta),previous?previous.month+' 기록과 비교':'비교할 이전 기록이 없습니다.')}</div>`:'<div class="empty-welcome"><div><h2>이 달에는 저장된 자산 기록이 없어요.</h2><p>과거 월말 잔액을 알고 있다면 직접 기록할 수 있습니다. 미래 기록은 예상 화면에서 확인하세요.</p></div></div>'}<section class="panel history-trend"><div class="panel-header"><div><h2>기록으로 보는 자산 변화</h2><p>저장된 기준일의 순자산입니다.</p></div><span class="subtle-tag">HISTORY</span></div>${assetTrend(0,true)}</section><section class="table-panel history-records"><div class="table-heading"><h2>월별 자산 기록 <span>${rows.length}개월</span></h2></div>${rows.length?`<div class="table-scroll"><table><caption class="sr-only">월별 자산 기록</caption><thead><tr><th>월 · 기준일</th><th>기록 구분</th><th class="numeric">총자산</th><th class="numeric">총부채</th><th class="numeric">순자산</th><th></th></tr></thead><tbody>${rows.map(r=>{const t=snapshotTotals(r);return `<tr><td><strong>${r.month}</strong><small>${r.asOf} 기준</small></td><td><span class="status-pill ${r.source==='manual'?'paid':''}">${r.source==='auto'?'저장 시 자동 기록':r.asOf===paymentDate(r.month,31)?'월말 기록':'기준일 기록'}</span></td><td class="numeric">${money(t.gross)}</td><td class="numeric">${money(t.debt)}</td><td class="numeric history-net"><strong>${money(t.net)}</strong></td><td><button class="button secondary small" data-action="snapshot-form" data-month="${r.month}" aria-label="${r.month} 자산 기록 수정">기록 수정</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-symbol">'+svg('history')+'</div><h3>첫 자산 기록을 남겨보세요.</h3><p>내역을 저장하면 그달 기준 기록이 자동으로 생깁니다.<br>월말의 정확한 잔액은 직접 기록해 주세요.</p></div>'}</section><p class="category-note">자동 기록은 사이트에서 내역을 저장한 날의 잔액입니다. 월말 당일의 기록이 없으면 마지막 저장일을 표시하며, 정확한 과거 월말 잔액을 추정해 확정하지 않습니다. 직접 저장한 기록은 이후 현재 잔액을 수정해도 유지됩니다.</p>`;
}
function forecastPage(){
 const today=todayKST(),rows=forecastMonths(portfolio,today,12),first=rows[0],last=rows.at(-1),overdue=portfolio.cards.filter(r=>!r.paid&&r.dueDate<=today).length;
 return `${planningHeader('월별 전망','각 월말에 남을 예금과 순자산을 확인하세요.')}${demoBanner()}<div class="forecast-banner">${svg('forecast')}<div><strong>${today.replaceAll('-','.')} 현재 잔액 기준 예상</strong><p>오늘 이후의 일정부터 반영합니다. 주식 평가액·연 이율은 유지하고 퇴직연금에는 등록한 회사 월 납입액을 더합니다. 예상 이자는 모든 대출에 대해 매달 남은 잔액과 연 이율로 다시 계산합니다.</p></div><span class="forecast-badge">예상치</span></div>${overdue?`<p class="inline-warning">결제일이 오늘이거나 지난 미결제 카드 ${overdue}건은 부채로 남겨둡니다. 결제 예정일을 조정하면 예상에 반영됩니다.</p>`:''}<div class="planning-metrics">${metric('이번 달 말 예상 순자산',money(first.net))}${metric('이번 달 말 예상 예금',money(first.deposits),'현금 부족 여부를 확인하세요.',first.cashShortage?'text-danger':'')}${metric('12개월 후 예상 순자산',money(last.net),last.month+' 말')}${metric('12개월 후 예상 대출',money(last.loans),'예정 원금 상환 반영')}</div><section class="panel history-trend"><div class="panel-header"><div><h2>순자산 예상 추이</h2><p>실선은 기록·현재, 점선은 앞으로의 예상</p></div><span class="subtle-tag">FORECAST</span></div>${assetTrend(12)}</section><section class="table-panel"><div class="table-heading"><h2>월별 전망 내역</h2><span class="table-hint">원 단위 · 첫 달은 오늘 이후 일정만 반영</span></div><div class="table-scroll"><table><thead><tr><th>예상 월</th><th class="numeric">수입</th><th class="numeric">지출</th><th class="numeric">예금 잔액</th><th class="numeric">퇴직금·연금</th><th class="numeric">대출 잔액</th><th class="numeric">순자산</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><strong>${r.month}</strong><small>${i===0?'오늘 이후 → 월말':'월별 전망'}${r.cashShortage?' · 현금 부족':''}</small></td><td class="numeric income-color">${money(r.income)}</td><td class="numeric">${money(r.expense)}</td><td class="numeric ${r.cashShortage?'text-danger':''}">${money(r.deposits)}</td><td class="numeric">${money(r.retirement)}</td><td class="numeric">${money(r.loans)}</td><td class="numeric"><strong>${money(r.net)}</strong></td></tr>`).join('')}</tbody></table></div></section><p class="category-note">예금에 수입을 더하고 지출을 뺍니다. 대출 원금은 잔액까지만 상환하며, 잔액이 0이 되면 다음 상환을 중단합니다. 카드 결제는 예금과 미결제 부채에서 함께 차감하므로 순자산에서 중복 차감하지 않습니다. 미등록 지출, 새 카드 청구, 시장가격·환율·금리 변화는 예측에 포함되지 않습니다.</p>`;
}
function paydayPage(){
 const today=todayKST(),salaries=portfolio.cashflow.filter(row=>row.type==='salary');
 if(!salaries.some(row=>row.id===paydaySalaryId))paydaySalaryId='all';
 const rows=paydayForecasts(portfolio,today,12,paydaySalaryId);
 if(!rows.length)return `${planningHeader('급여일 전망','월급 입금일까지의 모든 수입·지출을 반영합니다.','add-salary','월급 등록')}${demoBanner()}<section class="panel"><div class="empty-state"><div class="empty-symbol">${svg('payday')}</div><h3>${salaries.length?'앞으로의 월급일을 등록해 주세요.':'월급날을 먼저 등록해 주세요.'}</h3><p>수입·지출에서 구분을 ‘월급’으로 선택하고<br>실수령액과 입금일, 매월 반복 여부를 입력하세요.<br>오늘 이후 1년 안의 월급일을 기준으로 계산합니다.<br>제외한 월급은 수입·지출에서 예상에 반영으로 바꿔 주세요.</p><button class="button primary" data-action="add-salary">${svg('plus')} 월급 등록하기</button><a class="button secondary" href="#cashflow">수입·지출 확인 ↗</a>${paydaySalaryId!=='all'?'<button class="button secondary" data-action="reset-payday-filter">전체 월급일 보기</button>':''}</div></section>`;
 const selected=rows.find(row=>row.date===paydaySelectedDate)||rows[0],baseline=totals(portfolio);paydaySelectedDate=selected.date;
 const diff=selected.net-baseline.net,dayIncome=selected.dayEvents.filter(e=>e.income).reduce((n,e)=>n+e.amount,0),dayExpense=selected.dayEvents.filter(e=>!e.income).reduce((n,e)=>n+e.amount,0);
 const names={salary:'월급',other_income:'기타 수입',expense:'기타 지출',fixed:'고정지출',loan:'대출 원금·이자',card:'카드 결제'};
 return `${planningHeader('급여일 전망','선택한 급여일이 끝났을 때의 예금과 순자산입니다.','add-salary','월급 추가')}${demoBanner()}<div class="payday-controls"><div><label for="payday-salary-filter">기준 월급</label><select id="payday-salary-filter"><option value="all">등록한 모든 월급일</option>${salaries.map(row=>`<option value="${escapeHTML(row.id)}" ${paydaySalaryId===row.id?'selected':''}>${escapeHTML(row.name)}</option>`).join('')}</select></div><div><label for="payday-date-filter">예상 자산을 확인할 월급일</label><select id="payday-date-filter">${rows.map(row=>`<option value="${row.date}" ${selected.date===row.date?'selected':''}>${row.date.replaceAll('-','.')} · ${escapeHTML(row.salaryNames.join(', '))}</option>`).join('')}</select></div></div><div class="forecast-banner">${svg('payday')}<div><strong>${selected.date.replaceAll('-','.')} 하루 종료 기준 예상</strong><p>오늘 이후부터 선택한 월급날 당일까지의 모든 등록 수입·지출을 반영합니다. 기준 월급을 따로 골라도 다른 월급과 수입은 자산 계산에 함께 포함됩니다.</p></div><span class="forecast-badge">예상치</span></div><div class="planning-metrics">${metric('예상 예금 잔액',money(selected.deposits),'현재 예금 + 누적 수입 − 누적 지출',selected.cashShortage?'text-danger':'')}${metric('예상 순자산',money(selected.net),'주식·예금·퇴직금 − 남은 부채')}${metric('현재 대비 순자산 변화',(diff>0?'+':'')+money(diff),today.replaceAll('-','.')+' 현재 잔액과 비교',diff<0?'text-danger':'income-color')}${metric('월급날 입금될 월급 합계',money(selected.salaryAmount),selected.salaryNames.map(escapeHTML).join(' · '))}</div><div class="planning-columns payday-details"><section class="panel"><div class="panel-header"><div><h2>현재부터 월급날까지</h2><p>${today} 이후 → ${selected.date} 당일 포함</p></div><span class="subtle-tag">CASH FLOW</span></div><div class="payday-ledger"><div><span>현재 예금 잔액</span><strong>${money(baseline.deposits)}</strong></div><div><span>누적 예정 수입</span><strong class="income-color">+ ${money(selected.cumulativeIncome)}</strong></div><div><span>누적 예정 지출</span><strong>− ${money(selected.cumulativeExpense)}</strong></div><div class="payday-ledger-total"><span>급여일 전망 예금</span><strong class="${selected.cashShortage?'text-danger':''}">${money(selected.deposits)}</strong></div></div><div class="payday-debt"><span>예상 총자산 <b>${money(selected.gross)}</b></span><span>예상 총부채 <b>${money(selected.debt)}</b></span><span>예상 퇴직금·연금 <b>${money(selected.retirement)}</b></span></div>${selected.cashShortage?'<p class="inline-warning">이 날짜의 예금 잔액이 부족할 것으로 예상됩니다. 예정 지출을 확인해 주세요.</p>':''}</section><section class="panel"><div class="panel-header"><div><h2>월급날 당일 입출금</h2><p>예정 수입 ${money(dayIncome)} · 지출 ${money(dayExpense)}</p></div><span class="subtle-tag">PAYDAY</span></div><div class="payday-events">${selected.dayEvents.map(event=>`<div><span><strong>${escapeHTML(event.name)}</strong><small>${names[event.kind]}</small></span><b class="${event.income?'income-color':''}">${event.income?'+':'−'} ${money(event.amount)}</b></div>`).join('')}</div></section></div><section class="table-panel payday-table"><div class="table-heading"><h2>앞으로의 월급날별 예상</h2><span class="table-hint">향후 1년 범위 · 최대 12회 · 당일 일정 모두 반영</span></div><div class="table-scroll"><table><thead><tr><th>월급일</th><th class="numeric">당일 월급</th><th class="numeric">누적 수입</th><th class="numeric">누적 지출</th><th class="numeric">예상 예금</th><th class="numeric">예상 순자산</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr class="${selected.date===row.date?'selected-payday':''}"><td><strong>${row.date}</strong><small>${escapeHTML(row.salaryNames.join(' · '))}</small></td><td class="numeric">${money(row.salaryAmount)}</td><td class="numeric income-color">${money(row.cumulativeIncome)}</td><td class="numeric">${money(row.cumulativeExpense)}</td><td class="numeric ${row.cashShortage?'text-danger':''}">${money(row.deposits)}</td><td class="numeric"><strong>${money(row.net)}</strong></td><td><button class="button secondary small" data-action="select-payday" data-date="${row.date}" aria-label="${row.date} 예상 자산 상세 보기">상세</button></td></tr>`).join('')}</tbody></table></div></section><p class="category-note">입력한 현재 잔액을 오늘 기준으로 간주하며, 오늘 일정은 이미 반영된 것으로 취급해 중복 계산하지 않습니다. 오늘 이후 월급일을 표시합니다. 주식 평가액·연 이율은 유지하고 회사의 퇴직연금 월 납입도 예상 자산에 반영합니다. 고정지출, 등록 카드 청구, 대출 원금·이자도 함께 반영합니다. 새 카드 청구, 주가·환율 변동, 주말·공휴일에 따른 급여일 조정은 반영하지 않습니다. 카드 청구액에 포함된 고정지출은 카드대금과 중복 합산하지 않습니다.</p>`;
}

function scheduledPage(){
 const today=todayKST(),all=scheduledCashflows(portfolio,today,'all'),upcoming=all.filter(row=>row.date>today&&row.includeInForecast!==false);
 const income=upcoming.filter(row=>row.type==='other_income').reduce((n,row)=>n+row.amount,0),expense=upcoming.filter(row=>row.type==='expense').reduce((n,row)=>n+row.amount,0);
 const rows=scheduledCashflows(portfolio,today,scheduledRange).filter(row=>scheduledType==='all'||row.type===scheduledType);
 return `<div class="page-heading"><div><h1>예정 거래</h1><p class="subtitle">미래에 들어올 추가 수입과 나갈 돈을 날짜별로 기록하세요.</p></div><div class="heading-actions"><button class="button secondary" data-action="add-planned" data-type="expense">${svg('plus')} 예정 지출</button><button class="button primary" data-action="add-planned" data-type="other_income">${svg('plus')} 예정 수입</button></div></div>${demoBanner()}<div class="planning-metrics">${metric('앞으로의 추가 수입',money(income),'오늘 이후 · 예상 계산에 포함된 내역')}${metric('앞으로의 예정 지출',money(expense),'일회성 지출 · 고정지출과 별도')}${metric('예정 거래 차액',money(income-expense),'등록된 추가 수입 − 예정 지출',income<expense?'text-danger':'income-color')}${metric('다음 반영 예정일',upcoming[0]?.date.replaceAll('-','.')||'미등록','오늘 이후 첫 반영 일정')}</div><div class="forecast-banner">${svg('planned')}<div><strong>예정일에 맞춰 예상 자산에 반영합니다.</strong><p>‘예상에 반영’한 내역은 월 예산·월급날·월별 전망과 캘린더에 포함됩니다. 확실하지 않은 금액은 계산에서 제외해 두었다가 다시 포함할 수 있습니다.</p></div><span class="forecast-badge">일회성 일정</span></div>${recordLedgerHost('planned')}<p class="category-note">수입·지출의 일회성 ‘기타 수입·기타 지출’ 내역을 함께 관리합니다. 같은 금액을 다른 화면에 다시 등록하지 않아도 됩니다. 금액은 실제 입출금 전까지 현재 예금 잔액을 변경하지 않으며, 오늘 일정은 이미 현재 잔액에 반영된 것으로 취급합니다. 일자가 지난 내역은 오늘·지난 내역에서 확인하고, 실제 잔액은 직접 갱신해 주세요. 카드 청구액·고정지출과 같은 금액을 중복 입력하지 마세요.</p>`;
}
function openScheduledEditor(id,type='other_income'){
 const row=id?portfolio.cashflow.find(item=>item.id===id):null;
 if(id&&(!row||row.repeat!=='once'||!['other_income','expense'].includes(row.type)))return;
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 if($('editor').open)$('editor').close();month=todayKST().slice(0,7);openEditor('cashflow',id);
 const chosen=row?.type||type;$('field-type').innerHTML=`<option value="other_income" ${chosen==='other_income'?'selected':''}>추가 수입</option><option value="expense" ${chosen==='expense'?'selected':''}>예정 지출</option>`;
 $('field-repeat').value='once';$('field-repeat').closest('.field').hidden=true;
 const date=$('field-date');$('editor-title').textContent=`예정 ${chosen==='expense'?'지출':'수입'} ${id?'수정':'추가'}`;
 $('editor').querySelector('label[for="field-date"]').textContent='지급·지출 예정일 *';
 $('field-name').placeholder=chosen==='expense'?'예: 여행비 / 경조사비 / 가전 구입':'예: 상여금 / 환급금 / 추가 지급';
 if(!id){const tomorrow=new Date(new Date(todayKST()+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);date.value=tomorrow;date.min=tomorrow;}
 $('record-form').querySelector('button[type="submit"]').hidden=false;
 $('editor').querySelector('.form-notice').textContent='선택한 날짜에 한 번만 예상 계산에 반영합니다. 불확실한 일정은 예상에서 제외해 두세요. 현재 예금 잔액을 자동으로 바꾸지는 않습니다.';
}

function openPlanningEditor(type,selectedMonth=month){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 const isBudget=type==='budget';
 if(!isBudget&&selectedMonth>todayKST().slice(0,7)){toast('미래 월은 예상 자산에서 확인해 주세요. 실제 기록은 오늘 이전만 저장할 수 있어요.');return;}
 const existing=(portfolio[isBudget?'budgets':'snapshots']||[]).find(r=>r.month===selectedMonth);
 const current=selectedMonth===todayKST().slice(0,7),defaults=existing||(!isBudget&&current?captureSnapshot(portfolio):{});
 const specs=isBudget?[['expenseLimit','월 지출 한도','money'],['savingsTarget','월 저축 목표','money']]:[['asOf','자산 기준일','date'],['stock','주식 총평가액','money'],['deposits','예금 잔액','money'],['retirement','퇴직연금·퇴직금','money'],['loans','대출 잔액','money'],['cards','미결제 카드대금','money'],['note','기록 메모','text']];
 $('editor-title').textContent=`${selectedMonth} ${isBudget?'지출 한도 설정':'자산 기록'}`;$('form-error').textContent='';
 $('form-fields').innerHTML=specs.map(([key,label,inputType])=>{const value=defaults[key]??(inputType==='date'?(current?todayKST():paymentDate(selectedMonth,31)):isBudget?0:'');return `<div class="field ${key==='note'?'full-width':''}"><label for="plan-${key}">${label}${key==='note'?'':' *'}</label><div class="input-wrap"><input id="plan-${key}" name="${key}" type="${inputType==='date'?'date':'text'}" value="${escapeHTML(inputType==='money'&&value!==''?wonFormat.format(value):value)}" ${key==='note'?'maxlength="500"':'required'} ${inputType==='money'?'inputmode="numeric" maxlength="21"':''} ${inputType==='date'?`min="${selectedMonth}-01" max="${current?todayKST():paymentDate(selectedMonth,31)}"`:''}>${inputType==='money'?'<span>원</span>':''}</div></div>`;}).join('')+`<p class="form-notice full-width">${isBudget?'지출 한도는 대출·카드·계좌 고정지출·기타 지출을 합친 월 한도입니다. 저축 목표를 사용하지 않으면 0으로 입력하세요.':current?'현재 잔액을 기본값으로 넣었습니다. 저장하면 해당 월의 기준 기록으로 유지됩니다. 과거 기준일이라면 그날의 실제 잔액으로 수정해 주세요.':'과거 월의 잔액을 직접 입력해 주세요. 현재 잔액을 과거 기록으로 자동 복사하지 않습니다.'}</p>`;
 const submit=$('record-form').querySelector('button[type="submit"]');submit.hidden=false;submit.disabled=false;submit.textContent='저장하기 ↗';
 $('record-form').onsubmit=async event=>{event.preventDefault();if(saving)return;const values=new FormData(event.target),record={month:selectedMonth};for(const [key,,inputType]of specs)record[key]=inputType==='money'?Number(String(values.get(key)).replaceAll(',','')):String(values.get(key)||'').trim();if(!isBudget)record.source='manual';const next=structuredClone(portfolio),key=isBudget?'budgets':'snapshots';next[key]=(next[key]||[]).filter(r=>r.month!==selectedMonth);next[key].push(record);submit.disabled=true;try{await persist(next);$('editor').close();toast(isBudget?'월 지출 한도를 저장했어요.':'자산 기준 기록을 저장했어요.');}catch(error){$('form-error').textContent=error.message;}finally{submit.disabled=false;}};
 openDialog('editor');
}

function statisticsPage(){
 statisticsFilters??=initialStatisticsFilters();
 return renderStatisticsPage(portfolio,statisticsFilters,{formatMoney:money,formatCompact:compact});
}
function advisorPage(){
 advisorState??=initialAdvisorState();
 return renderAdvisorPage(portfolio,advisorState,{formatMoney:money,formatCompact:compact,demo,hideAmounts:hidden});
}
async function checkAdvisorService(){
 if(advisorState?.service!=='unknown')return;
 advisorState.service='checking';
 try{
  const response=await fetch('/api/advisor');const result=await response.json();
  advisorState.service=response.ok&&typeof result.configured==='boolean'?(result.configured?'ready':'unconfigured'):'error';
 }catch{advisorState.service='error';}
 if(view==='advisor')render();
}
async function requestAdvisor(next){
 if(advisorState?.busy)return;
 if(demo){toast('예시 모드를 종료한 뒤 실제 자산으로 상담해 주세요.');return;}
 advisorState={...next,busy:true,advice:null,error:''};render();
 try{
  const response=await fetch('/api/advisor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:next.question,options:next.options,revision})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'AI 상담을 완료하지 못했습니다.');
  if(result.revision!==revision)throw new Error('상담 중 자산이 변경됐습니다. 현재 조건으로 다시 상담해 주세요.');
  if(!['rate','balance'].includes(result.advice?.recommendation))throw new Error('상담 결과를 확인하지 못했습니다.');
  advisorState={...advisorState,busy:false,advice:result.advice,strategy:result.advice.recommendation};toast('AI 추천 상환안을 반영했어요.');
 }catch(error){advisorState={...advisorState,busy:false,error:error.message||'AI 상담 연결을 확인해 주세요.'};}
 if(view==='advisor')render();
}
function openLoanPaymentEditor(id){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 const row=id?(portfolio.loanPayments||[]).find(item=>item.id===id):{};
 if(!row)return;
 $('editor-title').textContent=id?'상환 기록 수정':'대출 상환 기록 추가';$('form-error').textContent='';
 const specs=[['name','대출명','text'],['institution','은행','text'],['date','실제 상환일','date'],['principal','상환 원금','money'],['interest','납부 이자','money'],['note','메모','text']];
 $('form-fields').innerHTML=`<div class="field full-width"><label for="payment-loan">등록 대출 연결 · 선택</label><select id="payment-loan" name="loanId"><option value="">직접 입력</option>${row.loanId&&!portfolio.loans.some(loan=>loan.id===row.loanId)?`<option value="${escapeHTML(row.loanId)}" selected>${escapeHTML(row.name)} · 보관된 기록</option>`:''}${portfolio.loans.map(loan=>`<option value="${escapeHTML(loan.id)}" ${row.loanId===loan.id?'selected':''}>${escapeHTML(loan.name)} · ${escapeHTML(loan.institution||'은행 미등록')}</option>`).join('')}</select></div>`+specs.map(([key,label,type])=>`<div class="field ${key==='note'?'full-width':''}"><label for="payment-${key}">${label}${key==='note'?'':' *'}</label><div class="input-wrap"><input id="payment-${key}" name="${key}" type="${type==='date'?'date':'text'}" value="${escapeHTML(row[key]??(type==='date'?todayKST():type==='money'?0:''))}" ${key==='note'?'maxlength="500"':'required'} ${type==='money'?'inputmode="numeric" maxlength="21"':type==='date'?`max="${todayKST()}"`:key==='note'?'':'maxlength="100"'}>${type==='money'?'<span>원</span>':''}</div></div>`).join('')+'<p class="form-notice full-width">이미 상환한 내역을 통계에 기록합니다. 현재 대출잔액은 자동 변경하지 않으며, 앞으로의 상환은 예상표에서 계산합니다.</p>';
 const submit=$('record-form').querySelector('button[type="submit"]');submit.hidden=false;submit.disabled=false;submit.textContent='상환 기록 저장';
 $('record-form').onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const values=new FormData(event.target),record={id:id||crypto.randomUUID(),loanId:String(values.get('loanId')||'')};
  for(const [key,,type]of specs)record[key]=type==='money'?Number(String(values.get(key)||'0').replaceAll(',','')):String(values.get(key)||'').trim();
  const next=structuredClone(portfolio);next.loanPayments=(next.loanPayments||[]).filter(item=>item.id!==id);next.loanPayments.push(record);submit.disabled=true;
  try{await persist(next);$('editor').close();toast('상환 기록을 저장했어요.');}catch(error){$('form-error').textContent=error.message;}finally{submit.disabled=false;}
 };
 openDialog('editor');
}

const descriptions={fixed:'월세·보험료·통신비처럼 매월 나가는 금액을 관리하세요.',cashflow:'내 월급과 기타 수입·지출을 기록하고 매달 남는 금액을 확인하세요.',stocks:'증권사별 잔고와 평가손익을 한곳에서 확인하세요.',loans:'잔액부터 이율, 매월 갚는 원금과 이자까지 꼼꼼하게.',retirement:'오늘의 노력이 쌓인, 내일의 든든한 자산.',deposits:'생활비 통장부터 정기예금까지, 내 돈이 모인 곳.',cards:'카드사별 카드 청구액을 미리 확인하고 준비하세요.'};
function categoryMetrics(kind){const t=totals(portfolio);const sum=(key)=>portfolio[kind].reduce((n,r)=>n+(r[key]||0),0);
 if(kind==='cashflow'){const f=monthlyFlow(portfolio,month);return metric('월급',money(f.salary))+metric('기타 수입',money(f.otherIncome))+metric('기타 지출',money(f.otherExpense));}
 if(kind==='stocks')return metric('총평가액',money(t.stock))+metric('총매입금액',money(t.cost))+metric('평가손익',money(t.profit),t.profitRate==null?'매입금액 입력 후 수익률을 계산해요':`수익률 ${percent(t.profitRate)}`,t.profit>=0?'positive':'negative');
 if(kind==='loans'){const weighted=t.loans?portfolio.loans.reduce((n,r)=>n+r.balance*r.rate,0)/t.loans:0;const asOf=todayKST(),annual=loanSchedule(portfolio,asOf.slice(0,7),12,asOf).reduce((n,r)=>n+r.interest,0);return metric('현재 납부 이자 합계',money(t.monthlyInterest),`향후 12개월 예상 이자 ${money(annual)}`)+metric('대출 잔액',money(t.loans))+metric('월 원금 + 이자',money(t.monthlyPrincipal+t.monthlyInterest),`원금 ${money(t.monthlyPrincipal)} · 이자 ${money(t.monthlyInterest)}`)+metric('잔액 가중평균 연 이율',`${weighted.toFixed(2)}%`,'대출잔액 기준 가중 평균');}
 if(kind==='fixed'){const f=monthlyFlow(portfolio,month);return metric('월 고정지출 합계',money(f.fixedTotal),'선택한 월에 적용되는 전체 항목')+metric('계좌 결제',money(f.fixedCash),'지출 계획·자산 전망에 반영')+metric('카드 청구액에 포함',money(f.fixedCard),'카드대금과 중복 합산하지 않아요');}
 if(kind==='retirement'){const projected=forecastMonths(portfolio,todayKST(),12).at(-1);return metric('현재 퇴직연금·퇴직금',money(t.retirement),`등록 ${portfolio.retirement.length}건 · 최근 기준일 ${portfolio.retirement.map(r=>r.asOf).sort().at(-1)?.replaceAll('-','.')||'—'}`)+metric('회사 월 납입액',money(sum('monthlyContribution')),'회사에서 퇴직연금 계좌로 납입하는 금액')+metric('12개월 예상 금액',money(projected.retirement),projected.month+' 월말 · 운용 수익률 변동 미반영');}
 if(kind==='deposits')return metric('전체 예금 잔액',money(t.deposits))+metric('등록 계좌',`${portfolio.deposits.length}개`)+metric('연 예상 이자 · 세전',money(Math.round(portfolio.deposits.reduce((n,r)=>n+r.balance*r.rate/100,0))),'잔액 × 연 이율의 단순 추정치');
 const due=portfolio.cards.filter(r=>!r.paid);return metric('미결제 합계',money(t.cards))+metric('이번 달 미결제',money(due.filter(r=>r.dueDate.startsWith(todayKST().slice(0,7))).reduce((n,r)=>n+r.amount,0)))+metric('가장 가까운 결제일',due.filter(r=>r.dueDate>=todayKST()).map(r=>r.dueDate).sort()[0]?.replaceAll('-','.')||'—',`결제일 경과 ${due.filter(r=>r.dueDate<todayKST()).length}건`);
}
const tableHeaders={fixed:['고정지출명','금액','납부일','적용 기간','결제 방식',''],cashflow:['항목명','구분','금액','일자 · 시작일','반복',''],stocks:['계좌 · 종목명','총매입금액','총평가액','평가손익',''],loans:['대출명','대출 잔액','적용 연 이율','월 원금','이번 납부 이자','이번 상환액','상환일',''],retirement:['퇴직연금·퇴직금 이름','금융기관 · 회사','현재 금액','회사 월 납입액','기준일',''],deposits:['예금명','금융기관','잔액','연 이율','만기일',''],cards:['카드사 · 카드명','카드 청구액','결제일','상태','']};
function rowHTML(kind,r){
 const name=`<td><strong class="name">${escapeHTML(r.name)}</strong><small>${escapeHTML(r.institution||r.note||'')}</small></td>`;
 const num=(v,cls='')=>`<td class="numeric ${cls}">${v}</td>`;
 let cells='';
 if(kind==='stocks'){const profit=r.valuation-r.cost;cells=name+num(money(r.cost))+num(money(r.valuation))+num(`${money(profit)}<small>${r.cost?percent(profit/r.cost*100):'—'}</small>`,profit>=0?'positive':'negative');}
 if(kind==='loans')cells=name+num(money(r.balance))+num(`${r.rate}%`)+num(money(Math.min(r.balance,r.principal)))+num(`${money(interestForLoan(r))}<small>${r.interestMode==='estimate'?'잔액·이율 자동 추정':'이번 납부액 직접 입력'}</small>`)+num(money(Math.min(r.balance,r.principal)+interestForLoan(r)))+`<td>매월 ${r.day}일<small>${escapeHTML(r.method)}</small></td>`;
 if(kind==='retirement')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.amount))+num(`${money(r.monthlyContribution||0)}<small>${r.monthlyContribution?'매월 '+Number(r.contributionDate.slice(8))+'일 · '+r.contributionDate.slice(0,7)+'부터':'미설정'}</small>`)+`<td>${r.asOf.replaceAll('-','.')}</td>`;
 if(kind==='deposits')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.balance))+num(`${r.rate}%`)+`<td>${r.maturity?r.maturity.replaceAll('-','.'): '만기 없음'}</td>`;
 if(kind==='fixed')cells=name+num(money(r.amount))+`<td>매월 ${r.day}일</td><td>${r.startMonth}<small>${r.endMonth?r.endMonth+'까지':'종료월 없음'}</small></td><td><span class="status-pill">${r.paymentSource==='card'?'카드 청구액에 포함':'계좌 결제'}</span></td>`;
 if(kind==='cashflow')cells=name+`<td><span class="status-pill ${r.type!=='expense'?'paid':''}">${FLOW_LABELS[r.type]}</span></td>`+num(`${r.type==='expense'?'−':'+'} ${money(r.amount)}`,r.type!=='expense'?'income-color':'')+`<td>${(r.occursOn||r.date).replaceAll('-','.')}<small>${r.repeat==='monthly'?'시작 '+r.date.replaceAll('-','.'):'해당 날짜 1회'}</small></td><td>${r.repeat==='monthly'?'매월 반복':'1회'}${r.includeInForecast===false?'<small>예상 계산 제외</small>':''}</td>`;
 if(kind==='cards'){const overdue=!r.paid&&r.dueDate<todayKST();cells=name+num(money(r.amount))+`<td>${r.dueDate.replaceAll('-','.')}</td><td><button class="status-pill ${r.paid?'paid':overdue?'overdue':''}" style="border:0" data-action="toggle-paid" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} ${r.paid?'미결제로 변경':'결제 완료로 변경'}">${r.paid?'✓ 결제 완료':overdue?'일자 경과 · 미결제':'결제 예정'} ↻</button></td>`;}
 return `<tr>${cells}<td><div class="row-actions">${kind==='loans'&&r.balance>0?`<button class="loan-forecast-link" data-action="loan-forecast" data-id="${escapeHTML(r.id)}">잔액 예상</button>`:''}<button data-action="edit" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 수정">${svg('edit')}</button><button data-action="delete" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 삭제">${svg('delete')}</button></div></td></tr>`;
}

function syncLoanInterest(){
 const mode=$('field-interestMode'),input=$('field-interest');if(editorKind!=='loans'||!mode||!input)return;
 input.readOnly=mode.value==='estimate';input.title=input.readOnly?'잔액 × 연 이율 ÷ 12로 계산한 추정 금액입니다.':'금융기관의 이번 납부 이자를 입력하세요. 월별 예상 이자는 잔액과 이율로 다시 계산합니다.';
 if(input.readOnly){const balance=Number(($('field-balance').value||'0').replaceAll(',','')),rate=Number($('field-rate').value||0);if(Number.isFinite(balance)&&Number.isFinite(rate)&&balance>=0&&rate>=0&&rate<=100)input.value=wonFormat.format(estimatedMonthlyInterest(balance,rate));}
}
function syncLoanPlan(){
 if(editorKind!=='loans'||!$('field-calculationMode'))return;
 const term=$('field-calculationMode').value==='term';
 for(const key of ['remainingMonths','graceMonths','nextPaymentDate']){const field=$('field-'+key);field.closest('.field').hidden=!term;field.required=term;}
 for(const key of ['principal','interestMode','interest']){const field=$('field-'+key);field.closest('.field').hidden=term;field.required=!term;}
 const method=$('field-method');method.querySelector('option[value="기타"]').disabled=term;
 if(term&&method.value==='기타')method.value='원금균등';
 const date=$('field-nextPaymentDate');if(term)date.min=new Date(Date.parse(todayKST()+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const notice=$('form-fields').querySelector('.form-notice');
 if(notice&&!demo)notice.textContent=term?'현재 잔액과 남은 횟수 기준입니다. 원금균등은 거치 후 잔액 ÷ 원금 상환 횟수, 이자는 매월 상환 전 잔액 × 연이율 ÷ 12로 추정합니다. 마지막 회차에 원 단위 차이를 정산합니다. 금융기관의 일수 계산·금리 변동·중도상환 수수료는 별도입니다.':'은행의 월 원금과 이번 납부 이자를 입력하세요. 미래 이자는 남은 잔액과 연이율로 다시 계산합니다.';
 const preview=$('loan-plan-preview');if(!preview)return;preview.hidden=!term;
 if(!term){syncLoanInterest();return;}
 const number=key=>Number(String($('field-'+key).value).replaceAll(',',''));
 const loan={id:'preview',name:'예상',calculationMode:'term',balance:number('balance'),rate:number('rate'),remainingMonths:number('remainingMonths'),graceMonths:number('graceMonths'),nextPaymentDate:date.value,day:number('day'),method:method.value};
 if(!Number.isSafeInteger(loan.balance)||loan.balance<0||!Number.isFinite(loan.rate)||loan.rate<0||loan.rate>100||!Number.isInteger(loan.remainingMonths)||loan.remainingMonths<1||loan.remainingMonths>600||!Number.isInteger(loan.graceMonths)||loan.graceMonths<0||loan.graceMonths>=loan.remainingMonths||!Number.isInteger(loan.day)||loan.day<1||loan.day>31||!/^\d{4}-\d{2}-\d{2}$/.test(date.value)){preview.textContent='잔액·연이율·남은 횟수·납부일을 입력하면 상환 계획을 계산합니다.';return;}
 const plan=loanPlanSummary(loan),next=plan.next;
 $('field-principal').value=wonFormat.format(next.principal);$('field-interest').value=wonFormat.format(next.interest);$('field-interestMode').value='estimate';
 preview.innerHTML=`<h3>입력 조건으로 계산한 상환 계획</h3><dl><div><dt>첫 납부액 · ${next.date}</dt><dd>${money(next.payment)}</dd><small>원금 ${money(next.principal)} + 이자 ${money(next.interest)}</small></div><div><dt>남은 총이자</dt><dd>${money(plan.interest)}</dd></div><div><dt>남은 총상환액</dt><dd>${money(plan.payment)}</dd></div><div><dt>완납 예정일</dt><dd>${plan.payoffDate||'상환 완료'}</dd><small>${loan.remainingMonths}회 · 거치 ${loan.graceMonths}회 포함</small></div></dl>`;
}
function syncRetirementContribution(){
 if(editorKind!=='retirement'||!$('field-monthlyContribution')||!$('field-contributionDate'))return;
 const enabled=Number($('field-monthlyContribution').value.replaceAll(',',''))>0,input=$('field-contributionDate');
 input.closest('.field').hidden=!enabled;input.required=enabled;
 const label=input.closest('.field').querySelector('label small');if(label)label.textContent=enabled?'필수':'선택';
}
function loanForecastPanel(){
 return renderLoanForecastPanel(portfolio,{formatMoney:money,loanId:loanForecastId,period:loanForecastPeriod});
}

function filteredRecords(kind){return (kind==='cashflow'?cashflowForMonth(portfolio,month,true):kind==='fixed'?fixedForMonth(portfolio,month):portfolio[kind]).filter(r=>(r.name+' '+(r.institution||'')+' '+(r.note||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>kind==='cards'?a.dueDate.localeCompare(b.dueDate):0);}
function cardsPage(){
 return `<div class="page-heading"><div><h1>카드 청구</h1><p class="subtitle">내 카드는 한 번 등록하고 매월 청구액만 입력하세요.</p></div><div class="heading-actions"><button type="button" class="button secondary" data-action="add" data-kind="cards">개별 청구 추가</button><button type="button" class="button primary" data-action="card-account-add">＋ 카드 등록</button></div></div>${demoBanner()}<div class="metric-strip">${categoryMetrics('cards')}</div>${renderCardBilling(portfolio,cardBillingState,{money,hidden})}<div class="card-history-heading"><h2>전체 청구 내역</h2><p>저장된 모든 월의 내역 · 보기 삭제는 청구 내역을 지우지 않습니다.</p></div>${recordLedgerHost('cards')}`;
}
function category(kind,{embedded=false}={}){
 if(kind==='cards'&&!embedded)return cardsPage();
 if(kind==='loans')return renderLoanManagement(portfolio,{formatMoney:money,query,heading:heading('대출 현황','남은 기간으로 원금·이자와 완납까지의 지출을 계산하세요.').replace('<div class="heading-actions">','<div class="heading-actions"><a class="button secondary" href="#advisor">AI 상담</a>'),demoBanner:demoBanner(),recordsTable:recordLedgerHost('loans'),forecastPanel:loanForecastPanel()});
 const data=filteredRecords(kind);
 const notes={fixed:'매월 납부일이 없는 달은 말일로 표시합니다. 시작월·종료월은 해당 월을 포함합니다. 카드 청구액에 포함되는 항목은 고정지출 분석에만 포함하고 카드대금과 중복 합산하지 않습니다. 수입·지출에 같은 항목을 이미 등록했다면 중복 입력하지 마세요.',cashflow:'월급은 실수령액으로 입력해 주세요. 매월 반복은 시작일이 속한 달부터 같은 날짜에 반영하며, 해당 날짜가 없는 달에는 말일로 표시합니다. 기타 지출은 카드대금·대출상환액과 중복되지 않게 입력해 주세요. 수입·지출 기록은 예금 잔액이나 순자산을 자동으로 바꾸지 않습니다.',stocks:'증권사 계좌별 총액 또는 종목별 금액 중 한 가지 방식으로 등록해 주세요. 같은 자산을 중복 등록하면 합계도 중복됩니다. 해외 자산은 원화로 환산해 입력해 주세요.',loans:'월별 예상 이자는 매달 남은 잔액 × 연 이율 ÷ 12로 계산합니다. 이번 납부 이자는 은행 청구액을 직접 입력할 수 있습니다. 실제 이자는 일수·금리 변경에 따라 다를 수 있습니다. 월별 표는 현재 잔액 기준이며 실제 상환 이력이 아닙니다. 일정이 지나도 현재 대출잔액을 자동 차감하지 않습니다.',retirement:'퇴직금 예상액과 퇴직연금 계좌 평가액은 중복되지 않도록 입력해 주세요. 입력 금액은 세전·세후 여부에 따라 실제 수령액과 다를 수 있습니다. 회사 월 납입액은 첫 납입 예정일부터 매월 예상 퇴직연금에 더하며, 예금이나 현재 잔액을 자동 변경하지 않습니다.',deposits:'연 예상 이자는 현재 잔액과 연 이율을 사용한 세전 단순 추정치입니다. 실제 이자는 상품 조건과 입출금 내역에 따라 달라집니다.',cards:'카드 청구액은 정확한 날짜별로 등록해 주세요. 상태를 눌러 결제 완료로 바꿀 수 있습니다. 완료된 카드대금은 부채에서 제외되며, 예금 잔액은 직접 수정해 주세요.'};
 return `${embedded?homeDetailHeading(navLabels[kind]+' 상세',descriptions[kind],kind):heading(navLabels[kind],descriptions[kind])+demoBanner()}${['cashflow','fixed'].includes(kind)?`<div class="flow-month-bar"><span>조회할 월</span>${monthToolbar()}</div>${kind==='cashflow'?flowSummary(month,false):''}`:''}<div class="metric-strip ${kind==='loans'?'loan-metrics':''}">${categoryMetrics(kind)}</div>${recordLedgerHost(kind)}<p class="category-note">${notes[kind]}</p>${kind==='loans'?loanForecastPanel():''}`;
}
function calendar(){
 return `${heading('입출금 달력','등록한 수입과 지출 계획을 날짜별로 확인하세요.',false)}${demoBanner()}${renderCashCalendar(portfolio,{month,selectedDate:calendarSelected,filter:calendarFilter,category:calendarCategory,mode:calendarMode,money,compact})}`;
}

function showCardAccounts(){
 if(saving)return;entryEditing=false;entryDetailEditing=false;editorKind=undefined;
 if($('editor').open)$('editor').close();$('editor-title').textContent='내 카드 관리';$('form-error').textContent='';
 $('form-fields').innerHTML='<div class="full-width">'+renderCardAccounts(portfolio)+'</div>';$('record-form').onsubmit=event=>event.preventDefault();$('record-form').querySelector('button[type="submit"]').hidden=true;openDialog('editor');
}
function openCardAccountEditor(id='',sourceBillId=''){
 if(saving)return;entryEditing=false;entryDetailEditing=false;editorKind=undefined;
 const existing=portfolio.cardAccounts?.find(row=>row.id===id),source=portfolio.cards.find(row=>row.id===sourceBillId);
 if(id&&!existing||sourceBillId&&!source){toast('카드 내역을 다시 확인해 주세요.');return;}
 if($('editor').open)$('editor').close();$('editor-title').textContent=existing?'내 카드 수정':'내 카드 등록';$('form-error').textContent='';
 const row=existing||{name:source?.name||'',day:source?Number(source.dueDate.slice(8)):25,note:''};
 $('form-fields').innerHTML=`${source?`<div class="field full-width"><label for="card-account-link">기존 카드에 연결</label><select id="card-account-link" name="account"><option value="">새 카드로 등록</option>${(portfolio.cardAccounts||[]).filter(a=>!a.archived).map(a=>`<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join('')}</select></div>`:''}<fieldset class="full-width card-account-fields" data-card-account-details><div class="form-grid"><div class="field"><label for="card-account-name">카드 이름</label><input id="card-account-name" name="name" required maxlength="100" value="${escapeHTML(row.name)}" placeholder="예: 현대카드 M"></div><div class="field"><label for="card-account-day">기본 결제일 · 매월</label><input id="card-account-day" type="number" name="day" min="1" max="31" step="1" required value="${row.day}"></div><div class="field full-width"><label for="card-account-note">메모</label><textarea id="card-account-note" name="note" maxlength="500" rows="2">${escapeHTML(row.note)}</textarea></div></div></fieldset><p class="form-notice full-width">카드 번호는 입력하지 않습니다. 기본 정보만 저장하며, 청구액은 매월 별도로 입력합니다.${source?' 선택한 기존 청구 한 건을 연결하며 금액과 날짜는 유지합니다.':''}</p>`;
 const button=$('record-form').querySelector('button[type="submit"]');button.hidden=false;button.disabled=false;button.textContent=source?'카드 등록·연결':'카드 저장';
 $('record-form').onsubmit=async event=>{
  event.preventDefault();if(saving)return;const values=new FormData(event.target),linked=String(values.get('account')||''),record={id:existing?.id||crypto.randomUUID(),name:String(values.get('name')||'').trim(),day:Number(values.get('day')),note:String(values.get('note')||'').trim(),archived:existing?.archived||false};
  button.disabled=true;try{await persist(saveCardAccount(portfolio,record,{sourceBillId,existingAccountId:linked}));$('editor').close();toast('카드를 저장했어요. 매월 청구액만 입력하면 됩니다.');}catch(error){$('form-error').textContent=error.message;}finally{button.disabled=false;}
 };openDialog('editor');
}
function openEntryManagerDetail(kind,id,row){
 openEditor(kind,id,row);entryDetailEditing=true;
 $('record-form').querySelector('button[type="submit"]').textContent='변경 목록에 담기';
 const notice=$('form-fields').querySelector('.form-notice');
 if(notice)notice.textContent='이 화면의 변경은 수정 목록에 담깁니다. 통합 입력·수정의 변경 저장을 누르면 다른 내역과 함께 반영됩니다.';
}
function mountEntryWorkspace(){
 if(view!=='entry')return;
 recordCleanups.push(mountEntryManager($('entry-manager'),()=>portfolio,entryManagerState,{
  money,hidden,onSave:next=>persist(next),onRender:()=>{if(view==='entry')render();},onReload:loadData,onFeedback:toast,
  onDetail:openEntryManagerDetail
 }));
}
function render(){unmountFinancialMotion($('main'));$('record-detail')?.remove();for(const cleanup of recordCleanups)cleanup();recordCleanups=[];unmountWorkspace($('main'));rememberDisclosure($('main'));$('main').classList.toggle('history-view',view==='history');$('main').dataset.view=view;renderNav();$('main').innerHTML=sectionTabs(view)+(view==='overview'?overview():view==='entry'?renderEntryHub(portfolio,{money,svg,session:entrySession,demoBanner:demoBanner(),managerState:entryManagerState,hidden}):view==='workspace'?workspacePage():view==='assets'?assetsPage():view==='statistics'?statisticsPage():view==='advisor'?advisorPage():view==='schedule'?calendar():view==='budget'?budgetPage():view==='history'?historyPage():view==='forecast'?forecastPage():view==='payday'?paydayPage():view==='planned'?scheduledPage():view==='records'?recordsPage():category(view));const tabs=$('main').querySelector('.section-tabs'),title=$('main').querySelector('.page-heading');if(tabs&&title)title.after(tabs);enhanceDisclosure($('main'),{view});enhanceTableExports($('main'),{onExport:downloadTable});mountRecordLedgers();mountEntryWorkspace();if($('card-billing'))recordCleanups.push(mountCardBilling($('card-billing'),()=>portfolio,cardBillingState,{onSave:next=>persist(next),onRender:()=>{if(view==='cards')render();},onReload:loadData,onFeedback:toast}));mountTrendCharts($('main'));if(view==='workspace')mountWorkspace($('main'),portfolio,workspaceState,{onRender:render,onSave:async dashboard=>{const next=structuredClone(portfolio);next.dashboard=dashboard;await persist(next,true);},onFeedback:toast});if(view==='statistics')mountStatisticsControls($('main'),statisticsFilters,next=>{statisticsFilters=next;render();},toast);if(view==='advisor'){mountAdvisorControls($('main'),advisorState,{onChange:next=>{advisorState=next;render();},onConsult:requestAdvisor,onFeedback:toast});checkAdvisorService();}mountFinancialMotion($('main'),{revision,hideAmounts:hidden});}
const fields={
 fixed:[['name','고정지출명','text',true,'예: 월세 / 보험료 / 통신비'],['amount','매월 금액','money',true,'0'],['day','매월 납부일','day',true,'예: 25'],['paymentSource','결제 방식','paymentSource',true,''],['startMonth','시작월','month',true,''],['endMonth','종료월','month',false,''],['note','메모','textarea',false,'선택 입력']],
 cashflow:[['type','구분','flowType',true,''],['name','항목명','text',true,'예: 회사 월급 / 부업 / 월세'],['amount','금액','money',true,'0'],['date','일자 · 반복 시작일','date',true,''],['repeat','반복 여부','repeat',true,''],['includeInForecast','예상 계산 반영','forecastFlag',true,''],['note','메모','textarea',false,'선택 입력']],
 stocks:[['name','계좌 · 종목명','text',true,'예: 국내주식 계좌 / 삼성전자'],['institution','증권사','text',false,'예: 미래에셋증권'],['cost','총매입금액','money',true,'0'],['valuation','총평가액','money',true,'0'],['note','메모','textarea',false,'선택 입력']],
 loans:[['name','대출명','text',true,'예: 주택담보대출'],['institution','금융기관','text',false,'예: 신한은행'],['balance','현재 대출 잔액','money',true,'0'],['rate','적용 연 이율','rate',true,'예: 4.2'],['calculationMode','상환 계산 기준','calculationMode',true,''],['method','상환 방식','select',true,''],['remainingMonths','남은 납부 횟수 · 거치 포함','months',true,'예: 36'],['graceMonths','그중 이자만 내는 거치 횟수','grace',true,'0'],['nextPaymentDate','다음 납부 예정일','date',true,''],['day','이후 매월 납부일','day',true,'예: 25'],['principal','매월 상환 원금','money',true,'0'],['interestMode','현재 이자 입력 방식','interestMode',true,''],['interest','이번 납부 이자','money',true,'0'],['note','메모','textarea',false,'선택 입력']],
 retirement:[['name','퇴직금·연금 이름','text',true,'예: 퇴직연금 DC / 예상 퇴직금'],['institution','금융기관 · 회사','text',false,'예: 삼성생명'],['amount','현재 금액','money',true,'0'],['monthlyContribution','회사 월 납입액','money',true,'0'],['contributionDate','첫 납입 예정일','date',false,''],['asOf','금액 기준일','date',true,''],['note','메모','textarea',false,'세전/세후 여부 등을 기록하세요']],
 deposits:[['name','계좌명','text',true,'예: 생활비 통장 / 정기예금'],['institution','금융기관','text',false,'예: 토스뱅크'],['balance','현재 잔액','money',true,'0'],['rate','연 이율','rate',true,'0'],['maturity','만기일','date',false,''],['note','메모','textarea',false,'선택 입력']],
 cards:[['name','카드사 · 카드명','text',true,'예: 현대카드 M'],['amount','결제예정액','money',true,'0'],['dueDate','결제일','date',true,''],['paid','결제 상태','paid',false,''],['note','메모','textarea',false,'선택 입력']]
};
function openEditor(kind,id,rowOverride){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 entryEditing=false;entryDetailEditing=false;
 if(!KINDS.includes(kind)){showAddMenu();return;}
 editorKind=kind;editingId=id||null;
 const row=rowOverride||(id?portfolio[kind].find(r=>r.id===id):{});
 if(!row)return;
 $('editor-title').textContent=`${LABELS[kind]} ${id?'수정':'추가'}`;$('form-error').textContent='';
 $('form-fields').innerHTML=fields[kind].map(([key,label,type,required,placeholder])=>{
  let value=row[key]??(kind==='loans'&&key==='calculationMode'?(id?'manual':'term'):kind==='loans'&&key==='method'?'원금균등':kind==='loans'&&key==='remainingMonths'?12:kind==='loans'&&key==='graceMonths'?0:kind==='loans'&&key==='nextPaymentDate'?(paymentDate(todayKST().slice(0,7),25)>todayKST()?paymentDate(todayKST().slice(0,7),25):paymentDate(shiftMonth(todayKST().slice(0,7),1),25)):kind==='loans'&&key==='day'?25:key==='includeInForecast'?true:key==='startMonth'?month:key==='paymentSource'?'account':key==='interestMode'?(id?'manual':'estimate'):key==='repeat'?'monthly':(type==='date'&&required)?(kind==='cashflow'&&month!==todayKST().slice(0,7)?month+'-01':todayKST()):['money','rate'].includes(type)?0:'');
  let input;
  if(type==='calculationMode')input=`<select id="field-${key}" name="${key}"><option value="term" ${value==='term'?'selected':''}>남은 기간으로 자동 계산</option><option value="manual" ${value==='manual'?'selected':''}>월 원금 직접 입력 · 기존 방식</option></select>`;
  else if(type==='forecastFlag')input=`<select id="field-${key}" name="${key}"><option value="true" ${value!==false?'selected':''}>예상에 반영</option><option value="false" ${value===false?'selected':''}>예상에서 제외</option></select>`;
  else if(type==='paymentSource'||type==='interestMode'){const options=type==='paymentSource'?[['account','계좌 결제 · 지출에 추가'],['card','카드 청구액에 포함 · 중복 제외']]:[['estimate','잔액·연 이율로 자동 추정'],['manual','이번 납부액 직접 입력']];input=`<select id="field-${key}" name="${key}" required>${options.map(([v,label])=>`<option value="${v}" ${value===v?'selected':''}>${label}</option>`).join('')}</select>`;}
  else if(type==='flowType'||type==='repeat'){const options=type==='flowType'?Object.entries(FLOW_LABELS):[['once','해당 날짜 1회'],['monthly','매월 반복']];input=`<select id="field-${key}" name="${key}" required>${options.map(([v,label])=>`<option value="${v}" ${value===v?'selected':''}>${label}</option>`).join('')}</select>`;}
  else if(type==='select')input=`<select id="field-${key}" name="${key}" required>${['원금균등','원리금균등','만기일시','기타'].map(v=>`<option value="${v}" ${value===v?'selected':''}>${v==='원금균등'?'원금균등분할 · 원금 일정, 이자 감소':v==='원리금균등'?'원리금균등 · 총 납부액 일정':v==='만기일시'?'만기일시 · 마지막에 원금 상환':v}</option>`).join('')}</select>`;
  else if(type==='paid')input=`<select id="field-${key}" name="${key}"><option value="false">결제 예정</option><option value="true" ${value===true?'selected':''}>결제 완료</option></select>`;
  else if(type==='textarea')input=`<textarea id="field-${key}" name="${key}" maxlength="500" placeholder="${placeholder}" rows="2">${escapeHTML(value)}</textarea>`;
  else input=`<div class="input-wrap"><input id="field-${key}" name="${key}" type="${type==='money'?'text':['rate','day','months','grace'].includes(type)?'number':type}" ${required?'required':''} ${type==='money'?'inputmode="numeric" maxlength="21"':type==='rate'?'min="0" max="100" step="0.001"':type==='day'?'min="1" max="31" step="1"':type==='months'?'min="1" max="600" step="1"':type==='grace'?'min="0" max="599" step="1"':type==='text'?'maxlength="100"':''} value="${escapeHTML(type==='money'?wonFormat.format(value):value)}" placeholder="${placeholder}">${type==='money'?'<span>원</span>':type==='rate'?'<span>%</span>':type==='day'?'<span>일</span>':''}</div>`;
  return `<div class="field ${type==='textarea'?'full-width':''}"><label for="field-${key}">${label} ${required?'<span>*</span>':'<small>선택</small>'}</label>${input}${kind==='loans'&&key==='principal'?'<p class="field-hint">은행 납입액 중 원금으로 갚는 금액만 입력하세요. 예를 들어 총 50만 원 중 이자가 10만 원이면 원금은 40만 원입니다. 이 금액만큼 예상 대출잔액이 줄어듭니다.</p>':''}${kind==='loans'&&key==='remainingMonths'?'<p class="field-hint">앞으로 낼 횟수입니다. 예: 3년 남았다면 36회. 현재 잔액을 거치 이후 회차로 나눕니다.</p>':kind==='loans'&&key==='graceMonths'?'<p class="field-hint">처음에 이자만 내는 횟수입니다. 없으면 0으로 두세요.</p>':kind==='loans'&&key==='day'?'<p class="field-hint">29~31일이 없는 달은 말일에 납부하는 것으로 계산합니다.</p>':''}${kind==='retirement'&&key==='monthlyContribution'?'<p class="field-hint">회사가 퇴직연금 계좌에 매달 납입하는 금액입니다. 현재 금액과 별도로 입력하며, 월 납입액이 없으면 0원으로 두세요. 앞으로의 퇴직연금·순자산 예상에 반영하고 예금에서는 차감하지 않습니다.</p>':kind==='retirement'&&key==='contributionDate'?'<p class="field-hint">이 날짜부터 매월 같은 날 납입하는 것으로 예상합니다. 29~31일이 없는 달은 말일에 반영합니다. 오늘까지 지난 납입은 다시 더하지 않습니다.</p>':''}</div>`;
 }).join('')+`<p class="form-notice full-width">${demo?'예시 모드입니다. 변경 내용은 실제 자산에 저장되지 않습니다.':kind==='cashflow'?'월급은 실수령액을 입력해 주세요. 반복은 시작 월부터 적용됩니다. 기타 지출은 카드·대출과 중복 등록하지 마세요.':kind==='loans'?'직접 입력은 이번 납부 이자입니다. 월별 예상에서는 입력 방식과 관계없이 남은 잔액 × 연 이율 ÷ 12로 이자를 다시 계산합니다.':kind==='fixed'?'카드대금에 포함된 고정지출은 카드 청구액에 포함을 선택해 주세요. 같은 금액을 기타 지출에 다시 입력하지 마세요.':'입력한 내역은 본인 계정에 저장됩니다. 금액은 원화 기준으로 입력해 주세요.'}</p>`;
 if(kind==='loans'){const preview=document.createElement('section');preview.id='loan-plan-preview';preview.className='loan-plan-preview full-width';preview.setAttribute('aria-live','polite');$('form-fields').insertBefore(preview,$('form-fields').querySelector('.form-notice'));syncLoanPlan();}else syncRetirementContribution();
 $('record-form').onsubmit=submitRecord;
 $('record-form').querySelector('button[type="submit"]').textContent='저장하기 ↗';
 openDialog('editor');
}
function showAddMenu(){
 $('editor-title').textContent='내역 추가';$('form-error').textContent='';
 $('form-fields').innerHTML=`<div class="add-menu full-width">${(view==='assets'?['deposits','stocks','retirement']:KINDS).map(k=>`<button type="button" class="button secondary" data-action="choose-kind" data-kind="${k}">${svg(k)}${navLabels[k]}<span>↗</span></button>`).join('')}</div>`;
 $('record-form').onsubmit=e=>e.preventDefault();$('record-form').querySelector('button[type="submit"]').hidden=true;openDialog('editor');
}
function rememberEntryDraft(){
 if(!entryEditing)return;
 entryDrafts[entryActiveType]=Object.fromEntries(fields[editorKind].map(([key])=>[key,$('field-'+key)?.value??'']));
}
function setEntryField(key,value){
 const field=$('field-'+key);if(!field)return;
 if(field.tagName==='SELECT')for(const option of field.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));
 field.value=String(value);
}
function startEntryEditor(type,{capture=true,message=''}={}){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 const preset=entryPresets.find(p=>p.id===type);if(!preset)return;
 if(capture&&entryEditing&&$('editor').open)rememberEntryDraft();
 entryEditing=false;if($('editor').open)$('editor').close();
 entryActiveType=type;month=todayKST().slice(0,7);openEditor(preset.kind);entryEditing=true;
 $('editor-title').textContent=preset.label+' 등록';
 if(preset.kind==='cashflow')$('field-type').closest('.field').hidden=true;
 const defaults={...preset.defaults};if(preset.future)defaults.date=shiftCalendarDay(todayKST(),1);
 for(const [key,value]of Object.entries({...defaults,...entryDrafts[type]}))setEntryField(key,value);
 const controls=document.createElement('div');controls.className='entry-editor-controls full-width';
 controls.innerHTML=`<label for="entry-type">입력할 내역<select id="entry-type">${entryGroups.map(group=>`<optgroup label="${group.label}">${entryPresets.filter(p=>p.group===group.id).map(p=>`<option value="${p.id}" ${p.id===type?'selected':''}>${p.label}</option>`).join('')}</optgroup>`).join('')}</select></label><label class="entry-continue-label"><input type="checkbox" id="entry-continue" checked>저장 후 계속 입력</label>`;
 $('form-fields').prepend(controls);
 if(message){const note=document.createElement('p');note.className='entry-save-message full-width';note.setAttribute('role','status');note.textContent=message;controls.after(note);}
 const submit=$('record-form').querySelector('button[type="submit"]');submit.hidden=false;submit.textContent='저장하고 다음 입력';
 if(preset.kind==='loans')syncLoanPlan();else syncRetirementContribution();
 $('field-name')?.focus();
}
async function submitRecord(e){
 e.preventDefault();if(saving)return;
 const fromEntry=entryEditing,entryType=entryActiveType,recordKind=editorKind,keepEntering=fromEntry&&Boolean($('entry-continue')?.checked);
 const values=new FormData(e.target),record={id:editingId||crypto.randomUUID()};
 for(const [key,,type]of fields[recordKind]){const v=values.get(key);record[key]=type==='money'?Number(String(v).replaceAll(',','')):['rate','day','months','grace'].includes(type)?Number(v):(type==='paid'||type==='forecastFlag')?v==='true':String(v||'').trim();}
 if(recordKind==='cards'&&editingId){const link=portfolio.cards.find(row=>row.id===editingId)?.cardAccountId;if(link)record.cardAccountId=link;}
 if(recordKind==='loans'&&record.calculationMode==='term'){record.interestMode='estimate';}
 if(entryDetailEditing){
  try{const check=structuredClone(portfolio);check[recordKind][check[recordKind].findIndex(r=>r.id===record.id)]=record;const clean=validatePortfolio(check)[recordKind].find(r=>r.id===record.id);stageEntryRecord(entryManagerState,portfolio,recordKind,clean);entryDetailEditing=false;$('editor').close();render();toast('변경 목록에 담았어요. 변경 저장을 누르면 한 번에 반영됩니다.');}catch(error){$('form-error').textContent=error.message;}return;
 }
 const next=structuredClone(portfolio);const i=next[recordKind].findIndex(r=>r.id===editingId);if(i>=0)next[recordKind][i]=record;else next[recordKind].push(record);
 const submit=e.target.querySelector('button[type="submit"]'),disabled=fromEntry?[...e.target.querySelectorAll('input,select,textarea,button')].map(el=>[el,el.disabled]):[[submit,submit.disabled]];
 if(fromEntry)rememberEntryDraft();for(const [el]of disabled)el.disabled=true;$('form-error').textContent='';
 try{
  await persist(next);
  const stillOpen=$('editor').open;entryEditing=false;$('editor').close();
  if(fromEntry){
   delete entryDrafts[entryType];entrySession=[{kind:recordKind,id:record.id,label:entryPresets.find(p=>p.id===entryType).label},...entrySession].slice(0,30);
   if(view==='entry')render();
   if(keepEntering&&stillOpen)startEntryEditor(entryType,{capture:false,message:(demo?'예시 내역 · ':'')+record.name+' 저장 완료. 다음 내역을 입력하세요.'});
  }
  toast(demo?'예시 내역을 변경했어요.':'내역을 저장했어요.');
 }catch(error){$('form-error').textContent=error.message;}finally{for(const [el,wasDisabled]of disabled)if(el.isConnected)el.disabled=wasDisabled;}
}

function startDemo(){entrySession=[];entryDrafts={};entryEditing=false;entryDetailEditing=false;entryManagerState=createEntryManagerState();cardBillingState=createCardBillingState();workspaceState=createWorkspaceState();recordWorkspace=createLedgerWorkspace();
 if(!demo){realData=portfolio;realRevision=revision;demo=true;portfolio=validatePortfolio(samplePortfolio());}
 loading=false;view='overview';location.hash='overview';$('settings-dialog').close();status('예시 보기 중');render();
}
async function exitDemo(){entrySession=[];entryDrafts={};entryEditing=false;entryDetailEditing=false;entryManagerState=createEntryManagerState();cardBillingState=createCardBillingState();workspaceState=createWorkspaceState();recordWorkspace=createLedgerWorkspace();demo=false;portfolio=realData||emptyPortfolio();revision=realRevision;realData=null;await loadData();}
function downloadTable(csv,title){
 if(!csv){toast('내려받을 내역이 없습니다.');return;}
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`모아-${title.replace(/[\\/:*?"<>|]/g,'').slice(0,60)}-${todayKST()}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('현재 조회 내역을 CSV로 내려받았어요.');
}
function updateDashboardSearch(){
 $('dashboard-search-results').innerHTML=renderDashboardSearch(searchDashboard(portfolio,$('dashboard-search').value,navLabels),$('dashboard-search').value);
}
function openDashboardSearch(){
 if(loading)return;
 if(document.querySelector('dialog[open]')?.id!=='search-dialog'&&document.querySelector('dialog[open]'))return;
 $('dashboard-search').value='';updateDashboardSearch();if(!$('search-dialog').hasAttribute('open'))$('search-dialog').showModal();$('dashboard-search').focus();
}
$('global-search-launch').onclick=openDashboardSearch;
$('dashboard-search').addEventListener('input',updateDashboardSearch);
$('search-dialog').addEventListener('keydown',event=>{
 const results=[...$('dashboard-search-results').querySelectorAll('[data-search-route]')];
 if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
 const index=results.indexOf(document.activeElement);
 if(event.key==='Enter'&&document.activeElement===$('dashboard-search')){event.preventDefault();results[0]?.click();return;}
 if(event.key==='Enter')return;
 event.preventDefault();if(event.key==='ArrowUp'&&index<=0)$('dashboard-search').focus();else results[Math.min(results.length-1,Math.max(0,index+(event.key==='ArrowDown'?1:-1)))]?.focus();
});
$('search-dialog').addEventListener('click',event=>{
 const result=event.target.closest('[data-search-route]');if(!result)return;
 $('search-dialog').close();location.hash=result.dataset.searchRoute;
 if(result.dataset.searchId)openEditor(result.dataset.searchKind,result.dataset.searchId);
});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openDashboardSearch();}});
document.addEventListener('click',async e=>{
 const close=e.target.closest('[data-close]');if(close){if(close.dataset.close==='editor')entryDetailEditing=false;if(close.dataset.close==='editor'&&entryEditing){rememberEntryDraft();entryEditing=false;}$(close.dataset.close).close();return;}
 const button=e.target.closest('[data-action]');if(!button)return;
 const {action,kind,id}=button.dataset;
 if(action==='card-accounts'){showCardAccounts();return;}
 if(action==='card-account-add'||action==='card-account-edit'||action==='card-account-from-bill'){openCardAccountEditor(action==='card-account-edit'?id:'',action==='card-account-from-bill'?id:'');return;}
 if(action==='card-account-archive'){if(saving)return;const row=portfolio.cardAccounts?.find(row=>row.id===id);if(!row)return;try{await persist(setCardArchived(portfolio,id,!row.archived));showCardAccounts();toast(row.archived?'카드를 복원했어요.':'카드를 보관했어요. 청구 기록은 유지됩니다.');}catch(error){$('form-error').textContent=error.message;}return;}
 if(action==='entry-mode'){if(entryManagerState.busy)return;entryManagerState.mode=button.dataset.mode==='new'?'new':'manage';render();$('main').querySelector('[data-mode="'+entryManagerState.mode+'"]')?.focus();return;}
 if(action==='entry-existing'){if(hidden){toast('금액 표시를 켠 뒤 상세 수정해 주세요.');return;}try{const row=entryDraftRow(entryManagerState,portfolio,kind,id);entryManagerState.mode='manage';entryManagerState.category=kind;entryManagerState.query='';entryManagerState.page=1;render();openEntryManagerDetail(kind,id,row);}catch(error){toast(error.message);}return;}
 if(action==='entry-start'){startEntryEditor(button.dataset.entryType);return;}
 if(action==='calendar-day'){calendarSelected=button.dataset.date;calendarMode='month';render();document.querySelector(`[data-action="calendar-day"][data-date="${calendarSelected}"]`)?.focus();return;}
 if(action==='calendar-mode'){calendarMode=button.dataset.mode==='list'?'list':'month';render();document.querySelector(`[data-action="calendar-mode"][data-mode="${calendarMode}"]`)?.focus();return;}
 if(action==='calendar-category'){calendarCategory=button.dataset.category;render();document.querySelector(`[data-action="calendar-category"][data-category="${calendarCategory}"]`)?.focus();return;}
 if(action==='calendar-reset'){calendarCategory='all';calendarFilter='all';render();return;}
 if(action==='calendar-filter'){calendarFilter=button.dataset.filter;render();document.querySelector(`[data-action="calendar-filter"][data-filter="${calendarFilter}"]`)?.focus();return;}
 if(action==='calendar-all'){calendarSelected='all';render();document.querySelector('[data-action="calendar-all"]')?.focus();return;}
 if(action==='calendar-add'){openEditor('cashflow');$('record-form').querySelector('button[type="submit"]').hidden=false;$('field-type').value=button.dataset.type;$('field-date').value=button.dataset.date;$('field-repeat').value='once';return;}
 if(action==='retry-views'){recordWorkspace.loaded=false;loadRecordPreferences();return;}
 if(action==='navigate-view'){location.hash=button.dataset.view;return;}
 if(action==='check-advisor'){advisorState.service='unknown';render();return;}
 if(action==='home-detail'){selectHomeDetail(button.dataset.detail);return;}
 if(action==='reveal-advisor')$('privacy-toggle').click();
 if(action==='add-loan-payment'||action==='edit-loan-payment')openLoanPaymentEditor(id);
 if(action==='delete-loan-payment'&&await confirmAction('상환 기록을 삭제할까요?','이 기록을 통계에서 삭제합니다. 현재 대출잔액은 바뀌지 않습니다.')){const next=structuredClone(portfolio);next.loanPayments=(next.loanPayments||[]).filter(row=>row.id!==id);try{await persist(next);toast('상환 기록을 삭제했어요.');}catch(error){toast(error.message);}}
 if(action==='add-planned'||action==='edit-planned')openScheduledEditor(id,button.dataset.type||'other_income');
 if(action==='toggle-planned'){const next=structuredClone(portfolio),item=next.cashflow.find(row=>row.id===id);if(item){item.includeInForecast=item.includeInForecast===false;try{await persist(next);toast(item.includeInForecast?'예상 계산에 포함했어요.':'예상 계산에서 제외했어요.');}catch(error){toast(error.message);}}}
 if(action==='pin-statistics'){
  const config=structuredClone(dashboardConfig(portfolio,workspaceState));if(config.widgets.length>=16){toast('통계 카드는 최대 16개까지 추가할 수 있어요.');return;}
  const f=statisticsFilters;config.period={preset:'custom',start:f.start,end:f.end};config.widgets.push({...widgetTemplates[0].config,id:crypto.randomUUID(),title:(f.bank||f.query||'선택한 통계')+' · '+f.start.slice(0,7),kind:f.kind,metric:$('stats-metric')?.value||f.metric,basis:f.basis||'all',bank:f.bank,item:f.item,query:f.query});
  workspaceState={...createWorkspaceState(),editing:true,draft:config};location.hash='#workspace';toast('대시보드에 추가했어요. 순서를 정하고 화면 저장을 눌러 주세요.');
 }
 if(action==='budget-form'||action==='snapshot-form')openPlanningEditor(action==='budget-form'?'budget':'snapshot',button.dataset.month||month);
 if(action==='add-salary'){if($('editor').open)$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;month=todayKST().slice(0,7);openEditor('cashflow');$('field-type').value='salary';}
 if(action==='reset-payday-filter'){paydaySalaryId='all';paydaySelectedDate='';render();}
 if(action==='select-payday'){paydaySelectedDate=button.dataset.date;render();}
 if(action==='loan-forecast'){loanForecastId=id;render();$('loan-forecast-title')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
 if(action==='chart-range'){chartHorizon=Number(button.dataset.range);render();}
 if(action==='add'||action==='edit'){if($('editor').open)$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;openEditor(kind,id);}
 if(action==='choose-kind'){$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;openEditor(kind);}
 if(action==='delete'){
   const row=portfolio[kind].find(r=>r.id===id);if(!row)return;
   if(await confirmAction('이 내역을 삭제할까요?',`‘${row.name}’ 내역을 삭제합니다. 다시 사용하려면 새로 입력해야 해요.`)){
     const next=structuredClone(portfolio);next[kind]=next[kind].filter(r=>r.id!==id);try{await persist(next);toast('내역을 삭제했어요.');}catch(error){toast(error.message);}
   }
 }
 if(action==='toggle-paid'){const next=structuredClone(portfolio),r=next.cards.find(r=>r.id===id);if(r){r.paid=!r.paid;try{await persist(next);toast(r.paid?'결제 완료로 표시했어요. 예금 잔액도 확인해 주세요.':'결제 예정으로 변경했어요.');}catch(error){toast(error.message);}}}
 if(action==='demo')startDemo();if(action==='exit-demo')exitDemo();if(action==='retry')loadData();
 if(['prev-month','next-month','this-month'].includes(action)){if(action==='this-month')month=todayKST().slice(0,7);else{const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+(action==='next-month'?1:-1),1));month=d.toISOString().slice(0,7);}render();}
});
document.addEventListener('keydown',e=>{
 const cell=e.target.closest?.('[data-action="calendar-day"]');if(!cell)return;
 const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(offset===undefined)return;
 e.preventDefault();calendarSelected=shiftCalendarDay(cell.dataset.date,offset);month=calendarSelected.slice(0,7);render();document.querySelector(`[data-action="calendar-day"][data-date="${calendarSelected}"]`)?.focus();
});
document.addEventListener('change',e=>{if(e.target.id==='card-account-link'){const fieldset=$('form-fields').querySelector('[data-card-account-details]');fieldset.hidden=Boolean(e.target.value);fieldset.disabled=Boolean(e.target.value);return;}if(e.target.id==='entry-type'){startEntryEditor(e.target.value);return;}if(e.target.id==='entry-continue'){e.target.closest('form').querySelector('button[type="submit"]').textContent=e.target.checked?'저장하고 다음 입력':'저장하기';return;}if(e.target.id==='calendar-status'){calendarFilter=e.target.value;render();$('calendar-status')?.focus();}if(e.target.id==='calendar-month'&&/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value>='1900-01'&&e.target.value<='2200-12'){month=e.target.value;calendarSelected='';render();$('calendar-month')?.focus();}if(e.target.id==='loan-forecast-select'){loanForecastId=e.target.value;render();}if(e.target.id==='payment-loan'){const loan=portfolio.loans.find(row=>row.id===e.target.value);if(loan){$('payment-name').value=loan.name;$('payment-institution').value=loan.institution||'';$('payment-principal').value=wonFormat.format(loan.principal);$('payment-interest').value=wonFormat.format(interestForLoan(loan));}}if(e.target.id==='scheduled-range'){scheduledRange=e.target.value;render();}if(e.target.id==='scheduled-type'){scheduledType=e.target.value;render();}if(e.target.id==='field-nextPaymentDate'&&e.target.value)$('field-day').value=Number(e.target.value.slice(8));if(['field-interestMode','field-calculationMode','field-method','field-nextPaymentDate','field-day','field-remainingMonths','field-graceMonths'].includes(e.target.id))syncLoanPlan();if(e.target.id==='loan-forecast-period'){loanForecastPeriod=e.target.value;render();}if(e.target.id==='payday-salary-filter'){paydaySalaryId=e.target.value;paydaySelectedDate='';render();}if(e.target.id==='payday-date-filter'){paydaySelectedDate=e.target.value;render();}});
document.addEventListener('input',e=>{
 if(e.target.id==='field-monthlyContribution')syncRetirementContribution();
 if(['field-balance','field-rate','field-remainingMonths','field-graceMonths','field-principal','field-day'].includes(e.target.id))syncLoanPlan();
 if((e.target.id==='record-search'&&!e.target.hasAttribute('data-ledger-field'))||e.target.id==='loan-card-search'){query=e.target.value;const kind=view==='overview'?(homeSelection==='debt'?'loans':homeSelection):view;const rows=filteredRecords(kind);if(kind==='loans'&&$('loan-list')){rememberDisclosure($('main'));$('loan-list').innerHTML=renderLoanCards(rows,{formatMoney:money})||'<div class="empty-inline loan-search-empty">검색 결과가 없습니다.</div>';$('loans-count').textContent=rows.length+'건';enhanceDisclosure($('main'),{view});return;}if(!$('records-body'))return;$('records-body').innerHTML=rows.map(r=>rowHTML(kind,r)).join('')||`<tr><td colspan="${tableHeaders[kind].length}" class="empty-inline">검색 결과가 없습니다.</td></tr>`;}
 if(e.target.matches('#record-form input[inputmode="numeric"]')){const raw=e.target.value.replaceAll(',','');if(/^\d*$/.test(raw))e.target.value=raw?wonFormat.format(Number(raw)):'';}
});
$('privacy-toggle').onclick=()=>{hidden=!hidden;localStorage.setItem('moa-hide-amounts',String(hidden));if(!loading)render();else renderNav();};
$('data-settings').onclick=()=>openDialog('settings-dialog');
$('mobile-settings').onclick=()=>openDialog('settings-dialog');
$('open-demo').onclick=startDemo;
$('export-data').onclick=()=>{
 if(demo){toast('예시 모드를 종료한 뒤 실제 내역을 백업해 주세요.');return;}
 const file=new Blob([JSON.stringify(portfolio,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`moa-assets-${todayKST()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 내려받았어요.');
};
$('import-data').onclick=()=>{if(demo){toast('예시 모드를 종료한 뒤 복원해 주세요.');return;}$('import-file').click();};
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>1_000_000)throw new Error('백업 파일은 1MB 이하로 선택해 주세요.');
  const data=validatePortfolio(JSON.parse(await file.text()));const count=KINDS.reduce((n,k)=>n+data[k].length,0)+data.budgets.length+data.snapshots.length+data.loanPayments.length+data.cardAccounts.length;
  $('settings-dialog').close();if(await confirmAction('백업 내역으로 교체할까요?',`현재 내역을 지우고 백업 파일의 ${count}건으로 교체합니다. 기존 내역이 필요하면 취소 후 먼저 내보내 주세요.`,'교체하기')){await persist(data);toast(`${count}건의 내역을 복원했어요.`);}
 }catch(error){toast(error instanceof SyntaxError?'올바른 JSON 백업 파일을 선택해 주세요.':error.message);}
};
$('editor').addEventListener('cancel',()=>{entryDetailEditing=false;if(entryEditing){rememberEntryDraft();entryEditing=false;}});
window.addEventListener('beforeunload',event=>{if(entryManagerState.drafts.size||cardBillingState.drafts.size){event.preventDefault();event.returnValue='';}});
function setView(){const hash=location.hash.slice(1);if(entryEditing&&hash!=='entry'){rememberEntryDraft();entryEditing=false;$('editor').close();}view=navLabels[hash]?hash:'overview';query='';if(!loading)render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',setView);setView();renderNav();loadData();

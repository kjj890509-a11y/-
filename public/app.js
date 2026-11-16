import {KINDS, LABELS, FLOW_LABELS, emptyPortfolio, todayKST, validatePortfolio, totals, eventsForMonth, cashflowForMonth, monthlyFlow, samplePortfolio, paymentDate, budgetPlan, forecastMonths, snapshotTotals, captureSnapshot, fixedForMonth, interestForLoan, estimatedMonthlyInterest, loanSchedule, paydayForecasts, scheduledCashflows} from '/domain.mjs';
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
let chartHorizon=6;
const navLabels = {overview:'대시보드',budget:'월별 예산',forecast:'월말 예상',payday:'월급날 예상',planned:'예정 입출금',history:'자산 기록',stocks:'주식 잔고',loans:'대출 관리',retirement:'퇴직금',deposits:'예금',cards:'카드 결제',fixed:'고정지출',cashflow:'수입·지출',schedule:'월별 일정'};
function money(value, unit = '원') { return hidden ? '••••••' : `${wonFormat.format(value)}${unit}`; }
function compact(value) { if(hidden)return '••••'; if(Math.abs(value)>=1e8)return `${(value/1e8).toFixed(2)}억`; if(Math.abs(value)>=1e4)return `${wonFormat.format(Math.round(value/1e4))}만`;return wonFormat.format(value); }
function percent(value){return hidden?'••%':`${value>0?'+':''}${value.toFixed(2)}%`;}
const rowsCount = () => KINDS.reduce((n,k)=>n+portfolio[k].length,0);
const status = (label,error=false) => {$('save-state').innerHTML=`<i style="background:${error?'#c48365':'#7da367'}"></i>${escapeHTML(label)}`;};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function openDialog(id){$(id).showModal();}
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
    portfolio=validatePortfolio(data.data);revision=data.revision;loading=false;status('서버 저장됨');render();
  }catch(error){loading=false;status('연결 필요',true);$('main').innerHTML=`<div class="error-state"><span class="eyebrow">MY ASSET NOTE</span><h1>자산 노트에 연결해 주세요</h1><p>${escapeHTML(error.message)}</p><button class="button primary" data-action="retry">다시 시도</button> <a class="button secondary" href="/signin-with-chatgpt?return_to=/" target="_top">로그인하기</a><p style="margin-top:24px;font-size:11px">먼저 둘러보고 싶다면 예시 화면을 열어보세요.</p><button class="button secondary" data-action="demo">예시로 둘러보기 ↗</button></div>`;renderNav();}
}
async function persist(next){
  if(saving)throw new Error('저장 중입니다. 잠시만 기다려 주세요.');
  next=validatePortfolio(next);
  if(demo) {portfolio=next;render();status('예시 보기 중');return;}
  saving=true;status('저장하는 중');
  try{
    const res=await fetch('/api/portfolio',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'저장하지 못했습니다.');
    portfolio=validatePortfolio(data.data);revision=data.revision;status('서버 저장됨');render();
  }catch(error){status('저장 실패',true);throw error;}finally{saving=false;}
}
function renderNav(){
  $('main-nav').innerHTML=Object.entries(navLabels).map(([key,label],i)=>`${i===1?'<div class="nav-divider"></div><span class="nav-label">자산 관리</span>':''}${key==='schedule'?'<div class="nav-divider"></div>':''}<a href="#${key}" class="nav-link ${view===key?'active':''}" ${view===key?'aria-current="page"':''}>${svg(key)}<span>${label}</span>${KINDS.includes(key)?`<span class="nav-count">${portfolio[key].length || ''}</span>`:''}</a>`).join('');
  $('breadcrumb').textContent=navLabels[view];
  $('privacy-toggle').innerHTML=svg(hidden?'eyeoff':'eye');$('privacy-toggle').setAttribute('aria-label',hidden?'금액 표시하기':'금액 숨기기');$('privacy-toggle').title=hidden?'금액 표시하기':'금액 숨기기';
}
function heading(title,subtitle,action=true){
  return `<div class="page-heading"><div><span class="eyebrow">${view==='overview'?'A LITTLE MORE, EVERY DAY':'MY ASSET NOTE / '+view.toUpperCase()}</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions"><span class="date-chip">${todayKST().replaceAll('-','. ')}</span>${action?`<button class="button primary" data-action="add" ${view!=='overview'?`data-kind="${view}"`:''}>${svg('plus')} 내역 추가</button>`:''}</div></div>`;
}
function demoBanner(){return demo?'<div class="demo-bar"><span>예시 모드 · 아래 금액은 기능 설명을 위한 가상 내역입니다.</span><button data-action="exit-demo">내 자산으로 돌아가기</button></div>':'';}
function metric(label,value,caption='',className=''){return `<div class="metric-box"><span class="label">${label}</span><strong class="${className}">${value}</strong>${caption?`<small>${caption}</small>`:''}</div>`;}
function paymentRow(item){
  const today=todayKST();const overdue=!item.paid&&item.date<today;
  const diff=Math.round((new Date(item.date+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000);
  const badge=item.paid?'결제 완료':overdue?'일자 경과':diff===0?'오늘':`D-${diff}`;
  return `<div class="payment-row"><div class="payment-date"><span>${Number(item.date.slice(5,7))}월</span><strong>${Number(item.date.slice(8))}</strong></div><div class="institution-icon ${item.type}">${escapeHTML(item.name.slice(0,1))}</div><div class="payment-info"><strong>${escapeHTML(item.name)}</strong><small>${item.type==='cashflow'?FLOW_LABELS[item.flowType]:item.type==='loans'?'대출 원금 + 이자':item.type==='fixed'?'고정지출 · 계좌 결제':'카드 결제예정액'}</small></div><span class="payment-amount ${item.income?'income-color':''}">${item.income?'+ ':''}${money(item.amount)}</span><span class="status-pill ${overdue?'overdue':item.paid?'paid':''}">${badge}</span></div>`;
}
function monthToolbar(){const [y,m]=month.split('-').map(Number);return `<div class="calendar-toolbar"><button data-action="prev-month" aria-label="이전 달">‹</button><strong>${y}년 ${m}월</strong><button data-action="next-month" aria-label="다음 달">›</button><button data-action="this-month" style="width:auto;padding:0 8px;font-size:9px">이번 달</button></div>`;}
function flowSummary(selectedMonth,link=true){
 const f=monthlyFlow(portfolio,selectedMonth);
 return `<section class="panel flow-summary"><div class="panel-header"><div><h2>${Number(selectedMonth.slice(5))}월 수입과 지출</h2><p>월급과 기타 수입에서 예정 지출을 빼면 얼마가 남을까요?</p></div>${link?'<a class="panel-link" href="#cashflow">내역 관리 ↗</a>':''}</div><div class="flow-metrics"><div><span>총수입</span><strong class="income-color">${money(f.income)}</strong><small>월급 ${money(f.salary)} + 기타 ${money(f.otherIncome)}</small></div><div><span>총지출 예정</span><strong>${money(f.expense)}</strong><small>대출·카드 ${money(f.payments)} + 고정 ${money(f.fixedCash)} + 기타 ${money(f.otherExpense)}</small></div><div><span>남는 금액 예상</span><strong class="${f.balance<0?'negative':'income-color'}">${money(f.balance)}</strong><small>총수입 − 총지출 예정</small></div></div><p class="panel-note">기타 지출은 카드대금·대출상환액과 중복되지 않게 등록해 주세요. 예금 잔액은 자동 변경되지 않습니다.</p></section>`;
}
function planningHeader(title,subtitle,action,label){
 return `<div class="page-heading"><div><span class="eyebrow">MOA / FINANCIAL PLANNING</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions">${action?`<button class="button primary" data-action="${action}">${svg('plus')}${label}</button>`:''}</div></div>`;
}
function assetTrend(horizon=6,historyOnly=false){
 const today=todayKST(),current=today.slice(0,7),t=totals(portfolio);
 const saved=(portfolio.snapshots||[]).filter(r=>historyOnly||r.month<current).slice(-6).map(r=>({label:r.month.slice(2).replace('-','.'),value:snapshotTotals(r).net,forecast:false}));
 const points=historyOnly?saved:[...saved,{label:'현재',value:t.net,forecast:false},...forecastMonths(portfolio,today,horizon).map(r=>({label:r.month.slice(2).replace('-','.')+' 말',value:r.net,forecast:true}))];
 if(!points.length)return '<div class="empty-inline">자산 기록을 남기면 월별 변화가 여기에 나타납니다.</div>';
 const width=760,height=240,left=74,right=25,top=20,bottom=35;
 const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),padding=Math.max((max-min)*.18,10000);
 const low=min-padding,high=max+padding;
 const x=i=>left+i*(width-left-right)/Math.max(1,points.length-1),y=v=>top+(high-v)/(high-low)*(height-top-bottom);
 const path=rows=>rows.map(({p,i},k)=>`${k?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
 const indexed=points.map((p,i)=>({p,i})),firstForecast=points.findIndex(p=>p.forecast);
 const real=firstForecast<0?indexed:indexed.slice(0,firstForecast),projected=firstForecast<0?[]:indexed.slice(Math.max(0,firstForecast-1));
 const grid=Array.from({length:4},(_,i)=>{const value=low+(high-low)*i/3;return `<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)" stroke-dasharray="3 5"/><text x="${left-13}" y="${y(value)+4}" text-anchor="end">${compact(value)}</text>`;}).join('');
 const labels=points.map((p,i)=>i%Math.max(1,Math.ceil(points.length/8))===0||i===points.length-1?`<text x="${x(i)}" y="${height-10}" text-anchor="middle">${p.label}</text>`:'').join('');
 return `<figure class="trend-chart" aria-label="월별 순자산 기록과 미래 예상 추이"><svg viewBox="0 0 ${width} ${height}" role="img"><title>순자산 추이. 실선은 기록, 점선은 예상입니다.</title>${grid}<path d="${path(indexed)} L${x(points.length-1)},${height-bottom} L${left},${height-bottom} Z" fill="#7265dd" fill-opacity=".08"/>${real.length>1?`<path d="${path(real)}" fill="none" stroke="#6254c7" stroke-width="2.7"/>`:''}${projected.length>1?`<path d="${path(projected)}" fill="none" stroke="#8c80d9" stroke-width="2.4" stroke-dasharray="6 5"/>`:''}${indexed.map(({p,i})=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.forecast?3:4}" fill="${p.forecast?'#fff':'#6254c7'}" stroke="#8275d4" stroke-width="2"><title>${p.label}: ${money(p.value)}${p.forecast?' 예상':' 기록'}</title></circle>`).join('')}${labels}</svg><figcaption><span><i></i>저장 기록 · 현재</span>${!historyOnly?'<span class="forecast-key"><i></i>월말 예상</span>':''}<span class="chart-unit">단위: 원</span></figcaption><table class="sr-only"><caption>월별 순자산</caption><tbody>${points.map(p=>`<tr><th>${p.label} ${p.forecast?'예상':'기록'}</th><td>${money(p.value)}</td></tr>`).join('')}</tbody></table></figure>`;
}
function budgetWidget(selected=month){
 const p=budgetPlan(portfolio,selected),has=p.limit!==null;
 const ratio=has?(p.limit===0?(p.expense>0?100:0):Math.min(100,p.expense/p.limit*100)):0;
 return `<section class="panel budget-widget"><div class="panel-header"><div><h2>이번 달 예산</h2><p>${selected.replace('-','년 ')}월 · 등록 내역 기준</p></div><a class="panel-link" href="#budget">관리 ↗</a></div><span class="budget-eyebrow">${has?'예산 잔여액':'나에게 맞는 지출 계획'}</span><strong class="budget-remaining ${has&&p.remaining<0?'text-danger':''}">${has?money(p.remaining):'예산을 정해 보세요'}</strong><div class="budget-progress"><i class="${has&&p.remaining<0?'over-budget':''}" style="width:${ratio}%"></i></div><div class="budget-progress-label"><span>예정 ${money(p.expense)}</span><span>${has?'예산 '+money(p.limit):'예산 미설정'}</span></div><div class="budget-widget-metrics"><div><span>예정 수입</span><strong>${money(p.income)}</strong></div><div><span>남는 금액</span><strong>${money(p.balance)}</strong></div></div><div class="budget-widget-foot"><a href="#fixed">고정지출 ${money(p.fixedTotal)}</a><a href="#loans">월 이자 ${money(totals(portfolio).monthlyInterest)}</a></div><a class="button secondary" href="#budget">${has?'월별 예산 살펴보기':'첫 예산 설정하기'} ↗</a></section>`;
}
function overview(){
 const t=totals(portfolio),today=todayKST(),current=today.slice(0,7),forecast=forecastMonths(portfolio,today,1)[0];
 const past=(portfolio.snapshots||[]).filter(r=>r.month<current).at(-1),delta=past?t.net-snapshotTotals(past).net:null;
 const events=eventsForMonth(portfolio,current).filter(e=>!e.paid).sort((a,b)=>(a.date<today)-(b.date<today)||a.date.localeCompare(b.date)).slice(0,4);
 const nextPayday=paydayForecasts(portfolio,today,1)[0];
 const shares=t.gross?[t.stock/t.gross*100,t.deposits/t.gross*100,t.retirement/t.gross*100]:[0,0,0];
 return `${planningHeader('나의 자산 대시보드','오늘의 자산을 확인하고, 앞으로의 한 달을 계획하세요.','add','내역 추가')}${demoBanner()}${!rowsCount()?`<div class="empty-welcome"><div><h2>내 자산의 첫 페이지를 열어보세요.</h2><p>내역을 입력하면 예산과 월말 예상 자산이 함께 정리됩니다.</p></div><button class="button secondary small" data-action="demo">예시 둘러보기 ↗</button></div>`:''}<div class="summary-grid"><section class="summary-card featured"><div class="summary-label">${svg('overview')} 현재 순자산 <span>LIVE</span></div><strong>${money(t.net)}</strong><p>${delta===null?'자산 기록을 쌓아 월별 변화를 확인하세요.':`최근 기록(${past.month}) 대비 <b>${delta>0?'+':''}${money(delta)}</b>`}</p></section><section class="summary-card"><div class="summary-label">${svg('deposits')} 총자산</div><strong>${money(t.gross)}</strong><p>주식 + 예금 + 퇴직금</p></section><section class="summary-card"><div class="summary-label">${svg('loans')} 총부채</div><strong>${money(t.debt)}</strong><p>대출 ${money(t.loans)} · 카드 ${money(t.cards)}</p></section><section class="summary-card"><div class="summary-label">${svg('forecast')} 이번 달 말 예상</div><strong>${money(forecast.net)}</strong><p>오늘 이후 등록 일정 반영 <a href="#forecast">↗</a></p></section></div><a class="payday-spotlight" href="#payday"><span class="payday-symbol">${svg('payday')}</span><span><strong>${nextPayday?nextPayday.date.replaceAll('-','.')+' 월급날 예상':'월급날의 자산은 얼마나 될까요?'}</strong><small>${nextPayday?'당일까지의 수입·지출과 부채 상환을 반영합니다.':'월급일과 실수령액을 등록하고 예상 자산을 확인하세요.'}</small></span><span class="payday-spotlight-amount">${nextPayday?money(nextPayday.net):'월급 등록'} <small>${nextPayday?'예상 순자산':'↗'}</small></span></a><div class="dashboard-main"><section class="panel trend-panel"><div class="panel-header"><div><h2>차곡차곡 쌓이는 자산</h2><p>기록된 과거부터 앞으로의 월말까지</p></div><div class="segmented"><button class="${chartHorizon===6?'active':''}" data-action="chart-range" data-range="6">6개월</button><button class="${chartHorizon===12?'active':''}" data-action="chart-range" data-range="12">12개월</button></div></div>${assetTrend(chartHorizon)}<div class="trend-footer"><span>기준일 ${today.replaceAll('-','.')} · 주가 변동 미반영</span><a href="#history">월별 기록 보기 ↗</a></div></section>${budgetWidget(current)}</div><div class="dashboard-lower"><section class="panel composition-panel"><div class="panel-header"><div><h2>자산 포트폴리오</h2><p>부채 차감 전 자산 구성</p></div><span class="subtle-tag">ASSETS</span></div><div class="allocation"><div class="donut" style="background:${t.gross?`conic-gradient(#6254c7 0 ${shares[0]}%,#a69ade ${shares[0]}% ${shares[0]+shares[1]}%,#ddd8f0 ${shares[0]+shares[1]}% 100%)`:'#edeaf5'}"><div class="donut-center"><span>총자산</span><strong>${compact(t.gross)}</strong></div></div><div class="allocation-legend">${[['stocks','주식',t.stock,'#6254c7'],['deposits','예금',t.deposits,'#a69ade'],['retirement','퇴직금',t.retirement,'#ddd8f0']].map(([key,label,value,color],i)=>`<a class="legend-row" href="#${key}"><i style="background:${color}"></i><span>${label}<small>${money(value)}</small></span><strong>${shares[i].toFixed(1)}%</strong></a>`).join('')}</div></div><div class="portfolio-note"><span>주식 평가손익 <b class="${t.profit>=0?'income-color':'text-danger'}">${money(t.profit)} ${t.profitRate===null?'':'('+percent(t.profitRate)+')'}</b></span><span>월 대출 이자 <b>${money(t.monthlyInterest)}</b></span></div></section><section class="panel"><div class="panel-header"><div><h2>다가오는 입출금</h2><p>월급, 대출, 카드 일정을 놓치지 마세요.</p></div><a class="panel-link" href="#schedule">전체 보기 ↗</a></div><div class="payment-list">${events.length?events.map(paymentRow).join(''):'<div class="empty-inline">예정된 일정이 없어요.<br>월급이나 결제 내역을 추가해 보세요.</div>'}</div></section></div><div class="dashboard-notice">${svg('info')}<span>저장할 때 그달의 자산 기준 기록을 자동으로 남깁니다. 월말에는 ‘자산 기록’에서 잔액을 확인해 확정해 주세요.</span><a href="#history">기록 관리 ↗</a></div>`;
}
function budgetPage(){
 const p=budgetPlan(portfolio,month),loans=eventsForMonth(portfolio,month).filter(e=>e.type==='loans').reduce((n,e)=>n+e.amount,0),cards=portfolio.cards.filter(r=>r.dueDate.startsWith(month)).reduce((n,r)=>n+r.amount,0);
 const ratio=p.limit===null?0:p.limit===0?(p.expense>0?100:0):Math.min(100,p.expense/p.limit*100);
 const target=p.target||0,goal=target?Math.max(0,Math.min(100,p.balance/target*100)):0;
 return `${planningHeader('월별 예산','계획한 만큼 쓰고, 남는 돈을 내일의 자산으로.','budget-form',p.limit===null?'예산 설정':'예산 수정')}${demoBanner()}<div class="flow-month-bar"><span>예산을 확인할 월</span>${monthToolbar()}</div><div class="planning-metrics">${metric('예정 수입',money(p.income),'월급 + 기타 수입')}${metric('예정 지출',money(p.expense),'대출 · 카드 · 고정 · 기타 지출')}${metric('남는 금액 예상',money(p.balance),'예정 수입 − 예정 지출',p.balance<0?'text-danger':'income-color')}${metric('지출 예산 잔여',p.limit===null?'미설정':money(p.remaining),p.limit===null?'월별 지출 한도를 설정하세요.':'지출 예산 − 예정 지출',p.remaining<0?'text-danger':'')}</div><div class="planning-columns"><section class="panel"><div class="panel-header"><div><h2>이번 달 지출 계획</h2><p>결제 완료 카드도 해당 월 지출에 포함합니다.</p></div><span class="subtle-tag">BUDGET</span></div><div class="budget-total"><strong>${money(p.expense)}</strong><span>${p.limit===null?'예산 미설정':'예산 '+money(p.limit)}</span></div><div class="budget-progress"><i class="${p.remaining<0?'over-budget':''}" style="width:${ratio}%"></i></div><div class="breakdown-list">${[['대출 원금·이자',loans,'loans'],['카드 결제',cards,'cards'],['고정지출 · 계좌 결제',p.fixedCash,'fixed'],['기타 지출',p.otherExpense,'cashflow']].map(([label,value,icon])=>`<div class="breakdown-row"><span class="stat-icon">${svg(icon)}</span><div><strong>${label}</strong><div class="mini-progress"><i style="width:${p.expense?value/p.expense*100:0}%"></i></div></div><b>${money(value)}</b></div>`).join('')}</div><p class="panel-note">기타 지출은 카드대금·대출상환액과 겹치지 않게 입력해 주세요. 이 화면은 실제 사용액이 아닌 등록 내역에 따른 월간 계획입니다.</p></section><section class="panel savings-panel"><div class="panel-header"><div><h2>이번 달 남길 금액</h2><p>월별 저축 목표를 설정해 보세요.</p></div>${svg('target')}</div><div class="goal-ring" style="background:conic-gradient(#7163cf ${goal}%,#eeeaf8 ${goal}%)"><div><span>목표 대비 예상</span><strong>${target?Math.round(goal)+'%':'—'}</strong></div></div><div class="goal-details"><div><span>남는 금액</span><strong>${money(p.balance)}</strong></div><div><span>저축 목표</span><strong>${target?money(target):'미설정'}</strong></div></div><p class="panel-note">${target?(p.balance>=target?'등록 내역 기준으로 목표를 달성할 수 있어요.':`목표까지 ${money(target-p.balance)}이 더 필요해요.`):'예산 수정에서 저축 목표를 입력하세요.'}</p></section></div>`;
}
function historyPage(){
 const rows=(portfolio.snapshots||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
 const selected=rows.find(r=>r.month===month),t=selected?snapshotTotals(selected):null;
 const previous=rows.find(r=>r.month<month),delta=t&&previous?t.net-snapshotTotals(previous).net:null;
 return `${planningHeader('월말 자산 기록','지난달의 자산을 남겨두고, 변화를 확인하세요.','snapshot-form','자산 기록')}${demoBanner()}<div class="flow-month-bar"><span>확인할 월</span>${monthToolbar()}</div>${t?`<div class="planning-metrics">${metric('기록된 순자산',money(t.net),t.asOf.replaceAll('-','.')+' 기준')}${metric('기록된 총자산',money(t.gross))}${metric('기록된 총부채',money(t.debt))}${metric('이전 기록 대비',delta===null?'—':money(delta),previous?previous.month+' 기록과 비교':'비교할 이전 기록이 없습니다.')}</div>`:'<div class="empty-welcome"><div><h2>이 달에는 저장된 자산 기록이 없어요.</h2><p>과거 월말 잔액을 알고 있다면 직접 기록할 수 있습니다. 미래 기록은 예상 화면에서 확인하세요.</p></div></div>'}<section class="panel history-trend"><div class="panel-header"><div><h2>기록으로 보는 자산 변화</h2><p>저장된 기준일의 순자산입니다.</p></div><span class="subtle-tag">HISTORY</span></div>${assetTrend(0,true)}</section><section class="table-panel"><div class="table-heading"><h2>월별 자산 기록 <span>${rows.length}개월</span></h2></div>${rows.length?`<div class="table-scroll"><table><thead><tr><th>월 · 기준일</th><th>기록 구분</th><th class="numeric">총자산</th><th class="numeric">총부채</th><th class="numeric">순자산</th><th></th></tr></thead><tbody>${rows.map(r=>{const t=snapshotTotals(r);return `<tr><td><strong>${r.month}</strong><small>${r.asOf} 기준</small></td><td><span class="status-pill ${r.source==='manual'?'paid':''}">${r.source==='auto'?'저장 시 자동 기록':r.asOf===paymentDate(r.month,31)?'월말 기록':'기준일 기록'}</span></td><td class="numeric">${money(t.gross)}</td><td class="numeric">${money(t.debt)}</td><td class="numeric"><strong>${money(t.net)}</strong></td><td><button class="icon-button" data-action="snapshot-form" data-month="${r.month}" aria-label="${r.month} 자산 기록 수정">${svg('edit')}</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-symbol">'+svg('history')+'</div><h3>첫 자산 기록을 남겨보세요.</h3><p>내역을 저장하면 그달 기준 기록이 자동으로 생깁니다.<br>월말의 정확한 잔액은 직접 기록해 주세요.</p></div>'}</section><p class="category-note">자동 기록은 사이트에서 내역을 저장한 날의 잔액입니다. 월말 당일의 기록이 없으면 마지막 저장일을 표시하며, 정확한 과거 월말 잔액을 추정해 확정하지 않습니다. 직접 저장한 기록은 이후 현재 잔액을 수정해도 유지됩니다.</p>`;
}
function forecastPage(){
 const today=todayKST(),rows=forecastMonths(portfolio,today,12),first=rows[0],last=rows.at(-1),overdue=portfolio.cards.filter(r=>!r.paid&&r.dueDate<=today).length;
 return `${planningHeader('앞으로의 월말 자산','등록한 수입·지출 일정으로 향후 12개월을 미리 확인하세요.')}${demoBanner()}<div class="forecast-banner">${svg('forecast')}<div><strong>${today.replaceAll('-','.')} 현재 잔액 기준 예상</strong><p>오늘 이후의 일정부터 반영합니다. 주식·퇴직금 평가액과 연 이율은 유지한다고 가정합니다. 자동 추정 이자는 대출잔액에 따라 다시 계산하고, 직접 입력 이자는 입력액을 유지합니다.</p></div><span class="forecast-badge">예상치</span></div>${overdue?`<p class="inline-warning">결제일이 오늘이거나 지난 미결제 카드 ${overdue}건은 부채로 남겨둡니다. 결제 예정일을 조정하면 예상에 반영됩니다.</p>`:''}<div class="planning-metrics">${metric('이번 달 말 예상 순자산',money(first.net))}${metric('이번 달 말 예상 예금',money(first.deposits),'현금 부족 여부를 확인하세요.',first.cashShortage?'text-danger':'')}${metric('12개월 후 예상 순자산',money(last.net),last.month+' 말')}${metric('12개월 후 예상 대출',money(last.loans),'예정 원금 상환 반영')}</div><section class="panel history-trend"><div class="panel-header"><div><h2>순자산 예상 추이</h2><p>실선은 기록·현재, 점선은 앞으로의 예상</p></div><span class="subtle-tag">FORECAST</span></div>${assetTrend(12)}</section><section class="table-panel"><div class="table-heading"><h2>월말 예상 내역</h2><span class="table-hint">원 단위 · 첫 달은 오늘 이후 일정만 반영</span></div><div class="table-scroll"><table><thead><tr><th>예상 월</th><th class="numeric">수입</th><th class="numeric">지출</th><th class="numeric">예금 잔액</th><th class="numeric">대출 잔액</th><th class="numeric">순자산</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><strong>${r.month}</strong><small>${i===0?'오늘 이후 → 월말':'월말 예상'}${r.cashShortage?' · 현금 부족':''}</small></td><td class="numeric income-color">${money(r.income)}</td><td class="numeric">${money(r.expense)}</td><td class="numeric ${r.cashShortage?'text-danger':''}">${money(r.deposits)}</td><td class="numeric">${money(r.loans)}</td><td class="numeric"><strong>${money(r.net)}</strong></td></tr>`).join('')}</tbody></table></div></section><p class="category-note">예금에 수입을 더하고 지출을 뺍니다. 대출 원금은 잔액까지만 상환하며, 잔액이 0이 되면 다음 상환을 중단합니다. 카드 결제는 예금과 미결제 부채에서 함께 차감하므로 순자산에서 중복 차감하지 않습니다. 미등록 지출, 새 카드 청구, 시장가격·환율·금리 변화는 예측에 포함되지 않습니다.</p>`;
}
function paydayPage(){
 const today=todayKST(),salaries=portfolio.cashflow.filter(row=>row.type==='salary');
 if(!salaries.some(row=>row.id===paydaySalaryId))paydaySalaryId='all';
 const rows=paydayForecasts(portfolio,today,12,paydaySalaryId);
 if(!rows.length)return `${planningHeader('월급날 예상 자산','월급이 들어오는 날, 내 자산이 얼마나 될지 확인하세요.','add-salary','월급 등록')}${demoBanner()}<section class="panel"><div class="empty-state"><div class="empty-symbol">${svg('payday')}</div><h3>${salaries.length?'앞으로의 월급일을 등록해 주세요.':'월급날을 먼저 등록해 주세요.'}</h3><p>수입·지출에서 구분을 ‘월급’으로 선택하고<br>실수령액과 입금일, 매월 반복 여부를 입력하세요.<br>오늘 이후 1년 안의 월급일을 기준으로 계산합니다.<br>제외한 월급은 수입·지출에서 예상에 반영으로 바꿔 주세요.</p><button class="button primary" data-action="add-salary">${svg('plus')} 월급 등록하기</button><a class="button secondary" href="#cashflow">수입·지출 확인 ↗</a>${paydaySalaryId!=='all'?'<button class="button secondary" data-action="reset-payday-filter">전체 월급일 보기</button>':''}</div></section>`;
 const selected=rows.find(row=>row.date===paydaySelectedDate)||rows[0],baseline=totals(portfolio);paydaySelectedDate=selected.date;
 const diff=selected.net-baseline.net,dayIncome=selected.dayEvents.filter(e=>e.income).reduce((n,e)=>n+e.amount,0),dayExpense=selected.dayEvents.filter(e=>!e.income).reduce((n,e)=>n+e.amount,0);
 const names={salary:'월급',other_income:'기타 수입',expense:'기타 지출',fixed:'고정지출',loan:'대출 원금·이자',card:'카드 결제'};
 return `${planningHeader('월급날 예상 자산','등록한 월급일마다 예금·부채·순자산을 미리 확인하세요.','add-salary','월급 추가')}${demoBanner()}<div class="payday-controls"><div><label for="payday-salary-filter">기준 월급</label><select id="payday-salary-filter"><option value="all">등록한 모든 월급일</option>${salaries.map(row=>`<option value="${escapeHTML(row.id)}" ${paydaySalaryId===row.id?'selected':''}>${escapeHTML(row.name)}</option>`).join('')}</select></div><div><label for="payday-date-filter">예상 자산을 확인할 월급일</label><select id="payday-date-filter">${rows.map(row=>`<option value="${row.date}" ${selected.date===row.date?'selected':''}>${row.date.replaceAll('-','.')} · ${escapeHTML(row.salaryNames.join(', '))}</option>`).join('')}</select></div></div><div class="forecast-banner">${svg('payday')}<div><strong>${selected.date.replaceAll('-','.')} 하루 종료 기준 예상</strong><p>오늘 이후부터 선택한 월급날 당일까지의 모든 등록 수입·지출을 반영합니다. 기준 월급을 따로 골라도 다른 월급과 수입은 자산 계산에 함께 포함됩니다.</p></div><span class="forecast-badge">예상치</span></div><div class="planning-metrics">${metric('예상 예금 잔액',money(selected.deposits),'현재 예금 + 누적 수입 − 누적 지출',selected.cashShortage?'text-danger':'')}${metric('예상 순자산',money(selected.net),'주식·예금·퇴직금 − 남은 부채')}${metric('현재 대비 순자산 변화',(diff>0?'+':'')+money(diff),today.replaceAll('-','.')+' 현재 잔액과 비교',diff<0?'text-danger':'income-color')}${metric('월급날 입금될 월급 합계',money(selected.salaryAmount),selected.salaryNames.map(escapeHTML).join(' · '))}</div><div class="planning-columns payday-details"><section class="panel"><div class="panel-header"><div><h2>현재부터 월급날까지</h2><p>${today} 이후 → ${selected.date} 당일 포함</p></div><span class="subtle-tag">CASH FLOW</span></div><div class="payday-ledger"><div><span>현재 예금 잔액</span><strong>${money(baseline.deposits)}</strong></div><div><span>누적 예정 수입</span><strong class="income-color">+ ${money(selected.cumulativeIncome)}</strong></div><div><span>누적 예정 지출</span><strong>− ${money(selected.cumulativeExpense)}</strong></div><div class="payday-ledger-total"><span>월급날 예상 예금</span><strong class="${selected.cashShortage?'text-danger':''}">${money(selected.deposits)}</strong></div></div><div class="payday-debt"><span>예상 총자산 <b>${money(selected.gross)}</b></span><span>예상 총부채 <b>${money(selected.debt)}</b></span></div>${selected.cashShortage?'<p class="inline-warning">이 날짜의 예금 잔액이 부족할 것으로 예상됩니다. 예정 지출을 확인해 주세요.</p>':''}</section><section class="panel"><div class="panel-header"><div><h2>월급날 당일 입출금</h2><p>예정 수입 ${money(dayIncome)} · 지출 ${money(dayExpense)}</p></div><span class="subtle-tag">PAYDAY</span></div><div class="payday-events">${selected.dayEvents.map(event=>`<div><span><strong>${escapeHTML(event.name)}</strong><small>${names[event.kind]}</small></span><b class="${event.income?'income-color':''}">${event.income?'+':'−'} ${money(event.amount)}</b></div>`).join('')}</div></section></div><section class="table-panel payday-table"><div class="table-heading"><h2>앞으로의 월급날별 예상</h2><span class="table-hint">향후 1년 범위 · 최대 12회 · 당일 일정 모두 반영</span></div><div class="table-scroll"><table><thead><tr><th>월급일</th><th class="numeric">당일 월급</th><th class="numeric">누적 수입</th><th class="numeric">누적 지출</th><th class="numeric">예상 예금</th><th class="numeric">예상 순자산</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr class="${selected.date===row.date?'selected-payday':''}"><td><strong>${row.date}</strong><small>${escapeHTML(row.salaryNames.join(' · '))}</small></td><td class="numeric">${money(row.salaryAmount)}</td><td class="numeric income-color">${money(row.cumulativeIncome)}</td><td class="numeric">${money(row.cumulativeExpense)}</td><td class="numeric ${row.cashShortage?'text-danger':''}">${money(row.deposits)}</td><td class="numeric"><strong>${money(row.net)}</strong></td><td><button class="button secondary small" data-action="select-payday" data-date="${row.date}" aria-label="${row.date} 예상 자산 상세 보기">상세</button></td></tr>`).join('')}</tbody></table></div></section><p class="category-note">입력한 현재 잔액을 오늘 기준으로 간주하며, 오늘 일정은 이미 반영된 것으로 취급해 중복 계산하지 않습니다. 오늘 이후 월급일을 표시합니다. 주식·퇴직금 평가액과 연 이율은 유지하며 고정지출, 등록 카드 청구, 대출 원금·이자도 함께 반영합니다. 새 카드 청구, 주가·환율 변동, 주말·공휴일에 따른 급여일 조정은 반영하지 않습니다. 카드 청구액에 포함된 고정지출은 카드대금과 중복 합산하지 않습니다.</p>`;
}

function scheduledPage(){
 const today=todayKST(),all=scheduledCashflows(portfolio,today,'all'),upcoming=all.filter(row=>row.date>today&&row.includeInForecast!==false);
 const income=upcoming.filter(row=>row.type==='other_income').reduce((n,row)=>n+row.amount,0),expense=upcoming.filter(row=>row.type==='expense').reduce((n,row)=>n+row.amount,0);
 const rows=scheduledCashflows(portfolio,today,scheduledRange).filter(row=>scheduledType==='all'||row.type===scheduledType);
 return `<div class="page-heading"><div><span class="eyebrow">MOA / PLANNED CASH FLOW</span><h1>예정 입출금</h1><p class="subtitle">미래에 들어올 추가 수입과 나갈 돈을 날짜별로 기록하세요.</p></div><div class="heading-actions"><button class="button secondary" data-action="add-planned" data-type="expense">${svg('plus')} 예정 지출</button><button class="button primary" data-action="add-planned" data-type="other_income">${svg('plus')} 예정 수입</button></div></div>${demoBanner()}<div class="planning-metrics">${metric('앞으로의 추가 수입',money(income),'오늘 이후 · 예상 계산에 포함된 내역')}${metric('앞으로의 예정 지출',money(expense),'일회성 지출 · 고정지출과 별도')}${metric('예정 입출금 차액',money(income-expense),'등록된 추가 수입 − 예정 지출',income<expense?'text-danger':'income-color')}${metric('다음 반영 예정일',upcoming[0]?.date.replaceAll('-','.')||'미등록','오늘 이후 첫 반영 일정')}</div><div class="forecast-banner">${svg('planned')}<div><strong>예정일에 맞춰 예상 자산에 반영합니다.</strong><p>‘예상에 반영’한 내역은 월별 예산·월급날·월말 예상과 캘린더에 포함됩니다. 확실하지 않은 금액은 계산에서 제외해 두었다가 다시 포함할 수 있습니다.</p></div><span class="forecast-badge">일회성 일정</span></div><section class="table-panel"><div class="table-heading"><h2>예정 내역 <span>${rows.length}건 · 전체 ${all.length}건</span></h2><div class="scheduled-filters"><select id="scheduled-range" aria-label="예정 내역 기간"><option value="upcoming" ${scheduledRange==='upcoming'?'selected':''}>오늘 이후</option><option value="all" ${scheduledRange==='all'?'selected':''}>전체 내역</option><option value="past" ${scheduledRange==='past'?'selected':''}>오늘·지난 내역</option></select><select id="scheduled-type" aria-label="예정 내역 구분"><option value="all" ${scheduledType==='all'?'selected':''}>수입·지출 전체</option><option value="other_income" ${scheduledType==='other_income'?'selected':''}>추가 수입</option><option value="expense" ${scheduledType==='expense'?'selected':''}>예정 지출</option></select></div></div>${rows.length?`<div class="table-scroll"><table><thead><tr><th>예정일</th><th>항목명 · 메모</th><th>구분</th><th class="numeric">금액</th><th>예상 계산</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr class="${row.includeInForecast===false?'excluded-plan':''}"><td><strong>${row.date}</strong><small>${row.date>today?'예정':row.date===today?'오늘 · 현재 잔액 확인':'일자 경과'}</small></td><td><strong>${escapeHTML(row.name)}</strong><small>${escapeHTML(row.note||'')}</small></td><td><span class="status-pill ${row.type==='other_income'?'paid':''}">${row.type==='other_income'?'추가 수입':'예정 지출'}</span></td><td class="numeric ${row.type==='other_income'?'income-color':''}">${row.type==='other_income'?'+':'−'} ${money(row.amount)}</td><td><button class="status-pill ${row.includeInForecast===false?'':'paid'}" style="border:0" data-action="toggle-planned" data-id="${escapeHTML(row.id)}" aria-label="${escapeHTML(row.name)} ${row.includeInForecast===false?'예상에 포함':'예상에서 제외'}">${row.includeInForecast===false?'계산 제외':'반영 중'} ↻</button></td><td><div class="row-actions"><button data-action="edit-planned" data-id="${escapeHTML(row.id)}" aria-label="${escapeHTML(row.name)} 예정 내역 수정">${svg('edit')}</button><button data-action="delete" data-kind="cashflow" data-id="${escapeHTML(row.id)}" aria-label="${escapeHTML(row.name)} 삭제">${svg('delete')}</button></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><div class="empty-symbol">${svg('planned')}</div><h3>해당하는 예정 입출금이 없어요.</h3><p>상여금·환급금·추가 지급액이나<br>여행비·경조사비 같은 지출을 미리 등록하세요.</p><button class="button primary" data-action="add-planned" data-type="other_income">${svg('plus')} 예정 수입 등록</button><button class="button secondary" data-action="add-planned" data-type="expense">예정 지출 등록</button></div>`}</section><p class="category-note">수입·지출의 일회성 ‘기타 수입·기타 지출’ 내역을 함께 관리합니다. 같은 금액을 다른 화면에 다시 등록하지 않아도 됩니다. 금액은 실제 입출금 전까지 현재 예금 잔액을 변경하지 않으며, 오늘 일정은 이미 현재 잔액에 반영된 것으로 취급합니다. 일자가 지난 내역은 오늘·지난 내역에서 확인하고, 실제 잔액은 직접 갱신해 주세요. 카드 청구액·고정지출과 같은 금액을 중복 입력하지 마세요.</p>`;
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
 const specs=isBudget?[['expenseLimit','월 지출 예산','money'],['savingsTarget','월 저축 목표','money']]:[['asOf','자산 기준일','date'],['stock','주식 총평가액','money'],['deposits','예금 잔액','money'],['retirement','퇴직금·퇴직연금','money'],['loans','대출 잔액','money'],['cards','미결제 카드대금','money'],['note','기록 메모','text']];
 $('editor-title').textContent=`${selectedMonth} ${isBudget?'예산 설정':'자산 기록'}`;$('form-error').textContent='';
 $('form-fields').innerHTML=specs.map(([key,label,inputType])=>{const value=defaults[key]??(inputType==='date'?(current?todayKST():paymentDate(selectedMonth,31)):isBudget?0:'');return `<div class="field ${key==='note'?'full-width':''}"><label for="plan-${key}">${label}${key==='note'?'':' *'}</label><div class="input-wrap"><input id="plan-${key}" name="${key}" type="${inputType==='date'?'date':'text'}" value="${escapeHTML(inputType==='money'&&value!==''?wonFormat.format(value):value)}" ${key==='note'?'maxlength="500"':'required'} ${inputType==='money'?'inputmode="numeric" maxlength="21"':''} ${inputType==='date'?`min="${selectedMonth}-01" max="${current?todayKST():paymentDate(selectedMonth,31)}"`:''}>${inputType==='money'?'<span>원</span>':''}</div></div>`;}).join('')+`<p class="form-notice full-width">${isBudget?'지출 예산은 대출·카드·계좌 고정지출·기타 지출을 합친 월 한도입니다. 저축 목표를 사용하지 않으면 0으로 입력하세요.':current?'현재 잔액을 기본값으로 넣었습니다. 저장하면 해당 월의 기준 기록으로 유지됩니다. 과거 기준일이라면 그날의 실제 잔액으로 수정해 주세요.':'과거 월의 잔액을 직접 입력해 주세요. 현재 잔액을 과거 기록으로 자동 복사하지 않습니다.'}</p>`;
 const submit=$('record-form').querySelector('button[type="submit"]');submit.hidden=false;submit.disabled=false;submit.textContent='저장하기 ↗';
 $('record-form').onsubmit=async event=>{event.preventDefault();if(saving)return;const values=new FormData(event.target),record={month:selectedMonth};for(const [key,,inputType]of specs)record[key]=inputType==='money'?Number(String(values.get(key)).replaceAll(',','')):String(values.get(key)||'').trim();if(!isBudget)record.source='manual';const next=structuredClone(portfolio),key=isBudget?'budgets':'snapshots';next[key]=(next[key]||[]).filter(r=>r.month!==selectedMonth);next[key].push(record);submit.disabled=true;try{await persist(next);$('editor').close();toast(isBudget?'월 예산을 저장했어요.':'자산 기준 기록을 저장했어요.');}catch(error){$('form-error').textContent=error.message;}finally{submit.disabled=false;}};
 openDialog('editor');
}

const descriptions={fixed:'월세·보험료·통신비처럼 매월 나가는 금액을 관리하세요.',cashflow:'내 월급과 기타 수입·지출을 기록하고 매달 남는 금액을 확인하세요.',stocks:'증권사별 잔고와 평가손익을 한곳에서 확인하세요.',loans:'잔액부터 이율, 매월 갚는 원금과 이자까지 꼼꼼하게.',retirement:'오늘의 노력이 쌓인, 내일의 든든한 자산.',deposits:'생활비 통장부터 정기예금까지, 내 돈이 모인 곳.',cards:'카드사별 결제예정액을 미리 확인하고 준비하세요.'};
function categoryMetrics(kind){const t=totals(portfolio);const sum=(key)=>portfolio[kind].reduce((n,r)=>n+r[key],0);
 if(kind==='cashflow'){const f=monthlyFlow(portfolio,month);return metric('월급',money(f.salary))+metric('기타 수입',money(f.otherIncome))+metric('기타 지출',money(f.otherExpense));}
 if(kind==='stocks')return metric('총평가액',money(t.stock))+metric('총매입금액',money(t.cost))+metric('평가손익',money(t.profit),t.profitRate==null?'매입금액 입력 후 수익률을 계산해요':`수익률 ${percent(t.profitRate)}`,t.profit>=0?'positive':'negative');
 if(kind==='loans'){const weighted=t.loans?portfolio.loans.reduce((n,r)=>n+r.balance*r.rate,0)/t.loans:0;const annual=loanSchedule(portfolio).reduce((n,r)=>n+r.interest,0);return metric('이번 달 이자 합계',money(t.monthlyInterest),`향후 12개월 예상 이자 ${money(annual)}`)+metric('대출 잔액',money(t.loans))+metric('월 원금 + 이자',money(t.monthlyPrincipal+t.monthlyInterest),`원금 ${money(t.monthlyPrincipal)} · 이자 ${money(t.monthlyInterest)}`)+metric('잔액 가중평균 연 이율',`${weighted.toFixed(2)}%`,'대출잔액 기준 가중 평균');}
 if(kind==='fixed'){const f=monthlyFlow(portfolio,month);return metric('월 고정지출 합계',money(f.fixedTotal),'선택한 월에 적용되는 전체 항목')+metric('계좌 결제',money(f.fixedCash),'예산·예상 자산에 추가 반영')+metric('카드 청구액에 포함',money(f.fixedCard),'카드대금과 중복 합산하지 않아요');}
 if(kind==='retirement')return metric('퇴직금 · 퇴직연금 합계',money(t.retirement))+metric('등록 내역',`${portfolio.retirement.length}건`)+metric('최근 기준일',portfolio.retirement.map(r=>r.asOf).sort().at(-1)?.replaceAll('-','.')||'—','계좌 평가액 또는 예상 수령액');
 if(kind==='deposits')return metric('전체 예금 잔액',money(t.deposits))+metric('등록 계좌',`${portfolio.deposits.length}개`)+metric('연 예상 이자 · 세전',money(Math.round(portfolio.deposits.reduce((n,r)=>n+r.balance*r.rate/100,0))),'잔액 × 연 이율의 단순 추정치');
 const due=portfolio.cards.filter(r=>!r.paid);return metric('미결제 합계',money(t.cards))+metric('이번 달 미결제',money(due.filter(r=>r.dueDate.startsWith(todayKST().slice(0,7))).reduce((n,r)=>n+r.amount,0)))+metric('가장 가까운 결제일',due.filter(r=>r.dueDate>=todayKST()).map(r=>r.dueDate).sort()[0]?.replaceAll('-','.')||'—',`결제일 경과 ${due.filter(r=>r.dueDate<todayKST()).length}건`);
}
const tableHeaders={fixed:['고정지출명','금액','납부일','적용 기간','결제 방식',''],cashflow:['항목명','구분','금액','일자 · 시작일','반복',''],stocks:['계좌 · 종목명','총매입금액','총평가액','평가손익',''],loans:['대출명','대출 잔액','적용 연 이율','월 원금','월 이자','월 상환액','상환일',''],retirement:['퇴직금 · 연금명','금융기관 · 회사','금액','기준일',''],deposits:['예금명','금융기관','잔액','연 이율','만기일',''],cards:['카드사 · 카드명','결제예정액','결제일','상태','']};
function rowHTML(kind,r){
 const name=`<td><strong class="name">${escapeHTML(r.name)}</strong><small>${escapeHTML(r.institution||r.note||'')}</small></td>`;
 const num=(v,cls='')=>`<td class="numeric ${cls}">${v}</td>`;
 let cells='';
 if(kind==='stocks'){const profit=r.valuation-r.cost;cells=name+num(money(r.cost))+num(money(r.valuation))+num(`${money(profit)}<small>${r.cost?percent(profit/r.cost*100):'—'}</small>`,profit>=0?'positive':'negative');}
 if(kind==='loans')cells=name+num(money(r.balance))+num(`${r.rate}%`)+num(money(Math.min(r.balance,r.principal)))+num(`${money(interestForLoan(r))}<small>${r.interestMode==='estimate'?'잔액·이율 자동 추정':'은행 예정액 직접 입력'}</small>`)+num(money(Math.min(r.balance,r.principal)+interestForLoan(r)))+`<td>매월 ${r.day}일<small>${escapeHTML(r.method)}</small></td>`;
 if(kind==='retirement')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.amount))+`<td>${r.asOf.replaceAll('-','.')}</td>`;
 if(kind==='deposits')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.balance))+num(`${r.rate}%`)+`<td>${r.maturity?r.maturity.replaceAll('-','.'): '만기 없음'}</td>`;
 if(kind==='fixed')cells=name+num(money(r.amount))+`<td>매월 ${r.day}일</td><td>${r.startMonth}<small>${r.endMonth?r.endMonth+'까지':'종료월 없음'}</small></td><td><span class="status-pill">${r.paymentSource==='card'?'카드 청구액에 포함':'계좌 결제'}</span></td>`;
 if(kind==='cashflow')cells=name+`<td><span class="status-pill ${r.type!=='expense'?'paid':''}">${FLOW_LABELS[r.type]}</span></td>`+num(`${r.type==='expense'?'−':'+'} ${money(r.amount)}`,r.type!=='expense'?'income-color':'')+`<td>${(r.occursOn||r.date).replaceAll('-','.')}<small>${r.repeat==='monthly'?'시작 '+r.date.replaceAll('-','.'):'해당 날짜 1회'}</small></td><td>${r.repeat==='monthly'?'매월 반복':'1회'}${r.includeInForecast===false?'<small>예상 계산 제외</small>':''}</td>`;
 if(kind==='cards'){const overdue=!r.paid&&r.dueDate<todayKST();cells=name+num(money(r.amount))+`<td>${r.dueDate.replaceAll('-','.')}</td><td><button class="status-pill ${r.paid?'paid':overdue?'overdue':''}" style="border:0" data-action="toggle-paid" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} ${r.paid?'미결제로 변경':'결제 완료로 변경'}">${r.paid?'✓ 결제 완료':overdue?'일자 경과 · 미결제':'결제 예정'} ↻</button></td>`;}
 return `<tr>${cells}<td><div class="row-actions"><button data-action="edit" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 수정">${svg('edit')}</button><button data-action="delete" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 삭제">${svg('delete')}</button></div></td></tr>`;
}

function syncLoanInterest(){
 const mode=$('field-interestMode'),input=$('field-interest');if(editorKind!=='loans'||!mode||!input)return;
 input.readOnly=mode.value==='estimate';input.title=input.readOnly?'잔액 × 연 이율 ÷ 12로 계산한 추정 금액입니다.':'금융기관의 납부예정액을 입력하세요.';
 if(input.readOnly){const balance=Number(($('field-balance').value||'0').replaceAll(',','')),rate=Number($('field-rate').value||0);if(Number.isFinite(balance)&&Number.isFinite(rate)&&balance>=0&&rate>=0&&rate<=100)input.value=wonFormat.format(estimatedMonthlyInterest(balance,rate));}
}
function loanInterestPanel(){
 const active=portfolio.loans.filter(r=>r.balance>0);if(!active.length)return '';
 const rows=loanSchedule(portfolio),total=rows.reduce((n,r)=>n+r.interest,0);
 return `<section class="table-panel loan-interest-panel"><div class="table-heading"><div><h2>월별 예상 이자 <span>이번 달부터 12개월</span></h2><p class="table-hint">현재 잔액과 등록한 원금·이자 조건 기준</p></div><strong class="interest-year-total">12개월 합계 ${money(total)}</strong></div><div class="table-scroll"><table><thead><tr><th>예상 월</th>${active.map(r=>`<th class="numeric">${escapeHTML(r.name)}<small>이자</small></th>`).join('')}<th class="numeric">이자 합계</th><th class="numeric">원금 + 이자</th></tr></thead><tbody>${rows.map(r=>{const details=new Map(r.details.map(d=>[d.id,d]));return `<tr><td>${r.month}</td>${active.map(l=>`<td class="numeric">${money(details.get(l.id).interest)}</td>`).join('')}<td class="numeric interest-total"><strong>${money(r.interest)}</strong></td><td class="numeric">${money(r.payment)}</td></tr>`;}).join('')}</tbody></table></div><p class="loan-schedule-note">자동 추정은 월별 상환 후 잔액과 연 이율로 다음 달 이자를 다시 계산합니다. 원리금균등은 현재 원금+이자 납입액을 유지하고, 원금균등은 등록 원금을 유지합니다. 직접 입력 이자는 입력액을 유지합니다. 잔액이 0이 되면 상환을 중단합니다. 첫 달은 오늘까지 납부했는지와 관계없이 등록한 월 납입액 전체이며, 실제 은행 청구액·상환 이력과 다를 수 있습니다.</p></section>`;
}

function filteredRecords(kind){return (kind==='cashflow'?cashflowForMonth(portfolio,month,true):kind==='fixed'?fixedForMonth(portfolio,month):portfolio[kind]).filter(r=>(r.name+' '+(r.institution||'')+' '+(r.note||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>kind==='cards'?a.dueDate.localeCompare(b.dueDate):0);}
function category(kind){
 const data=filteredRecords(kind);
 const notes={fixed:'매월 납부일이 없는 달은 말일로 표시합니다. 시작월·종료월은 해당 월을 포함합니다. 카드 청구액에 포함되는 항목은 고정지출 분석에만 포함하고 카드대금과 중복 합산하지 않습니다. 수입·지출에 같은 항목을 이미 등록했다면 중복 입력하지 마세요.',cashflow:'월급은 실수령액으로 입력해 주세요. 매월 반복은 시작일이 속한 달부터 같은 날짜에 반영하며, 해당 날짜가 없는 달에는 말일로 표시합니다. 기타 지출은 카드대금·대출상환액과 중복되지 않게 입력해 주세요. 수입·지출 기록은 예금 잔액이나 순자산을 자동으로 바꾸지 않습니다.',stocks:'증권사 계좌별 총액 또는 종목별 금액 중 한 가지 방식으로 등록해 주세요. 같은 자산을 중복 등록하면 합계도 중복됩니다. 해외 자산은 원화로 환산해 입력해 주세요.',loans:'자동 추정 이자는 잔액 × 연 이율 ÷ 12로 계산합니다. 실제 은행 청구액과 일수·금리 변경에 따라 다를 수 있습니다. 정확한 금액을 알면 직접 입력하세요. 월별 표는 현재 잔액 기준이며 실제 상환 이력이 아닙니다. 일정이 지나도 현재 대출잔액을 자동 차감하지 않습니다.',retirement:'퇴직금 예상액과 퇴직연금 계좌 평가액은 중복되지 않도록 입력해 주세요. 입력 금액은 세전·세후 여부에 따라 실제 수령액과 다를 수 있습니다.',deposits:'연 예상 이자는 현재 잔액과 연 이율을 사용한 세전 단순 추정치입니다. 실제 이자는 상품 조건과 입출금 내역에 따라 달라집니다.',cards:'결제예정액은 정확한 날짜별로 등록해 주세요. 상태를 눌러 결제 완료로 바꿀 수 있습니다. 완료된 카드대금은 부채에서 제외되며, 예금 잔액은 직접 수정해 주세요.'};
 return `${heading(navLabels[kind],descriptions[kind])}${demoBanner()}${['cashflow','fixed'].includes(kind)?`<div class="flow-month-bar"><span>조회할 월</span>${monthToolbar()}</div>${kind==='cashflow'?flowSummary(month,false):''}`:''}<div class="metric-strip ${kind==='loans'?'loan-metrics':''}">${categoryMetrics(kind)}</div><section class="table-panel"><div class="table-heading"><h2>${LABELS[kind]} 내역 <span>${['cashflow','fixed'].includes(kind)?data.length+'건 · 전체 등록 '+portfolio[kind].length+'건':portfolio[kind].length+'건'}</span></h2><input class="search-input" id="record-search" type="search" placeholder="이름 · 금융기관 검색" aria-label="내역 검색" value="${escapeHTML(query)}"></div>${portfolio[kind].length?`<div class="table-scroll"><table><thead><tr>${tableHeaders[kind].map((h,i)=>`<th class="${i>0&&/금액|평가액|손익|잔액|이율|원금|이자|상환액/.test(h)?'numeric':''}">${h}</th>`).join('')}</tr></thead><tbody id="records-body">${data.map(r=>rowHTML(kind,r)).join('')||`<tr><td colspan="${tableHeaders[kind].length}" class="empty-inline">${['cashflow','fixed'].includes(kind)&&!query?'이 달에 해당하는 내역이 없습니다.':'검색 결과가 없습니다.'}</td></tr>`}</tbody></table></div>`:`<div class="empty-state"><div class="empty-symbol">${svg(kind)}</div><h3>아직 등록된 ${LABELS[kind]} 내역이 없어요</h3><p>첫 내역을 추가하고<br>나의 자산을 차곡차곡 모아 보세요.</p><button class="button primary" data-action="add" data-kind="${kind}">${svg('plus')} ${LABELS[kind]} 추가하기</button></div>`}</section><p class="category-note">${notes[kind]}</p>${kind==='loans'?loanInterestPanel():''}`;
}
function calendar(){
 const [year,m]=month.split('-').map(Number),today=todayKST();
 const events=eventsForMonth(portfolio,month),flow=monthlyFlow(portfolio,month);
 const start=new Date(Date.UTC(year,m-1,1)).getUTCDay(),days=new Date(Date.UTC(year,m,0)).getUTCDate();
 const count=Math.ceil((start+days)/7)*7;
 const cells=Array.from({length:count},(_,i)=>{
  const day=i-start+1;if(day<1||day>days)return '<div class="calendar-cell muted"></div>';
  const date=`${month}-${String(day).padStart(2,'0')}`,daily=events.filter(e=>e.date===date);
  const income=daily.filter(e=>e.income).reduce((n,e)=>n+e.amount,0),expense=daily.filter(e=>!e.income&&!e.paid).reduce((n,e)=>n+e.amount,0);
  return `<div class="calendar-cell ${date===today?'today':''}"><span class="day-number">${day}</span>${income?`<span class="calendar-amount calendar-income">+${compact(income)}원</span>`:''}${expense?`<span class="calendar-amount">−${compact(expense)}원</span>`:''}${daily.length?`${!income&&!expense?'<span class="calendar-amount">결제 완료</span>':''}<span class="calendar-count">${daily.length}건</span>`:''}</div>`;
 }).join('');
 return `${heading('월별 입출금 일정','월급·기타 수입·지출과 대출·카드 결제일을 함께 확인하세요.',false)}${demoBanner()}<div class="calendar-layout"><section class="panel"><div class="panel-header"><h2>월별 일정</h2>${monthToolbar()}</div><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<span class="calendar-day-label">${d}</span>`).join('')}${cells}</div><div class="calendar-key"><span><i></i>지출</span><span class="income-color">+ 수입</span></div></section><section class="panel"><div class="panel-header"><h2>${m}월 입출금 내역</h2><span style="font-size:10px;color:#9eaa90">${events.length}건</span></div><div class="schedule-summary"><span>총지출 예정</span><strong>${money(flow.expense)}</strong><p class="cash-hint">총수입 ${money(flow.income)} · 남는 금액 ${money(flow.balance)}</p></div><div class="calendar-list">${events.length?events.map(paymentRow).join(''):'<div class="empty-inline">이번 달 등록된 일정이 없어요.</div>'}</div><p class="panel-note">입력한 수입·지출 예정액 기준입니다. 대출 상환은 월 원금·이자의 반복 표시이며, 실제 입출금 여부와 잔액은 직접 확인해 주세요.</p></section></div>`;
}

function render(){renderNav();$('main').innerHTML=view==='overview'?overview():view==='schedule'?calendar():view==='budget'?budgetPage():view==='history'?historyPage():view==='forecast'?forecastPage():view==='payday'?paydayPage():view==='planned'?scheduledPage():category(view);}
const fields={
 fixed:[['name','고정지출명','text',true,'예: 월세 / 보험료 / 통신비'],['amount','매월 금액','money',true,'0'],['day','매월 납부일','day',true,'예: 25'],['paymentSource','결제 방식','paymentSource',true,''],['startMonth','시작월','month',true,''],['endMonth','종료월','month',false,''],['note','메모','textarea',false,'선택 입력']],
 cashflow:[['type','구분','flowType',true,''],['name','항목명','text',true,'예: 회사 월급 / 부업 / 월세'],['amount','금액','money',true,'0'],['date','일자 · 반복 시작일','date',true,''],['repeat','반복 여부','repeat',true,''],['includeInForecast','예상 계산 반영','forecastFlag',true,''],['note','메모','textarea',false,'선택 입력']],
 stocks:[['name','계좌 · 종목명','text',true,'예: 국내주식 계좌 / 삼성전자'],['institution','증권사','text',false,'예: 미래에셋증권'],['cost','총매입금액','money',true,'0'],['valuation','총평가액','money',true,'0'],['note','메모','textarea',false,'선택 입력']],
 loans:[['name','대출명','text',true,'예: 주택담보대출'],['institution','금융기관','text',false,'예: 신한은행'],['balance','대출 잔액','money',true,'0'],['rate','적용 연 이율','rate',true,'예: 4.2'],['principal','매월 상환 원금','money',true,'0'],['interestMode','이자 계산 방식','interestMode',true,''],['interest','매월 납부 이자','money',true,'0'],['day','매월 상환일','day',true,'예: 25'],['method','상환 방식','select',true,''],['note','메모','textarea',false,'선택 입력']],
 retirement:[['name','퇴직금 · 연금명','text',true,'예: 퇴직연금 DC / 예상 퇴직금'],['institution','금융기관 · 회사','text',false,'예: 삼성생명'],['amount','금액','money',true,'0'],['asOf','금액 기준일','date',true,''],['note','메모','textarea',false,'세전/세후 여부 등을 기록하세요']],
 deposits:[['name','예금명','text',true,'예: 생활비 통장 / 정기예금'],['institution','금융기관','text',false,'예: 토스뱅크'],['balance','현재 잔액','money',true,'0'],['rate','연 이율','rate',true,'0'],['maturity','만기일','date',false,''],['note','메모','textarea',false,'선택 입력']],
 cards:[['name','카드사 · 카드명','text',true,'예: 현대카드 M'],['amount','결제예정액','money',true,'0'],['dueDate','결제일','date',true,''],['paid','결제 상태','paid',false,''],['note','메모','textarea',false,'선택 입력']]
};
function openEditor(kind,id){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 if(!KINDS.includes(kind)){showAddMenu();return;}
 editorKind=kind;editingId=id||null;
 const row=id?portfolio[kind].find(r=>r.id===id):{};
 if(!row)return;
 $('editor-title').textContent=`${LABELS[kind]} ${id?'수정':'추가'}`;$('form-error').textContent='';
 $('form-fields').innerHTML=fields[kind].map(([key,label,type,required,placeholder])=>{
  let value=row[key]??(key==='includeInForecast'?true:key==='startMonth'?month:key==='paymentSource'?'account':key==='interestMode'?(id?'manual':'estimate'):key==='repeat'?'monthly':(type==='date'&&required)?(kind==='cashflow'&&month!==todayKST().slice(0,7)?month+'-01':todayKST()):['money','rate'].includes(type)?0:'');
  let input;
  if(type==='forecastFlag')input=`<select id="field-${key}" name="${key}"><option value="true" ${value!==false?'selected':''}>예상에 반영</option><option value="false" ${value===false?'selected':''}>예상에서 제외</option></select>`;
  else if(type==='paymentSource'||type==='interestMode'){const options=type==='paymentSource'?[['account','계좌 결제 · 지출에 추가'],['card','카드 청구액에 포함 · 중복 제외']]:[['estimate','잔액·연 이율로 자동 추정'],['manual','은행 납부예정액 직접 입력']];input=`<select id="field-${key}" name="${key}" required>${options.map(([v,label])=>`<option value="${v}" ${value===v?'selected':''}>${label}</option>`).join('')}</select>`;}
  else if(type==='flowType'||type==='repeat'){const options=type==='flowType'?Object.entries(FLOW_LABELS):[['once','해당 날짜 1회'],['monthly','매월 반복']];input=`<select id="field-${key}" name="${key}" required>${options.map(([v,label])=>`<option value="${v}" ${value===v?'selected':''}>${label}</option>`).join('')}</select>`;}
  else if(type==='select')input=`<select id="field-${key}" name="${key}" required>${['원리금균등','원금균등','만기일시','기타'].map(v=>`<option ${value===v?'selected':''}>${v}</option>`).join('')}</select>`;
  else if(type==='paid')input=`<select id="field-${key}" name="${key}"><option value="false">결제 예정</option><option value="true" ${value===true?'selected':''}>결제 완료</option></select>`;
  else if(type==='textarea')input=`<textarea id="field-${key}" name="${key}" maxlength="500" placeholder="${placeholder}" rows="2">${escapeHTML(value)}</textarea>`;
  else input=`<div class="input-wrap"><input id="field-${key}" name="${key}" type="${type==='money'?'text':type==='rate'||type==='day'?'number':type}" ${required?'required':''} ${type==='money'?'inputmode="numeric" maxlength="21"':type==='rate'?'min="0" max="100" step="0.001"':type==='day'?'min="1" max="31" step="1"':type==='text'?'maxlength="100"':''} value="${escapeHTML(type==='money'?wonFormat.format(value):value)}" placeholder="${placeholder}">${type==='money'?'<span>원</span>':type==='rate'?'<span>%</span>':type==='day'?'<span>일</span>':''}</div>`;
  return `<div class="field ${type==='textarea'?'full-width':''}"><label for="field-${key}">${label} ${required?'<span>*</span>':'<small>선택</small>'}</label>${input}</div>`;
 }).join('')+`<p class="form-notice full-width">${demo?'예시 모드입니다. 변경 내용은 실제 자산에 저장되지 않습니다.':kind==='cashflow'?'월급은 실수령액을 입력해 주세요. 반복은 시작 월부터 적용됩니다. 기타 지출은 카드·대출과 중복 등록하지 마세요.':kind==='loans'?'자동 추정은 잔액 × 연 이율 ÷ 12입니다. 은행 청구액과 차이가 있으면 직접 입력을 선택하세요.':kind==='fixed'?'카드대금에 포함된 고정지출은 카드 청구액에 포함을 선택해 주세요. 같은 금액을 기타 지출에 다시 입력하지 마세요.':'입력한 내역은 본인 계정에 저장됩니다. 금액은 원화 기준으로 입력해 주세요.'}</p>`;
 syncLoanInterest();
 $('record-form').onsubmit=submitRecord;
 $('record-form').querySelector('button[type="submit"]').textContent='저장하기 ↗';
 openDialog('editor');
}
function showAddMenu(){
 $('editor-title').textContent='무엇을 모아볼까요?';$('form-error').textContent='';
 $('form-fields').innerHTML=`<div class="add-menu full-width">${KINDS.map(k=>`<button type="button" class="button secondary" data-action="choose-kind" data-kind="${k}">${svg(k)}${navLabels[k]}<span>↗</span></button>`).join('')}</div>`;
 $('record-form').onsubmit=e=>e.preventDefault();$('record-form').querySelector('button[type="submit"]').hidden=true;openDialog('editor');
}
async function submitRecord(e){
 e.preventDefault();if(saving)return;
 const values=new FormData(e.target),record={id:editingId||crypto.randomUUID()};
 for(const [key,,type]of fields[editorKind]){const v=values.get(key);record[key]=type==='money'?Number(String(v).replaceAll(',','')):type==='rate'||type==='day'?Number(v):(type==='paid'||type==='forecastFlag')?v==='true':String(v||'').trim();}
 const next=structuredClone(portfolio);const i=next[editorKind].findIndex(r=>r.id===editingId);if(i>=0)next[editorKind][i]=record;else next[editorKind].push(record);
 const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;$('form-error').textContent='';
 try{await persist(next);$('editor').close();toast(demo?'예시 내역을 변경했어요.':'내역을 저장했어요.');}catch(error){$('form-error').textContent=error.message;}finally{submit.disabled=false;}
}
function startDemo(){
 if(!demo){realData=portfolio;realRevision=revision;demo=true;portfolio=samplePortfolio();}
 loading=false;view='overview';location.hash='overview';$('settings-dialog').close();status('예시 보기 중');render();
}
async function exitDemo(){demo=false;portfolio=realData||emptyPortfolio();revision=realRevision;realData=null;await loadData();}
document.addEventListener('click',async e=>{
 const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
 const button=e.target.closest('[data-action]');if(!button)return;
 const {action,kind,id}=button.dataset;
 if(action==='add-planned'||action==='edit-planned')openScheduledEditor(id,button.dataset.type||'other_income');
 if(action==='toggle-planned'){const next=structuredClone(portfolio),item=next.cashflow.find(row=>row.id===id);if(item){item.includeInForecast=item.includeInForecast===false;try{await persist(next);toast(item.includeInForecast?'예상 계산에 포함했어요.':'예상 계산에서 제외했어요.');}catch(error){toast(error.message);}}}
 if(action==='budget-form'||action==='snapshot-form')openPlanningEditor(action==='budget-form'?'budget':'snapshot',button.dataset.month||month);
 if(action==='add-salary'){if($('editor').open)$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;month=todayKST().slice(0,7);openEditor('cashflow');$('field-type').value='salary';}
 if(action==='reset-payday-filter'){paydaySalaryId='all';paydaySelectedDate='';render();}
 if(action==='select-payday'){paydaySelectedDate=button.dataset.date;render();}
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
document.addEventListener('change',e=>{if(e.target.id==='scheduled-range'){scheduledRange=e.target.value;render();}if(e.target.id==='scheduled-type'){scheduledType=e.target.value;render();}if(e.target.id==='field-interestMode')syncLoanInterest();if(e.target.id==='payday-salary-filter'){paydaySalaryId=e.target.value;paydaySelectedDate='';render();}if(e.target.id==='payday-date-filter'){paydaySelectedDate=e.target.value;render();}});
document.addEventListener('input',e=>{
 if(['field-balance','field-rate'].includes(e.target.id))syncLoanInterest();
 if(e.target.id==='record-search'){query=e.target.value;const rows=filteredRecords(view);if(!$('records-body'))return;$('records-body').innerHTML=rows.map(r=>rowHTML(view,r)).join('')||`<tr><td colspan="${tableHeaders[view].length}" class="empty-inline">검색 결과가 없습니다.</td></tr>`;}
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
  const data=validatePortfolio(JSON.parse(await file.text()));const count=KINDS.reduce((n,k)=>n+data[k].length,0)+data.budgets.length+data.snapshots.length;
  $('settings-dialog').close();if(await confirmAction('백업 내역으로 교체할까요?',`현재 내역을 지우고 백업 파일의 ${count}건으로 교체합니다. 기존 내역이 필요하면 취소 후 먼저 내보내 주세요.`,'교체하기')){await persist(data);toast(`${count}건의 내역을 복원했어요.`);}
 }catch(error){toast(error instanceof SyntaxError?'올바른 JSON 백업 파일을 선택해 주세요.':error.message);}
};
function setView(){const hash=location.hash.slice(1);view=navLabels[hash]?hash:'overview';query='';if(!loading)render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',setView);setView();renderNav();loadData();

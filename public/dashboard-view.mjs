import {totals,budgetPlan,paydayForecasts,forecastMonths,eventsForMonth,todayKST,shiftMonth,snapshotTotals,paymentDate} from './domain.mjs';
import {renderAmountBars,renderAssetDonut,renderBudgetRing,renderSparkline,snapshotSeries} from './financial-charts.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]||0),0);
export function dashboardData(data,today=todayKST()){
 const month=today.slice(0,7),t=totals(data),budget=budgetPlan(data,month);
 const end=new Date(Date.parse(today+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
 const months=[month];while(months.at(-1)<end.slice(0,7))months.push(shiftMonth(months.at(-1),1));
 const events=months.flatMap(item=>eventsForMonth(data,item)).filter(row=>!row.paid&&row.date>=today&&row.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 return {t,budget,events,overdue:data.cards.filter(row=>!row.paid&&row.dueDate<today),month,today,nextPayday:paydayForecasts(data,today,1)[0],monthEnd:forecastMonths(data,today,1)[0],previous:data.snapshots.filter(row=>row.asOf<today).sort((a,b)=>a.asOf.localeCompare(b.asOf)).at(-1)};
}
function upcomingAgenda({events,overdue,today},money,svg) {
 const destinations={cashflow:'cashflow',fixed:'fixed',loans:'loans',cards:'cards'};
 const types={fixed:'정기 지출',loans:'대출 원금·이자',cards:'카드 청구'};
 return `<aside class="overview-agenda" aria-labelledby="overview-agenda-title">
   <div class="overview-section-head"><div><h2 id="overview-agenda-title">다가오는 입출금</h2><p>오늘부터 30일</p></div><a class="overview-link" href="#schedule">달력 보기</a></div>
   ${overdue.length?`<a class="overview-overdue" href="#cards">${svg('info')}<span>결제일 지난 카드 ${overdue.length}건<strong>${money(sum(overdue,'amount'))}</strong></span></a>`:''}
   <div class="overview-agenda-list">${events.length?events.slice(0,6).map(row=>`
     <a class="overview-event" href="#${destinations[row.type]}">
       <time datetime="${row.date}">${row.date===today?'오늘':row.date.slice(5).replace('-','.')}</time>
       <span class="overview-event-label"><strong>${esc(row.name)}</strong><small>${types[row.type]||(row.income?'수입':'지출')}</small></span>
       <b class="${row.income?'income-color':''}">${row.income?'+':'−'} ${money(row.amount)}</b>
     </a>`).join(''):'<p class="overview-empty">등록된 일정이 없습니다.</p>'}</div>
   <a class="overview-link overview-agenda-footer" href="#planned">예정 거래 관리 <span aria-hidden="true">→</span></a>
 </aside>`;
}

export function renderDashboard(data,{money,compact=money,svg,horizon=6,demoBanner='',today=todayKST(),selection='all',detail='',hideAmounts=false}){
 const summary=dashboardData(data,today);
 const {t,budget,month,nextPayday,monthEnd,previous}=summary;
 const delta=previous?t.net-snapshotTotals(previous).net:null;
 const hasAssets=data.deposits.length+data.stocks.length+data.retirement.length+data.loans.length+data.cards.length>0;
 const categories=[['deposits','예금·현금',t.deposits,'계좌 잔액'],['stocks','주식·투자',t.stock,'현재 평가액'],['retirement','퇴직금·연금',t.retirement,'장기 보유 자산']];
 const metric=(label,value,description,key)=>`<button type="button" class="home-stat ${selection===key?'is-selected':''}" data-action="home-detail" data-detail="${key}" aria-pressed="${selection===key}" aria-controls="home-dashboard">
   <span>${label}<span data-home-indicator aria-hidden="true">${selection===key?'✓':'↗'}</span></span>
   <strong data-motion-value data-motion-value-key="home:${key}">${money(value)}</strong><small>${description}</small>
 </button>`;
 const chartPoints=hasAssets&&!hideAmounts&&!detail?forecastMonths(data,today,horizon).map(row=>({
  label:row.month.slice(2).replace('-','.'),detailLabel:row.date+' · 월말 예상 순자산',value:row.net
 })):[];
 const chart=chartPoints.length?renderAmountBars(chartPoints,{formatMoney:money,formatCompact:compact,title:'월말 순자산 전망',minWidth:540,height:186,showHint:false}):
  hideAmounts?'<div class="chart-empty">금액 표시를 켜면 전망을 볼 수 있습니다.</div>':'<div class="chart-empty">잔액을 등록하면 월말 전망이 표시됩니다.</div>';
 const selectedLabels={net:'순자산',deposits:'예금·현금',debt:'남은 부채',cashflow:'수입·지출',stocks:'주식·투자',retirement:'퇴직금·연금',cards:'카드 청구'};
 return `<div class="page-heading overview-heading"><div class="overview-title"><span class="overview-home-icon" aria-hidden="true">${svg('overview')}</span><div><h1>자산 한눈에</h1><p class="subtitle">${today.replaceAll('-','.')} 기준</p></div></div><div class="heading-actions"><button class="button primary" data-action="add">${svg('plus')}내역 추가</button></div></div>${demoBanner}
 ${hasAssets?'':`<section class="getting-started overview-start"><div><h2>현재 잔액부터 등록해 주세요</h2></div><div><button class="button secondary" data-action="add" data-kind="deposits">예금 등록</button><button class="button secondary" data-action="demo">예시 보기</button></div></section>`}
 <div class="overview-workspace">
  <div class="overview-main">
   <div class="home-stats" aria-label="현재 자산과 이달의 수입·지출">
    ${metric('순자산',t.net,delta===null?'총자산 − 부채':`${previous.asOf.slice(5).replace('-','.')} 대비 ${delta>0?'+':''}${money(delta)}`,'net')}
    ${metric('예금·현금',t.deposits,'현재 계좌 잔액','deposits')}
    ${metric('남은 부채',t.debt,'대출 + 미결제 카드','debt')}
    ${metric('이달 수입 − 지출',budget.balance,budget.actualApplied?'가계부 반영':'등록 일정 기준','cashflow')}
   </div>
   <section id="home-dashboard" class="home-dashboard" aria-label="자산 상세">
   ${detail?`<div class="home-detail-toolbar"><span role="status">${selectedLabels[selection]} 상세</span><button type="button" class="button secondary" data-action="home-detail" data-detail="all" aria-controls="home-dashboard">전체 보기</button></div>${detail}`: `
    <section class="overview-forecast">
     <div class="overview-section-head">
      <div><h2>월말 순자산 전망</h2><p>현재 잔액과 등록한 입출금 일정 기준</p></div>
      <div class="overview-chart-actions">
       <div class="segmented" aria-label="전망 기간">${[6,12].map(count=>`<button type="button" aria-pressed="${horizon===count}" class="${horizon===count?'active':''}" data-action="chart-range" data-range="${count}">${count===6?'6개월':'1년'}</button>`).join('')}</div>
       <a class="overview-link" href="#forecast">월별 전망</a>
      </div>
     </div>${chart}
    </section>
    <section class="overview-quick" aria-labelledby="overview-quick-title">
     <div class="overview-section-head"><h2 id="overview-quick-title">잔액 전망과 가계부</h2></div>
     <div class="overview-quick-grid">
      <a href="#payday"><span>${nextPayday?nextPayday.date.slice(5).replace('-','.')+' 급여일 예금':'다음 급여일 예금'}</span><strong>${nextPayday?money(nextPayday.deposits):'급여 등록하기'}</strong></a>
      <a href="#forecast"><span>${Number(month.slice(5))}월 말 예금</span><strong class="${monthEnd.cashShortage?'text-danger':''}">${money(monthEnd.deposits)}</strong></a>
      <a href="#spending"><span>${Number(month.slice(5))}월 가계부</span><strong>${budget.actualApplied?'생활비 반영 중':'가계부 열기'}</strong></a>
     </div>
    </section>
    <div class="home-secondary-grid overview-support">
     <section class="panel home-budget">
      <div class="overview-section-head"><h2>${Number(month.slice(5))}월 예산</h2><button type="button" class="overview-link" data-action="budget-form" data-month="${month}">${budget.limit===null?'예산 설정':'예산 수정'}</button></div>
      <div class="budget-main-row">
       <div class="budget-main"><span>${budget.limit===null?(budget.actualApplied?'집계 지출':'지출 계획 합계'):'남은 예산'}</span><strong data-motion-value data-motion-value-key="home:budget:${month}" class="${budget.remaining<0?'text-danger':''}">${money(budget.limit===null?budget.expense:budget.remaining)}</strong></div>
       ${hideAmounts?'':renderBudgetRing({...budget,month},{money})}
      </div>
      <dl class="compact-ledger"><div><dt>월 수입</dt><dd>${money(budget.income)}</dd></div><div><dt>${budget.actualApplied?'반영한 실제 생활비':'계좌 결제 정기 지출'}</dt><dd>${money(budget.actualApplied?budget.livingExpense:budget.fixedCash)}</dd></div><div><dt>대출 월 이자</dt><dd>${money(t.monthlyInterest)}</dd></div></dl>
     </section>
     <section class="panel overview-allocation">
      <div class="overview-section-head"><h2>보유 자산 구성</h2><a href="#assets" class="overview-link">전체 자산</a></div>
      <div class="asset-total"><span>총자산</span><strong>${money(t.gross)}</strong></div>
      <div class="asset-visual">${hideAmounts?'':renderAssetDonut(categories,{money,hideAmounts})}<div class="asset-breakdown">${categories.map(([key,label,value])=>`
       <button type="button" data-action="home-detail" data-detail="${key}" aria-controls="home-dashboard"><i class="allocation-${key}"></i><span><strong>${label}</strong></span>
       <span class="asset-breakdown-value"><strong>${money(value)}</strong>${hideAmounts?'':renderSparkline(snapshotSeries(data,key,today),label)}</span></button>`).join('')}</div></div>
     </section>
    </div>`}
   </section>
  </div>
  ${upcomingAgenda(summary,money,svg)}
 </div>`;
}
export function renderAssets(data,{money,svg,demoBanner=''}){
 const t=totals(data),categories=[['deposits','예금·현금',t.deposits,'생활비 통장부터 정기예금까지',data.deposits],['stocks','주식·투자',t.stock,'계좌·종목별 현재 평가액',data.stocks],['retirement','퇴직금·연금',t.retirement,'퇴직금과 퇴직연금 계좌',data.retirement]];
 return `<div class="page-heading"><div><h1>전체 자산</h1><p class="subtitle">계좌·투자·퇴직금의 현재 잔액</p></div><button class="button primary" data-action="add">${svg('plus')} 자산 추가</button></div>${demoBanner}<div class="planning-metrics asset-hub-metrics"><div class="metric-box"><span class="label">총자산</span><strong>${money(t.gross)}</strong></div><div class="metric-box"><span class="label">부채</span><strong>${money(t.debt)}</strong></div><div class="metric-box"><span class="label">순자산</span><strong>${money(t.net)}</strong></div></div><section class="asset-groups">${categories.map(([key,label,value,description,rows])=>`<article class="panel asset-group"><div class="asset-group-title">${svg(key)}<h2>${label}</h2><span>${rows.length}건</span></div><strong class="asset-group-total">${money(value)}</strong><p>${description}</p><div class="asset-account-preview">${rows.slice(0,3).map(row=>`<div><span>${esc(row.name)}</span><b>${money(row.balance??row.valuation??row.amount)}</b></div>`).join('')||'<span>등록된 내역이 없습니다.</span>'}${rows.length>3?`<small>외 ${rows.length-3}건</small>`:''}</div><a href="#${key}" class="button secondary">${label} 관리 →</a></article>`).join('')}</section><div class="section-footnote">예금·현금에는 만기가 있는 예금도 포함됩니다. 퇴직금·연금은 장기 자산으로 구분하며, 실제 사용 가능한 현금과 다를 수 있습니다.</div>`;
}

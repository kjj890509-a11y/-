import {renderExpenseConfirmationSummary} from './dashboard-view.mjs';
import {contextTip} from './context-tips.mjs';
import {KINDS,LABELS,FLOW_LABELS,todayKST,totals,monthlyFlow,eventsForMonth,cashflowForMonth,fixedForMonth,scheduledCashflows,loanSchedule,loanPlanSummary,loanNextPayment,nextRetirementContribution,budgetPlan,forecastMonths,paydayForecasts,snapshotTotals,shiftMonth,paymentDate,actualSpendingForMonth} from './domain.mjs';
import {ledgerEntries,ledgerQuery,defaultLedgerState,ledgerLabels} from './ledger-model.mjs';
import {entryPresets,entryGroups} from './entry-hub.mjs';
import {renderTrendChart} from './chart.mjs';
import {renderAssetConsultation} from './asset-consultation.mjs';
import {renderMonthPicker} from './month-picker.mjs';
import {renderFinanceIcon,renderFinanceRecordIcon} from './finance-icons.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brandMark='<img class="brand-mark" src="/donmoa-pig.png" width="32" height="32" alt="">';
const brandHeading=`<h1 class="m-brand-heading">${brandMark}돈모아</h1>`;
const titles={overview:'돈모아',assets:'내 자산',deposits:'예금·현금',stocks:'주식·투자',loans:'대출',retirement:'퇴직금·연금',cards:'내 카드',schedule:'입출금 달력',cashflow:'수입·지출',fixed:'정기 지출',planned:'예정 거래',records:'전체 내역',entry:'입력·수정',menu:'전체',budget:'월 예산',spending:'가계부',forecast:'월말 자산 전망',payday:'급여일 자산 전망',statistics:'기간별 분석',history:'자산 기록',workspace:'맞춤 대시보드',advisor:'AI 상담'};
const paths={flow:'<path d="M7 3v16m-4-4 4 4 4-4M17 21V5m-4 4 4-4 4 4"/>',assets:'<rect x="3" y="4" width="18" height="16" rx="5"/><path d="M8 9h2m4 0h2m-8 6h8"/>',menu:'<circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="20" cy="12" r="1.5"/>',back:'<path d="m15 4-8 8 8 8"/>',close:'<path d="m5 5 14 14M5 19 19 5"/>',eye:'<path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16"/>',gear:'<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',plus:'<path d="M12 4v16M4 12h16"/>',chevron:'<path d="m9 6 6 6-6 6"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 7a8 8 0 0 1 14-1m0 11a8 8 0 0 1-14 1"/>'};
paths.menu='<path d="M4 6h16M4 12h16M4 18h16"/>';
paths.forecast='<path d="M3 20h18M4 16l5-5 4 3 7-10m-5 0h5v5"/>';
paths.advisor='<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M8 10h8m-8 4h5"/>';
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.assets}</svg>`;
const route=(kind,id='')=>`#${kind}${id?'/'+encodeURIComponent(id):''}`;
const action=(name,label,attrs='',className='')=>`<button type="button" class="${className}" data-action="${name}" ${attrs}>${label}</button>`;
const link=(href,label,className='')=>`<a class="${className}" href="${href}">${label}</a>`;
const empty=(label,button='')=>`<div class="m-empty"><p>${esc(label)}</p>${button}</div>`;
const pair=(label,value,className='')=>`<div${className?` class="${className}"`:''}><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
const details=items=>`<dl class="m-facts">${items.map(item=>pair(...item)).join('')}</dl>`;
const note=(text,explain=false)=>`<p class="m-note" ${explain?'data-mobile-help':''}>${esc(text)}</p>`;
const add=(kind,label='추가하기',{compact=false,withIcon=false}={})=>action('add',`${compact||withIcon?icon('plus'):''}${compact?`<span class="sr-only">${esc(label)}</span>`:esc(label)}`,`data-kind="${esc(kind)}"`,compact?'m-icon':'m-add');
export function isMobileViewport(win,loc={}){const mode=new URLSearchParams(loc.search||'').get('display');return mode==='mobile'||mode!=='desktop'&&Boolean(win.matchMedia?.('(max-width: 760px)').matches);}
export function createMobileState(){return {search:'',category:'all',sort:'date:desc',flowType:'all',selectedDate:'',entryMode:'new',forecastDate:'',advisorMode:'assets',showAllHomeAssets:false};}
function header(title,{back='#overview',right='',large=false}={}){return `<header class="m-header ${large?'m-header-large':''}">${link(back,icon('back'),'m-icon')}<h1>${esc(title)}</h1>${right||'<span class="m-icon-spacer"></span>'}</header>`;}
function nav(view){
 const active=view==='overview'?'home':['forecast','payday'].includes(view)?'forecast':view==='advisor'?'advisor':['assets','deposits','stocks','retirement','loans','cards'].includes(view)?'assets':'menu';
 return `<nav class="m-tabbar" aria-label="모바일 주 메뉴">${[['home','overview','홈'],['assets','assets','자산'],['advisor','advisor','AI 상담'],['forecast','forecast','예측'],['menu','menu','전체']].map(([key,page,label])=>link(route(page),`${key==='home'?brandMark:icon(key)}<span>${label}</span>`,key===active?'is-active':'').replace('<a ',`<a ${key===active?'aria-current="page"':''} `)).join('')}</nav>`;
}
function monthControl(month,{pickerId='',max=''}={}){
 const label=pickerId?renderMonthPicker({id:pickerId,value:month,label:'조회 월',max,required:true}):`<strong>${Number(month.slice(0,4))}년 ${Number(month.slice(5))}월</strong>`;
 return `<div class="m-month${pickerId?' m-month-interactive':''}" aria-label="조회 월">
  ${action('prev-month','‹',`aria-label="이전 달" ${month==='1900-01'?'disabled':''}`)}
  ${label}
  ${action('next-month','›',`aria-label="다음 달" ${max&&month>=max?'disabled':''}`)}
  ${action('this-month','이번 달','','m-month-reset')}
 </div>`;
}
function row({name,sub='',amount='',href='',attrs='',date='',tone='',iconKey='',issuer='',meta='',picture=''}){
 const rowIcon=picture||(iconKey?renderFinanceIcon(iconKey,issuer):'');
 const content=`${rowIcon?`<span class="m-row-finance-icon" aria-hidden="true">${rowIcon}</span>`:''}${date?`<span class="m-row-date">${esc(date)}</span>`:''}<span class="m-row-label"><strong>${esc(name)}</strong>${sub?`<small>${esc(sub)}</small>`:''}${meta?`<small>${esc(meta)}</small>`:''}</span>${amount?`<b class="${tone}">${amount}</b>`:''}${icon('chevron')}`;return href?link(href,content,'m-row'):`<button type="button" class="m-row" ${attrs}>${content}</button>`;}
function eventRows(events,money){return events.map(r=>row({name:r.name,sub:r.type==='loans'?'대출 원금·이자':r.type==='cards'?r.paid?'결제 완료':'결제 예정':r.type==='fixed'?'정기 지출':FLOW_LABELS[r.flowType],amount:(r.income?'+ ':'− ')+money(r.amount),href:route(r.type,r.id),date:r.date.slice(5).replace('-','.'),tone:r.income?'m-income':''})).join('');}
function home(data,state,{money,demoBanner,advisorStatus='unknown',hidden=false}){
 const t=totals(data),today=todayKST(),month=today.slice(0,7),flow=budgetPlan(data,month),events=eventsForMonth(data,month).filter(e=>e.date>=today&&!e.paid),next=events[0];
 const upcoming=forecastMonths(data,today,1)[0],salary=paydayForecasts(data,today,1)[0],hasData=KINDS.some(k=>data[k].length),delta=upcoming.net-t.net;
 const item=(kind,name,amount,sub='',id='',picture=renderFinanceIcon(kind))=>{
  return `<article class="m-account-card m-home-asset-row m-${kind}${kind==='deposits'?' m-account-secondary':''}">${link(route(kind,id),`<span class="m-card-symbol" aria-hidden="true">${picture}</span><span class="m-card-copy"><strong>${money(amount)}</strong><span class="m-card-label"><span>${esc(name)}</span></span>${sub?`<small>${esc(sub)}</small>`:''}</span>`,'m-card-main')}${id?action('edit','수정',`data-kind="${kind}" data-id="${esc(id)}" aria-label="${esc(name)} 수정"`,'m-home-row-action'):link(route(kind),'보기','m-home-row-action')}</article>`;
 };
 const profit=hidden?money(t.profit):signedMoney(t.profit,money);
 const retirementMonthly=data.retirement.reduce((sum,row)=>sum+(nextRetirementContribution(row,today)?.amount||0),0);
 const unpaidCards=data.cards.filter(row=>!row.paid);
 const items=[
  ...data.deposits.map(r=>item('deposits',r.name,r.balance,r.institution,r.id,renderFinanceRecordIcon('deposits',r))),
  ...(data.stocks.length?[item('stocks','주식·투자 총평가액',t.stock,'평가손익 '+profit)]:[]),
  ...(data.retirement.length?[item('retirement','퇴직금·연금',t.retirement,'다음 납입 합계 '+money(retirementMonthly))]:[]),
  ...(data.loans.length?[item('loans','대출 잔액',t.loans,'월 이자 '+money(t.monthlyInterest),'',data.loans.length===1?renderFinanceRecordIcon('loans',data.loans[0]):undefined)]:[]),
  ...(data.cards.length||data.cardAccounts?.length?[item('cards','미결제 카드',t.cards,unpaidCards.length+'건 결제 예정','',unpaidCards.length===1?renderFinanceIcon('cards',issuerFor('cards',unpaidCards[0],data)):undefined)]:[])
 ];
 const visible=state.showAllHomeAssets?items:items.slice(0,5);
 const aiLabel=advisorStatus==='unconfigured'?'서비스 연결 필요':advisorStatus==='error'?'연결 상태 확인 필요':advisorStatus==='ready'?'내 자산과 예측을 바탕으로 질문하기':'연결 확인 중';
 const forecast=`<article class="m-account-card m-account-primary m-forecast-home" data-home-forecast>${link('#forecast',`<span class="m-card-symbol" aria-hidden="true">${renderFinanceIcon('forecast')}</span><span class="m-card-copy"><strong>${hasData?money(upcoming.net):'—'}</strong><span class="m-card-label"><span>미래 순자산</span><small>${Number(month.slice(5))}월 말</small></span><small>${hasData?hidden?'현재 대비 변동 숨김':`현재보다 ${delta>0?'+':''}${money(delta)}`:'자산과 수입·지출을 입력해 주세요'}</small></span>`,'m-card-main')}${link('#forecast','예측','m-home-row-action')}</article>`;
 return `<header class="m-home-header">${brandHeading}${action('mobile-privacy',icon('eye'),'aria-label="금액 표시 전환"','m-icon')}<a href="#advisor" class="m-home-banner m-ai-banner m-home-question"><span class="m-home-question-icon" aria-hidden="true">${renderFinanceIcon('advisor')}</span><span><strong>AI에게 내 자산 물어보기</strong><small>${esc(aiLabel)}</small></span></a></header>${demoBanner}<section class="m-home-intro"><div><h2>다음 월급날,<br>얼마가 남을까요?</h2>${link('#payday','급여일 예측 보기 ›','m-home-intro-cta')}</div><span class="m-home-intro-symbol" aria-hidden="true">${renderFinanceIcon('forecast')}</span></section><div class="m-account-stack">${forecast}${renderExpenseConfirmationSummary(data,{money,today})}<section class="m-home-asset-group" aria-labelledby="m-home-assets-title"><h2 id="m-home-assets-title">내 자산</h2><div class="m-home-asset-list">${visible.join('')||empty('등록된 자산이 없습니다.',add('deposits','예금·현금 등록'))}</div>${items.length>5?action('mobile-home-more',`${state.showAllHomeAssets?'접기':'자산 더보기'} <span aria-hidden="true">${state.showAllHomeAssets?'⌃':'⌄'}</span>`,`aria-expanded="${state.showAllHomeAssets}"`,'m-home-more'):link('#assets','전체 자산 보기 ›','m-home-more')}${link('#entry',icon('plus')+'<span>내역 추가·수정</span>','m-home-add')}</section></div><section class="m-home-bottom" aria-labelledby="m-home-summary-title"><h2 id="m-home-summary-title">자금 요약</h2>${row({name:'현재 순자산',amount:money(t.net),href:'#workspace'})}${row({name:'다음 급여일 순자산',sub:salary?salary.date:'월급과 급여일을 등록하세요',amount:salary?money(salary.net):'',href:'#payday'})}${row({name:'전체 예금·현금',amount:money(t.deposits),href:'#assets'})}<a href="#budget" class="m-home-flow"><span>이번 달 수입·지출</span><span class="m-banner-amounts"><span><small>수입</small><b>${money(flow.income)}</b></span><span><small>지출</small><b>${money(flow.expense)}</b></span></span></a>${next?row({name:next.name,sub:next.date+' · 다음 일정',amount:money(next.amount),href:'#schedule'}):row({name:'입출금 일정',sub:'등록된 일정을 확인하세요',href:'#schedule'})}${row({name:'가계부',sub:flow.actualApplied?'이 달 실제 생활비 반영 중':'월별 실제 생활비 기록',href:'#spending'})}${row({name:'월 예산',href:'#budget'})}</section>`;
}
const accountKinds=['deposits','stocks','loans','retirement'];
const accountSummaryLabels={
 deposits:'전체 예금 잔액',stocks:'총평가액',retirement:'현재 퇴직금·연금',loans:'대출 잔액 합계'
};
function signedMoney(value,money){
 return (value>0?'+':'')+money(value);
}
function issuerFor(kind,row,data){
 if(kind==='loans')return row.institution||row.name;
 if(kind==='cards')return data.cardAccounts?.find(card=>card.id===row.cardAccountId)?.name||row.name;
 return '';
}
function accountSummary(kind,entries,money,hidden){
 if(kind==='deposits'){
  const interest=Math.round(entries.reduce((sum,row)=>sum+row.balance*row.rate/100,0));
  return '연 예상 이자(세전) '+money(interest);
 }
 if(kind==='stocks'){
  const profit=entries.reduce((sum,row)=>sum+row.valuation-row.cost,0);
  return '평가손익 '+(hidden?money(profit):signedMoney(profit,money));
 }
 if(kind==='retirement')return '다음 납입 합계 '+money(entries.reduce((sum,row)=>sum+(nextRetirementContribution(row)?.amount||0),0));
 return '다음 납부 이자 합계 '+money(entries.reduce((sum,row)=>sum+loanNextPayment(row).interest,0));
}
function accountMeta(kind,record,money,hidden){
 if(kind==='deposits')return [record.maturity?'만기 '+record.maturity:'만기 없음',hidden?'연 ••%':'연 '+record.rate+'%'].join(' · ');
 if(kind==='stocks'){
  const profit=record.valuation-record.cost;
  return '평가손익 '+(hidden?money(profit):signedMoney(profit,money));
 }
 if(kind==='retirement'){
  const next=nextRetirementContribution(record);
  return [next?'다음 '+next.date+' · '+money(next.amount):record.asOf?'기준 '+record.asOf:'',record.contributionEndMonth?'마지막 '+record.contributionEndMonth:''].filter(Boolean).join(' · ');
 }
 if(record.balance===0)return '상환 완료';
 const next=loanNextPayment(record,todayKST());
 return (next.date?'다음 납부 '+next.date:'매월 '+record.day+'일')+' · 이자 '+money(next.interest);
}
function accounts(data,kind,{money,hidden}){
 const active=accountKinds.includes(kind)?kind:'deposits',entries=data[active];
 const sum=entries.reduce((total,record)=>total+(record.balance??record.valuation??record.amount??0),0);
 const tabs=accountKinds.map(key=>link(route(key),key==='retirement'?'퇴직·연금':titles[key],key===active?'is-active':'')
  .replace('<a ',key===active?'<a aria-current="page" ':'<a ')).join('');
 const summary=`<section class="m-account-summary" aria-label="${esc(accountSummaryLabels[active])}">
  ${renderFinanceIcon(active)}<div><span>${esc(accountSummaryLabels[active])}</span><strong>${money(sum)}</strong>
  ${entries.length?`<small>${esc(accountSummary(active,entries,money,hidden))}</small>`:''}</div></section>`;
 const list=entries.map(record=>row({
  name:record.name,sub:record.institution,meta:accountMeta(active,record,money,hidden),
  amount:money(record.balance??record.valuation??record.amount??0),href:route(active,record.id),
  picture:renderFinanceRecordIcon(active,record,issuerFor(active,record,data))
 })).join('');
 return `${header(kind==='assets'?'내 자산':titles[active],{right:action('mobile-privacy',icon('eye'),'aria-label="금액 표시 전환"','m-icon')})}
  <nav class="m-account-tabs" aria-label="자산 종류">${tabs}</nav>${summary}
  <div class="m-account-list" aria-label="${esc(titles[active])} 목록">
  ${list||empty('등록된 '+titles[active]+' 내역이 없습니다.')}</div>
  <button type="button" class="m-asset-fab" data-asset-manage="${active}" aria-haspopup="dialog"
   aria-label="${esc(titles[active])} 추가·수정">${icon('plus')}</button>
  ${active==='loans'?link('#advisor','AI 상담으로 상환 계획 비교하기 ›','m-under-link'):''}`;
}
function recordDetail(data,kind,id,{money,hidden}){
 const r=data[kind]?.find(r=>r.id===id);if(!r)return header(titles[kind]||'내역')+empty('삭제되었거나 찾을 수 없는 내역입니다.',link(route(kind),'목록으로','m-primary'));
 const amount=r.balance??r.valuation??r.amount??0,editAttrs=`data-kind="${kind}" data-id="${esc(id)}"`;
 const facts=[];
 if(r.institution)facts.push(['금융기관',esc(r.institution)]);
 if(kind==='deposits')facts.push(['연 이율',hidden?'••%':r.rate+'%'],['만기일',esc(r.maturity||'만기 없음')]);
 if(kind==='stocks')facts.push(['총매입금액',money(r.cost)],['평가손익',money(r.valuation-r.cost)]);
 if(kind==='retirement'){
  const next=nextRetirementContribution(r);
  facts.push(['금액 기준일',r.asOf],['기본 월 납입액',money(r.monthlyContribution||0)],['첫 납입 예정일',r.contributionDate||'미설정'],
   ['마지막 납입월',r.contributionEndMonth||'미설정'],['다음 납입',next?next.date+' · '+money(next.amount):'없음']);
  for(const change of r.contributionChanges||[])facts.push([change.month+'부터 월 납입',money(change.amount)]);
 }
 if(kind==='loans'){
  const next=loanNextPayment(r,todayKST()),plan=loanPlanSummary(r);
  facts.push(['연 이율',hidden?'••%':r.rate+'%'],['상환 방식',esc(r.method)],['다음 납부일',next.date||'매월 '+r.day+'일'],
   ['다음 상환 원금',money(next.principal)],['다음 납부 이자',money(next.interest)],['다음 상환액',money(next.payment)],
   ['매월 상환일',r.day+'일'],['남은 납부 횟수',r.calculationMode==='term'?r.remainingMonths+'회':'미설정']);
  if(plan.complete)facts.push(['남은 예상 이자',money(plan.interest)],['상환 완료 예상일',plan.payoffDate||'—']);
 }
 if(kind==='cards')facts.push(['청구 월',r.billingMonth||r.dueDate.slice(0,7)],['결제일',r.dueDate],['결제 상태',r.paid?'결제 완료':'결제 예정']);
 if(kind==='cashflow')facts.push(['구분',FLOW_LABELS[r.type]],['일자·시작일',r.date],['반복',r.repeat==='monthly'?'매월':'1회'],['예상 계산',r.includeInForecast===false?'제외':'반영'],['결제 방식',r.paymentSource==='card'?'카드 청구액에 포함 · 중복 제외':'계좌 결제']);
 if(kind==='fixed')facts.push(['매월 납부일',r.day+'일'],['시작월',r.startMonth],['종료월',r.endMonth||'없음'],['결제 방식',r.paymentSource==='card'?'카드 청구액에 포함 · 중복 제외':'계좌 결제']);
 if(r.note)facts.push(['메모',esc(r.note)]);
 const schedule=kind==='loans'?loanSchedule({loans:[r]},todayKST().slice(0,7),12,todayKST()).filter(row=>row.payment>0):[];
 return `${header(r.name,{back:route(kind),right:action('edit',icon('gear'),`${editAttrs} aria-label="내역 수정"`,'m-icon')})}<section class="m-balance-hero m-${kind}"><div class="m-balance-label">${renderFinanceRecordIcon(kind,r,issuerFor(kind,r,data))}<span>${esc(r.institution||titles[kind])}</span></div><strong class="m-balance">${money(amount)}</strong><div class="m-hero-actions">${action('edit','수정하기',editAttrs)}${kind==='cards'?action('toggle-paid',r.paid?'미결제로 변경':'결제 완료로 표시',`data-id="${esc(id)}"`):kind==='loans'?action('add-loan-payment','상환 기록'):add(kind,'추가하기')}</div></section><section class="m-detail-section"><h2>내역 정보</h2>${details(facts)}</section>${schedule.length?`<section class="m-detail-section"><h2>앞으로 12개월 상환</h2>${schedule.map(row=>`<details class="m-schedule-row"><summary><span>${row.month}</span><b>${money(row.payment)}</b><span aria-hidden="true">⌄</span></summary>${details([['원금',money(row.principal)],['이자',money(row.interest)],['상환 후 잔액',money(row.balance)]])}</details>`).join('')}${note('현재 잔액과 연 이율을 기준으로 계산합니다. 일수·금리 변경·수수료는 반영하지 않습니다.',true)}</section>`:''}${kind==='loans'&&r.calculationMode==='manual'?note('납부 횟수를 입력하면 상환 기간과 방식에 따라 원금·이자를 계산할 수 있습니다.'):''}${note('직접 입력한 자산 노트입니다. 내역을 수정해도 은행의 실제 계좌에서 거래가 발생하지 않습니다.',true)}<div class="m-detail-delete">${action('delete','내역 삭제',editAttrs)}</div>`;
}
function calendar(data,state,{money,month}){
 const events=eventsForMonth(data,month),date=state.selectedDate.startsWith(month)?state.selectedDate:todayKST().startsWith(month)?todayKST():month+'-01',start=new Date(month+'-01T00:00:00Z').getUTCDay(),days=Number(paymentDate(month,31).slice(8)),selected=events.filter(e=>e.date===date);
 return `${header('입출금 달력',{back:'#overview',right:link('#entry',icon('plus'),'m-icon')})}${renderExpenseConfirmationSummary(data,{money})}${monthControl(month)}<section class="m-calendar" aria-label="${month} 입출금 달력"><div class="m-week">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="m-days">${'<span></span>'.repeat(start)}${Array.from({length:days},(_,i)=>{const day=String(i+1).padStart(2,'0'),key=month+'-'+day,items=events.filter(e=>e.date===key);return action('mobile-day',`<span>${i+1}</span><i class="${items.some(e=>e.income)?'has-income':''} ${items.some(e=>!e.income)?'has-expense':''}" aria-hidden="true"></i>`,`data-date="${key}" aria-label="${Number(day)}일, 일정 ${items.length}건" aria-pressed="${date===key}" ${key===todayKST()?'aria-current="date"':''}`,date===key?'is-selected':'');}).join('')}</div></section><div class="m-count-strip"><span>${Number(date.slice(5,7))}월 ${Number(date.slice(8))}일 · ${selected.length}건</span>${action('calendar-add','＋ 일정 추가',`data-type="expense" data-date="${date}"`)}</div><section class="m-event-list">${eventRows(selected,money)||empty('이날 등록된 일정이 없습니다.')}</section><section class="m-detail-section"><h2>이번 달 일정</h2>${eventRows(events,money)||empty('등록된 일정이 없습니다.')}</section>${note('등록된 수입·지출 일정입니다. 실제 입출금 완료 여부는 계좌에서 확인해 주세요.',true)}`;
}
function recordFilters(state,{category=false}={}){return `<form class="m-filter-form" data-mobile-search role="search"><label class="m-search">${icon('search')}<input name="query" type="search" aria-label="내역 검색" placeholder="이름·금융기관·메모 검색" value="${esc(state.search)}"><button type="submit">검색</button></label></form><div class="m-list-filters">${category?`<label><span class="sr-only">카테고리</span><select data-mobile-filter="category"><option value="all">전체 종류</option>${KINDS.map(k=>`<option value="${k}" ${state.category===k?'selected':''}>${esc(ledgerLabels[k])}</option>`).join('')}</select></label>`:''}<label><span class="sr-only">정렬</span><select data-mobile-filter="sort">${[['date:desc','날짜 최신순'],['date:asc','날짜 오래된순'],['newest','등록 최신순'],['amount:desc','금액 높은순'],['amount:asc','금액 낮은순']].map(([v,l])=>`<option value="${v}" ${state.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>${state.search?action('mobile-clear-search','검색 지우기'):''}</div>`;}
function records(data,scope,state,{money,month},title=titles[scope]){
 const entries=ledgerQuery(ledgerEntries(data,scope==='records'?'all':scope,month),{...defaultLedgerState(),query:state.search,category:scope==='records'?state.category:'all',sort:state.sort}),selected=entries.slice(0,200);
 return `${header(title,{right:link('#entry',icon('plus'),'m-icon')})}${recordFilters(state,{category:scope==='records'})}<div class="m-count-strip"><span>${entries.length}건</span></div><div class="m-record-list">${selected.map(({row:r,kind,date,amount})=>row({name:r.name,sub:[ledgerLabels[kind],date,r.paymentSource==='card'?'카드 청구에 포함 · 중복 제외':''].filter(Boolean).join(' · '),amount:money(amount),href:route(kind,r.id)})).join('')||empty('조건에 맞는 내역이 없습니다.')}</div>${entries.length>200?note('검색과 카테고리 필터로 범위를 좁혀 주세요.'):''}`;
}
function flows(data,kind,state,{money,month}){
 const flow=monthlyFlow(data,month),items=kind==='fixed'?fixedForMonth(data,month):kind==='planned'?scheduledCashflows(data,todayKST(),'all'):cashflowForMonth(data,month,true);
 const filtered=items.filter(r=>state.flowType==='all'||(r.type==='salary'||r.type==='other_income'?'income':r.type==='expense'?'expense':r.paymentSource||'account')===state.flowType).filter(r=>!state.search||[r.name,r.note].join(' ').toLowerCase().includes(state.search.toLowerCase())).sort((a,b)=>state.sort==='amount:desc'?b.amount-a.amount:state.sort==='amount:asc'?a.amount-b.amount:state.sort==='newest'?items.indexOf(b)-items.indexOf(a):((a.occursOn||a.date||'').localeCompare(b.occursOn||b.date||''))*(state.sort==='date:asc'?1:-1));
 return `${header(titles[kind],{right:add(kind==='fixed'?'fixed':'cashflow',kind==='fixed'?'정기 지출 추가':'수입·지출 추가',{compact:true})})}${kind!=='planned'?monthControl(month):''}${kind==='cashflow'?`<section class="m-flow-summary" aria-label="이 달 수입·지출 집계"><div><span>수입 계획</span><strong>${money(flow.income)}</strong></div><div><span>${flow.actualApplied?'집계 지출':'지출 계획'}</span><strong>${money(flow.expense)}</strong></div></section>`:`<div class="m-count-strip"><span>${kind==='fixed'?'월 정기 지출':'예정 거래'}</span><strong>${money(items.reduce((n,r)=>n+r.amount,0))}</strong></div>`}${recordFilters(state)}<div class="m-inline-tabs" aria-label="내역 구분">${(kind==='fixed'?[['all','전체'],['account','계좌 결제'],['card','카드 포함']]:[['all','전체'],['income','수입'],['expense','지출']]).map(([v,l])=>action('mobile-flow-type',l,`data-type="${v}" aria-pressed="${state.flowType===v}"`,state.flowType===v?'is-active':'')).join('')}</div><div class="m-flow-list">${filtered.map(r=>row({name:r.name,sub:[r.occursOn||r.date,r.paymentSource==='card'?'카드 청구액에 포함 · 중복 제외':r.repeat==='monthly'?'매월 반복':kind==='fixed'?'매월 '+r.day+'일':FLOW_LABELS[r.type],r.includeInForecast===false?'예상 제외':''].filter(Boolean).join(' · '),amount:money(r.amount),href:route(kind==='fixed'?'fixed':'cashflow',r.id),tone:r.type&&r.type!=='expense'?'m-income':''})).join('')||empty('등록된 내역이 없습니다.')}</div>${note(kind==='fixed'?'카드 청구액에 포함된 지출은 예산·자산 전망에서 다시 차감하지 않습니다.':'예금 잔액은 자동 변경되지 않습니다. 카드 청구에 포함한 지출은 중복 차감하지 않습니다.',true)}`;
}
function cards(data,{money,month}){
 const bills=data.cards.filter(r=>(r.billingMonth||r.dueDate.slice(0,7))===month),profiles=(data.cardAccounts||[]).filter(r=>!r.archived),unlinked=bills.filter(r=>!r.cardAccountId||!profiles.some(p=>p.id===r.cardAccountId));
 return `${header('내 카드',{right:action('card-accounts',icon('gear'),'aria-label="카드 관리"','m-icon')})}${monthControl(month)}<div class="m-count-strip"><span>${month} 청구액</span><strong>${money(bills.reduce((n,r)=>n+r.amount,0))}</strong></div><div class="m-card-bills">${profiles.map(p=>{const rows=bills.filter(r=>r.cardAccountId===p.id);return `<section class="m-bill-card"><div class="m-bill-title"><span class="m-bank-dot">${renderFinanceIcon('cards',p.name)}</span><h2>${esc(p.name)}</h2>${action('card-account-edit','···',`data-id="${esc(p.id)}" aria-label="${esc(p.name)} 관리"`)}</div>${rows.length?rows.map(r=>row({name:money(r.amount),sub:r.dueDate+' · '+(r.paid?'결제 완료':'결제 예정'),href:route('cards',r.id)})).join(''):empty('이번 달 청구액을 입력하세요.')}${action('mobile-card-bill',rows.length?'청구 추가':'청구액 입력',`data-id="${esc(p.id)}"`,'m-bill-input')}</section>`;}).join('')}${unlinked.map(r=>`<section class="m-bill-card">${row({name:r.name,sub:r.dueDate+' · '+(r.paid?'결제 완료':'결제 예정'),amount:money(r.amount),href:route('cards',r.id),iconKey:'cards',issuer:issuerFor('cards',r,data)})}${action('card-account-from-bill','내 카드로 등록',`data-id="${esc(r.id)}"`,'m-bill-input')}</section>`).join('')}${!profiles.length&&!bills.length?empty('등록된 카드가 없습니다.'):''}${action('card-account-add',icon('plus')+' 카드 등록','','m-add')}</div>${note('청구 월과 실제 결제일은 다르게 입력할 수 있습니다. 결제 완료 표시는 예금 잔액을 자동 변경하지 않습니다.',true)}`;
}
function entry(data,state,options){return `${header('입력·수정')}<div class="m-inline-tabs">${[['new','새 내역'],['manage','기존 내역 수정']].map(([v,l])=>action('mobile-entry-mode',l,`data-mode="${v}" aria-pressed="${state.entryMode===v}"`,v===state.entryMode?'is-active':'')).join('')}</div>${state.entryMode==='manage'?records(data,'records',state,options,'저장된 내역').replace(/^<header[\s\S]*?<\/header>/,''):entryGroups.map(g=>`<section class="m-menu-group"><h2>${esc(g.label)}</h2>${entryPresets.filter(p=>p.group===g.id).map(p=>row({name:p.label,iconKey:p.kind,attrs:`data-action="entry-start" data-entry-type="${p.id}"`})).join('')}</section>`).join('')}`;}
const menuGroups=[['자산 관리',[['assets','내 자산'],['cards','카드 청구'],['loans','대출'],['advisor','AI 상담']]],['입출금',[['entry','입력·수정'],['records','전체 내역'],['cashflow','수입·지출'],['spending','가계부'],['fixed','정기 지출'],['planned','예정 거래'],['schedule','입출금 달력']]],['자금 계획',[['budget','월 예산'],['forecast','월말 자산 전망'],['payday','급여일 자산 전망']]],['분석·기록',[['statistics','기간별 분석'],['history','자산 기록'],['workspace','맞춤 대시보드']]]];
function menu(){return `<header class="m-menu-header">${brandHeading}${action('mobile-refresh',icon('refresh'),'aria-label="최신 내역 불러오기"','m-icon')}${action('mobile-settings',icon('gear'),'aria-label="설정"','m-icon')}</header>${menuGroups.map(([label,items])=>`<section class="m-menu-group"><h2>${label}</h2>${items.map(([key,title])=>row({name:title,href:route(key),iconKey:key})).join('')}</section>`).join('')}<section class="m-menu-group"><h2>설정</h2>${row({name:'금액 표시 전환',attrs:'data-action="mobile-privacy"'})}${row({name:'백업 및 데이터 관리',attrs:'data-action="mobile-settings"'})}</section><div class="m-menu-foot">돈모아 · 나의 자산관리</div>`;}
function projections(data,view,state,{money,compact,hidden}){
 const payday=view==='payday',today=todayKST(),rows=payday?paydayForecasts(data,today,12):forecastMonths(data,today,12),current=totals(data),selected=rows.find(r=>r.date===state.forecastDate)||rows[0];
 const tabs=`<div class="m-inline-tabs">${link('#forecast','월말',!payday?'is-active':'')}${link('#payday','급여일',payday?'is-active':'')}</div>`;
 if(!rows.length)return header(titles[view])+tabs+empty('월급과 급여일을 먼저 등록해 주세요.',action('add-salary','월급 등록','','m-primary'));
 const points=[{label:'현재',detailLabel:today+' · 현재',value:current.net,forecast:false},...rows.map(r=>({label:r.month.slice(5)+'월',detailLabel:r.date+' · 예상',value:r.net,forecast:true}))];
 const chart=hidden?note('금액 숨김을 해제하면 예측 그래프를 볼 수 있습니다.'):renderTrendChart(points,{formatMoney:money,formatCompact:compact||money,title:'미래 순자산',seriesLabel:'현재 → 등록 일정에 따른 예상'});
 const diff=selected.net-current.net;
 const dateChoices=`<div class="m-forecast-dates" aria-label="예측 날짜">${rows.map(r=>action('mobile-forecast-date',esc(payday?r.date.slice(5).replace('-','.') : Number(r.month.slice(5))+'월'),`data-date="${r.date}" aria-pressed="${r.date===selected.date}"`,r.date===selected.date?'is-active':'')).join('')}</div>`;
 return `${header('미래 순자산',{right:link('#advisor',icon('advisor'),'m-icon')})}${tabs}${dateChoices}<div class="m-forecast-overview"><section class="m-forecast-summary"><span>${esc(selected.date)}${payday?' 급여 입금 후':' 월말'} 예상 순자산</span><strong>${money(selected.net)}</strong><small>${hidden?'현재 대비 변동 숨김':`현재보다 ${diff>0?'+':''}${money(diff)}`}</small>${selected.cashShortage?'<p class="m-cash-warning">이 날짜에는 예상 예금이 부족합니다. 지출 일정을 확인해 주세요.</p>':''}</section><section class="m-forecast-chart">${chart}</section></div><section class="m-detail-section"><h2>예상 자산 구성${contextTip('예측 기준','현재 잔액을 기준으로 미확인 지출과 앞으로의 등록 일정을 계산합니다. 월급·추가 수입·지출·대출 원금과 이자·카드대금·회사 연금 납입을 반영합니다. 금리와 주식 평가액은 고정하며 미등록 지출·세금·수수료는 포함하지 않습니다. 예측은 실제 잔액을 자동 변경하지 않습니다.')}</h2>${details([['예금·현금',money(selected.deposits)],['주식·투자',money(current.stock)],['퇴직금·연금',money(selected.retirement)],['대출 잔액',money(selected.loans)],['미결제 카드',money(selected.cards)],...(payday?[['급여 입금',money(selected.salaryAmount)],['급여 전날 예금',money(selected.previousDayDeposits)]]:[])])}</section>${row({name:'이 예측에 대해 AI에게 질문',href:'#advisor'})}`;
}
function budget(data,{money,month}){const p=budgetPlan(data,month);return `${header('월 예산',{right:action('budget-form','수정',`data-month="${month}"`,'m-text')})}${monthControl(month)}<section class="m-budget-hero"><span>이번 달 남은 예산</span><strong>${p.remaining===null?'미설정':money(p.remaining)}</strong>${p.limit!==null?`<progress aria-label="예산 대비 지출 비율" max="${Math.max(1,p.limit)}" value="${Math.max(0,Math.min(p.expense,p.limit))}"></progress>`:action('budget-form','예산 설정',`data-month="${month}"`,'m-primary')}</section>${details([['지출 예산',p.limit===null?'미설정':money(p.limit)],[p.actualApplied?'집계 지출':'등록 지출 계획',money(p.expense)],['수입 계획',money(p.income)],['예상 남는 금액',money(p.balance)],['저축 목표',p.target===null?'미설정':money(p.target)]])}${row({name:'가계부',sub:p.actualApplied?'이 달 실제 생활비 반영 중':'월별 실제 생활비 기록',href:'#spending'})}`;}
function spending(data,{money,month}){
 const record=actualSpendingForMonth(data,month),plan=budgetPlan(data,month);
 const mode=(applied,label)=>action('spending-mode',label,`data-applied="${applied}" aria-pressed="${plan.actualApplied===applied}" ${record?'':'disabled'}`,plan.actualApplied===applied?'is-active':'');
 const status=!record?'생활비를 저장하면 반영 여부를 바꿀 수 있어요.':plan.actualApplied?'가계부 합계가 이 달의 생활비 계획을 대체해요.':'기존 생활비 계획으로 집계해요. 가계부 금액은 보관돼요.';
 const summary=[
  ['기존 생활비 계획',money(plan.fixedCash+plan.otherExpense)],
  ['집계에 쓴 생활비',money(plan.livingExpense),'m-spending-effective'],
  ['대출·카드 납부',money(plan.expense-plan.livingExpense)],
  ['이 달 지출 합계',money(plan.expense),'m-spending-total-row']
 ];
 return `${header('가계부',{right:action('mobile-privacy',icon('eye'),'aria-label="금액 표시 전환"','m-icon')})}
 ${monthControl(month,{pickerId:'spending-month',max:todayKST().slice(0,7)})}
 <section class="m-budget-hero m-spending-record" aria-labelledby="m-spending-label">
  <span id="m-spending-label">실제 생활비</span>
  <strong>${record?money(record.amount):'미입력'}</strong>
  ${action('spending-form',record?'금액 수정':'생활비 입력','','m-primary')}
 </section>
 <section class="m-detail-section m-spending-budget" aria-labelledby="m-spending-budget-label">
  <h2 id="m-spending-budget-label">월 예산 반영</h2>
  <div class="m-spending-apply">
   <div class="m-inline-tabs" role="group" aria-label="이 달 가계부 반영 여부">${mode(false,'미반영')}${mode(true,'반영')}</div>
   ${note(status,Boolean(record))}
  </div>
  ${details(summary)}
 </section>
 ${row({name:'월 예산 보기',href:'#budget'})}`;
}
function history(data,{money}){return `${header('자산 기록',{right:action('snapshot-form',icon('plus'),'aria-label="자산 기록 추가"','m-icon')})}<div class="m-history-list">${[...(data.snapshots||[])].sort((a,b)=>b.month.localeCompare(a.month)).map(r=>row({name:r.month,sub:r.asOf,amount:money(snapshotTotals(r).net),attrs:`data-action="snapshot-form" data-month="${r.month}"`})).join('')||empty('저장한 자산 기록이 없습니다.',action('snapshot-form','현재 자산 기록','','m-primary'))}</div>`;}
function overviewDetails(data,{money,month}){
 const t=totals(data),plan=budgetPlan(data,month);
 return `${header('맞춤 대시보드')}
  <section class="m-budget-hero"><span>순자산</span><strong>${money(t.net)}</strong></section>
  <dl class="m-facts">${pair('총자산',money(t.gross))}<div><dt>총부채${contextTip('총부채','남은 대출 원금과 미결제 카드 청구액의 합계입니다.')}</dt><dd>${money(t.debt)}</dd></div></dl>
  <div class="m-workspace-list">${[['deposits',t.deposits],['stocks',t.stock],['retirement',t.retirement],['loans',t.loans],['cards',t.cards]].map(([k,v])=>row({name:titles[k],amount:money(v),href:route(k)})).join('')}
   ${row({name:'월말 자산 전망',href:'#forecast'})}${row({name:'급여일 자산 전망',href:'#payday'})}
  </div>
  <section class="m-menu-group m-workspace-month" aria-labelledby="m-workspace-month-title">
   <h2 id="m-workspace-month-title">월 수입·지출</h2>
   ${monthControl(month,{pickerId:'workspace-month',max:'2199-12'})}
   ${details([['월 수입',money(plan.income)],['월 지출·상환',money(plan.expense)],['수입·지출 차액',money(plan.balance)]])}
   <details class="m-workspace-breakdown"><summary>수입·지출 구성</summary>
    ${details([
     ['월급',money(plan.salary)],['기타 수입',money(plan.otherIncome)],
     [plan.actualApplied?'실제 생활비':'생활비 계획',money(plan.livingExpense)],
     ['대출 상환 계획',money(plan.loanDue)],['카드 청구',money(plan.cardBills)]
    ])}
   </details>
   ${row({name:'월 예산 보기',href:'#budget'})}
  </section>`;
}
function statistics(data,options){const {money,month}=options,f=monthlyFlow(data,month),loans=loanSchedule(data,month,1)[0];return `${header('기간별 분석')}${monthControl(month)}<section class="m-menu-group"><h2>등록된 월 수입·지출</h2>${details([['월급',money(f.salary)],['기타 수입',money(f.otherIncome)],...(f.actualApplied?[['가계부 생활비',money(f.livingExpense)]]:[['정기 지출 · 계좌',money(f.fixedCash)],['기타 지출',money(f.otherExpense)]]),['대출·카드 납부',money(f.payments)],['수입·지출 차액',money(f.balance)]])}</section><section class="m-menu-group"><h2>대출 예상</h2>${details([['상환 원금',money(loans.principal)],['납부 이자',money(loans.interest)]])}</section>${note('등록 일정과 현재 대출 조건을 기준으로 계산한 금액입니다.',true)}`;}
function mobileAdvisor(state,options){
 const comparing=state.advisorMode==='repayment';
 const modeAction=action('mobile-advisor-mode',comparing?'← 자산 상담':'대출 상환 비교 ›',
  `data-mode="${comparing?'assets':'repayment'}"`,'m-advisor-switch');
 const content=options.hidden
  ?empty('금액 표시를 켜면 상담을 이용할 수 있습니다.',action('reveal-advisor','금액 표시하고 상담하기','','m-primary'))
  :comparing?`<div class="m-advisor">${options.advisorContent||''}</div>`:renderAssetConsultation(options.advisorState||{},options);
 return `${header(comparing?'대출 상환 비교':'AI 상담')}
  ${comparing?`<div class="m-advisor-tools">${modeAction}</div>`:''}
  ${content}${!comparing?`<div class="m-advisor-tools">${modeAction}</div>`:''}`;
}
export function renderMobilePage(data,view,state,options){
 const id=options.recordId||'';let content;
 if(id&&KINDS.includes(view))content=recordDetail(data,view,id,options);
 else if(view==='overview')content=home(data,state,options);
 else if(view==='menu')content=menu();
 else if(view==='assets'||accountKinds.includes(view))content=accounts(data,view,options);
 else if(view==='cards')content=cards(data,options);
 else if(view==='schedule')content=calendar(data,state,options);
 else if(['cashflow','fixed','planned'].includes(view))content=flows(data,view,state,options);
 else if(view==='records')content=records(data,view,state,options);
 else if(view==='entry')content=entry(data,state,options);
 else if(view==='forecast'||view==='payday')content=projections(data,view,state,options);
 else if(view==='budget')content=budget(data,options);
 else if(view==='spending')content=spending(data,options);
 else if(view==='history')content=history(data,options);
 else if(view==='statistics')content=statistics(data,options);
 else if(view==='advisor')content=mobileAdvisor(state,options);
 else content=overviewDetails(data,options);
 return `<div class="m-app" data-mobile-app data-mobile-view="${esc(view)}">${view!=='overview'?options.demoBanner||'':''}${content}<div class="m-sync-line" role="status" data-mobile-sync>${options.demo?'예시 모드':'내 계정에 저장됨'}</div>${nav(view)}</div>`;
}
export function mountMobileControls(root,state,{onRender,onPrivacy,onSettings,onRefresh,onCardBill}){
 const click=event=>{const b=event.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(!a.startsWith('mobile-'))return;
  if(a==='mobile-privacy')return onPrivacy();if(a==='mobile-settings')return onSettings();if(a==='mobile-refresh')return onRefresh();if(a==='mobile-card-bill')return onCardBill(b.dataset.id);
  if(a==='mobile-day')state.selectedDate=b.dataset.date;
  if(a==='mobile-home-more')state.showAllHomeAssets=!state.showAllHomeAssets;
  if(a==='mobile-forecast-date')state.forecastDate=b.dataset.date;
  if(a==='mobile-advisor-mode')state.advisorMode=b.dataset.mode==='repayment'?'repayment':'assets';
  if(a==='mobile-flow-type')state.flowType=b.dataset.type;
  if(a==='mobile-entry-mode')state.entryMode=b.dataset.mode==='manage'?'manage':'new';
  if(a==='mobile-clear-search')state.search='';
  onRender();
 };
 const change=e=>{const key=e.target.dataset.mobileFilter;if(['category','sort'].includes(key)){state[key]=e.target.value;onRender();}};
 const submit=e=>{if(!e.target.matches('[data-mobile-search]'))return;e.preventDefault();state.search=e.target.querySelector('input[name="query"]').value;onRender();};
 root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('submit',submit);
 return()=>{root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('submit',submit);};
}

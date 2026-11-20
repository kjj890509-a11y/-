import {forecastMonthDetails,shiftMonth,todayKST} from './domain.mjs';

const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const monthLabel=month=>Number(month.slice(0,4))+'년 '+Number(month.slice(5,7))+'월';
const eventLabels={salary:'월급',other_income:'기타 수입',expense:'기타 지출',fixed:'정기 지출',loan:'대출 상환',card:'카드 결제',retirement:'연금 적립'};

export function renderForecastMonthPage(data,month,{period,money,hidden=false,today=todayKST()}){
 const detail=forecastMonthDetails(data,month,today);
 if(!detail){
  return `<div class="page-heading forecast-detail-heading"><h1 tabindex="-1" data-forecast-detail-title>월별 전망 상세</h1><a class="button secondary" href="#forecast">월별 전망 목록</a></div>
   <p class="forecast-detail-empty">이번 달부터 120개월 이내의 월을 선택해 주세요.</p>`;
 }
 const {opening,closing,firstMonth}=detail;
 const title=monthLabel(month)+' 전망 상세',change=closing.net-opening.net;
 const signed=(value,positive)=>hidden?money(value):(positive?'+ ':'− ')+money(Math.abs(value));
 const facts=entries=>`<dl class="forecast-detail-facts">${entries.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
 const earlier=shiftMonth(month,-1),later=shiftMonth(month,1);
 const monthNav=`<nav class="forecast-detail-nav" aria-label="전망 월 이동">
  ${month>period.startMonth?`<a class="button secondary small" href="#forecast/${earlier}" aria-label="${monthLabel(earlier)} 전망">이전 달</a>`:''}
  ${month<period.endMonth?`<a class="button secondary small" href="#forecast/${later}" aria-label="${monthLabel(later)} 전망">다음 달</a>`:''}
 </nav>`;
 const entries=closing.periodEvents.map(event=>{
  const date=event.dueDate||event.date,positive=event.income||event.kind==='retirement';
  const label=event.dueDate?'미확인 '+eventLabels[event.kind]:eventLabels[event.kind];
  const loan=event.kind==='loan'?' · 원금 '+money(event.principal)+' · 이자 '+money(event.interest):'';
  return `<li class="forecast-detail-event">
   <time datetime="${date}">${date.replaceAll('-','.')}</time>
   <span><strong>${escapeHTML(event.name)}</strong><small>${label}${loan}</small></span>
   <b>${signed(event.amount,positive)}</b>
  </li>`;
 }).join('');
 return `<div class="page-heading forecast-detail-heading">
   <div><h1 tabindex="-1" data-forecast-detail-title>${title}</h1><p class="subtitle">${closing.date.replaceAll('-','.')} 월말 예상</p></div>
   <div class="heading-actions"><a class="button secondary" href="#forecast">월별 전망 목록</a>${monthNav}</div>
  </div>
  <div class="forecast-detail" data-forecast-detail-month="${month}">
   <section class="forecast-detail-hero" aria-label="월말 예상 순자산">
    <span>월말 예상 순자산</span><strong>${money(closing.net)}</strong>
    <small>${firstMonth?'현재 잔액':'전월 말'} 대비 ${change===0?money(0):signed(change,change>0)}</small>
   </section>
   ${closing.cashShortage?'<p class="inline-warning">이 달 말에는 예상 예금이 부족합니다.</p>':''}
   <div class="forecast-detail-grid">
    <section class="forecast-detail-group"><h2>월말 자산·부채</h2>${facts([
     ['총자산',money(closing.gross)],['예금·현금',money(closing.deposits)],['주식 평가액',money(closing.stock)],['퇴직금·연금',money(closing.retirement)],
     ['총부채',money(closing.debt)],['대출 잔액',money(closing.loans)],['미결제 카드',money(closing.cards)]
    ])}</section>
    <section class="forecast-detail-group"><h2>이달 현금 흐름·적립</h2>${facts([
     [firstMonth?'현재 예금 잔액':'월초 예금 잔액',money(opening.deposits)],['수입',money(closing.income)],['지출·상환 합계',money(closing.expense)],['대출 상환 원금',money(closing.principal)],['대출 이자',money(closing.interest)],['카드 결제',money(closing.cardPayments)],['회사 연금 적립',money(closing.retirementContribution)]
    ])}</section>
   </div>
   <section class="forecast-detail-activity"><h2>전망에 반영된 내역 <span>${closing.periodEvents.length}건</span></h2>
    ${firstMonth?'<p>현재 잔액 기준으로 미확인 지출과 오늘 이후의 일정을 반영합니다.</p>':''}
    ${entries?`<ul class="forecast-detail-events">${entries}</ul>`:'<p class="forecast-detail-empty">이번 달 전망에 반영된 일정이 없습니다.</p>'}
   </section>
  </div>`;
}

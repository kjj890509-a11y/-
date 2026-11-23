import { actualSpendingForMonth, budgetPlan, todayKST } from './domain.mjs';
import { renderMonthPicker } from './month-picker.mjs';

export const spendingEntryHint='현금·계좌로 낸 생활비를 입력하세요. 따로 등록한 카드 청구와 대출 상환액은 생활비에서 빼주세요.';

export function spendingBreakdown(plan) {
 return [
  ['living','집계에 쓴 생활비',plan.livingExpense],
  ['cards','카드 청구 · 결제일 기준',plan.cardBills],
  ['loans','대출 상환 계획',plan.loanDue],
  ['total','월 예산 지출 합계',plan.expense]
 ];
}

export function renderMonthlySpending(data, { money, month }) {
 const currentMonth=todayKST().slice(0,7);
 const record=actualSpendingForMonth(data,month),plan=budgetPlan(data,month);
 const monthPicker=renderMonthPicker({id:'spending-month',value:month,label:'가계부 월',max:currentMonth,required:true});
 return `<div class="spending-content">
   <div class="spending-toolbar" aria-label="가계부 월 선택">
     <button type="button" class="button secondary" data-action="prev-month" aria-label="이전 달" ${month==='1900-01'?'disabled':''}>‹</button>
     ${monthPicker}
     <button type="button" class="button secondary" data-action="next-month" aria-label="다음 달" ${month>=currentMonth?'disabled':''}>›</button>
   </div>
   <div class="spending-columns">
     <section class="panel spending-record" aria-labelledby="spending-record-title">
       <h2 id="spending-record-title">실제 생활비 · 카드·대출 제외</h2>
       <strong class="spending-total">${record?money(record.amount):'미입력'}</strong>
       <button type="button" class="button ${record?'secondary':'primary'}" data-action="spending-form">${record?'금액 수정':'생활비 입력'}</button>
       <p>${spendingEntryHint}</p>
       <div class="spending-apply">
         <h3 id="spending-mode-title">이 달 생활비 기준</h3>
         <div class="spending-modes" role="group" aria-labelledby="spending-mode-title">
           <button type="button" data-action="spending-mode" data-applied="false" aria-pressed="${!plan.actualApplied}" ${record?'':'disabled'}>기존 계획 사용</button>
           <button type="button" data-action="spending-mode" data-applied="true" aria-pressed="${plan.actualApplied}" ${record?'':'disabled'}>가계부 금액 사용</button>
         </div>
         <p>${plan.actualApplied?'이 달 생활비 계획 전체를 가계부 금액으로 대체했어요.':'아직 낼 생활비를 계획에 남기려면 기존 계획을 사용하세요.'}</p>
       </div>
     </section>
     <section class="panel spending-budget" aria-labelledby="spending-budget-title">
       <h2 id="spending-budget-title">월 예산에 잡히는 금액</h2>
       <dl>${spendingBreakdown(plan).map(([key,label,amount])=>`<div ${key==='total'?'class="spending-effective"':''}><dt>${label}</dt><dd>${money(amount)}</dd></div>`).join('')}</dl>
       <a class="spending-link" href="#budget">월 예산 보기 <span aria-hidden="true">›</span></a>
     </section>
   </div>
 </div>`;
}

import { actualSpendingForMonth, budgetPlan, todayKST } from './domain.mjs';
import { renderMonthPicker } from './month-picker.mjs';

export function renderMonthlySpending(data, { money, month }) {
 const currentMonth=todayKST().slice(0,7);
 const record=actualSpendingForMonth(data,month),plan=budgetPlan(data,month);
 const planned=plan.fixedCash+plan.otherExpense;
 const monthPicker=renderMonthPicker({id:'spending-month',value:month,label:'가계부 월',max:currentMonth,required:true});
 return `<div class="spending-content">
   <div class="spending-toolbar" aria-label="가계부 월 선택">
     <button type="button" class="button secondary" data-action="prev-month" aria-label="이전 달" ${month==='1900-01'?'disabled':''}>‹</button>
     ${monthPicker}
     <button type="button" class="button secondary" data-action="next-month" aria-label="다음 달" ${month>=currentMonth?'disabled':''}>›</button>
   </div>
   <div class="spending-columns">
     <section class="panel spending-record" aria-labelledby="spending-record-title">
       <h2 id="spending-record-title">실제 생활비</h2>
       <strong class="spending-total">${record?money(record.amount):'미입력'}</strong>
       <button type="button" class="button ${record?'secondary':'primary'}" data-action="spending-form">${record?'금액 수정':'생활비 입력'}</button>
       <p>해당 월에 실제로 낸 고정비와 기타 생활비를 합쳐 입력하세요. 따로 등록한 카드 청구액과 대출 상환액은 빼주세요.</p>
       <div class="spending-apply">
         <h3 id="spending-mode-title">이 달 반영 여부</h3>
         <div class="spending-modes" role="group" aria-labelledby="spending-mode-title">
           <button type="button" data-action="spending-mode" data-applied="false" aria-pressed="${!plan.actualApplied}" ${record?'':'disabled'}>미반영</button>
           <button type="button" data-action="spending-mode" data-applied="true" aria-pressed="${plan.actualApplied}" ${record?'':'disabled'}>반영</button>
         </div>
         <p>${plan.actualApplied?'이번 달 생활비 계획을 가계부 합계로 대체했어요. 이미 낸 생활비는 현재 잔액에서 다시 빠지지 않습니다.':'기존 생활비 계획을 사용합니다. 반영을 선택하면 이 달 계획을 가계부 합계로 대체합니다.'}</p>
       </div>
     </section>
     <section class="panel spending-budget" aria-labelledby="spending-budget-title">
       <h2 id="spending-budget-title">월 예산에 잡히는 금액</h2>
       <dl>
         <div><dt>기존 생활비 계획</dt><dd>${money(planned)}</dd></div>
         <div><dt>실제 생활비 기록</dt><dd>${record?money(record.amount):'미입력'}</dd></div>
         <div class="spending-effective"><dt>집계에 쓴 생활비</dt><dd>${money(plan.livingExpense)}</dd></div>
         <div><dt>대출·카드 납부</dt><dd>${money(plan.expense-plan.livingExpense)}</dd></div>
         <div class="spending-effective"><dt>월 예산 집계 지출</dt><dd>${money(plan.expense)}</dd></div>
       </dl>
       <a class="spending-link" href="#budget">월 예산 보기 <span aria-hidden="true">›</span></a>
     </section>
   </div>
 </div>`;
}

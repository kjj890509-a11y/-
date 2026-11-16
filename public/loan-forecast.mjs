import {loanSchedule, todayKST,loanPlanSummary} from './domain.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function renderLoanForecastPanel(portfolio, {formatMoney, asOf = todayKST(), loanId = '', period = '12'}) {
  const active = portfolio.loans.filter(loan => loan.balance > 0);
  if (!active.length) return '';
  const selected = active.find(loan => loan.id === loanId);
  const included = selected ? [selected] : active;
  const plans=included.map(loan=>loanPlanSummary(loan,asOf)),known=plans.filter(plan=>plan.complete);
  const end=known.map(plan=>plan.payoffDate).filter(Boolean).sort().at(-1);
  const monthsToEnd=end?Math.max(1,(Number(end.slice(0,4))-Number(asOf.slice(0,4)))*12+Number(end.slice(5,7))-Number(asOf.slice(5,7))+1):12;
  const count=period==='all'?Math.min(1200,Math.max(plans.every(plan=>plan.complete)?1:12,monthsToEnd)):period==='36'?36:12;
  const rows = loanSchedule(portfolio, asOf.slice(0,7), count, asOf).map(month => {
    if (selected) return {...month, ...month.details.find(detail => detail.id === selected.id)};
    return {...month, openingBalance:month.details.reduce((sum, detail) => sum + detail.openingBalance, 0)};
  });
  const last = rows.at(-1);
  const interestOnly = included.filter(loan => loan.calculationMode!=='term'&&loan.principal === 0);
  const amount = value => escapeHTML(formatMoney(value));
  const name = selected ? selected.name + (selected.institution ? ' · ' + selected.institution : '') : '전체 대출';
  return `<section class="table-panel loan-interest-panel loan-forecast-panel" aria-labelledby="loan-forecast-title">
    <div class="table-heading">
      <div><h2 id="loan-forecast-title">원금·이자 상환 계획 <span>${period==='all'?'완납까지 · 기간 입력 대출 기준':'앞으로 '+count+'개월'}</span></h2><p class="table-hint">${asOf.replaceAll('-','.')} 현재 잔액 기준 · 오늘 이후 상환 일정 반영</p></div>
      <div class="loan-forecast-controls"><label class="loan-forecast-select">조회 기간<select id="loan-forecast-period"><option value="12" ${period==='12'?'selected':''}>12개월</option><option value="36" ${period==='36'?'selected':''}>3년</option><option value="all" ${period==='all'?'selected':''}>완납까지</option></select></label><label class="loan-forecast-select">확인할 대출<select id="loan-forecast-select"><option value="">전체 대출</option>${active.map(loan => `<option value="${escapeHTML(loan.id)}" ${selected?.id === loan.id ? 'selected' : ''}>${escapeHTML(loan.name)}${loan.institution ? ' · ' + escapeHTML(loan.institution) : ''}</option>`).join('')}</select></label></div>
    </div>
    <div class="loan-forecast-summary"><div><span>${escapeHTML(name)} · 현재 잔액</span><strong>${amount(included.reduce((sum, loan) => sum + loan.balance, 0))}</strong></div><span aria-hidden="true">→</span><div><span>${last.month.replace('-','년 ')}월 말 예상 잔액</span><strong>${amount(last.balance)}</strong></div></div>
    <div class="loan-plan-totals"><div><span>조회 기간 원금</span><strong>${amount(rows.reduce((sum,row)=>sum+row.principal,0))}</strong></div><div><span>조회 기간 이자</span><strong>${amount(rows.reduce((sum,row)=>sum+row.interest,0))}</strong></div><div><span>조회 기간 총 납부액</span><strong>${amount(rows.reduce((sum,row)=>sum+row.payment,0))}</strong></div></div>
    ${known.length?`<p class="loan-plan-term-note">기간을 입력한 ${known.length}건의 남은 총이자 ${amount(known.reduce((sum,plan)=>sum+plan.interest,0))} · 총상환액 ${amount(known.reduce((sum,plan)=>sum+plan.payment,0))}${plans.length===known.length&&end?' · 마지막 완납 예정 '+end:''}</p>`:''}
    ${plans.some(plan=>!plan.complete)?'<p class="loan-plan-term-note">기간 미입력 대출은 등록한 월 원금으로 계산합니다. 정확한 완납 계획은 대출 수정에서 남은 납부 횟수를 입력하세요.</p>':''}
    ${interestOnly.length ? `<p class="loan-interest-hint">매월 상환 원금이 0원으로 등록된 대출 ${interestOnly.length}건은 잔액이 줄지 않습니다. ${interestOnly.map(loan => `<button class="text-button" data-action="edit" data-kind="loans" data-id="${escapeHTML(loan.id)}">${escapeHTML(loan.name)} 원금 확인</button>`).join(' ')}</p>` : ''}
    <div class="loan-month-list" data-forecast-loan="${escapeHTML(selected?.id || '')}"><div class="loan-month-list-heading"><span>월</span><span class="loan-payment-heading">원금 / 이자 / 납부액</span><span>상환 후 예상 잔액</span></div>
      ${rows.map((row, index) => `<details class="loan-month" data-loan-month="${row.month}" data-loan-details data-ui-section="loan-month-${escapeHTML(selected?.id || 'all')}-${row.month}">
        <summary><span>${row.month}</span><span class="loan-month-payment"><span>원금 ${amount(row.principal)}</span><span>이자 ${amount(row.interest)}</span><b>납부 ${amount(row.payment)}</b></span><strong class="loan-balance-total" data-field="balance">${amount(row.balance)}</strong><span class="loan-month-chevron" aria-hidden="true">⌄</span></summary>
        <div class="loan-month-body">
          ${index === 0 ? `<p class="loan-month-caption">${selected && row.date <= asOf ? '이달 상환일 경과 · 다음 달부터 예상 상환 반영' : asOf.slice(5).replace('-','.') + ' 이후 상환 반영'}</p>` : ''}
          ${row.balance === 0 && row.openingBalance > 0 ? '<p class="loan-month-caption">상환 완료 예상</p>' : ''}
          <dl class="loan-detail-grid"><div><dt>상환 전 잔액</dt><dd data-field="openingBalance">${amount(row.openingBalance)}</dd></div><div><dt>상환 원금</dt><dd data-field="principal">${amount(row.principal)}</dd></div><div><dt>예상 이자</dt><dd data-field="interest">${amount(row.interest)}</dd></div><div><dt>총 납입액</dt><dd data-field="payment">${amount(row.payment)}</dd></div></dl>
          <div class="loan-month-calculation"><span>잔액 = 상환 전 잔액 − 상환 원금</span><button type="button" class="info-button" data-info-template aria-haspopup="dialog" aria-label="${escapeHTML(name)} ${row.month} 잔액 계산 상세 보기">i<template><p>${escapeHTML(name)} · ${row.month}</p><dl><dt>상환 전 잔액 − 상환 원금 = 상환 후 잔액</dt><dd>${amount(row.openingBalance)} − ${amount(row.principal)} = ${amount(row.balance)}</dd><dt>상환 원금 + 예상 이자 = 총 납입액</dt><dd>${amount(row.principal)} + ${amount(row.interest)} = ${amount(row.payment)}</dd></dl><p>${index === 0 && row.principal === 0 && row.interest === 0 ? '기준일까지의 상환은 현재 잔액에 이미 반영된 것으로 봅니다. 다음 달부터 앞으로의 원금과 이자를 계산합니다.' : '이자는 납입액에 포함됩니다. 대출 잔액은 납입액 중 원금으로 상환한 만큼 줄어듭니다.'}</p></template></button></div>
        </div>
      </details>`).join('')}
    </div>
    <p class="loan-schedule-note">상환 후 잔액 = 상환 전 잔액 − 상환 원금입니다. 예상 이자는 상환 전 잔액 × 연 이율 ÷ 12로 계산하며, 원금을 갚으면 다음 달 이자가 줄어듭니다. 기간 계산의 원금균등은 현재 잔액 ÷ (남은 납부 횟수 − 거치 횟수)로 원금을 나눕니다. 원 단위 잔여액은 마지막 회차에 반영합니다. 원리금균등은 월 납부액을 유지하고, 만기일시는 마지막 회차에 원금을 갚습니다. 거치 회차에는 이자만 냅니다. 실제 잔액·남은 횟수는 자동 갱신하지 않습니다. 다음 납부일이 지나면 잔액과 횟수를 확인해 수정하세요. 기간 계산은 미갱신 잔액을 다음 납부일부터 계산하고, 지난 납부를 자동 차감하지 않습니다. 잔액이 0이 되면 원금·이자 상환을 중단합니다. 실제 은행 청구액은 일수·금리 변경에 따라 다를 수 있으며, 예상표는 실제 대출잔액이나 상환 이력을 변경하지 않습니다.</p>
  </section>`;
}

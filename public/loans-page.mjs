import {interestForLoan, loanSchedule, todayKST, totals,loanNextPayment,loanPlanSummary} from './domain.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderLoanCards(loans, {formatMoney}) {
  const money = value => esc(formatMoney(value));
  return loans.map(loan => {
    const next=loanNextPayment(loan,todayKST()),principal=next.principal,interest=next.interest,plan=loanPlanSummary(loan);
    const period=loan.calculationMode==='term';
    return `<article class="panel loan-card" data-loan-card="${esc(loan.id)}" aria-label="${esc(loan.name)}">
      <header class="loan-card-heading"><div><p>${esc(loan.institution || '금융기관 미등록')}</p><h3>${esc(loan.name)}</h3></div>${loan.balance === 0 ? '<span class="status-pill paid">상환 완료</span>' : ''}</header>
      <div class="loan-card-amounts"><div><span>남은 잔액</span><strong data-loan-amount="balance">${money(loan.balance)}</strong></div><div><span>${period?'다음 납부액':'월 상환액'}</span><strong data-loan-amount="payment">${money(principal + interest)}</strong></div></div>
      <div class="loan-card-inline"><span>월 이자 <b>${money(interest)}</b></span><span>연 이율 <b>${loan.rate}%</b></span></div>${period?`<div class="loan-plan-card-summary"><span>${loan.remainingMonths}회 남음 · ${esc(loan.method)}${loan.graceMonths?' · 거치 '+loan.graceMonths+'회':''}</span><span>남은 총이자 <b>${money(plan.interest)}</b></span><span>완납 예정 <b>${plan.payoffDate||'상환 완료'}</b></span></div>${plan.adjusted?'<p class="loan-plan-warning">등록한 납부일이 지났습니다. 잔액과 남은 횟수를 확인해 수정하세요. 지난 납부는 자동 차감하지 않고 다음 납부일부터 계산했습니다.</p>':''}`:''}<div class="loan-card-meta"><span>${period&&loan.balance>0?`다음 ${next.date}`:loan.balance > 0 ? `매월 ${loan.day}일 상환` : `등록 납입일 · 매월 ${loan.day}일`}</span>${loan.balance > 0 ? `<button type="button" class="button secondary small" data-action="loan-forecast" data-id="${esc(loan.id)}">원금·이자 상환표 ↗</button>` : ''}</div>
      <details class="loan-card-details" data-loan-details data-ui-section="loan-card-${esc(loan.id)}"><summary>상환 조건·관리 <span aria-hidden="true">⌄</span></summary>
        <dl class="loan-detail-grid"><div><dt>상환 원금</dt><dd data-loan-amount="principal">${money(principal)}</dd></div><div><dt>다음 납부 이자</dt><dd data-loan-amount="interest">${money(interest)}<small>${loan.interestMode === 'estimate' ? '잔액·이율 자동 추정' : '은행 청구액 직접 입력'}</small></dd></div><div><dt>연 이율</dt><dd>${loan.rate}%</dd></div><div><dt>상환 방식</dt><dd>${esc(loan.method)}</dd></div></dl>
        ${loan.note ? `<p class="loan-card-note">${esc(loan.note)}</p>` : ''}
        <div class="loan-card-actions"><button type="button" class="button secondary small" data-action="edit" data-kind="loans" data-id="${esc(loan.id)}">대출 수정</button><button type="button" class="text-button loan-delete" data-action="delete" data-kind="loans" data-id="${esc(loan.id)}">삭제</button></div>
      </details>
    </article>`;
  }).join('');
}

export function renderLoanManagement(portfolio, {formatMoney, query = '', heading = '', demoBanner = '', forecastPanel = ''}) {
  const money = value => esc(formatMoney(value)), t = totals(portfolio), active = portfolio.loans.filter(loan => loan.balance > 0);
  const weighted = t.loans ? portfolio.loans.reduce((sum, loan) => sum + loan.balance * loan.rate, 0) / t.loans : 0;
  const asOf = todayKST(), annual = loanSchedule(portfolio, asOf.slice(0,7), 12, asOf).reduce((sum, row) => sum + row.interest, 0);
  const needle = query.toLowerCase();
  const filtered = portfolio.loans.filter(loan => (loan.name + ' ' + (loan.institution || '') + ' ' + (loan.note || '')).toLowerCase().includes(needle));
  return `${heading}${demoBanner}<section class="panel loan-overview" aria-label="대출 요약">
    <div class="loan-overview-balance"><span>전체 남은 잔액</span><strong>${money(t.loans)}</strong><p>상환 중 ${active.length}건 · 전체 ${portfolio.loans.length}건</p></div>
    <div class="loan-overview-payment"><div class="with-info"><span>매월 상환액</span><button type="button" class="info-button" data-info-template aria-haspopup="dialog" aria-label="대출 요약 계산 기준 상세 보기">i<template><dl><dt>상환 원금 합계</dt><dd>${money(t.monthlyPrincipal)}</dd><dt>이번 납부 이자 합계</dt><dd>${money(t.monthlyInterest)}</dd><dt>앞으로 12개월 예상 이자</dt><dd>${money(annual)}</dd><dt>잔액 가중평균 연 이율</dt><dd>${weighted.toFixed(2)}%</dd></dl><p>매월 상환액은 등록한 원금과 이번 납부 이자의 합계입니다. 월별 예상에서는 남은 잔액과 연 이율로 이자를 다시 계산합니다. 실제 상환일이 지나도 등록 잔액은 자동으로 바뀌지 않습니다.</p></template></button></div><strong>${money(t.monthlyPrincipal + t.monthlyInterest)}</strong></div>
    <div class="loan-overview-interest"><span>대출 월 이자 합계</span><strong>${money(t.monthlyInterest)}</strong><p>앞으로 12개월 ${money(annual)}</p></div>
  </section>
  <section class="loan-accounts" aria-labelledby="loan-accounts-title"><div class="loan-accounts-toolbar"><h2 id="loan-accounts-title">내 대출 <span id="loans-count" aria-live="polite">${filtered.length}건</span></h2><input class="search-input" id="record-search" type="search" placeholder="대출명 · 은행 검색" aria-label="대출 검색" value="${esc(query)}"></div>
    ${portfolio.loans.length ? `<div class="loan-account-list" id="loan-list">${renderLoanCards(filtered, {formatMoney}) || '<div class="empty-inline loan-search-empty">검색 결과가 없습니다.</div>'}</div>` : '<div class="panel empty-state"><h3>아직 등록한 대출이 없어요</h3><p>잔액, 연이율과 남은 상환 횟수를 입력하면 원금·이자를 자동 계산합니다.</p><button type="button" class="button primary" data-action="add" data-kind="loans">대출 추가하기</button></div>'}
  </section>${forecastPanel}`;
}

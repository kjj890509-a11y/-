import {todayKST} from './domain.mjs';
import {buildStatistics, initialStatisticsFilters, statisticsKinds, statisticsMetrics, statisticsBases, statisticsOptions, statisticsPeriod, statisticsSeries, metricsForKind} from './statistics.mjs';
import {renderTrendChart} from './chart.mjs';

import {renderAmountBars,renderExpenseComposition} from './financial-charts.mjs';
export {initialStatisticsFilters};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option = (value,label,current) => `<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;
const pageSize = 50;
export function renderStatisticsPage(data, filters, {formatMoney,formatCompact,today=todayKST()}) {
  const money = value => esc(formatMoney(value));
  const banks = [...new Set([...data.loans.map(row=>row.institution),...(data.loanPayments||[]).map(row=>row.institution)].map(value=>String(value||'').trim()||'은행 미등록'))].sort((a,b)=>a.localeCompare(b,'ko'));
  const items = statisticsOptions(data,filters.kind,filters.bank);
  const controls = `<section class="panel stats-controls"><form id="statistics-filter-form">
    <div class="stats-filter-grid">
      <label>기간 선택<select id="stats-preset" name="preset">${[['year','연간'],['month','월간'],['custom','직접 지정']].map(([v,n])=>option(v,n,filters.preset)).join('')}</select></label>
      ${filters.preset==='year'?`<label>연도<input id="stats-year" name="year" type="number" min="1900" max="2199" value="${esc(filters.year)}" required></label>`:filters.preset==='month'?`<label>조회 월<input id="stats-month" name="month" type="month" value="${esc(filters.month)}" required></label>`:''}
      <label>시작일<input id="stats-start" name="start" type="date" value="${esc(filters.start)}" required></label>
      <label>종료일<input id="stats-end" name="end" type="date" value="${esc(filters.end)}" required></label>
      <label>조회 항목<select id="stats-kind" name="kind">${Object.entries(statisticsKinds).map(([v,n])=>option(v,n,filters.kind)).join('')}</select></label>
      <label class="stats-filter-wide">집계 기준<select id="stats-basis" name="basis">${Object.entries(statisticsBases).map(([v,n])=>option(v,n,filters.basis||'all')).join('')}</select></label>
      <label>대출 은행<select id="stats-bank" name="bank" ${!['all','loans'].includes(filters.kind)?'disabled':''}>${option('','모든 은행',filters.bank)}${banks.map(bank=>option(bank,bank,filters.bank)).join('')}</select></label>
      <label class="stats-filter-wide">특정 항목<select id="stats-item" name="item">${option('','모든 항목',filters.item)}${items.map(item=>option(item.key,item.name+(item.institution?' · '+item.institution:''),filters.item)).join('')}</select></label>
      <label class="stats-filter-wide">이름·메모 검색<input id="stats-query" name="query" type="search" value="${esc(filters.query)}" placeholder="예: 도치, 신한은행, 보험료"></label>
    </div><div class="stats-filter-actions"><p id="stats-filter-error" role="alert"></p><button type="button" class="button secondary" data-stats-reset>초기화</button><button type="submit" class="button primary">통계 조회</button></div>
  </form></section>`;
  const heading = `<div class="page-heading"><div><span class="eyebrow">돈모아</span><h1>기간별 분석</h1><p class="subtitle">원하는 기간의 은행별 대출과 항목별 수입·지출을 확인하세요.</p></div><div class="heading-actions"><button class="button secondary" data-action="pin-statistics">맞춤 대시보드에 추가</button><button class="button secondary" data-action="add-loan-payment">상환 기록 추가</button></div></div>`;
  let result;
  try { result=buildStatistics(data,filters,today); }
  catch(error) { return heading+controls+`<p class="inline-warning" role="alert">${esc(error.message)}</p>`; }
  const {totals,months,rows,groups} = result;
  const metric = (label,value,caption='',explain=false) => `<div class="metric-box"><span class="label">${label}</span><strong>${value}</strong>${caption?`<small ${explain?'data-metric-help':''}>${caption}</small>`:''}</div>`;
  const loanView = filters.kind==='loans'||Boolean(filters.bank)||filters.item.startsWith('loans:')||filters.item.startsWith('recorded-loan:');
  const pensionView=filters.kind==='retirement'||filters.item.startsWith('retirement:');
  const hasPension=totals.retirementContribution>0||pensionView;
  const metrics = pensionView?metric('회사 납입 예정액',money(totals.retirementContribution),'예금 수입·지출에 포함하지 않는 회사 납입 일정',true)+metric('납입 일정',rows.length+'건')+metric('조회 기간',months.length+'개월'):loanView
    ? metric('대출 상환 합계',money(totals.loanPayment),`상환 기록 ${money(totals.actualLoanPayment)} · 예상 ${money(totals.projectedLoanPayment)}`)+metric('상환 원금',money(totals.principal))+metric('대출 이자 합계',money(totals.interest))+metric('조회 건수',rows.length+'건')
    : metric('수입 합계',money(totals.income))+metric('지출·상환 합계',money(totals.expense),'대출 원금·이자 포함',true)+metric('대출 이자',money(totals.interest))+metric('수입·지출 차액',money(totals.income-totals.expense));
  const availableMetrics=metricsForKind(pensionView?'retirement':loanView?'loans':filters.kind);
  const selectedMetric=Object.hasOwn(availableMetrics,filters.metric)?filters.metric:Object.keys(availableMetrics)[0];
  const points = statisticsSeries(result,selectedMetric);
  const pages = Math.max(1,Math.ceil(rows.length/pageSize));
  const page = Math.max(1,Math.min(pages,Number(filters.page)||1));
  const visibleRows = rows.slice((page-1)*pageSize,page*pageSize);
  return heading+controls+`<p class="stats-period-label">${esc(filters.start.replaceAll('-','.'))} ~ ${esc(filters.end.replaceAll('-','.'))} · ${rows.length}건</p>
    <div class="stats-source-summary" aria-label="집계 내역 구분">${Object.entries(result.sources).filter(([,value])=>value.count).map(([key,value])=>`<span>${esc(statisticsBases[key])} ${value.count}건</span>`).join('')||'<span>등록된 내역 없음</span>'}</div>
    <div class="planning-metrics">${metrics}</div>${hasPension&&!pensionView?`<div class="stats-retirement-summary"><span>회사 퇴직연금 납입 일정</span><strong>${money(totals.retirementContribution)}</strong><span>예금 수입·지출과 별도</span></div>`:''}
    <div class="stats-note">등록한 날짜와 반복 일정 기준이며 실제 입출금 완료를 뜻하지 않습니다. 과거 대출은 직접 입력한 상환 기록만, 오늘 이후 대출은 현재 잔액·이율·원금 조건의 예상 상환을 집계합니다.</div>
    ${totals.cardIncluded?`<div class="stats-note">카드 청구액에 포함한 지출 내역 ${money(totals.cardIncluded)}은 아래 내역에서 확인할 수 있습니다. 카드대금과 중복되지 않게 합계에서는 제외했습니다.</div>`:''}
    <section class="panel stats-trend"><div class="panel-header"><div><h2>${points.length===months.length?'월별':'일별'} 금액</h2><p>마우스를 올리거나 터치하면 날짜와 금액을 확인할 수 있습니다.</p></div><div class="stats-chart-choices"><label class="stats-chart-select">형태<select id="stats-chart-type"><option value="line" ${filters.chartType!=='bar'?'selected':''}>선 그래프</option><option value="bar" ${filters.chartType==='bar'?'selected':''}>막대 그래프</option></select></label><label class="stats-chart-select">그래프 항목<select id="stats-metric">${Object.entries(availableMetrics).map(([v,n])=>option(v,n,selectedMetric)).join('')}</select></label></div></div>${filters.chartType==='bar'?renderAmountBars(points,{formatMoney,formatCompact,title:'기간별 '+statisticsMetrics[selectedMetric]}):renderTrendChart(points,{formatMoney,formatCompact,title:'기간별 '+statisticsMetrics[selectedMetric],seriesLabel:statisticsMetrics[selectedMetric]})}</section>${renderExpenseComposition(result,{formatMoney,formatCompact})}
    <section class="table-panel stats-table"><div class="table-heading"><h2>월별 합계</h2><span class="table-hint">조회 시작일과 종료일을 포함합니다.</span></div><div class="table-scroll"><table><thead><tr><th>월</th><th class="numeric">수입</th><th class="numeric">지출·상환</th><th class="numeric">대출 원금</th><th class="numeric">대출 이자</th><th class="numeric">수입·지출 차액</th>${hasPension?'<th class="numeric">회사 연금 납입</th>':''}${totals.cardIncluded?'<th class="numeric">카드 청구 포함 · 중복 제외</th>':''}</tr></thead><tbody>${months.map(row=>`<tr><td><strong>${row.month}</strong></td><td class="numeric">${money(row.income)}</td><td class="numeric">${money(row.expense)}</td><td class="numeric">${money(row.principal)}</td><td class="numeric">${money(row.interest)}</td><td class="numeric">${money(row.income-row.expense)}</td>${hasPension?`<td class="numeric">${money(row.retirementContribution)}</td>`:''}${totals.cardIncluded?`<td class="numeric">${money(row.cardIncluded)}</td>`:''}</tr>`).join('')}</tbody></table></div></section>
    <details class="panel stats-breakdown"><summary>항목별 합계 <span>${groups.length}개 항목</span></summary><div class="table-scroll"><table><thead><tr><th>항목 · 은행</th><th class="numeric">수입</th><th class="numeric">지출·상환</th><th class="numeric">이자</th><th class="numeric">카드 청구 포함 · 중복 제외</th>${hasPension?'<th class="numeric">회사 연금 납입</th>':''}</tr></thead><tbody>${groups.map(row=>`<tr><td><strong>${esc(row.name)}</strong><small>${esc(row.institution)}</small></td><td class="numeric">${money(row.income)}</td><td class="numeric">${money(row.expense)}</td><td class="numeric">${money(row.interest)}</td><td class="numeric">${money(row.cardIncluded)}</td>${hasPension?`<td class="numeric">${money(row.retirementContribution)}</td>`:''}</tr>`).join('')||'<tr><td colspan="6">조회된 항목이 없습니다.</td></tr>'}</tbody></table></div></details>
    <section class="table-panel stats-table"><div class="table-heading"><h2>기간 내 상세 내역 <span>${rows.length}건</span></h2><span class="table-hint">상환 기록과 예상 상환을 구분해 표시합니다.</span></div><div class="table-scroll"><table><thead><tr><th>날짜</th><th>항목 · 은행</th><th>구분</th><th class="numeric">금액</th><th class="numeric">원금</th><th class="numeric">이자</th><th></th></tr></thead><tbody>${visibleRows.map(row=>`<tr><td>${row.date}</td><td><strong>${esc(row.name)}</strong><small>${esc(row.institution||row.note)}</small></td><td><span class="status-pill ${row.forecast?'':row.source==='loanPayments'?'paid':''}">${esc(row.status)}</span></td><td class="numeric">${money(row.amount)}</td><td class="numeric">${row.type==='loans'?money(row.principal):'—'}</td><td class="numeric">${row.type==='loans'?money(row.interest):'—'}</td><td>${row.source==='loanPayments'?`<button class="button secondary small" data-action="edit-loan-payment" data-id="${esc(row.recordId)}">상세 수정</button> <button class="text-button stats-delete" data-action="delete-loan-payment" data-id="${esc(row.recordId)}">삭제</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-inline">조회 조건에 맞는 내역이 없습니다. 과거 대출 상환은 ‘상환 기록 추가’에서 입력할 수 있어요.</td></tr>'}</tbody></table></div>
    <div class="stats-pagination"><button class="button secondary small" data-stats-page="${page-1}" ${page===1?'disabled':''}>이전</button><span>${page} / ${pages}</span><button class="button secondary small" data-stats-page="${page+1}" ${page===pages?'disabled':''}>다음</button></div></section>`;
}

export function mountStatisticsControls(root, state, onChange, onFeedback=()=>{}) {
  const form=root.querySelector('#statistics-filter-form');
  if (!form) return;
  const read = () => {
    const next={...state,page:1};
    for (const name of ['preset','year','month','start','end','kind','bank','item','query','basis']) {
      const input=form.querySelector(`[name="${name}"]`);if(input)next[name]=input.disabled?'':input.value;
    }
    return next;
  };
  const apply = event => {
    event.preventDefault();const next=read();
    try {
      if (['stats-preset','stats-year','stats-month'].includes(event.target.id) && next.preset!=='custom') Object.assign(next,statisticsPeriod(next.preset,next.preset==='year'?next.year:next.month));
      if (['stats-start','stats-end'].includes(event.target.id)) next.preset='custom';
      if (event.target.id==='stats-kind') {next.bank='';next.item='';next.metric=next.kind==='income'?'income':next.kind==='retirement'?'retirementContribution':next.kind==='loans'?'loanPayment':'expense';}
      if (event.target.id==='stats-bank') {if(next.bank)next.kind='loans';next.item='';}
      onChange(next);
      if(event.type==='submit')onFeedback('조회 조건을 적용했어요.');
    } catch(error) {form.querySelector('#stats-filter-error').textContent=error.message;}
  };
  form.addEventListener('submit',apply);
  form.addEventListener('change',event=>{if(event.target.id!=='stats-query')apply(event);});
  root.querySelector('[data-stats-reset]').addEventListener('click',()=>onChange(initialStatisticsFilters()));
  root.querySelector('#stats-chart-type')?.addEventListener('change',event=>onChange({...state,chartType:event.target.value==='bar'?'bar':'line'}));
  root.querySelector('#stats-metric')?.addEventListener('change',event=>onChange({...state,metric:event.target.value}));
  root.querySelectorAll('[data-stats-page]').forEach(button=>button.addEventListener('click',()=>onChange({...state,page:Number(button.dataset.statsPage)})));
}

import {repaymentScenarios} from './repayment.mjs';
import {renderTrendChart} from './chart.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const strategies={rate:'높은 금리 우선',balance:'적은 잔액 우선'};
const metrics={loans:'대출 잔액',deposits:'예금 잔액',net:'순자산'};
export function initialAdvisorState(){return {options:{monthlyExtra:0,lumpSum:0,reserve:0,months:12},strategy:'rate',metric:'loans',model:'gpt-6-astra',apiKey:'',question:'대출 이자 부담을 줄이려면 어떤 순서로 상환하는 것이 좋을까요? 예금을 유지하면서 실행할 상환 계획을 설명해 주세요.',advice:null,error:'',busy:false};}
export function renderAdvisorPage(data,state,{formatMoney,formatCompact,demo=false,hideAmounts=false}) {
  if(hideAmounts)return '<div class="page-heading"><div><h1>AI 상담</h1><p class="subtitle">금액 숨김을 해제하면 상담 내용과 상환 비교를 볼 수 있습니다.</p></div><button type="button" class="button primary" data-action="reveal-advisor">금액 표시하고 상담하기</button></div>';
  const money=value=>esc(formatMoney(value));
  const active=data.loans.some(loan=>loan.balance>0);
  const controls=`<section class="panel advisor-controls"><form id="advisor-form"><fieldset ${state.busy?'disabled':''}><div class="stats-filter-grid">
    <label>매월 더 갚을 금액 · 원<input name="monthlyExtra" inputmode="numeric" value="${esc(state.options.monthlyExtra)}" required></label>
    <label>지금 한 번 더 갚을 금액 · 원<input name="lumpSum" inputmode="numeric" value="${esc(state.options.lumpSum)}" required></label>
    <label>예금에 남겨둘 최소 금액 · 원<input name="reserve" inputmode="numeric" value="${esc(state.options.reserve)}" required></label>
    <label>비교 기간<select name="months">${[12,24,36].map(value=>`<option value="${value}" ${state.options.months===value?'selected':''}>${value}개월</option>`).join('')}</select></label>
    <label class="stats-filter-wide">OpenAI API 키<input id="advisor-api-key" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="보유한 API 키 입력"></label>
    <label class="stats-filter-wide">사용할 모델<input name="model" value="${esc(state.model)}" required></label>
    <label class="advisor-question">상담 질문<textarea name="question" rows="3" maxlength="2000">${esc(state.question)}</textarea></label>
    </div><p class="advisor-key-note">API 키는 이 탭의 메모리에서만 사용하며 서버·백업에 저장하지 않습니다. 상담을 요청하면 자산 요약과 비교 계산 결과를 OpenAI로 보내며, 연결한 API 프로젝트의 사용량으로 청구됩니다.</p>
    <div class="stats-filter-actions"><button class="button secondary" type="button" data-advisor-disconnect>키 연결 해제</button><button class="button secondary" type="submit">그래프 계산</button><button class="button primary" type="button" data-advisor-consult ${state.busy||!active||demo?'disabled':''}>${state.busy?'AI 상담 중…':'AI 상담받기'}</button></div></fieldset></form></section>`;
  const heading='<div class="page-heading"><div><span class="eyebrow">MOA / AI ADVISOR</span><h1>AI 상담</h1><p class="subtitle">상환 순서를 비교하고 예금·대출·순자산이 어떻게 달라지는지 확인하세요.</p></div></div>';
  let scenarios;
  try{scenarios=repaymentScenarios(data,state.options);}catch(error){return heading+controls+`<p class="inline-warning" role="alert">${esc(error.message)}</p>`;}
  const plan=scenarios[state.strategy]||scenarios.rate,metric=Object.hasOwn(metrics,state.metric)?state.metric:'loans';
  const last=plan.rows.at(-1),baseLast=scenarios.baseline.rows.at(-1);
  const card=(label,value,note='')=>`<div class="metric-box"><span class="label">${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</div>`;
  const points=plan.rows.map(row=>({label:row.month.slice(2).replace('-','.'),detailLabel:row.month+' · '+strategies[state.strategy],value:row[metric],forecast:false}));
  const baseline=scenarios.baseline.rows.map(row=>({value:row[metric]}));
  return heading+controls+`${!active?'<div class="stats-note" data-advisor-notice>상환할 대출을 먼저 <a href="#loans">대출 관리</a>에 등록해 주세요.</div>':''}${demo?'<div class="stats-note" data-advisor-notice>예시 데이터의 상환 계획입니다. 실제 AI 상담은 예시 모드를 종료한 뒤 이용해 주세요.</div>':''}
    ${state.error?`<p class="inline-warning" role="alert">${esc(state.error)}</p>`:''}
    ${state.busy?'<div class="stats-note" role="status">비교 계산 결과를 전달하고 AI 답변을 기다리고 있습니다.</div>':''}
    ${state.advice?`<section class="panel advisor-answer"><div class="panel-header"><h2>AI 추천 · ${strategies[state.advice.recommendation]||''}</h2></div><p>${esc(state.advice.summary)}</p><ul>${state.advice.reasons.slice(0,5).map(text=>`<li>${esc(text)}</li>`).join('')}</ul>${state.advice.checks.length?`<h3>실행 전 확인할 내용</h3><ul>${state.advice.checks.slice(0,5).map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}</section>`:''}
    <div class="advisor-strategies">${Object.entries(strategies).map(([value,label])=>`<button class="button ${state.strategy===value?'primary':'secondary'}" data-advisor-strategy="${value}">${label}</button>`).join('')}</div>
    <div class="planning-metrics">${card('예상 이자 절감',money(plan.interestSaved),`${state.options.months}개월 동안 기존 계획과 비교`)}${card('마지막 달 대출 잔액',money(last.loans),'기존 '+money(baseLast.loans))}${card('마지막 달 예금',money(last.deposits),'기존 '+money(baseLast.deposits))}${card('예상 순자산 차이',money(plan.netGain),'원금 상환 자체는 순자산을 늘리지 않습니다.')}</div>
    <div class="stats-note">월말에 추가상환하며, 예금이 설정한 유지액 아래로 내려가면 추가상환을 줄입니다. 실제 추가상환 합계 ${money(plan.totalExtra)} · 비교 기간 내 전체 대출 상환 완료 ${plan.payoffDate?esc(plan.payoffDate):'미완료'}. 중도상환수수료·금리 변경·등록하지 않은 생활비는 계산에 포함되지 않습니다.</div>
    <section class="panel stats-trend"><div class="panel-header"><div><h2>상환 계획에 따른 월별 변화</h2><p>실선은 선택한 상환안, 점선은 기존 계획입니다.</p></div><label class="stats-chart-select">비교할 자산<select id="advisor-metric">${Object.entries(metrics).map(([value,label])=>`<option value="${value}" ${metric===value?'selected':''}>${label}</option>`).join('')}</select></label></div>${renderTrendChart(points,{formatMoney,formatCompact,title:metrics[metric]+' 상환안 비교',seriesLabel:strategies[state.strategy],comparisonPoints:baseline,comparisonLabel:'기존 계획'})}</section>
    <section class="table-panel stats-table"><div class="table-heading"><h2>추가상환 순서</h2><span class="table-hint">선택한 기준의 우선순위</span></div><div class="table-scroll"><table><thead><tr><th>순서</th><th>대출 · 은행</th><th class="numeric">연 이율</th><th class="numeric">추가상환 배정</th></tr></thead><tbody>${plan.order.map((loan,index)=>`<tr><td>${index+1}</td><td><strong>${esc(loan.name)}</strong><small>${esc(loan.institution)}</small></td><td class="numeric">${loan.rate}%</td><td class="numeric">${money(loan.extra)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="table-panel stats-table"><div class="table-heading"><h2>월별 비교</h2></div><div class="table-scroll"><table><thead><tr><th>월</th><th class="numeric">기존 대출 잔액</th><th class="numeric">상환안 대출 잔액</th><th class="numeric">상환안 예금</th><th class="numeric">상환안 순자산</th><th class="numeric">그달 이자 절감</th></tr></thead><tbody>${plan.rows.map((row,index)=>`<tr><td>${row.month}</td><td class="numeric">${money(scenarios.baseline.rows[index].loans)}</td><td class="numeric">${money(row.loans)}</td><td class="numeric">${money(row.deposits)}</td><td class="numeric">${money(row.net)}</td><td class="numeric">${money(scenarios.baseline.rows[index].interest-row.interest)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
export function mountAdvisorControls(root,state,{onChange,onConsult,onFeedback=()=>{}}) {
  const form=root.querySelector('#advisor-form');if(!form)return;
  root.querySelector('[name="apiKey"]').value=state.apiKey;
  const read=()=>{
    const value=name=>root.querySelector(`[name="${name}"]`).value;
    return {...state,apiKey:value('apiKey').trim(),model:value('model').trim(),question:value('question'),options:{monthlyExtra:Number(value('monthlyExtra').replaceAll(',','')),lumpSum:Number(value('lumpSum').replaceAll(',','')),reserve:Number(value('reserve').replaceAll(',','')),months:Number(value('months'))}};
  };
  form.addEventListener('submit',event=>{event.preventDefault();onChange({...read(),advice:null,error:''});onFeedback('상환안 비교를 계산했어요.');});
  root.querySelector('[data-advisor-consult]').addEventListener('click',()=>{if(!state.busy)onConsult(read());});
  root.querySelector('[data-advisor-disconnect]').addEventListener('click',()=>{onChange({...read(),apiKey:'',error:''});onFeedback('이 탭의 API 키를 지웠어요.');});
  root.querySelectorAll('[data-advisor-strategy]').forEach(button=>button.addEventListener('click',()=>onChange({...read(),strategy:button.dataset.advisorStrategy})));
  root.querySelector('#advisor-metric')?.addEventListener('change',event=>onChange({...read(),metric:event.target.value}));
}

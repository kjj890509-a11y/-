const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
 '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

export function renderAssetConsultation(state, {demo = false} = {}) {
 const ready = state.service === 'ready';
 const messages = state.assetMessages || [];
 const serviceMessage = {
  unconfigured: 'AI 연결이 설정되지 않았습니다.',
  error: 'AI 연결을 확인하지 못했습니다.'
 };
 const reconnect = Object.hasOwn(serviceMessage, state.service);
 const status = demo ? '예시 모드에서는 질문을 보낼 수 없습니다.'
  : ready ? '' : reconnect ? serviceMessage[state.service] : 'AI 연결 확인 중…';
 const transcript = messages.length ? `<div class="m-consult-messages" aria-live="polite">
  ${messages.map(message => `<article class="m-consult-turn">
   <p class="m-consult-question">${esc(message.question)}</p>
   <div class="m-consult-answer"><strong>${esc(message.summary)}</strong>
    <p>${esc(message.answer)}</p>
    ${message.checks?.length ? `<details><summary>확인할 내용</summary>
     <ul>${message.checks.map(check => `<li>${esc(check)}</li>`).join('')}</ul></details>` : ''}
    <small>${esc(message.asOf)} 기준</small>
   </div>
  </article>`).join('')}
 </div>` : '';

 return `<section class="m-consultation" aria-label="자산 상담">
  ${transcript}
  ${state.assetError ? `<p class="m-consult-error" role="alert">${esc(state.assetError)}</p>` : ''}
  ${state.busy ? '<p class="m-consult-wait" role="status">답변을 작성하고 있습니다…</p>' : ''}
  <form id="asset-advisor-form">
   <label for="asset-advisor-question" class="sr-only">내 자산에 대해 물어보기</label>
   <textarea id="asset-advisor-question" name="question" rows="2" maxlength="2000" required placeholder="예: 다음 급여일에 얼마가 남을까요?">${esc(state.assetQuestion || '')}</textarea>
   <button type="submit" ${!ready || state.busy || demo ? 'disabled' : ''}>${state.busy ? '답변 중' : '보내기'}</button>
  </form>
  ${status ? `<div class="m-consult-status" data-asset-service>
   <p role="status">${status}</p>
   ${reconnect && !demo ? '<button type="button" data-action="check-advisor">다시 확인</button>' : ''}
  </div>` : ''}
  <details class="m-consult-data">
   <summary>상담에 쓰이는 데이터</summary>
   <p>질문, 최근 대화, 자산 요약과 전망을 OpenAI로 전송합니다. 답변은 참고용이며 대화는 이번 방문 동안만 표시됩니다.</p>
  </details>
 </section>`;
}

export function mountAssetConsultation(root, state, {onConsult}) {
 const form = root.querySelector('#asset-advisor-form');
 if (!form) return () => {};
 const field = form.querySelector('[name=question]');
 const input = () => { state.assetQuestion = field.value; };
 const submit = event => {
  event.preventDefault();
  const question = field.value.trim();
  if (question && state.service === 'ready' && !state.busy) onConsult(question);
 };
 field.addEventListener('input', input);
 form.addEventListener('submit', submit);
 return () => {
  field.removeEventListener('input', input);
  form.removeEventListener('submit', submit);
 };
}

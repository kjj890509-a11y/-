import {validatePortfolio,validMonth,validDate,paymentDate,todayKST} from './domain.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=new Intl.NumberFormat('ko-KR');
export const createCardBillingState=()=>({month:todayKST().slice(0,7),drafts:new Map(),busy:false,error:'',message:''});
const findBill=(data,accountId,month)=>data.cards.find(row=>row.cardAccountId===accountId&&row.dueDate.slice(0,7)===month);
const keyFor=(month,id)=>month+':'+id;
const parse=(field,value)=>{
 if(field==='amount'){const raw=String(value).replaceAll(',','').trim();if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>1e15)throw new Error('청구액을 0 이상의 원 단위 정수로 입력해 주세요.');return Number(raw);}
 if(field==='paid'){if(!['true','false',true,false].includes(value))throw new Error('결제 상태를 확인해 주세요.');return value===true||value==='true';}
 if(field==='dueDate'&&validDate(value))return value;
 throw new Error('결제일을 확인해 주세요.');
};
export function saveCardAccount(data,record,{sourceBillId='',existingAccountId=''}={}){
 const next=structuredClone(data);next.cardAccounts||=[];
 let account=existingAccountId?next.cardAccounts.find(row=>row.id===existingAccountId):record;
 if(!account)throw new Error('연결할 카드를 확인해 주세요.');
 if(!existingAccountId){const index=next.cardAccounts.findIndex(row=>row.id===record.id);if(index<0)next.cardAccounts.push(record);else next.cardAccounts[index]=record;}
 if(sourceBillId){const row=next.cards.find(row=>row.id===sourceBillId);if(!row)throw new Error('연결할 청구 내역이 없습니다.');if(row.cardAccountId&&row.cardAccountId!==account.id)throw new Error('이미 다른 카드에 연결된 청구입니다.');row.cardAccountId=account.id;}
 return validatePortfolio(next);
}
export function setCardArchived(data,id,archived){const next=structuredClone(data),row=next.cardAccounts?.find(row=>row.id===id);if(!row)throw new Error('카드를 찾지 못했습니다.');row.archived=archived;return validatePortfolio(next);}
export function stageCardBill(state,data,accountId,field,value){
 if(!['amount','dueDate','paid'].includes(field)||!validMonth(state.month))throw new Error('수정할 청구 항목을 확인해 주세요.');
 const account=data.cardAccounts?.find(row=>row.id===accountId);if(!account)throw new Error('내 카드를 찾지 못했습니다.');
 const identity=keyFor(state.month,accountId),bill=findBill(data,accountId,state.month),draft=state.drafts.get(identity)||{accountId,month:state.month,base:bill?structuredClone(bill):null,defaults:{amount:'',dueDate:paymentDate(state.month,account.day),paid:false},changes:{}};
 const previous=draft.base?.[field]??draft.defaults[field];let same=false;try{same=Object.is(parse(field,value),previous);}catch{same=value===previous;}
 if(same)delete draft.changes[field];else draft.changes[field]=value;
 if(Object.keys(draft.changes).length)state.drafts.set(identity,draft);else state.drafts.delete(identity);state.error='';state.message='';
}
export function applyCardBills(data,state,{createId=()=>crypto.randomUUID()}={}){
 const next=structuredClone(data);
 for(const draft of state.drafts.values()){
  const account=next.cardAccounts?.find(row=>row.id===draft.accountId),current=findBill(next,draft.accountId,draft.month);
  if(!account)throw new Error('청구를 저장할 내 카드를 찾지 못했습니다.');
  if((draft.base?.id||null)!==(current?.id||null))throw new Error(account.name+': 청구 내역이 다른 곳에서 추가되거나 삭제됐습니다. 이 변경을 되돌린 뒤 다시 확인해 주세요.');
  if(!current&&account.archived)throw new Error(account.name+': 보관한 카드를 복원한 뒤 청구를 등록해 주세요.');
  const values=current?{...current}:{id:createId(),name:account.name,...draft.defaults,note:'',cardAccountId:account.id};
  for(const [field,raw]of Object.entries(draft.changes)){
   let value;try{value=parse(field,raw);}catch(error){throw new Error(account.name+': '+error.message);}
   if(current&&!Object.is(current[field],draft.base[field])&&!Object.is(current[field],value))throw new Error(account.name+': 같은 청구 값이 다른 곳에서 바뀌었습니다. 이 변경을 되돌린 뒤 다시 수정해 주세요.');values[field]=value;
  }
  if(values.amount==='')throw new Error(account.name+': 이번 달 청구액을 입력해 주세요.');
  if(values.dueDate.slice(0,7)!==draft.month)throw new Error(account.name+': 선택한 결제 월에 속하는 결제일을 입력해 주세요.');
  if(current)next.cards[next.cards.findIndex(row=>row.id===current.id)]=values;else next.cards.push(values);
 }
 return validatePortfolio(next);
}
export function renderCardBilling(data,state,{money,hidden=false}){
 const accounts=(data.cardAccounts||[]).filter(row=>!row.archived||findBill(data,row.id,state.month)),count=state.drafts.size;
 const rows=accounts.map(account=>{
  const bill=findBill(data,account.id,state.month),draft=state.drafts.get(keyFor(state.month,account.id)),values={...(bill||draft?.base||draft?.defaults||{amount:'',dueDate:paymentDate(state.month,account.day),paid:false}),...draft?.changes};
  const attr=field=>`data-card-bill-field="${field}" data-card-account="${esc(account.id)}" aria-label="${esc(account.name+' · '+({amount:'청구액',dueDate:'결제일',paid:'결제 상태'})[field])}" ${state.busy?'disabled':''}`;
  return `<tr class="${draft?'is-changed':''}"><th scope="row"><strong>${esc(account.name)}</strong><small>기본 ${account.day}일${account.archived?' · 보관한 카드':''}</small></th><td class="numeric">${hidden?'<span>••••••</span>':`<input type="text" inputmode="numeric" ${attr('amount')} value="${esc(typeof values.amount==='number'?won.format(values.amount):values.amount)}" placeholder="이번 달 청구액">`}</td><td><input type="date" ${attr('dueDate')} value="${esc(values.dueDate)}"></td><td><select ${attr('paid')}><option value="false" ${String(values.paid)==='false'?'selected':''}>결제 예정</option><option value="true" ${String(values.paid)==='true'?'selected':''}>결제 완료</option></select></td><td><span data-card-bill-status="${esc(account.id)}">${draft?'수정 중':bill?'저장됨':'미입력'}</span><button type="button" class="text-button" data-card-bill-undo="${esc(keyFor(state.month,account.id))}" ${draft?'':'hidden'} ${state.busy?'disabled':''}>되돌리기</button></td></tr>`;
 }).join('');
 const entered=accounts.filter(row=>findBill(data,row.id,state.month)).length,total=data.cards.filter(row=>row.cardAccountId&&row.dueDate.slice(0,7)===state.month).reduce((n,row)=>n+row.amount,0);
 return `<section class="panel card-billing-panel" id="card-billing" aria-label="내 카드 월별 청구 입력"><div class="panel-header"><div><h2>내 카드 · 월별 청구</h2><p>카드는 한 번만 등록하고, 매월 청구액을 입력하세요.</p></div><div class="card-billing-actions"><button type="button" class="button secondary small" data-action="card-accounts">카드 관리</button><button type="button" class="button primary small" data-action="card-account-add">＋ 카드 등록</button></div></div><div class="card-billing-toolbar"><label>결제 월<input type="month" data-card-billing-month value="${state.month}" min="1900-01" max="2199-12" ${state.busy?'disabled':''}></label><span>${entered}/${accounts.length}개 카드 입력 · 저장된 청구액 ${money(total)}</span><button type="button" class="text-button" data-card-billing-reload ${state.busy?'disabled':''}>최신 내역 불러오기</button></div>${accounts.length?`<div class="table-scroll"><table class="card-billing-table"><caption class="sr-only">결제 월별 카드 청구. 청구액을 입력하지 않은 달은 합계에 포함하지 않습니다.</caption><thead><tr><th>카드</th><th class="numeric">청구액 · 원</th><th>결제일</th><th>결제 상태</th><th>저장 상태</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="card-billing-empty">카드를 등록하면 매달 같은 카드 이름을 다시 입력하지 않아도 됩니다.<br>아래 기존 청구의 ‘내 카드로 등록’으로 연결할 수도 있습니다.</div>'}<div class="card-billing-save"><span data-card-bill-count role="status">${count?count+'건 수정 중 · 다른 월의 변경도 함께 저장':'미입력 월의 청구액은 자동으로 만들지 않습니다.'}</span><div><button type="button" class="button secondary small" data-card-billing-cancel ${!count||state.busy?'disabled':''}>변경 취소</button><button type="button" class="button primary small" data-card-billing-save ${!count||state.busy?'disabled':''}>${state.busy?'저장 중…':'변경 '+count+'건 저장'}</button></div></div><p class="form-error" data-card-bill-error role="alert">${esc(state.error)}</p><p class="card-billing-message" role="status">${esc(state.message)}</p><p class="panel-note">기본 결제일이 없는 달은 말일을 사용합니다. 월별 청구는 아래 청구 내역·예산·달력에 함께 반영되며 결제 완료 처리가 예금 잔액을 자동으로 바꾸지는 않습니다.</p></section>`;
}
export function renderCardAccounts(data){return `<div class="card-account-manager"><p>카드 기본 정보만 관리합니다. 보관해도 월별 청구 기록은 남습니다.</p>${(data.cardAccounts||[]).map(row=>`<div class="card-account-row"><span><strong>${esc(row.name)}</strong><small>기본 ${row.day}일${row.archived?' · 보관 중':''}</small></span><button type="button" class="button secondary small" data-action="card-account-edit" data-id="${esc(row.id)}">수정</button><button type="button" class="button secondary small" data-action="card-account-archive" data-id="${esc(row.id)}">${row.archived?'복원':'보관'}</button></div>`).join('')||'<p>등록한 카드가 없습니다.</p>'}<button type="button" class="button primary" data-action="card-account-add">＋ 카드 등록</button></div>`;}
export function mountCardBilling(root,getData,state,options){
 const update=()=>{const count=state.drafts.size;root.querySelector('[data-card-bill-count]').textContent=count?count+'건 수정 중 · 다른 월의 변경도 함께 저장':'미입력 월의 청구액은 자동으로 만들지 않습니다.';const button=root.querySelector('[data-card-billing-save]');button.textContent='변경 '+count+'건 저장';button.disabled=!count||state.busy;root.querySelector('[data-card-billing-cancel]').disabled=!count||state.busy;root.querySelector('[data-card-bill-error]').textContent=state.error;root.querySelector('.card-billing-message').textContent=state.message;};
 const input=event=>{
  const t=event.target;if(!t.matches('[data-card-bill-field]')||state.busy)return;
  try{stageCardBill(state,getData(),t.dataset.cardAccount,t.dataset.cardBillField,t.value);const dirty=state.drafts.has(keyFor(state.month,t.dataset.cardAccount));t.closest('tr').classList.toggle('is-changed',dirty);t.closest('tr').querySelector('[data-card-bill-status]').textContent=dirty?'수정 중':findBill(getData(),t.dataset.cardAccount,state.month)?'저장됨':'미입력';t.closest('tr').querySelector('[data-card-bill-undo]').hidden=!dirty;}catch(error){state.error=error.message;}update();
 };
 const change=event=>{if(state.busy)return;const t=event.target;if(t.matches('[data-card-billing-month]')){if(!validMonth(t.value)){state.error='결제 월을 확인해 주세요.';update();return;}state.month=t.value;options.onRender();}else input(event);};
 const click=async event=>{
  if(state.busy)return;const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-card-billing-reload')){await options.onReload();return;}
  if(b.hasAttribute('data-card-billing-cancel')){state.drafts.clear();state.error='';state.message='';options.onRender();return;}
  if(b.dataset.cardBillUndo){state.drafts.delete(b.dataset.cardBillUndo);state.error='';options.onRender();return;}
  if(!b.hasAttribute('data-card-billing-save')||!state.drafts.size)return;
  const count=state.drafts.size;state.busy=true;state.error='';options.onRender();
  try{await options.onSave(applyCardBills(getData(),state));state.drafts.clear();state.message=count+'건의 청구를 저장했습니다.';options.onFeedback(state.message);}catch(error){state.error=error.message;}finally{state.busy=false;options.onRender();}
 };
 for(const [event,fn]of Object.entries({input,change,click}))root.addEventListener(event,fn);return ()=>{for(const [event,fn]of Object.entries({input,change,click}))root.removeEventListener(event,fn);};
}

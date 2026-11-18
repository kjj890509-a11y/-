import {renderFinanceIcon} from './finance-icons.mjs';
import {mountRecordLayout,layoutRowHandle,layoutToolbar,orderLayoutRows,freshRecordLayout} from './record-layout.mjs';
import {validatePortfolio,validMonth,validDate,paymentDate,todayKST} from './domain.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=new Intl.NumberFormat('ko-KR');
export const createCardBillingState=()=>({month:todayKST().slice(0,7),drafts:new Map(),selected:new Set(),bulkField:'paymentMonth',bulkValue:'',busy:false,error:'',message:''});
const billMonth=row=>row.billingMonth??row.dueDate.slice(0,7);
const findBill=(data,accountId,month)=>data.cards.find(row=>row.cardAccountId===accountId&&billMonth(row)===month);
const keyFor=(month,id)=>month+':'+id;
const visibleAccounts=(data,state)=>(data.cardAccounts||[]).filter(row=>!row.archived||findBill(data,row.id,state.month));
const selectableAccounts=(data,state)=>visibleAccounts(data,state).filter(row=>!state.drafts.get(keyFor(state.month,row.id))?.deleted);
const selectedAccounts=(data,state)=>selectableAccounts(data,state).filter(row=>state.selected.has(row.id));
const billValues=(data,state,account)=>{const bill=findBill(data,account.id,state.month),draft=state.drafts.get(keyFor(state.month,account.id));return {...(bill||draft?.base||draft?.defaults||{amount:'',dueDate:paymentDate(state.month,account.day),paid:false}),...draft?.changes};};
const draftSummary=state=>{const count=state.drafts.size,deleted=[...state.drafts.values()].filter(row=>row.deleted).length;return count?count+'건 변경 중'+(deleted?' · 삭제 '+deleted+'건 포함':'')+' · 다른 월의 변경도 함께 저장':'미입력 월의 청구액은 자동으로 만들지 않습니다.';};
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
 if(draft.deleted)throw new Error('삭제를 되돌린 뒤 청구를 수정해 주세요.');
 const previous=draft.base?.[field]??draft.defaults[field];let same=false;try{same=Object.is(parse(field,value),previous);}catch{same=value===previous;}
 if(same)delete draft.changes[field];else draft.changes[field]=value;
 if(Object.keys(draft.changes).length)state.drafts.set(identity,draft);else state.drafts.delete(identity);state.error='';state.message='';
}
export function stageCardBillDeletion(state,data,accountId){
 if(!validMonth(state.month)||!data.cardAccounts?.some(row=>row.id===accountId))throw new Error('삭제할 카드 청구를 확인해 주세요.');
 const identity=keyFor(state.month,accountId),bill=findBill(data,accountId,state.month);
 if(!bill){state.drafts.delete(identity);}else{const draft=state.drafts.get(identity)||{accountId,month:state.month,base:structuredClone(bill),changes:{}};state.drafts.set(identity,{...draft,deleted:true});}
 state.error='';state.message='';
}
export function stageSelectedCardBills(state,data,field,raw){
 const accounts=selectedAccounts(data,state);if(!accounts.length)throw new Error('수정할 카드를 선택해 주세요.');
 if(field==='paymentMonth'){if(!validMonth(raw))throw new Error('변경할 결제 월을 확인해 주세요.');}
 else if(field!=='delete')parse(field,raw);
 const pending={...state,drafts:new Map([...state.drafts].map(([key,draft])=>[key,structuredClone(draft)]))};
 for(const account of accounts){
  if(field==='delete'){stageCardBillDeletion(pending,data,account.id);continue;}
  const values=billValues(data,pending,account),target=field==='paymentMonth'?'dueDate':field;
  const value=field==='paymentMonth'?paymentDate(raw,validDate(values.dueDate)?Number(values.dueDate.slice(8,10)):account.day):raw;
  stageCardBill(pending,data,account.id,target,value);
 }
 state.drafts=pending.drafts;state.error='';state.message=accounts.length+'개 카드에 적용했습니다. 변경 저장을 눌러 반영하세요.';
 if(field==='delete')state.selected.clear();
 return accounts.length;
}
function billingSummary(data,state,money){
 const accounts=visibleAccounts(data,state);let entered=0,total=0,pending=false;
 for(const account of accounts){const draft=state.drafts.get(keyFor(state.month,account.id));pending||=Boolean(draft);if(draft?.deleted)continue;try{total+=parse('amount',billValues(data,state,account).amount);entered++;}catch{}}
 return entered+'/'+accounts.length+'개 카드 입력 · 청구액 합계 '+money(total)+(pending?' · 저장 전':'');
}
function bulkValueMarkup(state,hidden){
 const field=state.bulkField,value=esc(state.bulkValue);
 if(field==='amount'&&hidden)return '<span class="card-bill-bulk-hint">금액 표시를 켜면 청구액을 수정할 수 있습니다.</span>';
 if(field==='paid')return `<select data-card-bill-bulk-value aria-label="일괄 적용할 결제 상태"><option value="">상태 선택</option><option value="false" ${value==='false'?'selected':''}>결제 예정</option><option value="true" ${value==='true'?'selected':''}>결제 완료</option></select>`;
 return `<input data-card-bill-bulk-value aria-label="일괄 적용할 ${field==='paymentMonth'?'결제 월':field==='dueDate'?'결제일':'청구액'}" type="${field==='paymentMonth'?'month':field==='dueDate'?'date':'text'}" ${field==='amount'?'inputmode="numeric" placeholder="같은 청구액 · 원"':'min="1900-01'+(field==='dueDate'?'-01':'')+'" max="2199-12'+(field==='dueDate'?'-31':'')+'"'} value="${value}">`;
}
export function applyCardBills(data,state,{createId=()=>crypto.randomUUID()}={}){
 const next=structuredClone(data);
 for(const draft of state.drafts.values()){
  const account=next.cardAccounts?.find(row=>row.id===draft.accountId),current=findBill(next,draft.accountId,draft.month);
  if(!account)throw new Error('청구를 저장할 내 카드를 찾지 못했습니다.');
  if((draft.base?.id||null)!==(current?.id||null))throw new Error(account.name+': 청구 내역이 다른 곳에서 추가되거나 삭제됐습니다. 이 변경을 되돌린 뒤 다시 확인해 주세요.');
  if(draft.deleted){
   if(!current||[...new Set([...Object.keys(current),...Object.keys(draft.base)])].some(field=>!Object.is(current[field],draft.base[field])))throw new Error(account.name+': 삭제할 청구가 다른 곳에서 바뀌었습니다. 이 변경을 되돌린 뒤 다시 확인해 주세요.');
   next.cards=next.cards.filter(row=>row.id!==current.id);continue;
  }
  if(!current&&account.archived)throw new Error(account.name+': 보관한 카드를 복원한 뒤 청구를 등록해 주세요.');
  const values=current?{...current}:{id:createId(),name:account.name,...draft.defaults,note:'',cardAccountId:account.id};values.billingMonth=draft.month;
  for(const [field,raw]of Object.entries(draft.changes)){
   let value;try{value=parse(field,raw);}catch(error){throw new Error(account.name+': '+error.message);}
   if(current&&!Object.is(current[field],draft.base[field])&&!Object.is(current[field],value))throw new Error(account.name+': 같은 청구 값이 다른 곳에서 바뀌었습니다. 이 변경을 되돌린 뒤 다시 수정해 주세요.');values[field]=value;
  }
  if(values.amount==='')throw new Error(account.name+': 이번 달 청구액을 입력해 주세요.');
  if(current)next.cards[next.cards.findIndex(row=>row.id===current.id)]=values;else next.cards.push(values);
 }
 return validatePortfolio(next);
}
export function renderCardBilling(data,state,{money,hidden=false,layout}){
 state.layout=layout||state.layout||freshRecordLayout();
 const accounts=orderLayoutRows(visibleAccounts(data,state),state.layout,row=>'cardaccounts:'+row.id),count=state.drafts.size;
 const rows=accounts.map(account=>{
  const bill=findBill(data,account.id,state.month),draft=state.drafts.get(keyFor(state.month,account.id)),values={...(bill||draft?.base||draft?.defaults||{amount:'',dueDate:paymentDate(state.month,account.day),paid:false}),...draft?.changes};
  const attr=field=>`data-card-bill-field="${field}" data-card-account="${esc(account.id)}" aria-label="${esc(account.name+' · '+({amount:'청구액',dueDate:'결제일',paid:'결제 상태'})[field])}" ${state.busy||draft?.deleted?'disabled':''}`;
  return `<tr data-layout-row="cardaccounts:${esc(account.id)}" class="${draft?'is-changed':''} ${draft?.deleted?'is-deleted':''} ${state.selected.has(account.id)?'is-selected':''}"><td class="card-bill-selection"><input type="checkbox" data-card-bill-select="${esc(account.id)}" aria-label="${esc(account.name+' 선택')}" ${state.selected.has(account.id)?'checked':''} ${state.busy||draft?.deleted?'disabled':''}></td><th scope="row"><div class="finance-issuer-label">${renderFinanceIcon('cards',account.name)}<div><strong>${esc(account.name)}</strong><small>기본 ${account.day}일${account.archived?' · 보관한 카드':''}</small></div></div></th><td class="numeric">${hidden?'<span>••••••</span>':`<input type="text" inputmode="numeric" ${attr('amount')} value="${esc(typeof values.amount==='number'?won.format(values.amount):values.amount)}" placeholder="이번 달 청구액">`}</td><td><input type="date" ${attr('dueDate')} value="${esc(values.dueDate)}"></td><td><select ${attr('paid')}><option value="false" ${String(values.paid)==='false'?'selected':''}>결제 예정</option><option value="true" ${String(values.paid)==='true'?'selected':''}>결제 완료</option></select></td><td><div class="card-bill-row-status"><span data-card-bill-status="${esc(account.id)}">${draft?.deleted?'삭제 예정':draft?'수정 중':bill?'저장됨':'미입력'}</span><div class="card-bill-row-actions"><button type="button" class="text-button card-bill-delete" data-card-bill-delete="${esc(account.id)}" aria-label="${esc(account.name+' · '+(bill?'청구 삭제':'입력 지우기'))}" ${draft?.deleted?'hidden':''} ${state.busy||(!bill&&!draft)?'disabled':''}>${bill?'청구 삭제':'입력 지우기'}</button><button type="button" class="text-button" data-card-bill-undo="${esc(keyFor(state.month,account.id))}" ${draft?'':'hidden'} ${state.busy?'disabled':''}>되돌리기</button></div></div></td></tr>`;
 }).join('');
 const selected=selectedAccounts(data,state).length,bulkFields={paymentMonth:'결제 월 (일자 유지)',dueDate:'결제일',paid:'결제 상태',amount:'청구액'};
 return `<section class="panel card-billing-panel" id="card-billing" aria-label="내 카드 월별 청구 입력"><div class="panel-header"><div><h2>내 카드 · 월별 청구</h2></div><div class="card-billing-actions"><button type="button" class="button secondary small" data-action="card-accounts">카드 관리</button><button type="button" class="button primary small" data-action="card-account-add">＋ 카드 등록</button></div></div><div class="card-billing-toolbar"><label>청구 월<input type="month" data-card-billing-month value="${state.month}" min="1900-01" max="2199-12" ${state.busy?'disabled':''}></label><span data-card-billing-total role="status" aria-live="polite">${billingSummary(data,state,money)}</span><button type="button" class="text-button" data-card-billing-reload ${state.busy?'disabled':''}>최신 내역 불러오기</button></div>${accounts.length?`<div class="card-bill-bulk" aria-label="선택한 카드 일괄 수정"><span data-card-bill-selection-count role="status">${selected}개 선택</span><label><span class="sr-only">일괄 수정 항목</span><select data-card-bill-bulk-field>${Object.entries(bulkFields).map(([key,label])=>`<option value="${key}" ${state.bulkField===key?'selected':''}>${label}</option>`).join('')}</select></label>${bulkValueMarkup(state,hidden)}<button type="button" class="button secondary small" data-card-bill-bulk-apply>선택 항목에 적용</button><button type="button" class="text-button card-bill-delete" data-card-bill-bulk-delete>선택 청구 삭제·지우기</button><button type="button" class="text-button" data-card-bill-selection-clear>선택 해제</button><small>${state.bulkField==='paymentMonth'?'결제 월만 바꾸고 카드별 일자는 유지합니다. 없는 날짜는 말일을 사용합니다.':state.bulkField==='amount'?'선택한 모든 카드에 같은 금액을 적용합니다.':'선택한 카드에만 적용하며 저장 전 되돌릴 수 있습니다.'}</small></div><div class="table-scroll"><table class="card-billing-table"><caption class="sr-only">청구 월별 카드 청구. 결제일은 청구 월과 달라도 저장할 수 있습니다. 청구액을 입력하지 않은 달은 합계에 포함하지 않습니다.</caption><thead><tr><th class="card-bill-selection"><input type="checkbox" data-card-bill-select-all aria-label="현재 청구 월 카드 전체 선택"></th><th>카드</th><th class="numeric">청구액 · 원</th><th>결제일</th><th>결제 상태</th><th>저장 상태</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="card-billing-empty">카드를 등록하면 매달 같은 카드 이름을 다시 입력하지 않아도 됩니다.<br>아래 기존 청구의 ‘내 카드로 등록’으로 연결할 수도 있습니다.</div>'}<div class="card-billing-save"><span data-card-bill-count role="status">${draftSummary(state)}</span><div><button type="button" class="button secondary small" data-card-billing-cancel ${!count||state.busy?'disabled':''}>변경 취소</button><button type="button" class="button primary small" data-card-billing-save ${!count||state.busy?'disabled':''}>${state.busy?'저장 중…':'변경 '+count+'건 저장'}</button></div></div><p class="form-error" data-card-bill-error role="alert">${esc(state.error)}</p><p class="card-billing-message" role="status">${esc(state.message)}</p><p class="panel-note">청구 월은 내역을 묶는 기준이며, 결제일은 다른 달로 입력할 수 있습니다. 기본 결제일이 없는 달은 말일을 사용합니다. 예산·달력에는 실제 결제일로 반영되며 결제 완료 처리가 예금 잔액을 자동으로 바꾸지는 않습니다. 청구 삭제는 변경 저장 시 반영되며 카드와 다른 달의 청구는 유지됩니다.</p></section>`;
}
export function renderCardAccounts(data){return `<div class="card-account-manager"><p>카드 기본 정보만 관리합니다. 보관해도 월별 청구 기록은 남습니다.</p>${(data.cardAccounts||[]).map(row=>`<div class="card-account-row"><span><strong>${esc(row.name)}</strong><small>기본 ${row.day}일${row.archived?' · 보관 중':''}</small></span><button type="button" class="button secondary small" data-action="card-account-edit" data-id="${esc(row.id)}">수정</button><button type="button" class="button secondary small" data-action="card-account-archive" data-id="${esc(row.id)}">${row.archived?'복원':'보관'}</button></div>`).join('')||'<p>등록한 카드가 없습니다.</p>'}<button type="button" class="button primary" data-action="card-account-add">＋ 카드 등록</button></div>`;}
export function mountCardBilling(root,getData,state,options){
 root.dataset.recordLayout='card-billing';const toolbar=root.ownerDocument.createElement('div');toolbar.innerHTML=layoutToolbar();root.querySelector('.card-billing-toolbar').after(toolbar);
 const header=root.querySelector('thead tr'),keys=['name','amount','dueDate','paid','status'];if(header){[...header.children].slice(1).forEach((cell,index)=>cell.dataset.layoutColumn=keys[index]);const handle=root.ownerDocument.createElement('th');handle.className='record-drag-cell';handle.innerHTML='<span class="sr-only">행 이동</span>';header.prepend(handle);for(const row of root.querySelectorAll('tbody tr')){[...row.children].slice(1).forEach((cell,index)=>cell.dataset.layoutColumn=keys[index]);const cell=root.ownerDocument.createElement('td');cell.className='record-drag-cell';const account=getData().cardAccounts.find(account=>'cardaccounts:'+account.id===row.dataset.layoutRow);cell.innerHTML=layoutRowHandle(account?.name||'카드');row.prepend(cell);}}
 const layoutCleanup=mountRecordLayout(root,state.layout,{allKeys:()=>orderLayoutRows(getData().cardAccounts||[],state.layout,row=>'cardaccounts:'+row.id).map(row=>'cardaccounts:'+row.id),onChange:options.onRender,onSave:()=>options.onLayoutSave?options.onLayoutSave('card-billing',state.layout):Promise.reject(new Error('배치 저장에 연결하지 못했습니다.')),onFeedback:options.onFeedback,loadSortable:options.loadSortable,disabled:state.busy});
 const money=options.money||((value)=>won.format(value)+'원');
 const update=()=>{
  const data=getData(),count=state.drafts.size,selectable=selectableAccounts(data,state),selected=selectedAccounts(data,state).length;
  root.setAttribute('aria-busy',String(state.busy));for(const el of root.querySelectorAll('.record-row-handle,.record-column-handle,[data-layout-save]'))el.disabled=state.busy;
  root.querySelector('[data-card-bill-count]').textContent=draftSummary(state);
  root.querySelector('[data-card-billing-total]').textContent=billingSummary(data,state,money);
  const save=root.querySelector('[data-card-billing-save]');save.textContent=state.busy?'저장 중…':'변경 '+count+'건 저장';save.disabled=!count||state.busy;
  root.querySelector('[data-card-billing-cancel]').disabled=!count||state.busy;
  for(const el of root.querySelectorAll('[data-card-billing-month],[data-card-billing-reload]'))el.disabled=state.busy;
  root.querySelector('[data-card-bill-error]').textContent=state.error;root.querySelector('.card-billing-message').textContent=state.message;
  for(const el of root.querySelectorAll('[data-card-bill-field]'))el.disabled=state.busy||Boolean(state.drafts.get(keyFor(state.month,el.dataset.cardAccount))?.deleted);
  for(const el of root.querySelectorAll('[data-card-bill-select]')){
   el.checked=state.selected.has(el.dataset.cardBillSelect);el.disabled=state.busy||!selectable.some(row=>row.id===el.dataset.cardBillSelect);el.closest('tr').classList.toggle('is-selected',el.checked);
  }
  const all=root.querySelector('[data-card-bill-select-all]');if(all){all.checked=selected>0&&selected===selectable.length;all.indeterminate=selected>0&&selected<selectable.length;all.disabled=state.busy||!selectable.length;}
  const label=root.querySelector('[data-card-bill-selection-count]');if(label)label.textContent=selected+'개 선택';
  for(const el of root.querySelectorAll('[data-card-bill-bulk-field],[data-card-bill-bulk-value],[data-card-bill-bulk-apply],[data-card-bill-bulk-delete],[data-card-bill-selection-clear]'))el.disabled=state.busy||!selected||(el.hasAttribute('data-card-bill-bulk-apply')&&!root.querySelector('[data-card-bill-bulk-value]'));
  for(const el of root.querySelectorAll('[data-card-bill-undo]'))el.disabled=state.busy;
  for(const el of root.querySelectorAll('[data-card-bill-delete]'))el.disabled=state.busy||(!findBill(data,el.dataset.cardBillDelete,state.month)&&!state.drafts.has(keyFor(state.month,el.dataset.cardBillDelete)));
 };
 const input=event=>{
  const t=event.target;if(state.busy)return;
  if(t.matches('[data-card-bill-bulk-value]')){state.bulkValue=t.value;return;}
  if(!t.matches('[data-card-bill-field]'))return;
  try{
   stageCardBill(state,getData(),t.dataset.cardAccount,t.dataset.cardBillField,t.value);
   const row=t.closest('tr'),dirty=state.drafts.has(keyFor(state.month,t.dataset.cardAccount));row.classList.toggle('is-changed',dirty);row.querySelector('[data-card-bill-status]').textContent=dirty?'수정 중':findBill(getData(),t.dataset.cardAccount,state.month)?'저장됨':'미입력';row.querySelector('[data-card-bill-undo]').hidden=!dirty;
  }catch(error){state.error=error.message;}update();
 };
 const change=event=>{
  if(state.busy)return;const t=event.target;
  if(t.matches('[data-card-billing-month]')){if(!validMonth(t.value)){state.error='청구 월을 확인해 주세요.';update();return;}state.month=t.value;state.selected.clear();state.bulkValue='';state.error='';state.message='';options.onRender();}
  else if(t.matches('[data-card-bill-select]')){if(t.checked)state.selected.add(t.dataset.cardBillSelect);else state.selected.delete(t.dataset.cardBillSelect);update();}
  else if(t.matches('[data-card-bill-select-all]')){state.selected.clear();if(t.checked)for(const account of selectableAccounts(getData(),state))state.selected.add(account.id);update();}
  else if(t.matches('[data-card-bill-bulk-field]')){state.bulkField=t.value;state.bulkValue='';options.onRender();}
  else input(event);
 };
 const click=async event=>{
  if(state.busy)return;const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-card-billing-reload')){await options.onReload();return;}
  if(b.hasAttribute('data-card-bill-selection-clear')){state.selected.clear();update();return;}
  if(b.hasAttribute('data-card-bill-bulk-apply')||b.hasAttribute('data-card-bill-bulk-delete')){
   try{stageSelectedCardBills(state,getData(),b.hasAttribute('data-card-bill-bulk-delete')?'delete':state.bulkField,state.bulkValue);options.onRender();}catch(error){state.error=error.message;update();}return;
  }
  if(b.hasAttribute('data-card-billing-cancel')){state.drafts.clear();state.error='';state.message='';options.onRender();return;}
  if(b.dataset.cardBillUndo){state.drafts.delete(b.dataset.cardBillUndo);state.error='';state.message='';options.onRender();return;}
  if(b.dataset.cardBillDelete){try{stageCardBillDeletion(state,getData(),b.dataset.cardBillDelete);state.selected.delete(b.dataset.cardBillDelete);}catch(error){state.error=error.message;}options.onRender();return;}
  if(!b.hasAttribute('data-card-billing-save')||!state.drafts.size)return;
  const count=state.drafts.size,deleted=[...state.drafts.values()].filter(draft=>draft.deleted).length;state.busy=true;state.error='';state.message='';update();
  try{await options.onSave(applyCardBills(getData(),state));state.drafts.clear();state.message=count+'건의 변경을 저장했습니다.'+(deleted?' (청구 '+deleted+'건 삭제)':'');options.onFeedback(state.message);}catch(error){state.error=error.message;}finally{state.busy=false;options.onRender();}
 };
 for(const [event,fn]of Object.entries({input,change,click}))root.addEventListener(event,fn);update();
 return ()=>{layoutCleanup();for(const [event,fn]of Object.entries({input,change,click}))root.removeEventListener(event,fn);};
}

import {stageEntryField} from './entry-manager.mjs';

const won=new Intl.NumberFormat('ko-KR');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function recordAmountInput(state,entry,field,label) {
 const draft=state.drafts.get(entry.key),changed=Object.hasOwn(draft?.changes||{},field);
 const value=changed?draft.changes[field]:won.format(entry.row[field]??0);
 return `<label class="record-amount-control"><input type="text" class="record-amount-input" inputmode="numeric" autocomplete="off" maxlength="24" data-record-amount-field="${field}" aria-label="${escape(entry.row.name+' · '+label)}" value="${escape(value)}" ${state.busy?'disabled':''}><span aria-hidden="true">원</span></label>`;
}

export function recordAmountActions(state,key,hidden) {
 const dirty=state.drafts.has(key);
 return `<button type="button" class="button primary small" data-record-amount-save ${dirty&&!hidden?'':'hidden'} ${state.busy?'disabled':''}>이 행 저장</button><button type="button" class="text-button" data-record-amount-undo ${dirty?'':'hidden'} ${state.busy?'disabled':''}>되돌리기</button>`;
}

export function createRecordAmountEditing(root,state,{getData,isHidden,save,render,feedback}) {
 const rows=()=>[...root.querySelectorAll('[data-record-amount-row]')];
 const update=key=>{
  const draft=state.drafts.get(key);
  for(const row of rows().filter(row=>row.dataset.recordAmountRow===key)) {
   row.querySelector('[data-record-amount-save]').hidden=!draft||isHidden();
   row.querySelector('[data-record-amount-undo]').hidden=!draft;
  }
 };
 const focus=(key,field,position)=>{
  const matches=rows().filter(row=>row.dataset.recordAmountRow===key);
  const row=matches[position]||matches[0];
  row?.querySelector(field?`[data-record-amount-field="${field}"]`:'[data-record-amount-field], [data-ledger-action="edit"], [data-action="edit"]')?.focus();
 };
 const input=event=>{
  const field=event.target.dataset?.recordAmountField;
  if(!field||state.busy||isHidden())return;
  const key=event.target.closest('[data-record-amount-row]').dataset.recordAmountRow;
  const [kind,id]=key.split(':');
  try {
   const draft=stageEntryField(state,getData(),kind,id,field,event.target.value);
   for(const row of rows().filter(row=>row.dataset.recordAmountRow===key)) {
    const other=row.querySelector(`[data-record-amount-field="${field}"]`);
    if(other&&other!==event.target)other.value=draft.changes[field]??won.format(draft.base[field]??0);
   }
   update(key);
  } catch(error) {feedback(error.message);}
 };
 const saveRow=async(row,field)=>{
  const key=row.dataset.recordAmountRow;
  if(!state.drafts.has(key)||state.busy||isHidden())return;
  const position=rows().filter(item=>item.dataset.recordAmountRow===key).indexOf(row);
  state.busy=true;
  for(const control of root.querySelectorAll('[data-record-amount-field], [data-record-amount-save], [data-record-amount-undo]'))control.disabled=true;
  try {
   await save(key);
   state.drafts.delete(key);
   feedback('금액을 저장했어요.');
  } catch(error) {feedback(error.message);}
  finally {
   state.busy=false;
   render();
   focus(key,field,position);
  }
 };
 const click=event=>{
  const button=event.target;
  if(!button.hasAttribute?.('data-record-amount-save')&&!button.hasAttribute?.('data-record-amount-undo'))return false;
  if(button.disabled||state.busy)return true;
  const row=button.closest('[data-record-amount-row]'),key=row.dataset.recordAmountRow;
  if(button.hasAttribute('data-record-amount-save'))saveRow(row);
  else {
   const position=rows().filter(item=>item.dataset.recordAmountRow===key).indexOf(row);
   state.drafts.delete(key);
   render();
   focus(key,undefined,position);
  }
  return true;
 };
 const keydown=event=>{
  const field=event.target.dataset?.recordAmountField;
  if(!field||event.key!=='Enter'||event.isComposing)return;
  event.preventDefault();
  return saveRow(event.target.closest('[data-record-amount-row]'),field);
 };
 return {input,click,keydown};
}

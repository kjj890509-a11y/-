import {mergeLayoutOrder} from './record-layout-model.mjs';
export {recordLayoutSpecs,entryLayoutColumns,layoutScope,freshRecordLayout,orderLayoutRows} from './record-layout-model.mjs';
export const layoutDots='<span class="drag-nine-dots" aria-hidden="true">'+Array.from({length:9},()=>'<i></i>').join('')+'</span>';
export const layoutRowHandle=label=>`<button type="button" class="record-row-handle" aria-label="${String(label).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')} 순서 이동. 위아래 방향키 지원" title="드래그로 이동 · 위아래 방향키 지원">${layoutDots}</button>`;
export const layoutToolbar=()=>'<div class="record-layout-toolbar"><span data-layout-message role="status"></span><button type="button" class="button secondary small" data-layout-save>행·열 배치 저장</button></div>';
export function mountRecordLayout(root,state,{allKeys,onChange,onSave,onFeedback=()=>{},loadSortable=()=>import('/sortable.mjs'),disabled=false,saveOnlyWhenDirty=false}){
 let active=true,sortables=[],saving=false;const rows=()=>[...root.querySelectorAll('[data-layout-row]')],visible=rows().map(row=>row.dataset.layoutRow);
 const message=root.querySelector('[data-layout-message]'),save=root.querySelector('[data-layout-save]');
 const applyColumns=()=>{
  const headers=[...root.querySelectorAll('thead th[data-layout-column]')],keys=headers.map(el=>el.dataset.layoutColumn),order=[...state.columns.filter(key=>keys.includes(key)),...keys.filter(key=>!state.columns.includes(key))];
  for(const row of root.querySelectorAll('tr')){const cells=[...row.children].filter(el=>el.hasAttribute('data-layout-column'));if(!cells.length)continue;const anchor=cells.at(-1).nextElementSibling;for(const key of order){const cell=cells.find(el=>el.dataset.layoutColumn===key);if(cell)row.insertBefore(cell,anchor);}}
 };
 applyColumns();
 for(const th of root.querySelectorAll('thead th[data-layout-column]')){
  const label=th.textContent.trim(),content=root.ownerDocument.createElement('div');
  content.className='record-layout-heading';
  content.innerHTML=`<button type="button" class="record-column-handle" aria-label="${label.replaceAll('&','&amp;').replaceAll('"','&quot;')} 열 이동. 좌우 방향키 지원">${layoutDots}</button>`;
  if(th.childElementCount)content.append(...th.childNodes);
  else{
   const text=root.ownerDocument.createElement('span');
   text.textContent=label;
   content.append(text);
  }
  th.replaceChildren(content);
 }
 for(const handle of root.querySelectorAll('.record-row-handle,.record-column-handle'))handle.disabled=disabled;
 const saveUnavailable=()=>disabled||(saveOnlyWhenDirty&&!state.rowOrderDirty);
 const saveLabel=save?.textContent;
 if(save)save.disabled=saveUnavailable();
 const fail=error=>{if(message)message.textContent=error;onFeedback(error);};
 const reorder=(keys,focusKey)=>{try{state.rowOrder=mergeLayoutOrder(allKeys(),rows().map(row=>row.dataset.layoutRow),keys);state.rowOrderDirty=true;onChange('rows');if(focusKey)(root.ownerDocument.querySelector(`[data-record-layout="${root.dataset.recordLayout}"]`)||root).querySelector(`[data-layout-row="${focusKey}"] .record-row-handle`)?.focus();}catch(error){fail(error.message);}};
 const columns=focusKey=>{state.columns=[...root.querySelectorAll('thead th[data-layout-column]')].map(el=>el.dataset.layoutColumn);state.rowOrderDirty=true;onChange('columns');if(focusKey)(root.ownerDocument.querySelector(`[data-record-layout="${root.dataset.recordLayout}"]`)||root).querySelector(`th[data-layout-column="${focusKey}"] .record-column-handle`)?.focus();};
 const click=async event=>{if(!event.target.closest('[data-layout-save]')||saving||saveUnavailable())return;saving=true;save.disabled=true;for(const sortable of sortables)sortable.option?.('disabled',true);save.textContent='저장 중…';try{await onSave(state);state.rowOrderDirty=false;if(message)message.textContent='행·열 배치를 저장했습니다.';}catch(error){fail(error.message);}finally{saving=false;if(active){save.disabled=saveUnavailable();for(const sortable of sortables)sortable.option?.('disabled',false);save.textContent=saveLabel;}}};
 const keydown=event=>{
  const rowHandle=event.target.closest('.record-row-handle'),columnHandle=event.target.closest('.record-column-handle');if(disabled||saving)return;
  if(rowHandle&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const keys=rows().map(row=>row.dataset.layoutRow),id=rowHandle.closest('[data-layout-row]').dataset.layoutRow,index=keys.indexOf(id),next=index+(event.key==='ArrowUp'?-1:1);if(next<0||next>=keys.length)return;[keys[index],keys[next]]=[keys[next],keys[index]];reorder(keys,id);return;}
  if(columnHandle&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const th=columnHandle.closest('th'),headers=[...th.parentElement.querySelectorAll('th[data-layout-column]')],index=headers.indexOf(th),next=index+(event.key==='ArrowLeft'?-1:1);if(next<0||next>=headers.length)return;th.parentElement.insertBefore(th,event.key==='ArrowLeft'?headers[next]:headers[next].nextElementSibling);columns(th.dataset.layoutColumn);}
 };
 root.addEventListener('click',click);root.addEventListener('keydown',keydown);
 if(state.rowOrderDirty&&message)message.textContent='배치 변경됨 · 배치 저장으로 유지합니다.';
 if(!disabled)loadSortable().then(({default:Sortable})=>{
  if(!active)return;const body=root.querySelector('[data-layout-list]')||root.querySelector('tbody');
  if(body)sortables.push(Sortable.create(body,{filter:'.record-row-handle:disabled',handle:'.record-row-handle',draggable:'[data-layout-row]',animation:150,delay:130,delayOnTouchOnly:true,touchStartThreshold:4,ghostClass:'ledger-row-ghost',onEnd:()=>{if(active&&!saving)reorder(rows().map(row=>row.dataset.layoutRow));}}));
  const head=root.querySelector('thead tr');if(head)sortables.push(Sortable.create(head,{handle:'.record-column-handle',draggable:'th[data-layout-column]',animation:150,onEnd:()=>{if(active&&!saving)columns();}}));
 }).catch(()=>{if(active)fail('드래그 연결 실패 · 점 9개에서 방향키로 이동할 수 있습니다.');});
 return ()=>{
  if(!active)return;
  active=false;
  for(const sortable of sortables)sortable.destroy();
  root.removeEventListener('click',click);
  root.removeEventListener('keydown',keydown);
 };
}

import {defaultLedgerState,ledgerColumns,ledgerLabels,ledgerStatus,statusLabels,ledgerQuery,ledgerPage,ledgerLayout,reorderLedgerRows} from './ledger-model.mjs';
import {amountKeys} from './entry-manager.mjs';
import {recordAmountActions,recordAmountInput} from './record-amount.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,label,current)=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(label)}</option>`;
export function createLedgerWorkspace(){return {states:{},preferences:{version:1,tables:{}},revision:0,loaded:false,error:'',saving:false};}
export function ledgerState(workspace,scope){if(!workspace.states[scope]){const preferences=structuredClone(workspace.preferences.tables[scope]||{});workspace.states[scope]={...defaultLedgerState(),...preferences,sort:preferences.rowOrder?.length?'manual':scope==='all'?'date:desc':'newest'};}return workspace.states[scope];}
export function ledgerPreference(state){return Object.fromEntries(['columns','hidden','widths','pageSize','density','savedViews','rowOrder'].map(key=>[key,structuredClone(state[key])]));}
const filterKeys=['query','category','status','institution','type','repeat','start','end','min','max','sort'];
export const dragHandleDots='<span class="drag-nine-dots" aria-hidden="true">'+Array.from({length:9},()=>'<i></i>').join('')+'</span>';
const numericColumns=new Set(['amount','balance','rate','principal','interest','payment','cost','valuation','profit','monthlyContribution']);
const chip=(action,value,label,selected)=>`<button type="button" class="ledger-chip ${selected?'active':''}" data-ledger-action="${action}" data-value="${esc(value)}" aria-pressed="${selected}">${esc(label)}</button>`;
export function renderLedger(entries,state,{scope,money,cell,today,amountState,hidden=false,extraActions=()=>''}){
 const results=ledgerQuery(entries,state,today),page=ledgerPage(results,state);state.page=page.page;
 const defs=ledgerColumns[scope],keys=ledgerLayout(scope,state),statuses=[...new Set(entries.map(entry=>ledgerStatus(entry,today)))];
 const selected=new Set(state.selected),institutions=[...new Set(entries.map(entry=>entry.row.institution||'미등록'))].sort((a,b)=>a.localeCompare(b,'ko'));
 const selectedVisible=page.rows.filter(entry=>selected.has(entry.key)).length;
 const activeFilters=filterKeys.filter(key=>!['sort','status'].includes(key)&&state[key]&&state[key]!=='all').length;
 const label=key=>defs.find(([k])=>k===key)?.[1]||key;
 const displayCell=(entry,key)=>{
  const content=cell(entry,key);
  if(key==='name')return `<button type="button" class="ledger-open" data-ledger-action="detail" data-id="${esc(entry.key)}">${content}</button>`;
  const primary=amountKeys[entry.kind];
  const field=key==='amount'&&scope==='all'?primary:key;
  if(!amountState||hidden||!(field===primary||entry.kind==='stocks'&&field==='cost'||entry.kind==='retirement'&&field==='monthlyContribution'))return content;
  const note=content.indexOf('<small');
  return recordAmountInput(amountState,entry,field,label(key))+(note<0?'':content.slice(note));
 };
 const rowActions=entry=>`${amountState?recordAmountActions(amountState,entry.key,hidden):''}<button type="button" class="button secondary small" data-ledger-action="edit" data-id="${esc(entry.key)}">상세 수정</button>${keys.includes('name')?'':`<button type="button" class="button secondary small" data-ledger-action="detail" data-id="${esc(entry.key)}">상세 보기</button>`}${extraActions(entry)}`;
 const order=[...state.columns.filter(key=>defs.some(([k])=>k===key)),...defs.map(([k])=>k).filter(key=>!state.columns.includes(key))];
 return `<div class="ledger-views" role="group" aria-label="저장한 보기"><button type="button" class="ledger-view ${!state.activeView?'active':''}" data-ledger-action="default-view" aria-pressed="${!state.activeView}">전체 보기</button>${state.savedViews.map(view=>`<span class="ledger-view-pair"><button type="button" class="ledger-view ${state.activeView===view.id?'active':''}" data-ledger-action="load-view" data-id="${esc(view.id)}" aria-pressed="${state.activeView===view.id}">${esc(view.name)}</button><button type="button" class="ledger-view-delete" data-ledger-action="delete-view" data-id="${esc(view.id)}" aria-label="${esc(view.name)} 보기 삭제" title="${esc(view.name)} 보기 삭제">×</button></span>`).join('')}<button type="button" class="ledger-view" data-ledger-action="save-dialog">＋ 보기 저장</button></div>
 <div class="ledger-statuses" role="group" aria-label="내역 상태">${chip('status','all',`전체 ${entries.length}`,state.status==='all')}${statuses.map(status=>chip('status',status,`${statusLabels[status]} ${entries.filter(entry=>ledgerStatus(entry,today)===status).length}`,state.status===status)).join('')}</div>
 <div class="ledger-toolbar"><input id="record-search" data-ledger-field="query" maxlength="200" class="search-input" type="search" value="${esc(state.query)}" placeholder="이름·금융기관·메모 검색" aria-label="내역 검색"><select data-ledger-field="sort" aria-label="내역 정렬">${[['manual','직접 정한 순서'],['newest','최근 등록순'],['oldest','등록 오래된순'],['date:desc','날짜 최신순'],['date:asc','날짜 오래된순'],['amount:desc','금액 높은순'],['amount:asc','금액 낮은순'],['name:asc','이름 가나다순']].map(([v,n])=>option(v,n,state.sort)).join('')}${!['manual','newest','oldest','date:desc','date:asc','amount:desc','amount:asc','name:asc'].includes(state.sort)?option(state.sort,label(state.sort.split(':')[0])+' 순',state.sort):''}</select><button class="button secondary small" data-ledger-action="filters">필터${activeFilters?' · '+activeFilters:''}</button><button class="button secondary small" data-ledger-action="columns">열 설정</button><button class="button secondary small" data-ledger-action="export" data-table-export>CSV 다운로드</button><button class="button secondary small" data-ledger-action="persist">배치 저장</button><button class="button secondary small" data-ledger-action="reset">초기화</button></div>
 ${state.selected.length?`<div class="ledger-bulk" role="status"><strong>${state.selected.length}개 선택</strong><button class="button secondary small" data-ledger-action="bulk-export">선택 내보내기</button>${scope==='cards'?'<button class="button secondary small" data-ledger-action="bulk-paid">결제 완료</button><button class="button secondary small" data-ledger-action="bulk-unpaid">미결제로 변경</button>':''}${['cashflow','planned'].includes(scope)?'<button class="button secondary small" data-ledger-action="bulk-include">예상에 반영</button><button class="button secondary small" data-ledger-action="bulk-exclude">예상 제외</button>':''}${entries.filter(entry=>state.selected.includes(entry.key)).every(entry=>entry.kind==='fixed'||entry.kind==='cashflow'&&entry.row.type==='expense')?'<button class="button secondary small" data-ledger-action="bulk-card-included">카드 청구액에 포함 · 중복 제외</button><button class="button secondary small" data-ledger-action="bulk-account-paid">계좌 결제 · 별도 지출</button>':''}<button class="button danger small" data-ledger-action="bulk-delete">선택 삭제</button><button class="text-button" data-ledger-action="unselect">선택 해제</button></div>`:''}
 <p class="ledger-result" role="status">${state.sort==='manual'?'직접 정한 순서 · ':''}${state.rowOrderDirty?'순서 변경됨 · ':''}${results.length}건 조회 · 전체 ${entries.length}건</p>
 <div class="table-scroll ledger-scroll"><table class="ledger-table ${state.density==='compact'?'compact':''}"><caption class="sr-only">${ledgerLabels[scope]} 조회 내역</caption><thead><tr><th class="ledger-drag-cell"><span class="sr-only">행 순서 이동</span></th><th class="ledger-select"><input type="checkbox" data-ledger-select-page aria-label="이 페이지 전체 선택" ${page.rows.length&&selectedVisible===page.rows.length?'checked':''}></th>${keys.map(key=>`<th data-column="${key}" class="${numericColumns.has(key)?'numeric':''}" style="width:${state.widths[key]||160}px;min-width:${state.widths[key]||160}px" aria-sort="${state.sort===key+':asc'?'ascending':state.sort===key+':desc'?'descending':'none'}"><div class="ledger-header-content"><button type="button" class="ledger-header-handle" aria-label="${esc(label(key))} 열 이동. 좌우 방향키 지원">${dragHandleDots}</button><button class="ledger-sort" data-ledger-action="sort-column" data-value="${key}"><span class="ledger-sort-label">${esc(label(key))}</span>${state.sort.startsWith(key+':')?`<span class="ledger-sort-indicator" aria-hidden="true">${state.sort.endsWith('desc')?'↓':'↑'}</span>`:''}</button></div><span class="ledger-resize" data-resize="${key}" role="separator" tabindex="0" aria-label="${esc(label(key))} 열 너비. 좌우 방향키로 조절" aria-orientation="vertical" aria-valuemin="90" aria-valuemax="600" aria-valuenow="${state.widths[key]||160}"></span></th>`).join('')}<th class="ledger-actions-cell">관리</th></tr></thead><tbody id="records-body">${page.rows.map(entry=>`<tr data-entry-key="${esc(entry.key)}"${amountState?` data-record-amount-row="${esc(entry.key)}"`: ''} class="${selected.has(entry.key)?'is-selected':''}"><td class="ledger-drag-cell"><button type="button" class="ledger-row-handle" aria-label="${esc(entry.row.name)} 순서 이동. 위아래 방향키로 이동" title="드래그로 이동 · 위아래 방향키 지원">${dragHandleDots}</button></td><td class="ledger-select"><input type="checkbox" data-ledger-select="${esc(entry.key)}" aria-label="${esc(entry.row.name)} 선택" ${selected.has(entry.key)?'checked':''}></td>${keys.map(key=>`<td data-column="${key}" class="${numericColumns.has(key)?'numeric':''}">${displayCell(entry,key)}</td>`).join('')}<td class="ledger-actions-cell"><div class="ledger-actions">${rowActions(entry)}</div></td></tr>`).join('')||`<tr><td colspan="${keys.length+3}"><div class="empty-inline">조건에 맞는 내역이 없습니다.<button class="button secondary" data-ledger-action="reset">필터 초기화</button></div></td></tr>`}</tbody></table></div>
 <div class="ledger-pagination"><span>${results.length?(page.page-1)*state.pageSize+1:0}–${Math.min(page.page*state.pageSize,results.length)} / ${results.length}건</span><label>페이지당 <select data-ledger-field="pageSize">${[20,50,100].map(n=>option(n,n+'개',state.pageSize)).join('')}</select></label><button class="button secondary small" data-ledger-action="prev" ${page.page<=1?'disabled':''}>이전</button><span>${page.page} / ${page.pages}</span><button class="button secondary small" data-ledger-action="next" ${page.page>=page.pages?'disabled':''}>다음</button></div>
 ${state.error?`<p class="form-error" role="alert">${esc(state.error)}</p>`:''}
 <dialog class="ledger-dialog" data-ledger-dialog="filters"><div class="dialog-heading"><h2>필터</h2><button class="icon-button" data-ledger-action="close" aria-label="닫기">✕</button></div><form data-ledger-filter-form><div class="form-grid"><label>카테고리<select name="category">${option('all','전체',state.category)}${[...new Set(entries.map(e=>e.kind))].map(kind=>option(kind,ledgerLabels[kind],state.category)).join('')}</select></label><label>금융기관<select name="institution">${option('','모든 기관',state.institution)}${institutions.map(v=>option(v,v,state.institution)).join('')}</select></label><label>구분<select name="type">${option('','전체',state.type)}${[...new Set(entries.map(e=>e.row.type||e.row.paymentSource||e.row.method).filter(Boolean))].map(v=>option(v,({salary:'월급',other_income:'기타 수입',expense:'기타 지출',account:'계좌 결제',card:'카드 청구액에 포함 · 중복 제외'})[v]||v,state.type)).join('')}</select></label><label>반복<select name="repeat">${option('','전체',state.repeat)}${option('once','일회성',state.repeat)}${option('monthly','매월',state.repeat)}</select></label><label>시작일<input type="date" name="start" value="${state.start}"></label><label>종료일<input type="date" name="end" value="${state.end}"></label><label>최소 금액 · 원<input inputmode="numeric" name="min" value="${esc(state.min)}"></label><label>최대 금액 · 원<input inputmode="numeric" name="max" value="${esc(state.max)}"></label></div><p class="form-error" data-filter-error role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-ledger-action="close">취소</button><button class="button primary" type="submit">필터 적용</button></div></form></dialog>
 <dialog class="ledger-dialog" data-ledger-dialog="columns"><div class="dialog-heading"><h2>열 설정</h2><button class="icon-button" data-ledger-action="close" aria-label="닫기">✕</button></div><p>⠿를 드래그하거나 위아래 버튼으로 순서를 바꾸세요.</p><div data-ledger-column-list>${order.map((key,index)=>`<div class="ledger-column-option" data-column-id="${key}"><button type="button" class="ledger-column-handle" aria-label="${esc(label(key))} 열 이동">${dragHandleDots}</button><label><input type="checkbox" data-ledger-column="${key}" ${!state.hidden.includes(key)?'checked':''}> ${esc(label(key))}</label><button class="icon-button" data-ledger-action="column-up" data-value="${key}" ${index===0?'disabled':''} aria-label="${esc(label(key))} 열 위로">↑</button><button class="icon-button" data-ledger-action="column-down" data-value="${key}" ${index===order.length-1?'disabled':''} aria-label="${esc(label(key))} 열 아래로">↓</button></div>`).join('')}</div><label>행 간격<select data-ledger-field="density">${option('comfortable','보통',state.density)}${option('compact','좁게',state.density)}</select></label><div class="dialog-actions"><button class="button primary" data-ledger-action="persist">열·보기 설정 저장</button></div></dialog>
 <dialog class="ledger-dialog" data-ledger-dialog="save"><div class="dialog-heading"><h2>보기 저장</h2><button class="icon-button" data-ledger-action="close" aria-label="닫기">✕</button></div><form data-ledger-save-form><label>보기 이름<input name="viewName" maxlength="60" required placeholder="예: 이번 달 미결제 카드"></label><p>현재 필터·정렬과 열 배치를 계정에 저장합니다.</p><div class="dialog-actions">${state.activeView?'<button type="button" class="button danger" data-ledger-action="delete-view">이 보기 삭제</button>':''}<button class="button primary" type="submit">저장</button></div></form></dialog>`;
}
const ledgerMounted=new WeakMap();
export function unmountLedger(root){const old=ledgerMounted.get(root);if(old){old.active=false;old.sortable?.destroy();old.headerSortable?.destroy();old.rowSortable?.destroy();old.cleanup?.();old.resizeCleanup?.();ledgerMounted.delete(root);}}
export function mountLedger(root,entries,state,options){
 unmountLedger(root);const life={active:true,sortable:null};ledgerMounted.set(root,life);
 const {onEdit,onBulk,onExport,onSave,onDetail,onFeedback=()=>{},loadSortable=()=>import('/sortable.mjs')}=options;
 let open='';
 const draw=(focus)=>{
  life.sortable?.destroy();life.headerSortable?.destroy();life.rowSortable?.destroy();life.sortable=null;const generation=life.generation=(life.generation||0)+1;
  root.innerHTML=renderLedger(entries,state,options);
  if(open){const dialog=root.querySelector(`[data-ledger-dialog="${open}"]`);if(dialog){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}}
  if(focus){const field=root.querySelector(`[data-ledger-field="${focus}"]`);field?.focus();if(field?.type==='search')field.setSelectionRange?.(field.value.length,field.value.length);}
  loadSortable().then(({default:Sortable})=>{
   if(!life.active||life.generation!==generation)return;
   life.headerSortable=Sortable.create(root.querySelector('.ledger-table thead tr'),{handle:'.ledger-header-handle',draggable:'th[data-column]',animation:150,onEnd:()=>{const visible=[...root.querySelectorAll('.ledger-table th[data-column]')].map(node=>node.dataset.column);state.columns=[...visible,...state.columns.filter(key=>!visible.includes(key))];state.rowOrderDirty=true;draw();}});
   life.rowSortable=Sortable.create(root.querySelector('.ledger-table tbody'),{handle:'.ledger-row-handle',draggable:'tr[data-entry-key]',animation:150,delay:130,delayOnTouchOnly:true,touchStartThreshold:4,ghostClass:'ledger-row-ghost',chosenClass:'ledger-row-chosen',setData:transfer=>transfer.setData('text/plain',''),onEnd:()=>{if(!life.active||life.generation!==generation)return;applyRowOrder([...root.querySelectorAll('.ledger-table tbody tr[data-entry-key]')].map(node=>node.dataset.entryKey));}});
   if(open==='columns')life.sortable=Sortable.create(root.querySelector('[data-ledger-column-list]'),{handle:'.ledger-column-handle',draggable:'[data-column-id]',animation:150,onEnd:()=>{state.columns=[...root.querySelectorAll('[data-column-id]')].map(node=>node.dataset.columnId);draw();}});
  }).catch(()=>{if(life.active&&life.generation===generation)onFeedback('드래그 연결 실패 · 행은 위아래, 열 설정은 위아래 버튼으로 이동할 수 있습니다.');});
 };
 const find=key=>entries.find(entry=>entry.key===key);
 const applyRowOrder=(keys,focusKey)=>{
  try{state.rowOrder=reorderLedgerRows(entries,state,keys,options.today);state.sort='manual';state.rowOrderDirty=true;state.error='';draw();if(focusKey)root.querySelector(`[data-entry-key="${focusKey}"] .ledger-row-handle`)?.focus();onFeedback('행 순서를 바꿨어요. 배치 저장을 누르면 다음에도 유지됩니다.');}
  catch(error){state.error=error.message;draw();}
 };
 const save=async()=>{if(life.saving)return;life.saving=true;state.error='';try{await onSave(ledgerPreference(state));state.rowOrderDirty=false;onFeedback('행·열 배치와 보기를 계정에 저장했어요.');open='';draw();}catch(error){state.error=error.message;open='';draw();}finally{life.saving=false;}};
 const click=async event=>{
  const target=event.target.closest('[data-ledger-action]');if(!target||target.disabled)return;event.preventDefault();
  const {ledgerAction:action,value,id}=target.dataset;
  if(['filters','columns','save-dialog'].includes(action)){open=action==='save-dialog'?'save':action;draw();return;}
  if(action==='close'){open='';draw();return;}
  if(action==='status'){state.status=value;state.page=1;state.selected=[];draw();return;}
  if(action==='reset'||action==='default-view'){Object.assign(state,Object.fromEntries(filterKeys.map(key=>[key,defaultLedgerState()[key]])),{page:1,selected:[],activeView:''});draw();return;}
  if(action==='sort-column'){state.sort=value+':'+(state.sort===value+':asc'?'desc':'asc');state.page=1;draw();return;}
  if(action==='prev'||action==='next'){state.page+=action==='prev'?-1:1;draw();return;}
  if(action==='edit'){const entry=find(id);if(entry)onEdit(entry);return;}
  if(action==='detail'){const entry=find(id);if(entry)onDetail(entry);return;}
  if(action==='unselect'){state.selected=[];draw();return;}
  if(action==='export'||action==='bulk-export'){onExport(ledgerQuery(entries,state,options.today).filter(e=>action==='export'||state.selected.includes(e.key)),ledgerLayout(options.scope,state));return;}
  if(action.startsWith('bulk-')){const selected=entries.filter(e=>state.selected.includes(e.key));if(selected.length)await onBulk(action.slice(5),selected);return;}
  if(action==='load-view'){const view=state.savedViews.find(v=>v.id===id);if(view)Object.assign(state,view.filters,view.layout||{},{page:1,selected:[],activeView:id});draw();return;}
  if(action==='delete-view'){
   if(life.saving)return;const removeId=id||state.activeView;if(!state.savedViews.some(view=>view.id===removeId))return;
   const candidate=ledgerPreference(state);candidate.savedViews=candidate.savedViews.filter(view=>view.id!==removeId);life.saving=true;state.error='';
   try{await onSave(candidate);state.savedViews=candidate.savedViews;if(state.activeView===removeId)state.activeView='';open='';onFeedback('저장한 보기를 삭제했어요. 청구 내역은 그대로 유지됩니다.');}catch(error){state.error=error.message;}finally{life.saving=false;draw();}return;
  }
  if(action==='persist'){await save();return;}
  if(action==='column-up'||action==='column-down'){
   const order=[...root.querySelectorAll('[data-column-id]')].map(node=>node.dataset.columnId),index=order.indexOf(value),next=index+(action==='column-up'?-1:1);
   if(next>=0&&next<order.length){[order[index],order[next]]=[order[next],order[index]];state.columns=order;}draw();
  }
 };
 const change=event=>{
  const target=event.target;if(target.hasAttribute('data-ledger-field'))event.stopPropagation();
  if(target.matches('[data-ledger-field]')){const key=target.dataset.ledgerField;state[key]=key==='pageSize'?Number(target.value):target.value;state.page=1;draw(key);}
  if(target.matches('[data-ledger-select]')){state.selected=target.checked?[...new Set([...state.selected,target.dataset.ledgerSelect])]:state.selected.filter(key=>key!==target.dataset.ledgerSelect);draw();}
  if(target.matches('[data-ledger-select-page]')){const page=ledgerPage(ledgerQuery(entries,state,options.today),state);state.selected=target.checked?[...new Set([...state.selected,...page.rows.map(e=>e.key)])]:state.selected.filter(key=>!page.rows.some(e=>e.key===key));draw();}
  if(target.matches('[data-ledger-column]')){const key=target.dataset.ledgerColumn;if(!target.checked&&ledgerLayout(options.scope,state).length===1){onFeedback('최소 한 개의 열을 표시해 주세요.');target.checked=true;return;}state.hidden=target.checked?state.hidden.filter(k=>k!==key):[...state.hidden,key];draw();}
 };
 const input=event=>{if(event.target.dataset.ledgerField==='query'){event.stopPropagation();state.query=event.target.value;state.page=1;state.selected=[];draw('query');}};
 const submit=async event=>{
  if(event.target.matches('[data-ledger-filter-form]')){
   event.preventDefault();const form=event.target,next={};for(const name of filterKeys.filter(k=>!['query','status','sort'].includes(k)))next[name]=form.querySelector(`[name="${name}"]`).value;
   const invalid=[next.min,next.max].some(value=>value!==''&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))||next.min!==''&&next.max!==''&&Number(next.min)>Number(next.max)||next.start&&next.end&&next.start>next.end;
   if(invalid){form.querySelector('[data-filter-error]').textContent='날짜와 금액 범위를 확인해 주세요.';return;}
   Object.assign(state,next,{page:1,selected:[]});open='';draw();
  }
  if(event.target.matches('[data-ledger-save-form]')){
   event.preventDefault();const name=event.target.querySelector('[name="viewName"]').value.trim();if(!name)return;
   if(state.savedViews.length>=12){onFeedback('저장된 보기는 최대 12개입니다.');return;}
   const view={id:crypto.randomUUID(),name,layout:Object.fromEntries(['columns','hidden','widths','density','pageSize','rowOrder'].map(key=>[key,structuredClone(state[key])])),filters:Object.fromEntries(filterKeys.map(key=>[key,state[key]]))};state.savedViews.push(view);state.activeView=view.id;await save();
  }
 };
 const resize=event=>{
  const handle=event.target.closest('[data-resize]');if(!handle)return;event.preventDefault();const key=handle.dataset.resize,start=event.clientX,width=state.widths[key]||160;
  const move=e=>{state.widths[key]=Math.min(600,Math.max(90,Math.round(width+e.clientX-start)));const th=handle.closest('th');th.style.width=th.style.minWidth=state.widths[key]+'px';};
  const end=()=>{root.ownerDocument.removeEventListener('pointermove',move);root.ownerDocument.removeEventListener('pointerup',end);draw();};
  root.ownerDocument.addEventListener('pointermove',move);root.ownerDocument.addEventListener('pointerup',end,{once:true});life.resizeCleanup=()=>{root.ownerDocument.removeEventListener('pointermove',move);root.ownerDocument.removeEventListener('pointerup',end);};
 };
 const cancel=()=>{open='';};root.addEventListener('cancel',cancel,true);
 const key=event=>{
  const rowHandle=event.target.closest('.ledger-row-handle');
  if(rowHandle&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const keys=ledgerPage(ledgerQuery(entries,state,options.today),state).rows.map(entry=>entry.key),id=rowHandle.closest('[data-entry-key]').dataset.entryKey,index=keys.indexOf(id),target=index+(event.key==='ArrowUp'?-1:1);if(target>=0&&target<keys.length){[keys[index],keys[target]]=[keys[target],keys[index]];applyRowOrder(keys,id);}return;}
  const column=event.target.closest('.ledger-header-handle');if(column&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const th=column.closest('[data-column]'),id=th.dataset.column,visible=ledgerLayout(options.scope,state),index=visible.indexOf(id),next=index+(event.key==='ArrowLeft'?-1:1);if(next<0||next>=visible.length)return;[visible[index],visible[next]]=[visible[next],visible[index]];state.columns=[...visible,...state.columns.filter(key=>!visible.includes(key))];state.rowOrderDirty=true;draw();root.querySelector(`th[data-column="${id}"] .ledger-header-handle`)?.focus();return;}
  const handle=event.target.closest('[data-resize]');if(handle&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();state.widths[handle.dataset.resize]=Math.min(600,Math.max(90,(state.widths[handle.dataset.resize]||160)+(event.key==='ArrowRight'?10:-10)));const key=handle.dataset.resize;draw();root.querySelector(`[data-resize="${key}"]`)?.focus();}};
 for(const [type,handler]of Object.entries({click,change,input,submit,pointerdown:resize,keydown:key}))root.addEventListener(type,handler);
 life.cleanup=()=>{root.removeEventListener('cancel',cancel,true);for(const [type,handler]of Object.entries({click,change,input,submit,pointerdown:resize,keydown:key}))root.removeEventListener(type,handler);};
 draw();
 return ()=>unmountLedger(root);
}

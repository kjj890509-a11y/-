import {KINDS,LABELS,FLOW_LABELS,validatePortfolio,emptyPortfolio} from './domain.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const order=['cashflow','fixed','deposits','stocks','retirement','loans','cards'];
const won=new Intl.NumberFormat('ko-KR');
const amountKeys={cashflow:'amount',fixed:'amount',deposits:'balance',stocks:'valuation',retirement:'amount',loans:'balance',cards:'amount'};
const spec={
 name:['이름','text'],institution:['금융기관·회사','text'],note:['메모','text'],balance:['현재 잔액','money'],valuation:['현재 평가액','money'],cost:['총매입금액','money'],amount:['금액','money'],rate:['연 이율 · %','number'],maturity:['만기일','date'],monthlyContribution:['회사 월 납입액','money'],contributionDate:['첫 납입 예정일','date'],asOf:['금액 기준일','date'],remainingMonths:['남은 납부 횟수','number'],nextPaymentDate:['다음 납부일','date'],day:['매월 납부일','number'],dueDate:['결제일','date'],date:['일자·반복 시작일','date'],startMonth:['시작월','month'],endMonth:['종료월','month'],
 type:['수입·지출 구분','select',Object.entries(FLOW_LABELS)],repeat:['반복','select',[['once','한 번'],['monthly','매월']]],paid:['결제 상태','boolean',[['false','결제 예정'],['true','결제 완료']]],includeInForecast:['예상 반영','boolean',[['true','포함'],['false','제외']]],paymentSource:['결제 방식','select',[['account','계좌 결제'],['card','카드 청구 포함']]]
};
const columns={
 all:['name','institution','primary','note'],cashflow:['name','type','amount','date','repeat','includeInForecast','note'],fixed:['name','amount','day','paymentSource','startMonth','endMonth','note'],deposits:['name','institution','balance','rate','maturity','note'],stocks:['name','institution','cost','valuation','note'],retirement:['name','institution','amount','monthlyContribution','contributionDate','asOf','note'],loans:['name','institution','balance','rate','remainingMonths','nextPaymentDate','day','note'],cards:['name','amount','dueDate','paid','note']
};
export const createEntryManagerState=()=>({mode:'manage',category:'all',query:'',sort:'default',page:1,pageSize:20,changedOnly:false,drafts:new Map(),busy:false,error:'',message:''});
const keyFor=(kind,id)=>kind+':'+id;
const normalize=(key,value)=>{
 const type=spec[key]?.[1];
 if(type==='money'||type==='number'){
  const source=String(value??'').trim(),raw=type==='money'?source.replaceAll(',',''):source;
  if(!raw||(type==='money'?!/^\d+$/.test(raw):!/^\d+(\.\d+)?$/.test(raw)))throw new Error(`${spec[key][0]}을 올바른 숫자로 입력해 주세요.`);
  return Number(raw);
 }
 if(type==='boolean'){if(!['true','false',true,false].includes(value))throw new Error('선택 값을 확인해 주세요.');return value===true||value==='true';}
 return String(value??'').trim();
};
const equal=(a,b)=>Object.is(a,b);
function changedValue(key,value,base){try{return !equal(normalize(key,value),base??'');}catch{return true;}}
export function stageEntryField(state,data,kind,id,key,value){
 if(!KINDS.includes(kind)||!spec[key]||!(columns[kind].includes(key)||columns.all.includes(key)))throw new Error('수정할 항목을 확인해 주세요.');
 if(['cashflow','fixed','cards'].includes(kind)&&key==='institution')throw new Error('이 항목에는 금융기관이 없습니다.');
 const row=data[kind].find(r=>r.id===id);if(!row)throw new Error('수정할 내역이 없습니다.');
 if(kind==='loans'&&['remainingMonths','nextPaymentDate'].includes(key)&&row.calculationMode!=='term')throw new Error('남은 기간 자동 계산을 사용하는 대출에서 수정해 주세요.');
 const identity=keyFor(kind,id),draft=state.drafts.get(identity)||{kind,id,base:structuredClone(row),changes:{}};
 if(changedValue(key,value,draft.base[key]))draft.changes[key]=value;else delete draft.changes[key];
 if(Object.keys(draft.changes).length)state.drafts.set(identity,draft);else state.drafts.delete(identity);
 state.error='';state.message='';return draft;
}
export function stageEntryRecord(state,data,kind,record){
 const current=data[kind]?.find(r=>r.id===record.id);if(!current)throw new Error('수정할 내역이 없습니다.');
 const draft=state.drafts.get(keyFor(kind,record.id))||{kind,id:record.id,base:structuredClone(current),changes:{}};
 draft.changes={};for(const [key,value]of Object.entries(record))if(key!=='id'&&!equal(value,draft.base[key]))draft.changes[key]=value;
 if(Object.keys(draft.changes).length)state.drafts.set(keyFor(kind,record.id),draft);else state.drafts.delete(keyFor(kind,record.id));state.error='';state.message='';
}
function mergeDraft(data,draft){
 const row=data[draft.kind]?.find(r=>r.id===draft.id);
 if(!row)throw new Error(`${draft.base.name}: 내역이 삭제되었습니다. 이 변경을 되돌린 뒤 다시 확인해 주세요.`);
 const next={...row};for(const [key,raw]of Object.entries(draft.changes)){
  const value=spec[key]?normalize(key,raw):raw;
  if(!equal(row[key],draft.base[key])&&!equal(row[key],value))throw new Error(`${row.name}: 다른 화면이나 기기에서 같은 값이 바뀌었습니다. 이 내역의 변경을 되돌린 뒤 다시 수정해 주세요.`);
  next[key]=value;
 }
 return next;
}
export function entryDraftRow(state,data,kind,id){
 const draft=state.drafts.get(keyFor(kind,id));if(!draft)return data[kind]?.find(r=>r.id===id);
 const check=emptyPortfolio();check.cardAccounts=data.cardAccounts||[];check[kind]=[mergeDraft(data,draft)];return validatePortfolio(check)[kind][0];
}
export function applyEntryDrafts(data,state){
 const next=structuredClone(data);
 for(const draft of state.drafts.values()){
  const row=mergeDraft(data,draft);
  next[draft.kind][next[draft.kind].findIndex(r=>r.id===draft.id)]=row;
  // Use the same validation and derived loan calculations as individual forms.
  const check=emptyPortfolio();check.cardAccounts=data.cardAccounts||[];check[draft.kind]=[row];
  try{validatePortfolio(check);}catch(error){throw new Error(`${row.name||draft.base.name}: ${error.message}`);}
 }
 return validatePortfolio(next);
}
function filteredRows(data,state){
 const query=state.query.trim().normalize('NFKC').toLocaleLowerCase('ko-KR');
 const rows=order.flatMap(kind=>(data[kind]||[]).map(row=>({kind,row,key:keyFor(kind,row.id)}))).filter(item=>
  (state.category==='all'||state.category===item.kind)&&(!state.changedOnly||state.drafts.has(item.key))&&(!query||[item.row.name,item.row.institution,item.row.note,LABELS[item.kind]].join(' ').normalize('NFKC').toLocaleLowerCase('ko-KR').includes(query)));
 if(state.sort==='name')rows.sort((a,b)=>a.row.name.localeCompare(b.row.name,'ko'));
 if(['amount-desc','amount-asc'].includes(state.sort))rows.sort((a,b)=>(a.row[amountKeys[a.kind]]-b.row[amountKeys[b.kind]])*(state.sort==='amount-desc'?-1:1));
 return rows;
}
const amountLabel={cashflow:'금액',fixed:'매월 지출액',deposits:'현재 잔액',stocks:'현재 평가액',retirement:'현재 금액',loans:'대출 잔액',cards:'결제 금액'};
function cell(item,column,state,{money,hidden}){
 const {kind,row,key}=item,field=column==='primary'?amountKeys[kind]:column,definition=spec[field],draft=state.drafts.get(key),dirty=draft&&Object.hasOwn(draft.changes,field),value=dirty?draft.changes[field]:row[field]??'',type=definition[1],label=(column==='primary'?amountLabel[kind]:definition[0]);
 const attrs=`data-entry-value data-entry-key="${esc(key)}" data-entry-field="${field}" aria-label="${esc(row.name+' · '+label)}" ${state.busy?'disabled':''}`;
 if(field==='institution'&&['cashflow','fixed','cards'].includes(kind))return '<td class="entry-unavailable">—</td>';
 if(kind==='loans'&&['remainingMonths','nextPaymentDate'].includes(field)&&row.calculationMode!=='term')return '<td class="entry-unavailable">상세에서 설정</td>';
 let input;
 if(hidden&&type==='money')input='<span class="entry-hidden-value">••••••</span>';
 else if(type==='select'||type==='boolean')input=`<select ${attrs}>${definition[2].map(([v,label])=>`<option value="${v}" ${String(value)===v?'selected':''}>${label}</option>`).join('')}</select>`;
 else input=`<input ${attrs} type="${['date','month'].includes(type)?type:'text'}" value="${esc(type==='money'&&typeof value==='number'?won.format(value):value)}" ${['money','number'].includes(type)?'inputmode="decimal"':`maxlength="${field==='note'?500:100}"`} ${field==='name'?'required':''} autocomplete="off">`;
 const old=type==='money'?money(row[field]||0):type==='select'||type==='boolean'?definition[2].find(([v])=>String(row[field])===v)?.[1]:String(row[field]??'')||'없음';
 return `<td class="entry-edit-cell ${type==='money'||type==='number'?'entry-number-cell':''} ${dirty?'is-changed':''}">${input}${column==='primary'?`<small class="entry-amount-caption">${label}</small>`:''}${dirty?`<small class="entry-before">이전: ${esc(old)}</small>`:''}</td>`;
}
export function renderEntryManager(data,state,options){
 const rows=filteredRows(data,state),count=state.drafts.size,pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.max(1,Math.min(state.page,pages));
 const visible=rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize),keys=columns[state.category]||columns.all;
 const missing=[...state.drafts.values()].filter(draft=>!data[draft.kind].some(row=>row.id===draft.id));
 const busy=state.busy?'disabled':'';
 return `<div class="entry-manager-head"><div><h2>기존 내역 수정</h2><p>셀에서 바로 수정하세요. 여러 종류의 변경을 모아서 저장할 수 있습니다.</p></div><button type="button" class="text-button" data-entry-command="reload" ${busy}>최신 내역 불러오기</button></div>
 <div class="entry-kind-filters" role="group" aria-label="수정할 내역 종류">${['all',...order].map(kind=>`<button type="button" data-entry-category="${kind}" aria-pressed="${state.category===kind}" ${busy}>${kind==='all'?'전체':LABELS[kind]}<span>${kind==='all'?order.reduce((n,k)=>n+data[k].length,0):data[kind].length}</span></button>`).join('')}</div>
 <div class="entry-manager-tools"><label class="entry-search"><span class="sr-only">이름·기관·메모 검색</span><input type="search" maxlength="200" data-entry-query placeholder="이름·기관·메모 검색" value="${esc(state.query)}" ${busy}></label><label class="entry-changed-filter"><input type="checkbox" data-entry-changed-only ${state.changedOnly?'checked':''} ${busy}>변경된 내역만</label><label class="entry-sort">정렬<select data-entry-sort ${busy}>${[['default','기본순'],['name','이름순'],['amount-desc','금액 큰순'],['amount-asc','금액 작은순']].map(([v,l])=>`<option value="${v}" ${state.sort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
 <p class="entry-result-count">${rows.length}건 조회${options.hidden?' · 금액 표시를 켜면 금액 셀을 수정할 수 있습니다.':''}${state.category==='loans'?' · 원금·이자와 상환 방식은 상세 수정에서 확인하세요. 다음 납부일과 매월 납부일은 별도입니다.':''}</p>
 ${missing.length?`<div class="entry-missing-drafts">${missing.map(draft=>`<p><span>${esc(draft.base.name)} · 원본이 삭제되어 저장할 수 없습니다.</span><button type="button" class="text-button" data-entry-undo="${esc(keyFor(draft.kind,draft.id))}" ${busy}>이 변경 취소</button></p>`).join('')}</div>`:''}<div class="entry-edit-scroll"><table class="entry-edit-table"><caption class="sr-only">기존 내역 일괄 수정. Tab으로 다음 셀로 이동합니다. 변경 저장 전에는 서버에 반영되지 않습니다.</caption><thead><tr>${state.category==='all'?'<th>종류</th>':''}${keys.map(k=>`<th ${['money','number'].includes(spec[k]?.[1])||k==='primary'?'class="entry-number-heading"':''}>${k==='primary'?'금액 · 원':spec[k][0]+(spec[k][1]==='money'?' · 원':'')}</th>`).join('')}<th>관리</th></tr></thead><tbody>${visible.map(item=>`<tr data-entry-row="${esc(item.key)}" class="${state.drafts.has(item.key)?'has-changes':''}">${state.category==='all'?`<td class="entry-kind-label">${esc(LABELS[item.kind])}</td>`:''}${keys.map(k=>cell(item,k,state,options)).join('')}<td class="entry-row-actions"><button type="button" class="entry-recent-edit" data-entry-detail="${esc(item.key)}" ${busy}>상세 수정</button><button type="button" class="text-button" data-entry-undo="${esc(item.key)}" ${state.drafts.has(item.key)?'':'hidden'} ${busy}>되돌리기</button><span class="entry-row-marker" ${state.drafts.has(item.key)?'':'hidden'}>수정 중</span></td></tr>`).join('')||`<tr><td colspan="${keys.length+2}" class="entry-manager-empty">${order.some(k=>data[k].length)?'조회 조건에 맞는 내역이 없습니다.':'아직 저장된 내역이 없습니다. 위의 새 내역 등록에서 시작하세요.'}</td></tr>`}</tbody></table></div>
 <div class="entry-manager-pagination"><span>${state.page} / ${pages}페이지</span><div><button type="button" class="button secondary small" data-entry-page="${state.page-1}" ${state.page===1||state.busy?'disabled':''}>이전</button><button type="button" class="button secondary small" data-entry-page="${state.page+1}" ${state.page===pages||state.busy?'disabled':''}>다음</button></div></div>
 <div class="entry-save-bar"><div><strong data-entry-draft-count role="status">${count?count+'건 수정 중':'저장할 변경이 없습니다.'}</strong><small>다른 종류·페이지로 이동해도 수정 중인 값은 유지됩니다.</small></div><div><button type="button" class="button secondary" data-entry-command="discard" ${!count||state.busy?'disabled':''}>변경 취소</button><button type="button" class="button primary" data-entry-command="save" ${!count||state.busy?'disabled':''}>${state.busy?'저장 중…':'변경 '+count+'건 저장'}</button></div></div>
 <p class="entry-manager-error" data-entry-error role="alert">${esc(state.error)}</p><p class="entry-manager-message" role="status">${esc(state.message)}</p>`;
}
export function mountEntryManager(root,getData,state,options){
 const draw=()=>{root.innerHTML=renderEntryManager(getData(),state,options);};
 const update=()=>{
  const count=state.drafts.size;root.querySelector('[data-entry-draft-count]').textContent=count?count+'건 수정 중':'저장할 변경이 없습니다.';
  const save=root.querySelector('[data-entry-command="save"]');save.textContent='변경 '+count+'건 저장';save.disabled=!count||state.busy;root.querySelector('[data-entry-command="discard"]').disabled=!count||state.busy;root.querySelector('[data-entry-error]').textContent=state.error;root.querySelector('.entry-manager-message').textContent=state.message;
 };
 const input=event=>{
  if(state.busy)return;const target=event.target;
  if(target.matches('[data-entry-query]')){const start=target.selectionStart;state.query=target.value;state.page=1;draw();const next=root.querySelector('[data-entry-query]');next.focus();if(start!==null)next.setSelectionRange?.(start,start);return;}
  if(!target.matches('[data-entry-value]'))return;
  const [kind,id]=target.dataset.entryKey.split(':');
  try{stageEntryField(state,getData(),kind,id,target.dataset.entryField,target.value);}catch(error){state.error=error.message;}
  const dirty=state.drafts.has(target.dataset.entryKey),row=target.closest('tr'),cell=target.closest('td');row.classList.toggle('has-changes',dirty);cell.classList.toggle('is-changed',Boolean(state.drafts.get(target.dataset.entryKey)?.changes&&Object.hasOwn(state.drafts.get(target.dataset.entryKey).changes,target.dataset.entryField)));
  const draft=state.drafts.get(target.dataset.entryKey),field=target.dataset.entryField;
  let before=cell.querySelector('.entry-before');
  if(draft&&Object.hasOwn(draft.changes,field)){
   if(!before){before=root.ownerDocument.createElement('small');before.className='entry-before';cell.append(before);}
   const definition=spec[field],old=definition[1]==='money'?options.money(draft.base[field]||0):(definition[2]?.find(([v])=>v===String(draft.base[field]))?.[1]??String(draft.base[field]??''))||'없음';
   before.textContent='이전: '+old;
  }else before?.remove();
  row.querySelector('[data-entry-undo]').hidden=!dirty;row.querySelector('.entry-row-marker').hidden=!dirty;update();
 };
 const change=event=>{
  if(state.busy)return;const t=event.target;
  if(t.matches('[data-entry-value]')){input(event);return;}
  if(t.matches('[data-entry-sort]'))state.sort=t.value;else if(t.matches('[data-entry-changed-only]'))state.changedOnly=t.checked;else return;state.page=1;draw();
 };
 const click=async event=>{
  const b=event.target.closest('button');if(!b||b.disabled||state.busy)return;
  if(b.dataset.entryCategory){state.category=b.dataset.entryCategory;state.page=1;draw();root.querySelector(`[data-entry-category="${state.category}"]`)?.focus();return;}
  if(b.dataset.entryPage){state.page=Number(b.dataset.entryPage);draw();return;}
  if(b.dataset.entryUndo){state.drafts.delete(b.dataset.entryUndo);state.error='';state.message='';draw();return;}
  if(b.dataset.entryDetail){const [kind,id]=b.dataset.entryDetail.split(':');if(options.hidden){options.onFeedback('금액 표시를 켠 뒤 상세 수정해 주세요.');return;}try{options.onDetail(kind,id,entryDraftRow(state,getData(),kind,id));}catch(error){state.error=error.message;update();}return;}
  const command=b.dataset.entryCommand;
  if(command==='discard'){state.drafts.clear();state.error='';state.message='';draw();return;}
  if(command==='reload'){try{await options.onReload();}catch(error){state.error=error.message;draw();}return;}
  if(command!=='save'||!state.drafts.size)return;
  const count=state.drafts.size;state.busy=true;state.error='';state.message='';draw();
  try{const next=applyEntryDrafts(getData(),state);await options.onSave(next);state.drafts.clear();state.message=`${count}건의 변경을 저장했습니다.`;options.onFeedback(state.message);}catch(error){state.error=error.message;}finally{state.busy=false;options.onRender();}
 };
 for(const [type,fn]of Object.entries({input,change,click}))root.addEventListener(type,fn);
 return ()=>{for(const [type,fn]of Object.entries({input,change,click}))root.removeEventListener(type,fn);};
}

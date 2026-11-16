const states=new WeakMap();
let sourceSequence=0;
function closeDialog(dialog,state){if(!dialog)return;if(state.modal===dialog.id)state.modal='';if(dialog.id==='ui-info-dialog')dialog.querySelector('[data-ui-info-content]').replaceChildren();if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
function stateFor(document){
 if(states.has(document))return states.get(document);
 const state={view:'',sections:new Map(),modal:'',advisorStep:3};states.set(document,state);
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-ui-close],[data-ui-open],[data-info-sources],[data-info-template],[data-ui-stage]');if(!target)return;
  event.preventDefault();
  if(target.hasAttribute('data-ui-close')){closeDialog(target.closest('dialog'),state);return;}
  if(target.hasAttribute('data-ui-stage')){state.advisorStep=Number(target.dataset.uiStage);setStage(document.getElementById('main'),state.advisorStep);return;}
  if(target.hasAttribute('data-ui-open')){const dialog=document.getElementById(target.dataset.uiOpen);if(dialog){state.modal=dialog.id;show(dialog);}return;}
  const dialog=infoDialog(document);dialog.querySelector('h2').textContent=target.getAttribute('aria-label')?.replace(/ 설명 보기$| 상세 보기$/,'')||'자세히 보기';
  const content=dialog.querySelector('[data-ui-info-content]');content.replaceChildren();
  const template=target.querySelector('template');
  if(template)content.append(template.content.cloneNode(true));
  else for(const id of (target.dataset.infoSources||'').split(' ')){
   const source=document.getElementById(id);if(!source)continue;
   const copy=source.cloneNode(true);copy.removeAttribute('hidden');copy.removeAttribute('id');copy.className='info-copy';copy.querySelectorAll('svg[aria-hidden="true"]').forEach(icon=>icon.remove());content.append(copy);
  }
  show(dialog);
 });
 document.addEventListener('toggle',event=>{const element=event.target;if(element.matches?.('details[data-ui-section]')){state.sections.set(state.view+':'+element.dataset.uiSection,element.hasAttribute('open'));const hint=element.querySelector(':scope > summary .disclosure-hint');if(hint)hint.textContent=element.hasAttribute('open')?'접기':'펼쳐 보기';}},true);
 document.addEventListener('close',event=>{if(event.target.id===state.modal)state.modal='';if(event.target.id==='ui-info-dialog'&&!event.target.hasAttribute('open'))event.target.querySelector('[data-ui-info-content]').replaceChildren();},true);
 document.addEventListener('cancel',event=>{if(event.target.id===state.modal)state.modal='';},true);
 return state;
}
function show(dialog){if(dialog.hasAttribute('open'))return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
function infoDialog(document){
 let dialog=document.getElementById('ui-info-dialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='ui-info-dialog';dialog.className='info-dialog';
 dialog.setAttribute('aria-labelledby','ui-info-title');dialog.innerHTML='<div class="dialog-heading"><h2 id="ui-info-title">자세히 보기</h2><button type="button" class="icon-button" data-ui-close aria-label="닫기">✕</button></div><div data-ui-info-content></div><div class="dialog-actions"><button type="button" class="button primary" data-ui-close>확인</button></div>';
 document.body.append(dialog);return dialog;
}
function help(source,target,title){
 if(!source||!target||source.dataset.helpSource)return;
 source.dataset.helpSource='true';source.id||=`help-source-${++sourceSequence}`;source.hidden=true;
 let button=target.querySelector(':scope > [data-info-sources]');
 if(!button){button=source.ownerDocument.createElement('button');button.type='button';button.className='info-button';button.textContent='i';button.setAttribute('aria-label',title+' 설명 보기');button.setAttribute('aria-haspopup','dialog');button.dataset.infoSources='';target.append(button);target.classList.add('with-info');}
 button.dataset.infoSources=(button.dataset.infoSources+' '+source.id).trim();
}
function fold(element,key,title,state){
 if(!element||element.closest('details[data-ui-section]'))return;
 const document=element.ownerDocument,details=document.createElement('details');details.className='disclosure-card';details.dataset.uiSection=key;
 const summary=document.createElement('summary'),label=document.createElement('span');label.textContent=title;summary.append(label);
 const helper=element.querySelector('.table-heading h2 > [data-info-sources],.panel-header h2 > [data-info-sources]');if(helper)summary.append(helper);
 const hint=document.createElement('span');hint.className='disclosure-hint';hint.textContent='펼쳐 보기';summary.append(hint);details.append(summary);
 const body=document.createElement('div');body.className='disclosure-body';element.before(details);body.append(element);details.append(body);
 if(state.sections.get(state.view+':'+key))details.setAttribute('open','');
}
function setStage(root,step){
 if(!root)return;
 root.querySelectorAll('[data-ui-stage-panel]').forEach(panel=>{panel.hidden=Number(panel.dataset.uiStagePanel)!==step;});
 root.querySelectorAll('[data-ui-stage]').forEach(button=>{button.classList.toggle('active',Number(button.dataset.uiStage)===step);button.setAttribute('aria-current',Number(button.dataset.uiStage)===step?'step':'false');});
}
export function expandSection(root,key){
 const state=stateFor(root.ownerDocument);state.sections.set(state.view+':'+key,true);
 const details=[...root.querySelectorAll('details[data-ui-section]')].find(element=>element.dataset.uiSection===key);
 if(details){details.setAttribute('open','');const hint=details.querySelector('.disclosure-hint');if(hint)hint.textContent='접기';}
}
export function rememberDisclosure(root){
 const document=root.ownerDocument,state=stateFor(document);
 for(const element of root.querySelectorAll('details[data-ui-section]'))state.sections.set(state.view+':'+element.dataset.uiSection,element.hasAttribute('open'));
 const modal=document.getElementById(state.modal),active=document.activeElement;
 state.focus=modal?.hasAttribute('open')&&modal.contains(active)?{id:active.id,name:active.name,start:active.selectionStart,end:active.selectionEnd}:null;
}
function advisorStages(root,state){
 const controls=root.querySelector('.advisor-controls'),form=root.querySelector('#advisor-form');if(!controls||root.querySelector('.ui-steps'))return;
 const document=root.ownerDocument,nav=document.createElement('nav');nav.className='ui-steps';nav.setAttribute('aria-label','상환 상담 진행 단계');
 for(const [number,title]of [[3,'AI 상담'],[1,'상환 조건'],[2,'그래프 비교']]){const button=document.createElement('button');button.type='button';button.dataset.uiStage=String(number);button.textContent=title;nav.append(button);}
 controls.before(nav);
 const panels=[1,2,3].map(number=>{const panel=document.createElement('section');panel.dataset.uiStagePanel=String(number);root.append(panel);return panel;});
 panels[0].append(controls);
 const connection=document.createElement('section');connection.className='panel advisor-connection';connection.innerHTML='<div class="panel-header"><h2>AI 상담 연결</h2></div><div class="stats-filter-grid"></div><div class="stats-filter-actions"></div>';
 panels[2].append(connection);
 for(const name of ['apiKey','model','question']){const field=form.querySelector(`[name="${name}"]`);if(field){field.removeAttribute('required');field.disabled=form.querySelector('fieldset').disabled;connection.querySelector('.stats-filter-grid').append(field.closest('label'));}}
 const keyNote=form.querySelector('.advisor-key-note');if(keyNote)connection.append(keyNote);
 for(const selector of ['[data-advisor-disconnect]','[data-advisor-consult]']){const button=form.querySelector(selector);if(button){button.disabled=button.disabled||form.querySelector('fieldset').disabled;connection.querySelector('.stats-filter-actions').append(button);}}
 const calculate=form.querySelector('button[type="submit"]');if(calculate)calculate.textContent='상환안 비교하기 →';
 for(const element of [...root.children]){
  if(element===nav||element.matches('[data-ui-stage-panel],.page-heading,.inline-warning,.section-tabs'))continue;
  if(element.matches('.advisor-answer,[role="status"],[data-advisor-notice]'))panels[2].append(element);
  else panels[1].append(element);
 }
 const next=document.createElement('button');next.type='button';next.className='button primary stage-next';next.dataset.uiStage='3';next.textContent='AI 상담으로 이어가기 →';panels[1].append(next);
 if(panels[2].querySelector('.advisor-answer')){const graph=document.createElement('button');graph.type='button';graph.className='button primary stage-next';graph.dataset.uiStage='2';graph.textContent='추천 상환안 그래프 보기 →';panels[2].append(graph);}
 setStage(root,state.advisorStep);
}
function statisticsFilters(root,state){
 const panel=root.querySelector('.stats-controls');if(!panel||panel.closest('dialog'))return;
 const document=root.ownerDocument,dialog=document.createElement('dialog');dialog.id='statistics-filter-dialog';dialog.className='filter-dialog';dialog.setAttribute('aria-labelledby','statistics-filter-title');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="statistics-filter-title">기간과 조회 조건</h2><button type="button" class="icon-button" data-ui-close aria-label="닫기">✕</button></div>';
 const bar=document.createElement('div');bar.className='filter-toolbar';bar.innerHTML='<button type="button" class="button secondary" data-ui-open="statistics-filter-dialog">기간·조회 조건 변경</button>';
 const summary=document.createElement('span');summary.className='filter-summary';
 const kind=panel.querySelector('#stats-kind');const parts=[kind?.querySelector('option[selected]')?.textContent||'전체 내역'];
 const basis=panel.querySelector('#stats-basis');if(basis)parts.push(basis.querySelector('option[selected]')?.textContent||'기록·일정·예상 전체');
 for(const id of ['stats-bank','stats-item','stats-query']){const field=panel.querySelector('#'+id);if(field?.value)parts.push(id==='stats-item'?field.querySelector('option[selected]')?.textContent||field.value:field.value);}
 summary.textContent=parts.join(' · ');bar.append(summary);
 panel.before(bar);dialog.append(panel);root.append(dialog);
 const grid=panel.querySelector('.stats-filter-grid'),advanced=document.createElement('details');advanced.className='filter-advanced';advanced.dataset.uiSection='statistics-advanced';advanced.innerHTML='<summary>은행·특정 항목으로 좁히기</summary><div class="stats-filter-grid"></div>';
 for(const id of ['stats-bank','stats-item','stats-query']){const field=panel.querySelector('#'+id);if(field)advanced.querySelector('div').append(field.closest('label'));}
 grid.after(advanced);
 if(state.sections.get('statistics:statistics-advanced')||['stats-bank','stats-item','stats-query'].some(id=>Boolean(panel.querySelector('#'+id)?.value)))advanced.setAttribute('open','');
 const preset=panel.querySelector('#stats-preset')?.value;
 for(const id of ['stats-start','stats-end']){const input=panel.querySelector('#'+id);if(input)input.closest('label').hidden=preset!=='custom';}
 const warning=root.querySelector('.inline-warning[role="alert"]');if(warning)panel.querySelector('#stats-filter-error').textContent=warning.textContent;
}
export function enhanceDisclosure(root,{view=''}={}){
 const document=root.ownerDocument,state=stateFor(document);
 if(state.view!==view){state.modal='';state.focus=null;if(view==='advisor')state.advisorStep=3;}state.view=view;
 document.querySelectorAll('dialog.info-dialog').forEach(dialog=>{if(dialog.hasAttribute('open'))closeDialog(dialog,state);else dialog.querySelector('[data-ui-info-content]').replaceChildren();});
 if(view==='advisor')advisorStages(root,state);
 if(view==='advisor'&&root.querySelector('.inline-warning')&&!root.querySelector('.stats-trend')){state.advisorStep=1;setStage(root,1);}
 if(view==='statistics')statisticsFilters(root,state);
 for(const form of root.querySelectorAll('#advisor-form,#statistics-filter-form'))if(!form.dataset.uiSubmit){form.dataset.uiSubmit='true';form.addEventListener('submit',()=>{if(form.id==='advisor-form')state.advisorStep=2;else closeDialog(form.closest('dialog'),state);});}


 for(const source of root.querySelectorAll('.panel-note,.category-note,.loan-schedule-note,.stats-note,.advisor-key-note,.intro-note,.dashboard-notice,.table-hint')){
  if(source.closest('dialog')||source.getAttribute('role')==='status'||source.textContent.includes('대출을 먼저')||source.textContent.includes('예시 모드'))continue;
  const section=source.closest('.panel,.table-panel'),target=section?.querySelector('.panel-header h2,.table-heading h2')||root.querySelector('h1');
  help(source,target,'계산·표시 기준');
 }
 if(view==='statistics')root.querySelectorAll('.stats-table').forEach((element,index)=>fold(element,'stats-table-'+index,index===0?'월별 합계':'기간 내 상세 내역',state));

 if(view==='loans')for(const details of root.querySelectorAll('details[data-loan-details]'))if(state.sections.get(state.view+':'+details.dataset.uiSection))details.setAttribute('open','');

 if(view==='advisor'){
  root.querySelectorAll('.stats-table').forEach((element,index)=>fold(element,'advisor-table-'+index,element.querySelector('h2')?.textContent||'상세 비교',state));
  root.querySelectorAll('.advisor-answer ul').forEach((list,index)=>fold(list,'advice-'+index,index===0?'추천 이유 자세히':'실행 전 확인할 내용',state));
 }
 if(state.modal){const dialog=document.getElementById(state.modal);if(dialog){show(dialog);const focus=state.focus,field=focus&&(focus.id?document.getElementById(focus.id):[...dialog.querySelectorAll('[name]')].find(element=>element.name===focus.name));if(field){field.focus({preventScroll:true});if(typeof field.setSelectionRange==='function'&&focus.start!==null)field.setSelectionRange(focus.start,focus.end);}}}state.focus=null;
}
export function enhanceEditorHelp(dialog){
 stateFor(dialog.ownerDocument);
 for(const source of dialog.querySelectorAll('.storage-note'))help(source,source.closest('.field')?.querySelector('label')||dialog.querySelector('.dialog-heading h2'),'입력 안내');
}

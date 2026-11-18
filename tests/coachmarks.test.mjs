import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createCoachmarkState,mountCoachmarks,coachmarkViews,coachmarkPosition} from '../public/coachmarks.mjs';
import {emptyPortfolio,samplePortfolio} from '../public/domain.mjs';
import {viewLabels} from '../public/navigation.mjs';
function fixture(data=samplePortfolio(),options={}){
 const {document,window,Event}=parseHTML('<html><body><main><header class="m-header">대출</header><button data-action="add">추가</button><div class="m-account-list">내역</div><div data-mobile-sync>저장됨</div></main></body></html>');
 const root=document.querySelector('main'),saved=new Map(),storage=options.storage||{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},state=createCoachmarkState(storage),calls=[];
 const opts={view:'loans',mobile:true,getData:()=>data,money:n=>options.hidden?'••••••':Number(n).toLocaleString('ko-KR')+'원',onStart:id=>calls.push(['add',id]),onEdit:(kind,id)=>calls.push(['edit',kind,id]),onPlan:(kind,id)=>calls.push(['plan',kind,id]),onCardAccount:id=>calls.push(['card',id]),onCardBill:id=>calls.push(['bill',id]),...options};
 let cleanup=mountCoachmarks(root,state,opts);
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new Event('click',{bubbles:true}));};
 const remount=(changes={})=>{cleanup();Object.assign(opts,changes);cleanup=mountCoachmarks(root,state,opts);};
 return{document,window,Event,root,state,saved,calls,click,remount,cleanup:()=>cleanup()};
}
test('every page has an initial guide, independent completion and an always available restart',()=>{
 assert.deepEqual([...coachmarkViews].sort(),[...Object.keys(viewLabels),'menu'].sort());
 const t=fixture();assert.match(t.document.querySelector('#coach-title').textContent,/대출/);t.click('[data-coach="close"]');assert.equal(t.document.querySelector('.coach-portal'),null);
 t.remount();assert.equal(t.document.querySelector('.coach-portal'),null);t.click('[data-coach-open]');assert.ok(t.document.querySelector('.coach-portal'));
 t.click('[data-coach="next"]');assert.match(t.document.querySelector('#coach-title').textContent,/수정/);t.click('[data-coach="previous"]');assert.match(t.document.querySelector('#coach-title').textContent,/추가/);
 t.click('[data-coach="close"]');const persisted=[...t.saved.values()].join('');assert.match(persisted,/mobile:loans/);assert.doesNotMatch(persisted,/demo-l1|name|balance/);
 t.remount({view:'deposits'});assert.ok(t.document.querySelector('.coach-portal'));t.cleanup();assert.equal(t.document.querySelector('.coach-portal,.coach-launch,.coach-picker'),null);
});
test('guidance adds the correct category, searches and edits an explicitly selected existing record, and never writes data',()=>{
 const data=samplePortfolio(),before=structuredClone(data),t=fixture(data);
 t.click('[data-coach="act"]');assert.deepEqual(t.calls,[['add','loans']]);assert.equal(t.document.querySelector('.coach-portal'),null);
 t.click('[data-coach-open]');t.click('[data-coach="next"]');t.click('[data-coach="act"]');const input=t.document.querySelector('[data-coach-search]');input.value=data.loans[1].name;input.dispatchEvent(new t.Event('input',{bubbles:true}));
 assert.equal(t.document.querySelectorAll('[data-coach-choice]').length,1);t.click('[data-coach-choice]');assert.deepEqual(t.calls[1],['edit','loans',data.loans[1].id]);assert.equal(t.document.querySelector('.coach-picker'),null);assert.deepEqual(data,before);t.cleanup();
});
test('empty and masked portfolios stay truthful; record names are escaped and picker search survives a rerender',()=>{
 const e=fixture(emptyPortfolio());e.click('[data-coach="next"]');e.click('[data-coach="act"]');assert.match(e.document.querySelector('.coach-picker-empty').textContent,/아직 등록된 내역/);assert.equal(e.calls.length,0);e.cleanup();
 const data=samplePortfolio();data.loans[0].name='<img src=x onerror=alert(1)>';const t=fixture(data,{hidden:true});t.click('[data-coach="next"]');t.click('[data-coach="act"]');assert.equal(t.document.querySelector('.coach-picker img'),null);assert.match(t.document.querySelector('.coach-picker').textContent,/••••••/);assert.doesNotMatch(t.document.querySelector('.coach-picker').textContent,/62,000,000/);
 const field=t.document.querySelector('[data-coach-search]');field.value=data.loans[0].name;field.dispatchEvent(new t.Event('input',{bubbles:true}));t.remount();assert.equal(t.document.querySelector('[data-coach-search]').value,data.loans[0].name);assert.equal(t.document.querySelectorAll('[data-coach-choice]').length,1);t.click('[data-coach-choice]');assert.deepEqual(t.calls,[['edit','loans',data.loans[0].id]]);t.cleanup();
});
test('cards reuse registered profiles; budget and historical records use their planning editors',()=>{
 const data=samplePortfolio();data.cardAccounts=[{id:'registered',name:'내 카드',day:13,archived:false}];const t=fixture(data,{view:'cards'});t.click('[data-coach="act"]');const choices=[...t.document.querySelectorAll('[data-coach-choice]')];const bill=choices.find(el=>el.textContent.includes('내 카드'));bill.dispatchEvent(new t.Event('click',{bubbles:true}));assert.deepEqual(t.calls,[['bill','registered']]);
 t.remount({view:'budget'});t.click('[data-coach="act"]');assert.deepEqual(t.calls[1],['plan','budget','']);
 data.snapshots=[{month:'2026-10',asOf:'2026-10-31'}];t.remount({view:'history'});t.click('[data-coach="next"]');t.click('[data-coach="act"]');t.click('[data-coach-choice]');assert.deepEqual(t.calls[2],['plan','snapshot','2026-10']);t.cleanup();
});
test('storage failures do not block guidance, unrelated dialogs are respected, and Escape dismisses the coach',()=>{
 const t=fixture(emptyPortfolio(),{storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});const event=new t.Event('keydown',{bubbles:true,cancelable:true});event.key='Escape';t.document.dispatchEvent(event);assert.equal(t.document.querySelector('.coach-portal'),null);assert.ok(t.state.seen.has('mobile:loans'));
 const dialog=t.document.createElement('dialog');dialog.setAttribute('open','');t.document.body.append(dialog);t.click('[data-coach-open]');assert.equal(t.document.querySelector('.coach-portal'),null);t.cleanup();
});
test('coach positions remain inside narrow and wide viewports and above the mobile navigation',()=>{
 for(const [width,height,mobile] of [[320,568,true],[393,852,true],[480,640,true],[1440,900,false]])for(const top of [-100,80,height-60,height+200]){
  const target={left:width-70,top,bottom:top+44,width:60},panelHeight=240,pos=coachmarkPosition(target,{width,height,panelHeight,mobile});
  assert.ok(pos.left>=16);assert.ok(pos.left+pos.width<=width-16);assert.ok(pos.top>=16);assert.ok(pos.top+panelHeight<=height-(mobile?102:16));
 }
});

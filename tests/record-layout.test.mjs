import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountRecordLayout,layoutRowHandle,layoutToolbar,freshRecordLayout} from '../public/record-layout.mjs';
import {mergeLayoutOrder} from '../public/record-layout-model.mjs';
const tick=()=>new Promise(setImmediate);
test('moving a filtered subset leaves hidden rows in place and rejects missing, duplicate or foreign keys',()=>{
 assert.deepEqual(mergeLayoutOrder(['a','b','c','d'],['b','d'],['d','b']),['a','d','c','b']);for(const keys of [['b'],['b','b'],['b','foreign']])assert.throws(()=>mergeLayoutOrder(['a','b','c','d'],['b','d'],keys));
});
test('live filtered lists, keyboard moves, save failure and loader failure preserve the same layout state',async()=>{
 const {document,Event}=parseHTML('<main data-record-layout="loan-cards"></main>'),root=document.querySelector('main'),state=freshRecordLayout(),feedback=[],configs=[];let cleanup,fail=false,saves=0;
 const draw=()=>{cleanup?.();const keys=state.rowOrder.length?state.rowOrder:['loans:a','loans:b','loans:c'];root.innerHTML=layoutToolbar()+'<div data-layout-list>'+keys.map(key=>`<article data-layout-row="${key}">${layoutRowHandle(key)}</article>`).join('')+'</div>';cleanup=mountRecordLayout(root,state,{allKeys:()=>state.rowOrder.length?state.rowOrder:['loans:a','loans:b','loans:c'],onChange:draw,onSave:async()=>{saves++;if(fail)throw new Error('저장 충돌');},onFeedback:text=>feedback.push(text),loadSortable:async()=>({default:{create(node,config){configs.push({node,config});return{destroy(){}};}}})});};
 draw();await tick();root.querySelector('[data-layout-row="loans:b"]').remove();const drag=configs.at(-1);drag.node.prepend(drag.node.lastElementChild);drag.config.onEnd();await tick();assert.deepEqual(state.rowOrder,['loans:c','loans:b','loans:a']);const key=new Event('keydown',{bubbles:true,cancelable:true});key.key='ArrowDown';root.querySelector('.record-row-handle').dispatchEvent(key);await tick();assert.deepEqual(state.rowOrder,['loans:b','loans:c','loans:a']);
 fail=true;root.querySelector('[data-layout-save]').dispatchEvent(new Event('click',{bubbles:true}));await tick();assert.equal(saves,1);assert.ok(state.rowOrderDirty);assert.match(root.querySelector('[data-layout-message]').textContent,/저장 충돌/);fail=false;root.querySelector('[data-layout-save]').dispatchEvent(new Event('click',{bubbles:true}));await tick();assert.equal(state.rowOrderDirty,false);assert.equal(saves,2);cleanup();
 cleanup=mountRecordLayout(root,state,{allKeys:()=>state.rowOrder,onChange:()=>{},onSave:async()=>{},onFeedback:text=>feedback.push(text),loadSortable:async()=>{throw new Error('연결 실패');}});await tick();assert.match(feedback.at(-1),/드래그 연결 실패/);cleanup();
});

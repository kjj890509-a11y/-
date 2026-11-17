import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {samplePortfolio} from '../public/domain.mjs';
import {createEntryManagerState,stageEntryField,stageEntryRecord,applyEntryDrafts,renderEntryManager} from '../public/entry-manager.mjs';
test('batch patches merge untouched current fields, reject competing edits or deleted rows and never mutate the source',()=>{
 const p=samplePortfolio(),state=createEntryManagerState(),row=p.deposits[0],before=structuredClone(p);stageEntryField(state,p,'deposits',row.id,'balance','1,000');
 const updated=structuredClone(p);updated.deposits[0].note='다른 화면에서 저장한 메모';assert.equal(applyEntryDrafts(updated,state).deposits[0].note,'다른 화면에서 저장한 메모');assert.equal(applyEntryDrafts(updated,state).deposits[0].balance,1000);assert.deepEqual(p,before);
 updated.deposits[0].balance=3333;assert.throws(()=>applyEntryDrafts(updated,state),/같은 값이 바뀌었습니다/);assert.equal(state.drafts.size,1);updated.deposits.shift();assert.throws(()=>applyEntryDrafts(updated,state),/삭제되었습니다/);const missing=parseHTML(renderEntryManager(updated,state,{money:String,hidden:false})).document;assert.ok(missing.querySelector('[data-entry-undo="deposits:'+row.id+'"]'));assert.match(missing.querySelector('.entry-missing-drafts').textContent,/원본이 삭제/);
});
test('bulk validation keeps date, linked pension and numeric rules identical to individual edits',()=>{
 const p=samplePortfolio(),state=createEntryManagerState(),row=p.retirement[0];stageEntryField(state,p,'retirement',row.id,'monthlyContribution','300000');stageEntryField(state,p,'retirement',row.id,'contributionDate','');assert.throws(()=>applyEntryDrafts(p,state),/첫 납입 예정일/);stageEntryField(state,p,'retirement',row.id,'contributionDate','2027-02-30');assert.throws(()=>applyEntryDrafts(p,state),/첫 납입 예정일/);stageEntryField(state,p,'retirement',row.id,'contributionDate','2027-02-28');assert.equal(applyEntryDrafts(p,state).retirement[0].monthlyContribution,300000);
 stageEntryField(state,p,'retirement',row.id,'monthlyContribution','');assert.throws(()=>applyEntryDrafts(p,state),/숫자/);stageEntryField(state,p,'retirement',row.id,'monthlyContribution','1.5');assert.throws(()=>applyEntryDrafts(p,state),/숫자/);
 state.drafts.clear();stageEntryField(state,p,'deposits',p.deposits[0].id,'rate','4,2');assert.throws(()=>applyEntryDrafts(p,state),/숫자/);
 assert.throws(()=>stageEntryField(state,p,'deposits',p.deposits[0].id,'id','replacement'),/수정할 항목/);
});
test('manager escapes saved and pending text, masks every money field and renders real kind-specific controls',()=>{
 const p=samplePortfolio(),state=createEntryManagerState();p.deposits[0].name='<img src=x onerror=alert(1)>';stageEntryField(state,p,'deposits',p.deposits[0].id,'note','<script>bad()</script>');
 for(const category of ['all','cashflow','fixed','deposits','stocks','retirement','loans','cards']){
  state.category=category;const html=renderEntryManager(p,state,{money:()=> '••••••',hidden:true}),{document}=parseHTML(html);assert.equal(document.querySelectorAll('img,script').length,0);assert.ok(document.querySelector('table'));assert.equal(document.querySelectorAll('[data-entry-field=balance],[data-entry-field=amount],[data-entry-field=cost],[data-entry-field=valuation],[data-entry-field=monthlyContribution]').length,0);
 }
});

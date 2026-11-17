import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {emptyPortfolio,validatePortfolio,totals,eventsForMonth,todayKST} from '../public/domain.mjs';
import {createCardBillingState,saveCardAccount,setCardArchived,stageCardBill,applyCardBills,renderCardBilling} from '../public/card-billing.mjs';
import {handleApi} from '../server/api.mjs';
const account={id:'card-a',name:'현대 M',day:31,note:''};
const cardData=()=>saveCardAccount(emptyPortfolio(),account);
test('saved cards have no debt until an explicit monthly bill; each payment month keeps its own independent record',()=>{
 const p=cardData(),state=createCardBillingState();assert.equal(totals(p).cards,0);assert.equal(p.cards.length,0);
 state.month='2028-02';assert.match(renderCardBilling(p,state,{money:String}),/2028-02-29/);stageCardBill(state,p,account.id,'amount','123,400');const feb=applyCardBills(p,state,{createId:()=> 'feb-bill'});assert.equal(feb.cards[0].dueDate,'2028-02-29');assert.equal(feb.cards[0].cardAccountId,account.id);assert.equal(totals(feb).cards,123400);assert.equal(eventsForMonth(feb,'2028-02').filter(e=>e.type==='cards').length,1);
 state.drafts.clear();state.month='2028-03';assert.match(renderCardBilling(feb,state,{money:String}),/value="" placeholder="이번 달 청구액"/);stageCardBill(state,feb,account.id,'amount','567800');const march=applyCardBills(feb,state,{createId:()=> 'march-bill'});assert.equal(march.cards.length,2);assert.equal(march.cards[0].amount,123400);assert.equal(march.cards[1].dueDate,'2028-03-31');assert.equal(p.cards.length,0);
 state.drafts.clear();stageCardBill(state,march,account.id,'paid','true');const paid=applyCardBills(march,state);assert.equal(paid.cards.length,2);assert.equal(paid.cards[1].paid,true);assert.equal(totals(paid).cards,123400);assert.equal(totals(paid).deposits,0);
});
test('existing claims link by explicit selection without changing amounts, dates or creating duplicate month records',()=>{
 const p=emptyPortfolio();p.cards=[{id:'old',name:'기존 청구',amount:88000,dueDate:'2027-01-25',paid:false,note:'보존'}];const saved=saveCardAccount(p,account,{sourceBillId:'old'});assert.deepEqual(saved.cards[0],{...p.cards[0],cardAccountId:account.id});assert.equal(p.cardAccounts.length,0);
 const state=createCardBillingState();state.month='2027-01';stageCardBill(state,saved,account.id,'amount','99000');const next=applyCardBills(saved,state);assert.equal(next.cards.length,1);assert.equal(next.cards[0].id,'old');assert.equal(next.cards[0].note,'보존');assert.equal(next.cards[0].amount,99000);
 const duplicates=structuredClone(saved);duplicates.cards.push({...duplicates.cards[0],id:'dup'});assert.throws(()=>validatePortfolio(duplicates),/같은 결제 월/);duplicates.cards[1].cardAccountId='unknown';assert.throws(()=>validatePortfolio(duplicates),/연결한 내 카드/);
});
test('archiving and changing the default day preserve prior statements and old backups remain valid',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2027-02';stageCardBill(state,p,account.id,'amount','0');const saved=applyCardBills(p,state,{createId:()=> 'zero'});const archived=setCardArchived(saved,account.id,true);assert.deepEqual(archived.cards,saved.cards);assert.equal(archived.cardAccounts[0].archived,true);
 const renamed=saveCardAccount(archived,{...archived.cardAccounts[0],name:'새 카드 이름',day:15});assert.deepEqual(renamed.cards,saved.cards);assert.equal(renamed.cardAccounts[0].day,15);const legacy=emptyPortfolio();delete legacy.cardAccounts;assert.deepEqual(validatePortfolio(legacy).cardAccounts,[]);
 state.drafts.clear();state.month='2027-03';stageCardBill(state,archived,account.id,'amount','500');assert.throws(()=>applyCardBills(archived,state),/보관한 카드/);assert.equal(setCardArchived(archived,account.id,false).cardAccounts[0].archived,false);
 const pending=createCardBillingState();pending.month='2027-05';stageCardBill(pending,p,account.id,'amount','1000');const newDay=saveCardAccount(p,{...p.cardAccounts[0],day:15});assert.match(renderCardBilling(newDay,pending,{money:String}),/value="2027-05-31"/);assert.equal(applyCardBills(newDay,pending,{createId:()=> 'pending'}).cards[0].dueDate,'2027-05-31');
});
test('monthly drafts reject blank/fractional money, wrong payment months and competing edits without mutating source',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2027-01';stageCardBill(state,p,account.id,'dueDate','2027-01-15');assert.throws(()=>applyCardBills(p,state),/청구액/);stageCardBill(state,p,account.id,'amount','1.5');assert.throws(()=>applyCardBills(p,state),/원 단위/);stageCardBill(state,p,account.id,'amount','1000');stageCardBill(state,p,account.id,'dueDate','2027-02-15');assert.throws(()=>applyCardBills(p,state),/결제 월/);stageCardBill(state,p,account.id,'dueDate','2027-01-15');const saved=applyCardBills(p,state,{createId:()=> 'saved'});assert.equal(p.cards.length,0);
 state.drafts.clear();stageCardBill(state,saved,account.id,'amount','2000');const other=structuredClone(saved);other.cards[0].amount=3000;assert.throws(()=>applyCardBills(other,state),/다른 곳/);assert.equal(state.drafts.size,1);other.cards[0].amount=1000;other.cards[0].note='다른 메모';assert.equal(applyCardBills(other,state).cards[0].note,'다른 메모');
});
test('monthly table escapes profile names, masks amounts, and retains drafts for other months',()=>{
 const p=saveCardAccount(emptyPortfolio(),{...account,name:'<img src=x>'}),state=createCardBillingState();state.month='2027-01';stageCardBill(state,p,account.id,'amount','912345');state.month='2027-02';stageCardBill(state,p,account.id,'amount','777');const {document}=parseHTML(renderCardBilling(p,state,{money:()=>'••••••',hidden:true}));assert.equal(document.querySelector('img'),null);assert.equal(document.querySelector('[data-card-bill-field=amount]'),null);assert.match(document.querySelector('[data-card-bill-count]').textContent,/2건/);assert.doesNotMatch(document.documentElement.outerHTML,/912345/);
});
function database(){
 const db=new DatabaseSync(':memory:');
 for(const file of ['0000_assets.sql','0001_advisor_usage.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const DB={prepare(sql){return {bind(...v){return {
  async first(){return db.prepare(sql).get(...v)||null;},
  async run(){return {meta:{changes:Number(db.prepare(sql).run(...v).changes)}};}
 };}};}};
 return {db,DB};
}
const req=(method='GET',body,user='owner')=>new Request('https://moa.test/api/portfolio',{method,headers:{'oai-authenticated-user-id':user,Origin:'https://moa.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('account storage preserves fixed cards and links from old clients while enforcing revisions and backup round trips',async()=>{
 const {db,DB}=database(),state=createCardBillingState(),p=cardData();state.month=todayKST().slice(0,7);stageCardBill(state,p,account.id,'amount','123400');const data=applyCardBills(p,state,{createId:()=> 'persisted'});
 assert.equal((await handleApi(req('PUT',{data,revision:0}),{DB})).status,200);let saved=await(await handleApi(req(),{DB})).json();const legacy=structuredClone(saved.data);delete legacy.cardAccounts;delete legacy.cards[0].cardAccountId;legacy.cards[0].amount=333000;
 assert.equal((await handleApi(req('PUT',{data:legacy,revision:saved.revision}),{DB})).status,200);saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cardAccounts[0].id,account.id);assert.equal(saved.data.cards[0].cardAccountId,account.id);assert.equal(saved.data.cards[0].amount,333000);assert.deepEqual(validatePortfolio(JSON.parse(JSON.stringify(saved.data))),saved.data);
 assert.equal((await handleApi(req('PUT',{data,revision:1}),{DB})).status,409);assert.equal((await(await handleApi(req('GET',undefined,'other'),{DB})).json()).data.cardAccounts.length,0);
 const invalid=structuredClone(saved.data);delete invalid.cards[0].cardAccountId;for(const malformed of [null,{},[null]]){invalid.cardAccounts=malformed;assert.equal((await handleApi(req('PUT',{data:invalid,revision:saved.revision}),{DB})).status,400);}assert.equal((await(await handleApi(req(),{DB})).json()).revision,saved.revision);
 const backup=structuredClone(saved.data);backup.cardAccounts=[];delete backup.cards[0].cardAccountId;assert.equal((await handleApi(req('PUT',{data:backup,revision:saved.revision}),{DB})).status,200);const restored=await(await handleApi(req(),{DB})).json();assert.equal(restored.data.cardAccounts.length,0);assert.equal(restored.data.cards[0].cardAccountId,undefined);assert.equal(restored.data.cards[0].amount,333000);db.close();
});

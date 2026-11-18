import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {emptyPortfolio,validatePortfolio,totals,eventsForMonth,todayKST} from '../public/domain.mjs';
import {createCardBillingState,saveCardAccount,setCardArchived,stageCardBill,stageCardBillDeletion,stageSelectedCardBills,applyCardBills,renderCardBilling} from '../public/card-billing.mjs';
import {handleApi} from '../server/api.mjs';
const account={id:'card-a',name:'현대 M',day:31,note:''};
const cardData=()=>saveCardAccount(emptyPortfolio(),account);
test('saved cards have no debt until an explicit monthly bill; each billing month keeps its own independent record',()=>{
 const p=cardData(),state=createCardBillingState();assert.equal(totals(p).cards,0);assert.equal(p.cards.length,0);
 state.month='2028-02';assert.match(renderCardBilling(p,state,{money:String}),/2028-02-29/);stageCardBill(state,p,account.id,'amount','123,400');const feb=applyCardBills(p,state,{createId:()=> 'feb-bill'});assert.equal(feb.cards[0].dueDate,'2028-02-29');assert.equal(feb.cards[0].cardAccountId,account.id);assert.equal(totals(feb).cards,123400);assert.equal(eventsForMonth(feb,'2028-02').filter(e=>e.type==='cards').length,1);
 state.drafts.clear();state.month='2028-03';assert.match(renderCardBilling(feb,state,{money:String}),/value="" placeholder="이번 달 청구액"/);stageCardBill(state,feb,account.id,'amount','567800');const march=applyCardBills(feb,state,{createId:()=> 'march-bill'});assert.equal(march.cards.length,2);assert.equal(march.cards[0].amount,123400);assert.equal(march.cards[1].dueDate,'2028-03-31');assert.equal(p.cards.length,0);
 state.drafts.clear();stageCardBill(state,march,account.id,'paid','true');const paid=applyCardBills(march,state);assert.equal(paid.cards.length,2);assert.equal(paid.cards[1].paid,true);assert.equal(totals(paid).cards,123400);assert.equal(totals(paid).deposits,0);
});
test('existing claims link by explicit selection without changing amounts, dates or creating duplicate month records',()=>{
 const p=emptyPortfolio();p.cards=[{id:'old',name:'기존 청구',amount:88000,dueDate:'2027-01-25',paid:false,note:'보존'}];const saved=saveCardAccount(p,account,{sourceBillId:'old'});assert.deepEqual(saved.cards[0],{...p.cards[0],cardAccountId:account.id,billingMonth:'2027-01'});assert.equal(p.cardAccounts.length,0);
 const state=createCardBillingState();state.month='2027-01';stageCardBill(state,saved,account.id,'amount','99000');const next=applyCardBills(saved,state);assert.equal(next.cards.length,1);assert.equal(next.cards[0].id,'old');assert.equal(next.cards[0].note,'보존');assert.equal(next.cards[0].amount,99000);
 const duplicates=structuredClone(saved);duplicates.cards.push({...duplicates.cards[0],id:'dup'});assert.throws(()=>validatePortfolio(duplicates),/같은 청구 월/);duplicates.cards[1].cardAccountId='unknown';assert.throws(()=>validatePortfolio(duplicates),/연결한 내 카드/);
});
test('archiving and changing the default day preserve prior statements and old backups remain valid',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2027-02';stageCardBill(state,p,account.id,'amount','0');const saved=applyCardBills(p,state,{createId:()=> 'zero'});const archived=setCardArchived(saved,account.id,true);assert.deepEqual(archived.cards,saved.cards);assert.equal(archived.cardAccounts[0].archived,true);
 const renamed=saveCardAccount(archived,{...archived.cardAccounts[0],name:'새 카드 이름',day:15});assert.deepEqual(renamed.cards,saved.cards);assert.equal(renamed.cardAccounts[0].day,15);const legacy=emptyPortfolio();delete legacy.cardAccounts;assert.deepEqual(validatePortfolio(legacy).cardAccounts,[]);
 state.drafts.clear();state.month='2027-03';stageCardBill(state,archived,account.id,'amount','500');assert.throws(()=>applyCardBills(archived,state),/보관한 카드/);assert.equal(setCardArchived(archived,account.id,false).cardAccounts[0].archived,false);
 const pending=createCardBillingState();pending.month='2027-05';stageCardBill(pending,p,account.id,'amount','1000');const newDay=saveCardAccount(p,{...p.cardAccounts[0],day:15});assert.match(renderCardBilling(newDay,pending,{money:String}),/value="2027-05-31"/);assert.equal(applyCardBills(newDay,pending,{createId:()=> 'pending'}).cards[0].dueDate,'2027-05-31');
});
test('monthly drafts reject blank/fractional money, invalid dates and competing edits without mutating source',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2027-01';stageCardBill(state,p,account.id,'dueDate','2027-01-15');assert.throws(()=>applyCardBills(p,state),/청구액/);stageCardBill(state,p,account.id,'amount','1.5');assert.throws(()=>applyCardBills(p,state),/원 단위/);stageCardBill(state,p,account.id,'amount','1000');stageCardBill(state,p,account.id,'dueDate','2027-02-30');assert.throws(()=>applyCardBills(p,state),/결제일/);stageCardBill(state,p,account.id,'dueDate','2027-02-15');const saved=applyCardBills(p,state,{createId:()=> 'saved'});assert.equal(p.cards.length,0);
 state.drafts.clear();stageCardBill(state,saved,account.id,'amount','2000');const other=structuredClone(saved);other.cards[0].amount=3000;assert.throws(()=>applyCardBills(other,state),/다른 곳/);assert.equal(state.drafts.size,1);other.cards[0].amount=1000;other.cards[0].note='다른 메모';assert.equal(applyCardBills(other,state).cards[0].note,'다른 메모');
});
test('monthly table escapes profile names, masks amounts, and retains drafts for other months',()=>{
 const p=saveCardAccount(emptyPortfolio(),{...account,name:'<img src=x>'}),state=createCardBillingState();state.month='2027-01';stageCardBill(state,p,account.id,'amount','912345');state.month='2027-02';stageCardBill(state,p,account.id,'amount','777');const {document}=parseHTML(renderCardBilling(p,state,{money:()=>'••••••',hidden:true}));assert.equal(document.querySelector('img'),null);assert.equal(document.querySelector('[data-card-bill-field=amount]'),null);assert.match(document.querySelector('[data-card-bill-count]').textContent,/2건/);assert.doesNotMatch(document.documentElement.outerHTML,/912345/);
});
function database(){
 const db=new DatabaseSync(':memory:');let reads=0;
 for(const file of ['0000_assets.sql','0001_advisor_usage.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const DB={prepare(sql){return {bind(...v){return {
  async first(){reads++;return db.prepare(sql).get(...v)||null;},
  async run(){return {meta:{changes:Number(db.prepare(sql).run(...v).changes)}};}
 };}};}};
 return {db,DB,get reads(){return reads;}};
}
const req=(method='GET',body,user='owner')=>new Request('https://moa.test/api/portfolio',{method,headers:{'oai-authenticated-user-id':user,Origin:'https://moa.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('account storage preserves fixed cards and links from old clients while enforcing revisions and backup round trips',async()=>{
 const {db,DB}=database(),state=createCardBillingState(),p=cardData();state.month=todayKST().slice(0,7);stageCardBill(state,p,account.id,'amount','123400');const data=applyCardBills(p,state,{createId:()=> 'persisted'});
 assert.equal((await handleApi(req('PUT',{data,revision:0}),{DB})).status,200);let saved=await(await handleApi(req(),{DB})).json();const legacy=structuredClone(saved.data);delete legacy.cardAccounts;delete legacy.cards[0].cardAccountId;delete legacy.cards[0].billingMonth;legacy.cards[0].amount=333000;legacy.cards[0].dueDate='2028-12-10';
 assert.equal((await handleApi(req('PUT',{data:legacy,revision:saved.revision}),{DB})).status,200);saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cardAccounts[0].id,account.id);assert.equal(saved.data.cards[0].cardAccountId,account.id);assert.equal(saved.data.cards[0].amount,333000);assert.equal(saved.data.cards[0].dueDate,'2028-12-10');assert.equal(saved.data.cards[0].billingMonth,state.month);assert.deepEqual(validatePortfolio(JSON.parse(JSON.stringify(saved.data))),saved.data);
 assert.equal((await handleApi(req('PUT',{data,revision:1}),{DB})).status,409);assert.equal((await(await handleApi(req('GET',undefined,'other'),{DB})).json()).data.cardAccounts.length,0);
 const invalid=structuredClone(saved.data);delete invalid.cards[0].cardAccountId;for(const malformed of [null,{},[null]]){invalid.cardAccounts=malformed;assert.equal((await handleApi(req('PUT',{data:invalid,revision:saved.revision}),{DB})).status,400);}assert.equal((await(await handleApi(req(),{DB})).json()).revision,saved.revision);
 const backup=structuredClone(saved.data);backup.cardAccounts=[];delete backup.cards[0].cardAccountId;assert.equal((await handleApi(req('PUT',{data:backup,revision:saved.revision}),{DB})).status,200);const restored=await(await handleApi(req(),{DB})).json();assert.equal(restored.data.cardAccounts.length,0);assert.equal(restored.data.cards[0].cardAccountId,undefined);assert.equal(restored.data.cards[0].amount,333000);db.close();
});

test('billing month is independent of the actual payment date and drives only statement grouping',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2026-11';stageCardBill(state,p,account.id,'amount','39180');stageCardBill(state,p,account.id,'dueDate','2026-12-13');const saved=applyCardBills(p,state,{createId:()=> 'nov'});
 assert.equal(saved.cards[0].billingMonth,'2026-11');assert.equal(saved.cards[0].dueDate,'2026-12-13');assert.equal(eventsForMonth(saved,'2026-11').filter(e=>e.type==='cards').length,0);assert.equal(eventsForMonth(saved,'2026-12').filter(e=>e.type==='cards').length,1);
 state.drafts.clear();assert.match(renderCardBilling(saved,state,{money:String}),/39,180/);state.month='2026-12';assert.match(renderCardBilling(saved,state,{money:String}),/value="" placeholder="이번 달 청구액"/);stageCardBill(state,saved,account.id,'amount','1000');stageCardBill(state,saved,account.id,'dueDate','2026-12-13');const next=applyCardBills(saved,state,{createId:()=> 'dec'});assert.equal(next.cards.length,2);assert.deepEqual(next.cards.map(row=>row.billingMonth),['2026-11','2026-12']);
 const legacy=structuredClone(saved);delete legacy.cards[0].billingMonth;assert.equal(validatePortfolio(legacy).cards[0].billingMonth,'2026-12');legacy.cards[0].billingMonth='2026-13';assert.throws(()=>validatePortfolio(legacy),/청구 월/);
});
test('row deletion clears new input or stages one existing statement without removing its card or other months',()=>{
 const p=cardData(),state=createCardBillingState();state.month='2027-01';stageCardBill(state,p,account.id,'amount','100');stageCardBillDeletion(state,p,account.id);assert.equal(state.drafts.size,0);assert.deepEqual(applyCardBills(p,state),p);
 stageCardBill(state,p,account.id,'amount','100');let saved=applyCardBills(p,state,{createId:()=> 'jan'});state.drafts.clear();state.month='2027-02';stageCardBill(state,saved,account.id,'amount','200');saved=applyCardBills(saved,state,{createId:()=> 'feb'});state.drafts.clear();state.month='2027-01';stageCardBillDeletion(state,saved,account.id);
 assert.equal(saved.cards.length,2);const html=parseHTML(renderCardBilling(saved,state,{money:String})).document;assert.equal(html.querySelector('[data-card-bill-status]').textContent,'삭제 예정');assert.ok(html.querySelector('[data-card-bill-field=amount]').disabled);assert.ok(!html.querySelector('[data-card-bill-undo]').hidden);
 const other=structuredClone(saved);other.cards[0].note='다른 기기 수정';assert.throws(()=>applyCardBills(other,state),/다른 곳/);other.cards.shift();assert.throws(()=>applyCardBills(other,state),/추가되거나 삭제/);
 const next=applyCardBills(saved,state);assert.deepEqual(next.cardAccounts,saved.cardAccounts);assert.deepEqual(next.cards,[saved.cards[1]]);assert.equal(saved.cards.length,2);
});
test('the real portfolio API persists cross-month statements and scoped deletion without resurrecting them',async()=>{
 const {db,DB}=database(),state=createCardBillingState(),p=cardData();state.month='2026-11';stageCardBill(state,p,account.id,'amount','39180');stageCardBill(state,p,account.id,'dueDate','2026-12-13');let data=applyCardBills(p,state,{createId:()=> 'nov'});state.drafts.clear();state.month='2026-12';stageCardBill(state,data,account.id,'amount','50000');stageCardBill(state,data,account.id,'dueDate','2026-12-13');data=applyCardBills(data,state,{createId:()=> 'dec'});
 assert.equal((await handleApi(req('PUT',{data,revision:0}),{DB})).status,200);let saved=await(await handleApi(req(),{DB})).json();assert.deepEqual(saved.data.cards.map(row=>[row.billingMonth,row.dueDate]),[['2026-11','2026-12-13'],['2026-12','2026-12-13']]);state.drafts.clear();state.month='2026-11';stageCardBillDeletion(state,saved.data,account.id);data=applyCardBills(saved.data,state);assert.equal((await handleApi(req('PUT',{data,revision:saved.revision}),{DB})).status,200);saved=await(await handleApi(req(),{DB})).json();assert.deepEqual(saved.data.cardAccounts,data.cardAccounts);assert.deepEqual(saved.data.cards,data.cards);assert.equal(saved.data.cards[0].id,'dec');db.close();
});
test('first save of a pre-upgrade bill pins its stored month even when an older client changes the payment date',async()=>{
 const {db,DB}=database(),p=cardData();p.cards=[{id:'legacy',name:'기존 청구',amount:1000,dueDate:'2026-11-13',paid:false,note:'',cardAccountId:account.id}];db.prepare('INSERT INTO portfolios(user_id,data,revision,updated_at) VALUES(?,?,?,?)').run('owner',JSON.stringify(p),7,'2026-11-01T00:00:00Z');
 const data=structuredClone(p);data.cards[0].dueDate='2026-12-13';assert.equal((await handleApi(req('PUT',{data,revision:7}),{DB})).status,200);const saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cards[0].billingMonth,'2026-11');assert.equal(saved.data.cards[0].dueDate,'2026-12-13');db.close();
});

test('bulk edits change only selected cards and payment month shifts keep each day with leap-month clamping',()=>{
 let p=cardData();p=saveCardAccount(p,{id:'card-b',name:'카드 B',day:10,note:''});p=saveCardAccount(p,{id:'card-c',name:'카드 C',day:25,note:''});const state=createCardBillingState();state.month='2028-01';for(const row of p.cardAccounts)stageCardBill(state,p,row.id,'amount','1000');let index=0;p=applyCardBills(p,state,{createId:()=> 'bill-'+(++index)});state.drafts.clear();const before=structuredClone(p);
 state.selected.add(account.id);state.selected.add('card-b');assert.equal(stageSelectedCardBills(state,p,'paymentMonth','2028-02'),2);let next=applyCardBills(p,state);assert.deepEqual(next.cards.map(row=>row.dueDate),['2028-02-29','2028-02-10','2028-01-25']);assert.ok(next.cards.every(row=>row.billingMonth==='2028-01'));
 stageSelectedCardBills(state,p,'paid','true');stageSelectedCardBills(state,p,'amount','0');next=applyCardBills(p,state);assert.deepEqual(next.cards.map(row=>[row.amount,row.paid]),[[0,true],[0,true],[1000,false]]);assert.deepEqual(p,before);
 const pending=structuredClone([...state.drafts]);assert.throws(()=>stageSelectedCardBills(state,p,'dueDate','2028-02-30'),/결제일/);assert.deepEqual([...state.drafts],pending);assert.throws(()=>stageSelectedCardBills(state,p,'amount','-1'),/원 단위/);assert.deepEqual([...state.drafts],pending);state.selected.clear();assert.throws(()=>stageSelectedCardBills(state,p,'paid','true'),/선택/);
});
test('bulk deletion clears selected drafts and statements while preserving card profiles',()=>{
 let p=saveCardAccount(cardData(),{id:'card-b',name:'카드 B',day:10,note:''});const state=createCardBillingState();state.month='2028-01';stageCardBill(state,p,account.id,'amount','1234');p=applyCardBills(p,state,{createId:()=> 'existing'});state.drafts.clear();stageCardBill(state,p,'card-b','amount','5678');state.selected.add(account.id);state.selected.add('card-b');stageSelectedCardBills(state,p,'delete');assert.equal(state.selected.size,0);assert.equal(state.drafts.size,1);assert.ok(state.drafts.get('2028-01:'+account.id).deleted);const next=applyCardBills(p,state);assert.equal(next.cards.length,0);assert.deepEqual(next.cardAccounts,p.cardAccounts);assert.equal(p.cards.length,1);
});
test('a legacy portfolio save shares one database read across compatibility upgrades',async()=>{
 const fixture=database(),{db,DB}=fixture,state=createCardBillingState();let p=cardData();state.month='2028-01';stageCardBill(state,p,account.id,'amount','1234');p=applyCardBills(p,state,{createId:()=> 'legacy'});assert.equal((await handleApi(req('PUT',{data:p,revision:0}),{DB})).status,200);
 const legacy=structuredClone(p);for(const key of ['dashboard','cardAccounts','cashflow','fixed','budgets','snapshots','loanPayments'])delete legacy[key];delete legacy.cards[0].cardAccountId;delete legacy.cards[0].billingMonth;const before=fixture.reads;assert.equal((await handleApi(req('PUT',{data:legacy,revision:1}),{DB})).status,200);assert.equal(fixture.reads-before,1);const saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cards[0].cardAccountId,account.id);assert.equal(saved.data.cards[0].billingMonth,'2028-01');db.close();
});

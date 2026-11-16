import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {emptyPortfolio,validatePortfolio,samplePortfolio,totals,eventsForMonth,todayKST,paymentDate,cashflowForMonth,monthlyFlow,budgetPlan,forecastMonths,recordCurrentSnapshot,snapshotTotals,captureSnapshot,shiftMonth,fixedForMonth,interestForLoan,loanSchedule} from '../public/domain.mjs';
import {handleApi} from '../server/api.mjs';
test('net worth subtracts loan balances and only unpaid cards',()=>{
 const data=samplePortfolio('2026-11-16');const t=totals(data);
 assert.equal(t.gross,131050000);assert.equal(t.debt,71180000);assert.equal(t.net,59870000);
 data.cards[0].paid=true;assert.equal(totals(data).net,60724000);
 assert.equal(t.monthlyPrincipal+t.monthlyInterest,721000);
});
test('month-end repayments clamp to February and leap years',()=>{
 assert.equal(paymentDate('2027-02',31),'2027-02-28');assert.equal(paymentDate('2028-02',31),'2028-02-29');
 const p=samplePortfolio('2026-11-16');p.loans[0].day=31;
 assert.equal(eventsForMonth(p,'2027-02').find(e=>e.id==='demo-l1').date,'2027-02-28');
 assert.equal(eventsForMonth(p,'2027-02').filter(e=>e.type==='cards').length,0);
});
test('Korean dates use Asia/Seoul at midnight boundary',()=>assert.equal(todayKST(new Date('2026-11-16T16:00:00Z')),'2026-11-17'));
test('monthly income and expenses include loans and unpaid cards without changing asset balances',()=>{
 const p=samplePortfolio('2026-11-16'),f=monthlyFlow(p,'2026-11');
 assert.equal(f.salary,4200000);assert.equal(f.otherIncome,450000);assert.equal(f.otherExpense,600000);
 assert.equal(f.payments,1901000);assert.equal(f.income,4650000);assert.equal(f.expense,2501000);assert.equal(f.balance,2149000);
 const net=totals(p).net;p.cashflow[0].amount=9000000;assert.equal(totals(p).net,net);
 p.cards[0].paid=true;assert.equal(monthlyFlow(p,'2026-11').payments,1047000);
});
test('recurring cashflow starts in the selected month and clamps month-end while one-offs stay in their month',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'salary',name:'월급',type:'salary',amount:3000000,date:'2027-01-31',repeat:'monthly',note:''},{id:'bonus',name:'성과급',type:'other_income',amount:1000000,date:'2027-01-20',repeat:'once',note:''}];
 assert.equal(cashflowForMonth(p,'2026-12').length,0);
 assert.equal(cashflowForMonth(p,'2027-01').length,2);
 assert.equal(cashflowForMonth(p,'2027-02')[0].occursOn,'2027-02-28');
 assert.equal(cashflowForMonth(p,'2028-02')[0].occursOn,'2028-02-29');
 assert.equal(monthlyFlow(p,'2027-02').income,3000000);
 const event=eventsForMonth(p,'2027-02')[0];assert.equal(event.income,true);assert.equal(event.flowType,'salary');
});
test('old backups retain assets and invalid income or expense data is rejected',()=>{
 const old=samplePortfolio('2026-11-16');delete old.cashflow;
 const migrated=validatePortfolio(old);assert.deepEqual(migrated.cashflow,[]);assert.equal(totals(migrated).net,59870000);
 for(const patch of [{type:'unknown'},{repeat:'weekly'},{amount:-1},{date:'2027-02-30'}]){
  const p=samplePortfolio('2026-11-16');Object.assign(p.cashflow[0],patch);assert.throws(()=>validatePortfolio(p));
 }
});
test('reject malformed financial data and strip unrelated properties',()=>{
 let p=samplePortfolio('2026-11-16');p.loans[0].balance=-1;assert.throws(()=>validatePortfolio(p));
 p=samplePortfolio('2026-11-16');p.cards[0].dueDate='2026-02-30';assert.throws(()=>validatePortfolio(p));
 p=samplePortfolio('2026-11-16');p.stocks[0].valuation='1000';assert.throws(()=>validatePortfolio(p));
 p=samplePortfolio('2026-11-16');p.loans[0].day=0;assert.throws(()=>validatePortfolio(p));
 p=samplePortfolio('2026-11-16');p.untrusted='drop';assert.equal(validatePortfolio(p).untrusted,undefined);
});
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_assets.sql',import.meta.url),'utf8'));
 return {prepare(sql){return{bind(...args){return{async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};}};
}
function req(user,method='GET',body,origin='https://moa.test'){
 const headers={'Content-Type':'application/json',Origin:origin};if(user)headers['oai-authenticated-user-id']=user;
 return new Request('https://moa.test/api/portfolio',{method,headers,body:body?JSON.stringify(body):undefined});
}
test('persistent API separates users, rejects anonymous writes and detects stale updates',async()=>{
 const env={DB:database()};assert.equal((await handleApi(req(null),env)).status,401);
 const first=await (await handleApi(req('alice'),env)).json();assert.equal(first.revision,0);
 const data=samplePortfolio('2026-11-16');let response=await handleApi(req('alice','PUT',{data,revision:0}),env);assert.equal(response.status,200);
 assert.equal((await (await handleApi(req('alice'),env)).json()).data.stocks.length,2);
 assert.equal((await (await handleApi(req('bob'),env)).json()).data.stocks.length,0);
 assert.equal((await handleApi(req('alice','PUT',{data,revision:0}),env)).status,409);
 assert.equal((await handleApi(req('alice','PUT',{data,revision:1},'https://evil.test'),env)).status,403);
 assert.equal((await handleApi(req('alice','PUT',{data:emptyPortfolio(),revision:1}),env)).status,200);
 assert.equal((await (await handleApi(req('alice'),env)).json()).revision,2);
});
test('legacy clients preserve new cashflow records when saving their existing asset fields',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16');
 assert.equal((await handleApi(req('alice','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.cashflow;legacy.deposits[0].balance=123456;
 assert.equal((await handleApi(req('alice','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await (await handleApi(req('alice'),env)).json();assert.equal(saved.data.cashflow.length,3);assert.equal(saved.data.deposits[0].balance,123456);
});

test('monthly budgets count paid cards as spending and stay independent by month',()=>{
 const p=samplePortfolio('2026-11-16');p.cards[0].paid=true;
 const plan=budgetPlan(p,'2026-11');assert.equal(plan.expense,2501000);assert.equal(plan.limit,3000000);assert.equal(plan.remaining,499000);
 p.budgets.push({month:'2027-05',expenseLimit:1000000,savingsTarget:0});assert.equal(budgetPlan(p,'2027-05').limit,1000000);
 assert.equal(budgetPlan(p,'2027-06').limit,null);
});
test('forecast pays principal and card liabilities without subtracting the debt twice from net worth',()=>{
 const p=emptyPortfolio();p.deposits=[{id:'d',name:'통장',institution:'',balance:1000000,rate:0,maturity:'',note:''}];
 p.loans=[{id:'l',name:'대출',institution:'',balance:200000,principal:150000,interest:10000,rate:5,day:25,method:'원금균등',note:''}];
 p.cards=[{id:'c',name:'카드',amount:100000,dueDate:'2026-11-24',paid:false,note:''}];
 const [nov,dec,jan]=forecastMonths(p,'2026-11-16',3);
 assert.equal(totals(p).net,700000);assert.equal(nov.deposits,740000);assert.equal(nov.loans,50000);assert.equal(nov.cards,0);assert.equal(nov.net,690000);
 assert.equal(dec.principal,50000);assert.equal(dec.loans,0);assert.equal(dec.net,680000);assert.equal(jan.interest,0);assert.equal(jan.net,680000);
});
test('forecast uses only events after the baseline date, retains overdue card debt and flags cash shortages',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'s',name:'월급',type:'salary',amount:100,date:'2026-11-10',repeat:'monthly',note:''},{id:'e',name:'지출',type:'expense',amount:200,date:'2026-11-30',repeat:'once',note:''}];
 p.cards=[{id:'c',name:'미결제',amount:50,dueDate:'2026-11-15',paid:false,note:''}];
 const [nov,dec]=forecastMonths(p,'2026-11-16',2);assert.equal(nov.income,0);assert.equal(nov.deposits,-200);assert.equal(nov.cards,50);assert.equal(nov.net,-250);assert.equal(nov.cashShortage,true);assert.equal(dec.income,100);
});
test('auto history updates only the current month and preserves manual month-end records',()=>{
 let p=validatePortfolio(samplePortfolio('2026-11-16'));
 p=recordCurrentSnapshot(p,'2026-11-16');const before=structuredClone(p.snapshots[0]);assert.equal(p.snapshots.at(-1).asOf,'2026-11-16');
 p.deposits[0].balance+=500;let next=recordCurrentSnapshot(p,'2026-11-17');assert.equal(next.snapshots.at(-1).deposits,p.snapshots.at(-1).deposits+500);assert.deepEqual(next.snapshots[0],before);
 next.snapshots.at(-1).source='manual';const fixed=structuredClone(next.snapshots.at(-1));next.deposits[0].balance+=1000;next=recordCurrentSnapshot(next,'2026-11-18');assert.deepEqual(next.snapshots.at(-1),fixed);
 assert.equal(snapshotTotals(fixed).net,fixed.stock+fixed.deposits+fixed.retirement-fixed.loans-fixed.cards);
});
test('legacy backups gain empty plans and history; duplicate months and future actuals are rejected',()=>{
 const p=samplePortfolio('2026-11-16');delete p.budgets;delete p.snapshots;const clean=validatePortfolio(p);assert.deepEqual(clean.budgets,[]);assert.deepEqual(clean.snapshots,[]);
 clean.budgets=[{month:'2026-11',expenseLimit:0,savingsTarget:0},{month:'2026-11',expenseLimit:1,savingsTarget:1}];assert.throws(()=>validatePortfolio(clean));
 clean.budgets=[];clean.snapshots=[{...captureSnapshot(clean),month:shiftMonth(todayKST().slice(0,7),1),asOf:shiftMonth(todayKST().slice(0,7),1)+'-01'}];assert.throws(()=>validatePortfolio(clean));
});
test('API preserves budgets and history when a legacy client saves asset updates',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16');assert.equal((await handleApi(req('owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.budgets;delete legacy.snapshots;legacy.deposits[0].balance=300;
 assert.equal((await handleApi(req('owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('owner'),env)).json();assert.equal(saved.data.budgets.length,4);assert.equal(saved.data.snapshots.filter(r=>r.source==='manual').length,4);assert.equal(saved.data.snapshots.at(-1).source,'auto');
});

test('fixed expenses respect inclusive start/end months and clamp the monthly payment day',()=>{
 const p=emptyPortfolio();p.fixed=[{id:'f',name:'보험료',amount:100,day:31,startMonth:'2027-01',endMonth:'2027-03',paymentSource:'account',note:''}];
 assert.equal(fixedForMonth(p,'2026-12').length,0);assert.equal(fixedForMonth(p,'2027-01').length,1);assert.equal(fixedForMonth(p,'2027-02')[0].occursOn,'2027-02-28');assert.equal(fixedForMonth(p,'2027-03').length,1);assert.equal(fixedForMonth(p,'2027-04').length,0);
 assert.equal(eventsForMonth(p,'2027-02')[0].amount,100);
 for(const change of [{day:0},{startMonth:'2027-13'},{endMonth:'2026-12'},{paymentSource:'unknown'},{amount:-1}]){const copy=structuredClone(p);Object.assign(copy.fixed[0],change);assert.throws(()=>validatePortfolio(copy));}
});
test('account fixed expenses enter budgets and forecasts once while card-included fixed expenses stay informational',()=>{
 const p=emptyPortfolio();p.fixed=[{id:'a',name:'월세',amount:1000,day:25,startMonth:'2026-11',endMonth:'',paymentSource:'account',note:''},{id:'b',name:'통신비',amount:100,day:20,startMonth:'2026-11',endMonth:'',paymentSource:'card',note:''}];
 p.cards=[{id:'card',name:'카드',amount:300,dueDate:'2026-11-26',paid:false,note:''}];
 const f=monthlyFlow(p,'2026-11');assert.equal(f.fixedTotal,1100);assert.equal(f.fixedCash,1000);assert.equal(f.fixedCard,100);assert.equal(f.expense,1300);assert.equal(budgetPlan(p,'2026-11').expense,1300);
 const projection=forecastMonths(p,'2026-11-16',1)[0];assert.equal(projection.fixedCash,1000);assert.equal(projection.expense,1300);
 p.cards[0].paid=true;assert.equal(budgetPlan(p,'2026-11').expense,1300);assert.equal(monthlyFlow(p,'2026-11').expense,1000);
});
test('automatic loan interest is recomputed on the server while existing manual interest remains unchanged',()=>{
 const p=samplePortfolio('2026-11-16');p.loans[0]={...p.loans[0],balance:12000000,rate:12,interestMode:'estimate',interest:999999};
 const clean=validatePortfolio(p);assert.equal(clean.loans[0].interest,120000);assert.equal(clean.loans[1].interestMode,'manual');assert.equal(clean.loans[1].interest,34000);
 assert.equal(interestForLoan({...clean.loans[0],balance:0}),0);
 clean.loans[0].interestMode='invalid';assert.throws(()=>validatePortfolio(clean));
});
test('estimated interest declines with equal-principal repayments and paid-off loans stop charging interest',()=>{
 const p=samplePortfolio('2026-11-16');p.loans=[{...p.loans[0],balance:1200,principal:400,rate:12,interestMode:'estimate',method:'원금균등'}];
 const rows=loanSchedule(p,'2026-11',4);assert.deepEqual(rows.map(r=>r.interest),[12,8,4,0]);assert.deepEqual(rows.map(r=>r.payment),[412,408,404,0]);assert.equal(rows[2].balance,0);
 p.loans[0].balance=0;assert.equal(totals(p).monthlyInterest,0);assert.equal(totals(p).monthlyPrincipal,0);
});
test('estimated annuity repayments hold the total payment and cap the final principal',()=>{
 const p=samplePortfolio('2026-11-16');p.loans=[{...p.loans[0],balance:1200,principal:400,rate:12,interestMode:'estimate',method:'원리금균등'}];
 const rows=loanSchedule(p,'2026-11',4);assert.deepEqual(rows.map(r=>r.interest),[12,8,4,0]);assert.deepEqual(rows.map(r=>r.principal),[400,404,396,0]);assert.deepEqual(rows.map(r=>r.payment),[412,412,400,0]);
 const projection=forecastMonths(p,'2026-11-16',3);assert.deepEqual(projection.map(r=>r.interest),[12,8,4]);
});
test('legacy backups and clients retain fixed expenses and loan calculation modes',async()=>{
 const data=samplePortfolio('2026-11-16');delete data.fixed;assert.deepEqual(validatePortfolio(data).fixed,[]);
 const env={DB:database()};data.fixed=[{id:'f',name:'보험료',amount:5000,day:25,startMonth:'2026-11',endMonth:'',paymentSource:'account',note:''}];data.loans[0].interestMode='estimate';
 assert.equal((await handleApi(req('fixed-owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.fixed;delete legacy.loans[0].interestMode;legacy.loans[0].balance=30000000;
 assert.equal((await handleApi(req('fixed-owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('fixed-owner'),env)).json();assert.equal(saved.data.fixed.length,1);assert.equal(saved.data.loans[0].interestMode,'estimate');assert.equal(saved.data.loans[0].interest,105000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {emptyPortfolio,validatePortfolio,samplePortfolio,totals,eventsForMonth,todayKST,paymentDate,cashflowForMonth,monthlyFlow,budgetPlan,forecastMonths,recordCurrentSnapshot,snapshotTotals,captureSnapshot,shiftMonth,fixedForMonth,interestForLoan,loanSchedule,forecastOnDates,paydayForecasts,scheduledCashflows,retirementContributionsForMonth} from '../public/domain.mjs';
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
test('repayment history round-trips by account and survives older clients without changing current balances',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16'),before=totals(data);
 data.loanPayments=[{id:'payment',loanId:'demo-l1',name:'주택담보대출',institution:'신한은행',date:'2026-01-25',principal:320000,interest:220000,note:'실제 상환'}];
 assert.equal((await handleApi(req('history-owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.loanPayments;
 assert.equal((await handleApi(req('history-owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('history-owner'),env)).json();
 assert.equal(saved.data.loanPayments.length,1);assert.deepEqual(totals(saved.data),before);
 assert.equal((await(await handleApi(req('other-owner'),env)).json()).data.loanPayments.length,0);
 assert.equal(validatePortfolio(legacy).loanPayments.length,0);
 for(const patch of [{date:'2199-01-01'},{principal:-1},{interest:'100'},{name:''},{institution:''}]){
  const invalid=structuredClone(data);Object.assign(invalid.loanPayments[0],patch);assert.throws(()=>validatePortfolio(invalid));
 }
});
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
test('monthly actuals replace living expenses only and never reduce the current balance twice',()=>{
 const p=emptyPortfolio(),month='2026-11',start='2026-11-16';
 p.deposits=[{id:'d',name:'생활비 통장',balance:2000000,rate:0}];
 p.fixed=[{id:'rent',name:'월세',amount:700000,day:25,startMonth:month,paymentSource:'account'}];
 p.cashflow=[
  {id:'salary',name:'월급',type:'salary',amount:3000000,date:month+'-27',repeat:'monthly'},
  {id:'other',name:'기타 생활비',type:'expense',amount:100000,date:month+'-24',repeat:'monthly'}
 ];
 p.loans=[{id:'l',name:'대출',balance:500000,principal:50000,rate:0,interest:0,day:25,method:'원금균등'}];
 p.cards=[
  {id:'paid',name:'결제 완료 카드',amount:100000,dueDate:month+'-14',paid:true,note:''},
  {id:'pending',name:'미결제 카드',amount:200000,dueDate:month+'-22',paid:false,note:''}
 ];
 p.budgets=[{month,expenseLimit:1300000,savingsTarget:0}];
 p.actualSpending=[{month,amount:900000,applied:false}];
 const baseline=totals(p);
 const before=forecastMonths(p,start,2);
 assert.equal(budgetPlan(p,month).expense,1150000);
 assert.equal(before[0].expense,1050000);
 p.actualSpending[0].applied=true;
 const applied=budgetPlan(p,month),after=forecastMonths(p,start,2);
 assert.equal(applied.livingExpense,900000);
 assert.equal(applied.expense,1250000);
 assert.equal(applied.remaining,50000);
 assert.equal(applied.fixedCash,700000);
 assert.equal(after[0].expense,250000);
 assert.equal(after[0].deposits,4750000);
 assert.equal(paydayForecasts(p,start,1)[0].deposits,4750000);
 assert.equal(after[1].expense,before[1].expense);
 assert.equal(budgetPlan(p,'2026-12').livingExpense,800000);
 assert.deepEqual(totals(p),baseline);
 assert.deepEqual(forecastMonths(p,'2026-12-01',1),forecastMonths({...p,actualSpending:[]},'2026-12-01',1));
 p.actualSpending[0].amount=0;
 assert.equal(budgetPlan(p,month).expense,350000);
 p.actualSpending[0].applied=false;
 assert.deepEqual(forecastMonths(p,start,2),before);
});
test('monthly actuals validate amounts and keep one entry per month',()=>{
 const data=emptyPortfolio(),month=todayKST().slice(0,7),record={month,amount:0,applied:false};
 delete data.actualSpending;
 assert.deepEqual(validatePortfolio(data).actualSpending,[]);
 assert.deepEqual(validatePortfolio({...data,actualSpending:[record]}).actualSpending,[record]);
 assert.throws(()=>validatePortfolio({...data,actualSpending:[record,record]}),/월별 기록/);
 for(const patch of [{amount:-1},{amount:1.5},{applied:'false'},{month:shiftMonth(month,1)}]){
  assert.throws(()=>validatePortfolio({...data,actualSpending:[{...record,...patch}]}));
 }
});
test('forecast pays principal and card liabilities without subtracting the debt twice from net worth',()=>{
 const p=emptyPortfolio();p.deposits=[{id:'d',name:'통장',institution:'',balance:1000000,rate:0,maturity:'',note:''}];
 p.loans=[{id:'l',name:'대출',institution:'',balance:200000,principal:150000,interest:10000,rate:5,day:25,method:'원금균등',note:''}];
 p.cards=[{id:'c',name:'카드',amount:100000,dueDate:'2026-11-24',paid:false,note:''}];
 const [nov,dec,jan]=forecastMonths(p,'2026-11-16',3);
 assert.equal(totals(p).net,700000);assert.equal(nov.interest,833);assert.equal(nov.deposits,749167);assert.equal(nov.loans,50000);assert.equal(nov.cards,0);assert.equal(nov.net,699167);
 assert.equal(dec.principal,50000);assert.equal(dec.interest,208);assert.equal(dec.loans,0);assert.equal(dec.net,698959);assert.equal(jan.interest,0);assert.equal(jan.net,698959);
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
test('API preserves budgets, actual expenses and history when a legacy client saves asset updates',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16');
 data.actualSpending=[{month:todayKST().slice(0,7),amount:900000,applied:true}];
 assert.equal((await handleApi(req('owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.budgets;delete legacy.snapshots;delete legacy.actualSpending;legacy.deposits[0].balance=300;
 assert.equal((await handleApi(req('owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('owner'),env)).json();assert.equal(saved.data.budgets.length,4);assert.equal(saved.data.snapshots.filter(r=>r.source==='manual').length,4);assert.equal(saved.data.snapshots.at(-1).source,'auto');
 assert.deepEqual(saved.data.actualSpending,data.actualSpending);
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
test('future interest declines from the remaining balance even for manually entered and legacy loans',()=>{
 for(const interestMode of ['manual',undefined]){
  const p=emptyPortfolio();
  p.loans=[{id:'l',name:'대출',institution:'',balance:12000000,principal:1000000,interest:117500,rate:12,day:25,method:'원금균등',note:'',...(interestMode?{interestMode}:{})}];
  const before=structuredClone(p),rows=loanSchedule(p,'2026-11',3);
  assert.deepEqual(rows.map(r=>r.interest),[120000,110000,100000]);
  assert.deepEqual(rows.map(r=>r.balance),[11000000,10000000,9000000]);
  assert.equal(interestForLoan(p.loans[0]),117500);
  assert.deepEqual(forecastMonths(p,'2026-11-16',3).map(r=>r.interest),[120000,110000,100000]);
  const salaryData=structuredClone(p);salaryData.cashflow=[{id:'s',name:'월급',type:'salary',amount:3000000,date:'2026-11-25',repeat:'monthly',note:''}];
  assert.deepEqual(paydayForecasts(salaryData,'2026-11-16',3).map(r=>r.interest),[120000,110000,100000]);
  assert.deepEqual(p,before);
 }
});
test('manually entered annuity loans keep projected payments steady while interest declines',()=>{
 const p=emptyPortfolio();
 p.loans=[{id:'l',name:'원리금균등',institution:'',balance:1200,principal:400,interest:11,rate:12,day:25,method:'원리금균등',interestMode:'manual',note:''}];
 const rows=loanSchedule(p,'2026-11',4);
 assert.deepEqual(rows.map(r=>r.interest),[12,8,4,0]);
 assert.deepEqual(rows.map(r=>r.principal),[400,404,396,0]);
 assert.deepEqual(rows.map(r=>r.payment),[412,412,400,0]);
 assert.equal(p.loans[0].interest,11);
});
test('legacy backups and clients retain fixed expenses and loan calculation modes',async()=>{
 const data=samplePortfolio('2026-11-16');delete data.fixed;assert.deepEqual(validatePortfolio(data).fixed,[]);
 const env={DB:database()};data.fixed=[{id:'f',name:'보험료',amount:5000,day:25,startMonth:'2026-11',endMonth:'',paymentSource:'account',note:''}];data.loans[0].interestMode='estimate';
 assert.equal((await handleApi(req('fixed-owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.fixed;delete legacy.loans[0].interestMode;legacy.loans[0].balance=30000000;
 assert.equal((await handleApi(req('fixed-owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('fixed-owner'),env)).json();assert.equal(saved.data.fixed.length,1);assert.equal(saved.data.loans[0].interestMode,'estimate');assert.equal(saved.data.loans[0].interest,105000);
});

test('payday assets include same-day salary, loans, cards and fixed expenses but exclude later expenses',()=>{
 const p=emptyPortfolio();p.deposits=[{id:'d',name:'통장',institution:'',balance:1000,rate:0,maturity:'',note:''}];
 p.loans=[{id:'l',name:'대출',institution:'',balance:200,principal:100,interest:10,rate:5,day:25,method:'원금균등',note:''}];
 p.cards=[{id:'c',name:'카드',amount:100,dueDate:'2026-11-25',paid:false,note:''}];
 p.fixed=[{id:'f',name:'고정',amount:50,day:25,startMonth:'2026-11',endMonth:'',paymentSource:'account',note:''}];
 p.cashflow=[{id:'s',name:'월급',type:'salary',amount:500,date:'2026-11-25',repeat:'monthly',note:''},{id:'i',name:'수입',type:'other_income',amount:20,date:'2026-11-20',repeat:'once',note:''},{id:'e',name:'이후 지출',type:'expense',amount:30,date:'2026-11-26',repeat:'once',note:''}];
 const [nov,dec]=paydayForecasts(p,'2026-11-16',2);
 assert.equal(nov.date,'2026-11-25');assert.equal(nov.salaryAmount,500);assert.equal(nov.interest,1);assert.equal(nov.deposits,1269);assert.equal(nov.loans,100);assert.equal(nov.cards,0);assert.equal(nov.net,1169);assert.equal(nov.previousDayDeposits,1020);assert.equal(nov.previousDayNet,720);assert.equal(nov.cumulativeIncome,520);assert.equal(nov.cumulativeExpense,251);
 assert.equal(forecastMonths(p,'2026-11-16',1)[0].net,1139);
 assert.equal(dec.date,'2026-12-25');assert.equal(dec.interest,0);assert.equal(dec.deposits,1589);assert.equal(dec.loans,0);assert.equal(dec.net,1589);
});
test('multiple salaries on one day are grouped and filtering payday dates keeps all income in asset calculations',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'a',name:'월급 A',type:'salary',amount:100,date:'2026-11-20',repeat:'monthly',note:''},{id:'b',name:'월급 B',type:'salary',amount:200,date:'2026-11-20',repeat:'monthly',note:''},{id:'c',name:'일회 급여',type:'salary',amount:50,date:'2026-11-25',repeat:'once',note:''}];
 const all=paydayForecasts(p,'2026-11-16',3);assert.deepEqual(all.map(r=>r.date),['2026-11-20','2026-11-25','2026-12-20']);assert.equal(all[0].salaryAmount,300);assert.equal(all[0].salaryNames.length,2);assert.equal(all[1].deposits,350);
 const filtered=paydayForecasts(p,'2026-11-16',12,'c');assert.equal(filtered.length,1);assert.equal(filtered[0].deposits,350);assert.equal(filtered[0].salaryAmount,50);
});
test('payday forecasts exclude baseline-day salary to prevent double counting and handle missing upcoming salaries',()=>{
 const p=emptyPortfolio();assert.deepEqual(paydayForecasts(p,'2026-11-16'),[]);
 p.cashflow=[{id:'s',name:'월급',type:'salary',amount:100,date:'2026-11-16',repeat:'monthly',note:''}];
 const rows=paydayForecasts(p,'2026-11-16');assert.equal(rows.length,12);assert.equal(rows[0].date,'2026-12-16');assert.equal(rows[0].deposits,100);
 p.cashflow[0].repeat='once';assert.deepEqual(paydayForecasts(p,'2026-11-16'),[]);
 p.cashflow[0].type='other_income';p.cashflow[0].date='2026-11-25';assert.deepEqual(paydayForecasts(p,'2026-11-16'),[]);
});
test('monthly payday dates clamp to month end including leap years',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'s',name:'월말 급여',type:'salary',amount:100,date:'2027-01-31',repeat:'monthly',note:''}];
 assert.deepEqual(paydayForecasts(p,'2027-01-16',3).map(r=>r.date),['2027-01-31','2027-02-28','2027-03-31']);
 assert.equal(paydayForecasts(p,'2028-02-01',1)[0].date,'2028-02-29');
});
test('date-based projections agree with month-end projections and preserve the input portfolio',()=>{
 const p=samplePortfolio('2026-11-16'),original=structuredClone(p);
 const dates=['2026-11-30','2026-12-31','2027-01-31'];assert.deepEqual(forecastOnDates(p,dates,'2026-11-16'),forecastMonths(p,'2026-11-16',3));
 paydayForecasts(p,'2026-11-16');assert.deepEqual(p,original);
 assert.throws(()=>forecastOnDates(p,['2026-11-15'],'2026-11-16'));assert.throws(()=>forecastOnDates(p,['2027-02-30'],'2026-11-16'));
});

test('scheduled one-off income and expenses apply on their own dates without repeating next month',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'salary',name:'월급',type:'salary',amount:500,date:'2026-11-25',repeat:'monthly',note:''},{id:'bonus',name:'추가 지급',type:'other_income',amount:200,date:'2026-11-24',repeat:'once',includeInForecast:true,note:''},{id:'trip',name:'예정 지출',type:'expense',amount:100,date:'2026-11-26',repeat:'once',includeInForecast:true,note:''}];
 assert.equal(paydayForecasts(p,'2026-11-16',1)[0].net,700);
 const [nov,dec]=forecastMonths(p,'2026-11-16',2);assert.equal(nov.net,600);assert.equal(dec.net,1100);
 p.cashflow[1].date='2026-11-26';assert.equal(paydayForecasts(p,'2026-11-16',1)[0].net,500);
});
test('excluded uncertain plans remain editable but do not enter budgets, calendar or asset forecasts',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'bonus',name:'미확정 상여금',type:'other_income',amount:200,date:'2026-11-24',repeat:'once',includeInForecast:false,note:''},{id:'cost',name:'검토 중 지출',type:'expense',amount:100,date:'2026-11-26',repeat:'once',includeInForecast:false,note:''}];
 assert.equal(scheduledCashflows(p,'2026-11-16').length,2);assert.equal(cashflowForMonth(p,'2026-11').length,0);assert.equal(cashflowForMonth(p,'2026-11',true).length,2);assert.equal(eventsForMonth(p,'2026-11').length,0);assert.equal(budgetPlan(p,'2026-11').income,0);assert.equal(budgetPlan(p,'2026-11').expense,0);assert.equal(forecastMonths(p,'2026-11-16',1)[0].net,0);
 p.cashflow[0].includeInForecast=true;assert.equal(forecastMonths(p,'2026-11-16',1)[0].net,200);
 p.cashflow[1].includeInForecast=true;assert.equal(forecastMonths(p,'2026-11-16',1)[0].net,100);
});
test('scheduled lists reuse existing one-off flows and separate future and past without including recurring salary',()=>{
 const p=emptyPortfolio();p.cashflow=[{id:'past',name:'지난 입금',type:'other_income',amount:1,date:'2026-11-10',repeat:'once',note:''},{id:'today',name:'오늘 지출',type:'expense',amount:2,date:'2026-11-16',repeat:'once',note:''},{id:'future',name:'나중 입금',type:'other_income',amount:3,date:'2027-02-10',repeat:'once',note:''},{id:'recurring',name:'고정 수입',type:'other_income',amount:4,date:'2026-11-20',repeat:'monthly',note:''},{id:'salary',name:'급여',type:'salary',amount:5,date:'2026-11-25',repeat:'once',note:''}];
 assert.deepEqual(scheduledCashflows(p,'2026-11-16').map(r=>r.id),['future']);assert.equal(scheduledCashflows(p,'2026-11-16','all').length,3);assert.deepEqual(scheduledCashflows(p,'2026-11-16','past').map(r=>r.id),['past','today']);
});
test('legacy flows default to inclusion while invalid inclusion flags are rejected',()=>{
 const p=samplePortfolio('2026-11-16'),clean=validatePortfolio(p);assert.equal(clean.cashflow[0].includeInForecast,true);
 p.cashflow[0].includeInForecast='false';assert.throws(()=>validatePortfolio(p));
});
test('legacy clients preserve excluded plans and the same flow is stored only once',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16');data.cashflow[1].includeInForecast=false;
 assert.equal((await handleApi(req('plan-owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);for(const row of legacy.cashflow)delete row.includeInForecast;legacy.cashflow[1].note='일정 변경 검토';
 assert.equal((await handleApi(req('plan-owner','PUT',{data:legacy,revision:1}),env)).status,200);
 const saved=await(await handleApi(req('plan-owner'),env)).json();assert.equal(saved.data.cashflow.length,3);assert.equal(saved.data.cashflow.find(r=>r.id==='demo-f2').includeInForecast,false);assert.equal(saved.data.cashflow.find(r=>r.id==='demo-f2').note,'일정 변경 검토');
});

test('retirement contributions default safely for old backups and validate the recurring deposit date',()=>{
 const data=samplePortfolio('2026-11-16');
 const old=validatePortfolio(data);assert.equal(old.retirement[0].monthlyContribution,0);assert.equal(old.retirement[0].contributionDate,'');
 Object.assign(data.retirement[0],{monthlyContribution:350000,contributionDate:'2027-01-31'});
 const saved=validatePortfolio(JSON.parse(JSON.stringify(data)));
 assert.equal(saved.retirement[0].amount,34800000);assert.equal(saved.retirement[0].monthlyContribution,350000);assert.equal(saved.retirement[0].contributionDate,'2027-01-31');
 for(const patch of [{monthlyContribution:-1},{monthlyContribution:1.5},{monthlyContribution:'350000'},{monthlyContribution:null},{contributionDate:''},{contributionDate:'2027-02-30'}]){
  const invalid=structuredClone(data);Object.assign(invalid.retirement[0],patch);assert.throws(()=>validatePortfolio(invalid));
 }
});

test('company contributions grow retirement on their dates without becoming cash income or changing current balances',()=>{
 const p=emptyPortfolio();p.deposits=[{id:'cash',name:'예금',balance:1000,rate:0}];
 p.retirement=[{id:'a',name:'회사 연금',amount:10000,monthlyContribution:300,contributionDate:'2026-11-25'},{id:'b',name:'다른 회사 연금',amount:20000,monthlyContribution:200,contributionDate:'2027-01-31'}];
 const original=structuredClone(p);
 const dates=['2026-11-24','2026-11-25','2026-11-30','2026-12-25','2027-01-30','2027-01-31'];
 const rows=forecastOnDates(p,dates,'2026-11-16');
 assert.deepEqual(rows.map(row=>row.retirement),[30000,30300,30300,30600,30900,31100]);
 assert.deepEqual(rows.map(row=>row.retirementContribution),[0,300,0,300,300,200]);
 assert.equal(rows.at(-1).cumulativeRetirementContribution,1100);
 assert.ok(rows.every(row=>row.deposits===1000&&row.income===0&&row.expense===0&&row.net===row.retirement+1000));
 assert.equal(rows[1].dayEvents.length,0);assert.equal(rows[1].retirementEvents[0].amount,300);
 assert.equal(monthlyFlow(p,'2027-01').income,0);assert.equal(budgetPlan(p,'2027-01').expense,0);
 assert.equal(totals(p).retirement,30000);assert.deepEqual(p,original);
 assert.equal(retirementContributionsForMonth(p,'2027-02').find(row=>row.id==='b').date,'2027-02-28');
 assert.equal(retirementContributionsForMonth(p,'2028-02').find(row=>row.id==='b').date,'2028-02-29');
 const [sameDay,nextMonth]=forecastMonths(p,'2026-11-25',2);assert.equal(sameDay.retirement,30000);assert.equal(nextMonth.retirement,30300);
 p.cashflow=[{id:'salary',name:'월급',type:'salary',amount:100,date:'2026-11-25',repeat:'monthly'}];
 const payday=paydayForecasts(p,'2026-11-16',1)[0];assert.equal(payday.retirement,30300);assert.equal(payday.deposits,1100);assert.equal(payday.salaryAmount,100);assert.equal(payday.net,31400);
});

test('the API retains retirement plans for old clients and permits explicitly stopping contributions',async()=>{
 const env={DB:database()},data=samplePortfolio('2026-11-16');
 Object.assign(data.retirement[0],{monthlyContribution:350000,contributionDate:'2027-01-31'});
 assert.equal((await handleApi(req('pension-owner','PUT',{data,revision:0}),env)).status,200);
 const legacy=structuredClone(data);delete legacy.retirement[0].monthlyContribution;delete legacy.retirement[0].contributionDate;legacy.retirement[0].amount=36000000;
 assert.equal((await handleApi(req('pension-owner','PUT',{data:legacy,revision:1}),env)).status,200);
 let saved=await(await handleApi(req('pension-owner'),env)).json();
 assert.equal(saved.data.retirement[0].amount,36000000);assert.equal(saved.data.retirement[0].monthlyContribution,350000);assert.equal(saved.data.retirement[0].contributionDate,'2027-01-31');
 assert.equal((await handleApi(req('pension-owner','PUT',{data:legacy,revision:1}),env)).status,409);
 assert.equal((await(await handleApi(req('another-owner'),env)).json()).data.retirement.length,0);
 saved.data.retirement[0].monthlyContribution=0;saved.data.retirement[0].contributionDate='';
 assert.equal((await handleApi(req('pension-owner','PUT',{data:saved.data,revision:2}),env)).status,200);
 saved=await(await handleApi(req('pension-owner'),env)).json();assert.equal(saved.data.retirement[0].monthlyContribution,0);assert.equal(saved.data.retirement[0].contributionDate,'');
});

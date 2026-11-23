import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import * as domain from '../public/domain.mjs';
import {repaymentScenarios} from '../public/repayment.mjs';
import {handleApi} from '../server/api.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
import {parseHTML} from 'linkedom';
import {buildStatistics} from '../public/statistics.mjs';
const asOf='2027-01-01';
function portfolio(patch={}){return domain.validatePortfolio({...domain.emptyPortfolio(),deposits:[{id:'cash',name:'현금',balance:50000000,rate:0}],loans:[{id:'term',name:'기간 대출',institution:'은행',balance:12000000,rate:12,method:'원금균등',day:31,calculationMode:'term',remainingMonths:12,graceMonths:0,nextPaymentDate:'2027-01-31',...patch}]});}
const payable=rows=>rows.flatMap(row=>row.details).filter(row=>row.installment!==null);
const sum=(rows,key)=>rows.reduce((n,row)=>n+row[key],0);

test('partial and full repayments apply principal, exact cash outlay and future schedule together',()=>{
 const original=portfolio(),before=structuredClone(original),date=domain.todayKST();
 const repayment={loanId:'term',type:'partial',paymentId:'settlement-1',expectedBalance:12000000,
  principal:3000000,interest:15000,fee:25000,date,cashMode:'deduct',depositId:'cash',
  schedule:{remainingMonths:9,graceMonths:0,nextPaymentDate:domain.shiftMonth(date.slice(0,7),1)+'-15'}};
 const partial=domain.applyLoanRepayment(original,repayment);
 assert.deepEqual(original,before);
 assert.equal(partial.loans[0].balance,9000000);
 assert.equal(partial.deposits[0].balance,46960000);
 assert.equal(partial.loans[0].remainingMonths,9);
 assert.equal(domain.loanNextPayment(partial.loans[0],date).date,repayment.schedule.nextPaymentDate);
 assert.equal(domain.loanNextPayment(partial.loans[0],date).payment,1090000);
 assert.equal(partial.fixed.length,0);
 assert.equal(partial.cashflow.length,0);
 const stats=buildStatistics(partial,{start:date,end:date,kind:'loans'});
 assert.equal(stats.totals.actualLoanPayment,3040000);
 assert.equal(stats.totals.interest,15000);
 assert.equal(stats.rows[0].status,'부분 상환');
 assert.throws(()=>domain.applyLoanRepayment(partial,repayment),/이미 저장/);
 assert.throws(()=>domain.applyLoanRepayment(original,{...repayment,expectedBalance:1}),/잔액이 변경/);
 assert.throws(()=>domain.applyLoanRepayment(original,{...repayment,principal:12000000}),/남은 원금보다 작/);
 assert.throws(()=>domain.applyLoanRepayment(original,{...repayment,depositId:'wrong'}),/항목을 선택/);
 assert.throws(()=>domain.applyLoanRepayment(original,{...repayment,fee:50000000}),/잔액이 총 납부액보다 적/);
 assert.deepEqual(original,before);
 const settled=domain.applyLoanRepayment(partial,{loanId:'term',paymentId:'settlement-2',type:'full',
  expectedBalance:9000000,date,interest:900,cashMode:'recorded'});
 assert.equal(settled.loanPayments[1].principal,9000000);
 assert.equal(settled.loanPayments[1].repaymentType,'full');
 assert.equal(settled.loans[0].balance,0);
 assert.equal(settled.deposits[0].balance,partial.deposits[0].balance);
 assert.ok(domain.loanSchedule(settled,date.slice(0,7),12,date).every(month=>month.payment===0));
});

test('equal principal computes exact declining interest and clears every won at maturity',()=>{
 const p=portfolio(),before=structuredClone(p),rows=domain.loanSchedule(p,'2027-01',14,asOf),payments=payable(rows);
 assert.equal(payments.length,12);assert.ok(payments.every(row=>row.principal===1000000));
 assert.deepEqual(payments.map(row=>row.interest),[120000,110000,100000,90000,80000,70000,60000,50000,40000,30000,20000,10000]);
 assert.equal(sum(payments,'interest'),780000);assert.equal(sum(payments,'payment'),12780000);
 assert.equal(rows.at(-1).balance,0);assert.equal(rows.at(-1).payment,0);
 assert.equal(payments[1].date,'2027-02-28');assert.equal(payments[2].date,'2027-03-31');
 const summary=domain.loanPlanSummary(p.loans[0],asOf);assert.equal(summary.interest,780000);assert.equal(summary.payoffDate,'2027-12-31');
 assert.deepEqual(p,before);
});

test('grace bills charge interest only and divide principal over the remaining non-grace bills',()=>{
 const p=portfolio({balance:900000,remainingMonths:5,graceMonths:2}),rows=domain.loanPlanSummary(p.loans[0],asOf).rows;
 assert.deepEqual(rows.map(row=>row.principal),[0,0,300000,300000,300000]);
 assert.deepEqual(rows.map(row=>row.interest),[9000,9000,9000,6000,3000]);
 assert.equal(sum(rows,'interest'),36000);assert.equal(rows.at(-1).balance,0);
 assert.equal(domain.totals(p).monthlyPrincipal,0);assert.equal(domain.totals(p).monthlyInterest,9000);
});

test('zero-rate, rounding remainders, one final payment and interest-only maturity stay finite and exact',()=>{
 for(const [patch,expected]of [[{balance:10,rate:0,remainingMonths:3},[3,3,4]],[{balance:100,rate:0,remainingMonths:1},[100]],[{balance:100,rate:12,method:'만기일시',remainingMonths:3},[0,0,100]]]){
  const p=portfolio(patch),plan=domain.loanPlanSummary(p.loans[0],asOf);
  assert.deepEqual(plan.rows.map(row=>row.principal),expected);assert.equal(sum(plan.rows,'principal'),patch.balance);assert.equal(plan.rows.at(-1).balance,0);
 }
 const plan=domain.loanPlanSummary(portfolio({method:'원리금균등'}).loans[0],asOf);
 assert.equal(plan.rows.length,12);assert.equal(sum(plan.rows,'principal'),12000000);assert.equal(plan.rows.at(-1).balance,0);
 assert.ok(plan.rows.slice(0,-1).every(row=>row.payment===plan.rows[0].payment));
 assert.ok(plan.rows.every(row=>Number.isSafeInteger(row.interest)&&row.interest>=0));
});

test('future start dates delay payments, while overdue plans keep outstanding principal and remaining installments',()=>{
 let p=portfolio({nextPaymentDate:'2027-03-28',day:31,remainingMonths:3});let rows=domain.loanSchedule(p,'2027-01',6,asOf);
 assert.deepEqual(rows.slice(0,2).map(row=>row.payment),[0,0]);assert.equal(rows[2].details[0].date,'2027-03-28');assert.equal(rows[3].details[0].date,'2027-04-30');assert.equal(rows[4].balance,0);
 p=portfolio({remainingMonths:3,nextPaymentDate:'2026-12-31'});const plan=domain.loanPlanSummary(p.loans[0],'2027-01-31');
 assert.equal(plan.adjusted,true);assert.equal(plan.next.date,'2027-02-28');assert.equal(sum(plan.rows,'principal'),12000000);assert.equal(p.loans[0].balance,12000000);
});

test('term fields are validated and old loans keep the manual calculation mode',()=>{
 for(const patch of [{remainingMonths:0},{remainingMonths:601},{remainingMonths:1.5},{graceMonths:12},{graceMonths:-1},{nextPaymentDate:'2027-02-30'},{method:'기타'},{calculationMode:'unknown'}])assert.throws(()=>portfolio(patch));
 const legacy=domain.samplePortfolio();const old=legacy.loans[0];delete old.calculationMode;
 const migrated=domain.validatePortfolio(legacy);assert.equal(migrated.loans[0].calculationMode,'manual');assert.equal(migrated.loans[0].principal,old.principal);
 const p=portfolio({principal:999999999,interest:9999999,interestMode:'manual'});assert.equal(p.loans[0].principal,1000000);assert.equal(p.loans[0].interest,120000);
});

test('cash forecasts, calendar and scenario baseline agree on the same term schedule',()=>{
 const today=domain.todayKST(),first=domain.paymentDate(domain.shiftMonth(today.slice(0,7),1),31);
 const p=portfolio({remainingMonths:3,nextPaymentDate:first}),schedule=domain.loanSchedule(p,today.slice(0,7),12,today),forecast=domain.forecastMonths(p,today,12);
 const scenarios=repaymentScenarios(p,{asOf:today,months:12});
 for(let i=0;i<12;i++){
  assert.equal(forecast[i].loans,schedule[i].balance);assert.equal(forecast[i].interest,schedule[i].interest);assert.equal(scenarios.baseline.rows[i].interest,forecast[i].interest);assert.equal(scenarios.baseline.rows[i].deposits,forecast[i].deposits);
  const events=domain.eventsForMonth(p,schedule[i].month).filter(row=>row.type==='loans');
  assert.equal(sum(events,'amount'),schedule[i].payment);
 }
 assert.equal(forecast[4].loans,0);assert.equal(forecast[4].expense,0);
});

test('full repayment view shows principal, interest, totals and payoff through more than 12 months',()=>{
 const p=portfolio({remainingMonths:24}),{document}=parseHTML('<main>'+renderLoanForecastPanel(p,{formatMoney:value=>value+'원',asOf,period:'all'})+'</main>');
 assert.equal(document.querySelectorAll('[data-loan-month]').length,24);
 assert.match(document.querySelector('.loan-plan-totals').textContent,/원금.*12000000원/);
 assert.match(document.querySelector('.loan-month-payment').textContent,/원금.*이자.*납부/);
 assert.equal(document.querySelector('[data-loan-month="2028-12"] [data-field="balance"]').textContent,'0원');
});

test('API retains term settings for older clients and can explicitly switch back to manual',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_assets.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null;},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}};
 const save=async(data,revision)=>{const res=await handleApi(new Request('https://moa.test/api/portfolio',{method:'PUT',headers:{Origin:'https://moa.test','Content-Type':'application/json','oai-authenticated-user-id':'term-test'},body:JSON.stringify({data,revision})}),{DB});assert.equal(res.status,200);return res.json();};
 let result=await save(portfolio(),0),legacy=structuredClone(result.data);
 for(const key of ['calculationMode','remainingMonths','graceMonths','nextPaymentDate'])delete legacy.loans[0][key];
 result=await save(legacy,1);assert.equal(result.data.loans[0].remainingMonths,12);assert.equal(result.data.loans[0].calculationMode,'term');
 const manual=structuredClone(result.data);manual.loans[0].calculationMode='manual';manual.loans[0].principal=250000;
 result=await save(manual,2);assert.equal(result.data.loans[0].calculationMode,'manual');assert.equal(result.data.loans[0].principal,250000);assert.equal(result.data.loans[0].remainingMonths,undefined);db.close();
});

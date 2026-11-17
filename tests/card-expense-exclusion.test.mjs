import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {emptyPortfolio,validatePortfolio,totals,eventsForMonth,monthlyFlow,budgetPlan,forecastMonths,paydayForecasts,isCardIncludedExpense} from '../public/domain.mjs';
import {buildStatistics} from '../public/statistics.mjs';
import {handleApi} from '../server/api.mjs';
const fixture=()=>{
 const p=emptyPortfolio();p.deposits=[{id:'cash',name:'예금',balance:2000000,rate:0,note:''}];p.cards=[{id:'bill',name:'카드 청구',amount:1000000,dueDate:'2026-11-25',paid:false,note:''}];
 p.cashflow=[{id:'salary',name:'월급',type:'salary',amount:500000,date:'2026-11-25',repeat:'monthly',note:''},{id:'phone',name:'통신비',type:'expense',amount:60000,date:'2026-11-24',repeat:'once',paymentSource:'card',note:'청구에 포함'},{id:'cash-expense',name:'계좌 이체',type:'expense',amount:50000,date:'2026-11-26',repeat:'once',paymentSource:'account',note:''}];p.fixed=[{id:'fixed-card',name:'구독료',amount:20000,day:24,startMonth:'2026-11',endMonth:'',paymentSource:'card',note:''}];return validatePortfolio(p);
};
test('card-included expenses remain recorded while budget, calendar and forecasts count only the actual card bill',()=>{
 const p=fixture(),before=structuredClone(p);assert.equal(isCardIncludedExpense(p.cashflow[1]),true);assert.equal(monthlyFlow(p,'2026-11').expense,1050000);assert.equal(budgetPlan(p,'2026-11').expense,1050000);assert.deepEqual(eventsForMonth(p,'2026-11').map(row=>row.id).sort(),['bill','cash-expense','salary']);
 const end=forecastMonths(p,'2026-11-16',1)[0];assert.equal(end.deposits,1450000);assert.equal(end.net,1450000);const payday=paydayForecasts(p,'2026-11-16')[0];assert.equal(payday.date,'2026-11-25');assert.equal(payday.deposits,1500000);assert.equal(payday.cumulativeExpense,1000000);assert.equal(p.cashflow.length,3);assert.deepEqual(p,before);
 const separate=structuredClone(p);separate.cashflow[1].paymentSource='account';assert.equal(monthlyFlow(separate,'2026-11').expense,1110000);assert.equal(forecastMonths(separate,'2026-11-16',1)[0].deposits,1390000);assert.deepEqual(totals(separate),totals(p));
});
test('statistics retain card-included expense detail as informational without adding it to cash expenditure',()=>{
 const p=fixture(),filters={start:'2026-11-01',end:'2026-11-30',kind:'all'},result=buildStatistics(p,filters,'2026-11-16');assert.equal(result.totals.expense,1050000);assert.equal(result.totals.cardIncluded,80000);const phone=result.rows.find(row=>row.recordId==='phone');assert.ok(phone.informational);assert.match(phone.status,/중복 제외/);assert.equal(phone.amount,60000);
 const onlyPhone=buildStatistics(p,{...filters,item:'cashflow:phone'},'2026-11-16');assert.equal(onlyPhone.totals.expense,0);assert.equal(onlyPhone.totals.cardIncluded,60000);
 p.cashflow[1].includeInForecast=false;assert.equal(buildStatistics(p,filters,'2026-11-16').totals.cardIncluded,20000);assert.equal(monthlyFlow(p,'2026-11').expense,1050000);
});
test('legacy expenses keep separate-payment semantics and selecting card inclusion never fabricates a bill',()=>{
 const p=fixture();delete p.cashflow[1].paymentSource;const clean=validatePortfolio(p);assert.equal(clean.cashflow[1].paymentSource,'account');assert.equal(monthlyFlow(clean,'2026-11').expense,1110000);
 clean.cashflow[1].paymentSource='card';clean.cards=[];assert.equal(validatePortfolio(clean).cards.length,0);assert.equal(monthlyFlow(clean,'2026-11').expense,50000);for(const value of [null,'unknown',true]){p.cashflow[1].paymentSource=value;assert.throws(()=>validatePortfolio(p),/결제 방식/);}p.cashflow[0].paymentSource='card';p.cashflow[1].paymentSource='account';assert.equal(validatePortfolio(p).cashflow[0].paymentSource,'account');
});
test('the portfolio API preserves an old client omission, permits explicit reversal and rejects malformed source without writes',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_assets.sql',import.meta.url),'utf8'));const DB={prepare(sql){return{bind(...v){return{async first(){return db.prepare(sql).get(...v)||null;},async run(){return{meta:{changes:Number(db.prepare(sql).run(...v).changes)}};}};}};}};
 const req=(method='GET',body,user='owner')=>new Request('https://moa.test/api/portfolio',{method,headers:{Origin:'https://moa.test','Content-Type':'application/json','oai-authenticated-user-id':user},body:body?JSON.stringify(body):undefined});
 const p=fixture();assert.equal((await handleApi(req('PUT',{data:p,revision:0}),{DB})).status,200);let saved=await(await handleApi(req(),{DB})).json();const legacy=structuredClone(saved.data);delete legacy.cashflow[1].paymentSource;legacy.cashflow[1].note='기존 클라이언트 수정';assert.equal((await handleApi(req('PUT',{data:legacy,revision:1}),{DB})).status,200);saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cashflow[1].paymentSource,'card');assert.equal(saved.data.cashflow[1].note,legacy.cashflow[1].note);assert.deepEqual(validatePortfolio(JSON.parse(JSON.stringify(saved.data))),saved.data);
 const invalid=structuredClone(saved.data);invalid.cashflow[1].paymentSource=null;assert.equal((await handleApi(req('PUT',{data:invalid,revision:2}),{DB})).status,400);assert.equal((await(await handleApi(req(),{DB})).json()).revision,2);const reversed=structuredClone(saved.data);reversed.cashflow[1].paymentSource='account';assert.equal((await handleApi(req('PUT',{data:reversed,revision:2}),{DB})).status,200);saved=await(await handleApi(req(),{DB})).json();assert.equal(saved.data.cashflow[1].paymentSource,'account');assert.equal((await handleApi(req('PUT',{data:p,revision:2}),{DB})).status,409);assert.equal((await(await handleApi(req('GET',undefined,'other'),{DB})).json()).data.cashflow.length,0);db.close();
});

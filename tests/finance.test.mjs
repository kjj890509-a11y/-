import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {emptyPortfolio,validatePortfolio,samplePortfolio,totals,eventsForMonth,todayKST,paymentDate} from '../public/domain.mjs';
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

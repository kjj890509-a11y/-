import * as loansPage from '../public/loans-page.mjs';
import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import * as disclosure from '../public/disclosure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as charts from '../public/chart.mjs';
import * as statsPage from '../public/statistics-page.mjs';
import * as advisorPage from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
import {repaymentScenarios} from '../public/repayment.mjs';
import {handleAdvisor} from '../server/advisor.mjs';

const options={monthlyExtra:200000,lumpSum:1000000,reserve:5000000,months:12};
const fakeKey='sk-test-fixture-'+ 'x'.repeat(32);
const advice={recommendation:'balance',summary:'상환 순서를 비교했습니다.',reasons:['월별 예금 잔액을 함께 확인하세요.'],checks:['중도상환수수료를 확인하세요.']};
function data(){return domain.validatePortfolio(domain.samplePortfolio('2026-11-16'));}
function environment(){
 const db=new DatabaseSync(':memory:');for(const file of ['0000_assets.sql','0001_advisor_usage.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 db.prepare('INSERT INTO portfolios (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('owner',JSON.stringify(data()),'2026-11-16');
 return {db,env:{OPENAI_API_KEY:fakeKey,DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}};}}}};
}
function request(patch={},user='owner',origin='https://moa.test'){
 return new Request('https://moa.test/api/advisor',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify({question:'상환 계획을 비교해 주세요.',options,revision:1,...patch})});
}
test('the baseline scenario matches monthly forecasts and interest savings explain the net-worth change',()=>{
 const portfolio=data(),before=structuredClone(portfolio);
 Object.assign(portfolio.retirement[0],{monthlyContribution:350000,contributionDate:'2026-11-25'});Object.assign(before.retirement[0],{monthlyContribution:350000,contributionDate:'2026-11-25'});
 const result=repaymentScenarios(portfolio,{...options,asOf:'2026-11-16'});
 assert.deepEqual(result.baseline.rows.map(row=>[row.deposits,row.loans,row.net]),domain.forecastMonths(portfolio,'2026-11-16',12).map(row=>[row.deposits,row.loans,row.net]));
 assert.ok(result.rate.interestSaved>0);
 assert.equal(result.rate.netGain,result.rate.interestSaved);
 assert.deepEqual(portfolio,before);
});
test('employer pension contributions are never available for additional loan repayments',()=>{
 const portfolio=domain.emptyPortfolio();portfolio.retirement=[{id:'pension',name:'회사 연금',amount:10000000,monthlyContribution:500000,contributionDate:'2026-11-25'}];
 portfolio.loans=[{id:'loan',name:'대출',balance:1000000,principal:0,rate:0,day:25,method:'만기일시'}];
 const result=repaymentScenarios(portfolio,{asOf:'2026-11-16',monthlyExtra:500000,lumpSum:1000000,months:12});
 assert.equal(result.rate.totalExtra,0);assert.equal(result.rate.rows.at(-1).deposits,0);assert.equal(result.rate.rows.at(-1).loans,1000000);
 assert.equal(result.rate.rows.at(-1).retirement,16000000);assert.equal(result.rate.netGain,0);
});
test('extra repayment respects available cash and the reserve, and never creates principal or profit',()=>{
 const portfolio=domain.emptyPortfolio();
 portfolio.deposits=[{id:'d',name:'예금',balance:1500,rate:0}];
 portfolio.loans=[{id:'l',name:'대출',balance:5000,rate:12,principal:0,day:25,method:'만기일시'}];
 let result=repaymentScenarios(portfolio,{asOf:'2026-11-16',monthlyExtra:1000,reserve:1400,months:12});
 assert.equal(result.rate.rows[0].extra,50);assert.equal(result.rate.rows[0].deposits,1400);
 assert.equal(result.rate.rows[1].extra,0);assert.equal(result.rate.rows[1].deposits,1350);
 portfolio.deposits[0].balance=10000;portfolio.loans[0].rate=0;
 result=repaymentScenarios(portfolio,{asOf:'2026-11-16',lumpSum:2000,months:12});
 assert.equal(result.rate.rows[0].deposits,8000);assert.equal(result.rate.rows[0].loans,3000);assert.equal(result.rate.netGain,0);
 result=repaymentScenarios(portfolio,{asOf:'2026-11-16',lumpSum:100000,monthlyExtra:100000,months:12});
 assert.equal(result.rate.totalExtra,5000);assert.equal(result.rate.rows.at(-1).loans,0);
 assert.ok(result.rate.rows.every(row=>row.loans>=0));
 assert.throws(()=>repaymentScenarios(portfolio,{monthlyExtra:-1}),/추가 상환액/);
});
test('the two strategies prioritize high rates or small balances using the same budget',()=>{
 const portfolio=domain.emptyPortfolio();portfolio.deposits=[{id:'d',name:'예금',balance:10000,rate:0}];
 portfolio.loans=[{id:'high',name:'고금리',balance:5000,rate:24,principal:0,day:25,method:'만기일시'},{id:'small',name:'소액',balance:1000,rate:12,principal:0,day:25,method:'만기일시'}];
 const result=repaymentScenarios(portfolio,{asOf:'2026-11-16',lumpSum:1000,months:12});
 assert.equal(result.rate.order[0].id,'high');assert.equal(result.balance.order[0].id,'small');
 assert.equal(result.rate.rows[0].interest,90);assert.equal(result.balance.rows[0].interest,100);
});
test('AI uses the operator secret with Terra xhigh and only the authenticated account data',async()=>{
 const {env,db}=environment();let calls=0;
 const response=await handleAdvisor(request(),env,{fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(init.headers.Authorization,'Bearer '+fakeKey);
  const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-6.1-terra');assert.equal(body.reasoning.effort,'xhigh');assert.equal(body.max_output_tokens,16384);assert.equal(body.text.format.type,'json_schema');
  assert.ok(!body.input.includes(fakeKey));assert.ok(!body.input.includes('미래에셋증권'));
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(advice)}]}]}),{status:200});
 }});
 assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.advice,advice);assert.equal(result.revision,1);assert.equal(calls,1);
 const saved=db.prepare('SELECT data, revision FROM portfolios WHERE user_id=?').get('owner');
 assert.ok(!saved.data.includes(fakeKey));assert.equal(saved.revision,1);
});
test('AI rejects anonymous, cross-site, stale and invalid requests before contacting OpenAI',async()=>{
 const {env}=environment();let calls=0;const dependencies={fetchImpl:async()=>{calls++;throw new Error('must not run');}};
 assert.equal((await handleAdvisor(request({},''),env,dependencies)).status,401);
 assert.equal((await handleAdvisor(request({},'owner','https://other.test'),env,dependencies)).status,403);
 assert.equal((await handleAdvisor(request({revision:0}),env,dependencies)).status,409);
 assert.equal((await handleAdvisor(request({apiKey:''}),env,dependencies)).status,400);
 assert.equal((await handleAdvisor(request({},'other-owner'),env,dependencies)).status,400);
 assert.equal(calls,0);
});
test('provider authentication and quota errors do not echo key material',async()=>{
 for(const status of [401,429,403]){
  const {env}=environment();
  const response=await handleAdvisor(request(),env,{fetchImpl:async()=>new Response(JSON.stringify({error:{message:fakeKey}}),{status})});
  const message=await response.text();assert.ok(!message.includes(fakeKey));assert.match(message,status===401?/운영자/:status===403?/모델/:/한도/);
 }
});
test('an incomplete AI response cannot be treated as a completed recommendation',async()=>{
 const {env}=environment();
 const response=await handleAdvisor(request(),env,{fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete',output_text:JSON.stringify(advice)}),{status:200})});
 assert.equal(response.status,502);assert.match((await response.json()).error,/끝까지/);
});
test('the advisor page keeps key material out of rendered HTML and hides advice with amounts',()=>{
 const state={...advisorPage.initialAdvisorState(),apiKey:fakeKey,advice:{...advice,summary:'비교 금액 123456원'}};
 const format={formatMoney:value=>value+'원',formatCompact:String};
 const html=advisorPage.renderAdvisorPage(data(),state,format);
 assert.ok(!html.includes(fakeKey));assert.ok(!html.includes('type="password"'));assert.ok(!html.includes('name="model"'));assert.match(html,/GPT-6.1 Terra · Extra high/);
 const hidden=advisorPage.renderAdvisorPage(data(),state,{...format,hideAmounts:true});
 assert.ok(!hidden.includes('123456'));assert.ok(!hidden.includes(fakeKey));
});
test('customers request AI advice without a key or model field and retain comparison controls',async()=>{
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};const storageWrites=[];let requests=0;
 const context=vm.createContext({...loansPage,...workspace,...navigation,...dashboard,...disclosure,...domain,...charts,...statsPage,...advisorPage,renderLoanForecastPanel,document,window,location:{hash:'#advisor'},localStorage:{getItem:()=>null,setItem:(...args)=>storageWrites.push(args)},Intl,structuredClone,crypto,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(path==='/api/advisor'&&!init)return {ok:true,json:async()=>({configured:true,model:'gpt-6.1-terra',reasoning:'xhigh'})};
  if(path==='/api/advisor'){requests++;const body=JSON.parse(init.body);assert.equal(Object.hasOwn(body,'apiKey'),false);assert.equal(Object.hasOwn(body,'model'),false);assert.equal(body.options.monthlyExtra,500);return {ok:true,json:async()=>({advice,revision:1})};}
  return {ok:true,json:async()=>({data:data(),revision:1})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await new Promise(setImmediate);
 const visibleStep=()=>[...document.querySelectorAll('[data-ui-stage-panel]')].filter(panel=>!panel.hidden).map(panel=>panel.dataset.uiStagePanel);
 const stage=number=>document.querySelector(`.ui-steps [data-ui-stage="${number}"]`).dispatchEvent(new Event('click',{bubbles:true}));
 assert.deepEqual(visibleStep(),['3']);
 assert.equal(document.querySelector('#advisor-api-key'),null);assert.equal(document.querySelector('[name="model"]'),null);assert.equal(document.querySelector('[name="question"]').closest('[data-ui-stage-panel]').hidden,false);
 assert.equal(document.querySelector('.section-tabs').closest('[data-ui-stage-panel]'),null);
 assert.equal(document.querySelector('.section-tabs [href="#advisor"]').textContent,'AI 상담');
 stage(1);
 document.querySelector('[name="monthlyExtra"]').value='500';
 document.querySelector('#advisor-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 assert.deepEqual(visibleStep(),['2']);
 assert.equal(requests,0);
 assert.equal(document.querySelectorAll('.stats-trend [data-chart-point]').length>0,true);
 assert.ok([...document.querySelectorAll('[data-ui-section^="advisor-table"]')].every(details=>!details.hasAttribute('open')));
 document.querySelector('[data-ui-stage="3"].stage-next').dispatchEvent(new Event('click',{bubbles:true}));
 assert.deepEqual(visibleStep(),['3']);
 document.querySelector('[name="question"]').value='지금 추가로 상환하면 얼마나 유리한가요?';
 stage(1);assert.equal(document.querySelector('[name="monthlyExtra"]').value,'500');
 stage(3);assert.match(document.querySelector('[name="question"]').value,/추가로 상환/);
 document.querySelector('[data-advisor-consult]').dispatchEvent(new Event('click',{bubbles:true}));await new Promise(setImmediate);
 assert.equal(requests,1);assert.match(document.querySelector('.advisor-answer').textContent,/상환 순서/);
 assert.deepEqual(visibleStep(),['3']);
 document.querySelector('[data-ui-stage="2"].stage-next').dispatchEvent(new Event('click',{bubbles:true}));
 assert.deepEqual(visibleStep(),['2']);
 assert.equal(document.querySelector('.advisor-strategies .primary').textContent,'적은 잔액 우선');
 assert.equal(document.querySelector('.stats-trend .forecast-key').textContent,'기존 계획');
 assert.equal(storageWrites.length,0);
 document.getElementById('privacy-toggle').onclick();assert.equal(document.querySelector('#advisor-form'),null);
 document.querySelector('[data-action="reveal-advisor"]').dispatchEvent(new Event('click',{bubbles:true}));
 stage(3);
 assert.equal(document.querySelector('[data-advisor-disconnect]'),null);
 assert.ok(storageWrites.every(([key])=>key==='moa-hide-amounts'));
 context.location.hash='#loans';window.dispatchEvent(new Event('hashchange'));
 assert.equal(document.querySelector('.heading-actions a[href="#advisor"]').textContent,'AI 상담');
 assert.equal(document.querySelector('.topbar a[href="#advisor"]').textContent,'AI 상담');
 context.location.hash='#advisor';window.dispatchEvent(new Event('hashchange'));
 assert.deepEqual(visibleStep(),['3']);
 assert.equal(document.querySelector('.section-tabs').closest('[data-ui-stage-panel]'),null);
});

test('readiness reports only safe configuration and a missing operator secret fails closed',async()=>{
 const {env}=environment();let calls=0;
 const statusRequest=user=>new Request('https://moa.test/api/advisor',{headers:user?{'oai-authenticated-user-id':user}:{}});
 assert.equal((await handleAdvisor(statusRequest(''),env)).status,401);
 const configured=await handleAdvisor(statusRequest('owner'),env);
 assert.equal(configured.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(await configured.json(),{configured:true,model:'gpt-6.1-terra',reasoning:'xhigh'});
 delete env.OPENAI_API_KEY;
 assert.equal((await(await handleAdvisor(statusRequest('owner'),env)).json()).configured,false);
 const response=await handleAdvisor(request({apiKey:fakeKey}),env,{fetchImpl:async()=>{calls++;}});
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes(fakeKey));assert.equal(calls,0);
});

test('client key, model, effort and endpoint overrides cannot spend the operator key',async()=>{
 const {env,db}=environment();let calls=0;
 for(const patch of [{apiKey:fakeKey},{model:'gpt-6-astra'},{reasoning:{effort:'low'}},{baseUrl:'https://attacker.test'}]){
  const response=await handleAdvisor(request(patch),env,{fetchImpl:async()=>{calls++;}});
  assert.equal(response.status,400);
 }
 assert.equal(calls,0);assert.equal(db.prepare('SELECT COUNT(*) AS total FROM advisor_usage').get().total,0);
});

test('shared-key limits persist in D1, apply across users and reset at midnight in Korea',async()=>{
 const {env,db}=environment();env.ADVISOR_USER_DAILY_LIMIT='2';env.ADVISOR_GLOBAL_DAILY_LIMIT='3';
 db.prepare('INSERT INTO portfolios (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('second',JSON.stringify(data()),'2026-11-16');
 let at=Date.parse('2026-11-17T00:00:00+09:00'),calls=0;
 const deps={now:()=>at,fetchImpl:async()=>{calls++;return Response.json({status:'completed',output_text:JSON.stringify(advice)});}};
 assert.equal((await handleAdvisor(request(),env,deps)).status,200);
 assert.equal((await handleAdvisor(request(),env,deps)).status,429); // cooldown
 at+=30001;assert.equal((await handleAdvisor(request(),env,deps)).status,200);
 at+=30001;assert.equal((await handleAdvisor(request(),env,deps)).status,429); // per-user daily
 assert.equal((await handleAdvisor(request({},'second'),env,deps)).status,200);
 at+=30001;assert.equal((await handleAdvisor(request({},'second'),env,deps)).status,429); // shared daily
 assert.equal(calls,3);
 at=Date.parse('2026-11-17T15:00:00Z'); // midnight 11/18 in Korea
 assert.equal((await handleAdvisor(request(),env,deps)).status,200);assert.equal(calls,4);
 assert.equal(db.prepare("SELECT day,attempts FROM advisor_usage WHERE actor='global'").get().attempts,1);
 assert.equal(db.prepare('SELECT COUNT(*) AS total FROM advisor_usage').get().total,3); // bounded, no daily row growth
});

test('a cross-request lease blocks duplicate consultations and is released after provider failure',async()=>{
 const {env,db}=environment();let at=Date.now(),finish,entered;
 const started=new Promise(resolve=>{entered=resolve;});
 const pending=handleAdvisor(request(),env,{now:()=>at,fetchImpl:()=>{entered();return new Promise(resolve=>{finish=resolve;});}});
 await started;at+=60000;
 let duplicates=0;
 const duplicate=await handleAdvisor(request(),env,{now:()=>at,fetchImpl:async()=>{duplicates++;}});
 assert.equal(duplicate.status,429);assert.equal(duplicates,0);
 finish(new Response('do not echo secret '+fakeKey,{status:500}));
 const failed=await pending;assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes(fakeKey));
 assert.equal(db.prepare("SELECT lease_until FROM advisor_usage WHERE actor='user:owner'").get().lease_until,0);
 const retry=await handleAdvisor(request(),env,{now:()=>at,fetchImpl:async()=>Response.json({status:'completed',output_text:JSON.stringify(advice)})});
 assert.equal(retry.status,200);
});

test('usage storage failure prevents an unmetered provider call',async()=>{
 const {env,db}=environment();db.exec('DROP TABLE advisor_usage');let calls=0;
 const response=await handleAdvisor(request(),env,{fetchImpl:async()=>{calls++;}});
 assert.equal(response.status,503);assert.equal(calls,0);
});

test('each customer consultation loads its own portfolio and ignores a supplied user identity',async()=>{
 const {env,db}=environment();const other=data();other.deposits[0].balance=12345;
 db.prepare('INSERT INTO portfolios (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('second',JSON.stringify(other),'2026-11-16');
 const response=await handleAdvisor(request({userId:'owner'},'second'),env,{fetchImpl:async(url,init)=>{
  const sent=JSON.parse(JSON.parse(init.body).input);
  assert.equal(sent.context.current.deposits,domain.totals(other).deposits);
  assert.notEqual(sent.context.current.deposits,domain.totals(data()).deposits);
  return Response.json({status:'completed',output_text:JSON.stringify(advice)});
 }});
 assert.equal(response.status,200);
});

test('customer consultation stays unavailable when the operator connection is not ready',()=>{
 const state={...advisorPage.initialAdvisorState(),service:'unconfigured'};
 const {document}=parseHTML(advisorPage.renderAdvisorPage(data(),state,{formatMoney:String,formatCompact:String}));
 assert.ok(document.querySelector('[data-advisor-consult]').disabled);
 assert.ok(document.querySelector('[data-action="check-advisor"]'));
 assert.equal(document.querySelector('input[type="password"]'),null);
 assert.match(document.querySelector('[data-advisor-service]').textContent,/준비하고/);
});

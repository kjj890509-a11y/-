import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import * as disclosure from '../public/disclosure.mjs';
import * as charts from '../public/chart.mjs';
import * as loans from '../public/loans-page.mjs';
import * as statistics from '../public/statistics-page.mjs';
import * as advisor from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
const tick=()=>new Promise(setImmediate);
async function app(data=domain.emptyPortfolio(),route='overview',{configured=false,authenticated=true,storage,search=''}={}){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};window.matchMedia=query=>({matches:query.includes('max-width: 760px'),addEventListener(){}});window.setInterval=undefined;
 if(storage)window.sessionStorage=storage;
 for(const d of document.querySelectorAll('dialog')){Object.defineProperty(d,'open',{get(){return d.hasAttribute('open');}});d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open');}
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&!el.disabled).map(el=>[el.name,el.value]));}get(key){return this.values.get(key)??null;}}
 const state={data:domain.validatePortfolio(data),revision:1,writes:0,gets:0,fail:false,advisorCalls:[],paths:[]};
 const context=vm.createContext({...domain,...workspace,...navigation,...dashboard,...disclosure,...charts,...loans,...statistics,...advisor,renderLoanForecastPanel,document,window,location:{hash:'#'+route,search},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,URLSearchParams,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
  state.paths.push(path);
  if(!authenticated)return {ok:false,status:401};
  if(path==='/api/advisor'){if(init?.method==='POST'){state.advisorCalls.push(JSON.parse(init.body));return{ok:true,json:async()=>({advice:{summary:'계산된 자산 전망',answer:'급여일과 월말의 등록 일정을 확인했습니다.',checks:['미등록 지출 확인']},mode:'assets',asOf:domain.todayKST(),revision:state.revision})};}return{ok:true,json:async()=>({configured})};}
  if(path==='/api/preferences')return{ok:true,json:async()=>({data:{version:1,tables:{}},revision:0})};
  assert.equal(path,'/api/portfolio');if(init?.method==='PUT'){const body=JSON.parse(init.body);state.writes++;if(body.revision!==state.revision)return{ok:false,status:409,json:async()=>({error:'다른 기기에서 변경되었습니다.'})};state.data=domain.validatePortfolio(body.data);state.revision++;}else{state.gets++;if(state.fail)return{ok:false,json:async()=>({error:'연결 실패'})};}
  return{ok:true,json:async()=>({data:structuredClone(state.data),revision:state.revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();await tick();
 const visit=async route=>{context.location.hash='#'+route;window.dispatchEvent(new Event('hashchange'));await tick();await tick();};
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new Event('click',{bubbles:true}));};
 const change=(selector,value)=>{const el=document.querySelector(selector);assert.ok(el,selector);if(el.tagName==='SELECT')for(const option of el.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));else el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));};
 const fill=values=>{for(const [k,v]of Object.entries(values))change('#field-'+k,v);};
 const submit=async()=>{const f=document.querySelector('#record-form');await f.onsubmit({target:f,preventDefault(){}});await tick();};
 const focus=async()=>{window.dispatchEvent(new Event('focus'));await tick();await tick();};
 return{document,window,Event,context,state,visit,click,change,fill,submit,focus};
}
test('guests enter and forecast without account writes, then explicitly save the same-tab draft after sign-in',async()=>{
 const entries=new Map();
 const storage={getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const guest=await app(domain.emptyPortfolio(),'overview',{authenticated:false,storage});
 assert.match(guest.document.querySelector('[data-guest-banner]').textContent,/로그인 없이 돈모아 시작하기/);
 await guest.visit('entry');
 guest.click('[data-entry-type=deposits]');
 guest.fill({name:'임시 예금',balance:'1,200,000'});
 await guest.submit();
 assert.match(guest.document.querySelector('[data-guest-banner]').textContent,/작성한 내역 1건/);
 await guest.visit('forecast');
 assert.match(guest.document.querySelector('.m-forecast-summary').textContent,/1,200,000원/);
 await guest.visit('advisor');
 assert.match(guest.document.querySelector('.guest-advisor').textContent,/로그인 후 AI 상담/);
 assert.deepEqual(guest.state.paths,['/api/portfolio']);
 const login=guest.document.querySelector('[data-guest-banner] [data-guest-login]');
 assert.equal(login.getAttribute('target'),'_top');
 const returnPath=new URL(new URL(login.getAttribute('href'),'https://site.test').searchParams.get('return_to'),'https://site.test');
 assert.equal(returnPath.hash,'#advisor');
 const account=domain.emptyPortfolio();
 account.deposits=[{id:'existing',name:'계정 예금',balance:2000000,rate:0}];
 const preview=await app(account,'deposits',{storage,search:'?try=guest&display=desktop'});
 assert.deepEqual(preview.state.paths,[]);
 assert.match(preview.document.querySelector('main').textContent,/임시 예금/);
 assert.doesNotMatch(preview.document.querySelector('main').textContent,/계정 예금/);
 const unclaimed=await app(account,'overview',{storage,search:'?display=desktop'});
 assert.equal(Boolean(unclaimed.document.querySelector('[data-guest-banner]')),false);
 assert.equal(unclaimed.state.writes,0);
 const signed=await app(account,'deposits',{storage,search:returnPath.search+'&display=desktop'});
 assert.match(signed.document.querySelector('[data-guest-banner]').textContent,/로그인 전 작성한 내역 1건/);
 assert.equal(signed.state.writes,0);
 signed.click('[data-action=guest-import]');
 assert.match(signed.document.querySelector('#confirm-title').textContent,/저장할까요/);
 signed.click('#confirm-cancel');
 assert.equal(signed.state.writes,0);
 signed.click('[data-action=guest-import]');
 signed.state.revision++;
 signed.click('#confirm-ok');
 await tick();await tick();
 assert.equal(signed.state.writes,1);
 assert.equal(signed.state.data.deposits.length,1);
 assert.equal(Boolean(signed.document.querySelector('[data-guest-banner]')),true);
 signed.click('[data-action=guest-import]');
 signed.click('#confirm-ok');
 await tick();await tick();
 assert.equal(signed.state.writes,2);
 assert.deepEqual(signed.state.data.deposits.map(row=>[row.name,row.balance]),[['계정 예금',2000000],['임시 예금',1200000]]);
 assert.equal(Boolean(signed.document.querySelector('[data-guest-banner]')),false);
 assert.equal(entries.size,0);
});
test('mobile and desktop workspace show the same selected month and avoid double counting paid card bills',async()=>{
 const data=domain.emptyPortfolio();
 data.cashflow=[
  {id:'salary',type:'salary',name:'급여',amount:3000000,date:'2026-11-25',repeat:'monthly'},
  {id:'bonus',type:'other_income',name:'상여',amount:200000,date:'2026-11-26',repeat:'once'},
  {id:'covered',type:'expense',name:'카드로 낸 생활비',amount:50000,date:'2026-11-10',repeat:'once',paymentSource:'card'}
 ];
 data.fixed=[{id:'rent',name:'월 정기비용',amount:700000,day:1,startMonth:'2026-11',paymentSource:'account'}];
 data.actualSpending=[{month:'2026-11',amount:600000,applied:true}];
 data.loans=[{id:'loan',name:'대출',balance:1000000,principal:50000,interest:10000,rate:12,day:21,method:'원금균등'}];
 data.cards=[
  {id:'paid',name:'카드 A',amount:120000,dueDate:'2026-11-14',paid:true},
  {id:'pending',name:'카드 B',amount:80000,dueDate:'2026-11-28',paid:false}
 ];
 data.stocks=[{id:'stock',name:'투자',valuation:430000,cost:400000}];
 data.retirement=[{id:'pension',name:'퇴직연금',amount:2340000,asOf:'2026-11-01'}];
 const t=await app(data,'workspace');
 const doc=t.document;
 t.change('#workspace-month','2026-11');
 assert.deepEqual([...doc.querySelectorAll('.m-workspace-month > .m-facts dd')].map(el=>el.textContent),
  ['3,200,000원','860,000원','2,340,000원']);
 assert.deepEqual([...doc.querySelectorAll('.m-workspace-breakdown dd')].map(el=>el.textContent),
  ['3,000,000원','200,000원','600,000원','60,000원','200,000원']);
 assert.match(doc.querySelector('.m-workspace-breakdown').textContent,/실제 생활비/);
 t.context.location.search='?display=desktop';
 await t.visit('workspace');
 assert.deepEqual([...doc.querySelectorAll('.workspace-month-grid .page-metric-card > strong')].map(el=>el.textContent),
  ['3,200,000원','860,000원','2,340,000원']);
 assert.match(doc.querySelector('.workspace-asset-sources a[href="#stocks"]').textContent,/430,000원/);
 assert.match(doc.querySelector('.workspace-asset-sources a[href="#retirement"]').textContent,/2,340,000원/);
 t.change('#workspace-month','2026-12');
 assert.deepEqual([...doc.querySelectorAll('.workspace-month-grid .page-metric-card > strong')].map(el=>el.textContent),
  ['3,000,000원','760,000원','2,240,000원']);
 doc.getElementById('privacy-toggle').onclick();
 assert.ok([...doc.querySelectorAll('.workspace-month-grid .page-metric-card > strong')].every(el=>el.textContent==='••••••'));
 assert.equal(t.state.writes,0);
});
test('mobile renders every route, real empty states and the reference navigation without modifying records',async()=>{
 for(const source of [domain.samplePortfolio(),domain.emptyPortfolio()]){const before=structuredClone(source),t=await app(source);for(const view of [...Object.keys(navigation.viewLabels),'menu']){await t.visit(view);assert.ok(t.document.querySelector('[data-mobile-app]'),view);assert.equal(t.document.querySelectorAll('.m-tabbar>a').length,5,view);assert.equal(t.document.querySelectorAll('.m-tabbar [aria-current=page]').length,1,view);assert.doesNotMatch(t.document.querySelector('#main').textContent,/NaN|undefined|Infinity/,view);assert.equal(t.document.querySelector('[data-page-shell]'),null,view);}assert.equal(t.state.writes,0);assert.deepEqual(source,before);}
});
test('home has the account stack and opens actual record detail, including monthly principal and interest',async()=>{
 const data=domain.samplePortfolio(),t=await app(data);assert.match(t.document.querySelector('[data-home-forecast]').textContent,/미래 순자산/);assert.equal(t.document.querySelector('[data-home-forecast] .m-card-main').getAttribute('href'),'#forecast');assert.match(t.document.querySelector('.m-account-secondary').textContent,new RegExp(data.deposits[0].name));assert.equal(t.document.querySelector('.m-account-secondary .m-card-main').getAttribute('href'),'#deposits/'+data.deposits[0].id);
 await t.visit('loans/'+data.loans[0].id);const text=t.document.querySelector('#main').textContent;for(const label of ['연 이율','상환 방식','다음 상환 원금','다음 납부 이자','앞으로 12개월 상환'])assert.ok(text.includes(label),label);const plan=domain.loanSchedule({loans:[domain.validatePortfolio(data).loans[0]]},domain.todayKST().slice(0,7),12,domain.todayKST()).filter(r=>r.payment>0);assert.equal(t.document.querySelectorAll('.m-schedule-row').length,plan.length);
 await t.visit('deposits/removed-record');assert.match(t.document.querySelector('#main').textContent,/찾을 수 없는 내역/);assert.equal(t.state.writes,0);
});
test('mobile edits use the same portfolio and appear in the desktop layout',async()=>{
 const t=await app(domain.samplePortfolio(),'deposits/demo-d1');t.click('.m-hero-actions [data-action=edit]');t.fill({balance:'123,456'});await t.submit();assert.equal(t.state.data.deposits[0].balance,123456);assert.match(t.document.querySelector('.m-balance').textContent,/123,456/);assert.equal(t.state.writes,1);
 t.context.location.search='?display=desktop';await t.visit('deposits');assert.ok(t.document.querySelector('[data-page-shell]'));assert.match(t.document.querySelector('#main').textContent,/123,456/);assert.equal(t.document.body.classList.contains('mobile-app'),false);
});
test('mobile loan editing records partial repayment and desktop completes the same loan',async()=>{
 const data=domain.emptyPortfolio();
 data.loans=[{id:'loan',name:'상환 테스트',balance:1000000,principal:50000,interest:10000,rate:12,day:21,method:'원금균등'}];
 data.deposits=[{id:'account',name:'출금 계좌',balance:1200000,rate:0}];
 const t=await app(data,'loans/loan'),dialog=t.document.querySelector('#loan-repayment-dialog');
 const edit='.m-hero-actions [data-action=edit]';
 const open=mode=>t.click(`[data-action=loan-repayment][data-mode=${mode}]`);
 const submit=async()=>{
  const form=t.document.querySelector('#loan-repayment-form');
  await form.onsubmit({preventDefault(){}});
  await tick();
 };
 t.click(edit);open('partial');
 t.change('#repay-principal','100,000');
 t.change('#repay-interest','3,000');
 t.change('#repay-fee','1,000');
 t.change('#repay-monthlyPrincipal','40,000');
 t.change('#repay-cash-mode','deduct');
 await submit();
 assert.match(dialog.querySelector('[role=alert]').textContent,/항목을 선택/);
 assert.equal(t.state.writes,0);
 t.change('#repay-deposit','account');
 assert.match(dialog.querySelector('.repayment-summary').textContent,/1,096,000원/);
 await submit();
 assert.equal(t.state.writes,1);
 assert.equal(dialog.open,false);
 assert.equal(t.document.querySelector('#editor').open,false);
 assert.equal(t.state.data.loans[0].balance,900000);
 assert.equal(t.state.data.loans[0].principal,40000);
 assert.equal(t.state.data.deposits[0].balance,1096000);
 assert.match(t.document.querySelector('.m-balance').textContent,/900,000원/);
 t.context.location.search='?display=desktop';await t.visit('loans');
 t.click('[data-action=edit][data-kind=loans][data-id=loan]');
 assert.match(t.document.querySelector('.loan-repayment-options').textContent,/부분 상환 · 104,000원/);
 open('full');
 assert.equal(dialog.querySelector('#repay-principal').hasAttribute('readonly'),true);
 t.change('#repay-cash-mode','recorded');
 await submit();
 assert.equal(t.state.writes,2);
 assert.equal(t.state.data.loans[0].balance,0);
 assert.equal(t.state.data.deposits[0].balance,1096000);
 assert.deepEqual(t.state.data.loanPayments.map(row=>[row.repaymentType,row.principal]),[['partial',100000],['full',900000]]);
 assert.match(t.document.querySelector('.loan-card-heading').textContent,/상환 완료/);
 t.click('[data-action=edit][data-kind=loans][data-id=loan]');
 assert.equal(t.document.querySelector('[data-action=loan-repayment]'),null);
});
test('monthly ledger saves actuals separately, applies a month with one tap, and shares the resulting budget with desktop',async()=>{
 const data=domain.emptyPortfolio(),month=domain.todayKST().slice(0,7),previous=domain.shiftMonth(month,-1);
 data.fixed=[{id:'rent',name:'월세',amount:700000,day:20,startMonth:previous,paymentSource:'account'}];
 data.actualSpending=[{month:previous,amount:500000,applied:true}];
 data.cards=[
  {id:'paid-bill',name:'이번 달 카드',dueDate:month+'-20',billingMonth:previous,amount:200000,paid:true},
  {id:'future-bill',name:'다음 달 카드',dueDate:domain.shiftMonth(month,1)+'-20',billingMonth:month,amount:80000,paid:false}
 ];
 const t=await app(data,'spending'),mode='[data-action=spending-mode]',setAmount='[data-action=spending-form]';
 assert.ok(t.document.querySelector('.m-budget-hero '+setAmount+'.m-primary'));
 assert.ok(t.document.querySelector('.m-detail-section .m-facts .m-spending-total-row'));
 assert.ok(t.document.querySelector('.m-month #spending-month-button[data-month-trigger]'));
 assert.equal(t.document.querySelector('.spending-content'),null);
 assert.equal(t.document.querySelector(mode+'[data-applied=true]').disabled,true);
 t.click(setAmount);
 const preview=key=>t.document.querySelector(`[data-spending-preview="${key}"]`).textContent;
 assert.equal(preview('cards'),'200,000원');assert.equal(preview('total'),'900,000원');
 t.change('#spending-applied','true');assert.equal(preview('total'),'금액 입력 후 표시');
 const amount=t.document.querySelector('#spending-amount');amount.value='500,000';amount.dispatchEvent(new t.Event('input',{bubbles:true}));
 assert.equal(preview('living'),'500,000원');assert.equal(preview('total'),'700,000원');assert.equal(t.state.writes,0);
 t.change('#spending-applied','false');assert.equal(preview('total'),'900,000원');
 t.change('#spending-amount','900,000');
 await t.submit();
 assert.deepEqual(t.state.data.actualSpending.find(row=>row.month===month),{month,amount:900000,applied:false});
 assert.match(t.document.querySelector('.m-spending-effective').textContent,/700,000원/);
 t.click(mode+'[data-applied=true]');await tick();await tick();
 assert.equal(t.document.querySelector(mode+'[data-applied=true]').getAttribute('aria-pressed'),'true');
 assert.match(t.document.querySelector('.m-spending-effective').textContent,/900,000원/);
 t.click('#spending-month-button');
 if(previous.slice(0,4)!==month.slice(0,4))t.click('[data-month-prev]');
 t.click(`[data-month-option="${previous}"]`);
 assert.match(t.document.querySelector('.m-spending-record > strong').textContent,/500,000원/);
 t.click(mode+'[data-applied=false]');await tick();await tick();
 assert.match(t.document.querySelector('.m-spending-effective').textContent,/700,000원/);
 assert.deepEqual(t.state.data.actualSpending,[{month:previous,amount:500000,applied:false},{month,amount:900000,applied:true}]);
 assert.equal(t.state.writes,3);
 t.click('[data-action=next-month]');
 t.context.location.search='?display=desktop';await t.visit('budget');
 assert.match(t.document.querySelector('.breakdown-list').textContent,/가계부 생활비[\s\S]*900,000원/);
 assert.doesNotMatch(t.document.querySelector('.breakdown-list').textContent,/고정지출/);
 await t.visit('spending');
 assert.ok(t.document.querySelector('[data-page-shell] .spending-content'));
 assert.equal(t.document.querySelector(mode+'[data-applied=true]').getAttribute('aria-pressed'),'true');
});
test('monthly card entry keeps the card profile and billing month when the actual payment is in another month',async()=>{
 const data=domain.emptyPortfolio();data.cardAccounts=[{id:'my-card',name:'내 카드',day:13,note:'',archived:false}];const t=await app(data,'cards'),month=domain.todayKST().slice(0,7),due=domain.shiftMonth(month,1)+'-13';
 t.click('[data-action=mobile-card-bill]');t.fill({amount:'39,180',dueDate:due});await t.submit();const bill=t.state.data.cards[0];assert.equal(bill.cardAccountId,'my-card');assert.equal(bill.billingMonth,month);assert.equal(bill.dueDate,due);assert.equal(bill.amount,39180);assert.match(t.document.querySelector('.m-bill-card').textContent,/39,180/);
 await t.visit('cards/'+bill.id);t.click('.m-hero-actions [data-action=edit]');t.fill({amount:'40,000'});await t.submit();assert.equal(t.state.data.cards[0].billingMonth,month);assert.equal(t.state.data.cards[0].cardAccountId,'my-card');assert.equal(t.state.data.cards[0].amount,40000);
});
test('remote revisions refresh on return, and cannot overwrite an open editor or save against a newer revision',async()=>{
 const t=await app(domain.samplePortfolio(),'deposits/demo-d1');t.state.data.deposits[0].balance=222222;t.state.revision++;await t.focus();assert.match(t.document.querySelector('.m-balance').textContent,/222,222/);
 t.click('.m-hero-actions [data-action=edit]');t.fill({balance:'333,333'});t.state.data.deposits[0].balance=444444;t.state.revision++;await t.focus();assert.equal(t.document.querySelector('#field-balance').value,'333,333');await t.submit();assert.equal(t.state.data.deposits[0].balance,444444);assert.match(t.document.querySelector('#form-error').textContent,/다른 기기/);assert.ok(t.document.querySelector('#editor').open);
 t.click('[data-close=editor]');await t.focus();assert.match(t.document.querySelector('.m-balance').textContent,/444,444/);
});
test('mobile masking covers account, forecast, loan and advisor contents without changing data',async()=>{
 const t=await app(domain.samplePortfolio());t.click('[data-action=mobile-privacy]');for(const route of ['overview','deposits/demo-d1','loans/demo-l1','cards','forecast','payday','budget','advisor']){await t.visit(route);const text=t.document.querySelector('#main').textContent;assert.doesNotMatch(text,/8,400,000|62,000,000|4\.2%|NaN/,route);if(route==='advisor'){assert.ok(t.document.querySelector('[data-action=reveal-advisor]'));assert.equal(t.document.querySelector('#advisor-form'),null);}}assert.equal(t.state.writes,0);
});
test('calendar excludes card-included expenses and record filters operate without data writes',async()=>{
 const date=domain.todayKST(),data=domain.emptyPortfolio();data.cashflow=[{id:'income',name:'월급',amount:3000000,date,repeat:'monthly',type:'salary'},{id:'expense',name:'택시',amount:10000,date,repeat:'once',type:'expense',paymentSource:'card'}];data.fixed=[{id:'phone',name:'통신',amount:30000,day:Number(date.slice(8)),startMonth:date.slice(0,7),endMonth:'',paymentSource:'account'}];const t=await app(data,'schedule');assert.equal(t.document.querySelectorAll('.m-event-list .m-row').length,2);assert.doesNotMatch(t.document.querySelector('.m-event-list').textContent,/택시/);t.click('[data-action=mobile-day][data-date="'+date+'"]');assert.equal(t.document.querySelector('[aria-pressed=true][data-action=mobile-day]').dataset.date,date);
 await t.visit('records');t.change('[data-mobile-filter=category]','fixed');assert.equal(t.document.querySelectorAll('.m-record-list .m-row').length,1);assert.match(t.document.querySelector('.m-record-list').textContent,/통신/);t.change('[data-mobile-filter=category]','all');const form=t.document.querySelector('[data-mobile-search]');form.querySelector('input').value='택시';form.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));assert.equal(t.document.querySelectorAll('.m-record-list .m-row').length,1);assert.match(t.document.querySelector('.m-record-list').textContent,/중복 제외/);assert.equal(t.state.writes,0);
});
test('mobile AI readiness stays inside its screen and preserves navigation and comparison controls',async()=>{
 const t=await app(domain.samplePortfolio(),'advisor');assert.ok(t.document.querySelector('#asset-advisor-form button').disabled);assert.match(t.document.querySelector('#main').textContent,/연결이 설정되지 않았습니다/);t.click('[data-action=mobile-advisor-mode][data-mode=repayment]');assert.ok(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]'));assert.equal(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]').hidden,false);assert.ok(t.document.querySelector('[data-mobile-app] .m-tabbar'));assert.match(t.document.querySelector('#main').textContent,/연결이 설정되지 않았습니다/);assert.ok(t.document.querySelector('[data-advisor-consult]').disabled);t.click('[data-ui-stage="1"]');assert.equal(t.document.querySelector('[data-ui-stage-panel="1"]').hidden,false);assert.ok(t.document.querySelector('#advisor-form'));t.click('[data-action=mobile-advisor-mode][data-mode=assets]');assert.ok(t.document.querySelector('#asset-advisor-form'));assert.equal(t.state.writes,0);
});
test('home and bottom navigation foreground net-worth forecasts and AI without losing account entry',async()=>{
 const data=domain.samplePortfolio(),t=await app(data),root=t.document.querySelector('#main'),expected=domain.forecastMonths(t.state.data,domain.todayKST(),1)[0];
 assert.equal(root.querySelector('.m-account-stack').firstElementChild.dataset.homeForecast,'');assert.equal(root.querySelector('[data-home-forecast] .m-card-copy>strong').textContent,new Intl.NumberFormat('ko-KR').format(expected.net)+'원');
 assert.equal(root.querySelector('.m-home-banner').getAttribute('href'),'#advisor');assert.deepEqual([...root.querySelectorAll('.m-tabbar>a')].map(a=>a.getAttribute('href')),['#overview','#assets','#advisor','#forecast','#menu']);assert.ok(root.querySelector('.m-account-secondary [data-action=edit]'));assert.equal(t.state.writes,0);
});
test('future date selection changes summary and composition from the same forecast engine as desktop',async()=>{
 const t=await app(domain.samplePortfolio(),'forecast'),rows=domain.forecastMonths(t.state.data,domain.todayKST(),12),chosen=rows[5],fmt=v=>new Intl.NumberFormat('ko-KR').format(v)+'원';
 assert.equal(t.document.querySelectorAll('[data-action=mobile-forecast-date]').length,12);assert.ok(t.document.querySelector('[data-trend-chart]'));t.click('[data-action=mobile-forecast-date][data-date="'+chosen.date+'"]');assert.equal(t.document.querySelector('.m-forecast-summary>strong').textContent,fmt(chosen.net));assert.match(t.document.querySelector('.m-detail-section').textContent,new RegExp(fmt(chosen.deposits).replaceAll(',','\\,')));
 await t.visit('payday');assert.ok(t.document.querySelector('[data-action=mobile-forecast-date]'));assert.match(t.document.querySelector('.m-forecast-summary').textContent,/급여 입금 후/);assert.equal(t.state.writes,0);
});
test('a custom forecast end month is inclusive and shared with the desktop charts and table',async()=>{
 const t=await app(domain.samplePortfolio(),'forecast'),today=domain.todayKST(),start=today.slice(0,7);
 const end=domain.shiftMonth(start,27),expected=domain.forecastMonths(t.state.data,today,28).at(-1);
 t.click('#forecast-end-month-button');
 t.change('[data-month-year]',end.slice(0,4));
 t.click(`[data-month-option="${end}"]`);
 assert.equal(t.document.querySelector('#forecast-end-month').value,end);
 assert.equal(t.document.querySelector('#forecast-detail-month').value,end);
 assert.match(t.document.querySelector('.m-forecast-summary').textContent,new RegExp(expected.date));
 t.change('#forecast-detail-month',domain.shiftMonth(end,-1));
 assert.equal(t.document.querySelector('#forecast-end-month').value,end);
 assert.notEqual(t.document.querySelector('#forecast-detail-month').value,end);
 t.context.location.search='?display=desktop';
 await t.visit('forecast');
 const rows=t.document.querySelectorAll('#main .table-panel tbody tr');
 assert.equal(rows.length,28);
 assert.equal(rows[27].querySelector('strong').textContent,end);
 assert.equal(rows[27].lastElementChild.textContent,new Intl.NumberFormat('ko-KR').format(expected.net)+'원');
 assert.ok(t.document.querySelector(`[data-chart-point][data-date="${expected.date.replaceAll('-','.')}"]`));
 await t.visit('overview');
 assert.equal(t.document.querySelectorAll('.overview-forecast .amount-bar-point').length,28);
 t.click('[data-action="chart-range"][data-range="6"]');
 assert.equal(t.document.querySelectorAll('.overview-forecast .amount-bar-point').length,6);
 assert.equal(t.document.querySelector('[data-action="chart-range"][data-range="6"]').getAttribute('aria-pressed'),'true');
 assert.equal(t.state.writes,0);
});
test('forecast table rows and graphs lead to the same month detail on desktop and mobile',async()=>{
 const data=domain.samplePortfolio(),today=domain.todayKST(),month=domain.shiftMonth(today.slice(0,7),1);
 const date=domain.paymentDate(month,20);
 data.cashflow.push({id:'detail-income',type:'other_income',name:'상세 조회 수입',date,amount:123456,repeat:'once'});
 data.cashflow.push({id:'excluded-detail',type:'expense',name:'숨은 제외 항목',date,amount:1200,repeat:'once',includeInForecast:false});
 const t=await app(data,'forecast');
 const url='#forecast/'+month;
 const stockAmount=new Intl.NumberFormat('ko-KR').format(domain.totals(data).stock)+'원';
 const stockFact=container=>[...container.querySelectorAll('dt')].find(label=>label.textContent==='주식 평가액').nextElementSibling.textContent;
 assert.equal(stockFact(t.document.querySelector('.m-detail-section')),stockAmount);
 assert.ok(t.document.querySelector(`.m-forecast-chart a[href="${url}"]`));
 t.click(`[data-action=mobile-forecast-date][data-date="${domain.paymentDate(month,31)}"]`);
 assert.equal(t.document.querySelector('.m-forecast-detail-link').getAttribute('href'),url);
 await t.visit(url.slice(1));
 const mobileDetail=t.document.querySelector('[data-forecast-detail-month]');
 assert.equal(mobileDetail.dataset.forecastDetailMonth,month);
 assert.equal(stockFact(mobileDetail),stockAmount);
 assert.match(mobileDetail.textContent,/상세 조회 수입/);
 assert.doesNotMatch(mobileDetail.textContent,/숨은 제외 항목/);
 const monthNet=mobileDetail.querySelector('.forecast-detail-hero strong').textContent;
 t.context.location.search='?display=desktop';
 await t.visit('forecast');
 assert.ok(t.document.querySelector(`a[data-chart-point][href="${url}"]`));
 const row=t.document.querySelector(`[data-forecast-row="${month}"]`);
 assert.equal(row.querySelector('a').getAttribute('href'),url);
 assert.equal(row.querySelector('[data-forecast-stock]').textContent,stockAmount);
 assert.equal(row.lastElementChild.textContent,monthNet);
 t.click(`[data-forecast-row="${month}"] td:last-child`);
 assert.equal(t.context.location.hash,url);
 await t.visit(url.slice(1));
 assert.equal(t.document.querySelector('.forecast-detail-hero strong').textContent,monthNet);
 assert.ok(t.document.querySelector('.forecast-detail-heading a[href="#forecast"]'));
 assert.ok(t.document.querySelector(`.forecast-detail-nav a[href="#forecast/${domain.shiftMonth(month,1)}"]`));
 assert.match(t.document.title,/전망 상세 · 돈모아/);
 t.document.getElementById('privacy-toggle').onclick();
 assert.equal(t.document.querySelector('.forecast-detail-hero strong').textContent,'••••••');
 assert.doesNotMatch(t.document.querySelector('.forecast-detail-events').textContent,/123,456/);
 assert.equal(t.state.writes,0);
});
test('general asset consultation works without loans, sends only question/history/revision and masks prior answers',async()=>{
 const data=domain.emptyPortfolio();data.deposits=[{id:'account',name:'내 계좌',balance:1000000,rate:0}];const t=await app(data,'advisor',{configured:true});const form=t.document.querySelector('#asset-advisor-form');assert.equal(form.querySelector('button').disabled,false);t.change('#asset-advisor-question','다음 달 자산을 알려 주세요.');form.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));assert.equal(t.state.advisorCalls.length,0);t.document.getElementById('confirm-ok').onclick();await tick();await tick();
 assert.equal(t.state.advisorCalls.length,1);const sent=t.state.advisorCalls[0];assert.equal(sent.mode,'assets');assert.equal(sent.revision,1);assert.equal(sent.dataSharingAccepted,true);assert.equal(sent.question,'다음 달 자산을 알려 주세요.');assert.equal(sent.data,undefined);assert.equal(sent.apiKey,undefined);assert.match(t.document.querySelector('.m-consult-answer').textContent,/급여일과 월말/);
 const next=t.document.querySelector('#asset-advisor-form');t.change('#asset-advisor-question','그럼 급여일에는요?');next.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));t.document.getElementById('confirm-ok').onclick();await tick();await tick();assert.equal(t.state.advisorCalls[1].history.length,2);assert.equal(t.state.writes,0);
 t.document.querySelector('#privacy-toggle').onclick();assert.equal(t.document.querySelector('.m-consult-answer'),null);assert.equal(t.document.querySelector('#asset-advisor-form'),null);
});
test('white home groups assets, expands the remaining rows and edits the existing account without writing display preferences',async()=>{
 const t=await app(domain.samplePortfolio()),before=structuredClone(t.state.data);assert.equal(t.document.querySelectorAll('.m-home-asset-group').length,1);assert.equal(t.document.querySelectorAll('.m-home-asset-list>.m-home-asset-row').length,5);assert.equal(t.document.querySelector('[data-action=mobile-home-more]').getAttribute('aria-expanded'),'false');
 t.click('[data-action=mobile-home-more]');assert.equal(t.document.querySelectorAll('.m-home-asset-row').length,6);assert.equal(t.document.querySelector('[data-action=mobile-home-more]').getAttribute('aria-expanded'),'true');assert.equal(t.state.writes,0);assert.deepEqual(t.state.data,before);
 t.click('.m-account-secondary [data-action=edit]');t.fill({balance:'876,543'});await t.submit();assert.equal(t.state.data.deposits[0].id,before.deposits[0].id);assert.equal(t.state.data.deposits[0].balance,876543);assert.equal(t.state.writes,1);assert.match(t.document.querySelector('.m-account-secondary').textContent,/876,543/);
 t.click('[data-action=mobile-home-more]');assert.equal(t.document.querySelectorAll('.m-home-asset-row').length,5);assert.equal(t.state.writes,1);
});
test('mobile plus stays outside asset lists and opens the correct add form for each category',async()=>{
 const t=await app();
 for(const [view,kind,field] of [['assets','deposits','balance'],['deposits','deposits','balance'],['stocks','stocks','valuation'],['loans','loans','rate'],['retirement','retirement','amount'],['cashflow','cashflow','date'],['fixed','fixed','day'],['planned','cashflow','date']]){
  await t.visit(view);
  const asset=t.document.querySelector('.m-account-list');
  const selector=asset?'[data-asset-manage="'+kind+'"]':'[data-action=add][data-kind="'+kind+'"]';
  const button=t.document.querySelector(selector);
  assert.ok(button,view);assert.ok(button.querySelector('svg'),view+' actual icon');
  assert.doesNotMatch(button.textContent,/<\/?(?:svg|path)\b|stroke=|viewBox=/,view+' readable label');
  if(asset)assert.equal(asset.querySelector('[data-action=add],.m-asset-fab'),null);
  t.click(selector);
  if(asset){
   assert.ok(t.document.querySelector('dialog.asset-manage-picker[open]'),view+' chooser');
   t.click('[data-asset-quick-add]');
  }
  assert.ok(t.document.querySelector('#editor').open,view+' editor');
  assert.ok(t.document.querySelector('#field-'+field),view+' matching field');
  t.click('[data-close=editor]');
 }
 assert.equal(t.state.writes,0);
});
test('the asset plus edits the selected record and can save a new record in the current category',async()=>{
 const data=domain.samplePortfolio(),t=await app(data,'assets');
 t.click('[data-asset-manage=deposits]');
 assert.equal(t.document.querySelectorAll('.asset-manage-picker [data-coach-choice]').length,data.deposits.length);
 assert.doesNotMatch(t.document.querySelector('.asset-manage-picker').textContent,/국내 주식|주택담보대출/);
 t.click('[data-coach-choice="1"]');
 assert.equal(t.document.querySelector('#field-name').value,data.deposits[1].name);
 t.fill({balance:'456,789'});await t.submit();
 assert.equal(t.state.data.deposits[1].id,data.deposits[1].id);
 assert.equal(t.state.data.deposits[1].balance,456789);
 t.click('[data-asset-manage=deposits]');t.click('[data-asset-quick-add]');
 t.fill({name:'새 예금',balance:'1,234'});await t.submit();
 assert.equal(t.state.data.deposits.at(-1).name,'새 예금');
 assert.equal(t.state.writes,2);
});
test('coach actions create and edit a real deposit through the shared save path and update desktop data',async()=>{
 const t=await app(domain.emptyPortfolio(),'deposits');t.click('[data-coach="act"]');
 assert.ok(t.document.querySelector('#editor').open);assert.equal(t.document.querySelector('#entry-continue').checked,false);
 t.fill({name:'안내로 입력한 예금',balance:'123,456'});await t.submit();
 assert.equal(t.state.writes,1);assert.equal(t.state.data.deposits.length,1);const id=t.state.data.deposits[0].id;
 t.click('[data-coach-open]');t.click('[data-coach="next"]');t.click('[data-coach="act"]');t.click('[data-coach-choice]');
 assert.equal(t.document.querySelector('#field-name').value,'안내로 입력한 예금');t.fill({balance:'234,567'});await t.submit();
 assert.equal(t.state.data.deposits[0].id,id);assert.equal(t.state.data.deposits[0].balance,234567);assert.equal(t.state.writes,2);
 t.context.location.search='?display=desktop';await t.visit('deposits');assert.match(t.document.querySelector('#main').textContent,/234,567/);
});
test('calendar coaching keeps the selected month and day; closing a picker or editor performs no write',async()=>{
 const t=await app(domain.emptyPortfolio(),'schedule'),previous=domain.shiftMonth(domain.todayKST().slice(0,7),-1),date=previous+'-15';
 t.click('[data-action=prev-month]');t.click('[data-action=mobile-day][data-date="'+date+'"]');
 t.click('[data-coach-open]');t.click('[data-coach="act"]');t.click('[data-coach-choice="0"]');
 assert.equal(t.document.querySelector('#field-type').value,'salary');assert.equal(t.document.querySelector('#field-date').value,date);
 t.click('[data-close=editor]');assert.match(t.document.querySelector('.m-month').textContent,new RegExp(Number(previous.slice(5))+'월'));
 assert.equal(t.state.writes,0);
 await t.visit('records');t.click('[data-coach="next"]');t.click('[data-coach="act"]');assert.match(t.document.querySelector('.coach-picker').textContent,/등록된 내역이 없습니다/);
 t.click('[data-coach-picker-close]');assert.equal(t.state.writes,0);
});
test('mobile category summaries show different financial facts and loan and card marks follow the saved issuer',async()=>{
 const data=domain.samplePortfolio();
 data.cardAccounts=[{id:'nh-profile',name:'NH 농협카드',day:10,archived:false,note:''}];
 data.cards[0].cardAccountId='nh-profile';
 data.cards[0].billingMonth=domain.todayKST().slice(0,7);
 const t=await app(data,'deposits');
 for(const [page,label,fact] of [
  ['deposits','전체 예금 잔액','만기'],
  ['stocks','총평가액','평가손익'],
  ['retirement','현재 퇴직금·연금','기준'],
  ['loans','대출 잔액 합계','이자']
 ]){
  await t.visit(page);
  assert.equal(t.document.querySelector('.m-account-summary>div>span').textContent,label);
  assert.ok(t.document.querySelector('.m-account-list .m-row-label small:last-child').textContent.includes(fact));
 }
 assert.deepEqual([...t.document.querySelectorAll('.m-account-list img')].map(img=>img.getAttribute('src')),[
  '/finance-brand-shinhan-bank.png','/finance-brand-kakaobank.png'
 ]);
 await t.visit('cards');
 assert.equal(t.document.querySelector('.m-bill-title img').getAttribute('src'),'/finance-brand-nh-card.png');
 await t.visit('cards/'+data.cards[0].id);
 assert.equal(t.document.querySelector('.m-balance-label img').getAttribute('src'),'/finance-brand-nh-card.png');
 assert.equal(t.state.writes,0);
});
test('records saved in the same asset category show distinct purpose and name icons',async()=>{
 const data=domain.emptyPortfolio();
 const names=['예금','주택 청약','퇴직연금','임차보증금','여행 준비','생활비'];
 data.deposits=names.map((name,index)=>({
  id:'account-'+index,name,balance:1000*(index+1),rate:0,maturity:'',
  institution:index===5?'신한은행':''
 }));
 const t=await app(data,'assets');
 const rowIcons=selector=>[...t.document.querySelectorAll(selector)].map(icon=>
  icon.getAttribute('src')||icon.textContent.trim());
 const expected=[
  '/finance-icon-deposits.svg','/finance-icon-housing.svg','/finance-icon-retirement.svg',
  '/finance-icon-lease.svg','여','/finance-brand-shinhan-bank.png'
 ];
 assert.deepEqual(rowIcons('.m-account-list .finance-icon'),expected);
 t.click('[data-asset-manage=deposits]');
 assert.deepEqual(rowIcons('.asset-manage-picker .finance-icon'),expected);
 t.click('[data-coach-picker-close]');
 await t.visit('deposits/account-3');
 assert.deepEqual(rowIcons('.m-balance-label .finance-icon'),['/finance-icon-lease.svg']);
 await t.visit('overview');
 assert.deepEqual(rowIcons('.m-home-asset-list .finance-icon'),expected.slice(0,5));
 assert.deepEqual(t.state.data.deposits.map(record=>record.name),names);
 assert.equal(t.state.writes,0);
});
test('loan icons distinguish product names with missing issuers and preserve explicit issuers',async()=>{
 const data=domain.emptyPortfolio();
 const names=['임차보증금 대출','BNK 모바일 테스트','IBK 사잇돌 예시','i 빅론 예시','i-ONE 직장인스마트론 예시','연습용 신용대출','상환용 대출','IBK 사잇돌 예시'];
 data.loans=names.map((name,index)=>({
  id:'loan-'+index,name,balance:1000*(index+1),principal:100,interest:10,
  rate:4,day:20,method:'원금균등',
  institution:index===6?'다올저축은행':index===7?'신한은행':'',note:''
 }));
 const t=await app(data,'loans');
 const signatures=container=>[...t.document.querySelectorAll(container+' .finance-icon')].map(icon=>{
  const source=(icon.matches('img')?icon:icon.querySelector('img'))?.getAttribute('src');
  return [source,icon.textContent.trim()].filter(Boolean).join(' ');
 });
 const expected=[
  '/finance-icon-lease.svg','/finance-brand-bnk-group.png',
  '/finance-brand-ibk-savings.png 사','/finance-brand-ibk-savings.png 빅',
  '/finance-brand-ibk-bank.png','연','/finance-brand-daol-savings.png','/finance-brand-shinhan-bank.png'
 ];
 assert.deepEqual(signatures('.m-account-list'),expected);
 t.click('[data-asset-manage=loans]');
 assert.deepEqual(signatures('.asset-manage-picker'),expected);
 t.click('[data-coach-picker-close]');
 await t.visit('loans/loan-3');
 assert.deepEqual(signatures('.m-balance-label'),[expected[3]]);
 assert.equal(t.state.writes,0);
});

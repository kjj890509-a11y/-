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
async function app(data=domain.emptyPortfolio(),route='overview',{configured=false}={}){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};window.matchMedia=query=>({matches:query.includes('max-width: 760px'),addEventListener(){}});window.setInterval=undefined;
 for(const d of document.querySelectorAll('dialog')){Object.defineProperty(d,'open',{get(){return d.hasAttribute('open');}});d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open');}
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&!el.disabled).map(el=>[el.name,el.value]));}get(key){return this.values.get(key)??null;}}
 const state={data:domain.validatePortfolio(data),revision:1,writes:0,gets:0,fail:false,advisorCalls:[]};
 const context=vm.createContext({...domain,...workspace,...navigation,...dashboard,...disclosure,...charts,...loans,...statistics,...advisor,renderLoanForecastPanel,document,window,location:{hash:'#'+route,search:''},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
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
 const t=await app(domain.samplePortfolio(),'advisor');assert.ok(t.document.querySelector('#asset-advisor-form button').disabled);assert.match(t.document.querySelector('#main').textContent,/연결이 설정되지 않았습니다/);t.click('[data-action=mobile-advisor-mode][data-mode=repayment]');assert.ok(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]'));assert.equal(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]').hidden,false);assert.ok(t.document.querySelector('[data-mobile-app] .m-tabbar'));assert.match(t.document.querySelector('#main').textContent,/연결이 설정되지 않았습니다/);assert.ok(t.document.querySelector('[data-advisor-consult]').disabled);t.click('[data-ui-stage="1"]');assert.equal(t.document.querySelector('[data-ui-stage-panel="1"]').hidden,false);assert.ok(t.document.querySelector('#advisor-form'));assert.equal(t.state.writes,0);
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
test('general asset consultation works without loans, sends only question/history/revision and masks prior answers',async()=>{
 const data=domain.emptyPortfolio();data.deposits=[{id:'account',name:'내 계좌',balance:1000000,rate:0}];const t=await app(data,'advisor',{configured:true});const form=t.document.querySelector('#asset-advisor-form');assert.equal(form.querySelector('button').disabled,false);t.change('#asset-advisor-question','다음 달 자산을 알려 주세요.');form.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(t.state.advisorCalls.length,1);const sent=t.state.advisorCalls[0];assert.equal(sent.mode,'assets');assert.equal(sent.revision,1);assert.equal(sent.question,'다음 달 자산을 알려 주세요.');assert.equal(sent.data,undefined);assert.equal(sent.apiKey,undefined);assert.match(t.document.querySelector('.m-consult-answer').textContent,/급여일과 월말/);
 const next=t.document.querySelector('#asset-advisor-form');t.change('#asset-advisor-question','그럼 급여일에는요?');next.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(t.state.advisorCalls[1].history.length,2);assert.equal(t.state.writes,0);
 t.document.querySelector('#privacy-toggle').onclick();assert.equal(t.document.querySelector('.m-consult-answer'),null);assert.equal(t.document.querySelector('#asset-advisor-form'),null);
});
test('white home groups assets, expands the remaining rows and edits the existing account without writing display preferences',async()=>{
 const t=await app(domain.samplePortfolio()),before=structuredClone(t.state.data);assert.equal(t.document.querySelectorAll('.m-home-asset-group').length,1);assert.equal(t.document.querySelectorAll('.m-home-asset-list>.m-home-asset-row').length,5);assert.equal(t.document.querySelector('[data-action=mobile-home-more]').getAttribute('aria-expanded'),'false');
 t.click('[data-action=mobile-home-more]');assert.equal(t.document.querySelectorAll('.m-home-asset-row').length,6);assert.equal(t.document.querySelector('[data-action=mobile-home-more]').getAttribute('aria-expanded'),'true');assert.equal(t.state.writes,0);assert.deepEqual(t.state.data,before);
 t.click('.m-account-secondary [data-action=edit]');t.fill({balance:'876,543'});await t.submit();assert.equal(t.state.data.deposits[0].id,before.deposits[0].id);assert.equal(t.state.data.deposits[0].balance,876543);assert.equal(t.state.writes,1);assert.match(t.document.querySelector('.m-account-secondary').textContent,/876,543/);
 t.click('[data-action=mobile-home-more]');assert.equal(t.document.querySelectorAll('.m-home-asset-row').length,5);assert.equal(t.state.writes,1);
});

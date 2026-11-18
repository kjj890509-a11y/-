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
async function app(data=domain.emptyPortfolio(),route='overview'){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};window.matchMedia=query=>({matches:query.includes('max-width: 760px'),addEventListener(){}});window.setInterval=undefined;
 for(const d of document.querySelectorAll('dialog')){Object.defineProperty(d,'open',{get(){return d.hasAttribute('open');}});d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open');}
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&!el.disabled).map(el=>[el.name,el.value]));}get(key){return this.values.get(key)??null;}}
 const state={data:domain.validatePortfolio(data),revision:1,writes:0,gets:0,fail:false};
 const context=vm.createContext({...domain,...workspace,...navigation,...dashboard,...disclosure,...charts,...loans,...statistics,...advisor,renderLoanForecastPanel,document,window,location:{hash:'#'+route,search:''},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(path==='/api/advisor')return{ok:true,json:async()=>({configured:false})};
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
 for(const source of [domain.samplePortfolio(),domain.emptyPortfolio()]){const before=structuredClone(source),t=await app(source);for(const view of [...Object.keys(navigation.viewLabels),'menu']){await t.visit(view);assert.ok(t.document.querySelector('[data-mobile-app]'),view);assert.equal(t.document.querySelectorAll('.m-tabbar>a').length,4,view);assert.equal(t.document.querySelectorAll('.m-tabbar [aria-current=page]').length,1,view);assert.doesNotMatch(t.document.querySelector('#main').textContent,/NaN|undefined|Infinity/,view);assert.equal(t.document.querySelector('[data-page-shell]'),null,view);}assert.equal(t.state.writes,0);assert.deepEqual(source,before);}
});
test('home has the account stack and opens actual record detail, including monthly principal and interest',async()=>{
 const data=domain.samplePortfolio(),t=await app(data);assert.match(t.document.querySelector('.m-account-card').textContent,new RegExp(data.deposits[0].name));assert.equal(t.document.querySelector('.m-card-main').getAttribute('href'),'#deposits/'+data.deposits[0].id);
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
 const t=await app(domain.samplePortfolio(),'advisor');assert.ok(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]'));assert.equal(t.document.querySelector('[data-mobile-app] .m-advisor [data-ui-stage-panel="3"]').hidden,false);assert.ok(t.document.querySelector('[data-mobile-app] .m-tabbar'));assert.match(t.document.querySelector('#main').textContent,/연결이 설정되지 않았습니다/);assert.ok(t.document.querySelector('[data-advisor-consult]').disabled);t.click('[data-ui-stage="1"]');assert.equal(t.document.querySelector('[data-ui-stage-panel="1"]').hidden,false);assert.ok(t.document.querySelector('#advisor-form'));assert.equal(t.state.writes,0);
});

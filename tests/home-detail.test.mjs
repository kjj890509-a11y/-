import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as loansPage from '../public/loans-page.mjs';
import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import * as disclosure from '../public/disclosure.mjs';
import * as charts from '../public/chart.mjs';
import * as statsPage from '../public/statistics-page.mjs';
import * as advisorPage from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
const tick=()=>new Promise(setImmediate);
async function start(data=domain.samplePortfolio()){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 const state={data,revision:1,writes:0,downloads:[]};
 const context=vm.createContext({...loansPage,...workspace,...navigation,...dashboard,...disclosure,...domain,...charts,...statsPage,...advisorPage,renderLoanForecastPanel,document,window,location:{hash:'#overview'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,Blob,URL:{createObjectURL:blob=>{state.downloads.push(blob);return 'blob:test-download';},revokeObjectURL:()=>{}},setTimeout,clearTimeout,fetch:async(path,init)=>{
  assert.equal(path,'/api/portfolio');
  if(init?.method==='PUT'){state.writes++;state.data=domain.validatePortfolio(JSON.parse(init.body).data);state.revision++;}
  return {ok:true,json:async()=>({data:state.data,revision:state.revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();
 const click=selector=>{const element=document.querySelector(selector);assert.ok(element,selector);element.dispatchEvent(new Event('click',{bubbles:true}));};
 const select=key=>click(`[data-action="home-detail"][data-detail="${key}"]`);
 return {document,window,Event,context,state,click,select};
}

test('home cards replace only the detail area and reset without navigation or writes',async()=>{
 const {document,context,state,select}=await start();
 const cards=document.querySelector('.home-stats'),heading=document.querySelector('h1'),nav=document.querySelector('#main-nav');
 for(const key of ['net','deposits','debt','cashflow']){
  const previous=document.querySelector('#home-dashboard');select(key);
  assert.equal(context.location.hash,'#overview');
  assert.equal(document.querySelector('main').dataset.view,'overview');
  assert.equal(document.querySelector('.home-stats'),cards);
  assert.equal(document.querySelector('h1'),heading);assert.equal(document.querySelectorAll('h1').length,1);
  assert.equal(document.querySelector('#main-nav'),nav);
  assert.notEqual(document.querySelector('#home-dashboard'),previous);
  assert.equal(document.querySelector('.home-stat[aria-pressed="true"]').dataset.detail,key);
  assert.ok(document.querySelector('[data-home-detail-title]'));
 }
 select('all');assert.ok(document.querySelector('.home-budget'));
 assert.equal(document.querySelector('.home-stat[aria-pressed="true"]'),null);
 assert.equal(state.writes,0);
 // Asset allocation drill-downs share the same interaction.
 select('stocks');assert.match(document.querySelector('[data-home-detail-title]').textContent,/주식/);
 select('all');select('retirement');assert.match(document.querySelector('[data-home-detail-title]').textContent,/퇴직/);
});

test('inline account search and editors use the selected category; masking survives switches',async()=>{
 const {document,Event,select,click}=await start();
 select('deposits');const search=document.querySelector('#record-search');
 search.value='no-match-987';search.dispatchEvent(new Event('input',{bubbles:true}));
 assert.match(document.querySelector('#records-body').textContent,/조건에 맞는 내역이 없습니다/);
 select('net');select('deposits');click('[data-ledger-action="reset"]');assert.ok(document.querySelector('#records-body [data-ledger-action="edit"]'));
 click('#records-body [data-ledger-action="edit"]');assert.equal(document.querySelector('#editor').hasAttribute('open'),true);assert.ok(document.querySelector('#field-maturity'));
 click('[data-close="editor"]');click('.home-detail-heading [data-action="add"]');assert.ok(document.querySelector('#field-maturity'));
 click('[data-close="editor"]');document.querySelector('#privacy-toggle').onclick();
 assert.equal(document.querySelector('.home-stat[aria-pressed="true"]').dataset.detail,'deposits');
 assert.ok([...document.querySelectorAll('#records-body td.numeric')].some(cell=>cell.textContent==='••••••'));
 select('net');assert.ok([...document.querySelectorAll('.home-net-breakdown b')].every(el=>el.textContent.includes('••••••')));
 assert.ok([...document.querySelectorAll('[data-chart-point]')].every(el=>el.dataset.amount==='••••••'));
});

test('inline debt filters, forecast and card updates retain the selected home detail',async()=>{
 const {document,Event,context,state,select,click}=await start();
 select('debt');assert.ok(document.querySelector('#loan-forecast-select'));
 const search=document.querySelector('#record-search');search.value='no loan match';search.dispatchEvent(new Event('input',{bubbles:true}));
 assert.match(document.querySelector('[data-ledger-scope="loans"] #records-body').textContent,/조건에 맞는 내역이 없습니다/);
 select('net');select('debt');click('[data-action="loan-forecast"]');
 assert.equal(context.location.hash,'#overview');assert.ok(document.querySelector('.home-stat[aria-pressed="true"][data-detail="debt"]'));
 const before=domain.totals(state.data).cards;click('#home-dashboard [data-action="toggle-paid"]');await tick();
 assert.equal(state.writes,1);assert.ok(domain.totals(state.data).cards<before);
 assert.equal(context.location.hash,'#overview');assert.ok(document.querySelector('[data-home-detail-title]').textContent.includes('부채'));
});

test('monthly detail includes salaries and expenses, and empty categories remain usable',async()=>{
 const {document,state,select,click}=await start();select('cashflow');
 assert.ok(document.querySelector('.home-detail-table').textContent.includes(state.data.cashflow[0].name));
 assert.match(document.querySelector('.home-detail-table').textContent,/대출 원금·이자/);
 const first=document.querySelector('.home-detail-table h2').textContent;click('[data-action="next-month"]');
 assert.notEqual(document.querySelector('.home-detail-table h2').textContent,first);
 assert.equal(document.querySelector('.home-stat[aria-pressed="true"]').dataset.detail,'cashflow');
 const empty=await start(domain.emptyPortfolio());empty.select('deposits');
 assert.match(empty.document.querySelector('#home-dashboard').textContent,/조건에 맞는 내역이 없습니다/);
 assert.ok(empty.document.querySelector('#home-dashboard [data-action="add"][data-kind="deposits"]'));
 empty.select('debt');assert.match(empty.document.querySelector('#home-dashboard').textContent,/미결제 카드대금이 없습니다/);
});


test('Stripe command search opens with a keyboard shortcut and selects a real account editor',async()=>{
 const {document,Event,context,state,click}=await start();
 const key=(element,value,props={})=>{const event=new Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(event,'key',{value});for(const [name,value]of Object.entries(props))Object.defineProperty(event,name,{value});element.dispatchEvent(event);};
 key(document,'k',{ctrlKey:true});assert.equal(document.querySelector('#search-dialog').hasAttribute('open'),true);
 const input=document.querySelector('#dashboard-search');input.value=state.data.deposits[0].name;input.dispatchEvent(new Event('input',{bubbles:true}));
 const result=document.querySelector('[data-search-id]');assert.equal(result.dataset.searchId,state.data.deposits[0].id);
 click('[data-search-id]');assert.equal(document.querySelector('#search-dialog').hasAttribute('open'),false);
 assert.equal(context.location.hash,'deposits');assert.equal(document.querySelector('#editor').hasAttribute('open'),true);
 assert.equal(document.querySelector('#field-name').value,state.data.deposits[0].name);
 assert.equal(state.writes,0);
});

test('inline table CSV download respects the filtered rows and hidden amounts',async()=>{
 const {document,Event,state,select,click}=await start();select('deposits');
 document.querySelector('#privacy-toggle').onclick();
 const input=document.querySelector('#record-search');input.value=state.data.deposits[0].name;input.dispatchEvent(new Event('input',{bubbles:true}));
 click('[data-table-export]');assert.equal(state.downloads.length,1);
 const content=await state.downloads[0].text();
 assert.ok(content.includes(state.data.deposits[0].name));assert.ok(content.includes('••••••'));
 assert.ok(!content.includes(String(state.data.deposits[0].balance)));assert.equal(state.writes,0);
});

test('calendar selects dates, filters and adjacent-month keyboard days without saving; add form uses the selected date',async()=>{
 const {document,context,state,click,Event}=await start();
 vm.runInContext("view='schedule';month='2028-02';render()",context);
 click('[data-action="calendar-day"][data-date="2028-02-29"]');assert.equal(document.querySelector('[data-action=calendar-day][aria-pressed=true]').dataset.date,'2028-02-29');
 const status=document.querySelector('#calendar-status');for(const option of status.querySelectorAll('option'))option.toggleAttribute('selected',option.value==='expense');status.dispatchEvent(new Event('change',{bubbles:true}));assert.equal(document.querySelector('#calendar-status').value,'expense');
 const key=new Event('keydown',{bubbles:true});key.key='ArrowRight';document.querySelector('[data-date="2028-02-29"][data-action=calendar-day]').dispatchEvent(key);
 assert.equal(document.querySelector('[data-action=calendar-day][aria-pressed=true]').dataset.date,'2028-03-01');
 click('[data-action=calendar-add][data-type=expense]');assert.equal(document.querySelector('#field-date').value,'2028-03-01');assert.equal(state.writes,0);
});


test('calendar category and list controls combine with status, month selection and reset without writing finance',async()=>{
 const {document,context,state,click,Event}=await start();vm.runInContext("view='schedule';render()",context);
 click('[data-action=calendar-category][data-category=cards]');click('[data-action=calendar-mode][data-mode=list]');
 assert.equal(document.querySelector('.cf-grid'),null);assert.ok(document.querySelector('.cf-month-list'));
 assert.ok([...document.querySelectorAll('.cf-event')].every(row=>row.dataset.kind==='cards'));
 click('[data-action=calendar-reset]');assert.equal(document.querySelector('[data-action=calendar-category][aria-pressed=true]').dataset.category,'all');
 const monthField=document.querySelector('#calendar-month');monthField.value='2028-02';monthField.dispatchEvent(new Event('change',{bubbles:true}));assert.equal(document.querySelector('#calendar-month').value,'2028-02');
 click('[data-action=calendar-mode][data-mode=month]');assert.equal(document.querySelectorAll('.cf-day:not(.is-outside)').length,29);assert.equal(state.writes,0);
});

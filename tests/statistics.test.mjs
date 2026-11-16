import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import * as disclosure from '../public/disclosure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as charts from '../public/chart.mjs';
import * as statsPage from '../public/statistics-page.mjs';
import {buildStatistics, initialStatisticsFilters, statisticsPeriod} from '../public/statistics.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';

function fixture(){
 const data=domain.emptyPortfolio();
 const base={institution:'신한은행',rate:12,method:'원금균등',note:'',interestMode:'estimate',day:25};
 data.loans=[{...base,id:'l1',name:'신한 대출',balance:1200,principal:400,interest:12},{...base,id:'l2',name:'국민 대출',institution:'국민은행',balance:1000,principal:100,interest:10}];
 data.loanPayments=[{id:'p1',loanId:'l1',name:'신한 대출',institution:'신한은행',date:'2026-01-25',principal:400,interest:16,note:''},{id:'p2',loanId:'l1',name:'신한 대출',institution:'신한은행',date:'2026-02-25',principal:400,interest:14,note:''}];
 data.fixed=[{id:'dog',name:'도치',amount:50000,day:31,startMonth:'2026-01',endMonth:'2026-12',paymentSource:'account',note:'정기 지출'},{id:'phone',name:'통신비',amount:1000,day:25,startMonth:'2026-01',endMonth:'2026-12',paymentSource:'card',note:''}];
 data.cashflow=[{id:'snack',name:'도치 간식',type:'expense',amount:20000,date:'2026-06-15',repeat:'once',note:''},{id:'salary',name:'월급',type:'salary',amount:3000000,date:'2026-01-25',repeat:'monthly',note:''},{id:'excluded',name:'미확정 지급',type:'other_income',amount:777,date:'2026-07-01',repeat:'once',includeInForecast:false,note:''}];
 data.cards=[{id:'c',name:'카드대금',amount:10000,dueDate:'2026-11-20',paid:true,note:''}];
 return data;
}
const today='2026-11-16';
const filters=()=>initialStatisticsFilters(today);
const money=value=>new Intl.NumberFormat('ko-KR').format(value)+'원';

test('annual bank statistics combine recorded repayments and future declining-interest projections',()=>{
 const data=fixture();data.loans[0].institution=' 신한은행 ';const before=structuredClone(data);
 const result=buildStatistics(data,{...filters(),kind:'loans',bank:'신한은행'},today);
 assert.equal(result.rows.length,4);
 assert.equal(result.totals.actualLoanPayment,830);
 assert.equal(result.totals.projectedLoanPayment,820);
 assert.equal(result.totals.loanPayment,1650);
 assert.equal(result.totals.principal,1600);
 assert.equal(result.totals.interest,50);
 assert.ok(result.rows.every(row=>row.institution==='신한은행'));
 assert.equal(result.months.length,12);
 assert.deepEqual(data,before);
});
test('custom dates include both boundaries and expand month-end expenses correctly',()=>{
 const result=buildStatistics(fixture(),{...filters(),preset:'custom',start:'2026-02-28',end:'2026-03-31',kind:'expense',query:'도치'},today);
 assert.equal(result.totals.expense,100000);
 assert.deepEqual(result.rows.map(row=>row.date),['2026-03-31','2026-02-28']);
 assert.equal(result.months.length,2);
 assert.deepEqual(statisticsPeriod('year','2025',today),{start:'2025-01-01',end:'2025-12-31'});
 assert.deepEqual(statisticsPeriod('month','2028-02',today),{start:'2028-02-01',end:'2028-02-29'});
});
test('specific expense search and item selection work without double-counting card-included fixed costs',()=>{
 const data=fixture();
 assert.equal(buildStatistics(data,{...filters(),kind:'expense',query:'도치'},today).totals.expense,620000);
 assert.equal(buildStatistics(data,{...filters(),item:'fixed:dog'},today).totals.expense,600000);
 const cardIncluded=buildStatistics(data,{...filters(),query:'통신비'},today);
 assert.equal(cardIncluded.totals.expense,0);assert.equal(cardIncluded.totals.cardIncluded,12000);
 assert.equal(buildStatistics(data,{...filters(),kind:'expense'},today).totals.expense,630000);
 assert.equal(buildStatistics(data,{...filters(),kind:'cards'},today).totals.expense,10000);
 assert.equal(buildStatistics(data,{...filters(),kind:'income'},today).totals.income,36000000);
});
test('future ranges warm up loan balances before their start and past loan totals require records',()=>{
 const data=fixture();
 let result=buildStatistics(data,{...filters(),start:'2026-12-01',end:'2026-12-31',kind:'loans',item:'loans:l1'},today);
 assert.equal(result.totals.interest,8);
 result=buildStatistics(data,{...filters(),start:'2025-01-01',end:'2025-12-31',kind:'loans'},today);
 assert.equal(result.rows.length,0);assert.ok(result.pastLoanRange);
 assert.throws(()=>buildStatistics(data,{...filters(),start:'2026-12-01',end:'2026-01-01'},today),/시작일/);
 assert.throws(()=>buildStatistics(data,{...filters(),start:'2000-01-01',end:'2026-12-31'},today),/10년/);
});
test('statistics render masked amounts, escaped item names and an accessible statistics graph',()=>{
 const data=fixture();data.fixed[0].name='<img src=x onerror=alert(1)>';
 const html=statsPage.renderStatisticsPage(data,filters(),{formatMoney:()=> '••••••',formatCompact:()=> '••••',today});
 const {document}=parseHTML(html);
 assert.equal(document.querySelectorAll('img').length,0);
 assert.equal(document.querySelector('h1').firstChild.textContent,'기간별 분석');
 assert.match(document.querySelector('.stats-trend svg').getAttribute('aria-label'),/지출·상환/);
 assert.doesNotMatch(html,/36,000,000원|600,000원/);
});
test('the statistics route applies year, bank and expense filters through the real controls',async()=>{
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};
 const context=vm.createContext({...workspace,...navigation,...dashboard,...disclosure,...domain,...charts,...statsPage,renderLoanForecastPanel,document,window,location:{hash:'#statistics'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({data:fixture(),revision:1})})});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);
 await new Promise(setImmediate);
 assert.equal(document.querySelector('h1').firstChild.textContent,'기간별 분석');
 assert.equal(document.querySelector('#statistics-filter-dialog').hasAttribute('open'),false);
 document.querySelector('[data-ui-open="statistics-filter-dialog"]').dispatchEvent(new Event('click',{bubbles:true}));
 assert.ok(document.querySelector('#statistics-filter-dialog').hasAttribute('open'));
 document.querySelector('#stats-year').value='2025';document.querySelector('#stats-year').dispatchEvent(new Event('change',{bubbles:true}));
 assert.equal(document.querySelector('#stats-start').value,'2025-01-01');
 assert.equal(document.querySelector('#stats-end').value,'2025-12-31');
 assert.ok(document.querySelector('#statistics-filter-dialog').hasAttribute('open'));
 const bank=document.querySelector('#stats-bank');
 for(const option of bank.querySelectorAll('option'))option.selected=option.value==='신한은행';
 bank.dispatchEvent(new Event('change',{bubbles:true}));
 assert.equal(document.querySelector('#stats-kind').value,'loans');
 assert.equal(document.querySelector('#stats-bank').value,'신한은행');
 const kind=document.querySelector('#stats-kind');
 for(const option of kind.querySelectorAll('option'))option.selected=option.value==='expense';
 kind.dispatchEvent(new Event('change',{bubbles:true}));
 assert.equal(document.querySelector('#stats-bank').value,'');
 document.querySelector('#stats-query').value='도치';
 document.querySelector('#statistics-filter-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(document.querySelector('#stats-query').value,'도치');
 assert.equal(document.querySelector('#statistics-filter-dialog').hasAttribute('open'),false);
 assert.match(document.getElementById('toast').textContent,/조회 조건/);
});
test('adding an actual repayment through the statistics editor updates history without reducing current loan balances',async()=>{
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 let stored=fixture(),revision=1;const opening=domain.totals(stored).loans;
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].map(field=>[field.name,field.value]));}get(name){return this.values.get(name)??null;}}
 const context=vm.createContext({...workspace,...navigation,...dashboard,...disclosure,...domain,...charts,...statsPage,renderLoanForecastPanel,document,window,location:{hash:'#statistics'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(init?.method==='PUT'){stored=domain.recordCurrentSnapshot(domain.validatePortfolio(JSON.parse(init.body).data));revision++;}
  return {ok:true,json:async()=>({data:stored,revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await new Promise(setImmediate);
 document.querySelector('[data-action="add-loan-payment"]').dispatchEvent(new Event('click',{bubbles:true}));
 assert.ok(document.getElementById('editor').hasAttribute('open'));
 for(const [name,value]of Object.entries({name:'추가 상환 기록',institution:'신한은행',date:'2026-03-25',principal:'400',interest:'12',note:'실제 납부'}))document.getElementById('payment-'+name).value=value;
 await document.getElementById('record-form').onsubmit({preventDefault(){},target:document.getElementById('record-form')});
 assert.equal(stored.loanPayments.length,3);assert.equal(stored.loanPayments.at(-1).interest,12);
 assert.equal(domain.totals(stored).loans,opening);
 assert.match(document.getElementById('main').textContent,/추가 상환 기록/);
});

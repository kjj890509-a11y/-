import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as charts from '../public/chart.mjs';
import * as disclosure from '../public/disclosure.mjs';
import * as loansPage from '../public/loans-page.mjs';
import * as statisticsPage from '../public/statistics-page.mjs';
import * as advisorPage from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';

test('the retirement editor saves a monthly company contribution and reveals its recurring date when needed',async()=>{
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 let stored=domain.emptyPortfolio(),revision=1,writes=0;
 stored.retirement=[{id:'pension',name:'회사 퇴직연금',institution:'회사',amount:10000000,asOf:domain.todayKST(),note:''}];
 stored.deposits=[{id:'cash',name:'생활비',balance:1000,rate:0,maturity:'',note:''}];
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].map(field=>[field.name,field.value]));}get(name){return this.values.get(name)??null;}}
 const context=vm.createContext({...workspace,...navigation,...dashboard,...domain,...charts,...disclosure,...loansPage,...statisticsPage,...advisorPage,renderLoanForecastPanel,document,window,location:{hash:'#retirement'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(init?.method==='PUT'){writes++;stored=domain.recordCurrentSnapshot(domain.validatePortfolio(JSON.parse(init.body).data));revision++;}
  return {ok:true,json:async()=>({data:stored,revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);
 await new Promise(setImmediate);
 const edit=()=>document.querySelector('[data-ledger-scope="retirement"] [data-ledger-action="edit"]').dispatchEvent(new Event('click',{bubbles:true}));
 edit();
 const monthly=document.getElementById('field-monthlyContribution'),date=document.getElementById('field-contributionDate');
 assert.equal(monthly.value,'0');assert.ok(date.closest('.field').hidden);assert.equal(date.required,false);
 monthly.value='250,000';monthly.dispatchEvent(new Event('input',{bubbles:true}));
 assert.equal(date.closest('.field').hidden,false);assert.equal(date.required,true);
 const firstDate=domain.paymentDate(domain.shiftMonth(domain.todayKST().slice(0,7),1),25);date.value=firstDate;
 const form=document.getElementById('record-form');await form.onsubmit({preventDefault(){},target:form});
 assert.equal(writes,1);assert.equal(stored.retirement[0].monthlyContribution,250000);assert.equal(stored.retirement[0].contributionDate,firstDate);
 assert.equal(stored.retirement[0].amount,10000000);assert.equal(stored.deposits[0].balance,1000);
 const monthlyCell=document.querySelector('#records-body tr [data-column="monthlyContribution"]');
 assert.equal(monthlyCell.querySelector('input').value,'250,000');assert.match(monthlyCell.textContent,/매월 25일/);
 assert.equal(document.querySelector('.metric-strip .metric-box:nth-child(2) strong').textContent,'250,000원');
 edit();assert.equal(document.getElementById('field-contributionDate').value,firstDate);
 document.getElementById('field-monthlyContribution').value='0';document.getElementById('field-monthlyContribution').dispatchEvent(new Event('input',{bubbles:true}));
 assert.ok(document.getElementById('field-contributionDate').closest('.field').hidden);assert.equal(document.getElementById('field-contributionDate').required,false);
 const changeMonth=domain.shiftMonth(firstDate.slice(0,7),2),endMonth=domain.shiftMonth(changeMonth,1);
 const click=el=>el.dispatchEvent(new Event('click',{bubbles:true}));
 click(document.getElementById('retirement-change-add'));
 assert.equal(document.getElementById('field-contributionDate').required,true);
 const change=document.querySelector('[data-retirement-change]');
 change.querySelector('[data-month-value]').value=changeMonth;
 change.querySelector('[data-contribution-amount]').value='380,000';
 document.getElementById('field-contributionEndMonth').value=endMonth;
 document.getElementById('field-monthlyContribution').value='250,000';
 await form.onsubmit({preventDefault(){},target:form});
 assert.equal(writes,2);
 assert.deepEqual(stored.retirement[0].contributionChanges,[{month:changeMonth,amount:380000}]);
 assert.equal(stored.retirement[0].contributionEndMonth,endMonth);
 edit();
 assert.equal(document.querySelector('[data-retirement-change] [data-contribution-amount]').value,'380,000');
 assert.equal(document.getElementById('field-contributionEndMonth').value,endMonth);
 click(document.querySelector('[data-action="retirement-change-remove"]'));
 await form.onsubmit({preventDefault(){},target:form});
 assert.equal(writes,3);assert.deepEqual(stored.retirement[0].contributionChanges,[]);
 document.getElementById('editor').close();
 document.getElementById('privacy-toggle').onclick();
 assert.ok([...document.querySelectorAll('#records-body .numeric')].every(cell=>cell.textContent.startsWith('••••••')));
});

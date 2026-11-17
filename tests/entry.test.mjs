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
import * as loansPage from '../public/loans-page.mjs';
import * as statisticsPage from '../public/statistics-page.mjs';
import * as advisorPage from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
const tick=()=>new Promise(setImmediate);
async function start(){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',v);}});
 for(const dialog of document.querySelectorAll('dialog')){Object.defineProperty(dialog,'open',{configurable:true,get(){return this.hasAttribute('open');}});dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&!el.disabled).map(el=>[el.name,el.value]));}get(name){return this.values.get(name)??null;}}
 const state={data:domain.emptyPortfolio(),revision:1,writes:0,fail:false,pause:null};
 const context=vm.createContext({...domain,...workspace,...navigation,...dashboard,...disclosure,...charts,...loansPage,...statisticsPage,...advisorPage,renderLoanForecastPanel,document,window,location:{hash:'#entry'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,FormData:BrowserFormData,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(path==='/api/preferences')return {ok:true,json:async()=>({data:{version:1,tables:{}},revision:0})};
  assert.equal(path,'/api/portfolio');
  if(init?.method==='PUT'){state.writes++;if(state.pause)await state.pause;if(state.fail)return {ok:false,json:async()=>({error:'동시에 수정됐습니다. 다시 확인해 주세요.'})};const body=JSON.parse(init.body);assert.equal(body.revision,state.revision);state.data=domain.validatePortfolio(body.data);state.revision++;}
  return {ok:true,json:async()=>({data:state.data,revision:state.revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new Event('click',{bubbles:true}));};
 const change=(id,value)=>{const el=document.getElementById(id);if(el.tagName==='SELECT'){for(const option of el.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));}else if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));};
 const fill=values=>{for(const [key,value]of Object.entries(values))change('field-'+key,value);};
 const submit=()=>{const form=document.getElementById('record-form');return form.onsubmit({target:form,preventDefault(){}});};
 return {document,context,state,click,change,fill,submit};
}
test('unified entry covers every financial kind and routes all eleven presets without writes or navigation',async()=>{
 const t=await start();assert.equal(t.document.querySelector('h1').textContent,'통합 입력');assert.equal(t.document.querySelectorAll('[data-action=entry-start]').length,11);
 assert.deepEqual([...new Set(navigation.entryPresets.map(p=>p.kind))].sort(),[...domain.KINDS].sort());
 for(const p of navigation.entryPresets){t.click(`[data-entry-type="${p.id}"]`);assert.equal(t.document.querySelector('#editor-title').textContent,p.label+' 등록');assert.equal(t.document.querySelector('#entry-type').value,p.id);for(const [key,value]of Object.entries(p.defaults))assert.equal(t.document.querySelector('#field-'+key).value,String(value));if(p.future)assert.ok(t.document.querySelector('#field-date').value>domain.todayKST());t.click('[data-close=editor]');}
 assert.equal(t.state.writes,0);assert.equal(t.context.location.hash,'#entry');
});
test('successive saves reset committed values, keep the entry page open and use the same financial records',async()=>{
 const t=await start();t.click('[data-entry-type=deposits]');t.fill({name:'통합 입력 예금',balance:'1,234,567'});await t.submit();
 assert.equal(t.state.writes,1);assert.equal(t.state.data.deposits[0].balance,1234567);assert.ok(t.document.querySelector('#editor').open);assert.equal(t.document.querySelector('#field-name').value,'');assert.equal(t.document.querySelector('#field-balance').value,'0');assert.match(t.document.querySelector('.entry-save-message').textContent,/저장 완료/);
 t.change('entry-type','salary');t.fill({name:'회사 월급',amount:'3,000,000',date:domain.todayKST()});await t.submit();
 assert.equal(t.state.writes,2);assert.equal(t.state.data.cashflow.length,1);assert.equal(t.state.data.cashflow[0].type,'salary');assert.equal(t.state.data.cashflow[0].repeat,'monthly');assert.equal(t.state.data.deposits[0].balance,1234567);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,2);assert.equal(t.context.location.hash,'#entry');
 t.change('entry-type','cards');t.fill({name:'카드 A',amount:'250,000',dueDate:domain.todayKST()});t.change('entry-continue',false);await t.submit();assert.equal(t.document.querySelector('#editor').open,false);assert.equal(t.state.data.cards[0].amount,250000);
 t.document.getElementById('privacy-toggle').onclick();assert.ok([...t.document.querySelectorAll('.entry-recent-info b')].every(el=>el.textContent==='••••••'));
});
test('category switches and cancellation preserve unsaved drafts in memory without writing them',async()=>{
 const t=await start();t.click('[data-entry-type=income]');t.fill({name:'아직 저장 전',amount:'91,000',note:'입력 중'});t.change('entry-type','stocks');t.fill({name:'주식 계좌',valuation:'400,000'});t.change('entry-type','income');
 assert.equal(t.document.querySelector('#field-name').value,'아직 저장 전');assert.equal(t.document.querySelector('#field-amount').value,'91,000');assert.equal(t.document.querySelector('#field-note').value,'입력 중');
 t.click('[data-close=editor]');t.click('[data-entry-type=stocks]');assert.equal(t.document.querySelector('#field-name').value,'주식 계좌');assert.equal(t.state.writes,0);
});
test('failed or duplicate saves retain input and only a successful response appears in recent entries',async()=>{
 const t=await start();t.click('[data-entry-type=expense]');t.fill({name:'실패 보존',amount:'12,000'});t.state.fail=true;await t.submit();assert.equal(t.state.data.cashflow.length,0);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,0);assert.equal(t.document.querySelector('#field-name').value,'실패 보존');assert.match(t.document.querySelector('#form-error').textContent,/동시에/);assert.equal(t.document.querySelector('button[type=submit]').disabled,false);
 t.state.fail=false;let release;t.state.pause=new Promise(resolve=>release=resolve);const first=t.submit();await t.submit();assert.equal(t.state.writes,2);release();await first;assert.equal(t.state.data.cashflow.length,1);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,1);assert.equal(t.document.querySelector('#field-name').value,'');
});

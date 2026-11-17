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
async function start(data=domain.emptyPortfolio()){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',v);}});
 for(const dialog of document.querySelectorAll('dialog')){Object.defineProperty(dialog,'open',{configurable:true,get(){return this.hasAttribute('open');}});dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 class BrowserFormData{constructor(form){this.values=new Map([...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&!el.disabled).map(el=>[el.name,el.value]));}get(name){return this.values.get(name)??null;}}
 const state={data:domain.validatePortfolio(data),revision:1,writes:0,fail:false,pause:null};
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
 return {document,window,Event,context,state,click,change,fill,submit};
}
test('unified entry covers every financial kind and routes all eleven presets without writes or navigation',async()=>{
 const t=await start();assert.equal(t.document.querySelector('h1').textContent,'통합 입력·수정');assert.equal(t.document.querySelectorAll('[data-action=entry-start]').length,11);t.click('[data-mode=new]');
 assert.deepEqual([...new Set(navigation.entryPresets.map(p=>p.kind))].sort(),[...domain.KINDS].sort());
 for(const p of navigation.entryPresets){t.click(`[data-entry-type="${p.id}"]`);assert.equal(t.document.querySelector('#editor-title').textContent,p.label+' 등록');assert.equal(t.document.querySelector('#entry-type').value,p.id);for(const [key,value]of Object.entries(p.defaults))assert.equal(t.document.querySelector('#field-'+key).value,String(value));if(p.future)assert.ok(t.document.querySelector('#field-date').value>domain.todayKST());t.click('[data-close=editor]');}
 assert.equal(t.state.writes,0);assert.equal(t.context.location.hash,'#entry');
});
test('successive saves reset committed values, keep the entry page open and use the same financial records',async()=>{
 const t=await start();t.click('[data-mode=new]');t.click('[data-entry-type=deposits]');t.fill({name:'통합 입력 예금',balance:'1,234,567'});await t.submit();
 assert.equal(t.state.writes,1);assert.equal(t.state.data.deposits[0].balance,1234567);assert.ok(t.document.querySelector('#editor').open);assert.equal(t.document.querySelector('#field-name').value,'');assert.equal(t.document.querySelector('#field-balance').value,'0');assert.match(t.document.querySelector('.entry-save-message').textContent,/저장 완료/);
 t.change('entry-type','salary');t.fill({name:'회사 월급',amount:'3,000,000',date:domain.todayKST()});await t.submit();
 assert.equal(t.state.writes,2);assert.equal(t.state.data.cashflow.length,1);assert.equal(t.state.data.cashflow[0].type,'salary');assert.equal(t.state.data.cashflow[0].repeat,'monthly');assert.equal(t.state.data.deposits[0].balance,1234567);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,2);assert.equal(t.context.location.hash,'#entry');
 t.change('entry-type','cards');t.fill({name:'카드 A',amount:'250,000',dueDate:domain.todayKST()});t.change('entry-continue',false);await t.submit();assert.equal(t.document.querySelector('#editor').open,false);assert.equal(t.state.data.cards[0].amount,250000);
 t.document.getElementById('privacy-toggle').onclick();assert.ok([...t.document.querySelectorAll('.entry-recent-info b')].every(el=>el.textContent==='••••••'));
});
test('category switches and cancellation preserve unsaved drafts in memory without writing them',async()=>{
 const t=await start();t.click('[data-mode=new]');t.click('[data-entry-type=income]');t.fill({name:'아직 저장 전',amount:'91,000',note:'입력 중'});t.change('entry-type','stocks');t.fill({name:'주식 계좌',valuation:'400,000'});t.change('entry-type','income');
 assert.equal(t.document.querySelector('#field-name').value,'아직 저장 전');assert.equal(t.document.querySelector('#field-amount').value,'91,000');assert.equal(t.document.querySelector('#field-note').value,'입력 중');
 t.click('[data-close=editor]');t.click('[data-entry-type=stocks]');assert.equal(t.document.querySelector('#field-name').value,'주식 계좌');assert.equal(t.state.writes,0);
});
test('failed or duplicate saves retain input and only a successful response appears in recent entries',async()=>{
 const t=await start();t.click('[data-mode=new]');t.click('[data-entry-type=expense]');t.fill({name:'실패 보존',amount:'12,000'});t.state.fail=true;await t.submit();assert.equal(t.state.data.cashflow.length,0);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,0);assert.equal(t.document.querySelector('#field-name').value,'실패 보존');assert.match(t.document.querySelector('#form-error').textContent,/동시에/);assert.equal(t.document.querySelector('button[type=submit]').disabled,false);
 t.state.fail=false;let release;t.state.pause=new Promise(resolve=>release=resolve);const first=t.submit();await t.submit();assert.equal(t.state.writes,2);release();await first;assert.equal(t.state.data.cashflow.length,1);assert.equal(t.document.querySelectorAll('.entry-recent-row').length,1);assert.equal(t.document.querySelector('#field-name').value,'');
});
const field=(t,key,name,value)=>{const el=t.document.querySelector(`[data-entry-key="${key}"][data-entry-field="${name}"]`);assert.ok(el,`${key} ${name}`);if(el.tagName==='SELECT')for(const option of el.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));else el.value=String(value);el.dispatchEvent(new t.Event('input',{bubbles:true}));};
test('existing records across categories are edited together with one atomic write, preserving untouched records',async()=>{
 const t=await start(domain.samplePortfolio()),before=structuredClone(t.state.data),deposit=before.deposits[0],card=before.cards[0];
 assert.equal(t.document.querySelector('#entry-manager').hidden,false);
 field(t,'deposits:'+deposit.id,'balance','2,345,678');t.click('[data-entry-category=cards]');field(t,'cards:'+card.id,'amount','654,321');field(t,'cards:'+card.id,'paid','true');
 assert.equal(t.state.writes,0);assert.equal(t.state.data.deposits[0].balance,deposit.balance);assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/2건/);
 t.click('[data-mode=new]');t.click('[data-mode=manage]');t.click('[data-entry-category=deposits]');assert.equal(t.document.querySelector('[data-entry-field=balance]').value,'2,345,678');
 t.click('[data-entry-command=save]');await tick();await tick();assert.equal(t.state.writes,1);assert.equal(t.state.data.deposits[0].balance,2345678);assert.equal(t.state.data.cards[0].amount,654321);assert.equal(t.state.data.cards[0].paid,true);assert.deepEqual(t.state.data.loans,before.loans);assert.equal(t.document.querySelector('[data-entry-command=save]').disabled,true);
});
test('invalid bulk changes and failed writes retain every draft without partially saving other rows',async()=>{
 const t=await start(domain.samplePortfolio()),p=t.state.data,deposit=p.deposits[0],card=p.cards[0];
 field(t,'deposits:'+deposit.id,'balance','900');field(t,'cards:'+card.id,'amount','-7');t.click('[data-entry-command=save]');await tick();assert.equal(t.state.writes,0);assert.match(t.document.querySelector('[data-entry-error]').textContent,/카드|금액/);assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/2건/);
 field(t,'cards:'+card.id,'amount','700');t.state.fail=true;t.click('[data-entry-command=save]');await tick();assert.equal(t.state.writes,1);assert.equal(t.state.data.deposits[0].balance,deposit.balance);assert.equal(t.document.querySelector('[data-entry-field=balance]').value,'900');assert.match(t.document.querySelector('[data-entry-error]').textContent,/동시에/);
 t.state.fail=false;t.click('[data-entry-command=save]');await tick();await tick();assert.equal(t.state.data.deposits[0].balance,900);assert.equal(t.state.data.cards[0].amount,700);
});
test('detailed loan edits join the same pending change set and save derived repayments with other rows',async()=>{
 const p=domain.samplePortfolio(),loan=p.loans[0],deposit=p.deposits[0];const t=await start(p);
 field(t,'deposits:'+deposit.id,'balance','999,000');t.click(`[data-entry-detail="loans:${loan.id}"]`);t.fill({calculationMode:'term',balance:'1200000',rate:'12',method:'원금균등',remainingMonths:'12',graceMonths:'0',nextPaymentDate:domain.todayKST()});await t.submit();
 assert.equal(t.state.writes,0);assert.equal(t.document.querySelector('#editor').open,false);assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/2건/);
 t.click('[data-entry-command=save]');await tick();await tick();const saved=t.state.data.loans[0];assert.equal(t.state.writes,1);assert.equal(saved.balance,1200000);assert.equal(saved.principal,100000);assert.equal(saved.interest,12000);assert.equal(saved.calculationMode,'term');assert.equal(t.state.data.deposits[0].balance,999000);
});
test('privacy and row undo preserve drafts while removing editable amounts from the page',async()=>{
 const t=await start(domain.samplePortfolio()),row=t.state.data.deposits[0],key='deposits:'+row.id;field(t,key,'balance','123456789');t.document.getElementById('privacy-toggle').onclick();
 assert.equal(t.document.querySelector('[data-entry-field=balance]'),null);assert.doesNotMatch(t.document.querySelector('#entry-manager').innerHTML,/123456789/);assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/1건/);
 t.document.getElementById('privacy-toggle').onclick();assert.equal(t.document.querySelector(`[data-entry-key="${key}"][data-entry-field=balance]`).value,'123456789');t.click(`[data-entry-undo="${key}"]`);assert.equal(t.document.querySelector('[data-entry-command=save]').disabled,true);assert.equal(t.state.writes,0);
});
test('bulk draft changes survive searching, pagination and route changes; reverting to original clears dirty state',async()=>{
 const p=domain.samplePortfolio();p.deposits=Array.from({length:25},(_,i)=>({...p.deposits[0],id:'cash-'+i,name:'계좌 '+i,balance:100+i}));const t=await start(p);t.click('[data-entry-category=deposits]');field(t,'deposits:cash-0','balance','500');t.click('[data-entry-page="2"]');field(t,'deposits:cash-24','balance','800');
 const search=t.document.querySelector('[data-entry-query]');search.value='계좌 0';search.dispatchEvent(new t.Event('input',{bubbles:true}));assert.equal(t.document.querySelectorAll('[data-entry-row]').length,1);assert.equal(t.document.querySelector('[data-entry-field=balance]').value,'500');
 t.context.location.hash='#overview';t.window.dispatchEvent(new t.Event('hashchange'));t.context.location.hash='#entry';t.window.dispatchEvent(new t.Event('hashchange'));assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/2건/);
 field(t,'deposits:cash-0','balance','100');assert.match(t.document.querySelector('[data-entry-draft-count]').textContent,/1건/);t.click('[data-entry-command=discard]');assert.equal(t.document.querySelector('[data-entry-command=save]').disabled,true);assert.equal(t.state.writes,0);
});
const cardsRoute=t=>{t.context.location.hash='#cards';t.window.dispatchEvent(new t.Event('hashchange'));};
const billInput=(t,id,name,value)=>{const el=t.document.querySelector(`[data-card-account="${id}"][data-card-bill-field="${name}"]`);assert.ok(el);if(el.tagName==='SELECT')for(const option of el.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));else el.value=String(value);el.dispatchEvent(new t.Event('input',{bubbles:true}));};
const billMonth=(t,month)=>{const el=t.document.querySelector('[data-card-billing-month]');el.value=month;el.dispatchEvent(new t.Event('change',{bubbles:true}));};
test('a fixed card is registered once and monthly inputs save distinct bills without copying last month amounts',async()=>{
 const t=await start();cardsRoute(t);t.click('[data-action=card-account-add]');t.change('card-account-name','매월 쓰는 카드');t.change('card-account-day',31);await t.submit();assert.equal(t.state.data.cardAccounts.length,1);assert.equal(t.state.data.cards.length,0);const id=t.state.data.cardAccounts[0].id;
 billMonth(t,'2027-02');assert.equal(t.document.querySelector('[data-card-bill-field=dueDate]').value,'2027-02-28');billInput(t,id,'amount','123,400');assert.equal(t.state.data.cards.length,0);t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,1);assert.equal(t.state.data.cards[0].amount,123400);assert.equal(t.state.data.cards[0].cardAccountId,id);
 billMonth(t,'2027-03');assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'');billInput(t,id,'amount','567800');t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,2);assert.equal(t.state.data.cards[0].amount,123400);assert.equal(t.state.data.cards[1].dueDate,'2027-03-31');assert.equal(t.state.writes,3);
});
test('existing bills can be linked, edited through either form, and retained when a fixed card is archived or restored',async()=>{
 const t=await start(domain.samplePortfolio()),old=structuredClone(t.state.data.cards[0]);cardsRoute(t);t.click(`[data-action=card-account-from-bill][data-id="${old.id}"]`);assert.equal(t.document.getElementById('card-account-name').value,old.name);await t.submit();const id=t.state.data.cardAccounts[0].id;assert.deepEqual(t.state.data.cards[0],{...old,cardAccountId:id,billingMonth:old.dueDate.slice(0,7)});
 t.click(`[data-ledger-action=edit][data-id="cards:${old.id}"]`);t.fill({amount:'321000'});await t.submit();assert.equal(t.state.data.cards[0].cardAccountId,id);
 t.context.location.hash='#entry';t.window.dispatchEvent(new t.Event('hashchange'));field(t,'cards:'+old.id,'amount','654000');t.click('[data-entry-command=save]');await tick();await tick();assert.equal(t.state.data.cards[0].amount,654000);assert.equal(t.state.data.cards[0].cardAccountId,id);
 cardsRoute(t);const bills=structuredClone(t.state.data.cards);t.click('[data-action=card-accounts]');t.click(`[data-action=card-account-archive][data-id="${id}"]`);await tick();await tick();assert.equal(t.state.data.cardAccounts[0].archived,true);assert.deepEqual(t.state.data.cards,bills);t.click(`[data-action=card-account-archive][data-id="${id}"]`);await tick();await tick();assert.equal(t.state.data.cardAccounts[0].archived,false);assert.deepEqual(t.state.data.cards,bills);
});
test('failed monthly saves retain input and retry updates exactly one statement',async()=>{
 const p=domain.emptyPortfolio();p.cardAccounts=[{id:'fixed',name:'고정 카드',day:25,note:'',archived:false}];const t=await start(p);cardsRoute(t);billInput(t,'fixed','amount','456000');t.state.fail=true;t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,0);assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'456000');assert.match(t.document.querySelector('[data-card-bill-error]').textContent,/동시에/);
 t.state.fail=false;t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,1);assert.equal(t.state.data.cards[0].amount,456000);assert.equal(t.document.querySelector('[data-card-billing-save]').disabled,true);
});

test('monthly entry allows a later payment month and clears or deletes rows with undo and save',async()=>{
 const p=domain.emptyPortfolio();p.cardAccounts=[{id:'fixed',name:'삼성카드',day:13,note:'',archived:false}];const t=await start(p);cardsRoute(t);billMonth(t,'2026-11');billInput(t,'fixed','amount','39180');billInput(t,'fixed','dueDate','2026-12-13');t.click('[data-card-bill-delete=fixed]');assert.equal(t.state.writes,0);assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'');assert.ok(t.document.querySelector('[data-card-billing-save]').disabled);
 billInput(t,'fixed','amount','39180');billInput(t,'fixed','dueDate','2026-12-13');t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards[0].billingMonth,'2026-11');assert.equal(t.state.data.cards[0].dueDate,'2026-12-13');const id=t.state.data.cards[0].id;
 billMonth(t,'2026-12');billInput(t,'fixed','amount','50000');t.click('[data-card-billing-save]');await tick();await tick();billMonth(t,'2026-11');assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'39,180');t.click('[data-card-bill-delete=fixed]');assert.equal(t.document.querySelector('[data-card-bill-status]').textContent,'삭제 예정');assert.equal(t.state.data.cards.length,2);assert.equal(t.state.writes,2);t.click('[data-card-bill-undo]');assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'39,180');assert.ok(t.document.querySelector('[data-card-billing-save]').disabled);
 t.click('[data-card-bill-delete=fixed]');t.state.fail=true;t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,2);assert.equal(t.document.querySelector('[data-card-bill-status]').textContent,'삭제 예정');t.state.fail=false;t.click('[data-card-billing-save]');await tick();await tick();assert.equal(t.state.data.cards.length,1);assert.equal(t.state.data.cards[0].billingMonth,'2026-12');assert.equal(t.state.data.cardAccounts.length,1);assert.ok(!t.state.data.cards.some(row=>row.id===id));assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'');
});
test('editing a linked bill through the generic form or unified editor retains its billing month',async()=>{
 const p=domain.emptyPortfolio();p.cardAccounts=[{id:'fixed',name:'삼성카드',day:13,note:'',archived:false}];p.cards=[{id:'nov',cardAccountId:'fixed',billingMonth:'2026-11',name:'삼성카드',amount:39180,dueDate:'2026-12-13',paid:false,note:''}];const t=await start(p);cardsRoute(t);t.click('[data-ledger-action=edit][data-id="cards:nov"]');t.fill({dueDate:'2027-01-13',amount:'40000'});await t.submit();assert.equal(t.state.data.cards[0].billingMonth,'2026-11');assert.equal(t.state.data.cards[0].dueDate,'2027-01-13');
 t.context.location.hash='#entry';t.window.dispatchEvent(new t.Event('hashchange'));t.click('[data-entry-category=cards]');field(t,'cards:nov','amount','45000');t.click('[data-entry-command=save]');await tick();await tick();assert.equal(t.state.data.cards[0].billingMonth,'2026-11');cardsRoute(t);billMonth(t,'2026-11');assert.equal(t.document.querySelector('[data-card-bill-field=amount]').value,'45,000');assert.equal(t.document.querySelector('[data-card-bill-field=dueDate]').value,'2027-01-13');
});

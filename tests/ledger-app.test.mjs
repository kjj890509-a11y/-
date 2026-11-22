import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
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
import {handleApi} from '../server/api.mjs';
import {handlePreferences} from '../server/preferences.mjs';
const tick=()=>new Promise(setImmediate);
async function setup(){
 const db=new DatabaseSync(':memory:');for(const file of ['0000_assets.sql','0002_view_preferences.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 db.prepare('INSERT INTO portfolios (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('owner',JSON.stringify(domain.samplePortfolio()),domain.todayKST());
 const DB={prepare(sql){return{bind(...v){return{async first(){return db.prepare(sql).get(...v)||null;},async run(){return{meta:{changes:Number(db.prepare(sql).run(...v).changes)}};}};}};}};
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 const errors=[],downloads=[];
 const fetch=async(path,init={})=>{const request=new Request('https://moa.test'+path,{...init,headers:{...init.headers,Origin:'https://moa.test','oai-authenticated-user-id':'owner'}});return path==='/api/preferences'?handlePreferences(request,{DB}):handleApi(request,{DB});};
 const context=vm.createContext({...loansPage,...workspace,...navigation,...dashboard,...disclosure,...domain,...charts,...statsPage,...advisorPage,renderLoanForecastPanel,document,window,location:{hash:'#cards'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,Blob,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:download';},revokeObjectURL:()=>{}},setTimeout,clearTimeout,fetch});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();await tick();
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));};
 const change=(selector,value)=>{const el=document.querySelector(selector);assert.ok(el,selector);if(el.type==='checkbox')el.checked=value;else if(el.tagName==='SELECT'){for(const option of el.querySelectorAll('option'))option.removeAttribute('selected');el.querySelector(`option[value="${value}"]`).setAttribute('selected','');}else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
 return {db,document,window,Event,context,click,change,downloads};
}

test('direct amount editing saves only the active row and preserves drafts across desktop tables',async()=>{
 const {db,document,Event,context,window,click}=await setup();
 const visit=view=>{context.location.hash='#'+view;window.dispatchEvent(new Event('hashchange'));};
 const read=()=>db.prepare('SELECT data,revision FROM portfolios').get();
 const edit=(key,value)=>{
  const input=document.querySelector(`[data-record-amount-row="${key}"] [data-record-amount-field]`);
  assert.ok(input,key);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
 };
 visit('deposits');
 const keys=['deposits:demo-d1','deposits:demo-d2'];
 const original=read();
 edit(keys[0],'8,500,123');edit(keys[1],'40000123');
 assert.deepEqual(read(),original);
 const changedActions=document.querySelector(`[data-record-amount-row="${keys[0]}"] .ledger-actions`);
 assert.equal(changedActions.firstElementChild.dataset.ledgerAction,'edit');
 assert.equal(changedActions.querySelector('[data-record-amount-save]').hidden,false);
 click(`[data-record-amount-row="${keys[0]}"] [data-record-amount-save]`);await tick();await tick();
 const saved=read(),data=JSON.parse(saved.data);
 assert.equal(saved.revision,original.revision+1);
 assert.equal(data.deposits[0].balance,8500123);assert.equal(data.deposits[1].balance,40000000);
 visit('records');
 assert.equal(document.querySelector(`[data-record-amount-row="${keys[1]}"] [data-record-amount-field="balance"]`).value,'40000123');
 click(`[data-record-amount-row="${keys[1]}"] [data-record-amount-undo]`);
 assert.equal(document.querySelector(`[data-record-amount-row="${keys[1]}"] [data-record-amount-field]`).value,'40,000,000');
 assert.equal(document.querySelector('[data-ledger-action="edit"]').textContent,'상세 수정');
 assert.equal(document.querySelector('.ledger-actions .icon-button'),null);
 document.querySelector('#privacy-toggle').onclick();
 assert.equal(document.querySelector('[data-record-amount-field]'),null);
 assert.deepEqual(read(),saved);db.close();
});

test('live ledger saves and reloads account views, exports the whole filtered set, and updates selected cards only',async()=>{
 const t=await setup(),{db,document,Event,click,change,context,window}=t;
 const initial=db.prepare('SELECT data,revision FROM portfolios').get();
 change('[data-ledger-field="sort"]','amount:asc');
 const rows=[...document.querySelectorAll('.ledger-table tbody tr[data-entry-key]')];assert.ok(rows[0].textContent.includes('삼성카드'));
 click('[data-ledger-action="save-dialog"]');document.querySelector('[name="viewName"]').value='금액 낮은 카드';document.querySelector('[data-ledger-save-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(db.prepare('SELECT revision FROM view_preferences').get().revision,1);assert.deepEqual(db.prepare('SELECT data,revision FROM portfolios').get(),initial);
 change('[data-ledger-select="cards:demo-c2"]',true);click('[data-ledger-action="bulk-paid"]');await tick();await tick();
 const saved=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data);assert.equal(saved.cards.find(c=>c.id==='demo-c2').paid,true);assert.equal(saved.cards.find(c=>c.id==='demo-c1').paid,false);
 context.location.hash='#deposits';window.dispatchEvent(new Event('hashchange'));context.location.hash='#cards';window.dispatchEvent(new Event('hashchange'));
 assert.ok(document.querySelector('[data-ledger-action="load-view"]').textContent.includes('금액 낮은 카드'));
 click('[data-ledger-action="detail"]');assert.ok(document.querySelector('#record-detail').hasAttribute('open'));assert.match(document.querySelector('#record-detail').textContent,/카드사/);document.querySelector('#privacy-toggle').onclick();assert.equal(document.querySelector('#record-detail'),null);document.querySelector('#privacy-toggle').onclick();
 click('[data-ledger-action="export"]');assert.equal(t.downloads.length,1);const csv=await t.downloads[0].text();assert.match(csv,/삼성카드/);assert.match(csv,/결제 완료/);
 // Cancel a destructive selection action; no write occurs.
 change('[data-ledger-select-page]',true);const before=db.prepare('SELECT revision FROM portfolios').get().revision;click('[data-ledger-action="bulk-delete"]');await tick();click('#confirm-cancel');await tick();assert.equal(db.prepare('SELECT revision FROM portfolios').get().revision,before);
});
test('deleting a saved card view persists only preferences and leaves every financial row unchanged',async()=>{
 const t=await setup(),before=t.db.prepare('SELECT * FROM portfolios').get();t.click('[data-ledger-action="save-dialog"]');t.document.querySelector('[name=viewName]').value='지울 카드 보기';t.document.querySelector('[data-ledger-save-form]').dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(JSON.parse(t.db.prepare('SELECT data FROM view_preferences').get().data).tables.cards.savedViews.length,1);
 t.click('.ledger-view-delete');await tick();await tick();assert.equal(JSON.parse(t.db.prepare('SELECT data FROM view_preferences').get().data).tables.cards.savedViews.length,0);assert.deepEqual(t.db.prepare('SELECT * FROM portfolios').get(),before);t.db.close();
});
test('selected expense and fixed rows can exclude card bill duplicates and reverse the setting through the real API',async()=>{
 const t=await setup(),{db,document,Event,click,change,context,window}=t;const original=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data),month=domain.todayKST().slice(0,7),before=domain.monthlyFlow(original,month).expense;context.location.hash='#cashflow';window.dispatchEvent(new Event('hashchange'));change('[data-ledger-select="cashflow:demo-f3"]',true);assert.match(document.querySelector('[data-ledger-action=bulk-card-included]').textContent,/카드 청구액에 포함 · 중복 제외/);click('[data-ledger-action=bulk-card-included]');await tick();await tick();let saved=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data);assert.equal(saved.cashflow.find(row=>row.id==='demo-f3').paymentSource,'card');assert.equal(domain.monthlyFlow(saved,month).expense,before-600000);assert.deepEqual(saved.cards,original.cards);assert.equal(saved.cashflow.length,original.cashflow.length);assert.match(document.querySelector('.ledger-table').textContent,/중복 제외/);
 change('[data-ledger-select="cashflow:demo-f3"]',true);click('[data-ledger-action=bulk-account-paid]');await tick();await tick();saved=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data);assert.equal(domain.monthlyFlow(saved,month).expense,before);
 change('[data-ledger-select="cashflow:demo-f1"]',true);assert.equal(document.querySelector('[data-ledger-action=bulk-card-included]'),null);context.location.hash='#fixed';window.dispatchEvent(new Event('hashchange'));change('[data-ledger-select="fixed:demo-fixed1"]',true);click('[data-ledger-action=bulk-account-paid]');await tick();await tick();saved=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data);assert.equal(domain.monthlyFlow(saved,month).expense,before+65000);change('[data-ledger-select="fixed:demo-fixed1"]',true);click('[data-ledger-action=bulk-card-included]');await tick();await tick();saved=JSON.parse(db.prepare('SELECT data FROM portfolios').get().data);assert.equal(domain.monthlyFlow(saved,month).expense,before);assert.deepEqual(saved.cards,original.cards);db.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {samplePortfolio,validatePortfolio,emptyPortfolio} from '../public/domain.mjs';
import {defaultLedgerState,ledgerEntries,ledgerQuery,ledgerLayout,ledgerPage,validateLedgerPreferences} from '../public/ledger-model.mjs';
import {mountLedger,unmountLedger,ledgerPreference} from '../public/ledger.mjs';
import {handlePreferences} from '../server/preferences.mjs';
const today='2026-11-17',tick=()=>new Promise(setImmediate);
function data(){return validatePortfolio(samplePortfolio(today));}
function preference(){return {version:1,tables:{deposits:ledgerPreference(defaultLedgerState())}};}
function env(){const db=new DatabaseSync(':memory:');for(const file of ['0000_assets.sql','0002_view_preferences.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return {db,env:{DB:{prepare(sql){return {bind(...v){return {async first(){return db.prepare(sql).get(...v)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...v).changes)}};}};}};}}}};}
const request=(method='GET',body,user='owner',origin='https://moa.test')=>new Request('https://moa.test/api/preferences',{method,headers:{'Content-Type':'application/json',Origin:origin,...(user?{'oai-authenticated-user-id':user}:{})},body:body?JSON.stringify(body):undefined});

test('compound category, status, institution, date and amount filters keep totals and source rows intact',()=>{
 const portfolio=data(),before=structuredClone(portfolio),entries=ledgerEntries(portfolio,'all','2026-11'),state={...defaultLedgerState(),category:'cards',status:'unpaid',start:'2026-11-20',min:'300000',max:'400000',sort:'date:desc'};
 const rows=ledgerQuery(entries,state,today);assert.equal(rows.length,1);assert.equal(rows[0].row.name,'삼성카드');
 state.max='';state.category='deposits';state.status='all';state.start='';state.institution='토스뱅크';assert.equal(ledgerQuery(entries,state,today)[0].row.name,'생활비 통장');
 assert.deepEqual(portfolio,before);
});

test('registration order, financial amount order and real dates sort independently with undated records last',()=>{
 const entries=ledgerEntries(data(),'deposits'),state=defaultLedgerState();
 assert.deepEqual(ledgerQuery(entries,state).map(e=>e.row.name),['정기예금','생활비 통장']);
 state.sort='oldest';assert.equal(ledgerQuery(entries,state)[0].row.name,'생활비 통장');
 state.sort='amount:desc';assert.equal(ledgerQuery(entries,state)[0].row.balance,40000000);
 for(const sort of ['date:desc','date:asc']){state.sort=sort;assert.equal(ledgerQuery(entries,state)[0].row.name,'정기예금');}
 state.pageSize=20;state.page=9;assert.equal(ledgerPage(entries,state).page,1);
 const many=Array.from({length:45},(_,i)=>({...entries[0],key:'deposits:'+i}));state.page=2;assert.equal(ledgerPage(many,state).rows.length,20);state.page=3;assert.equal(ledgerPage(many,state).rows.length,5);
});

test('view validation rejects malformed layouts and preserves filters with a separate layout per saved view',()=>{
 const state=defaultLedgerState();state.columns=['balance','name'];state.hidden=['rate'];state.widths={balance:240};state.savedViews=[{id:'one',name:'예금 보기',filters:Object.fromEntries(['query','category','status','institution','type','repeat','start','end','min','max','sort'].map(key=>[key,state[key]])),layout:{columns:['name','balance'],hidden:['institution'],widths:{name:300},pageSize:50,density:'compact'}}];
 const clean=validateLedgerPreferences({version:1,tables:{deposits:ledgerPreference(state)}});assert.equal(clean.tables.deposits.savedViews[0].layout.widths.name,300);
 assert.deepEqual(ledgerLayout('deposits',state),['balance','name','institution','date']);
 for(const patch of [{hidden:['name','institution','balance','rate','date']},{widths:{name:2000}},{columns:['name','name']},{pageSize:100000}])assert.throws(()=>validateLedgerPreferences({version:1,tables:{deposits:{...ledgerPreference(state),...patch}}}));
});

test('view API isolates accounts and revisions without altering financial data or snapshots',async()=>{
 const {env:bindings,db}=env();db.prepare('INSERT INTO portfolios (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('owner',JSON.stringify(data()),today);
 const before=db.prepare('SELECT * FROM portfolios').get();
 assert.equal((await handlePreferences(request('GET',undefined,''),bindings)).status,401);
 assert.equal((await handlePreferences(request('PUT',{data:preference(),revision:0},'owner','https://evil.test'),bindings)).status,403);
 const saved=await handlePreferences(request('PUT',{data:preference(),revision:0}),bindings);assert.equal(saved.status,200);assert.equal((await saved.json()).revision,1);
 assert.deepEqual((await(await handlePreferences(request('GET',undefined,'second'),bindings)).json()).data.tables,{});
 assert.equal((await handlePreferences(request('PUT',{data:preference(),revision:0}),bindings)).status,409);
 assert.deepEqual(db.prepare('SELECT * FROM portfolios').get(),before);
});

async function ui(scope='cards',portfolio=data()){
 const {document,Event}=parseHTML('<main><div id="ledger"></div></main>'),root=document.querySelector('#ledger'),state=defaultLedgerState(),entries=ledgerEntries(portfolio,scope,'2026-11');let sortable,saveError=false;
 const exported=[],edited=[],details=[],bulk=[],saved=[],feedback=[];
 const options={scope,today,money:String,cell:(entry,key)=>String(key==='name'?entry.row.name:key==='amount'?entry.amount:entry.row[key]||''),onEdit:e=>edited.push(e.key),onDetail:e=>details.push(e.key),onBulk:async(action,rows)=>bulk.push({action,keys:rows.map(e=>e.key)}),onExport:(rows,keys)=>exported.push({rows,keys}),onSave:async pref=>{if(saveError)throw new Error('충돌');saved.push(pref);},onFeedback:m=>feedback.push(m),loadSortable:async()=>({default:{create:(node,config)=>{sortable={node,config};return {destroy(){}};}}})};
 mountLedger(root,entries,state,options);
 const click=selector=>{const el=root.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));};
 const change=(selector,value)=>{const el=root.querySelector(selector);assert.ok(el,selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
 return {root,document,Event,state,entries,click,change,exported,edited,details,bulk,saved,feedback,sortable:()=>sortable,failSave:()=>{saveError=true;}};
}

test('row selection, status filters, bulk actions, detail and export operate on the intended records',async()=>{
 const t=await ui();t.change('[data-ledger-select-page]',true);assert.equal(t.state.selected.length,2);
 t.click('[data-ledger-action="bulk-paid"]');await tick();assert.equal(t.bulk[0].action,'paid');assert.equal(t.bulk[0].keys.length,2);
 t.click('[data-ledger-action="detail"]');assert.equal(t.details.length,1);
 t.click('[data-ledger-action="edit"]');assert.equal(t.edited.length,1);
 t.click('[data-ledger-action="bulk-export"]');assert.equal(t.exported[0].rows.length,2);
 t.click('[data-ledger-action="status"][data-value="unpaid"]');assert.equal(t.state.selected.length,0);
 unmountLedger(t.root);
});

test('filter modal rejects inverted ranges, applies combined conditions, and reset restores results',async()=>{
 const t=await ui();t.click('[data-ledger-action="filters"]');
 const form=t.root.querySelector('[data-ledger-filter-form]');form.querySelector('[name="min"]').value='900000';form.querySelector('[name="max"]').value='100';
 form.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));assert.match(form.querySelector('[data-filter-error]').textContent,/범囲|범위/);
 form.querySelector('[name="min"]').value='300000';form.querySelector('[name="max"]').value='400000';form.dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(t.root.querySelectorAll('tr[data-entry-key]').length,1);t.click('[data-ledger-action="export"]');assert.equal(t.exported[0].rows[0].row.name,'삼성카드');
 t.click('[data-ledger-action="reset"]');assert.equal(t.root.querySelectorAll('tr[data-entry-key]').length,2);
 unmountLedger(t.root);
});

test('column drag, visibility, saved layouts and failure reporting are real state transitions',async()=>{
 const t=await ui('deposits');t.click('[data-ledger-action="columns"]');await tick();
 const drag=t.sortable(),children=[...drag.node.children];drag.node.prepend(children.at(-1));drag.config.onEnd();await tick();
 assert.equal(t.state.columns[0],'date');
 t.change('[data-ledger-column="rate"]',false);assert.ok(!t.root.querySelector('th[data-column="rate"]'));
 t.click('[data-ledger-action="persist"]');await tick();assert.equal(t.saved.length,1);assert.deepEqual(t.saved[0].hidden,['rate']);
 t.click('[data-ledger-action="save-dialog"]');t.root.querySelector('[name="viewName"]').value='<img onerror=bad>';t.root.querySelector('[data-ledger-save-form]').dispatchEvent(new t.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert.equal(t.saved[1].savedViews[0].name,'<img onerror=bad>');assert.equal(t.root.querySelector('img'),null);
 t.state.hidden=[];t.click('[data-ledger-action="load-view"]');assert.deepEqual(t.state.hidden,['rate']);
 t.failSave();t.click('[data-ledger-action="columns"]');t.click('[data-ledger-action="persist"]');await tick();assert.match(t.root.querySelector('[role="alert"]').textContent,/충돌/);
 unmountLedger(t.root);
});

test('table headers can be dragged directly and keyboard resize keeps width within the allowed range',async()=>{
 const t=await ui();await tick();const drag=t.sortable();assert.equal(drag.config.handle,'.ledger-header-handle');
 const name=drag.node.querySelector('[data-column="name"]');drag.node.append(name);drag.config.onEnd();await tick();assert.deepEqual(t.state.columns,['amount','date','status','name']);
 const handle=t.root.querySelector('[data-resize="amount"]'),event=new t.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(event,'key',{value:'ArrowRight'});handle.dispatchEvent(event);
 assert.equal(t.state.widths.amount,170);assert.equal(t.root.querySelector('[data-resize="amount"]').getAttribute('aria-valuenow'),'170');
 t.state.widths.amount=600;const next=new t.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(next,'key',{value:'ArrowRight'});t.root.querySelector('[data-resize="amount"]').dispatchEvent(next);assert.equal(t.state.widths.amount,600);unmountLedger(t.root);
});

import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as workspace from '../public/workspace.mjs';
import * as charts from '../public/chart.mjs';
import * as disclosure from '../public/disclosure.mjs';
import * as statsPage from '../public/statistics-page.mjs';
import * as loansPage from '../public/loans-page.mjs';
import * as advisorPage from '../public/advisor-page.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
import {buildStatistics,statisticsSeries} from '../public/statistics.mjs';
import {handleApi} from '../server/api.mjs';

const today='2026-11-16';
const money=value=>value.toLocaleString('ko-KR')+'원';
const tick=()=>new Promise(setImmediate);
function dataFixture(){
 const data=domain.samplePortfolio(today);
 data.retirement[0].monthlyContribution=250000;data.retirement[0].contributionDate='2026-01-31';
 data.loanPayments=[{id:'paid-1',loanId:data.loans[0].id,name:data.loans[0].name,institution:data.loans[0].institution,principal:100000,interest:3000,date:'2026-10-25',note:''}];
 return domain.validatePortfolio(data);
}
function database(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_assets.sql',import.meta.url),'utf8'));
 return {prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}};
}
function request(user,body,origin='https://moa.test'){
 const headers={'Content-Type':'application/json',Origin:origin};if(user)headers['oai-authenticated-user-id']=user;
 return new Request('https://moa.test/api/portfolio',{method:body?'PUT':'GET',headers,body:body?JSON.stringify(body):undefined});
}
function select(element,value){for(const option of element.querySelectorAll('option'))option.removeAttribute('selected');const chosen=[...element.querySelectorAll('option')].find(option=>option.value===value);assert.ok(chosen,'select option '+value);chosen.selected=true;}

test('saved dashboard layouts validate bounded identifiers, types and periods and migrate older backups',()=>{
 const data=dataFixture(),config=workspace.defaultDashboard(today);data.dashboard=config;
 assert.deepEqual(domain.validatePortfolio(data).dashboard,config);
 const legacy=structuredClone(data);delete legacy.dashboard;assert.equal(domain.validatePortfolio(legacy).dashboard,null);
 for(const change of [w=>w.widgets.push(w.widgets[0]),w=>w.widgets[0].title='',w=>w.widgets[0].type='script',w=>w.widgets[0].metric='balance',w=>w.period.end='2026-02-30',w=>w.period.start='1900-01-01',w=>w.widgets=Array.from({length:17},(_,i)=>({...w.widgets[0],id:'x'+i}))]){
  const invalid=structuredClone(config);change(invalid);assert.throws(()=>domain.validateDashboard(invalid));
 }
 assert.deepEqual(workspace.dashboardPeriod({...config.period,preset:'year'},'2027-01-03'),{preset:'year',start:'2027-01-01',end:'2027-12-31'});
 assert.deepEqual(workspace.dashboardPeriod({...config.period,preset:'custom'},'2027-01-03'),{...config.period,preset:'custom'});
});

test('dashboard-only saves are account scoped, revision checked, and cannot alter balances or create a snapshot',async()=>{
 const env={DB:database()},data=dataFixture();
 let response=await handleApi(request('owner',{data,revision:0}),env);assert.equal(response.status,200);
 const before=(await response.json()).data,config=workspace.defaultDashboard(today);config.widgets.reverse();
 response=await handleApi(request('owner',{dashboard:config,data:domain.emptyPortfolio(),revision:1}),env);
 assert.equal(response.status,200);const after=(await response.json()).data;
 assert.deepEqual(after,{...before,dashboard:config});
 assert.equal((await handleApi(request('owner',{dashboard:null,revision:1}),env)).status,409);
 assert.equal((await handleApi(request(null,{dashboard:config,revision:0}),env)).status,401);
 assert.equal((await handleApi(request('owner',{dashboard:config,revision:2},'https://other.test'),env)).status,403);
 assert.equal((await(await handleApi(request('other'),env)).json()).data.dashboard,null);
 const oldClient=structuredClone(after);delete oldClient.dashboard;
 assert.equal((await handleApi(request('owner',{data:oldClient,revision:2}),env)).status,200);
 assert.deepEqual((await(await handleApi(request('owner'),env)).json()).data.dashboard,config);
 assert.equal((await handleApi(request('owner',{dashboard:null,revision:3}),env)).status,200);
 assert.equal((await(await handleApi(request('owner'),env)).json()).data.dashboard,null);
 const fresh=await(await handleApi(request('new',{dashboard:config,revision:0}),env)).json();
 assert.deepEqual(fresh.data.snapshots,[]);assert.equal(domain.totals(fresh.data).gross,0);
});

test('statistics separate completed records, schedules and projections, and never count pension as cash',()=>{
 const data=dataFixture(),before=structuredClone(data),range={start:'2026-01-01',end:'2026-12-31'};
 const all=buildStatistics(data,range,today);
 const recorded=buildStatistics(data,{...range,basis:'recorded'},today);
 const scheduled=buildStatistics(data,{...range,basis:'scheduled'},today);
 const projected=buildStatistics(data,{...range,basis:'projected'},today);
 assert.equal(recorded.totals.loanPayment,103000);
 assert.equal(recorded.totals.retirementContribution,0);
 assert.equal(scheduled.totals.retirementContribution,3000000);
 assert.equal(projected.totals.retirementContribution,0);
 assert.ok(projected.rows.every(row=>row.source==='loans'&&row.date>today));
 for(const key of ['income','expense','loanPayment','retirementContribution'])assert.equal(all.totals[key],recorded.totals[key]+scheduled.totals[key]+projected.totals[key]);
 const without=structuredClone(data);without.retirement=[];
 const cash=buildStatistics(without,range,today);
 assert.equal(all.totals.income,cash.totals.income);assert.equal(all.totals.expense,cash.totals.expense);
 const pension=buildStatistics(data,{...range,kind:'retirement'},today);
 assert.equal(pension.rows.length,12);assert.equal(pension.totals.income,0);assert.equal(pension.totals.expense,0);
 assert.deepEqual(data,before);
});

test('short date ranges use inclusive daily values while long ranges retain monthly sums',()=>{
 const data=domain.emptyPortfolio();
 data.fixed=[{id:'dog',name:'도치',amount:400,day:31,startMonth:'2026-01',endMonth:'',paymentSource:'account'}];
 data.retirement=[{id:'r',name:'연금',amount:1000,monthlyContribution:200,contributionDate:'2026-01-31'}];
 let result=buildStatistics(data,{start:'2026-02-27',end:'2026-03-01'},today);
 assert.deepEqual(statisticsSeries(result,'expense').map(row=>row.value),[0,400,0]);
 assert.deepEqual(statisticsSeries(result,'retirementContribution').map(row=>row.value),[0,200,0]);
 assert.equal(statisticsSeries(result,'expense')[1].detailLabel,'2026.02.28');
 result=buildStatistics(data,{start:'2026-01-01',end:'2026-12-31'},today);
 assert.equal(statisticsSeries(result,'expense').length,12);
 assert.equal(statisticsSeries(result,'expense').reduce((sum,row)=>sum+row.value,0),4800);
});

function harness(initial=dataFixture(),saveError=false){
 const {document,window,Event}=parseHTML('<html><body><main id="main"></main></body></html>');
 const root=document.querySelector('main'),state=workspace.createWorkspaceState();
 let data=initial,sortOptions,sortCreates=0,destroyed=0,saves=0,feedback='';
 const loadSortable=async()=>({default:{create(element,options){sortOptions=options;sortCreates++;return {destroy(){destroyed++;}};}}});
 const render=()=>{workspace.unmountWorkspace(root);root.innerHTML=workspace.renderWorkspace(data,state,{formatMoney:money,formatCompact:String,today});disclosure.enhanceDisclosure(root,{view:'overview'});charts.mountTrendCharts(root);workspace.mountWorkspace(root,data,state,{onRender:render,loadSortable,today,onFeedback:message=>feedback=message,onSave:async config=>{saves++;if(saveError)throw new Error('저장 실패');data={...data,dashboard:config};}});};
 const click=selector=>{const element=root.querySelector(selector);assert.ok(element,selector);element.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));};
 const change=(name,value,form='#workspace-card-form')=>{const element=root.querySelector(`${form} [name=${name}]`);if(element.tagName==='SELECT')select(element,value);else element.value=value;element.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));};
 const submit=selector=>root.querySelector(selector).dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 const ids=()=>[...root.querySelectorAll('[data-widget-id]')].map(row=>row.dataset.widgetId);
 render();return {root,state,document,window,Event,click,change,submit,ids,render,get data(){return data;},get feedback(){return feedback;},get sortOptions(){return sortOptions;},get saves(){return saves;},get sortCreates(){return sortCreates;},get destroyed(){return destroyed;}};
}

test('drag completion and keyboard controls reorder the same saved cards, with cancel and reload support',async()=>{
 const h=harness();const original=h.ids();
 h.click('[data-board-action=edit]');await tick();
 assert.equal(h.sortOptions.handle,'.widget-handle');
 let transferred;h.sortOptions.setData({setData(type,value){transferred=value;}});assert.equal(transferred,'');
 const grid=h.root.querySelector('[data-workspace-grid]');grid.append(grid.firstElementChild);h.sortOptions.onEnd();await tick();
 assert.deepEqual(h.ids(),[...original.slice(1),original[0]]);
 const handle=h.root.querySelector('.widget-handle'),key=new h.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(key,'key',{value:'ArrowDown'});handle.dispatchEvent(key);await tick();
 assert.equal(h.ids()[1],original[1]);
 assert.equal(h.saves,0);h.click('[data-board-action=cancel]');assert.deepEqual(h.ids(),original);
 h.click('[data-board-action=edit]');await tick();h.click('[data-board-action=move-down]');const expected=h.ids();
 h.click('[data-board-action=save]');await tick();assert.equal(h.saves,1);assert.equal(h.state.editing,false);
 assert.deepEqual(h.data.dashboard.widgets.map(row=>row.id),expected);
 assert.deepEqual(harness(h.data).ids(),expected);assert.ok(h.destroyed>0);
});

test('custom cards keep bank and item filters, allow multiple comparisons and save the selected date range',async()=>{
 const h=harness();h.click('[data-board-action=edit]');await tick();h.click('[data-board-action=add]');h.click('[data-template=custom]');
 assert.ok(h.root.querySelector('#workspace-card').hasAttribute('open'));
 h.change('title','신한은행 비교');h.change('kind','loans');h.change('bank','신한은행');
 h.change('metric','interest');h.submit('#workspace-card-form');
 const widget=h.state.draft.widgets.at(-1);assert.equal(widget.bank,'신한은행');assert.equal(widget.metric,'interest');assert.equal(widget.title,'신한은행 비교');
 h.click('[data-board-action=add]');h.click('[data-template=custom]');h.change('item','cashflow:demo-f3');
 assert.equal(h.state.editor.kind,'expense');assert.equal(h.state.editor.metric,'expense');
 h.submit('#workspace-card-form');assert.equal(h.state.draft.widgets.length,6);
 h.click('[data-board-action=period]');h.change('preset','custom','#workspace-period-form');
 h.change('start','2026-12-31','#workspace-period-form');h.change('end','2026-01-01','#workspace-period-form');h.submit('#workspace-period-form');
 assert.match(h.root.querySelector('[data-workspace-error]').textContent,/기간/);
 h.change('start','2026-01-01','#workspace-period-form');h.change('end','2026-12-31','#workspace-period-form');h.submit('#workspace-period-form');
 h.click('[data-board-action=save]');await tick();assert.equal(h.data.dashboard.period.preset,'custom');assert.equal(h.data.dashboard.period.end,'2026-12-31');
 assert.equal(h.data.dashboard.widgets.at(-2).bank,'신한은행');
});

test('all card types render with masking, escaped labels, independent dates and helpful empty states',()=>{
 const data=dataFixture(),state=workspace.createWorkspaceState();data.dashboard=workspace.defaultDashboard(today);
 data.dashboard.widgets=workspace.widgetTemplates.map(template=>({...template.config,id:template.key,title:'<img src=x onerror=alert(1)>'}));
 const html=workspace.renderWorkspace(data,state,{formatMoney:()=> '••••••',formatCompact:()=> '••••',today});const {document}=parseHTML(html);
 assert.equal(document.querySelectorAll('img').length,0);assert.equal(document.querySelectorAll('[data-widget-id]').length,workspace.widgetTemplates.length);
 assert.doesNotMatch(html,/250,000원|131,050,000원|59,870,000원/);
 assert.match(document.querySelector('[data-widget-id=composition] .widget-period').textContent,/등록 잔액/);
 assert.match(document.querySelector('[data-widget-id=forecast] .widget-period').textContent,/향후 12개월/);
 const empty=domain.emptyPortfolio();empty.dashboard={...workspace.defaultDashboard(today),widgets:[]};
 assert.match(workspace.renderWorkspace(empty,state,{formatMoney:money,formatCompact:String,today}),/원하는 통계로 채워보세요/);
});

test('failed saves retain edits and report failure without changing stored preferences',async()=>{
 const h=harness(dataFixture(),true);h.click('[data-board-action=edit]');h.click('[data-board-action=remove]');
 h.click('[data-board-action=save]');await tick();assert.equal(h.state.editing,true);assert.equal(h.state.saving,false);
 assert.equal(h.state.draft.widgets.length,3);assert.equal(h.data.dashboard,null);assert.match(h.root.textContent,/저장 실패/);
});

test('the live app saves the dashboard envelope and restores it without writing any financial records',async()=>{
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 window.scrollTo=()=>{};let stored=dataFixture(),revision=1,body;
 const emptyLoader=async()=>({default:{create(){return {destroy(){}};}}});
 const context=vm.createContext({...navigation,...dashboard,...domain,...workspace,...charts,...disclosure,...statsPage,...loansPage,...advisorPage,renderLoanForecastPanel,mountWorkspace:(root,data,state,options)=>workspace.mountWorkspace(root,data,state,{...options,loadSortable:emptyLoader}),document,window,location:{hash:'#workspace'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,setTimeout,clearTimeout,fetch:async(path,init)=>{
  if(init?.method==='PUT'){body=JSON.parse(init.body);stored={...stored,dashboard:body.dashboard};revision++;}
  return {ok:true,json:async()=>({data:stored,revision})};
 }});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();
 const before=structuredClone(stored);
 document.querySelector('[data-board-action=edit]').dispatchEvent(new Event('click',{bubbles:true}));
 document.querySelector('[data-board-action=move-down]').dispatchEvent(new Event('click',{bubbles:true}));
 document.querySelector('[data-board-action=save]').dispatchEvent(new Event('click',{bubbles:true}));await tick();
 assert.deepEqual(Object.keys(body).sort(),['dashboard','revision']);assert.deepEqual(stored,{...before,dashboard:body.dashboard});
 assert.equal(document.querySelector('.workspace-editbar'),null);
 assert.deepEqual([...document.querySelectorAll('#main-nav .nav-link')].map(link=>link.getAttribute('href')),navigation.navigationGroups.map(group=>'#'+group.defaultView));
 assert.doesNotMatch(document.querySelector('#main-nav').textContent,/월별 예산|월말 예상|월급날 예상/);
 document.getElementById('privacy-toggle').onclick();assert.equal(document.querySelector('.workspace-current-stat strong').textContent,'••••••');
 context.location.hash='#statistics';window.dispatchEvent(new Event('hashchange'));
 const bank=document.getElementById('stats-bank');select(bank,'신한은행');bank.dispatchEvent(new Event('change',{bubbles:true}));
 const metric=document.getElementById('stats-metric');select(metric,'interest');metric.dispatchEvent(new Event('change',{bubbles:true}));
 document.querySelector('[data-action=pin-statistics]').dispatchEvent(new Event('click',{bubbles:true}));
 assert.equal(context.location.hash,'#workspace');window.dispatchEvent(new Event('hashchange'));
 const pinned=document.querySelector('[data-workspace-grid]').lastElementChild;
 assert.match(pinned.querySelector('.widget-filter-label').textContent,/신한은행/);
 assert.match(pinned.querySelector('.widget-total span').textContent,/이자/);
 document.querySelector('[data-board-action=save]').dispatchEvent(new Event('click',{bubbles:true}));await tick();
 assert.equal(stored.dashboard.widgets.at(-1).metric,'interest');assert.equal(stored.dashboard.widgets.at(-1).bank,'신한은행');
 assert.equal(stored.dashboard.period.preset,'custom');assert.deepEqual(stored.snapshots,before.snapshots);
});

test('dashboard can be dragged directly, resized and duplicated without entering edit mode first',async()=>{
 const h=harness(),original=h.ids();await tick();assert.equal(h.state.editing,false);assert.ok(h.root.querySelector('.widget-handle'));
 const grid=h.root.querySelector('[data-workspace-grid]');grid.append(grid.firstElementChild);h.sortOptions.onEnd();await tick();
 assert.equal(h.state.editing,true);assert.deepEqual(h.ids(),[...original.slice(1),original[0]]);assert.equal(h.saves,0);
 h.click('[data-board-action=width]');assert.equal(h.state.draft.widgets[0].width,'wide');
 h.click('[data-board-action=duplicate]');assert.equal(h.ids().length,original.length+1);assert.equal(new Set(h.ids()).size,h.ids().length);
 h.click('[data-board-action=cancel]');assert.deepEqual(h.ids(),original);assert.equal(h.data.dashboard,null);
 h.click('[data-board-action=width]');assert.equal(h.state.editing,true);h.click('[data-board-action=save]');await tick();assert.equal(h.saves,1);assert.equal(h.data.dashboard.widgets[0].width,'wide');
});

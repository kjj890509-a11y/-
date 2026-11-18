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
async function app(data){
 const {document,window,Event}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));window.scrollTo=()=>{};
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 const loadSortable=async()=>({default:{create(){return{destroy(){},option(){}};}}});let writes=0;
 const context=vm.createContext({...domain,...workspace,...navigation,...dashboard,...disclosure,...charts,...loans,...statistics,...advisor,renderLoanForecastPanel,
  mountWorkspace:(root,data,state,options)=>workspace.mountWorkspace(root,data,state,{...options,loadSortable}),mountLedger:(root,rows,state,options)=>navigation.mountLedger(root,rows,state,{...options,loadSortable}),mountRecordLayout:(root,state,options)=>navigation.mountRecordLayout(root,state,{...options,loadSortable}),mountEntryManager:(root,getData,state,options)=>navigation.mountEntryManager(root,getData,state,{...options,loadSortable}),mountCardBilling:(root,getData,state,options)=>navigation.mountCardBilling(root,getData,state,{...options,loadSortable}),
  document,window,location:{hash:'#overview'},localStorage:{getItem:()=>null,setItem:()=>{}},Intl,structuredClone,crypto,setTimeout,clearTimeout,fetch:async(path,init)=>{if(init?.method&&init.method!=='GET'){writes++;throw new Error('Page review must not write data');}if(path==='/api/portfolio')return{ok:true,json:async()=>({data,revision:1})};if(path==='/api/preferences')return{ok:true,json:async()=>({data:{version:1,tables:{}},revision:0})};if(path==='/api/advisor')return{ok:true,json:async()=>({configured:false})};throw new Error(path);}});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);await tick();await tick();
 const visit=async view=>{context.location.hash='#'+view;window.dispatchEvent(new Event('hashchange'));await tick();await tick();};
 return{document,window,Event,context,visit,writes:()=>writes};
}
const titleText=heading=>[...heading.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim();
function check(t,view,label){
 const root=t.document.querySelector('#main'),shell=root.querySelector(':scope > [data-page-shell]');assert.ok(shell,view);assert.equal(root.querySelectorAll('[data-page-shell]').length,1,view);const children=[...shell.children];assert.ok(children[0].matches('.page-header'),view);assert.ok(children[1].matches('.section-tabs'),view);assert.ok(children[2].matches('[data-page-content]'),view);assert.equal(children.length,3,view);assert.equal(root.querySelectorAll('h1').length,1,view);assert.equal(titleText(root.querySelector('h1')),label,view);assert.equal(t.document.title,label+' · 모아',view);assert.equal(root.querySelector('.page-header .date-chip,.page-header .eyebrow'),null,view);assert.equal(root.querySelector('.page-header>button,.page-header>a'),null,view);
 for(const grid of root.querySelectorAll('.home-stats,.planning-metrics,.metric-strip,.workspace-current-grid,.cf-month-summary,.loan-overview')){assert.ok(grid.classList.contains('page-metrics'),view);assert.equal(grid.dataset.pageMetricCount,String(grid.children.length),view);for(const child of grid.children)assert.ok(child.classList.contains('page-metric-card'),view);}
 assert.doesNotMatch(root.textContent,/등록순은 저장된 내역의 추가 순서|점 9개로 행·열을 이동할 수 있습니다|보기 삭제는 청구 내역을 지우지 않습니다|각 카드의 ‘집계 기준·금액 확인’에서 구분할 수 있어요/,view);
}
test('all desktop routes share the page frame and summary hierarchy with populated, empty and masked data',async()=>{
 for(const data of [domain.samplePortfolio(),domain.emptyPortfolio()]){
  const before=structuredClone(data),t=await app(data);for(const [view,label]of Object.entries(navigation.viewLabels)){await t.visit(view);check(t,view,label);}assert.equal(t.writes(),0);assert.deepEqual(data,before);
 }
 const t=await app(domain.samplePortfolio());t.document.querySelector('#privacy-toggle').onclick();for(const [view,label]of Object.entries(navigation.viewLabels)){await t.visit(view);check(t,view,label);}assert.equal(t.writes(),0);
});
test('page normalization keeps header actions, calculation help and partial home interactions intact',async()=>{
 const t=await app(domain.samplePortfolio());await t.visit('forecast');const root=t.document.querySelector('#main'),content=root.querySelector('[data-page-content]');assert.ok(content.querySelector(':scope > .planning-metrics'));assert.ok([...content.children].indexOf(content.querySelector('.planning-metrics'))<[...content.children].indexOf(content.querySelector('.forecast-banner')));assert.ok(root.querySelector('.forecast-banner p').hidden);assert.match(root.textContent,/주식 평가액·연 이율은 유지/);assert.ok(root.querySelector('h1 [data-info-sources]'));
 await t.visit('statistics');assert.match(root.textContent,/실제 입출금 완료를 뜻하지 않습니다/);await t.visit('assets');assert.ok(root.querySelector('.page-header .heading-actions [data-action=add]'));await t.visit('advisor');assert.ok(root.querySelector('[data-ui-stage="3"]'));assert.equal(root.querySelector('[data-ui-stage-panel="3"]').hidden,false);assert.match(root.textContent,/연결이 설정되지 않았습니다/);
 await t.visit('overview');const heading=root.querySelector('.page-header'),tabs=root.querySelector('.section-tabs');root.querySelector('[data-home-detail][data-detail=debt]')?.click?.();const target=root.querySelector('[data-action=home-detail][data-detail=debt]');assert.ok(target);target.dispatchEvent(new t.Event('click',{bubbles:true}));assert.strictEqual(root.querySelector('.page-header'),heading);assert.strictEqual(root.querySelector('.section-tabs'),tabs);check(t,'overview',navigation.viewLabels.overview);assert.equal(t.writes(),0);
});
test('desktop coaching opens the selected actual record and preserves entry batch-edit staging',async()=>{
 const data=domain.samplePortfolio(),t=await app(data),click=selector=>{const el=t.document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new t.Event('click',{bubbles:true}));};
 await t.visit('entry');click('[data-coach="next"]');click('[data-coach="act"]');
 const search=t.document.querySelector('[data-coach-search]');search.value=data.deposits[0].name;search.dispatchEvent(new t.Event('input',{bubbles:true}));click('[data-coach-choice]');
 assert.equal(t.document.querySelector('#field-name').value,data.deposits[0].name);
 assert.match(t.document.querySelector('#record-form button[type=submit]').textContent,/변경 목록에 담기/);
 assert.equal(t.writes(),0);click('[data-close=editor]');
});

test('home definitions open independently from financial actions, on hover, focus and tap',async()=>{
 const t=await app(domain.samplePortfolio()),doc=t.document;
 const tip=doc.querySelector('.home-tip-card button[aria-label="남은 부채 설명 보기"]');
 const card=doc.querySelector('.home-stat[data-detail="debt"]');
 const source=doc.getElementById(tip.getAttribute('aria-describedby'));
 assert.ok(source.hidden);assert.match(source.textContent,/대출 원금과 미결제 카드/);
 assert.equal(card.contains(tip),false);
 const fire=(el,type)=>el.dispatchEvent(new t.Event(type,{bubbles:true,cancelable:true}));
 const opened=()=>doc.querySelector('.context-tip-bubble[role=tooltip]');
 fire(tip,'pointerover');assert.equal(opened().textContent,source.textContent);
 assert.equal(tip.getAttribute('aria-describedby'),opened().id);
 const escape=new t.Event('keydown',{bubbles:true,cancelable:true});escape.key='Escape';tip.dispatchEvent(escape);
 assert.equal(opened(),null);assert.equal(tip.getAttribute('aria-describedby'),source.id);
 fire(tip,'focusin');assert.ok(opened());fire(tip,'click');fire(tip,'click');assert.equal(opened(),null);
 fire(tip,'click');fire(doc.body,'click');assert.equal(opened(),null);
 assert.equal(card.getAttribute('aria-pressed'),'false');fire(card,'click');
 assert.equal(doc.querySelector('.home-stat[data-detail="debt"]').getAttribute('aria-pressed'),'true');
 assert.equal(t.writes(),0);
});

test('explanations stay contextual across desktop and mobile pages and cached help closes on navigation',async()=>{
 const t=await app(domain.samplePortfolio()),doc=t.document;
 const cases=[['budget','월급 + 기타 수입'],['deposits','잔액 × 연 이율'],['fixed','카드대금과 중복'],['schedule','결제 완료 카드 제외'],['statistics','등록한 날짜와 반복 일정 기준']];
 const find=(text)=>[...doc.querySelectorAll('#main button[data-info-sources]')].find(b=>b.dataset.infoSources.split(' ').some(id=>doc.getElementById(id)?.textContent.includes(text)));
 for(const [view,copy] of cases){
  await t.visit(view);assert.equal(doc.querySelector('.context-tip-bubble[role=tooltip]'),null);
  const button=find(copy);assert.ok(button,view);button.dispatchEvent(new t.Event('click',{bubbles:true}));
  assert.ok(doc.querySelector('.context-tip-bubble[role=tooltip]').textContent.includes(copy));
 }
 t.context.location.search='?display=mobile';
 for(const [view,copy] of [['workspace','미결제 카드 청구액'],['forecast','현재 잔액에 오늘까지'],['cards','청구 월과 실제 결제일'],['statistics','현재 대출 조건을 기준']]){
  await t.visit(view);const button=find(copy);assert.ok(button,view);
  const source=doc.getElementById(button.dataset.infoSources.split(' ')[0]);assert.ok(source.hidden);
  button.dispatchEvent(new t.Event('click',{bubbles:true}));assert.ok(doc.querySelector('.context-tip-bubble[role=tooltip]').textContent.includes(copy));
  assert.equal(doc.querySelector('#main').dataset.view,view);
 }
 assert.equal(t.writes(),0);
});

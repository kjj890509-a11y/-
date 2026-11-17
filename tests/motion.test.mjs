import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {emptyPortfolio,samplePortfolio,todayKST,totals,captureSnapshot} from '../public/domain.mjs';
import {buildStatistics,initialStatisticsFilters} from '../public/statistics.mjs';
import {renderAssetDonut,renderBudgetRing,snapshotSeries,renderSparkline,renderAmountBars,expenseComposition,renderExpenseComposition,rankingRows,sortedRanking,renderLoanComparison} from '../public/financial-charts.mjs';
import {mountFinancialMotion,unmountFinancialMotion} from '../public/motion.mjs';
const money=value=>value.toLocaleString('ko-KR')+'원';
const format={formatMoney:money,formatCompact:String};
function dom(html,{reduce=false}={}){
 const {document,window,Event}=parseHTML('<main id="main">'+html+'</main>');window.matchMedia=()=>({matches:reduce});window.innerWidth=360;window.innerHeight=480;
 const observers=[];window.IntersectionObserver=class{constructor(fn){this.fn=fn;this.targets=[];observers.push(this);}observe(target){this.targets.push(target);}unobserve(target){this.targets=this.targets.filter(el=>el!==target);}disconnect(){this.targets=[];}};
 const root=document.getElementById('main');return {root,document,window,Event,observers};
}
test('donut and progress rings preserve exact values, zero states, over-budget status and amount masking',()=>{
 const categories=[['deposits','현금',75],['stocks','주식',25],['retirement','연금',0]],{document}=parseHTML(renderAssetDonut(categories,{money}));
 const arcs=[...document.querySelectorAll('.donut-segment')];assert.equal(arcs.length,2);assert.equal(arcs.reduce((n,p)=>n+Number(p.getAttribute('stroke-dasharray').split(' ')[0]),0),100);assert.match(arcs[0].getAttribute('aria-label'),/75원/);
 assert.match(renderBudgetRing({limit:100,expense:150},{money}),/150%/);assert.match(renderBudgetRing({limit:null,expense:80},{money}),/미설정/);assert.match(renderBudgetRing({limit:0,expense:0},{money}),/0%/);assert.doesNotMatch(renderBudgetRing({limit:0,expense:50},{money}),/Infinity|NaN/);
 const masked=renderAssetDonut(categories,{money:()=>'••••••',hideAmounts:true})+renderBudgetRing({limit:99999,expense:33333},{money:()=>'••••••',hideAmounts:true});assert.doesNotMatch(masked,/99999|33333|75원|75\.0%/);
 assert.equal(parseHTML(renderAssetDonut(categories.map(r=>[r[0],r[1],0]),{money})).document.querySelectorAll('.donut-segment').length,0);
});
test('sparklines use dated category snapshots and current balances, never future or fabricated account history',()=>{
 const p=emptyPortfolio();p.deposits=[{id:'cash',name:'현금',balance:500,rate:0}];p.snapshots=[{month:'2026-01',asOf:'2026-01-31',stock:10,deposits:100,retirement:0,loans:0,cards:0},{month:'2027-01',asOf:'2027-01-31',stock:99,deposits:999,retirement:0,loans:0,cards:0}];
 const points=snapshotSeries(p,'deposits','2026-02-28');assert.deepEqual(points,[{date:'2026-01-31',value:100},{date:'2026-02-28',value:500}]);assert.equal(snapshotSeries(p,'cash-account-id','2026-02-28').length,0);assert.equal(renderSparkline(points.slice(0,1),'현금'),'');assert.match(renderSparkline(points,'현금'),/저장 기록 추이/);assert.doesNotMatch(renderSparkline(points,'현금'),/999/);
});
test('stacked expenses reconcile to the same filtered monthly totals, excluding informational card duplicates and pension',()=>{
 const p=samplePortfolio(),today=todayKST();p.fixed.push({id:'info-fixed',name:'카드에 포함',amount:777,day:20,paymentSource:'card',startMonth:today.slice(0,7),endMonth:'',note:''});
 for(const patch of [{},{kind:'loans'},{kind:'cards'},{kind:'expense'},{kind:'income'},{basis:'recorded'}]){
  const result=buildStatistics(p,{...initialStatisticsFilters(today),...patch},today),months=expenseComposition(result);
  for(const m of months)assert.equal(m.principal+m.interest+m.cards+m.fixed+m.other,m.total,m.month);
  assert.equal(months.reduce((n,m)=>n+m.total,0),result.totals.expense);
 }
 const result=buildStatistics(p,initialStatisticsFilters(today),today),html=renderExpenseComposition(result,format);assert.match(html,/월별 지출 구성/);const masked=renderExpenseComposition(result,{formatMoney:()=>'••••••',formatCompact:()=>'••••'});assert.ok(!masked.includes(money(result.totals.expense)));
});
test('bar tooltips are safe and keyboard navigable, clamped to the viewport and preserve hidden money',()=>{
 const t=dom(renderAmountBars([{label:'1월',value:100},{label:'2월',value:200}],{...format,title:'실제 수입'}));
 for(const point of t.root.querySelectorAll('[data-chart-inspect]')){point.getBoundingClientRect=()=>({left:350,top:470,bottom:490,width:30,height:20});point.focus=()=>point.dispatchEvent(new t.Event('focusin',{bubbles:true}));}
 mountFinancialMotion(t.root);const first=t.root.querySelector('[data-chart-inspect]');first.dispatchEvent(new t.Event('pointerover',{bubbles:true}));assert.equal(t.root.querySelector('.motion-tooltip strong').textContent,'100원');assert.ok(parseFloat(t.root.querySelector('.motion-tooltip').style.left)>=12);
 const event=new t.Event('keydown',{bubbles:true,cancelable:true});event.key='ArrowRight';first.dispatchEvent(event);assert.equal(t.root.querySelector('.motion-tooltip strong').textContent,'200원');const escape=new t.Event('keydown',{bubbles:true});escape.key='Escape';first.dispatchEvent(escape);assert.ok(t.root.querySelector('.motion-tooltip').hidden);unmountFinancialMotion(t.root);
 const {document}=parseHTML(renderAmountBars([{label:'<img src=x>',value:123456}],{formatMoney:()=>'••••••',formatCompact:()=>'••••',title:'안전'}));assert.equal(document.querySelectorAll('img').length,0);assert.doesNotMatch(document.documentElement.outerHTML,/123456/);
});
test('motion starts on visibility once per data state; only a changed financial revision pulses values',()=>{
 const markup='<figure data-motion-chart data-motion-key="visibility-motion-test"></figure><strong data-motion-value data-motion-value-key="test:revision">100원</strong>',t=dom(markup);mountFinancialMotion(t.root,{revision:1});const chart=t.root.querySelector('figure');assert.ok(chart.classList.contains('motion-pending'));t.observers[0].fn([{target:chart,isIntersecting:true}]);assert.ok(chart.classList.contains('motion-playing'));unmountFinancialMotion(t.root);
 t.root.innerHTML=markup;mountFinancialMotion(t.root,{revision:1});assert.ok(t.root.querySelector('figure').classList.contains('motion-finished'));const value=t.root.querySelector('strong');value.textContent='120원';mountFinancialMotion(t.root,{revision:2});assert.ok(value.classList.contains('financial-value-changed'));unmountFinancialMotion(t.root);
 const reduced=dom('<figure data-motion-chart data-motion-key="reduced-test"></figure><strong data-motion-value data-motion-value-key="test:revision">130원</strong>',{reduce:true});mountFinancialMotion(reduced.root,{revision:3});assert.ok(!reduced.root.querySelector('figure').classList.contains('motion-pending'));assert.ok(!reduced.root.querySelector('strong').classList.contains('financial-value-changed'));unmountFinancialMotion(reduced.root);
});
test('sorting animates actual row positions without changing loan order or any financial balance',()=>{
 const p=emptyPortfolio();p.loans=[{id:'a',name:'높은 이자',balance:5000,rate:24,principal:0,interestMode:'manual',interest:100,method:'만기일시',day:25},{id:'b',name:'적은 이자',balance:10000,rate:1,principal:0,interestMode:'manual',interest:10,method:'만기일시',day:25}];const before=structuredClone(p),t=dom(renderLoanComparison(p,format)),animations=[];
 t.window.HTMLElement.prototype.getBoundingClientRect=function(){return {top:this.classList.contains('loan-rank-row')?[...this.parentNode.children].indexOf(this)*40:0,left:0,width:100,height:40,bottom:40};};
 t.window.HTMLElement.prototype.animate=function(frames){animations.push({key:this.dataset.rankKey,frames});return {cancel(){},finished:Promise.resolve()};};
 mountFinancialMotion(t.root);t.root.querySelector('[data-rank-direction]').dispatchEvent(new t.Event('click',{bubbles:true}));assert.deepEqual([...t.root.querySelectorAll('[data-rank-key]')].map(el=>el.dataset.rankKey),['b','a']);assert.equal(animations.length,2);assert.ok(animations.some(a=>a.frames[0].transform==='translateY(40px)'));
 t.root.querySelector('[data-rank-metric="balance"]').dispatchEvent(new t.Event('click',{bubbles:true}));assert.deepEqual([...t.root.querySelectorAll('[data-rank-key]')].map(el=>el.dataset.rankKey),['a','b']);assert.deepEqual(p,before);assert.equal(totals(p).loans,15000);assert.deepEqual(sortedRanking(rankingRows(p),'interest','desc').map(row=>row.key),['a','b']);unmountFinancialMotion(t.root);
});
test('amount bars keep negative cashflow below the zero baseline and positive cashflow above it',()=>{
 const {document}=parseHTML(renderAmountBars([{label:'적자',value:-150},{label:'흑자',value:100},{label:'균형',value:0}],{...format,title:'수입·지출 차액'}));
 const bars=[...document.querySelectorAll('.moa-grow-bar')],baseline=Number(bars[0].getAttribute('style').match(/transform-origin:[^ ]+ ([\d.]+)px/)[1]);
 assert.equal(Number(bars[0].getAttribute('y')),baseline);assert.ok(Number(bars[0].getAttribute('height'))>0);assert.ok(Number(bars[1].getAttribute('y'))<baseline);assert.equal(Number(bars[2].getAttribute('height')),0);assert.match(document.querySelector('[data-chart-inspect]').getAttribute('aria-label'),/-150원/);
 for(const value of [-10,0,10])assert.doesNotMatch(renderAmountBars([{label:'한 달',value}],{...format,title:'차액'}),/NaN|Infinity/);
});

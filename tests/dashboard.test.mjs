import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {emptyPortfolio,samplePortfolio,validatePortfolio,budgetPlan,totals} from '../public/domain.mjs';
import {dashboardData,renderDashboard,renderAssets} from '../public/dashboard-view.mjs';
import {viewLabels,navigationGroups,groupForView,sectionTabs} from '../public/navigation.mjs';
const money=value=>new Intl.NumberFormat('ko-KR').format(value)+'원';
const format={money,compact:money,svg:()=>'',chart:'',today:'2026-11-16'};

test('every existing destination remains reachable in one of six navigation groups',()=>{
 const expected=['overview','statistics','advisor','budget','forecast','payday','planned','history','stocks','loans','retirement','deposits','cards','fixed','cashflow','schedule','assets','workspace'];
 assert.equal(navigationGroups.length,6);
 const routes=navigationGroups.flatMap(group=>group.views);
 assert.equal(new Set(routes).size,expected.length);
 assert.deepEqual([...routes].sort(),expected.sort());
 for(const route of routes){
  assert.ok(viewLabels[route]);const group=groupForView(route);
  assert.ok(group.views.includes(group.defaultView));
  if(route==='overview')continue;
  const {document}=parseHTML(sectionTabs(route));
  assert.equal(document.querySelector('[aria-current="page"]').getAttribute('href'),'#'+route);
  assert.equal(document.querySelectorAll('a').length,group.views.length);
 }
 assert.equal(groupForView('retirement').label,'보유 자산');
 assert.equal(groupForView('schedule').label,'수입·지출');
 assert.equal(groupForView('payday').label,'자금 계획');
});

test('dashboard totals match financial data and show monthly interest without opening help',()=>{
 const data=samplePortfolio('2026-11-16'),before=structuredClone(data),summary=dashboardData(data,'2026-11-16');
 const {document}=parseHTML(renderDashboard(data,format));
 const cards=[...document.querySelectorAll('.home-stat strong')].map(node=>node.textContent);
 assert.deepEqual(cards,[totals(data).net,totals(data).deposits,totals(data).debt,budgetPlan(data,'2026-11').balance].map(money));
 assert.match(document.querySelector('.compact-ledger').textContent,/대출 월 이자/);
 assert.ok(document.querySelector('.compact-ledger').textContent.includes(money(totals(data).monthlyInterest)));
 assert.ok(summary.events.every(row=>row.date>='2026-11-16'&&row.date<='2026-12-16'&&!row.paid));
 assert.deepEqual(data,before);
});

test('upcoming list crosses year boundaries and omits past recurring entries, paid bills and excluded plans',()=>{
 const data=validatePortfolio({...emptyPortfolio(),cards:[{id:'past',name:'지난 카드',amount:100,dueDate:'2026-12-25',paid:false},{id:'paid',name:'완료 카드',amount:200,dueDate:'2027-01-02',paid:true}],cashflow:[{id:'salary',name:'월급',type:'salary',amount:4000000,date:'2026-12-05',repeat:'monthly'},{id:'excluded',name:'미확정',type:'other_income',amount:300,date:'2027-01-03',repeat:'once',includeInForecast:false}]});
 const {events,overdue}=dashboardData(data,'2026-12-29');
 assert.deepEqual(events.map(row=>row.date),['2027-01-05']);
 assert.equal(overdue.length,1);
});

test('thirty-day window includes the third month after a short February',()=>{
 const data=validatePortfolio({...emptyPortfolio(),cashflow:[{id:'bonus',name:'추가 지급',type:'other_income',amount:100,date:'2027-03-01',repeat:'once'}]});
 assert.equal(dashboardData(data,'2027-01-31').events.length,1);
});

test('empty states, hidden money and untrusted account names remain safe',()=>{
 const empty=renderDashboard(emptyPortfolio(),format);
 assert.match(empty,/현재 잔액부터 등록/);assert.match(empty,/chart-empty/);
 const data=samplePortfolio('2026-11-16');data.deposits[0].name='<img src=x onerror=alert(1)>';
 const {document}=parseHTML('<main>'+renderAssets(data,{...format,money:()=> '••••••'})+'</main>');
 assert.equal(document.querySelectorAll('img').length,0);
 assert.ok(document.documentElement.textContent.includes('<img src=x onerror=alert(1)>'));
 assert.ok(!document.documentElement.textContent.includes(money(totals(data).gross)));
 assert.equal(document.querySelectorAll('.asset-group').length,3);
});

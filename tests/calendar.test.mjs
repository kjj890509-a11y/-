import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {emptyPortfolio} from '../public/domain.mjs';
import {calendarModel,renderCashCalendar,shiftCalendarDay} from '../public/calendar.mjs';
function data(){const p=emptyPortfolio();p.cashflow=[{id:'salary',type:'salary',name:'월급',date:'2028-01-31',repeat:'monthly',amount:3000000,includeInForecast:true},{id:'expense',type:'expense',name:'<지출>',date:'2028-02-29',repeat:'once',amount:120000,includeInForecast:true}];p.cards=[{id:'paid',name:'완료 카드',dueDate:'2028-02-29',amount:50000,paid:true},{id:'unpaid',name:'미결제 카드',dueDate:'2028-02-29',amount:80000,paid:false}];return p;}
const money=value=>value.toLocaleString('ko-KR')+'원';
test('calendar keeps leap days, clamped monthly dates and completed card amounts separate',()=>{
 const p=data(),before=structuredClone(p),model=calendarModel(p,{month:'2028-02',today:'2028-02-10',selectedDate:'2028-02-29'});
 const day=model.cells.find(row=>row.date==='2028-02-29');assert.equal(day.income,3000000);assert.equal(day.expense,200000);assert.equal(day.paid,50000);assert.equal(day.rows.length,4);
 assert.equal(model.flow.expense,200000);assert.equal(model.expense,200000);assert.deepEqual(p,before);
 assert.equal(model.cells.length%7,0);assert.equal(model.cells.filter(row=>row.inMonth).length,29);
 assert.equal(shiftCalendarDay('2028-02-29',1),'2028-03-01');assert.equal(shiftCalendarDay('2028-01-01',-1),'2027-12-31');
});
test('date and type filters narrow the agenda without changing the month totals',()=>{
 for(const [filter,expected] of [['income',['salary']],['expense',['unpaid','expense']],['paid',['paid']]]){
 const model=calendarModel(data(),{month:'2028-02',today:'2028-02-10',selectedDate:'all',filter});
 assert.deepEqual(model.agenda.map(row=>row.id).sort(),expected.sort());assert.equal(model.flow.income,3000000);assert.equal(model.flow.expense,200000);
 }
 const changed=calendarModel(data(),{month:'2028-03',today:'2028-02-10',selectedDate:'2028-02-29'});assert.ok(changed.selected.startsWith('2028-03-'));
});
test('calendar exposes a selectable day, safe edit actions, empty-day registration and masked values',()=>{
 const html=renderCashCalendar(data(),{month:'2028-02',today:'2028-02-10',selectedDate:'2028-02-29',money,compact:money});
 const {document}=parseHTML(html);assert.equal(document.querySelector('[aria-pressed=true][data-action=calendar-day]').dataset.date,'2028-02-29');
 const board=document.querySelector('.cf-month-board');
 assert.equal(board.querySelector('.cf-weekdays').children.length,7);
 assert.equal(board.querySelector('.cf-grid').children.length,35);
 assert.equal(board.querySelector('[aria-current="date"]').dataset.date,'2028-02-10');
 assert.equal(board.querySelector('.is-selected').dataset.date,'2028-02-29');
 assert.equal(document.querySelector('#calendar-month[data-month-value]').value,'2028-02');
 assert.equal(document.querySelectorAll('.cf-event').length,4);assert.equal(document.querySelector('[data-id=expense] strong').textContent,'<지출>');assert.equal(document.querySelectorAll('지출').length,0);
 assert.equal(document.querySelector('[data-action=calendar-add]').dataset.date,'2028-02-29');
 const masked=renderCashCalendar(data(),{month:'2028-02',selectedDate:'all',money:()=>'••••••',compact:()=>'••••'});assert.doesNotMatch(masked,/3,000,000|3000000|120,000|120000|80,000/);
 const empty=renderCashCalendar(emptyPortfolio(),{month:'2028-02',today:'2028-02-10',money,compact:money});assert.match(empty,/등록된 일정이 없어요/);
});


test('calendar category filters combine with status while the monthly financial summary stays unchanged',()=>{
 const p=data(),before=structuredClone(p);
 const paid=calendarModel(p,{month:'2028-02',selectedDate:'all',filter:'paid',category:'cards'});assert.deepEqual(paid.visible.map(row=>row.id),['paid']);
 const none=calendarModel(p,{month:'2028-02',selectedDate:'all',filter:'income',category:'cards'});assert.equal(none.visible.length,0);assert.equal(none.flow.income,3000000);
 const html=renderCashCalendar(p,{month:'2028-02',mode:'list',category:'cards',money,compact:money});const {document}=parseHTML(html);
 assert.equal(document.querySelector('.cf-grid'),null);assert.equal(document.querySelectorAll('.cf-date-group').length,1);assert.equal(document.querySelectorAll('.cf-event').length,2);assert.ok(document.querySelector('[data-action=calendar-add]'));assert.deepEqual(p,before);
});


test('compact month cells aggregate every matching transaction while details retain all rows and paid cards stay separate',()=>{
 const p=data();p.cashflow.push({id:'extra',type:'other_income',name:'추가 수입',date:'2028-02-29',repeat:'once',amount:100000,includeInForecast:true});
 const html=renderCashCalendar(p,{month:'2028-02',today:'2028-02-10',selectedDate:'2028-02-29',money,compact:value=>value.toLocaleString('ko-KR')});
 const {document}=parseHTML(html),day=document.querySelector('[data-action=calendar-day][data-date="2028-02-29"]');
 assert.equal(day.querySelector('[data-day-income]').textContent,'+3,100,000원');assert.equal(day.querySelector('[data-day-expense]').textContent,'−200,000원');assert.equal(day.querySelectorAll('.cf-day-total').length,2);assert.equal(day.querySelector('.cf-entry'),null);
 assert.equal(day.querySelector('.cf-day-check').textContent,'✓');assert.match(day.getAttribute('aria-label'),/결제 완료 포함/);
 assert.equal(document.querySelectorAll('.cf-event').length,5);assert.equal(day.querySelector('.cf-count').textContent,'5건');
 const {document:paid}=parseHTML(renderCashCalendar(p,{month:'2028-02',selectedDate:'2028-02-29',filter:'paid',money,compact:String}));
 const paidDay=paid.querySelector('[data-action=calendar-day][data-date="2028-02-29"]');assert.equal(paidDay.querySelector('[data-day-expense]'),null);assert.match(paidDay.querySelector('.cf-day-paid').textContent,/완료/);
});

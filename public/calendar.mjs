import {eventsForMonth, monthlyFlow, todayKST} from './domain.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=rows=>rows.reduce((n,row)=>n+row.amount,0);
const categories={all:'전체 항목',cashflow:'수입·지출',loans:'대출',cards:'카드',fixed:'정기 지출'};
const weekdays=['일','월','화','수','목','금','토'];
export function shiftCalendarDay(date,offset){return new Date(Date.parse(date+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);}
export function calendarModel(data,{month,today=todayKST(),selectedDate='',filter='all',category='all'}){
 const events=eventsForMonth(data,month),flow=monthlyFlow(data,month);
 const days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
 const validSelected=/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)&&selectedDate.startsWith(month+'-')&&Number(selectedDate.slice(8))>=1&&Number(selectedDate.slice(8))<=days;
 const selected=selectedDate==='all'?'all':validSelected?selectedDate:today.startsWith(month+'-')?today:events[0]?.date||month+'-01';
 const matches=row=>(category==='all'||row.type===category)&&(filter==='income'?row.income:filter==='expense'?!row.income&&!row.paid:filter==='paid'?row.paid:true);
 const visible=events.filter(matches),agenda=visible.filter(row=>selected==='all'||row.date===selected);
 const first=month+'-01',offset=new Date(first+'T00:00:00Z').getUTCDay();
 const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
  const date=shiftCalendarDay(first,i-offset),rows=events.filter(row=>row.date===date).filter(matches);
  return {date,inMonth:date.startsWith(month+'-'),today:date===today,selected:date===selected,rows,income:sum(rows.filter(row=>row.income)),expense:sum(rows.filter(row=>!row.income&&!row.paid)),paid:sum(rows.filter(row=>row.paid))};
 });
 return {month,selected,filter,category,events,visible,agenda,cells,flow,income:sum(agenda.filter(row=>row.income)),expense:sum(agenda.filter(row=>!row.income&&!row.paid))};
}
const eventKind=row=>row.paid?'결제 완료':row.type==='loans'?'대출 원금·이자':row.type==='cards'?'카드 청구':row.type==='fixed'?'정기 지출':row.income?'수입':'기타 지출';
const eventTone=row=>row.paid?'paid':row.income?'in':'out';
const dateLabel=date=>`${Number(date.slice(5,7))}월 ${Number(date.slice(8))}일 ${weekdays[new Date(date+'T00:00:00Z').getUTCDay()]}요일`;
function eventRow(row,money){
 const tone=eventTone(row);
 return `<button type="button" class="cf-event" data-action="edit" data-kind="${row.type}" data-id="${esc(row.id)}" aria-label="${esc(row.name)} 상세 수정"><span class="cf-event-mark cf-event-${tone}" aria-hidden="true">${row.paid?'✓':row.income?'↙':'↗'}</span><span class="cf-event-info"><strong>${esc(row.name)}</strong><small>${eventKind(row)}</small></span><span class="cf-event-value ${row.income?'cf-in':row.paid?'cf-paid-value':''}">${row.paid?'':row.income?'+':'−'}${esc(money(row.amount))}</span><span class="cf-event-edit" aria-hidden="true">›</span></button>`;
}
function groupedEvents(rows,money,selected='all'){
 if(selected!=='all')return rows.map(row=>eventRow(row,money)).join('');
 return [...new Set(rows.map(row=>row.date))].map(date=>{
  const daily=rows.filter(row=>row.date===date),incoming=sum(daily.filter(row=>row.income)),outgoing=sum(daily.filter(row=>!row.income&&!row.paid));
  return `<section class="cf-date-group"><div class="cf-group-heading"><button type="button" data-action="calendar-day" data-date="${date}">${dateLabel(date)}</button><span>${incoming?`<b class="cf-in">+${esc(money(incoming))}</b>`:''}${outgoing?`<b>−${esc(money(outgoing))}</b>`:''}</span></div>${daily.map(row=>eventRow(row,money)).join('')}</section>`;
 }).join('');
}
function calendarToolbar(month,mode){
 const [year,m]=month.split('-').map(Number);
 return `<div class="cf-toolbar"><div class="cf-month-navigation"><h2>${year}년 ${m}월</h2><button type="button" data-action="prev-month" aria-label="이전 달">‹</button><button type="button" data-action="next-month" aria-label="다음 달">›</button><button type="button" class="cf-today" data-action="this-month">이번 달</button><label class="cf-month-picker"><span class="sr-only">조회할 월</span><input type="month" id="calendar-month" value="${month}" min="1900-01" max="2200-12" aria-label="조회할 월"></label></div><div class="cf-view-switch" role="group" aria-label="일정 표시 방식">${[['month','달력'],['list','목록']].map(([id,label])=>`<button type="button" data-action="calendar-mode" data-mode="${id}" aria-pressed="${mode===id}">${label}</button>`).join('')}</div></div>`;
}
export function renderCashCalendar(data,{month,today=todayKST(),selectedDate='',filter='all',category='all',mode='month',money,compact}){
 const model=calendarModel(data,{month,today,selectedDate,filter,category}),{flow,selected,agenda,visible}=model;
 const m=Number(month.slice(5)),label=selected==='all'?`${m}월 전체 내역`:dateLabel(selected),filtered=filter!=='all'||category!=='all';
 const cells=model.cells.map(cell=>{
  const day=Number(cell.date.slice(8));
  if(!cell.inMonth)return `<div class="cf-day is-outside" aria-hidden="true"><span class="cf-date">${day}</span></div>`;
  const summary=[cell.income?`수입 ${money(cell.income)}`:'',cell.expense?`예정 지출 ${money(cell.expense)}`:'',cell.paid?'결제 완료':''].filter(Boolean).join(', ');
  return `<button type="button" class="cf-day ${cell.today?'is-today':''} ${cell.selected?'is-selected':''} ${cell.rows.length?'has-events':''}" data-action="calendar-day" data-date="${cell.date}" aria-pressed="${cell.selected}" ${cell.today?'aria-current="date"':''} aria-label="${cell.date}, ${cell.rows.length}건${summary?', '+esc(summary):''}" aria-controls="calendar-agenda"><span class="cf-date-line"><span class="cf-date">${day}</span>${cell.today?'<span class="cf-today-label">오늘</span>':''}${cell.rows.length?`<span class="cf-count">${cell.rows.length}건</span>`:''}</span><span class="cf-day-totals">${cell.income?`<span class="cf-day-total cf-in" data-day-income>+${esc(compact(cell.income))}<span class="cf-unit">원</span></span>`:''}${cell.expense?`<span class="cf-day-total cf-out" data-day-expense>−${esc(compact(cell.expense))}<span class="cf-unit">원</span></span>`:''}${cell.paid&&!cell.income&&!cell.expense?'<span class="cf-day-paid">✓ 결제 완료</span>':''}</span></button>`;
 }).join('');
 const empty=`<div class="cf-empty"><strong>${filtered?'선택한 조건의 일정이 없어요':'등록된 일정이 없어요'}</strong><p>${filtered?'다른 항목을 선택하거나 필터를 초기화해 보세요.':'수입이나 지출을 등록하면 날짜별로 표시됩니다.'}</p>${filtered?'<button type="button" class="button secondary" data-action="calendar-reset">필터 초기화</button>':''}</div>`;
 const agendaMarkup=`<section class="panel cf-agenda" id="calendar-agenda" aria-labelledby="calendar-agenda-title"><div class="cf-agenda-heading"><div><span class="cf-overline">${selected==='all'?'월간 일정':'날짜별 내역'}</span><h2 id="calendar-agenda-title">${label}</h2></div><button type="button" class="cf-month-link" data-action="calendar-all" aria-pressed="${selected==='all'}">월 전체</button></div><div class="cf-agenda-summary"><span>수입 <b class="cf-in">${esc(money(model.income))}</b></span><span>예정 지출 <b>${esc(money(model.expense))}</b></span></div><div class="cf-agenda-list" aria-live="polite">${agenda.length?groupedEvents(agenda,money,selected):empty}</div><div class="cf-agenda-actions"><button type="button" class="button secondary" data-action="calendar-add" data-type="other_income" data-date="${selected==='all'?month+'-01':selected}">+ 수입 등록</button><button type="button" class="button secondary" data-action="calendar-add" data-type="expense" data-date="${selected==='all'?month+'-01':selected}">+ 지출 등록</button></div><p class="panel-note">내역을 누르면 수정할 수 있어요. 예금 잔액은 자동 변경되지 않습니다.</p></section>`;
 return `<div class="cf-month-summary" aria-label="${m}월 수입·지출 집계"><div><span><i class="cf-in-dot"></i>등록 수입</span><strong class="cf-in">${esc(money(flow.income))}</strong></div><div><span><i class="cf-out-dot"></i>${flow.actualApplied?'가계부 반영 지출':'미결제·예정 지출'}</span><strong>${esc(money(flow.expense))}</strong></div><div><span>수입 − 지출</span><strong class="${flow.balance<0?'cf-out':''}">${esc(money(flow.balance))}</strong><small>월 전체 기준 · 결제 완료 카드 제외</small></div></div><div class="cf-layout ${mode==='list'?'is-list-mode':''}"><section class="panel cf-month">${calendarToolbar(month,mode)}<div class="cf-filter-bar"><div class="cf-categories" role="group" aria-label="일정 항목">${Object.entries(categories).map(([id,text])=>`<button type="button" data-action="calendar-category" data-category="${id}" aria-pressed="${category===id}">${text}</button>`).join('')}</div><label class="cf-status-filter"><span class="sr-only">입출금 구분</span><select id="calendar-status" aria-label="입출금 구분">${[['all','모든 입출금'],['income','수입만'],['expense','예정 지출만'],['paid','결제 완료만']].map(([id,text])=>`<option value="${id}" ${filter===id?'selected':''}>${text}</option>`).join('')}</select></label></div><div class="cf-result-bar"><span>${visible.length}건${filtered?' · 필터 적용 중':''}</span>${filtered?'<button type="button" data-action="calendar-reset">필터 초기화</button>':''}</div>${mode==='list'?`<div class="cf-month-list"><div class="cf-list-actions"><button type="button" class="button secondary" data-action="calendar-add" data-type="other_income" data-date="${month}-01">+ 수입 등록</button><button type="button" class="button secondary" data-action="calendar-add" data-type="expense" data-date="${month}-01">+ 지출 등록</button></div>${visible.length?groupedEvents(visible,money):empty}</div>`:`<div class="cf-weekdays" aria-hidden="true">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="cf-grid" role="group" aria-label="${esc(month)} 입출금 날짜">${cells}</div>`}<div class="cf-calendar-footer"><span><i class="cf-in-dot"></i>수입 <i class="cf-out-dot"></i>예정 지출 <span>✓ 결제 완료</span></span><small>날짜를 눌러 세부 내역 확인</small></div></section>${mode==='list'?'':agendaMarkup}</div>`;
}

import {todayKST, validDate, validMonth, shiftMonth, paymentDate, cashflowForMonth, fixedForMonth, loanSchedule, retirementContributionsForMonth} from './domain.mjs';

export const statisticsKinds = {all:'전체 항목',loans:'대출 상환',expense:'생활 지출',income:'수입',cards:'카드대금',retirement:'회사 퇴직연금 납입'};
export const statisticsMetrics = {expense:'지출·상환 합계',income:'수입 합계',loanPayment:'대출 상환액',principal:'대출 상환 원금',interest:'대출 이자',retirementContribution:'회사 퇴직연금 납입액'};
export const statisticsBases = {all:'기록·일정·예상 전체',recorded:'상환·결제 완료 기록',scheduled:'등록한 입출금·납입 일정',projected:'앞으로의 대출 상환 예상'};
export const statisticsBasis = row => row.source==='loanPayments'||(row.source==='cards'&&row.status==='결제 완료')?'recorded':row.source==='loans'?'projected':'scheduled';
export function metricsForKind(kind){
  const keys=kind==='loans'?['loanPayment','principal','interest']:kind==='income'?['income']:kind==='retirement'?['retirementContribution']:['expense','cards'].includes(kind)?['expense']:Object.keys(statisticsMetrics);
  return Object.fromEntries(keys.map(key=>[key,statisticsMetrics[key]]));
}
export function statisticsSeries(result,metric){
  const days=Math.round((new Date(result.end+'T00:00:00Z')-new Date(result.start+'T00:00:00Z'))/86400000)+1;
  if(days>62)return result.months.map(row=>({label:row.month.slice(2).replace('-','.'),detailLabel:row.month.replace('-','.'),value:row[metric],forecast:false}));
  const byDate=new Map();
  for(const event of result.rows){if(!byDate.has(event.date))byDate.set(event.date,emptySums());accumulate(byDate.get(event.date),event);}
  return Array.from({length:days},(_,i)=>{const date=new Date(new Date(result.start+'T00:00:00Z').getTime()+i*86400000).toISOString().slice(0,10);return {label:date.slice(5).replace('-','.'),detailLabel:date.replaceAll('-','.'),value:byDate.get(date)?.[metric]||0,forecast:false};});
}
export function statisticsPeriod(preset, value, today = todayKST()) {
  if (preset === 'month') {
    const month = value || today.slice(0,7);
    if (!validMonth(month)) throw new Error('조회할 월을 확인해 주세요.');
    return {start:month+'-01',end:paymentDate(month,31)};
  }
  const year = Number(value || today.slice(0,4));
  if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new Error('조회 연도는 1900~2199년으로 입력해 주세요.');
  return {start:`${year}-01-01`,end:`${year}-12-31`};
}
export function initialStatisticsFilters(today = todayKST()) {
  return {preset:'year',year:today.slice(0,4),month:today.slice(0,7),...statisticsPeriod('year',today.slice(0,4),today),kind:'all',bank:'',item:'',query:'',basis:'all',metric:'expense',page:1};
}
const historicalKey = row => row.loanId ? 'loans:'+row.loanId : 'recorded-loan:'+JSON.stringify([row.institution,row.name]);
const bankName = value => String(value||'').trim()||'은행 미등록';
export function statisticsOptions(data, kind = 'all', bank = '') {
  const options = new Map();
  const add = (key,name,institution,type,source) => {
    if (type === 'loans') institution=bankName(institution);
    if (bank && (type !== 'loans' || institution !== bank)) return;
    if (kind === 'loans' && type !== 'loans' || kind === 'income' && type !== 'income' || kind === 'expense' && type !== 'expense' || kind === 'cards' && source !== 'cards' || kind==='retirement'&&type!=='retirement') return;
    options.set(key,{key,name,institution,type});
  };
  for (const row of data.loans) add('loans:'+row.id,row.name,row.institution||'은행 미등록','loans','loans');
  for (const row of data.loanPayments||[]) add(historicalKey(row),row.name,row.institution,'loans','loanPayments');
  for (const row of data.cashflow) if (row.includeInForecast !== false) add('cashflow:'+row.id,row.name,'',row.type === 'expense'?'expense':'income','cashflow');
  for (const row of data.fixed) add('fixed:'+row.id,row.name,'','expense','fixed');
  for (const row of data.cards) add('cards:'+row.id,row.name,'','expense','cards');
  for (const row of data.retirement||[]) add('retirement:'+row.id,row.name,row.institution,'retirement','retirement');
  return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko'));
}
const emptySums = () => ({income:0,expense:0,principal:0,interest:0,loanPayment:0,actualLoanPayment:0,projectedLoanPayment:0,cardIncluded:0,retirementContribution:0,count:0});
function accumulate(sum, event) {
  sum.count++;
  if (event.informational) { sum.cardIncluded += event.amount; return; }
  if (event.type==='retirement') {sum.retirementContribution+=event.amount;return;}
  if (event.type === 'income') sum.income += event.amount; else sum.expense += event.amount;
  if (event.type === 'loans') {
    sum.principal += event.principal;sum.interest += event.interest;sum.loanPayment += event.amount;
    sum[event.forecast?'projectedLoanPayment':'actualLoanPayment'] += event.amount;
  }
}
export function buildStatistics(data, filters, today = todayKST()) {
  const {start,end,kind='all',bank='',item='',query='',basis='all'} = filters;
  if (!validDate(start) || !validDate(end) || start > end || !validMonth(start.slice(0,7)) || !validMonth(end.slice(0,7))) throw new Error('시작일과 종료일을 확인해 주세요.');
  if (!Object.hasOwn(statisticsKinds,kind)) throw new Error('조회 유형을 확인해 주세요.');
  if (!Object.hasOwn(statisticsBases,basis)) throw new Error('집계 기준을 확인해 주세요.');
  const distance = (a,b) => (Number(b.slice(0,4))-Number(a.slice(0,4)))*12+Number(b.slice(5,7))-Number(a.slice(5,7));
  const count = distance(start,end)+1;
  if (count > 120) throw new Error('한 번에 10년 이내의 기간을 조회해 주세요.');
  const months = Array.from({length:count},(_,i)=>({...emptySums(),month:shiftMonth(start.slice(0,7),i)}));
  const events = [];
  const add = row => {
    if (row.date < start || row.date > end) return;
    events.push({principal:0,interest:0,note:'',institution:'',informational:false,forecast:false,...row});
  };
  if (kind !== 'loans' && !bank) for (const {month} of months) {
    for (const row of cashflowForMonth(data,month)) add({source:'cashflow',recordId:row.id,item:'cashflow:'+row.id,date:row.occursOn,name:row.name,note:row.note,type:row.type==='expense'?'expense':'income',amount:row.amount,status:'등록 일정'});
    for (const row of fixedForMonth(data,month)) add({source:'fixed',recordId:row.id,item:'fixed:'+row.id,date:row.occursOn,name:row.name,note:row.note,type:'expense',amount:row.amount,informational:row.paymentSource==='card',status:row.paymentSource==='card'?'카드 청구 포함':'고정지출 일정'});
    for (const row of retirementContributionsForMonth(data,month)) add({source:'retirement',recordId:row.id,item:'retirement:'+row.id,date:row.date,name:row.name,institution:data.retirement.find(account=>account.id===row.id)?.institution||'',type:'retirement',amount:row.amount,status:'회사 납입 일정'});
  }
  if (kind !== 'loans' && !bank) for (const row of data.cards) add({source:'cards',recordId:row.id,item:'cards:'+row.id,date:row.dueDate,name:row.name,note:row.note,type:'expense',amount:row.amount,status:row.paid?'결제 완료':'결제 예정'});
  if (kind === 'all' || kind === 'loans') {
    for (const row of data.loanPayments||[]) add({source:'loanPayments',recordId:row.id,item:historicalKey(row),date:row.date,name:row.name,institution:bankName(row.institution),note:row.note,type:'loans',amount:row.principal+row.interest,principal:row.principal,interest:row.interest,status:'상환 기록'});
    if (end > today && data.loans.length) {
      const projectionCount = distance(today,end)+1;
      if (projectionCount > 120) throw new Error('대출 예상은 오늘부터 10년 이내의 날짜를 선택해 주세요.');
      const byId = new Map(data.loans.map(row=>[row.id,row]));
      for (const row of loanSchedule(data,today.slice(0,7),projectionCount,today)) for (const detail of row.details) if (detail.date > today && detail.payment > 0) {
        const loan = byId.get(detail.id);
        add({source:'loans',recordId:loan.id,item:'loans:'+loan.id,date:detail.date,name:loan.name,institution:bankName(loan.institution),note:loan.note,type:'loans',amount:detail.payment,principal:detail.principal,interest:detail.interest,forecast:true,status:'예상 상환'});
      }
    }
  }
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase('ko');
  const rows = events.filter(row => {
    if (kind === 'loans' && row.type !== 'loans' || kind === 'income' && row.type !== 'income' || kind === 'expense' && row.type !== 'expense' || kind === 'cards' && row.source !== 'cards' || kind==='retirement'&&row.type!=='retirement') return false;
    if(basis!=='all'&&statisticsBasis(row)!==basis)return false;
    if (bank && (row.type !== 'loans' || row.institution !== bank) || item && row.item !== item) return false;
    return !needle || [row.name,row.institution,row.note].join(' ').normalize('NFKC').toLocaleLowerCase('ko').includes(needle);
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko'));
  const totals = emptySums(), byMonth = new Map(months.map(row=>[row.month,row])), groups = new Map();
  for (const event of rows) {
    accumulate(totals,event);accumulate(byMonth.get(event.date.slice(0,7)),event);
    if (!groups.has(event.item)) groups.set(event.item,{...emptySums(),key:event.item,name:event.name,institution:event.institution});
    accumulate(groups.get(event.item),event);
  }
  const sources={recorded:emptySums(),scheduled:emptySums(),projected:emptySums()};
  for(const row of rows)accumulate(sources[statisticsBasis(row)],row);
  return {start,end,rows,months,totals,sources,groups:[...groups.values()].sort((a,b)=>(b.income+b.expense+b.cardIncluded+b.retirementContribution)-(a.income+a.expense+a.cardIncluded+a.retirementContribution)),pastLoanRange:(kind==='all'||kind==='loans')&&start<=today};
}

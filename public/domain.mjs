export const KINDS = ['stocks', 'loans', 'retirement', 'deposits', 'cards', 'cashflow', 'fixed'];
export const LABELS = { stocks: '주식', loans: '대출', retirement: '퇴직연금·퇴직금', deposits: '예금', cards: '카드', cashflow: '수입·지출', fixed:'고정지출' };
export const FLOW_LABELS = {salary:'월급', other_income:'기타 수입', expense:'기타 지출'};
export const emptyPortfolio = () => ({ version: 1, stocks: [], loans: [], retirement: [], deposits: [], cards: [], cardAccounts: [], cashflow: [], fixed: [], budgets: [], snapshots: [], loanPayments: [], dashboard: null });
export function validateDashboard(input) {
  if (input === null || input === undefined) return null;
  if (input.version !== 1 || !Array.isArray(input.widgets) || input.widgets.length > 16) throw new Error('통계 카드는 최대 16개까지 저장할 수 있습니다.');
  const period=input.period;
  if (!period || !['month','year','custom'].includes(period.preset) || !validDate(period.start) || !validDate(period.end) || period.start>period.end || !validMonth(period.start.slice(0,7)) || !validMonth(period.end.slice(0,7)) || (Number(period.end.slice(0,4))-Number(period.start.slice(0,4)))*12+Number(period.end.slice(5,7))-Number(period.start.slice(5,7))>=120) throw new Error('통계 조회 기간은 10년 이내로 선택해 주세요.');
  const ids=new Set();
  const widgets=input.widgets.map(widget=>{
    if(!widget || typeof widget.id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(widget.id) || ids.has(widget.id))throw new Error('통계 카드 ID를 확인해 주세요.');
    ids.add(widget.id);
    if(!['analysis','composition','forecast','history','budget','payday','schedule'].includes(widget.type))throw new Error('통계 카드 종류를 확인해 주세요.');
    const result={id:widget.id,type:widget.type};
    for(const [key,max] of [['title',80],['bank',100],['item',600],['query',100]]){
      if(typeof widget[key]!=='string'||widget[key].length>max)throw new Error('통계 카드의 이름과 조회 조건을 확인해 주세요.');
      result[key]=widget[key].trim();
    }
    if(!result.title || !['all','loans','expense','income','cards','retirement'].includes(widget.kind) || !['income','expense','principal','interest','retirementContribution','loanPayment'].includes(widget.metric) || !['all','recorded','scheduled','projected'].includes(widget.basis) || !['trend','breakdown'].includes(widget.display) || !['standard','wide'].includes(widget.width))throw new Error('통계 카드 설정을 확인해 주세요.');
    return {...result,kind:widget.kind,metric:widget.metric,basis:widget.basis,display:widget.display,width:widget.width};
  });
  return {version:1,period:{preset:period.preset,start:period.start,end:period.end},widgets};
}
export function todayKST(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const moneyFields = { stocks: ['valuation', 'cost'], loans: ['balance', 'principal', 'interest'], retirement: ['amount', 'monthlyContribution'], deposits: ['balance'], cards: ['amount'], cashflow:['amount'], fixed:['amount'] };
const textFields = { stocks: ['institution', 'note'], loans: ['institution', 'method', 'note'], retirement: ['institution', 'note'], deposits: ['institution', 'note'], cards: ['note'], cashflow:['note'], fixed:['note'] };
export function validatePortfolio(input) {
  if (!input || input.version !== 1 || typeof input !== 'object') throw new Error('지원하지 않는 백업 형식입니다.');
  const clean = emptyPortfolio();
  let count = 0;
  for (const kind of KINDS) {
    if (['cashflow','fixed'].includes(kind) && input[kind] === undefined) continue;
    if (!Array.isArray(input[kind])) throw new Error('자산 목록 형식을 확인해 주세요.');
    const ids = new Set();
    clean[kind] = input[kind].map(row => {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id)) throw new Error('항목 ID를 확인해 주세요.');
      ids.add(row.id);
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100) throw new Error('항목 이름을 100자 이내로 입력해 주세요.');
      const result = {id: row.id, name: row.name.trim()};
      for (const key of moneyFields[kind]) {
        if(kind==='loans'&&(key==='interest'&&(row.interestMode==='estimate'||row.calculationMode==='term')||key==='principal'&&row.calculationMode==='term'))continue;
        const value=kind==='retirement'&&key==='monthlyContribution'&&row[key]===undefined?0:row[key];
        if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000_000) throw new Error('금액은 0 이상의 정수(원)로 입력해 주세요.');
        result[key] = value;
      }
      for (const key of textFields[kind]) {
        if (row[key] != null && typeof row[key] !== 'string') throw new Error('텍스트 항목을 확인해 주세요.');
        if ((row[key] || '').length > 500) throw new Error('메모는 500자 이내로 입력해 주세요.');
        result[key] = row[key] || '';
      }
      if (kind === 'loans' || kind === 'deposits') {
        if (!Number.isFinite(row.rate) || row.rate < 0 || row.rate > 100) throw new Error('연 이율은 0~100%로 입력해 주세요.');
        result.rate = row.rate;
      }
      if (kind === 'loans') {
        if (!Number.isInteger(row.day) || row.day < 1 || row.day > 31) throw new Error('상환일은 매월 1~31일로 입력해 주세요.');
        if (!['원리금균등', '원금균등', '만기일시', '기타'].includes(row.method)) throw new Error('상환 방식을 선택해 주세요.');
        result.day = row.day;
        result.calculationMode=row.calculationMode??'manual';
        if(!['manual','term'].includes(result.calculationMode))throw new Error('상환 계산 기준을 선택해 주세요.');
        if(result.calculationMode==='term'){
          if(!['원금균등','원리금균등','만기일시'].includes(row.method))throw new Error('기간 계산에 사용할 상환 방식을 선택해 주세요.');
          if(!Number.isInteger(row.remainingMonths)||row.remainingMonths<1||row.remainingMonths>600)throw new Error('남은 상환 횟수는 1~600회로 입력해 주세요.');
          const grace=row.graceMonths??0;
          if(!Number.isInteger(grace)||grace<0||grace>=row.remainingMonths)throw new Error('남은 거치 횟수는 0 이상, 전체 남은 상환 횟수보다 작아야 합니다.');
          if(!validDate(row.nextPaymentDate)||!validMonth(row.nextPaymentDate.slice(0,7)))throw new Error('다음 납부일을 입력해 주세요.');
          result.remainingMonths=row.remainingMonths;result.graceMonths=grace;result.nextPaymentDate=row.nextPaymentDate;
          result.interestMode='estimate';
          const payment=loanNextPayment({...result,method:row.method});result.principal=payment.principal;result.interest=payment.interest;
        }else{
          const mode=row.interestMode??'manual';
          if(!['manual','estimate'].includes(mode))throw new Error('이자 계산 방식을 선택해 주세요.');
          result.interestMode=mode;result.interest=mode==='estimate'?estimatedMonthlyInterest(row.balance,row.rate):row.interest;
        }
      }
      if(kind==='fixed') {
        if(!Number.isInteger(row.day)||row.day<1||row.day>31)throw new Error('납부일은 1~31일로 입력해 주세요.');
        if(!validMonth(row.startMonth)||(row.endMonth&&(!validMonth(row.endMonth)||row.endMonth<row.startMonth)))throw new Error('고정지출의 시작월·종료월을 확인해 주세요.');
        if(!['account','card'].includes(row.paymentSource))throw new Error('고정지출 결제 방식을 선택해 주세요.');
        result.day=row.day;result.startMonth=row.startMonth;result.endMonth=row.endMonth||'';result.paymentSource=row.paymentSource;
      }
      if (kind === 'cards') {
        if (!validDate(row.dueDate)) throw new Error('올바른 카드 결제일을 입력해 주세요.');
        if (typeof row.paid !== 'boolean') throw new Error('결제 상태를 확인해 주세요.');
        result.dueDate = row.dueDate; result.paid = row.paid;
      }
      if (kind === 'cashflow') {
        if (!Object.hasOwn(FLOW_LABELS,row.type)) throw new Error('월급·기타 수입·기타 지출 중 선택해 주세요.');
        if (!['once','monthly'].includes(row.repeat)) throw new Error('반복 여부를 선택해 주세요.');
        if (!validDate(row.date)) throw new Error('올바른 수입·지출 날짜를 입력해 주세요.');
        result.type=row.type; result.repeat=row.repeat; result.date=row.date;
        if(row.includeInForecast!==undefined&&typeof row.includeInForecast!=='boolean')throw new Error('예상 계산 반영 여부를 확인해 주세요.');
        result.includeInForecast=row.includeInForecast??true;
      }
      if (kind === 'retirement') {
        if (!validDate(row.asOf)) throw new Error('퇴직연금·퇴직금 기준일을 입력해 주세요.');
        result.asOf = row.asOf;
        const date=row.contributionDate??'';
        if(typeof date!=='string'||(date&&!validDate(date))||(result.monthlyContribution>0&&!validDate(date)))throw new Error('회사 월 납입액의 첫 납입 예정일을 입력해 주세요.');
        result.contributionDate=date;
      }
      if (kind === 'deposits') {
        if (row.maturity && !validDate(row.maturity)) throw new Error('만기일을 확인해 주세요.');
        result.maturity = row.maturity || '';
      }
      return result;
    });
    count += clean[kind].length;
  }
  if(input.cardAccounts!==undefined){
    if(!Array.isArray(input.cardAccounts)||input.cardAccounts.length>100)throw new Error('내 카드는 최대 100개까지 등록할 수 있습니다.');
    const ids=new Set();
    clean.cardAccounts=input.cardAccounts.map(row=>{
      if(!row||typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(row.id)||ids.has(row.id))throw new Error('내 카드 ID를 확인해 주세요.');ids.add(row.id);
      if(typeof row.name!=='string'||!row.name.trim()||row.name.length>100)throw new Error('카드 이름을 100자 이내로 입력해 주세요.');
      if(!Number.isInteger(row.day)||row.day<1||row.day>31)throw new Error('카드의 기본 결제일은 1~31일로 입력해 주세요.');
      if(row.note!==undefined&&(typeof row.note!=='string'||row.note.length>500))throw new Error('카드 메모는 500자 이내로 입력해 주세요.');
      if(row.archived!==undefined&&typeof row.archived!=='boolean')throw new Error('카드 보관 상태를 확인해 주세요.');
      return {id:row.id,name:row.name.trim(),day:row.day,note:row.note||'',archived:row.archived??false};
    });
  }
  const accountIds=new Set(clean.cardAccounts.map(row=>row.id)),bills=new Set();
  for(let index=0;index<clean.cards.length;index++){
    const accountId=input.cards[index].cardAccountId;
    if(accountId===undefined||accountId==='')continue;
    if(typeof accountId!=='string'||!accountIds.has(accountId))throw new Error('청구 내역에 연결한 내 카드를 확인해 주세요.');
    const key=accountId+':'+clean.cards[index].dueDate.slice(0,7);
    if(bills.has(key))throw new Error('같은 카드의 같은 결제 월에는 청구 내역을 한 건만 등록할 수 있습니다.');bills.add(key);
    clean.cards[index].cardAccountId=accountId;
  }
  count+=clean.cardAccounts.length;
  const validMoney=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000_000_000_000;
  for (const key of ['budgets','snapshots']) {
    if (input[key] === undefined) continue;
    if (!Array.isArray(input[key]) || input[key].length>240) throw new Error('월별 기록은 최대 240개월까지 저장할 수 있습니다.');
    const months=new Set();
    clean[key]=input[key].map(row=>{
      if (!row || !validMonth(row.month) || months.has(row.month)) throw new Error('월별 기록의 월을 확인해 주세요.');
      months.add(row.month);
      if (key==='budgets') {
        if (!validMoney(row.expenseLimit) || !validMoney(row.savingsTarget)) throw new Error('지출 한도와 저축 목표는 0 이상의 원 단위 정수로 입력해 주세요.');
        return {month:row.month,expenseLimit:row.expenseLimit,savingsTarget:row.savingsTarget};
      }
      if (!validDate(row.asOf) || row.asOf.slice(0,7)!==row.month || row.asOf>todayKST()) throw new Error('자산 기록의 기준일은 해당 월의 오늘 이전 날짜로 입력해 주세요.');
      if (!['auto','manual'].includes(row.source)) throw new Error('자산 기록의 구분을 확인해 주세요.');
      const result={month:row.month,asOf:row.asOf,source:row.source};
      for (const field of ['stock','deposits','retirement','loans','cards']) {
        if (!validMoney(row[field])) throw new Error('월말 자산 금액을 확인해 주세요.');
        result[field]=row[field];
      }
      if (row.note!=null && (typeof row.note!=='string'||row.note.length>500)) throw new Error('월말 메모는 500자 이내로 입력해 주세요.');
      result.note=row.note||'';return result;
    }).sort((a,b)=>a.month.localeCompare(b.month));
  }
  if (input.loanPayments !== undefined) {
    if (!Array.isArray(input.loanPayments) || input.loanPayments.length > 2000) throw new Error('대출 상환 기록은 최대 2,000건까지 저장할 수 있습니다.');
    const ids = new Set();
    clean.loanPayments = input.loanPayments.map(row => {
      if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id)) throw new Error('상환 기록 ID를 확인해 주세요.');
      ids.add(row.id);
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100 || typeof row.institution !== 'string' || !row.institution.trim() || row.institution.length > 100) throw new Error('대출명과 은행을 100자 이내로 입력해 주세요.');
      if (!validDate(row.date) || row.date > todayKST()) throw new Error('상환 기록은 오늘까지의 실제 상환일을 입력해 주세요.');
      if (!validMoney(row.principal) || !validMoney(row.interest) || row.principal + row.interest === 0) throw new Error('상환 원금과 이자를 확인해 주세요.');
      if (row.loanId != null && row.loanId !== '' && (typeof row.loanId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.loanId))) throw new Error('연결한 대출을 확인해 주세요.');
      if (row.note != null && (typeof row.note !== 'string' || row.note.length > 500)) throw new Error('상환 메모는 500자 이내로 입력해 주세요.');
      return {id:row.id,loanId:row.loanId||'',name:row.name.trim(),institution:row.institution.trim(),date:row.date,principal:row.principal,interest:row.interest,note:row.note||''};
    });
  }
  clean.dashboard=validateDashboard(input.dashboard);
  if (count > 2000) throw new Error('최대 2,000개 항목까지 저장할 수 있습니다.');
  return clean;
}
export function totals(data) {
  const sum = (kind, key, predicate = () => true) => data[kind].filter(predicate).reduce((v, row) => v + row[key], 0);
  const stock = sum('stocks', 'valuation'), cost = sum('stocks', 'cost');
  const deposits = sum('deposits', 'balance'), retirement = sum('retirement', 'amount');
  const loans = sum('loans', 'balance'), cards = sum('cards', 'amount', row => !row.paid);
  const gross = stock + deposits + retirement;
  return {stock, cost, deposits, retirement, loans, cards, gross, debt: loans + cards, net: gross - loans - cards, profit: stock - cost, profitRate: cost ? (stock - cost) / cost * 100 : null, monthlyPrincipal:data.loans.reduce((n,row)=>n+loanNextPayment(row).principal,0), monthlyInterest:data.loans.reduce((n,row)=>n+interestForLoan(row),0)};
}
export function paymentDate(month, day) {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
export function eventsForMonth(data, month) {
  return [
    ...loanEventsForMonth(data,month),
    ...data.cards.filter(row => row.dueDate.startsWith(month)).map(row => ({id: row.id, name: row.name, date: row.dueDate, amount: row.amount, type: 'cards', paid: row.paid})),
    ...fixedForMonth(data,month).filter(row=>row.paymentSource==='account').map(row=>({id:row.id,name:row.name,date:row.occursOn,amount:row.amount,type:'fixed',paid:false})),
    ...cashflowForMonth(data,month).map(row=>({id:row.id,name:row.name,date:row.occursOn,amount:row.amount,type:'cashflow',flowType:row.type,income:row.type!=='expense',paid:false}))
  ].sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
export function cashflowForMonth(data,month,includeExcluded=false) {
  return (data.cashflow || []).filter(row=>includeExcluded||row.includeInForecast!==false).filter(row=>row.repeat==='monthly'?row.date.slice(0,7)<=month:row.date.startsWith(month)).map(row=>({...row,occursOn:row.repeat==='monthly'?paymentDate(month,Number(row.date.slice(8))):row.date})).sort((a,b)=>a.occursOn.localeCompare(b.occursOn));
}
export function scheduledCashflows(data,date=todayKST(),range='upcoming') {
 return (data.cashflow||[]).filter(row=>row.repeat==='once'&&['other_income','expense'].includes(row.type)).filter(row=>range==='all'||(range==='past'?row.date<=date:row.date>date)).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}
export function retirementContributionsForMonth(data,month) {
 return (data.retirement||[]).filter(row=>(row.monthlyContribution||0)>0&&validDate(row.contributionDate)&&row.contributionDate.slice(0,7)<=month).map(row=>({id:row.id,name:row.name,amount:row.monthlyContribution,date:paymentDate(month,Number(row.contributionDate.slice(8)))}));
}
export function monthlyFlow(data,month) {
  const records=cashflowForMonth(data,month);
  const sum=type=>records.filter(row=>row.type===type).reduce((n,row)=>n+row.amount,0);
  const salary=sum('salary'),otherIncome=sum('other_income'),otherExpense=sum('expense');
  const payments=eventsForMonth(data,month).filter(row=>['loans','cards'].includes(row.type)&&!row.paid).reduce((n,row)=>n+row.amount,0);
  const fixed=fixedForMonth(data,month),fixedCash=fixed.filter(row=>row.paymentSource==='account').reduce((n,row)=>n+row.amount,0),fixedCard=fixed.filter(row=>row.paymentSource==='card').reduce((n,row)=>n+row.amount,0);
  const income=salary+otherIncome,expense=payments+otherExpense+fixedCash;
  return {salary,otherIncome,otherExpense,fixedCash,fixedCard,fixedTotal:fixedCash+fixedCard,payments,income,expense,balance:income-expense};
}
export function fixedForMonth(data,month) {
 return (data.fixed||[]).filter(row=>row.startMonth<=month&&(!row.endMonth||row.endMonth>=month)).map(row=>({...row,occursOn:paymentDate(month,row.day)})).sort((a,b)=>a.occursOn.localeCompare(b.occursOn));
}
export function estimatedMonthlyInterest(balance,rate) {return Math.round(balance*rate/1200);}
export function interestForLoan(loan,balance=loan.balance) {return balance<=0?0:loan.calculationMode==='term'||loan.interestMode==='estimate'?estimatedMonthlyInterest(balance,loan.rate):loan.interest;}
export function loanFirstPaymentDate(loan,asOf=null){
 if(loan.calculationMode!=='term')return null;
 if(!asOf||loan.nextPaymentDate>asOf)return loan.nextPaymentDate;
 const date=paymentDate(asOf.slice(0,7),loan.day);
 return date>asOf?date:paymentDate(shiftMonth(asOf.slice(0,7),1),loan.day);
}
export function createLoanState(loan,asOf=null){
 const term=loan.calculationMode==='term',count=term?loan.remainingMonths:0,grace=term?(loan.graceMonths||0):0,repayments=count-grace;
 const monthlyRate=loan.rate/1200;
 const principal=term?(loan.method==='만기일시'?0:Math.floor(loan.balance/repayments)):loan.principal;
 const scheduledPayment=term?(monthlyRate===0?Math.round(loan.balance/repayments):Math.round(loan.balance*monthlyRate/(-Math.expm1(-repayments*Math.log1p(monthlyRate))))):loan.principal+estimatedMonthlyInterest(loan.balance,loan.rate);
 return {...loan,graceMonths:loan.graceMonths??0,term,installments:0,firstPaymentDate:loanFirstPaymentDate(loan,asOf),principal,scheduledPayment};
}
export function loanPaymentForMonth(row,month,afterDate=null){
 const openingBalance=row.balance;
 let date=paymentDate(month,row.day),principal=0,interest=0,installment=null;
 const eligible=!row.term||month>=row.firstPaymentDate.slice(0,7);
 if(row.term&&month===row.firstPaymentDate.slice(0,7))date=row.firstPaymentDate;
 if(eligible&&row.balance>0&&(!afterDate||date>afterDate)&&(!row.term||row.installments<row.remainingMonths)){
  interest=estimatedMonthlyInterest(row.balance,row.rate);
  if(row.term){
   row.installments++;installment=row.installments;
   if(installment>row.graceMonths){
    const last=installment===row.remainingMonths;
    const planned=row.method==='원리금균등'?Math.max(0,row.scheduledPayment-interest):row.method==='만기일시'?0:row.principal;
    principal=last?row.balance:Math.min(row.balance,planned);
   }
  }else principal=Math.min(row.balance,row.method==='원리금균등'?Math.max(0,row.scheduledPayment-interest):row.principal);
  row.balance-=principal;
 }
 return {id:row.id,name:row.name,date,principal,interest,payment:principal+interest,openingBalance,balance:row.balance,interestMode:row.interestMode||'manual',installment,scheduled:eligible&&(!row.term||row.installments<=row.remainingMonths)};
}
export function loanNextPayment(loan,asOf=null){
 if(loan.calculationMode!=='term')return {principal:Math.min(loan.balance,loan.principal),interest:interestForLoan(loan),payment:Math.min(loan.balance,loan.principal)+interestForLoan(loan)};
 const state=createLoanState(loan,asOf),row=loanPaymentForMonth(state,state.firstPaymentDate.slice(0,7));
 return row;
}
export function loanSchedule(data,startMonth=todayKST().slice(0,7),count=12,afterDate=null) {
 const loans=data.loans.map(row=>createLoanState(row,afterDate)),months=[];
 for(let index=0;index<count;index++) {
  const month=shiftMonth(startMonth,index),details=loans.map(row=>loanPaymentForMonth(row,month,afterDate));
  months.push({month,principal:details.reduce((n,row)=>n+row.principal,0),interest:details.reduce((n,row)=>n+row.interest,0),payment:details.reduce((n,row)=>n+row.payment,0),balance:loans.reduce((n,row)=>n+row.balance,0),details});
 }
 return months;
}
export function loanPlanSummary(loan,asOf=todayKST()){
 const first=loanFirstPaymentDate(loan,asOf);
 if(loan.calculationMode!=='term')return {complete:false,next:loanNextPayment(loan),payoffDate:null,interest:null,payment:null};
 const state=createLoanState(loan,asOf),rows=[];
 for(let i=0;i<loan.remainingMonths;i++)rows.push(loanPaymentForMonth(state,shiftMonth(first.slice(0,7),i)));
 const payable=rows.filter(row=>row.payment>0||row.installment!==null),last=payable.at(-1);
 return {complete:true,next:rows[0],payoffDate:last?.date||null,interest:rows.reduce((n,row)=>n+row.interest,0),payment:rows.reduce((n,row)=>n+row.payment,0),principal:loan.balance-state.balance,rows,adjusted:first!==loan.nextPaymentDate};
}
function loanEventsForMonth(data,month){
 const today=todayKST(),current=today.slice(0,7),distance=(Number(month.slice(0,4))-Number(current.slice(0,4)))*12+Number(month.slice(5,7))-Number(current.slice(5,7));
 return data.loans.flatMap(loan=>{
  if(loan.calculationMode!=='term')return loan.balance>0&&loan.principal+interestForLoan(loan)>0?[{id:loan.id,name:loan.name,date:paymentDate(month,loan.day),amount:Math.min(loan.balance,loan.principal)+interestForLoan(loan),type:'loans',paid:false}]:[];
  // Term-based calendar, budget and projections use the same future amortization schedule.
  const start=distance>=0?current:loan.nextPaymentDate.slice(0,7),count=distance>=0?distance+1:1;
  if(distance<0&&month!==start||count>120)return [];
  const row=loanSchedule({loans:[loan]},start,count,distance>=0?today:null).at(-1).details[0];
  return row.payment>0?[{id:loan.id,name:loan.name,date:row.date,amount:row.payment,type:'loans',paid:false}]:[];
 });
}
export function validMonth(month) { return typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0,4))>=1900 && Number(month.slice(0,4))<=2199; }
export function shiftMonth(month,offset) {
  const [year,m]=month.split('-').map(Number);
  return new Date(Date.UTC(year,m-1+offset,1)).toISOString().slice(0,7);
}
export function snapshotTotals(row) {
  const gross=row.stock+row.deposits+row.retirement,debt=row.loans+row.cards;
  return {...row,gross,debt,net:gross-debt};
}
export function captureSnapshot(data,date=todayKST(),source='auto') {
  const t=totals(data);
  return {month:date.slice(0,7),asOf:date,source,stock:t.stock,deposits:t.deposits,retirement:t.retirement,loans:t.loans,cards:t.cards,note:''};
}
export function recordCurrentSnapshot(data,date=todayKST()) {
  const result=structuredClone(data),current=result.snapshots.find(row=>row.month===date.slice(0,7));
  if (current?.source==='manual' || !['stocks','deposits','retirement','loans'].some(key=>result[key].length)) return result;
  const snapshot=captureSnapshot(result,date);
  if(current)result.snapshots=result.snapshots.map(row=>row.month===snapshot.month?snapshot:row);
  else if(result.snapshots.length<240)result.snapshots.push(snapshot);
  result.snapshots.sort((a,b)=>a.month.localeCompare(b.month));return result;
}
export function budgetPlan(data,month) {
  const flow=monthlyFlow(data,month);
  const paidCards=data.cards.filter(row=>row.paid&&row.dueDate.startsWith(month)).reduce((n,row)=>n+row.amount,0);
  const expense=flow.expense+paidCards,budget=(data.budgets||[]).find(row=>row.month===month);
  return {...flow,expense,balance:flow.income-expense,limit:budget?.expenseLimit??null,target:budget?.savingsTarget??null,remaining:budget?budget.expenseLimit-expense:null};
}
export function forecastOnDates(data,targetDates,startDate=todayKST()) {
 if(!validDate(startDate)||!Array.isArray(targetDates)||targetDates.some(date=>!validDate(date)||date<startDate))throw new Error('예상 기준일과 조회 날짜를 확인해 주세요.');
 const dates=[...new Set(targetDates)].sort();if(!dates.length)return [];
 const firstMonth=startDate.slice(0,7),lastMonth=dates.at(-1).slice(0,7);
 const monthCount=(Number(lastMonth.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(lastMonth.slice(5))-Number(firstMonth.slice(5))+1;
 if(monthCount>120)throw new Error('예상 기간은 10년 이내로 선택해 주세요.');
 const loanMonths=loanSchedule(data,firstMonth,monthCount,startDate),events=[];
 for(let index=0;index<monthCount;index++) {
  const month=shiftMonth(firstMonth,index);
  for(const row of cashflowForMonth(data,month))if(row.occursOn>startDate)events.push({date:row.occursOn,name:row.name,kind:row.type,amount:row.amount,income:row.type!=='expense'});
  for(const row of fixedForMonth(data,month))if(row.paymentSource==='account'&&row.occursOn>startDate)events.push({date:row.occursOn,name:row.name,kind:'fixed',amount:row.amount,income:false});
  for(const row of loanMonths[index].details)if(row.date>startDate&&row.payment>0)events.push({date:row.date,name:row.name,kind:'loan',amount:row.payment,income:false,principal:row.principal,interest:row.interest});
  for(const row of retirementContributionsForMonth(data,month))if(row.date>startDate)events.push({...row,kind:'retirement',income:false});
 }
 for(const row of data.cards)if(!row.paid&&row.dueDate>startDate&&row.dueDate<=dates.at(-1))events.push({date:row.dueDate,name:row.name,kind:'card',amount:row.amount,income:false});
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 const baseline=totals(data),sums={income:0,expense:0,principal:0,interest:0,otherExpense:0,fixedCash:0,cardPayments:0,retirementContribution:0};
 let deposits=baseline.deposits,retirement=baseline.retirement,loanDebt=baseline.loans,cardDebt=baseline.cards,pointer=0,previous={...sums};
 return dates.map(date=>{
  while(pointer<events.length&&events[pointer].date<=date){
   const event=events[pointer++];
   if(event.kind==='retirement'){retirement+=event.amount;sums.retirementContribution+=event.amount;continue;}
   if(event.income){deposits+=event.amount;sums.income+=event.amount;}
   else {deposits-=event.amount;sums.expense+=event.amount;}
   if(event.kind==='loan'){loanDebt-=event.principal;sums.principal+=event.principal;sums.interest+=event.interest;}
   if(event.kind==='card'){cardDebt-=event.amount;sums.cardPayments+=event.amount;}
   if(event.kind==='fixed')sums.fixedCash+=event.amount;
   if(event.kind==='expense')sums.otherExpense+=event.amount;
  }
  const period=Object.fromEntries(Object.keys(sums).map(key=>[key,sums[key]-previous[key]]));previous={...sums};
  const gross=baseline.stock+retirement+deposits,debt=loanDebt+cardDebt;
  return {...period,date,month:date.slice(0,7),deposits,retirement,loans:loanDebt,cards:cardDebt,gross,debt,net:gross-debt,cashShortage:deposits<0,cumulativeIncome:sums.income,cumulativeExpense:sums.expense,cumulativePrincipal:sums.principal,cumulativeInterest:sums.interest,cumulativeRetirementContribution:sums.retirementContribution,dayEvents:events.filter(event=>event.date===date&&event.kind!=='retirement'),retirementEvents:events.filter(event=>event.date===date&&event.kind==='retirement')};
 });
}
export function forecastMonths(data,startDate=todayKST(),count=12) {
 const dates=Array.from({length:count},(_,index)=>paymentDate(shiftMonth(startDate.slice(0,7),index),31));
 return forecastOnDates(data,dates,startDate);
}
export function paydayForecasts(data,startDate=todayKST(),count=12,salaryId='all') {
 if(!validDate(startDate))throw new Error('월급 예상 기준일을 확인해 주세요.');
 const lastDate=paymentDate(shiftMonth(startDate.slice(0,7),12),Number(startDate.slice(8))),salaryDays=new Set();
 for(let index=0;index<=12;index++)for(const row of cashflowForMonth(data,shiftMonth(startDate.slice(0,7),index))) {
  if(row.type==='salary'&&(salaryId==='all'||row.id===salaryId)&&row.occursOn>startDate&&row.occursOn<=lastDate)salaryDays.add(row.occursOn);
 }
 const dates=[...salaryDays].sort().slice(0,count);if(!dates.length)return [];
 const previousDay=date=>new Date(new Date(date+'T00:00:00Z').getTime()-86400000).toISOString().slice(0,10);
 const projections=forecastOnDates(data,dates.flatMap(date=>[previousDay(date),date]),startDate),byDate=new Map(projections.map(row=>[row.date,row]));
 return dates.map(date=>{
  const row=byDate.get(date),previous=byDate.get(previousDay(date));
  const salaryEvents=row.dayEvents.filter(event=>event.kind==='salary');
  return {...row,salaryAmount:salaryEvents.reduce((n,event)=>n+event.amount,0),salaryNames:salaryEvents.map(event=>event.name),previousDayDeposits:previous.deposits,previousDayNet:previous.net};
 });
}

export function samplePortfolio(date = todayKST()) {
  const month = date.slice(0,7);
  const sample={version:1,
    stocks:[{id:'demo-s1',name:'국내 주식',institution:'미래에셋증권',valuation:28650000,cost:25000000,note:'예시 데이터입니다.'},{id:'demo-s2',name:'미국 ETF',institution:'토스증권',valuation:19200000,cost:18000000,note:'원화 환산 평가액'}],
    loans:[{id:'demo-l1',name:'주택담보대출',institution:'신한은행',balance:62000000,principal:320000,interest:217000,rate:4.2,day:25,method:'원리금균등',note:''},{id:'demo-l2',name:'신용대출',institution:'카카오뱅크',balance:8000000,principal:150000,interest:34000,rate:5.1,day:20,method:'원금균등',note:''}],
    retirement:[{id:'demo-r1',name:'퇴직연금 DC',institution:'삼성생명',amount:34800000,asOf:date,note:'예상 평가액'}],
    deposits:[{id:'demo-d1',name:'생활비 통장',institution:'토스뱅크',balance:8400000,rate:2,maturity:'',note:''},{id:'demo-d2',name:'정기예금',institution:'우리은행',balance:40000000,rate:3.5,maturity:`${Number(date.slice(0,4))+1}-05-20`,note:''}],
    cards:[{id:'demo-c1',name:'현대카드',amount:854000,dueDate:paymentDate(month,25),paid:false,note:''},{id:'demo-c2',name:'삼성카드',amount:326000,dueDate:paymentDate(month,20),paid:false,note:''}],
    cashflow:[{id:'demo-f1',name:'회사 월급',type:'salary',amount:4200000,date:paymentDate(month,25),repeat:'monthly',note:'실수령액 기준 예시'},{id:'demo-f2',name:'부업 수입',type:'other_income',amount:450000,date:paymentDate(month,15),repeat:'once',note:''},{id:'demo-f3',name:'월세',type:'expense',amount:600000,date:paymentDate(month,5),repeat:'monthly',note:'계좌이체로 납부'}]
  };
  sample.fixed=[{id:'demo-fixed1',name:'통신비',amount:65000,day:15,startMonth:month,endMonth:'',paymentSource:'card',note:'등록된 카드 결제대금에 포함된 예시'}];
  sample.budgets=Array.from({length:4},(_,i)=>({month:shiftMonth(month,i),expenseLimit:3000000,savingsTarget:1800000}));
  sample.snapshots=Array.from({length:4},(_,i)=>{const m=shiftMonth(month,i-4);return {month:m,asOf:paymentDate(m,31),source:'manual',stock:47850000-(4-i)*1200000,deposits:48400000-(4-i)*800000,retirement:34800000-(4-i)*400000,loans:70000000+(4-i)*470000,cards:1180000,note:'가상 예시 기록'};});
  return sample;
}

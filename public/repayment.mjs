import {todayKST, validDate, totals, cashflowForMonth, fixedForMonth, paymentDate, shiftMonth, estimatedMonthlyInterest, retirementContributionsForMonth, createLoanState, loanPaymentForMonth} from './domain.mjs';

export function repaymentScenarios(data, options = {}) {
  const asOf=options.asOf||todayKST(), months=Number(options.months??12);
  if(!validDate(asOf)||![12,24,36].includes(months))throw new Error('비교 기간을 확인해 주세요.');
  const budget={monthlyExtra:Number(options.monthlyExtra??0),lumpSum:Number(options.lumpSum??0),reserve:Number(options.reserve??0)};
  for(const value of Object.values(budget))if(!Number.isSafeInteger(value)||value<0||value>1_000_000_000_000_000)throw new Error('추가 상환액과 유지할 예금을 확인해 주세요.');
  const baseline=simulateRepayment(data,{...budget,monthlyExtra:0,lumpSum:0,asOf,months,strategy:'rate'});
  const rate=simulateRepayment(data,{...budget,asOf,months,strategy:'rate'});
  const balance=simulateRepayment(data,{...budget,asOf,months,strategy:'balance'});
  for(const plan of [rate,balance]){
    plan.interestSaved=baseline.totalInterest-plan.totalInterest;
    plan.netGain=plan.rows.at(-1).net-baseline.rows.at(-1).net;
  }
  return {asOf,options:{...budget,months},baseline,rate,balance};
}
function simulateRepayment(data,{monthlyExtra,lumpSum,reserve,asOf,months,strategy}) {
  const opening=totals(data);
  const loans=data.loans.map(loan=>createLoanState(loan,asOf));
  let deposits=opening.deposits,retirement=opening.retirement,cards=opening.cards,totalInterest=0,totalExtra=0,payoffDate=null;
  const extraByLoan=new Map(),rows=[];
  const applyExtra = requested => {
    let available=Math.min(requested,Math.max(0,deposits-reserve)),used=0;
    const order=loans.filter(loan=>loan.balance>0).sort((a,b)=>strategy==='balance'?a.balance-b.balance||b.rate-a.rate:b.rate-a.rate||a.balance-b.balance);
    for(const loan of order){const amount=Math.min(available,loan.balance);if(amount<=0)break;loan.balance-=amount;deposits-=amount;available-=amount;used+=amount;extraByLoan.set(loan.id,(extraByLoan.get(loan.id)||0)+amount);}
    totalExtra+=used;return used;
  };
  const upfrontUsed=applyExtra(lumpSum);
  if(loans.length&&loans.every(loan=>loan.balance===0))payoffDate=asOf;
  for(let index=0;index<months;index++) {
    const month=shiftMonth(asOf.slice(0,7),index),end=paymentDate(month,31),events=[];
    let interest=0,principal=0,income=0,expense=0;
    for(const row of cashflowForMonth(data,month))if(row.occursOn>asOf)events.push({date:row.occursOn,kind:row.type==='expense'?'expense':'income',amount:row.amount});
    for(const row of fixedForMonth(data,month))if(row.paymentSource==='account'&&row.occursOn>asOf)events.push({date:row.occursOn,kind:'expense',amount:row.amount});
    for(const row of data.cards)if(!row.paid&&row.dueDate.startsWith(month)&&row.dueDate>asOf)events.push({date:row.dueDate,kind:'card',amount:row.amount});
    for(const loan of loans){const date=loan.term&&month===loan.firstPaymentDate.slice(0,7)?loan.firstPaymentDate:paymentDate(month,loan.day);if(date>asOf&&(!loan.term||date>=loan.firstPaymentDate))events.push({date,kind:'loan',loan});}
    events.sort((a,b)=>a.date.localeCompare(b.date));
    for(const event of events){
      if(event.kind==='income'){deposits+=event.amount;income+=event.amount;continue;}
      if(event.kind==='loan'){
        const loan=event.loan;if(loan.balance<=0)continue;
        const payment=loanPaymentForMonth(loan,month,asOf),fee=payment.interest,repaid=payment.principal;
        deposits-=repaid+fee;interest+=fee;principal+=repaid;expense+=repaid+fee;
        if(!payoffDate&&loans.every(row=>row.balance===0))payoffDate=event.date;
      }else{deposits-=event.amount;expense+=event.amount;if(event.kind==='card')cards-=event.amount;}
    }
    const extra=applyExtra(monthlyExtra);
    if(!payoffDate&&loans.length&&loans.every(loan=>loan.balance===0))payoffDate=end;
    totalInterest+=interest;
    const retirementContribution=retirementContributionsForMonth(data,month).filter(row=>row.date>asOf).reduce((sum,row)=>sum+row.amount,0);retirement+=retirementContribution;
    const loanBalance=loans.reduce((sum,loan)=>sum+loan.balance,0),gross=opening.stock+retirement+deposits,debt=loanBalance+cards;
    rows.push({date:end,month,deposits,retirement,retirementContribution,loans:loanBalance,cards,gross,debt,net:gross-debt,interest,principal,income,expense:expense+extra+(index===0?upfrontUsed:0),extra:extra+(index===0?upfrontUsed:0),totalInterest,totalExtra,cashShortage:deposits<0});
  }
  const order=data.loans.filter(loan=>loan.balance>0).sort((a,b)=>strategy==='balance'?a.balance-b.balance||b.rate-a.rate:b.rate-a.rate||a.balance-b.balance);
  return {strategy,rows,totalInterest,totalExtra,upfrontUsed,payoffDate,order:order.map(loan=>({id:loan.id,name:loan.name,institution:loan.institution,rate:loan.rate,balance:loan.balance,extra:extraByLoan.get(loan.id)||0})),interestSaved:0,netGain:0};
}

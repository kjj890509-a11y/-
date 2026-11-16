export const KINDS = ['stocks', 'loans', 'retirement', 'deposits', 'cards'];
export const LABELS = { stocks: '주식', loans: '대출', retirement: '퇴직금', deposits: '예금', cards: '카드' };
export const emptyPortfolio = () => ({ version: 1, stocks: [], loans: [], retirement: [], deposits: [], cards: [] });
export function todayKST(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const moneyFields = { stocks: ['valuation', 'cost'], loans: ['balance', 'principal', 'interest'], retirement: ['amount'], deposits: ['balance'], cards: ['amount'] };
const textFields = { stocks: ['institution', 'note'], loans: ['institution', 'method', 'note'], retirement: ['institution', 'note'], deposits: ['institution', 'note'], cards: ['note'] };
export function validatePortfolio(input) {
  if (!input || input.version !== 1 || typeof input !== 'object') throw new Error('지원하지 않는 백업 형식입니다.');
  const clean = emptyPortfolio();
  let count = 0;
  for (const kind of KINDS) {
    if (!Array.isArray(input[kind])) throw new Error('자산 목록 형식을 확인해 주세요.');
    const ids = new Set();
    clean[kind] = input[kind].map(row => {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id)) throw new Error('항목 ID를 확인해 주세요.');
      ids.add(row.id);
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100) throw new Error('항목 이름을 100자 이내로 입력해 주세요.');
      const result = {id: row.id, name: row.name.trim()};
      for (const key of moneyFields[kind]) {
        if (!Number.isSafeInteger(row[key]) || row[key] < 0 || row[key] > 1_000_000_000_000_000) throw new Error('금액은 0 이상의 정수(원)로 입력해 주세요.');
        result[key] = row[key];
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
      }
      if (kind === 'cards') {
        if (!validDate(row.dueDate)) throw new Error('올바른 카드 결제일을 입력해 주세요.');
        if (typeof row.paid !== 'boolean') throw new Error('결제 상태를 확인해 주세요.');
        result.dueDate = row.dueDate; result.paid = row.paid;
      }
      if (kind === 'retirement') {
        if (!validDate(row.asOf)) throw new Error('퇴직금 기준일을 입력해 주세요.');
        result.asOf = row.asOf;
      }
      if (kind === 'deposits') {
        if (row.maturity && !validDate(row.maturity)) throw new Error('만기일을 확인해 주세요.');
        result.maturity = row.maturity || '';
      }
      return result;
    });
    count += clean[kind].length;
  }
  if (count > 2000) throw new Error('최대 2,000개 항목까지 저장할 수 있습니다.');
  return clean;
}
export function totals(data) {
  const sum = (kind, key, predicate = () => true) => data[kind].filter(predicate).reduce((v, row) => v + row[key], 0);
  const stock = sum('stocks', 'valuation'), cost = sum('stocks', 'cost');
  const deposits = sum('deposits', 'balance'), retirement = sum('retirement', 'amount');
  const loans = sum('loans', 'balance'), cards = sum('cards', 'amount', row => !row.paid);
  const gross = stock + deposits + retirement;
  return {stock, cost, deposits, retirement, loans, cards, gross, debt: loans + cards, net: gross - loans - cards, profit: stock - cost, profitRate: cost ? (stock - cost) / cost * 100 : null, monthlyPrincipal: sum('loans', 'principal'), monthlyInterest: sum('loans', 'interest')};
}
export function paymentDate(month, day) {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
export function eventsForMonth(data, month) {
  return [
    ...data.loans.filter(row => row.balance > 0 && row.principal + row.interest > 0).map(row => ({id: row.id, name: row.name, date: paymentDate(month, row.day), amount: row.principal + row.interest, type: 'loans', paid: false})),
    ...data.cards.filter(row => row.dueDate.startsWith(month)).map(row => ({id: row.id, name: row.name, date: row.dueDate, amount: row.amount, type: 'cards', paid: row.paid}))
  ].sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
export function samplePortfolio(date = todayKST()) {
  const month = date.slice(0,7);
  return {version:1,
    stocks:[{id:'demo-s1',name:'국내 주식',institution:'미래에셋증권',valuation:28650000,cost:25000000,note:'예시 데이터입니다.'},{id:'demo-s2',name:'미국 ETF',institution:'토스증권',valuation:19200000,cost:18000000,note:'원화 환산 평가액'}],
    loans:[{id:'demo-l1',name:'주택담보대출',institution:'신한은행',balance:62000000,principal:320000,interest:217000,rate:4.2,day:25,method:'원리금균등',note:''},{id:'demo-l2',name:'신용대출',institution:'카카오뱅크',balance:8000000,principal:150000,interest:34000,rate:5.1,day:20,method:'원금균등',note:''}],
    retirement:[{id:'demo-r1',name:'퇴직연금 DC',institution:'삼성생명',amount:34800000,asOf:date,note:'예상 평가액'}],
    deposits:[{id:'demo-d1',name:'생활비 통장',institution:'토스뱅크',balance:8400000,rate:2,maturity:'',note:''},{id:'demo-d2',name:'정기예금',institution:'우리은행',balance:40000000,rate:3.5,maturity:`${Number(date.slice(0,4))+1}-05-20`,note:''}],
    cards:[{id:'demo-c1',name:'현대카드',amount:854000,dueDate:paymentDate(month,25),paid:false,note:''},{id:'demo-c2',name:'삼성카드',amount:326000,dueDate:paymentDate(month,20),paid:false,note:''}]
  };
}

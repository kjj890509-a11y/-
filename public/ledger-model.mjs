import {KINDS,todayKST,paymentDate} from './domain.mjs';
export const ledgerKinds=[...KINDS,'all','planned'];
export const ledgerLabels={stocks:'주식·투자',loans:'대출',retirement:'퇴직금·연금',deposits:'예금·현금',cards:'카드 청구',cashflow:'수입·지출',fixed:'정기 지출',all:'전체 내역',planned:'예정 거래'};
export const ledgerColumns={
 stocks:[['name','계좌·종목명'],['cost','매입금액'],['valuation','평가액'],['profit','평가손익']],
 deposits:[['name','예금명'],['institution','금융기관'],['balance','잔액'],['rate','연 이율'],['date','만기일']],
 retirement:[['name','퇴직금·연금'],['institution','기관·회사'],['amount','현재 금액'],['monthlyContribution','회사 월 납입액'],['date','기준일']],
 loans:[['name','대출명'],['balance','잔액'],['rate','연 이율'],['principal','월 원금'],['interest','이번 이자'],['payment','상환액'],['date','상환일']],
 cards:[['name','카드사·카드명'],['amount','청구액'],['date','결제일'],['status','결제 상태']],
 cashflow:[['name','항목명'],['type','구분'],['amount','금액'],['date','입출금일'],['repeat','반복']],
 fixed:[['name','고정지출명'],['amount','월 금액'],['date','납부일'],['period','적용 기간'],['paymentSource','결제 방식']],
 all:[['name','항목명'],['kind','카테고리'],['institution','금융기관'],['amount','금액'],['date','관련 일자'],['status','상태']],
 planned:[['date','예정일'],['name','항목명·메모'],['type','구분'],['amount','금액'],['status','예상 반영']]
};
export const defaultLedgerState=()=>({query:'',category:'all',status:'all',institution:'',type:'',repeat:'',start:'',end:'',min:'',max:'',sort:'newest',page:1,pageSize:20,selected:[],columns:[],hidden:[],widths:{},density:'comfortable',savedViews:[],viewName:'',error:''});
export function ledgerEntries(data,scope,month=todayKST().slice(0,7)){
 const kinds=scope==='all'?KINDS:scope==='planned'?['cashflow']:[scope];
 return kinds.flatMap(kind=>(data[kind]||[]).map((row,index)=>({row,kind,index,key:kind+':'+row.id,amount:kind==='stocks'?row.valuation:kind==='deposits'||kind==='loans'?row.balance:row.amount||0,date:kind==='cards'?row.dueDate:kind==='cashflow'?(row.occursOn||row.date):kind==='retirement'?row.asOf:kind==='deposits'?row.maturity:kind==='fixed'?paymentDate(month,row.day):kind==='loans'?row.nextPaymentDate||paymentDate(month,row.day):''}))).filter(entry=>scope!=='planned'||entry.row.repeat==='once'&&entry.row.type!=='salary');
}
export function ledgerStatus(entry,today=todayKST()){
 const {row,kind}=entry;
 if(kind==='cards')return row.paid?'paid':row.dueDate<today?'overdue':'unpaid';
 if(kind==='loans')return row.balance>0?'active':'settled';
 if(kind==='cashflow')return row.includeInForecast===false?'excluded':'included';
 if(kind==='deposits')return !row.maturity?'liquid':row.maturity<today?'matured':'term';
 if(kind==='stocks')return row.valuation>row.cost?'gain':row.valuation<row.cost?'loss':'flat';
 if(kind==='retirement')return row.monthlyContribution>0?'contributing':'fixed';
 return row.paymentSource==='card'?'card':'account';
}
export const statusLabels={paid:'결제 완료',overdue:'결제일 경과',unpaid:'미결제',active:'상환 중',settled:'상환 완료',excluded:'예상 제외',included:'예상 반영',liquid:'만기 없음',matured:'만기 경과',term:'만기 예정',gain:'평가이익',loss:'평가손실',flat:'보합',contributing:'월 납입 있음',fixed:'월 납입 없음',card:'카드 결제',account:'계좌 결제'};
export function ledgerQuery(entries,state,today=todayKST()){
 const q=state.query.normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
 const rows=entries.filter(entry=>{
  const {row,kind,date,amount}=entry;
  return (state.category==='all'||kind===state.category)&&(state.status==='all'||ledgerStatus(entry,today)===state.status)&&(!state.institution||(row.institution||'미등록')===state.institution)&&(!state.type||row.type===state.type||row.paymentSource===state.type||row.method===state.type)&&(!state.repeat||row.repeat===state.repeat)&&(!q||[row.name,row.institution,row.note].join(' ').normalize('NFKC').toLocaleLowerCase('ko-KR').includes(q))&&(!state.start||date&&date>=state.start)&&(!state.end||date&&date<=state.end)&&(state.min===''||amount>=Number(state.min))&&(state.max===''||amount<=Number(state.max));
 });
 const value=(entry,key)=>key==='date'?entry.date:key==='amount'?entry.amount:key==='profit'?entry.row.valuation-entry.row.cost:key==='payment'?entry.row.principal+entry.row.interest:entry.row[key]??'';
 const order=state.sort||'newest';
 rows.sort((a,b)=>{
  if(order==='newest'||order==='oldest')return order==='newest'?b.index-a.index:a.index-b.index;
  const [key,direction]=order.split(':');const va=value(a,key),vb=value(b,key);
  if(va===''||va===undefined)return vb===''?0:1;if(vb===''||vb===undefined)return -1;
  return (typeof va==='number'?va-vb:String(va).localeCompare(String(vb),'ko-KR'))*(direction==='desc'?-1:1);
 });
 return rows;
}
export function ledgerPage(entries,state){const pages=Math.max(1,Math.ceil(entries.length/state.pageSize)),page=Math.min(pages,Math.max(1,state.page));return {page,pages,rows:entries.slice((page-1)*state.pageSize,page*state.pageSize)};}
export function ledgerLayout(scope,state){const defined=ledgerColumns[scope].map(([key])=>key);return [...state.columns.filter(key=>defined.includes(key)),...defined.filter(key=>!state.columns.includes(key))].filter(key=>!state.hidden.includes(key));}
export function validateLedgerPreferences(input){
 if(!input||input.version!==1||!input.tables||typeof input.tables!=='object'||Array.isArray(input.tables))throw new Error('보기 설정 형식을 확인해 주세요.');
 const tables={};
 for(const scope of ledgerKinds){
  const item=input.tables[scope];if(item===undefined)continue;
  const columns=ledgerColumns[scope].map(([key])=>key);
  const list=value=>{if(!Array.isArray(value)||value.length>columns.length||new Set(value).size!==value.length||value.some(key=>!columns.includes(key)))throw new Error('열 설정을 확인해 주세요.');return value;};
  const hidden=list(item.hidden||[]);if(hidden.length>=columns.length)throw new Error('최소 한 개의 열을 표시해 주세요.');
  const widths={};for(const key of columns)if(item.widths?.[key]!==undefined){const w=item.widths[key];if(!Number.isInteger(w)||w<90||w>600)throw new Error('열 너비를 확인해 주세요.');widths[key]=w;}
  if(![20,50,100].includes(item.pageSize)||!['compact','comfortable'].includes(item.density)||!Array.isArray(item.savedViews)||item.savedViews.length>12)throw new Error('보기 설정을 확인해 주세요.');
  const ids=new Set();
  const savedViews=item.savedViews.map(view=>{
   if(!view||typeof view.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(view.id)||ids.has(view.id)||typeof view.name!=='string'||!view.name.trim()||view.name.length>60)throw new Error('저장된 보기 이름을 확인해 주세요.');ids.add(view.id);
   const filters={};for(const [key,max]of [['query',200],['category',20],['status',30],['institution',500],['type',100],['repeat',20],['start',10],['end',10],['min',16],['max',16],['sort',50]]){const v=view.filters?.[key];if(typeof v!=='string'||v.length>max)throw new Error('저장된 필터를 확인해 주세요.');filters[key]=v;}
   if(!['all',...KINDS].includes(filters.category)||!['all',...Object.keys(statusLabels)].includes(filters.status)||!['newest','oldest','amount:asc','amount:desc','date:asc','date:desc',...ledgerColumns[scope].flatMap(([key])=>[key+':asc',key+':desc'])].includes(filters.sort)||!['','once','monthly'].includes(filters.repeat)||[filters.min,filters.max].some(v=>v!==''&&(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))))||[filters.start,filters.end].some(v=>v!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(v))||filters.start&&filters.end&&filters.start>filters.end||filters.min!==''&&filters.max!==''&&Number(filters.min)>Number(filters.max))throw new Error('필터 범위를 확인해 주세요.');
   const layout=validateLedgerPreferences({version:1,tables:{[scope]:{...(view.layout||item),savedViews:[]}}}).tables[scope];
   return {id:view.id,name:view.name.trim(),filters,layout:Object.fromEntries(['columns','hidden','widths','density','pageSize'].map(key=>[key,layout[key]]))};
  });
  tables[scope]={columns:list(item.columns||[]),hidden,widths,pageSize:item.pageSize,density:item.density,savedViews};
 }
 return {version:1,tables};
}

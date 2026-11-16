import {KINDS, LABELS, emptyPortfolio, todayKST, validatePortfolio, totals, eventsForMonth, samplePortfolio} from '/domain.mjs';
const icons = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  stocks:'<path d="m3 16 6-6 4 4 8-10M15 4h6v6"/><path d="M3 21h18"/>',
  loans:'<path d="m3 9 9-6 9 6M4 10h16M5 20h14M7 10v7m5-7v7m5-7v7M3 21h18"/>',
  retirement:'<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 12h16m-10 0v3h4v-3"/>',
  deposits:'<path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14v4M3 8h15a2 2 0 0 1 2 2v2"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>',
  cards:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
  schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="m3 3 18 18M10.5 5.1A14 14 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3.2 4.2M6.6 6.6A18 18 0 0 0 2 12s3 7 10 7a13 13 0 0 0 5.4-1.2M10 10a3 3 0 0 0 4 4"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/>',
  delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const escapeHTML = val => String(val ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const wonFormat = new Intl.NumberFormat('ko-KR');
let portfolio = emptyPortfolio(), revision = 0, demo = false, realData = null, realRevision = 0, loading = true, saving = false;
let hidden = localStorage.getItem('moa-hide-amounts') === 'true';
let view = 'overview', month = todayKST().slice(0,7), query = '', editorKind, editingId;
const navLabels = {overview:'한눈에 보기',stocks:'주식 잔고',loans:'대출 관리',retirement:'퇴직금',deposits:'예금',cards:'카드 결제',schedule:'결제 캘린더'};
function money(value, unit = '원') { return hidden ? '••••••' : `${wonFormat.format(value)}${unit}`; }
function compact(value) { if(hidden)return '••••'; if(Math.abs(value)>=1e8)return `${(value/1e8).toFixed(2)}억`; if(Math.abs(value)>=1e4)return `${wonFormat.format(Math.round(value/1e4))}만`;return wonFormat.format(value); }
function percent(value){return hidden?'••%':`${value>0?'+':''}${value.toFixed(2)}%`;}
const rowsCount = () => KINDS.reduce((n,k)=>n+portfolio[k].length,0);
const status = (label,error=false) => {$('save-state').innerHTML=`<i style="background:${error?'#c48365':'#7da367'}"></i>${escapeHTML(label)}`;};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function openDialog(id){$(id).showModal();}
function confirmAction(title,body,label='삭제하기'){
  $('confirm-title').textContent=title;$('confirm-body').textContent=body;$('confirm-ok').textContent=label;openDialog('confirm-dialog');
  return new Promise(resolve=>{
    const end=value=>{ $('confirm-dialog').close();$('confirm-ok').onclick=null;$('confirm-cancel').onclick=null;$('confirm-dialog').oncancel=null;resolve(value);};
    $('confirm-ok').onclick=()=>end(true);$('confirm-cancel').onclick=()=>end(false);$('confirm-dialog').oncancel=e=>{e.preventDefault();end(false);};
  });
}
async function loadData(){
  loading=true;status('불러오는 중');
  try{
    const res=await fetch('/api/portfolio');const data=await res.json();
    if(!res.ok)throw new Error(data.error||'내역을 불러오지 못했습니다.');
    portfolio=validatePortfolio(data.data);revision=data.revision;loading=false;status('서버 저장됨');render();
  }catch(error){loading=false;status('연결 필요',true);$('main').innerHTML=`<div class="error-state"><span class="eyebrow">MY ASSET NOTE</span><h1>자산 노트에 연결해 주세요</h1><p>${escapeHTML(error.message)}</p><button class="button primary" data-action="retry">다시 시도</button> <a class="button secondary" href="/signin-with-chatgpt?return_to=/" target="_top">로그인하기</a><p style="margin-top:24px;font-size:11px">먼저 둘러보고 싶다면 예시 화면을 열어보세요.</p><button class="button secondary" data-action="demo">예시로 둘러보기 ↗</button></div>`;renderNav();}
}
async function persist(next){
  if(saving)throw new Error('저장 중입니다. 잠시만 기다려 주세요.');
  next=validatePortfolio(next);
  if(demo) {portfolio=next;render();status('예시 보기 중');return;}
  saving=true;status('저장하는 중');
  try{
    const res=await fetch('/api/portfolio',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'저장하지 못했습니다.');
    portfolio=validatePortfolio(data.data);revision=data.revision;status('서버 저장됨');render();
  }catch(error){status('저장 실패',true);throw error;}finally{saving=false;}
}
function renderNav(){
  $('main-nav').innerHTML=Object.entries(navLabels).map(([key,label],i)=>`${i===1?'<div class="nav-divider"></div><span class="nav-label">자산 관리</span>':''}${key==='schedule'?'<div class="nav-divider"></div>':''}<a href="#${key}" class="nav-link ${view===key?'active':''}" ${view===key?'aria-current="page"':''}>${svg(key)}<span>${label}</span>${KINDS.includes(key)?`<span class="nav-count">${portfolio[key].length || ''}</span>`:''}</a>`).join('');
  $('breadcrumb').textContent=navLabels[view];
  $('privacy-toggle').innerHTML=svg(hidden?'eyeoff':'eye');$('privacy-toggle').setAttribute('aria-label',hidden?'금액 표시하기':'금액 숨기기');$('privacy-toggle').title=hidden?'금액 표시하기':'금액 숨기기';
}
function heading(title,subtitle,action=true){
  return `<div class="page-heading"><div><span class="eyebrow">${view==='overview'?'A LITTLE MORE, EVERY DAY':'MY ASSET NOTE / '+view.toUpperCase()}</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions"><span class="date-chip">${todayKST().replaceAll('-','. ')}</span>${action?`<button class="button primary" data-action="add" ${view!=='overview'?`data-kind="${view}"`:''}>${svg('plus')} 내역 추가</button>`:''}</div></div>`;
}
function demoBanner(){return demo?'<div class="demo-bar"><span>예시 모드 · 아래 금액은 기능 설명을 위한 가상 내역입니다.</span><button data-action="exit-demo">내 자산으로 돌아가기</button></div>':'';}
function metric(label,value,caption='',className=''){return `<div class="metric-box"><span class="label">${label}</span><strong class="${className}">${value}</strong>${caption?`<small>${caption}</small>`:''}</div>`;}
function paymentRow(item){
  const today=todayKST();const overdue=!item.paid&&item.date<today;
  const diff=Math.round((new Date(item.date+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000);
  const badge=item.paid?'결제 완료':overdue?'일자 경과':diff===0?'오늘':`D-${diff}`;
  return `<div class="payment-row"><div class="payment-date"><span>${Number(item.date.slice(5,7))}월</span><strong>${Number(item.date.slice(8))}</strong></div><div class="institution-icon ${item.type}">${escapeHTML(item.name.slice(0,1))}</div><div class="payment-info"><strong>${escapeHTML(item.name)}</strong><small>${item.type==='loans'?'대출 원금 + 이자':'카드 결제예정액'}</small></div><span class="payment-amount">${money(item.amount)}</span><span class="status-pill ${overdue?'overdue':item.paid?'paid':''}">${badge}</span></div>`;
}
function overview(){
 const t=totals(portfolio),today=todayKST(),currentMonth=today.slice(0,7);
 const allEvents=eventsForMonth(portfolio,currentMonth), unpaid=allEvents.filter(e=>!e.paid);
 const upcoming=unpaid.filter(e=>e.date>=today), past=unpaid.filter(e=>e.date<today);
 const displayed=[...upcoming,...past].slice(0,4);
 const monthly=unpaid.reduce((n,e)=>n+e.amount,0);
 const shares=t.gross?[t.stock/t.gross*100,t.deposits/t.gross*100,t.retirement/t.gross*100]:[0,0,0];
 const donut=t.gross?`conic-gradient(#21644d 0 ${shares[0]}%,#a6ba7d ${shares[0]}% ${shares[0]+shares[1]}%,#dce4bc ${shares[0]+shares[1]}% 100%)`:'#eef1e7';
 return `${heading('나의 자산, 한눈에','흩어진 자산을 모아, 내일을 조금 더 선명하게.')}${demoBanner()}${!rowsCount()?`<div class="empty-welcome"><div><h2>반가워요. 나만의 자산 노트를 시작해 볼까요?</h2><p>첫 내역을 추가하면 자산과 결제 일정이 자동으로 정리됩니다.</p></div><button class="button secondary small" data-action="demo">예시로 둘러보기 ↗</button></div>`:''}
 <div class="overview-grid"><section class="net-card" aria-label="총 순자산"><div><div class="net-card-label">나의 순자산 <span class="tag">NET WORTH</span></div><div class="net-value">${money(t.net,'')}<span style="font-size:17px;font-weight:400;margin-left:9px">원</span></div></div><div class="net-bottom"><div><div style="font-size:9px;color:#a8c6b4;margin-bottom:8px">총 자산</div><strong>${money(t.gross)}</strong></div><div><div style="font-size:9px;color:#a8c6b4;margin-bottom:8px">총 부채 <span style="font-size:8px">대출 + 미결제 카드</span></div><strong>${money(t.debt)}</strong></div></div></section>
 <section class="panel cash-card"><h2 class="card-title" style="font-size:12px;font-weight:600">${Number(currentMonth.slice(5))}월 예정 지출 <span style="float:right;color:#9aa98a">↗</span></h2><div class="cash-value">${money(monthly)}</div><p class="cash-caption">대출 원금·이자 + 미결제 카드</p><div class="cash-footer"><div><span style="display:block;color:#9aa98a;font-size:9px;margin-bottom:7px">대출 상환</span><strong>${money(allEvents.filter(e=>e.type==='loans').reduce((n,e)=>n+e.amount,0))}</strong></div><div><span style="display:block;color:#9aa98a;font-size:9px;margin-bottom:7px">카드 결제</span><strong>${money(unpaid.filter(e=>e.type==='cards').reduce((n,e)=>n+e.amount,0))}</strong></div></div><p class="cash-hint">대출은 등록한 월 납입액 기준입니다.</p></section></div>
 <div class="stats-grid">${[['stocks','주식 총평가액',t.stock,t.cost?`평가손익 ${money(t.profit)} (${percent(t.profitRate)})`:'평가액과 매입금액을 기록해 보세요'],['deposits','예금 잔액',t.deposits,`${portfolio.deposits.length}개 계좌의 여유를 모았어요`],['retirement','퇴직금 · 퇴직연금',t.retirement,'차곡차곡 쌓이는 미래의 자산'],['loans','대출 잔액',t.loans,`월 이자 ${money(t.monthlyInterest)}`]].map(([kind,label,value,caption])=>`<a href="#${kind}" class="stat-card panel"><div class="stat-top"><span class="stat-icon">${svg(kind)}</span>${label}<span class="arrow">↗</span></div><div class="stat-value">${money(value)}</div><p class="stat-caption ${kind==='stocks'&&t.cost?(t.profit>=0?'positive':'negative'):''}">${caption}</p></a>`).join('')}</div>
 <div class="dashboard-bottom"><section class="panel"><div class="panel-header"><div><h2>나의 자산 구성</h2><p>어디에, 얼마나 모여 있을까요?</p></div><span style="font-size:9px;color:#9eaa90">ASSET MIX</span></div><div class="allocation"><div class="donut" style="background:${donut}"><div class="donut-center"><span>총 자산</span><strong>${compact(t.gross)}</strong></div></div><div class="allocation-legend">${[['주식','#21644d',0],['예금','#a6ba7d',1],['퇴직금','#dce4bc',2]].map(([label,color,i])=>`<div class="legend-row"><i style="background:${color}"></i><span>${label}</span><strong>${shares[i].toFixed(1)}%</strong></div>`).join('')}</div></div><p class="panel-note">자산 구성은 부채를 차감하기 전 금액 기준입니다.</p></section><section class="panel"><div class="panel-header"><div><h2>잊지 말아요, 결제 일정</h2><p>다가오는 일정을 먼저 보여드려요.</p></div><a class="panel-link" href="#schedule">전체 일정 보기 ↗</a></div><div class="payment-list">${displayed.length?displayed.map(paymentRow).join(''):'<div class="empty-inline">아직 예정된 결제가 없어요.<br>대출이나 카드 내역을 추가해 보세요.</div>'}</div></section></div><div class="intro-note">${svg('info')}<span>자산을 기록하는 작은 습관이 내일의 여유가 됩니다. 평가액과 잔액은 직접 입력한 최신 금액을 기준으로 해요.</span></div>`;
}
const descriptions={stocks:'증권사별 잔고와 평가손익을 한곳에서 확인하세요.',loans:'잔액부터 이율, 매월 갚는 원금과 이자까지 꼼꼼하게.',retirement:'오늘의 노력이 쌓인, 내일의 든든한 자산.',deposits:'생활비 통장부터 정기예금까지, 내 돈이 모인 곳.',cards:'카드사별 결제예정액을 미리 확인하고 준비하세요.'};
function categoryMetrics(kind){const t=totals(portfolio);const sum=(key)=>portfolio[kind].reduce((n,r)=>n+r[key],0);
 if(kind==='stocks')return metric('총평가액',money(t.stock))+metric('총매입금액',money(t.cost))+metric('평가손익',money(t.profit),t.profitRate==null?'매입금액 입력 후 수익률을 계산해요':`수익률 ${percent(t.profitRate)}`,t.profit>=0?'positive':'negative');
 if(kind==='loans'){const weighted=t.loans?portfolio.loans.reduce((n,r)=>n+r.balance*r.rate,0)/t.loans:0;return metric('대출 잔액',money(t.loans))+metric('월 상환액',money(t.monthlyPrincipal+t.monthlyInterest),`원금 ${money(t.monthlyPrincipal)} · 이자 ${money(t.monthlyInterest)}`)+metric('잔액 가중평균 연 이율',`${weighted.toFixed(2)}%`,'잔액 기준으로 이율을 가중 평균해요');}
 if(kind==='retirement')return metric('퇴직금 · 퇴직연금 합계',money(t.retirement))+metric('등록 내역',`${portfolio.retirement.length}건`)+metric('최근 기준일',portfolio.retirement.map(r=>r.asOf).sort().at(-1)?.replaceAll('-','.')||'—','계좌 평가액 또는 예상 수령액');
 if(kind==='deposits')return metric('전체 예금 잔액',money(t.deposits))+metric('등록 계좌',`${portfolio.deposits.length}개`)+metric('연 예상 이자 · 세전',money(Math.round(portfolio.deposits.reduce((n,r)=>n+r.balance*r.rate/100,0))),'잔액 × 연 이율의 단순 추정치');
 const due=portfolio.cards.filter(r=>!r.paid);return metric('미결제 합계',money(t.cards))+metric('이번 달 미결제',money(due.filter(r=>r.dueDate.startsWith(todayKST().slice(0,7))).reduce((n,r)=>n+r.amount,0)))+metric('가장 가까운 결제일',due.filter(r=>r.dueDate>=todayKST()).map(r=>r.dueDate).sort()[0]?.replaceAll('-','.')||'—',`결제일 경과 ${due.filter(r=>r.dueDate<todayKST()).length}건`);
}
const tableHeaders={stocks:['계좌 · 종목명','총매입금액','총평가액','평가손익',''],loans:['대출명','대출 잔액','적용 연 이율','월 원금','월 이자','월 상환액','상환일',''],retirement:['퇴직금 · 연금명','금융기관 · 회사','금액','기준일',''],deposits:['예금명','금융기관','잔액','연 이율','만기일',''],cards:['카드사 · 카드명','결제예정액','결제일','상태','']};
function rowHTML(kind,r){
 const name=`<td><strong class="name">${escapeHTML(r.name)}</strong><small>${escapeHTML(r.institution||r.note||'')}</small></td>`;
 const num=(v,cls='')=>`<td class="numeric ${cls}">${v}</td>`;
 let cells='';
 if(kind==='stocks'){const profit=r.valuation-r.cost;cells=name+num(money(r.cost))+num(money(r.valuation))+num(`${money(profit)}<small>${r.cost?percent(profit/r.cost*100):'—'}</small>`,profit>=0?'positive':'negative');}
 if(kind==='loans')cells=name+num(money(r.balance))+num(`${r.rate}%`)+num(money(r.principal))+num(money(r.interest))+num(money(r.principal+r.interest))+`<td>매월 ${r.day}일<small>${escapeHTML(r.method)}</small></td>`;
 if(kind==='retirement')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.amount))+`<td>${r.asOf.replaceAll('-','.')}</td>`;
 if(kind==='deposits')cells=name+`<td>${escapeHTML(r.institution||'—')}</td>`+num(money(r.balance))+num(`${r.rate}%`)+`<td>${r.maturity?r.maturity.replaceAll('-','.'): '만기 없음'}</td>`;
 if(kind==='cards'){const overdue=!r.paid&&r.dueDate<todayKST();cells=name+num(money(r.amount))+`<td>${r.dueDate.replaceAll('-','.')}</td><td><button class="status-pill ${r.paid?'paid':overdue?'overdue':''}" style="border:0" data-action="toggle-paid" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} ${r.paid?'미결제로 변경':'결제 완료로 변경'}">${r.paid?'✓ 결제 완료':overdue?'일자 경과 · 미결제':'결제 예정'} ↻</button></td>`;}
 return `<tr>${cells}<td><div class="row-actions"><button data-action="edit" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 수정">${svg('edit')}</button><button data-action="delete" data-kind="${kind}" data-id="${escapeHTML(r.id)}" aria-label="${escapeHTML(r.name)} 삭제">${svg('delete')}</button></div></td></tr>`;
}
function filteredRecords(kind){return portfolio[kind].filter(r=>(r.name+' '+(r.institution||'')+' '+(r.note||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>kind==='cards'?a.dueDate.localeCompare(b.dueDate):0);}
function category(kind){
 const data=filteredRecords(kind);
 const notes={stocks:'증권사 계좌별 총액 또는 종목별 금액 중 한 가지 방식으로 등록해 주세요. 같은 자산을 중복 등록하면 합계도 중복됩니다. 해외 자산은 원화로 환산해 입력해 주세요.',loans:'월 원금과 월 이자는 직접 입력한 예정액입니다. 상환일이 29~31일이고 해당 월에 그 날짜가 없으면 말일에 표시합니다. 일정이 지나도 대출잔액은 자동 차감되지 않습니다.',retirement:'퇴직금 예상액과 퇴직연금 계좌 평가액은 중복되지 않도록 입력해 주세요. 입력 금액은 세전·세후 여부에 따라 실제 수령액과 다를 수 있습니다.',deposits:'연 예상 이자는 현재 잔액과 연 이율을 사용한 세전 단순 추정치입니다. 실제 이자는 상품 조건과 입출금 내역에 따라 달라집니다.',cards:'결제예정액은 정확한 날짜별로 등록해 주세요. 상태를 눌러 결제 완료로 바꿀 수 있습니다. 완료된 카드대금은 부채에서 제외되며, 예금 잔액은 직접 수정해 주세요.'};
 return `${heading(navLabels[kind],descriptions[kind])}${demoBanner()}<div class="metric-strip">${categoryMetrics(kind)}</div><section class="table-panel"><div class="table-heading"><h2>${LABELS[kind]} 내역 <span>${portfolio[kind].length}건</span></h2><input class="search-input" id="record-search" type="search" placeholder="이름 · 금융기관 검색" aria-label="내역 검색" value="${escapeHTML(query)}"></div>${portfolio[kind].length?`<div class="table-scroll"><table><thead><tr>${tableHeaders[kind].map((h,i)=>`<th class="${i>0&&/금액|평가액|손익|잔액|이율|원금|이자|상환액/.test(h)?'numeric':''}">${h}</th>`).join('')}</tr></thead><tbody id="records-body">${data.map(r=>rowHTML(kind,r)).join('')||`<tr><td colspan="${tableHeaders[kind].length}" class="empty-inline">검색 결과가 없습니다.</td></tr>`}</tbody></table></div>`:`<div class="empty-state"><div class="empty-symbol">${svg(kind)}</div><h3>아직 등록된 ${LABELS[kind]} 내역이 없어요</h3><p>첫 내역을 추가하고<br>나의 자산을 차곡차곡 모아 보세요.</p><button class="button primary" data-action="add" data-kind="${kind}">${svg('plus')} ${LABELS[kind]} 추가하기</button></div>`}</section><p class="category-note">${notes[kind]}</p>`;
}
function calendar(){
 const [year,m]=month.split('-').map(Number),today=todayKST();
 const events=eventsForMonth(portfolio,month),total=events.filter(e=>!e.paid).reduce((n,e)=>n+e.amount,0);
 const start=new Date(Date.UTC(year,m-1,1)).getUTCDay(),days=new Date(Date.UTC(year,m,0)).getUTCDate();
 const count=Math.ceil((start+days)/7)*7;
 const cells=Array.from({length:count},(_,i)=>{const day=i-start+1;if(day<1||day>days)return '<div class="calendar-cell muted"></div>';const date=`${month}-${String(day).padStart(2,'0')}`,daily=events.filter(e=>e.date===date),sum=daily.filter(e=>!e.paid).reduce((n,e)=>n+e.amount,0);return `<div class="calendar-cell ${date===today?'today':''}"><span class="day-number">${day}</span>${daily.length?`<span class="calendar-amount" title="${hidden?'금액 숨김':escapeHTML(daily.map(e=>e.name+' '+money(e.amount)).join(', '))}">${sum?compact(sum)+'원':'결제 완료'}</span><span class="calendar-count">${daily.length}건</span>`:''}</div>`;}).join('');
 return `${heading('결제 캘린더','매달 돌아오는 상환일과 카드 결제일을 놓치지 마세요.',false)}${demoBanner()}<div class="calendar-layout"><section class="panel"><div class="panel-header"><h2>월별 일정</h2><div class="calendar-toolbar"><button data-action="prev-month" aria-label="이전 달">‹</button><strong>${year}년 ${m}월</strong><button data-action="next-month" aria-label="다음 달">›</button><button data-action="this-month" style="width:auto;padding:0 8px;font-size:9px">이번 달</button></div></div><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<span class="calendar-day-label">${d}</span>`).join('')}${cells}</div><div class="calendar-key"><span><i></i>대출 · 카드 결제</span></div></section><section class="panel"><div class="panel-header"><h2>${m}월 결제 내역</h2><span style="font-size:10px;color:#9eaa90">${events.length}건</span></div><div class="schedule-summary"><span>미결제 예정 합계</span><strong>${money(total)}</strong></div><div class="calendar-list">${events.length?events.map(paymentRow).join(''):'<div class="empty-inline">이번 달 예정된 결제가 없어요.</div>'}</div><p class="panel-note">대출 일정은 등록한 월 원금·이자의 반복 표시입니다. 납부 여부는 금융기관에서 확인해 주세요.</p></section></div>`;
}
function render(){renderNav();$('main').innerHTML=view==='overview'?overview():view==='schedule'?calendar():category(view);}
const fields={
 stocks:[['name','계좌 · 종목명','text',true,'예: 국내주식 계좌 / 삼성전자'],['institution','증권사','text',false,'예: 미래에셋증권'],['cost','총매입금액','money',true,'0'],['valuation','총평가액','money',true,'0'],['note','메모','textarea',false,'선택 입력']],
 loans:[['name','대출명','text',true,'예: 주택담보대출'],['institution','금융기관','text',false,'예: 신한은행'],['balance','대출 잔액','money',true,'0'],['rate','적용 연 이율','rate',true,'예: 4.2'],['principal','매월 상환 원금','money',true,'0'],['interest','매월 납부 이자','money',true,'0'],['day','매월 상환일','day',true,'예: 25'],['method','상환 방식','select',true,''],['note','메모','textarea',false,'선택 입력']],
 retirement:[['name','퇴직금 · 연금명','text',true,'예: 퇴직연금 DC / 예상 퇴직금'],['institution','금융기관 · 회사','text',false,'예: 삼성생명'],['amount','금액','money',true,'0'],['asOf','금액 기준일','date',true,''],['note','메모','textarea',false,'세전/세후 여부 등을 기록하세요']],
 deposits:[['name','예금명','text',true,'예: 생활비 통장 / 정기예금'],['institution','금융기관','text',false,'예: 토스뱅크'],['balance','현재 잔액','money',true,'0'],['rate','연 이율','rate',true,'0'],['maturity','만기일','date',false,''],['note','메모','textarea',false,'선택 입력']],
 cards:[['name','카드사 · 카드명','text',true,'예: 현대카드 M'],['amount','결제예정액','money',true,'0'],['dueDate','결제일','date',true,''],['paid','결제 상태','paid',false,''],['note','메모','textarea',false,'선택 입력']]
};
function openEditor(kind,id){
 if(saving){toast('저장 중입니다. 잠시만 기다려 주세요.');return;}
 if(!KINDS.includes(kind)){showAddMenu();return;}
 editorKind=kind;editingId=id||null;
 const row=id?portfolio[kind].find(r=>r.id===id):{};
 if(!row)return;
 $('editor-title').textContent=`${LABELS[kind]} ${id?'수정':'추가'}`;$('form-error').textContent='';
 $('form-fields').innerHTML=fields[kind].map(([key,label,type,required,placeholder])=>{
  let value=row[key]??((type==='date'&&required)?todayKST():['money','rate'].includes(type)?0:'');
  let input;
  if(type==='select')input=`<select id="field-${key}" name="${key}" required>${['원리금균등','원금균등','만기일시','기타'].map(v=>`<option ${value===v?'selected':''}>${v}</option>`).join('')}</select>`;
  else if(type==='paid')input=`<select id="field-${key}" name="${key}"><option value="false">결제 예정</option><option value="true" ${value===true?'selected':''}>결제 완료</option></select>`;
  else if(type==='textarea')input=`<textarea id="field-${key}" name="${key}" maxlength="500" placeholder="${placeholder}" rows="2">${escapeHTML(value)}</textarea>`;
  else input=`<div class="input-wrap"><input id="field-${key}" name="${key}" type="${type==='money'?'text':type==='rate'||type==='day'?'number':type}" ${required?'required':''} ${type==='money'?'inputmode="numeric" maxlength="21"':type==='rate'?'min="0" max="100" step="0.001"':type==='day'?'min="1" max="31" step="1"':type==='text'?'maxlength="100"':''} value="${escapeHTML(type==='money'?wonFormat.format(value):value)}" placeholder="${placeholder}">${type==='money'?'<span>원</span>':type==='rate'?'<span>%</span>':type==='day'?'<span>일</span>':''}</div>`;
  return `<div class="field ${type==='textarea'?'full-width':''}"><label for="field-${key}">${label} ${required?'<span>*</span>':'<small>선택</small>'}</label>${input}</div>`;
 }).join('')+`<p class="form-notice full-width">${demo?'예시 모드입니다. 변경 내용은 실제 자산에 저장되지 않습니다.':kind==='loans'?'월 이자는 금융기관의 납부예정액을 직접 입력해 주세요. 잔액과 이율로 자동 계산하지 않습니다.':'입력한 내역은 본인 계정에 저장됩니다. 금액은 원화 기준으로 입력해 주세요.'}</p>`;
 $('record-form').onsubmit=submitRecord;
 $('record-form').querySelector('button[type="submit"]').textContent='저장하기 ↗';
 openDialog('editor');
}
function showAddMenu(){
 $('editor-title').textContent='무엇을 모아볼까요?';$('form-error').textContent='';
 $('form-fields').innerHTML=`<div class="add-menu full-width">${KINDS.map(k=>`<button type="button" class="button secondary" data-action="choose-kind" data-kind="${k}">${svg(k)}${navLabels[k]}<span>↗</span></button>`).join('')}</div>`;
 $('record-form').onsubmit=e=>e.preventDefault();$('record-form').querySelector('button[type="submit"]').hidden=true;openDialog('editor');
}
async function submitRecord(e){
 e.preventDefault();if(saving)return;
 const values=new FormData(e.target),record={id:editingId||crypto.randomUUID()};
 for(const [key,,type]of fields[editorKind]){const v=values.get(key);record[key]=type==='money'?Number(String(v).replaceAll(',','')):type==='rate'||type==='day'?Number(v):type==='paid'?v==='true':String(v||'').trim();}
 const next=structuredClone(portfolio);const i=next[editorKind].findIndex(r=>r.id===editingId);if(i>=0)next[editorKind][i]=record;else next[editorKind].push(record);
 const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;$('form-error').textContent='';
 try{await persist(next);$('editor').close();toast(demo?'예시 내역을 변경했어요.':'내역을 저장했어요.');}catch(error){$('form-error').textContent=error.message;}finally{submit.disabled=false;}
}
function startDemo(){
 if(!demo){realData=portfolio;realRevision=revision;demo=true;portfolio=samplePortfolio();}
 loading=false;view='overview';location.hash='overview';$('settings-dialog').close();status('예시 보기 중');render();
}
async function exitDemo(){demo=false;portfolio=realData||emptyPortfolio();revision=realRevision;realData=null;await loadData();}
document.addEventListener('click',async e=>{
 const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
 const button=e.target.closest('[data-action]');if(!button)return;
 const {action,kind,id}=button.dataset;
 if(action==='add'||action==='edit'){if($('editor').open)$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;openEditor(kind,id);}
 if(action==='choose-kind'){$('editor').close();$('record-form').querySelector('button[type="submit"]').hidden=false;openEditor(kind);}
 if(action==='delete'){
   const row=portfolio[kind].find(r=>r.id===id);if(!row)return;
   if(await confirmAction('이 내역을 삭제할까요?',`‘${row.name}’ 내역을 삭제합니다. 다시 사용하려면 새로 입력해야 해요.`)){
     const next=structuredClone(portfolio);next[kind]=next[kind].filter(r=>r.id!==id);try{await persist(next);toast('내역을 삭제했어요.');}catch(error){toast(error.message);}
   }
 }
 if(action==='toggle-paid'){const next=structuredClone(portfolio),r=next.cards.find(r=>r.id===id);if(r){r.paid=!r.paid;try{await persist(next);toast(r.paid?'결제 완료로 표시했어요. 예금 잔액도 확인해 주세요.':'결제 예정으로 변경했어요.');}catch(error){toast(error.message);}}}
 if(action==='demo')startDemo();if(action==='exit-demo')exitDemo();if(action==='retry')loadData();
 if(['prev-month','next-month','this-month'].includes(action)){if(action==='this-month')month=todayKST().slice(0,7);else{const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+(action==='next-month'?1:-1),1));month=d.toISOString().slice(0,7);}render();}
});
document.addEventListener('input',e=>{
 if(e.target.id==='record-search'){query=e.target.value;const rows=filteredRecords(view);$('records-body').innerHTML=rows.map(r=>rowHTML(view,r)).join('')||`<tr><td colspan="${tableHeaders[view].length}" class="empty-inline">검색 결과가 없습니다.</td></tr>`;}
 if(e.target.matches('#record-form input[inputmode="numeric"]')){const raw=e.target.value.replaceAll(',','');if(/^\d*$/.test(raw))e.target.value=raw?wonFormat.format(Number(raw)):'';}
});
$('privacy-toggle').onclick=()=>{hidden=!hidden;localStorage.setItem('moa-hide-amounts',String(hidden));if(!loading)render();else renderNav();};
$('data-settings').onclick=()=>openDialog('settings-dialog');
$('mobile-settings').onclick=()=>openDialog('settings-dialog');
$('open-demo').onclick=startDemo;
$('export-data').onclick=()=>{
 if(demo){toast('예시 모드를 종료한 뒤 실제 내역을 백업해 주세요.');return;}
 const file=new Blob([JSON.stringify(portfolio,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`moa-assets-${todayKST()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 내려받았어요.');
};
$('import-data').onclick=()=>{if(demo){toast('예시 모드를 종료한 뒤 복원해 주세요.');return;}$('import-file').click();};
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>1_000_000)throw new Error('백업 파일은 1MB 이하로 선택해 주세요.');
  const data=validatePortfolio(JSON.parse(await file.text()));const count=KINDS.reduce((n,k)=>n+data[k].length,0);
  $('settings-dialog').close();if(await confirmAction('백업 내역으로 교체할까요?',`현재 내역을 지우고 백업 파일의 ${count}건으로 교체합니다. 기존 내역이 필요하면 취소 후 먼저 내보내 주세요.`,'교체하기')){await persist(data);toast(`${count}건의 내역을 복원했어요.`);}
 }catch(error){toast(error instanceof SyntaxError?'올바른 JSON 백업 파일을 선택해 주세요.':error.message);}
};
function setView(){const hash=location.hash.slice(1);view=navLabels[hash]?hash:'overview';query='';if(!loading)render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',setView);setView();renderNav();loadData();

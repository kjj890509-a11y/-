import {totals,snapshotTotals,interestForLoan,todayKST} from './domain.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let chartId=0;
export const pendingRankCharts=new Map();
export function chartFingerprint(value){let n=2166136261;for(const c of JSON.stringify(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);}
const inspect=(label,amount)=>`data-chart-inspect data-chart-label="${esc(label)}" data-chart-value="${esc(amount)}" tabindex="0" role="button" aria-label="${esc(label+', '+amount)}"`;
const key=(type,value)=>`${type}:${chartFingerprint(value)}`;
export function renderAssetDonut(categories,{money,hideAmounts=false}){
 const total=categories.reduce((n,row)=>n+row[2],0),id='allocation-'+(++chartId);let start=0;
 const arcs=categories.filter(row=>row[2]>0).map(([kind,label,value])=>{const part=value/total*100,offset=start;start+=part;return `<circle class="allocation-${kind} donut-segment" cx="64" cy="64" r="48" pathLength="100" fill="none" stroke-width="16" stroke-dasharray="${part} ${100-part}" stroke-dashoffset="${-offset}" ${inspect(label,money(value)+(hideAmounts?'':` · ${part.toFixed(1)}%`))}/>`;}).join('');
 return `<figure class="asset-donut motion-figure" data-motion-figure data-motion-chart data-motion-key="${key('donut',categories.map(r=>[r[0],money(r[2])]))}"><svg viewBox="0 0 128 128" role="group" aria-label="보유 자산 구성"><defs><mask id="${id}"><circle class="moa-donut-reveal" cx="64" cy="64" r="48" pathLength="100" fill="none" stroke="white" stroke-width="20" stroke-dasharray="100" stroke-dashoffset="0" transform="rotate(-90 64 64)"/></mask></defs><circle cx="64" cy="64" r="48" fill="none" stroke="var(--line)" stroke-width="16"/><g mask="url(#${id})"><g transform="rotate(-90 64 64)">${arcs}</g></g><text x="64" y="60" text-anchor="middle" class="donut-center-label">${total?'보유 자산':'등록 전'}</text><text x="64" y="79" text-anchor="middle" class="donut-center-value">${hideAmounts?'••%':total?'100%':'—'}</text></svg></figure>`;
}
export function renderBudgetRing(budget,{money,hideAmounts=false}){
 const known=budget.limit!==null,ratio=!known?0:budget.limit===0?(budget.expense?100:0):budget.expense/budget.limit*100;
 const percent=Math.max(0,Math.min(100,ratio)),label=hideAmounts?'••%':!known?'미설정':budget.limit===0&&budget.expense?'초과':Math.round(ratio)+'%';
 const description=known?`지출 계획 ${money(budget.expense)} · 예산 ${money(budget.limit)}`:'지출 한도를 설정하면 사용률이 표시됩니다.';
 return `<button type="button" class="budget-ring motion-figure ${known&&ratio>100?'over-budget':''}" data-motion-chart data-motion-figure data-motion-key="${key('budget-ring',[budget.month,money(budget.expense),known?money(budget.limit):null])}" ${inspect('지출 계획의 예산 사용률',description)}><svg viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="34" fill="none" stroke="var(--line)" stroke-width="7"/><circle class="moa-progress-ring" cx="44" cy="44" r="34" pathLength="100" fill="none" stroke-width="7" stroke-dasharray="100" stroke-dashoffset="${100-percent}" style="--ring-end:${100-percent}" transform="rotate(-90 44 44)"/></svg><span class="budget-ring-value">${label}</span></button>`;
}
export function snapshotSeries(data,kind,today=todayKST()){
 const metric=kind==='stocks'?'stock':kind;
 if(!['stock','deposits','retirement','net','debt'].includes(metric))return [];
 const rows=new Map();
 for(const row of [...(data.snapshots||[])].filter(r=>r.asOf<=today).sort((a,b)=>a.asOf.localeCompare(b.asOf)))rows.set(row.asOf,{date:row.asOf,value:snapshotTotals(row)[metric]});
 rows.set(today,{date:today,value:totals(data)[metric]});return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
}
export function renderSparkline(points,label){
 if(points.length<2)return '';
 const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value)),range=max-min||1;
 const coords=points.map((p,i)=>[3+i*78/(points.length-1),max===min?14:24-(p.value-min)/range*20]);
 const d=coords.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
 return `<svg class="snapshot-sparkline" viewBox="0 0 84 28" role="img" aria-label="${esc(label)} 저장 기록 추이"><title>${esc(points[0].date+' ~ '+points.at(-1).date+' · 저장 기록과 현재 잔액')}</title><path d="${d}" fill="none" stroke="var(--chart-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function positiveScale(values){
 const max=Math.max(0,...values);if(!max)return {high:1,ticks:[0]};const raw=max/4,base=10**Math.floor(Math.log10(raw));const step=([1,2,2.5,5,10].find(n=>n>=raw/base)||10)*base,high=Math.ceil(max/step)*step;
 return {high,ticks:Array.from({length:Math.round(high/step)+1},(_,i)=>step*i)};
}
function signedScale(values){
 const low=Math.min(0,...values),high=Math.max(0,...values),range=high-low;
 if(!range)return {low:0,high:1,ticks:[0]};
 const raw=range/4,base=10**Math.floor(Math.log10(raw)),step=([1,2,2.5,5,10].find(n=>n>=raw/base)||10)*base;
 const min=Math.floor(low/step)*step,max=Math.ceil(high/step)*step;
 return {low:min,high:max,ticks:Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+step*i)};
}
export function renderAmountBars(points,{formatMoney,formatCompact,title,minWidth=700,height=236,showHint=true}){
 if(!points.length)return '<div class="empty-inline">조회된 금액이 없습니다.</div>';
 const width=Math.max(minWidth,points.length*30+88),left=64,right=20,top=18,bottom=34,plot=height-top-bottom;
 const scale=signedScale(points.map(p=>p.value)),slot=(width-left-right)/points.length,barWidth=Math.min(34,slot*.55),position=value=>top+(scale.high-value)/(scale.high-scale.low)*plot,zero=position(0);
 const ticks=scale.ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${position(v)}" y2="${position(v)}" stroke="${v===0?'var(--muted)':'var(--line)'}"/><text x="${left-12}" y="${position(v)+4}" text-anchor="end">${esc(formatCompact(v))}</text>`).join('');
 const bars=points.map((p,i)=>{const valueY=position(p.value),h=Math.abs(valueY-zero),x=left+slot*i+slot/2-barWidth/2,y=Math.min(zero,valueY);return `<g class="amount-bar-point" ${inspect(p.detailLabel||p.label,formatMoney(p.value))}><rect x="${left+slot*i}" y="${top}" width="${slot}" height="${plot}" fill="transparent"/><rect class="moa-grow-bar" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2" fill="${p.value<0?'var(--red)':'var(--green)'}" style="--bar-delay:${Math.min(i*24,240)}ms;transform-origin:${x+barWidth/2}px ${zero}px"/>${i%Math.max(1,Math.ceil(points.length/12))===0||i===points.length-1?`<text x="${x+barWidth/2}" y="${height-9}" text-anchor="middle">${esc(p.label)}</text>`:''}</g>`;}).join('');
 return `<figure class="amount-bars motion-figure" data-motion-figure data-motion-chart data-motion-key="${key('bars',[title,points.map(p=>[p.label,formatMoney(p.value)])])}"><div class="financial-chart-scroll"><svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="group" aria-label="${esc(title)}">${ticks}${bars}</svg></div>${showHint?'<figcaption>단위: 원 · 막대를 누르거나 초점을 맞추면 금액을 확인할 수 있어요.</figcaption>':''}</figure>`;
}
export const expenseParts=[['principal','대출 원금','var(--green)'],['interest','대출 이자','var(--chart-secondary)'],['cards','카드','var(--asset-stock)'],['fixed','정기 지출','var(--asset-retirement)'],['other','기타 지출','var(--muted)']];
export function expenseComposition(result){
 const months=result.months.map(m=>({month:m.month,principal:m.principal,interest:m.interest,cards:0,fixed:0,other:0,total:m.expense}));const byMonth=new Map(months.map(m=>[m.month,m]));
 for(const row of result.rows){if(row.informational||row.type==='income'||row.type==='retirement'||row.type==='loans')continue;const month=byMonth.get(row.date.slice(0,7));if(month)month[row.source==='cards'?'cards':row.source==='fixed'?'fixed':'other']+=row.amount;}
 return months;
}
export function renderExpenseComposition(result,{formatMoney,formatCompact}){
 const months=expenseComposition(result),active=expenseParts.filter(([key])=>months.some(m=>m[key]>0));if(!active.length)return '';
 const width=Math.max(700,months.length*48+88),height=244,left=64,right=20,top=18,bottom=34,plot=height-top-bottom,slot=(width-left-right)/months.length,barWidth=Math.min(34,slot*.55),scale=positiveScale(months.map(m=>m.total));
 const grid=scale.ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${height-bottom-v/scale.high*plot}" y2="${height-bottom-v/scale.high*plot}" stroke="var(--line)"/><text x="${left-12}" y="${height-bottom-v/scale.high*plot+4}" text-anchor="end">${esc(formatCompact(v))}</text>`).join('');
 const bars=months.map((month,index)=>{let sum=0;const x=left+index*slot+slot/2-barWidth/2;const parts=active.map(([key,label,color],part)=>{const value=month[key],h=value/scale.high*plot,y=height-bottom-(sum+value)/scale.high*plot;sum+=value;return value?`<g ${inspect(month.month+' · '+label,formatMoney(value))}><rect class="moa-stacked-part" x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" style="--stack-delay:${part*180+Math.min(index*8,60)}ms;transform-origin:${x+barWidth/2}px ${y+h}px"/></g>`:'';}).join('');return parts+`${index%Math.max(1,Math.ceil(months.length/12))===0||index===months.length-1?`<text x="${x+barWidth/2}" y="${height-9}" text-anchor="middle">${esc(month.month.slice(2).replace('-','.'))}</text>`:''}`;}).join('');
 return `<section class="panel expense-composition-panel"><div class="panel-header"><div><h2>월별 지출 구성</h2><p>현재 조회 조건 · 원금·이자·생활 지출을 구분합니다.</p></div></div><figure class="expense-composition motion-figure" data-motion-figure data-motion-chart data-motion-key="${key('stacked',months.map(m=>[m.month,...active.map(([k])=>formatMoney(m[k]))]))}"><div class="financial-chart-scroll"><svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="group" aria-label="월별 지출 구성 누적 막대">${grid}${bars}</svg></div><figcaption class="composition-legend">${active.map(([,label,color])=>`<span><i style="background:${color}"></i>${label}</span>`).join('')}</figcaption></figure></section>`;
}
export function rankingRows(data){return data.loans.filter(row=>row.balance>0).map(row=>({key:row.id,name:row.name,interest:interestForLoan(row),balance:row.balance}));}
export function sortedRanking(rows,metric='interest',direction='desc'){return [...rows].sort((a,b)=>(direction==='asc'?1:-1)*(a[metric]-b[metric])||a.name.localeCompare(b.name,'ko')||a.key.localeCompare(b.key));}
export function rankListMarkup(model){
 const rows=sortedRanking(model.rows,model.metric,model.direction).slice(0,12),max=Math.max(0,...rows.map(row=>row[model.metric]));
 return rows.map((row,index)=>`<div class="loan-rank-row" data-rank-key="${esc(row.key)}"><span class="rank-position">${index+1}</span><span class="rank-name">${esc(row.name)}</span><button type="button" class="rank-bar-button" ${inspect(row.name+' · '+(model.metric==='interest'?'등록 월 이자':'현재 잔액'),model.money(row[model.metric]))}><span class="rank-track"><i class="rank-fill" style="width:${max?row[model.metric]/max*100:0}%"></i></span><strong data-motion-value data-motion-value-key="loan-rank:${esc(row.key)}:${model.metric}">${esc(model.money(row[model.metric]))}</strong></button></div>`).join('');
}
export function renderLoanComparison(data,{formatMoney}){
 const rows=rankingRows(data);if(!rows.length)return '';
 const id='loan-rank-'+(++chartId),model={rows,metric:'interest',direction:'desc',money:formatMoney};pendingRankCharts.set(id,model);if(pendingRankCharts.size>64)pendingRankCharts.delete(pendingRankCharts.keys().next().value);
 return `<section class="panel loan-comparison motion-figure" data-motion-figure data-motion-chart data-rank-chart="${id}" data-motion-key="${key('loan-rank',rows.map(r=>[r.key,formatMoney(r.interest),formatMoney(r.balance)]))}"><div class="panel-header"><div><h2>대출별 부담 비교</h2><p>등록 월 이자 또는 현재 잔액 · 최대 12건</p></div><div class="rank-controls" role="group" aria-label="대출 비교 정렬"><button type="button" data-rank-metric="interest" aria-pressed="true">월 이자</button><button type="button" data-rank-metric="balance" aria-pressed="false">잔액</button><button type="button" data-rank-direction aria-label="금액 정렬 방향 변경">큰 금액순 ↓</button></div></div><div class="loan-rank-list">${rankListMarkup(model)}</div></section>`;
}

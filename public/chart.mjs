const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
let chartSequence = 0;
const pendingPlots = new Map();
const observers = new Set();
const instruction = '그래프에 마우스를 올리거나 터치하면 금액을 확인할 수 있어요.';
const dateLabel = point => String(point.detailLabel || point.label).split('·')[0].trim();
const timestamp = point => {
 const value=dateLabel(point).replaceAll('.','-');
 return /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)?Date.parse(value+(value.length===7?'-01':'')+'T00:00:00Z'):NaN;
};
// Rounded tick intervals, without forcing positive and negative series onto the same scale.
export function chartScale(values){
 const min=Math.min(...values),max=Math.max(...values),padding=Math.max((max-min)*.12,Math.abs(max)*.015,10000);
 const raw=(max-min+padding*2)/4,base=10**Math.floor(Math.log10(raw));
 const step=([1,2,2.5,5,10].find(value=>value>=raw/base)||10)*base;
 const low=Math.floor((min-padding)/step)*step,high=Math.ceil((max+padding)/step)*step;
 const ticks=Array.from({length:Math.round((high-low)/step)+1},(_,i)=>low+step*i);
 return {low,high,ticks};
}
function plotMarkup(points,options,id,width=760,height=264){
 const {formatMoney,formatCompact,title='순자산 흐름',comparisonPoints=[]}=options;
 const left=64,right=24,top=18,bottom=34;
 const {low,high,ticks}=chartScale([...points,...comparisonPoints].map(point=>point.value));
 const times=points.map(timestamp),temporal=times.every(Number.isFinite)&&times.every((time,i)=>!i||time>times[i-1]);
 const x=index=>points.length===1?(left+width-right)/2:left+(width-left-right)*(temporal?(times[index]-times[0])/(times.at(-1)-times[0]):index/Math.max(1,points.length-1));
 const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
 const indexed=points.map((point,index)=>({...point,x:x(index),y:y(point.value)}));
 const path=rows=>rows.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
 const firstForecast=points.findIndex(point=>point.forecast),real=firstForecast<0?indexed:indexed.slice(0,firstForecast),projected=firstForecast<0?[]:indexed.slice(Math.max(0,firstForecast-1));
 const grid=ticks.map(value=>`<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" stroke="${value===0?'#c0c8d2':'var(--line)'}"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end">${escapeHTML(formatCompact(value))}</text>`).join('');
 let lastLabel=-Infinity;
 const labels=indexed.map((point,index)=>{
  if(index!==points.length-1&&(point.x-lastLabel<70||index>0&&indexed.at(-1).x-point.x<65))return '';
  lastLabel=point.x;return `<text x="${point.x}" y="${height-8}" text-anchor="middle">${escapeHTML(point.label)}</text>`;
 }).join('');
 const circles=indexed.map((point,index)=>{
  const date=dateLabel(point),amount=formatMoney(point.value);
  const hitLeft=index===0?left-12:(indexed[index-1].x+point.x)/2,hitRight=index===indexed.length-1?width-right+12:(point.x+indexed[index+1].x)/2;
  return `<g class="chart-point" data-chart-point data-x="${point.x}" data-y="${point.y}" data-label="${escapeHTML(date)}" data-date="${escapeHTML(date)}" data-amount="${escapeHTML(amount)}" role="button" tabindex="0" aria-pressed="false" aria-label="${escapeHTML(date+', '+amount)}"><rect class="chart-hit-area" x="${hitLeft}" y="${top}" width="${hitRight-hitLeft}" height="${height-top-bottom}" fill="transparent"/><circle class="chart-point-halo" cx="${point.x}" cy="${point.y}" r="11" fill="var(--green)" fill-opacity=".1"/><circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="3" fill="${point.forecast?'#fff':'var(--green)'}" stroke="${point.forecast?'var(--chart-secondary)':'var(--green)'}" stroke-width="1.8"/></g>`;
 }).join('');
 return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escapeHTML(title)}" aria-describedby="${id}-help"><desc>${escapeHTML(title)}. 날짜에 마우스를 올리거나 터치해 금액을 확인하세요.</desc><defs><clipPath id="${id}-reveal" clipPathUnits="userSpaceOnUse"><rect class="chart-reveal-mask" width="${width}" height="${height}"/></clipPath></defs>${grid}<g clip-path="url(#${id}-reveal)">${real.length>1?`<path d="${path(real)} L${real.at(-1).x},${height-bottom} L${real[0].x},${height-bottom} Z" fill="var(--green)" fill-opacity=".04"/><path d="${path(real)}" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`:''}${comparisonPoints.length>1?`<path d="${path(comparisonPoints.map((point,index)=>({...point,x:x(index),y:y(point.value)})))}" fill="none" stroke="var(--chart-secondary)" stroke-width="2" stroke-dasharray="5 5"/>`:''}${projected.length>1?`<path d="${path(projected)}" fill="none" stroke="var(--chart-secondary)" stroke-width="2.2" stroke-dasharray="5 5" stroke-linecap="round"/>`:''}</g>${circles}${labels}<line class="chart-selection-line" data-chart-cursor y1="${top}" y2="${height-bottom}" hidden aria-hidden="true"/></svg>`;
}
export function renderTrendChart(points,options){
 if(!points.length)return '<div class="empty-inline">자산 기록을 남기면 월별 변화가 여기에 나타납니다.</div>';
 const {formatMoney,historyOnly=false,title='순자산 흐름',seriesLabel='',comparisonPoints=[],comparisonLabel='기존 계획'}=options;
 const id=`asset-trend-${++chartSequence}`;
 pendingPlots.set(id,{points,options});
 return `<figure class="trend-chart interactive-chart" data-trend-chart data-plot-id="${id}"><div class="trend-plot-scroll">${plotMarkup(points,options,id)}</div><div class="chart-tooltip" data-chart-tooltip hidden aria-hidden="true"><span class="chart-tooltip-date" data-chart-tooltip-date></span><strong class="chart-tooltip-value" data-chart-tooltip-value></strong></div><div class="sr-only" role="status" aria-live="polite" aria-atomic="true"><span data-chart-readout-label id="${id}-help">${instruction}</span><strong data-chart-readout-value></strong></div><figcaption>${seriesLabel?`<span><i></i>${escapeHTML(seriesLabel)}</span>${comparisonPoints.length?`<span class="forecast-key"><i></i>${escapeHTML(comparisonLabel)}</span>`:''}`:`<span><i></i>기록·현재</span>${!historyOnly?'<span class="forecast-key"><i></i>예상</span>':''}`}<span class="chart-unit">단위: 원</span></figcaption><details class="chart-data"><summary>수치 보기</summary><div class="table-scroll"><table><caption class="sr-only">${escapeHTML(title)}</caption><thead><tr><th>기준일</th><th class="numeric">${escapeHTML(title)}</th></tr></thead><tbody>${points.map(point=>`<tr><th>${escapeHTML(dateLabel(point))}</th><td class="numeric">${escapeHTML(formatMoney(point.value))}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
}

export function mountTrendCharts(root) {
  for(const entry of observers)if(!entry.chart.isConnected){entry.observer.disconnect();observers.delete(entry);}
  root.querySelectorAll('[data-trend-chart]').forEach(chart => {
    if (chart.dataset.chartReady) return;
    chart.dataset.chartReady = 'true';
    let points = [...chart.querySelectorAll('[data-chart-point]')];
    const plot=pendingPlots.get(chart.dataset.plotId);
    pendingPlots.delete(chart.dataset.plotId);
    const tooltip = chart.querySelector('[data-chart-tooltip]');
    let cursor = chart.querySelector('[data-chart-cursor]');
    const readoutLabel = chart.querySelector('[data-chart-readout-label]');
    const readoutValue = chart.querySelector('[data-chart-readout-value]');
    const positionTooltip = (point, event) => {
      const viewport = chart.ownerDocument.defaultView;
      const viewportWidth = viewport.innerWidth || 1024;
      const viewportHeight = viewport.innerHeight || 768;
      const chartRect = chart.getBoundingClientRect();
      const svgRect = chart.querySelector('svg').getBoundingClientRect();
      const plotWidth=Number(chart.querySelector('svg').getAttribute('viewBox').split(' ')[2]);
      const scale = svgRect.width / plotWidth || 1;
      const anchorX = Number.isFinite(event?.clientX) ? event.clientX : svgRect.left + Number(point.dataset.x) * scale;
      const anchorY = Number.isFinite(event?.clientY) ? event.clientY : svgRect.top + Number(point.dataset.y) * scale;
      const rect = tooltip.getBoundingClientRect();
      const tooltipWidth = rect.width || Math.min(320, viewportWidth-32, Math.max(160, point.dataset.amount.length*11+point.dataset.date.length*8+34));
      const tooltipHeight = rect.height || 42;
      const left = Math.max(16, Math.min(viewportWidth-tooltipWidth-16, anchorX-tooltipWidth/2));
      const preferredTop = anchorY-tooltipHeight-16 >= 16 ? anchorY-tooltipHeight-16 : anchorY+16;
      const top = Math.max(16, Math.min(viewportHeight-tooltipHeight-16, preferredTop));
      tooltip.style.left = `${left-chartRect.left}px`;
      tooltip.style.top = `${top-chartRect.top}px`;
    };
    const show = (point, event) => {
      const {x, y, label, date, amount} = point.dataset;
      points.forEach(item => item.setAttribute('aria-pressed', String(item === point)));
      chart.querySelector('[data-chart-tooltip-date]').textContent = date;
      chart.querySelector('[data-chart-tooltip-value]').textContent = amount;
      tooltip.removeAttribute('hidden');
      positionTooltip(point, event);
      cursor.setAttribute('x1', x);
      cursor.setAttribute('x2', x);
      cursor.removeAttribute('hidden');
      readoutLabel.textContent = label;
      readoutValue.textContent = amount;
    };
    const clear = () => {
      points.forEach(point => point.setAttribute('aria-pressed', 'false'));
      tooltip.setAttribute('hidden', '');
      cursor.setAttribute('hidden', '');
      readoutLabel.textContent = instruction;
      readoutValue.textContent = '';
    };
    const selectFromEvent = event => {
      const point = event.target.closest('[data-chart-point]');
      if (point && chart.contains(point)) show(point, event);
      else if (event.type === 'pointermove') clear();
    };
    const ResizeObserver=chart.ownerDocument.defaultView.ResizeObserver;
    if(plot&&ResizeObserver){
      let previousWidth=0;
      const reflow=()=>{
        const width=Math.round(chart.querySelector('.trend-plot-scroll').getBoundingClientRect().width);
        if(width<220||width===previousWidth)return;
        previousWidth=width;clear();
        chart.querySelector('.trend-plot-scroll').innerHTML=plotMarkup(plot.points,plot.options,chart.dataset.plotId,width,width<500?240:264);
        points=[...chart.querySelectorAll('[data-chart-point]')];cursor=chart.querySelector('[data-chart-cursor]');
      };
      const observer=new ResizeObserver(reflow);observer.observe(chart);observers.add({chart,observer});reflow();
    }
    chart.addEventListener('click', selectFromEvent);
    chart.addEventListener('pointerover', selectFromEvent);
    chart.addEventListener('pointermove', selectFromEvent);
    chart.addEventListener('pointerleave', clear);
    chart.addEventListener('focusin', selectFromEvent);
    chart.addEventListener('focusout', event => { if (!chart.contains(event.relatedTarget)) clear(); });
    chart.querySelector('.trend-plot-scroll').addEventListener('scroll', clear);
    chart.addEventListener('keydown', event => {
      if (event.key === 'Escape') { clear(); return; }
      const point = event.target.closest('[data-chart-point]');
      if (!point) return;
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); show(point); return; }
      const index = points.indexOf(point);
      const next = {ArrowLeft: Math.max(0, index-1), ArrowRight: Math.min(points.length-1, index+1), Home: 0, End: points.length-1}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      points[next].focus();
      show(points[next]);
    });
  });
  pendingPlots.clear();
}

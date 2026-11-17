import {chartFingerprint,pendingRankCharts,rankListMarkup} from './financial-charts.mjs';
const mounted=new WeakMap(),played=new Set(),values=new Map();
const reduced=win=>Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
const masked=text=>String(text).includes('•');
export function unmountFinancialMotion(root){const state=mounted.get(root);if(!state)return;state.observer?.disconnect();state.resizeObserver?.disconnect();for(const timer of state.timers)clearTimeout(timer);for(const animation of state.animations)animation.cancel?.();for(const [event,handler]of Object.entries(state.handlers))root.removeEventListener(event,handler);state.tooltip.remove();mounted.delete(root);}
export function mountFinancialMotion(root,{revision=0,hideAmounts=false}={}){
 const document=root.ownerDocument,win=document.defaultView;let state=mounted.get(root);
 if(!state){
  const tooltip=document.createElement('div');tooltip.className='motion-tooltip';tooltip.id='financial-chart-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;tooltip.innerHTML='<span></span><strong></strong>';root.append(tooltip);
  state={tooltip,observer:null,timers:new Set(),animations:new Set(),charts:new WeakSet(),models:new WeakMap(),scaled:new WeakSet(),resizeObserver:null,handlers:{},current:null};mounted.set(root,state);
  const clear=()=>{state.current?.removeAttribute('aria-describedby');state.current?.classList.remove('chart-inspected');state.current=null;tooltip.hidden=true;};
  const show=target=>{
   if(!target)return;clear();state.current=target;target.setAttribute('aria-describedby',tooltip.id);target.classList.add('chart-inspected');tooltip.querySelector('span').textContent=target.dataset.chartLabel;tooltip.querySelector('strong').textContent=target.dataset.chartValue;tooltip.hidden=false;
   const box=target.getBoundingClientRect(),tip=tooltip.getBoundingClientRect(),width=tip.width||240,height=tip.height||64;
   tooltip.style.left=Math.max(12,Math.min((win.innerWidth||1024)-width-12,box.left+box.width/2-width/2))+'px';
   tooltip.style.top=Math.max(12,Math.min((win.innerHeight||768)-height-12,box.top-height-10>=12?box.top-height-10:box.bottom+10))+'px';
  };
  const sortChart=button=>{
   const chart=button.closest('[data-rank-chart]'),model=state.models.get(chart);if(!model)return;
   const list=chart.querySelector('.loan-rank-list'),before=new Map([...list.children].map(row=>[row.dataset.rankKey,row.getBoundingClientRect().top]));
   if(button.hasAttribute('data-rank-direction'))model.direction=model.direction==='desc'?'asc':'desc';else model.metric=button.dataset.rankMetric==='balance'?'balance':'interest';
   clear();list.innerHTML=rankListMarkup(model);
   chart.querySelectorAll('[data-rank-metric]').forEach(control=>control.setAttribute('aria-pressed',String(control.dataset.rankMetric===model.metric)));
   const direction=chart.querySelector('[data-rank-direction]');direction.textContent=model.direction==='desc'?'큰 금액순 ↓':'작은 금액순 ↑';
   if(!state.hidden&&!reduced(win))for(const row of list.children){const previous=before.get(row.dataset.rankKey),delta=previous===undefined?10:previous-row.getBoundingClientRect().top;if(!delta||typeof row.animate!=='function')continue;const animation=row.animate([{transform:`translateY(${delta}px)`,opacity:previous===undefined?0:1},{transform:'translateY(0)',opacity:1}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});state.animations.add(animation);animation.finished?.then(()=>state.animations.delete(animation),()=>state.animations.delete(animation));}
  };
  state.handlers={
   pointerover:event=>show(event.target.closest?.('[data-chart-inspect]')),
   pointerout:event=>{if(state.current&&!state.current.contains(event.relatedTarget))clear();},
   focusin:event=>show(event.target.closest?.('[data-chart-inspect]')),
   focusout:clear,
   click:event=>{const sort=event.target.closest?.('[data-rank-metric],[data-rank-direction]');if(sort){sortChart(sort);return;}const target=event.target.closest?.('[data-chart-inspect]');if(target)show(target);else clear();},
   keydown:event=>{if(event.key==='Escape'){clear();return;}const target=event.target.closest?.('[data-chart-inspect]');if(!target)return;if(['Enter',' '].includes(event.key)){event.preventDefault();show(target);return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const figure=target.closest('[data-motion-figure]')||target,points=[...figure.querySelectorAll('[data-chart-inspect]')];if(figure.matches('[data-chart-inspect]'))points.unshift(figure);const index=points.indexOf(target),next=event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,index+(event.key==='ArrowRight'?1:-1)));event.preventDefault();points[next]?.focus();show(points[next]);}
  };
  for(const [event,handler]of Object.entries(state.handlers))root.addEventListener(event,handler);
  const play=chart=>{
   const fingerprint=chart.dataset.motionKey;
   chart.classList.remove('motion-pending');
   if(played.has(fingerprint)||state.hidden||reduced(win)){chart.classList.add('motion-finished');return;}
   played.add(fingerprint);if(played.size>200)played.delete(played.values().next().value);chart.classList.add('motion-playing');
   const timer=setTimeout(()=>{chart.classList.remove('motion-playing');chart.classList.add('motion-finished');state.timers.delete(timer);},1500);timer.unref?.();state.timers.add(timer);
  };
  if(win.IntersectionObserver)state.observer=new win.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){state.observer.unobserve(entry.target);play(entry.target);}},{threshold:.1});
  state.play=play;
 }
 // Partial home drill-downs also use this mount; leave existing listeners and focus intact.
 state.hidden=hideAmounts;
 if(!state.resizeObserver&&win.ResizeObserver)state.resizeObserver=new win.ResizeObserver(entries=>{for(const {target}of entries){const [, ,width,height]=target.getAttribute('viewBox').split(' ').map(Number),box=target.getBoundingClientRect(),scale=Math.min(box.width/width,box.height/height);if(scale>0)target.style.setProperty('--chart-text-size',(12/scale)+'px');}});
 for(const svg of root.querySelectorAll('.financial-chart-scroll svg'))if(!state.scaled.has(svg)){state.scaled.add(svg);state.resizeObserver?.observe(svg);}
 for(const chart of root.querySelectorAll('[data-rank-chart]'))if(!state.models.has(chart)){const model=pendingRankCharts.get(chart.dataset.rankChart);if(model){state.models.set(chart,model);pendingRankCharts.delete(chart.dataset.rankChart);}}
 for(const chart of root.querySelectorAll('[data-motion-chart],[data-trend-chart]')){
  if(state.charts.has(chart))continue;state.charts.add(chart);
  if(!chart.dataset.motionKey){chart.dataset.motionKey='line:'+chartFingerprint([chart.querySelector('svg')?.getAttribute('aria-label'),[...chart.querySelectorAll('[data-chart-point]')].map(p=>[p.dataset.date,p.dataset.amount])]);chart.dataset.motionChart='';}
  if(hideAmounts||reduced(win)||played.has(chart.dataset.motionKey)){chart.classList.add('motion-finished');continue;}
  chart.classList.add('motion-pending');if(state.observer)state.observer.observe(chart);else state.play(chart);
 }
 for(const element of root.querySelectorAll('[data-motion-value]')){
  const key=element.dataset.motionValueKey,text=element.textContent,previous=values.get(key);if(!key||hideAmounts||masked(text))continue;
  if(previous&&previous.revision!==revision&&previous.text!==text&&!reduced(win)){element.classList.add('financial-value-changed');const timer=setTimeout(()=>{element.classList.remove('financial-value-changed');state.timers.delete(timer);},950);timer.unref?.();state.timers.add(timer);}
  values.set(key,{text,revision});if(values.size>500)values.delete(values.keys().next().value);
 }
}

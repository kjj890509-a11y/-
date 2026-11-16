import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderTrendChart, mountTrendCharts} from '../public/chart.mjs';

const points = [
  {label: '26.10', detailLabel: '2026.10.31 · 기록', value: -1250000, forecast: false},
  {label: '현재', detailLabel: '2026.11.16 · 현재', value: 59870000, forecast: false},
  {label: '26.11 말', detailLabel: '2026.11.30 · 월말 예상', value: 61230000, forecast: true}
];
const format = {
  formatMoney: value => new Intl.NumberFormat('ko-KR').format(value) + '원',
  formatCompact: value => String(Math.round(value / 10000)) + '만'
};
function setup(data = points, options = format) {
  const {document, Event} = parseHTML('<main>' + renderTrendChart(data, options) + '</main>');
  mountTrendCharts(document);
  const nodes = [...document.querySelectorAll('[data-chart-point]')];
  const click = index => nodes[index].querySelector('.chart-dot').dispatchEvent(new Event('click', {bubbles: true}));
  const press = (index, key) => {
    const event = Object.assign(new Event('keydown', {bubbles: true, cancelable: true}), {key});
    nodes[index].dispatchEvent(event);
    return event;
  };
  return {document, Event, nodes, click, press};
}

test('clicking a chart circle shows the date and amount without forecast wording', () => {
  const {document, nodes, click} = setup();
  assert.ok(document.querySelector('[data-chart-tooltip]').hasAttribute('hidden'));
  assert.doesNotMatch(document.querySelector('[data-trend-chart]').outerHTML,/월말 예상/);
  for (let index = 0; index < points.length; index++) {
    click(index);
    assert.equal(document.querySelector('[data-chart-readout-label]').textContent, points[index].detailLabel.split(' · ')[0]);
    assert.equal(document.querySelector('[data-chart-readout-value]').textContent, format.formatMoney(points[index].value));
    const date = points[index].detailLabel.split(' · ')[0];
    assert.equal(document.querySelector('[data-chart-tooltip-date]').textContent, date);
    assert.equal(document.querySelector('[data-chart-tooltip-value]').textContent, format.formatMoney(points[index].value));
    assert.equal(document.querySelector('[data-chart-tooltip]').textContent, date + format.formatMoney(points[index].value));
    assert.equal(document.querySelector('[data-chart-tooltip]').hasAttribute('hidden'), false);
    assert.equal(nodes.filter(node => node.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(nodes[index].getAttribute('aria-pressed'), 'true');
  }
});

test('the larger hit area, pointer hover and keyboard focus all reveal a point', () => {
  const {document, Event, nodes} = setup();
  nodes[0].querySelector('.chart-hit-area').dispatchEvent(new Event('click', {bubbles: true}));
  assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '-1,250,000원');
  nodes[1].dispatchEvent(new Event('pointerover', {bubbles: true}));
  assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '59,870,000원');
  nodes[2].querySelector('.chart-hit-area').dispatchEvent(new Event('pointermove', {bubbles: true}));
  assert.equal(document.querySelector('[data-chart-tooltip]').textContent, '2026.11.3061,230,000원');
  assert.equal(document.querySelector('[data-chart-tooltip]').hasAttribute('hidden'), false);
  document.querySelector('[data-trend-chart]').dispatchEvent(new Event('pointerleave'));
  assert.equal(document.querySelector('[data-chart-tooltip]').hasAttribute('hidden'), true);
  nodes[2].dispatchEvent(new Event('focusin', {bubbles: true}));
  assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '61,230,000원');
});

test('keyboard navigation selects adjacent and endpoint values, and Escape dismisses the readout', () => {
  const {document, nodes, press} = setup();
  for (const key of ['Enter', ' ']) {
    assert.equal(press(1, key).defaultPrevented, true);
    assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '59,870,000원');
  }
  for (const [index, key, expected] of [[1,'ArrowLeft',0],[0,'ArrowLeft',0],[0,'ArrowRight',1],[1,'End',2],[2,'ArrowRight',2],[2,'Home',0]]) {
    assert.equal(press(index, key).defaultPrevented, true);
    assert.equal(nodes[expected].getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelector('[data-chart-readout-value]').textContent, format.formatMoney(points[expected].value));
  }
  press(0, 'Escape');
  assert.ok(document.querySelector('[data-chart-tooltip]').hasAttribute('hidden'));
  assert.ok(document.querySelector('[data-chart-cursor]').hasAttribute('hidden'));
  assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '');
  assert.match(document.querySelector('[data-chart-readout-label]').textContent, /마우스를 올리거나 터치/);
});

test('amount hiding also masks the tooltip, point labels, live readout and accessible table', () => {
  const hiddenFormat = {formatMoney: () => '••••••', formatCompact: () => '••••'};
  const {document, nodes, click} = setup(points, hiddenFormat);
  points.forEach((_, index) => click(index));
  assert.equal(document.querySelector('[data-chart-tooltip-value]').textContent, '••••••');
  assert.equal(document.querySelector('[data-chart-readout-value]').textContent, '••••••');
  assert.ok(nodes.every(node => node.getAttribute('aria-label').includes('••••••')));
  for (const point of points) {
    assert.equal(document.documentElement.outerHTML.includes(format.formatMoney(point.value)), false);
    assert.equal(document.documentElement.outerHTML.includes(String(point.value)), false);
  }
});

test('single, flat and negative series remain selectable, with tooltips inside the viewport', () => {
  for (const values of [[0], [-4000000], [0,0,0], [-6000000,-3000000,-8000000]]) {
    const data = values.map((value, index) => ({label: String(index), value, forecast: false}));
    const {document, click} = setup(data);
    document.querySelector('[data-chart-tooltip]').getBoundingClientRect = () => ({width:320,height:80});
    assert.doesNotMatch(document.documentElement.outerHTML, /NaN|Infinity/);
    values.forEach((value, index) => {
      click(index);
      const tooltip = document.querySelector('[data-chart-tooltip]');
      const x = parseFloat(tooltip.style.left), y = parseFloat(tooltip.style.top);
      assert.ok(x >= 16 && x + 320 <= 1024-16);
      assert.ok(y >= 16 && y + 80 <= 768-16);
      assert.equal(document.querySelector('[data-chart-readout-value]').textContent, format.formatMoney(value));
    });
  }
  assert.match(renderTrendChart([], format), /자산 기록을 남기면/);
});

test('multiple charts keep independent selection and unique reveal masks', () => {
  const {document, Event} = parseHTML('<main>' + renderTrendChart(points, format) + renderTrendChart(points.slice(0,1), format) + '</main>');
  mountTrendCharts(document);
  const charts = [...document.querySelectorAll('[data-trend-chart]')];
  const maskIds = [...document.querySelectorAll('clipPath')].map(mask => mask.id);
  assert.equal(new Set(maskIds).size, 2);
  charts[0].querySelector('[data-chart-point]').dispatchEvent(new Event('click', {bubbles:true}));
  assert.equal(charts[0].querySelector('[data-chart-readout-value]').textContent, '-1,250,000원');
  assert.equal(charts[1].querySelector('[data-chart-readout-value]').textContent, '');
});

test('point labels remain text when included in markup and an opened tooltip', () => {
  const label = '<img src=x onerror=alert(1)>';
  const {document, click} = setup([{label, detailLabel:label, value:100, forecast:false}]);
  click(0);
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.equal(document.querySelector('[data-chart-readout-label]').textContent, label);
  assert.equal(document.querySelector('[data-chart-tooltip]').textContent, label + '100원');
});

test('the amount popup fits a narrow viewport and is dismissed when scrolling the graph', () => {
  const {document, Event, nodes} = setup();
  const viewport = document.defaultView;
  const previousWidth = viewport.innerWidth, previousHeight = viewport.innerHeight;
  viewport.innerWidth = 390; viewport.innerHeight = 844;
  try {
    const chart = document.querySelector('[data-trend-chart]');
    const tooltip = document.querySelector('[data-chart-tooltip]');
    chart.getBoundingClientRect = () => ({left:20,top:700});
    chart.querySelector('svg').getBoundingClientRect = () => ({left:-280,top:700,width:760});
    tooltip.getBoundingClientRect = () => ({width:320,height:80});
    const hover = Object.assign(new Event('pointermove',{bubbles:true}),{clientX:370,clientY:790});
    nodes[2].querySelector('.chart-hit-area').dispatchEvent(hover);
    const x = parseFloat(tooltip.style.left)+20, y = parseFloat(tooltip.style.top)+700;
    assert.ok(x >= 16 && x+320 <= 390-16);
    assert.ok(y >= 16 && y+80 <= 844-16);
    assert.equal(tooltip.textContent,'2026.11.3061,230,000원');
    chart.querySelector('.trend-plot-scroll').dispatchEvent(new Event('scroll'));
    assert.ok(tooltip.hasAttribute('hidden'));
  } finally {
    viewport.innerWidth = previousWidth; viewport.innerHeight = previousHeight;
  }
});

test('responsive chart layout reflows coordinates at phone and desktop widths while keeping every point selectable',()=>{
 const {document,Event}=parseHTML('<main>'+renderTrendChart(points,format)+'</main>');
 let notifyResize, width=320;
 const chart=document.querySelector('[data-trend-chart]');
 chart.querySelector('.trend-plot-scroll').getBoundingClientRect=()=>({width});
 const previous=document.defaultView.ResizeObserver;
 document.defaultView.ResizeObserver=class{constructor(callback){notifyResize=callback;}observe(){}disconnect(){}};
 try{
  mountTrendCharts(document);
  for(width of [320,900,375]){
   notifyResize();
   assert.equal(chart.querySelector('svg').getAttribute('viewBox'),`0 0 ${width} ${width<500?240:264}`);
   const visible=[...chart.querySelectorAll('[data-chart-point]')];
   assert.equal(visible.length,points.length);
   for(let i=0;i<visible.length;i++){
    assert.ok(Number(visible[i].dataset.x)>=64&&Number(visible[i].dataset.x)<=width-24);
    visible[i].dispatchEvent(new Event('pointerover',{bubbles:true}));
    assert.equal(chart.querySelector('[data-chart-readout-value]').textContent,format.formatMoney(points[i].value));
   }
  }
 }finally{document.defaultView.ResizeObserver=previous;}
});

import * as workspace from '../public/workspace.mjs';
import * as navigation from '../public/navigation.mjs';
import * as dashboard from '../public/dashboard-view.mjs';
import * as disclosure from '../public/disclosure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import * as domain from '../public/domain.mjs';
import * as charts from '../public/chart.mjs';
import {renderLoanForecastPanel} from '../public/loan-forecast.mjs';
import * as loansPage from '../public/loans-page.mjs';

const formatMoney = value => new Intl.NumberFormat('ko-KR').format(value) + '원';
function portfolio() {
  const data = domain.emptyPortfolio();
  const base = {institution:'', rate:12, method:'원금균등', note:''};
  data.loans = [
    {...base, id:'first', name:'자동 추정 대출', balance:1200, principal:400, interest:12, interestMode:'estimate', day:25},
    {...base, id:'second', name:'직접 입력 대출', balance:900, principal:300, interest:9, interestMode:'manual', day:10}
  ];
  return data;
}
function render(data, asOf = '2026-11-16', formatter = formatMoney, loanId = '') {
  return parseHTML('<main>' + renderLoanForecastPanel(data, {asOf, formatMoney:formatter, loanId}) + '</main>').document;
}
const values = row => ['openingBalance','principal','interest','payment','balance'].map(field => row.querySelector('[data-field="'+field+'"]').textContent);

test('monthly loan balances show each loan and the total without repeating past repayments', () => {
  const data = portfolio(), original = structuredClone(data);
  const document = render(data);
  const rows = [...document.querySelectorAll('[data-loan-month]')];
  assert.equal(rows.length, 12);
  assert.equal(rows[0].querySelector('summary > span').textContent, '2026-11');
  assert.equal(rows.at(-1).querySelector('summary > span').textContent, '2027-10');
  assert.deepEqual(values(rows[0]), ['2,100원','400원','12원','412원','1,700원']);
  assert.deepEqual(values(rows[1]), ['1,700원','700원','17원','717원','1,000원']);
  assert.equal(rows[2].querySelector('[data-field="interest"]').textContent, '10원');
  const monthlyAssetForecast = domain.forecastMonths(data, '2026-11-16', 12);
  rows.forEach((row, index) => assert.equal(row.querySelector('.loan-balance-total').textContent, formatMoney(monthlyAssetForecast[index].loans)));
  assert.deepEqual(data, original);
});

test('a repayment on the baseline date is already reflected in the current balance', () => {
  const document = render(portfolio(), '2026-11-25');
  assert.deepEqual(values(document.querySelector('[data-loan-month]')), ['2,100원','0원','0원','0원','2,100원']);
});

test('payoff caps the final principal and stops interest, while interest-only balances remain unchanged', () => {
  const data = portfolio();
  data.loans = [{...data.loans[0],balance:600,principal:1000}];
  let document = render(data);
  const rows = [...document.querySelectorAll('[data-loan-month]')];
  assert.deepEqual(values(rows[0]), ['600원','600원','6원','606원','0원']);
  assert.match(rows[0].textContent, /상환 완료 예상/);
  assert.ok(rows.slice(1).every(row => [...row.querySelectorAll('[data-field]')].every(td => td.textContent === '0원')));
  data.loans = [{...data.loans[0],balance:5000,principal:0,interest:55,interestMode:'manual'}];
  document = render(data);
  assert.ok([...document.querySelectorAll('[data-loan-month]')].every(row => row.querySelector('.loan-balance-total').textContent === '5,000원'));
  assert.equal(document.querySelectorAll('[data-loan-month]')[0].querySelector('[data-field="interest"]').textContent, '50원');
  assert.equal(data.loans[0].interest, 55);
  assert.match(document.querySelector('.loan-interest-hint').textContent, /매월 상환 원금이 0원/);
  assert.equal(renderLoanForecastPanel(domain.emptyPortfolio(), {formatMoney}), '');
});

test('the forecast masks money and treats loan names as text', () => {
  const data = portfolio();
  data.loans[0].name = '<img src=x onerror=alert(1)>';
  const document = render(data, '2026-11-16', () => '••••••');
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.equal(document.querySelector('option[value="first"]').textContent, data.loans[0].name);
  assert.ok([...document.querySelectorAll('[data-field]')].every(td => td.textContent.startsWith('••••••')));
  assert.doesNotMatch(document.documentElement.outerHTML, /1,700원|1,200원|900원/);
});

test('the loan management page mounts the forecast and preserves amount hiding', async () => {
  const {document,window,Event} = parseHTML(readFileSync(new URL('../public/index.html', import.meta.url),'utf8'));
  window.scrollTo = () => {};
  for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
  let requestCount = 0;
  const context = vm.createContext({...workspace,...navigation,...dashboard,...disclosure,
    ...domain, ...charts, ...loansPage, renderLoanForecastPanel, document, window,
    localStorage:{getItem:()=>null,setItem:()=>{}}, location:{hash:'#loans'},
    Intl, setTimeout, clearTimeout, structuredClone, crypto,
    fetch:async () => { requestCount++; return {ok:true,json:async()=>({data:portfolio(),revision:1})}; }
  });
  const source = readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source,context);
  await new Promise(setImmediate);
  assert.equal(document.querySelector('h1').firstChild.textContent, '대출 현황');
  assert.equal(document.querySelectorAll('.loan-forecast-panel').length, 1);
  assert.equal(document.querySelectorAll('.loan-forecast-panel [data-loan-month]').length, 12);
  assert.equal(document.querySelectorAll('[data-loan-card]').length, 2);
  assert.equal(document.querySelector('[data-loan-card="first"] [data-loan-amount="balance"]').textContent,'1,200원');
  assert.equal(document.querySelector('[data-loan-card="first"] [data-loan-amount="payment"]').textContent,'412원');
  assert.equal(document.querySelector('[data-loan-card="second"] [data-loan-amount="payment"]').textContent,'309원');
  assert.equal(document.querySelectorAll('#main .ledger-table').length, 1);
  assert.ok([...document.querySelectorAll('.loan-card-details')].every(details=>!details.hasAttribute('open')));
  document.querySelector('.loan-card-details').setAttribute('open','');
  const search=document.getElementById('loan-card-search');search.value='직접 입력';search.dispatchEvent(new Event('input',{bubbles:true}));
  assert.equal(document.querySelectorAll('[data-loan-card]').length,1);
  assert.equal(document.querySelector('[data-loan-card]').dataset.loanCard,'second');
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  assert.equal(document.querySelectorAll('[data-loan-card]').length,2);
  assert.ok(document.querySelector('.loan-card-details').hasAttribute('open'));
  document.querySelector('[data-loan-card="first"] [data-action="edit"]').dispatchEvent(new Event('click',{bubbles:true}));
  assert.ok(document.getElementById('editor').hasAttribute('open'));
  assert.equal(document.getElementById('field-principal').value,'400');
  document.getElementById('editor').close();
  assert.equal(document.querySelector('.loan-forecast-panel').closest('details'),null);
  document.querySelector('[data-action="loan-forecast"][data-id="second"]').dispatchEvent(new Event('click',{bubbles:true}));
  assert.equal(document.querySelector('.loan-forecast-panel').closest('details'),null);
  assert.equal(document.querySelector('#loan-forecast-select').value,'second');
  const select=document.querySelector('#loan-forecast-select');
  for(const option of select.querySelectorAll('option'))option.removeAttribute('selected');
  select.querySelector('option[value="first"]').setAttribute('selected','');
  select.dispatchEvent(new Event('change',{bubbles:true}));
  assert.equal(document.querySelector('[data-forecast-loan]').dataset.forecastLoan,'first');
  assert.equal(document.querySelector('.loan-forecast-panel').closest('details'),null);
  document.querySelector('.loan-month').setAttribute('open','');
  document.querySelector('.loan-month [data-info-template]').dispatchEvent(new Event('click',{bubbles:true}));
  assert.ok(document.querySelector('#ui-info-dialog').hasAttribute('open'));
  assert.match(document.querySelector('#ui-info-dialog').textContent,/상환 전 잔액 − 상환 원금 = 상환 후 잔액/);
  document.getElementById('privacy-toggle').onclick();
  assert.equal(document.querySelector('#ui-info-dialog').hasAttribute('open'),false);
  assert.equal(document.querySelector('#ui-info-dialog [data-ui-info-content]').textContent,'');
  assert.ok([...document.querySelectorAll('.loan-forecast-panel [data-field]')].every(td => td.textContent.startsWith('••••••')));
  assert.ok([...document.querySelectorAll('[data-loan-amount]')].every(field=>field.textContent.startsWith('••••••')));
  assert.equal(requestCount, 2); // Portfolio and independent saved-view preferences.
});

test('each loan visibly subtracts its own principal and includes interest only in its payment',()=>{
  const data=portfolio();
  const first=render(data,'2026-11-16',formatMoney,'first');
  const second=render(data,'2026-11-16',formatMoney,'second');
  assert.deepEqual(values(first.querySelectorAll('[data-loan-month]')[0]),['1,200원','400원','12원','412원','800원']);
  assert.deepEqual(values(first.querySelectorAll('[data-loan-month]')[1]),['800원','400원','8원','408원','400원']);
  assert.deepEqual(values(second.querySelectorAll('[data-loan-month]')[0]),['900원','0원','0원','0원','900원']);
  assert.match(second.querySelector('[data-loan-month]').textContent,/이달 상환일 경과/);
  assert.deepEqual(values(second.querySelectorAll('[data-loan-month]')[1]),['900원','300원','9원','309원','600원']);
  data.loans[0].method='원리금균등';
  const annuity=render(data,'2026-11-16',formatMoney,'first');
  assert.deepEqual(values(annuity.querySelectorAll('[data-loan-month]')[1]),['800원','404원','8원','412원','396원']);
});

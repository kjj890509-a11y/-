import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {samplePortfolio,emptyPortfolio} from '../public/domain.mjs';
import {viewLabels} from '../public/navigation.mjs';
import {searchDashboard,renderDashboardSearch,tableCSV,enhanceTableExports} from '../public/dashboard-tools.mjs';

test('dashboard search finds Korean menus and owned records, normalizes spacing and excludes financial amounts',()=>{
 const data=samplePortfolio(),before=structuredClone(data);
 assert.ok(searchDashboard(data,'예 금',viewLabels).some(row=>row.route==='deposits'&&!row.id));
 const account=data.deposits[0];
 assert.ok(searchDashboard(data,account.name,viewLabels).some(row=>row.id===account.id));
 assert.ok(searchDashboard(data,account.institution,viewLabels).some(row=>row.id===account.id));
 assert.equal(searchDashboard(emptyPortfolio(),account.name,viewLabels).some(row=>row.id===account.id),false);
 assert.ok(searchDashboard(data,'',viewLabels).every(row=>!row.id));
 assert.ok(!JSON.stringify(searchDashboard(data,account.name,viewLabels)).includes(String(account.balance)));
 assert.deepEqual(data,before);
});

test('search results remain text for untrusted account names and are capped',()=>{
 const data=emptyPortfolio();data.deposits=Array.from({length:60},(_,i)=>({id:String(i),name:'<img src=x onerror=alert(1)>',institution:'은행'}));
 const results=searchDashboard(data,'img',viewLabels);assert.equal(results.length,40);
 const {document}=parseHTML('<main>'+renderDashboardSearch(results,'img')+'</main>');
 assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('strong').textContent,/<img/);
 assert.equal(document.querySelectorAll('[data-search-route]').length,40);
});

test('CSV exports displayed rows and masks while excluding action columns and escaping spreadsheet formulas',()=>{
 const {document}=parseHTML('<table><thead><tr><th>이름</th><th>금액</th><th></th></tr></thead><tbody><tr><td>=HYPERLINK("https://bad.test")<small>은행</small></td><td>••••••</td><td><button>삭제</button></td></tr><tr><td>여행, 통장</td><td>100원</td><td></td></tr></tbody></table>');
 const table=document.querySelector('table'),csv=tableCSV(table);
 assert.ok(csv.startsWith('\ufeff'));
 assert.ok(csv.includes('"\'=HYPERLINK(""https://bad.test"") 은행"'));
 assert.ok(csv.includes('"••••••"'));
 assert.ok(csv.includes('"여행, 통장"'));
 assert.ok(!csv.includes('삭제'));
 table.querySelector('tbody tr:last-child').remove();
 assert.ok(!tableCSV(table).includes('100원'));
});

test('export controls read the current table after filtering and mount once',()=>{
 const {document,Event}=parseHTML('<main><section class="table-panel"><div class="table-heading"><h2>예금 내역</h2></div><table><thead><tr><th>예금</th></tr></thead><tbody><tr><td>처음 계좌</td></tr></tbody></table></section></main>');
 const exports=[],root=document.querySelector('main');
 const options={onExport:(csv,title)=>exports.push({csv,title})};
 enhanceTableExports(root,options);enhanceTableExports(root,options);
 assert.equal(root.querySelectorAll('[data-table-export]').length,1);
 root.querySelector('td').textContent='필터된 계좌';
 root.querySelector('[data-table-export]').dispatchEvent(new Event('click',{bubbles:true}));
 assert.equal(exports[0].title,'예금 내역');assert.ok(exports[0].csv.includes('필터된 계좌'));assert.ok(!exports[0].csv.includes('처음 계좌'));
});

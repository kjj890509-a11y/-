const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
export function searchDashboard(data,query,labels){
 const needle=normalize(query),results=[];
 for(const [route,label]of Object.entries(labels))if(!needle||normalize(label).includes(needle))results.push({route,title:label,description:'메뉴'});
 if(needle)for(const kind of ['deposits','stocks','retirement','loans','cards','cashflow','fixed'])for(const row of data[kind]||[]){
  if(normalize(row.name+' '+(row.institution||'')).includes(needle))results.push({route:kind,kind,id:row.id,title:row.name,description:[labels[kind],row.institution].filter(Boolean).join(' · ')});
 }
 return results.slice(0,40);
}
export function renderDashboardSearch(results,query){
 return `<p class="command-caption" role="status">${query.trim()?`검색 결과 ${results.length}개`:'메뉴 바로가기'}</p><div class="command-results">${results.map(row=>`<button type="button" data-search-route="${esc(row.route)}" ${row.id?`data-search-kind="${esc(row.kind)}" data-search-id="${esc(row.id)}"`:''}><span><strong>${esc(row.title)}</strong><small>${esc(row.description)}</small></span><span aria-hidden="true">↗</span></button>`).join('')||'<p class="command-empty">일치하는 메뉴나 내역이 없습니다.</p>'}</div>`;
}
export function tableCSV(table){
 const clean=cell=>{
  const clone=cell.cloneNode(true);clone.querySelectorAll('button,svg,[aria-hidden="true"],.row-actions').forEach(node=>node.remove());
  // Preserve separate lines for names, dates and helper labels in a single spreadsheet cell.
  clone.querySelectorAll('small,br').forEach(node=>node.before(clone.ownerDocument.createTextNode(' ')));
  let value=clone.textContent.replace(/\s+/g,' ').trim();
  if(/^[=+\-@\t\r\n]/.test(value))value="'"+value;
  return '"'+value.replaceAll('"','""')+'"';
 };
 const rows=[...table.querySelectorAll('thead tr,tbody tr')];
 if(!rows.length)return '';
 const headers=[...rows[0].children],columns=headers.map((cell,index)=>cell.textContent.trim()?index:-1).filter(index=>index>=0);
 return '\ufeff'+rows.map(row=>columns.map(index=>clean(row.children[index]||row.ownerDocument.createElement('td'))).join(',')).join('\r\n');
}
export function enhanceTableExports(root,{onExport}){
 root.querySelectorAll('.table-panel').forEach(panel=>{
  const table=panel.querySelector('table'),heading=panel.querySelector('.table-heading');
  if(!table||!heading||heading.querySelector('[data-table-export]'))return;
  const title=heading.querySelector('h2')?.textContent.trim()||'조회 내역';
  const button=root.ownerDocument.createElement('button');button.type='button';button.className='button secondary small table-export';button.dataset.tableExport='';button.textContent='CSV 다운로드';button.setAttribute('aria-label',title+' CSV 다운로드');
  button.addEventListener('click',()=>onExport(tableCSV(table),title));heading.append(button);
 });
}

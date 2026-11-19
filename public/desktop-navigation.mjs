import {layoutDots} from './record-layout.mjs';

const storageKey='moa-desktop-menu-v1';
const chevron='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 3 5 5-5 5"/></svg>';
const handle=(kind,label)=>`<button type="button" class="desk-${kind}-handle" aria-label="${label} 순서 이동" aria-keyshortcuts="ArrowUp ArrowDown${kind==='item'?' Shift+ArrowUp Shift+ArrowDown':''}" title="드래그 또는 위아래 방향키로 이동">${layoutDots}</button>`;

function restoreMenu(groups,storage) {
 const defaults=groups.map(group=>({
  id:group.id,
  label:group.label,
  items:[group.defaultView,...group.views.filter(key=>key!==group.defaultView)]
 }));
 let saved;
 try {saved=JSON.parse(storage.getItem(storageKey));}catch{saved=null;}
 const knownGroups=new Map(defaults.map(group=>[group.id,group]));
 const knownItems=new Set(defaults.flatMap(group=>group.items));
 const restored=new Map(),used=new Set();
 for(const group of Array.isArray(saved)?saved:[]){
  if(!group||!knownGroups.has(group.id)||restored.has(group.id))continue;
  const items=[];
  for(const key of Array.isArray(group.items)?group.items:[]){
   if(!knownItems.has(key)||used.has(key))continue;
   items.push(key);used.add(key);
  }
  restored.set(group.id,{...knownGroups.get(group.id),collapsed:group.collapsed===true,items});
 }
 for(const group of defaults){
  const current=restored.get(group.id)||{...group,items:[]};
  current.items.push(...group.items.filter(key=>!used.has(key)));
  restored.set(group.id,current);
 }
 return [...restored.values()];
}

export function mountDesktopNavigation(root,groups,{
 labels,icon,storage,onFeedback=()=>{},loadSortable=()=>import('/sortable.mjs')
}){
 const defaultViews=new Set(groups.map(group=>group.defaultView));
 root.innerHTML=restoreMenu(groups,storage).map(group=>`
  <div class="desk-menu-group" data-sidebar-group="${group.id}">
   <div class="desk-menu-heading">
    ${handle('group',group.label)}
    <button type="button" class="desk-menu-toggle" aria-expanded="${!group.collapsed}" aria-controls="desk-menu-${group.id}">
     <span>${group.label}</span>${chevron}
    </button>
   </div>
   <div class="desk-menu-items" data-sidebar-items id="desk-menu-${group.id}" ${group.collapsed?'hidden':''}>
    ${group.items.map(key=>`<div class="desk-menu-row" data-sidebar-item="${key}">
     ${handle('item',labels[key])}
     <a href="#${key}" class="desk-menu-item${defaultViews.has(key)?' nav-link':''}">${icon(key)}<span>${labels[key]}</span></a>
    </div>`).join('')}
   </div>
  </div>`).join('');

 let mounted=true,currentView;
 const sortables=[];
 const menuGroups=()=>[...root.querySelectorAll('[data-sidebar-group]')];
 const itemLists=()=>[...root.querySelectorAll('[data-sidebar-items]')];
 function setActive(view){
  currentView=view;
  for (const group of menuGroups()) {
   let active=false;
   for (const link of group.querySelectorAll('.desk-menu-item')) {
    const current=link.getAttribute('href')==='#'+view;
    link.classList.toggle('active',current);
    if(current){link.setAttribute('aria-current','page');active=true;}
    else link.removeAttribute('aria-current');
   }
   group.toggleAttribute('data-current-group',active);
  }
 }
 function collapse(group,closed){
  group.querySelector('[data-sidebar-items]').toggleAttribute('hidden',closed);
  group.querySelector('.desk-menu-toggle').setAttribute('aria-expanded',String(!closed));
 }
 function save(){
  const layout=menuGroups().map(group=>{
   const items=group.querySelector('[data-sidebar-items]');
   return {id:group.dataset.sidebarGroup,collapsed:items.hasAttribute('hidden'),items:[...items.children].map(row=>row.dataset.sidebarItem)};
  });
  try{storage.setItem(storageKey,JSON.stringify(layout));}
  catch{onFeedback('이 브라우저에 메뉴 배치를 저장하지 못했어요.');}
 }
 const onClick=event=>{
  const toggle=event.target.closest('.desk-menu-toggle');
  if(!toggle)return;
  collapse(toggle.closest('[data-sidebar-group]'),toggle.getAttribute('aria-expanded')==='true');
  save();
 };
 const onKey=event=>{
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  const button=event.target.closest('.desk-group-handle,.desk-item-handle');
  if(!button)return;
  event.preventDefault();
  const up=event.key==='ArrowUp',group=button.closest('[data-sidebar-group]');
  const item=button.closest('[data-sidebar-item]');
  if(item&&event.shiftKey){
   const nextGroup=up?group.previousElementSibling:group.nextElementSibling;
   if(!nextGroup)return;
   collapse(nextGroup,false);
   nextGroup.querySelector('[data-sidebar-items]').append(item);
  }else{
   const node=item||group,neighbor=up?node.previousElementSibling:node.nextElementSibling;
   if(!neighbor)return;
   node.parentElement.insertBefore(node,up?neighbor:neighbor.nextElementSibling);
  }
  button.focus();
  setActive(currentView);
  save();
 };
 root.addEventListener('click',onClick);
 root.addEventListener('keydown',onKey);
 const finish=()=>{
  if(!mounted)return;
  root.classList.remove('desk-sorting-items');
  setActive(currentView);
  save();
 };
 loadSortable().then(({default:Sortable})=>{
  if(!mounted)return;
  const shared={animation:150,ghostClass:'desk-menu-ghost',setData:transfer=>transfer.setData('text/plain',''),onEnd:finish};
  sortables.push(Sortable.create(root,{...shared,handle:'.desk-group-handle',draggable:'[data-sidebar-group]'}));
  for(const list of itemLists())sortables.push(Sortable.create(list,{
   ...shared,group:'desktop-sidebar-items',handle:'.desk-item-handle',draggable:'[data-sidebar-item]',
   onStart:()=>root.classList.add('desk-sorting-items')
  }));
 }).catch(()=>{
  if(mounted)for(const button of root.querySelectorAll('.desk-group-handle,.desk-item-handle')){
   button.title='위아래 방향키로 이동';
  }
 });
 return {setActive,destroy(){
  mounted=false;
  for(const sortable of sortables)sortable.destroy();
  root.removeEventListener('click',onClick);
  root.removeEventListener('keydown',onKey);
  root.classList.remove('desk-sorting-items');
 }};
}

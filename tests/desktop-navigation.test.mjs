import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountDesktopNavigation,navigationGroups,viewLabels} from '../public/navigation.mjs';

const key='moa-desktop-menu-v1';
const tick=()=>new Promise(setImmediate);

function sidebar(storage=new Map()){
 const {document,Event}=parseHTML('<nav id="main-nav"></nav>');
 const root=document.getElementById('main-nav');
 const sortables=new Map();
 const navigation=mountDesktopNavigation(root,navigationGroups,{
  labels:viewLabels,icon:()=>'<svg aria-hidden="true"></svg>',
  storage:{getItem:name=>storage.get(name)||null,setItem:(name,value)=>storage.set(name,value)},
  loadSortable:async()=>({default:{create(element,options){
   sortables.set(element,options);
   return {destroy(){sortables.delete(element);}};
  }}})
 });
 const find=selector=>root.querySelector(selector);
 const group=id=>find(`[data-sidebar-group="${id}"]`);
 const list=id=>group(id).querySelector('[data-sidebar-items]');
 const groups=()=>[...root.children].map(element=>element.dataset.sidebarGroup);
 const items=id=>[...list(id).children].map(element=>element.dataset.sidebarItem);
 const click=element=>element.dispatchEvent(new Event('click',{bubbles:true}));
 const move=(element,direction,shiftKey=false)=>element.dispatchEvent(Object.assign(
  new Event('keydown',{bubbles:true,cancelable:true}),{key:direction,shiftKey}
 ));
 return {root,navigation,sortables,group,list,groups,items,find,click,move,storage};
}

test('accordion visibility persists and identifies a collapsed group containing the active page',()=>{
 const t=sidebar();
 const toggle=t.group('assets').querySelector('.desk-menu-toggle');
 assert.equal(toggle.getAttribute('aria-controls'),t.list('assets').id);
 t.navigation.setActive('stocks');
 t.click(toggle);
 assert.equal(toggle.getAttribute('aria-expanded'),'false');
 assert.equal(t.list('assets').hasAttribute('hidden'),true);
 assert.equal(t.group('assets').hasAttribute('data-current-group'),true);
 const reloaded=sidebar(t.storage);
 assert.equal(reloaded.list('assets').hasAttribute('hidden'),true);
 assert.equal(reloaded.list('flow').hasAttribute('hidden'),false);
 reloaded.click(reloaded.group('assets').querySelector('.desk-menu-toggle'));
 assert.equal(reloaded.list('assets').hasAttribute('hidden'),false);
 t.navigation.destroy();
 reloaded.navigation.destroy();
});

test('group and nested Sortable drops preserve every link and restore the customized order',async()=>{
 const t=sidebar();
 await tick();
 assert.equal(t.sortables.get(t.root).handle,'.desk-group-handle');
 assert.equal(t.sortables.get(t.list('assets')).handle,'.desk-item-handle');
 assert.equal(t.sortables.get(t.list('assets')).group,t.sortables.get(t.list('flow')).group);
 t.root.insertBefore(t.group('flow'),t.group('assets'));
 t.sortables.get(t.root).onEnd();
 t.navigation.setActive('deposits');
 t.list('flow').append(t.find('[data-sidebar-item="deposits"]'));
 t.sortables.get(t.list('flow')).onEnd();
 assert.equal(t.group('flow').hasAttribute('data-current-group'),true);
 assert.equal(t.group('assets').hasAttribute('data-current-group'),false);
 assert.equal(t.find('[aria-current="page"]').getAttribute('href'),'#deposits');
 const reloaded=sidebar(t.storage);
 assert.deepEqual(reloaded.groups().slice(0,3),['home','flow','assets']);
 assert.equal(reloaded.items('flow').at(-1),'deposits');
 assert.ok(!reloaded.items('assets').includes('deposits'));
 assert.equal(new Set(reloaded.groups().flatMap(id=>reloaded.items(id))).size,Object.keys(viewLabels).length);
 t.navigation.destroy();
 assert.equal(t.sortables.size,0);
 reloaded.navigation.destroy();
});

test('keyboard movement works across groups and saved data retains new menu links',()=>{
 const storage=new Map([[key,JSON.stringify([
  {id:'flow',collapsed:true,items:['records','stocks','stocks','invalid']},
  {id:'unknown',items:['entry']},
  {id:'assets',items:['assets','stocks','deposits']}
 ])]]);
 const t=sidebar(storage);
 assert.deepEqual(t.groups().slice(0,3),['flow','assets','home']);
 assert.deepEqual(t.items('flow').slice(0,2),['records','stocks']);
 assert.deepEqual(t.items('assets'),['assets','deposits','retirement']);
 t.move(t.find('[data-sidebar-item="deposits"] .desk-item-handle'),'ArrowUp');
 assert.equal(t.items('assets')[0],'deposits');
 t.move(t.find('[data-sidebar-item="deposits"] .desk-item-handle'),'ArrowUp',true);
 assert.equal(t.items('flow').at(-1),'deposits');
 assert.equal(t.list('flow').hasAttribute('hidden'),false);
 t.move(t.group('assets').querySelector('.desk-group-handle'),'ArrowUp');
 assert.equal(t.groups()[0],'assets');
 t.navigation.destroy();
});

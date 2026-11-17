import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {palettes,paletteURL} from '../public/palette-config.mjs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function ratio(a,b){const l=c=>{const v=c.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('five palettes keep readable body, muted and accent text contrast',()=>{
 assert.equal(palettes.length,5);assert.equal(new Set(palettes.map(p=>p.id)).size,5);
 const blocks=[...read('palette.css').matchAll(/:root[^{}]*\{([^}]+)\}/g)].map(m=>Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[\da-f]{6})/g)].map(x=>[x[1],x[2]])));
 for(let i=0;i<5;i++){const t={...blocks[0],...blocks[i]};for(const [a,b,min] of [['ink','surface',4.5],['muted','canvas',4.5],['green','surface',4.5],['green','soft-surface',4.5],['surface','green',4.5],['chart-secondary','surface',3]])assert.ok(ratio(t[a],t[b])>=min,`${palettes[i].id}: ${a}/${b} = ${ratio(t[a],t[b])}`);}
});
test('palette URLs accept only known presentation options and do not persist financial data',()=>{
 for(const [input,expected] of [['teal','teal'],['<script>','graphite'],['','graphite']]){const document={documentElement:{dataset:{}}};vm.runInNewContext(read('palette-init.js'),{document,location:{search:'?palette='+encodeURIComponent(input)+'&compare=1'},URLSearchParams});assert.equal(document.documentElement.dataset.palette,expected);assert.equal(document.documentElement.dataset.compare,'true');}
 assert.equal(paletteURL('navy','schedule'),'/?palette=navy#schedule');assert.equal(paletteURL('injected','private'),'/?palette=graphite#overview');
});
test('comparison gallery renders all five actual home pages with the same route and only palette differences',()=>{
 const {document}=parseHTML(read('palettes.html'));const observed=[];
 vm.runInNewContext(read('palette.mjs').replace(/^import .*;\n/gm,''),{document,palettes,paletteURL,ResizeObserver:class{constructor(fn){this.fn=fn;}observe(shell){observed.push(shell);this.fn([{target:shell,contentRect:{width:720}}]);}}});
 const frames=[...document.querySelectorAll('iframe')];assert.equal(frames.length,5);assert.equal(observed.length,5);
 for(let i=0;i<5;i++){assert.equal(frames[i].getAttribute('src'),`/?palette=${palettes[i].id}&compare=1#overview`);assert.equal(frames[i].style.transform,'scale(0.5)');assert.equal(frames[i].getAttribute('tabindex'),'-1');}
});

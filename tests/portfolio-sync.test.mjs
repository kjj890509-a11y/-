import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortfolioSync,mountPortfolioSync} from '../public/portfolio-sync.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
test('cross-device refresh applies only a newer account revision and coalesces concurrent requests',async()=>{
 let revision=3,requests=0;const gate=deferred(),applied=[];const refresh=createPortfolioSync({getRevision:()=>revision,canRefresh:()=>true,fetchPortfolio:async()=>{requests++;return gate.promise;},apply:r=>{applied.push(r);revision=r.revision;}});const a=refresh(),b=refresh();await Promise.resolve();assert.equal(requests,1);gate.resolve({revision:4,data:{owner:'same-authenticated-user'}});assert.equal(await a,true);assert.equal(await b,true);assert.equal(applied.length,1);
});
test('an edit, completed save or older response prevents a pending refresh from replacing local state',async()=>{
 for(const change of ['editing','saved','older']){let revision=3,idle=true;const gate=deferred(),applied=[];const refresh=createPortfolioSync({getRevision:()=>revision,canRefresh:()=>idle,fetchPortfolio:()=>gate.promise,apply:r=>applied.push(r)});const pending=refresh();if(change==='editing')idle=false;if(change==='saved')revision=5;gate.resolve({revision:change==='older'?2:4,data:{}});assert.equal(await pending,false);assert.equal(applied.length,0);}
});
test('network errors preserve data, report failure and allow a later retry',async()=>{
 let fail=true,errors=0,applied=0;const refresh=createPortfolioSync({getRevision:()=>1,canRefresh:()=>true,fetchPortfolio:()=>{if(fail)throw new Error('offline');return{revision:2,data:{}};},apply:()=>applied++,onError:()=>errors++});assert.equal(await refresh(),null);assert.equal(errors,1);fail=false;assert.equal(await refresh(),true);assert.equal(applied,1);
});
test('focus, online and visible-page refresh listeners stop cleanly and do not refresh a hidden page',()=>{
 const win=new EventTarget(),doc=new EventTarget();let calls=0,timerCleared=false,callback;doc.visibilityState='hidden';win.setInterval=cb=>{callback=cb;return 7;};win.clearInterval=id=>{assert.equal(id,7);timerCleared=true;};const stop=mountPortfolioSync(win,doc,()=>calls++);win.dispatchEvent(new Event('focus'));assert.equal(calls,0);doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('online'));callback();assert.equal(calls,3);stop();win.dispatchEvent(new Event('focus'));assert.equal(calls,3);assert.ok(timerCleared);
});

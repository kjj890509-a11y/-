import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPortfolio,validatePortfolio} from '../public/domain.mjs';
import {readGuestDraft,writeGuestDraft,guestReturnPath,guestClaimFrom,mergeGuestDraft} from '../public/guest-draft.mjs';

test('guest data expires in tab storage and sign-in carries only a draft reference on a relative return path',()=>{
 const values=new Map();
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const data=emptyPortfolio();
 data.deposits=[{id:'deposit',name:'개인 예금',balance:1000000,rate:0}];
 const id='88e8c585-53d2-4d30-b56d-85f42451af3e';
 assert.equal(writeGuestDraft(storage,id,data,0),true);
 assert.equal(readGuestDraft(storage,1).data.deposits[0].balance,1000000);
 assert.equal(readGuestDraft(storage,24*60*60*1000),null);
 assert.equal(values.size,0);
 const url=new URL(guestReturnPath(id,'#deposits/deposit'),'https://donmoa.test');
 assert.equal(guestClaimFrom(url.search),id);
 assert.equal(url.hostname,'donmoa.test');
 assert.match(guestReturnPath(id,'#//example.org'),/^\/\?guest_draft=[a-f0-9-]+$/);
 assert.equal(writeGuestDraft({setItem(){throw Error();}},id,data),false);
});

test('adding guest data preserves account records, skips conflicting months and remaps linked bills',()=>{
 const account=emptyPortfolio(),draft=emptyPortfolio();
 account.deposits=[{id:'account-deposit',name:'예금',balance:100000,rate:0}];
 draft.deposits=[{...account.deposits[0],id:'draft-deposit'}];
 account.cardAccounts=[{id:'account-card',name:'주카드',day:20}];
 draft.cardAccounts=[{...account.cardAccounts[0],id:'draft-card'}];
 account.cards=[{id:'account-bill',name:'주카드',cardAccountId:'account-card',billingMonth:'2025-01',dueDate:'2025-02-20',paid:false,amount:50000}];
 draft.cards=[{...account.cards[0],id:'draft-bill',cardAccountId:'draft-card',paid:true,amount:60000},
  {...account.cards[0],id:'new-bill',cardAccountId:'draft-card',billingMonth:'2025-02',dueDate:'2025-03-20'}];
 account.budgets=[{month:'2025-01',expenseLimit:300000,savingsTarget:100000}];
 draft.budgets=[{month:'2025-01',expenseLimit:500000,savingsTarget:200000}];
 const saved=validatePortfolio(account),source=validatePortfolio(draft);
 const result=mergeGuestDraft(saved,source);
 assert.equal(result.skipped,4);
 assert.equal(result.added,1);
 assert.deepEqual(result.data.deposits,saved.deposits);
 assert.deepEqual(result.data.budgets,saved.budgets);
 assert.deepEqual(result.data.cards[0],saved.cards[0]);
 assert.equal(result.data.cards[1].cardAccountId,'account-card');
 assert.equal(mergeGuestDraft(result.data,source).added,0);
 assert.equal(saved.cards.length,1);
});

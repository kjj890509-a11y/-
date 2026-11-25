import {KINDS,validatePortfolio} from './domain.mjs';

const storageKey='donmoa-guest-draft-v1';
const draftLifetime=24*60*60*1000;
const draftParam='guest_draft';
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const monthlyKinds=['budgets','actualSpending','snapshots'];
const otherKinds=['cardAccounts','loanPayments','expenseConfirmations'];

export function countGuestDraft(data){
 return [...KINDS,...otherKinds,...monthlyKinds].reduce((sum,key)=>sum+data[key].length,0)+Number(Boolean(data.dashboard));
}

export function readGuestDraft(storage,now=Date.now()){
 try{
  const draft=JSON.parse(storage?.getItem(storageKey)??'null');
  if(!validId(draft?.id)||!Number.isSafeInteger(draft.expiresAt)||draft.expiresAt<=now){
   if(draft)storage?.removeItem(storageKey);
   return null;
  }
  return {id:draft.id,expiresAt:draft.expiresAt,data:validatePortfolio(draft.data)};
 }catch{
  return null;
 }
}

export function writeGuestDraft(storage,id,data,now=Date.now()){
 try{
  const draft={id,expiresAt:now+draftLifetime,data};
  if(!storage)return false;
  storage.setItem(storageKey,JSON.stringify(draft));
  return true;
 }catch{
  return false;
 }
}

export function clearGuestDraft(storage){
 try{storage?.removeItem(storageKey);}catch{}
}

export function guestClaimFrom(search){
 const id=new URLSearchParams(search).get(draftParam);
 return validId(id)?id:null;
}

export function isGuestPreview(search){
 return new URLSearchParams(search).get('try')==='guest';
}

export function guestReturnPath(id,hash=''){
 const safeHash=/^#[a-z]+(?:\/[a-zA-Z0-9_-]{1,80})?$/.test(hash)?hash:'';
 return '/'+(validId(id)?'?'+draftParam+'='+id:'')+safeHash;
}

const fingerprint=({id,...row})=>JSON.stringify(row);

export function mergeGuestDraft(account,draft){
 const next=structuredClone(account);
 let added=0,skipped=0;
 const aliases={};
 const append=(kind,{key=row=>row.id,duplicate=false,transform=row=>row}={})=>{
  const original=next[kind],byKey=new Map(original.map(row=>[key(row),row]));
  const byId=new Map(original.filter(row=>row.id).map(row=>[row.id,row]));
  const similar=duplicate?new Map(original.map(row=>[fingerprint(row),row])):new Map();
  const ids=aliases[kind]=new Map();
  for(const row of draft[kind]){
   const candidate=transform(row);
   const previous=byId.get(candidate.id)??byKey.get(key(candidate))??similar.get(fingerprint(candidate));
   if(previous){ids.set(row.id,previous.id);skipped++;continue;}
   original.push(candidate);
   byKey.set(key(candidate),candidate);
   if(candidate.id)byId.set(candidate.id,candidate);
   ids.set(row.id,candidate.id);
   added++;
  }
 };
 for(const kind of ['cardAccounts',...KINDS.filter(kind=>kind!=='cards')])append(kind,{duplicate:true});
 const cardKey=row=>row.cardAccountId?'bill:'+row.cardAccountId+':'+row.billingMonth:'unlinked:'+row.id;
 append('cards',{key:cardKey,duplicate:true,transform:row=>row.cardAccountId?{
  ...row,cardAccountId:aliases.cardAccounts.get(row.cardAccountId)
 }:row});
 append('loanPayments',{duplicate:true,transform:row=>({
  ...row,loanId:aliases.loans.get(row.loanId)??row.loanId
 })});
 append('expenseConfirmations',{key:row=>row.key,transform:row=>{
  const [kind,id,month]=row.key.split(':');
  return {...row,key:[kind,aliases[kind].get(id)??id,month].filter(Boolean).join(':'),
   depositId:aliases.deposits.get(row.depositId)??row.depositId};
 }});
 // A skipped card bill keeps its existing payment state. Its confirmation must match.
 const unpaid=new Set(next.cards.filter(row=>!row.paid).map(row=>'cards:'+row.id));
 const keptConfirmations=next.expenseConfirmations.filter(row=>!unpaid.has(row.key));
 const dropped=next.expenseConfirmations.length-keptConfirmations.length;
 next.expenseConfirmations=keptConfirmations;
 added-=dropped;
 skipped+=dropped;
 for(const kind of monthlyKinds)append(kind,{key:row=>row.month});
 if(draft.dashboard){
  if(next.dashboard)skipped++;
  else{next.dashboard=draft.dashboard;added++;}
 }
 return {data:validatePortfolio(next),added,skipped};
}

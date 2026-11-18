// Both layouts read the same authenticated API; never cache financial records locally.
export function createPortfolioSync({getRevision,canRefresh,fetchPortfolio,apply,onError=()=>{}}){
 let pending=null;
 return async()=>{
  if(pending)return pending;if(!canRefresh())return false;
  const before=getRevision();
  pending=Promise.resolve().then(fetchPortfolio).then(result=>{
   // A response started before an edit/save may never replace that edit/save.
   if(!canRefresh()||getRevision()!==before)return false;
   if(!Number.isSafeInteger(result.revision)||result.revision<=before)return false;
   apply(result);return true;
  }).catch(error=>{onError(error);return null;}).finally(()=>{pending=null;});
  return pending;
 };
}
export function mountPortfolioSync(win,doc,refresh){
 const visible=()=>{if(doc.visibilityState!=='hidden')refresh();};
 win.addEventListener('focus',visible);win.addEventListener('online',visible);doc.addEventListener('visibilitychange',visible);
 const timer=win.setInterval?.(visible,30000);timer?.unref?.();
 return()=>{win.removeEventListener('focus',visible);win.removeEventListener('online',visible);doc.removeEventListener('visibilitychange',visible);if(timer!==undefined)win.clearInterval(timer);};
}

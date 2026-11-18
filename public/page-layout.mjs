// One page frame and reading scale, preserving the existing controls and event targets.
export function applyPageLayout(root,{title}={}){
 let shell=root.querySelector(':scope > [data-page-shell]');
 if(!shell){
  const heading=root.querySelector('.page-heading'),tabs=root.querySelector('.section-tabs');if(!heading)return;
  shell=root.ownerDocument.createElement('div');shell.className='page-shell';shell.dataset.pageShell='';
  const content=root.ownerDocument.createElement('div');content.className='page-content';content.dataset.pageContent='';
  heading.remove();tabs?.remove();while(root.firstChild)content.append(root.firstChild);
  shell.append(heading);if(tabs)shell.append(tabs);shell.append(content);root.append(shell);
 }
 const heading=shell.querySelector(':scope > .page-heading');
 if(heading){
  heading.classList.add('page-header');let actions=heading.querySelector(':scope > .heading-actions');
  const loose=[...heading.children].filter(el=>el.matches('button,a'));
  if(loose.length&&!actions){actions=root.ownerDocument.createElement('div');actions.className='heading-actions';heading.append(actions);}
  for(const control of loose)actions.append(control);
  heading.querySelectorAll('.date-chip,.eyebrow').forEach(el=>el.remove());
 }
 const content=shell.querySelector(':scope > [data-page-content]');
 // Planning pages use the same summary-first order; range controls remain before it.
 const summary=content?.querySelector(':scope > .planning-metrics'),banner=content?.querySelector(':scope > .forecast-banner');
 if(summary&&banner){const children=[...content.children];if(children.indexOf(banner)<children.indexOf(summary))banner.before(summary);}
 for(const grid of root.querySelectorAll('.home-stats,.planning-metrics,.metric-strip,.workspace-current-grid,.cf-month-summary,.loan-overview')){
  const cards=[...grid.children].filter(el=>!el.matches('script,template'));if(!cards.length)continue;
  grid.classList.add('page-metrics');grid.style.setProperty('--page-metric-columns',String(Math.min(cards.length,4)));grid.dataset.pageMetricCount=String(cards.length);
  for(const card of cards)card.classList.add('page-metric-card');
 }
 if(title)root.ownerDocument.title=title+' · 모아';
}

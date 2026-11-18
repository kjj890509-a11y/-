// Short definitions are text-only. Detailed calculation tables keep their own dialogs.
const controllers = new WeakMap();
let nextId = 0;
const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const helpId = () => 'context-help-' + (++nextId);

export function contextTip(label, copy) {
  const id = helpId();
  return `<button type="button" class="info-button context-tip-trigger" data-info-sources="${id}" aria-label="${escape(label)} 설명 보기" aria-describedby="${id}"></button><span id="${id}" hidden>${escape(copy)}</span>`;
}

export function enableContextTips(doc) {
  if (controllers.has(doc)) return controllers.get(doc);
  const win = doc.defaultView;
  let owner, bubble, pinned, timer;
  const trigger = node => node?.closest?.('button[data-info-sources]');
  function close() {
    clearTimeout(timer);
    if (owner) owner.setAttribute('aria-describedby', owner.dataset.infoSources);
    bubble?.remove();
    bubble = owner = null;
    pinned = false;
  }
  function place() {
    if (!owner || !bubble) return;
    if (!owner.isConnected || owner.closest('[hidden],dialog:not([open])')) return close();
    const viewport = win.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || win.innerWidth || 1024);
    const bottom = top + (viewport?.height || win.innerHeight || 768);
    const rect = owner.getBoundingClientRect();
    if (rect.bottom < top || rect.top > bottom) return close();
    // A forced mobile layout can occupy only part of a wide browser.
    const frame = owner.closest('.m-app')?.getBoundingClientRect();
    const minX = Math.max(left, frame?.left ?? left) + 8;
    const maxX = Math.min(right, frame?.right ?? right) - 8;
    bubble.style.maxWidth = Math.max(1, Math.min(340, maxX - minX)) + 'px';
    bubble.style.maxHeight = Math.max(1, bottom - top - 16) + 'px';
    const size = bubble.getBoundingClientRect();
    bubble.style.left = Math.max(minX, Math.min(rect.left, maxX - size.width)) + 'px';
    const y = rect.bottom + 5 + size.height <= bottom - 8 ? rect.bottom + 5 : rect.top - 5 - size.height;
    bubble.style.top = Math.max(top + 8, Math.min(y, bottom - size.height - 8)) + 'px';
  }
  function open(button) {
    clearTimeout(timer);
    if (owner === button) return;
    close();
    const text = button.dataset.infoSources.split(/\s+/).map(id => doc.getElementById(id)?.textContent.trim()).filter(Boolean).join('\n\n');
    if (!text) return;
    owner = button;
    bubble = doc.createElement('div');
    bubble.id = helpId();
    bubble.className = 'context-tip-bubble';
    bubble.setAttribute('role','tooltip');
    bubble.setAttribute('popover','manual');
    bubble.textContent = text;
    (owner.closest('dialog[open]') || doc.body).append(bubble);
    bubble.showPopover?.();
    owner.setAttribute('aria-describedby', bubble.id);
    place();
  }
  const inTip = node => node && (owner?.contains(node) || bubble?.contains(node));
  const leave = event => {
    if (!owner || pinned || !inTip(event.target) || inTip(event.relatedTarget)) return;
    if (event.type === 'pointerout' && doc.activeElement === owner) return;
    clearTimeout(timer);
    timer = setTimeout(close, 140);
  };
  doc.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    if (inTip(event.target)) clearTimeout(timer);
    const button = trigger(event.target);
    if (button) open(button);
  });
  doc.addEventListener('focusin', event => {
    const button = trigger(event.target);
    if (button) open(button);
    else if (owner && !inTip(event.target)) close();
  });
  doc.addEventListener('focusout', leave);
  doc.addEventListener('pointerout', leave);
  doc.addEventListener('click', event => {
    const button = trigger(event.target);
    if (!button) { if (owner && !inTip(event.target)) close(); return; }
    event.preventDefault();
    if (owner === button && pinned) close();
    else { open(button); pinned = true; }
  });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && owner) { event.preventDefault(); event.stopPropagation(); close(); }
  }, true);
  doc.addEventListener('close', event => { if (owner && event.target.contains(owner)) close(); }, true);
  win.addEventListener('resize', place);
  doc.addEventListener('scroll', place, true);
  win.visualViewport?.addEventListener('resize', place);
  win.visualViewport?.addEventListener('scroll', place);
  controllers.set(doc, close);
  return close;
}

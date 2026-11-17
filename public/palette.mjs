import {palettes,paletteURL} from './palette-config.mjs';
const root=document.documentElement,active=()=>root.dataset.palette||'graphite';
const picker=document.getElementById('palette-switcher');
function renderPicker(){
 if(!picker)return;
 picker.innerHTML=`<span class="palette-picker-label">화면 색상</span><div class="palette-options" role="group" aria-label="다섯 가지 색상">${palettes.map(p=>`<button type="button" data-palette-choice="${p.id}" style="--swatch:${p.accent}" aria-label="${p.name}" title="${p.name}" aria-pressed="${active()===p.id}"><i aria-hidden="true"></i><span>${p.name.split(' & ')[0]}</span></button>`).join('')}</div><a href="/palettes.html">5가지 나란히 비교 ↗</a>`;
}
function setPalette(id){
 const palette=palettes.find(p=>p.id===id);if(!palette)return;
 root.dataset.palette=id;
 const url=new URL(location.href);url.searchParams.set('palette',id);history.replaceState(null,'',url);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette.accent);
 renderPicker();picker?.querySelector(`[data-palette-choice="${id}"]`)?.focus();
}
picker?.addEventListener('click',event=>{const button=event.target.closest('[data-palette-choice]');if(button)setPalette(button.dataset.paletteChoice);});
renderPicker();
const gallery=document.getElementById('palette-gallery');
if(gallery){
 gallery.innerHTML=palettes.map(p=>`<article class="palette-card" id="${p.id}" style="--card-accent:${p.accent}"><div class="palette-card-heading"><div><span class="palette-number">${p.number}</span><h2>${p.name}</h2><p>${p.description}</p></div><div class="palette-swatches" aria-label="색상 구성">${p.swatches.map(c=>`<span style="background:${c}" title="${c}"></span>`).join('')}</div></div><div class="palette-frame-shell"><iframe src="/?palette=${p.id}&compare=1#overview" title="${p.name} 홈 화면" loading="lazy" tabindex="-1"></iframe><a class="palette-frame-link" href="${paletteURL(p.id)}" aria-label="${p.name} 홈 화면 크게 보기"><span>홈 화면 크게 보기 ↗</span></a></div><div class="palette-card-footer"><span>같은 홈 화면 · 같은 데이터</span><div><a href="${paletteURL(p.id,'schedule')}">달력 보기</a><a class="palette-open" href="${paletteURL(p.id)}">이 색상으로 열기 ↗</a></div></div></article>`).join('');
 const resize=new ResizeObserver(entries=>{for(const entry of entries){const frame=entry.target.querySelector('iframe'),scale=entry.contentRect.width/1440;frame.style.transform=`scale(${scale})`;entry.target.style.height=`${1320*scale}px`;}});
 gallery.querySelectorAll('.palette-frame-shell').forEach(shell=>resize.observe(shell));
}

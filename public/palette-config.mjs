export const palettes=[
 {id:'graphite',number:'01',name:'차콜 & 아이보리',description:'차분한 차콜에 따뜻한 회색. 숫자에 집중하는 기본 조합.',accent:'#303a37',swatches:['#303a37','#91a39a','#c3b798','#f4f3ef']},
 {id:'navy',number:'02',name:'네이비 & 쿨 그레이',description:'짙은 네이비와 맑은 회색. 금융 정보가 또렷한 조합.',accent:'#244a70',swatches:['#244a70','#7c9eb9','#b0bfc6','#f3f6f9']},
 {id:'forest',number:'03',name:'포레스트 & 크림',description:'깊은 녹색과 은은한 크림. 오래 보아도 편안한 조합.',accent:'#28634b',swatches:['#28634b','#8aa184','#c3b891','#f4f6f0']},
 {id:'clay',number:'04',name:'테라코타 & 샌드',description:'절제된 벽돌색에 모래빛. 따뜻한 인상을 주는 조합.',accent:'#a34d32',swatches:['#a34d32','#d29e77','#b7b09b','#faf5ef']},
 {id:'teal',number:'05',name:'틸 & 펄 그레이',description:'청록과 부드러운 회색. 산뜻하고 정돈된 조합.',accent:'#17696d',swatches:['#17696d','#7ca7a2','#c5b996','#f1f6f5']}
];
export const paletteURL=(id,hash='overview')=>`/?palette=${palettes.some(p=>p.id===id)?id:'graphite'}#${hash==='schedule'?'schedule':'overview'}`;

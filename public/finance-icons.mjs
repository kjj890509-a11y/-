// Original local SVG artwork. Colors stay inside the icon, never on financial surfaces.
const displayProviderLogos=true;
const keys=['deposits','stocks','retirement','loans','cards','forecast','advisor','cashflow','schedule','budget','entry','history','housing','lease'];
const aliases={assets:'deposits',overview:'deposits',workspace:'deposits',payday:'forecast',fixed:'schedule',planned:'schedule',records:'entry',statistics:'stocks'};
export function financeIconKey(kind){return keys.includes(kind)?kind:Object.hasOwn(aliases,kind)?aliases[kind]:'deposits';}
// Keep issuer matching local and limited to reviewed image filenames.
const banks={
 'kakaobank':['카카오뱅크','카뱅','kakaobank'],
 'shinhan-bank':['신한은행','신한쏠','신한sol뱅크','shinhanbank'],
 'kb-bank':['kb국민은행','국민은행','kb스타뱅킹','kookminbank'],
 'nh-bank':['nh농협은행','농협은행','nh올원뱅크'],
 'woori-bank':['우리은행','우리won뱅킹','wooribank'],
 'ibk-bank':['ibk기업은행','기업은행','ibk'],
 'ibk-savings':['ibk저축은행','ibk저축','기업저축은행'],
 'bnk-group':['bnk금융그룹','bnk','bnk경남은행','경남은행','bnk부산은행','부산은행','bnk저축은행'],
 'daol-savings':['다올저축은행','다올저축','다올디지털뱅크fi'],
 'kbank':['케이뱅크','kbank'],
 'toss-bank':['토스뱅크','tossbank'],
 'hana-bank':['하나은행','keb하나은행','하나원큐','hanabank']
};
const cards={
 'samsung-card':['삼성카드','삼성','samsungcard'],
 'hyundai-card':['현대카드','현대','hyundaicard'],
 'lotte-card':['롯데카드','롯데','디지로카','lottecard'],
 'nh-card':['nh농협카드','농협카드','농협','nhpay','nh페이'],
 'shinhan-card':['신한카드','신한','신한sol페이','shinhancard'],
 'kb-card':['kb국민카드','국민카드','국민','kbpay','kbcard'],
 'woori-card':['우리카드','우리','우리won카드','wooricard'],
 'hana-card':['하나카드','하나','하나pay','하나페이','hanacard'],
 'bc-card':['bc카드','비씨카드','bccard','페이북'],
 'kakaobank':banks.kakaobank,
 'kbank':banks.kbank,
 'toss-bank':banks['toss-bank']
};
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function matchBrand(catalog,value,allowAbbreviations=true){
 const normalized=normalize(value);
 if(!normalized)return '';
 const firstWord=normalize(String(value).trim().split(/\s+/u)[0]);
 const match=predicate=>Object.entries(catalog).filter(([,aliases])=>aliases.some(alias=>
  (allowAbbreviations||alias.length>=4)&&predicate(alias)));
 const matches=match(alias=>normalized===alias||(alias.length>=4&&normalized.startsWith(alias)));
 if(matches.length)return matches.length===1?matches[0][0]:'';
 const shortMatches=match(alias=>firstWord===alias);
 return shortMatches.length===1?shortMatches[0][0]:'';
}
export function financeBrandKey(kind,name){
 if(kind==='cards')return matchBrand(cards,name);
 if(kind==='loans')return matchBrand(banks,name)||matchBrand(cards,name,false);
 return '';
}
function renderIcon(kind,brand=''){
 const source=brand?`/finance-brand-${brand}.png`:`/finance-icon-${financeIconKey(kind)}.svg`;
 return `<img class="finance-icon${brand?' finance-brand':''}" src="${source}" width="40" height="40" alt="" aria-hidden="true" decoding="async" draggable="false">`;
}
export function renderFinanceIcon(kind,issuer=''){
 if(!displayProviderLogos&&issuer)return renderMonogram(normalize(issuer)||'금');
 return renderIcon(kind,financeBrandKey(kind,issuer));
}

// Only distinct product names from the lenders' catalogs are used for inference.
const loanProducts=[
 {pattern:/^ibk사잇돌/,brand:'ibk-savings',badge:'사',accent:'policy'},
 {pattern:/^(?:i|ibk)빅론/,brand:'ibk-savings',badge:'빅',accent:'credit'},
 {pattern:/^ione직장인스마트론/,brand:'ibk-bank'},
 {pattern:/^bnk모바일/,brand:'bnk-group'}
];

function renderLoanRecordIcon(record){
 const name=normalize(record.name);
 const product=loanProducts.find(item=>item.pattern.test(name));
 const brand=record.institution?.trim()
  ?financeBrandKey('loans',record.institution)
  :product?.brand||financeBrandKey('loans',record.name);
 if(brand&&displayProviderLogos){
  if(product?.brand===brand&&product.badge){
   return `<span class="finance-icon loan-brand-icon" aria-hidden="true">
    <img class="finance-brand" src="/finance-brand-${brand}.png" width="40" height="40" alt="" decoding="async" draggable="false">
    <span class="loan-brand-badge loan-brand-${product.accent}">${product.badge}</span>
   </span>`;
  }
  return renderIcon('loans',brand);
 }
 if(/전세|임차보증금/.test(name))return renderIcon('lease');
 if(/주택|아파트|부동산/.test(name))return renderIcon('housing');
 return name&&name!=='대출'?renderMonogram(name):renderIcon('loans');
}

export function renderFinanceRecordIcon(kind,record,issuer=record.institution||record.name){
 if(kind==='loans')return renderLoanRecordIcon(record);
 if(!['deposits','stocks','retirement'].includes(kind))return renderFinanceIcon(kind,issuer);
 const name=normalize(record.name);
 if(kind==='deposits'){
  // A label can describe a different purpose within the same saved category.
  if(/전세|보증금/.test(name))return renderIcon('lease');
  if(/연금|퇴직금|^irp$/.test(name))return renderIcon('retirement');
  if(/주택|청약|부동산/.test(name))return renderIcon('housing');
  if(/주식|증권|^etf$/.test(name))return renderIcon('stocks');
 }
 const brand=matchBrand(banks,record.institution)||matchBrand(banks,record.name,false);
 if(brand&&displayProviderLogos)return renderIcon(kind,brand);
 if(!name||/^(예금|현금|적금|주식|연금|퇴직금|퇴직연금)$/.test(name))return renderIcon(kind);
 return renderMonogram(name);
}

function renderMonogram(name){
 const letters=[...name];
 const color=letters.reduce((hash,letter)=>(Math.imul(hash,31)+letter.codePointAt(0))>>>0,0)%5;
 return `<span class="finance-icon finance-monogram finance-monogram-${color}" aria-hidden="true">${letters[0].toUpperCase()}</span>`;
}

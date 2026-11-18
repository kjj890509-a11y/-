// Original local SVG artwork. Colors stay inside the icon, never on financial surfaces.
const keys=['deposits','stocks','retirement','loans','cards','forecast','advisor','cashflow','schedule','budget','entry','history'];
const aliases={assets:'deposits',overview:'deposits',workspace:'deposits',payday:'forecast',fixed:'schedule',planned:'schedule',records:'entry',statistics:'stocks'};
export function financeIconKey(kind){return keys.includes(kind)?kind:Object.hasOwn(aliases,kind)?aliases[kind]:'deposits';}
export function renderFinanceIcon(kind){const key=financeIconKey(kind);return `<img class="finance-icon" src="/finance-icon-${key}.svg" width="40" height="40" alt="" aria-hidden="true" decoding="async" draggable="false">`;}

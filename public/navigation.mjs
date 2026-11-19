// One hierarchy shared by desktop navigation, mobile navigation and section tabs.
export const viewLabels = {
 overview:'자산 한눈에',entry:'통합 입력·수정',workspace:'맞춤 대시보드',assets:'전체 자산',deposits:'예금·현금',stocks:'주식·투자',retirement:'퇴직금·연금',
 records:'전체 내역',cashflow:'수입·지출 내역',spending:'가계부',fixed:'정기 지출',planned:'예정 거래',schedule:'입출금 달력',
 loans:'대출 현황',cards:'카드 청구',advisor:'AI 상담',
 budget:'월 예산',forecast:'월별 전망',payday:'급여일 전망',statistics:'기간별 분석',history:'자산 기록'
};
export const navigationGroups = [
 {id:'home',label:'홈',icon:'overview',defaultView:'overview',views:['overview','entry','workspace']},
 {id:'assets',label:'보유 자산',icon:'deposits',defaultView:'assets',views:['assets','deposits','stocks','retirement']},
 {id:'flow',label:'수입·지출',icon:'cashflow',defaultView:'cashflow',views:['records','cashflow','spending','fixed','planned','schedule']},
 {id:'debt',label:'대출·카드',icon:'loans',defaultView:'loans',views:['loans','cards','advisor']},
 {id:'plan',label:'자금 계획',icon:'forecast',defaultView:'forecast',views:['forecast','payday','budget']},
 {id:'reports',label:'분석·기록',icon:'statistics',defaultView:'statistics',views:['statistics','history']}
];
export const groupForView = view => navigationGroups.find(group=>group.views.includes(view)) || navigationGroups[0];
export function sectionTabs(view){
 const group=groupForView(view);
 if(group.views.length<2)return '';
 return `<nav class="section-tabs" aria-label="${group.label} 메뉴">${group.views.map(key=>`<a href="#${key}" ${key===view?'aria-current="page"':''}>${viewLabels[key]}</a>`).join('')}</nav>`;
}

import {searchDashboard,renderDashboardSearch,tableCSV,enhanceTableExports} from './dashboard-tools.mjs';
export {searchDashboard,renderDashboardSearch,tableCSV,enhanceTableExports};

import {createLedgerWorkspace,ledgerState,ledgerPreference,renderLedger,mountLedger,unmountLedger} from './ledger.mjs';
import {ledgerEntries,ledgerColumns,ledgerLabels,ledgerStatus,statusLabels,ledgerQuery,ledgerLayout,validateLedgerPreferences} from './ledger-model.mjs';
export {createLedgerWorkspace,ledgerState,ledgerPreference,renderLedger,mountLedger,unmountLedger,ledgerEntries,ledgerColumns,ledgerLabels,ledgerStatus,statusLabels,ledgerQuery,ledgerLayout,validateLedgerPreferences};

import {calendarModel,renderCashCalendar,shiftCalendarDay} from './calendar.mjs';
export {calendarModel,renderCashCalendar,shiftCalendarDay};

import {entryPresets,entryGroups,renderEntryHub,createEntryManagerState,mountEntryManager,stageEntryRecord,entryDraftRow} from './entry-hub.mjs';
export {entryPresets,entryGroups,renderEntryHub,createEntryManagerState,mountEntryManager,stageEntryRecord,entryDraftRow};

import {mountFinancialMotion,unmountFinancialMotion} from './motion.mjs';
export {mountFinancialMotion,unmountFinancialMotion};

import {createCardBillingState,renderCardBilling,mountCardBilling,renderCardAccounts,saveCardAccount,setCardArchived} from './card-billing.mjs';
export {createCardBillingState,renderCardBilling,mountCardBilling,renderCardAccounts,saveCardAccount,setCardArchived};

export {renderMonthPicker,mountMonthPickers,syncMonthPicker,closeMonthPicker} from './month-picker.mjs';
export {renderMonthlySpending} from './actual-spending.mjs';

export {mountRecordLayout,orderLayoutRows} from './record-layout.mjs';

export {applyPageLayout} from './page-layout.mjs';

export {isMobileViewport,createMobileState,renderMobilePage,mountMobileControls} from './mobile-app.mjs';
export {createPortfolioSync,mountPortfolioSync} from './portfolio-sync.mjs';
export {mountAssetConsultation} from './asset-consultation.mjs';

export {createCoachmarkState,mountCoachmarks} from './coachmarks.mjs';

export {renderFinanceIcon,renderFinanceRecordIcon} from './finance-icons.mjs';
export {mountDesktopNavigation} from './desktop-navigation.mjs';

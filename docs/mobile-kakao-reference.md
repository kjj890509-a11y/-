# Mobile account interface

The mobile web layout uses the same Site, authenticated account, `/api/portfolio`, revision checks and D1 portfolio as desktop. No mobile financial database, sample initialization, browser financial cache, third-party banking connection or migration is introduced. Only the existing amount-visibility preference uses localStorage.

## Reference evidence and limits

Requested collection: https://mobbin.com/apps/kakao-bank-ios-520ecb16-7670-4349-8373-7ad4025ac899/e7037a47-1ad8-4754-a365-37735967e605/screens

Mobbin MCP screen and flow previews were inspected, including home, account categories, account detail/history, account management, card management, full menu, calendar selection, amount entry and bottom sheets. The MCP has no app-version inventory operation and its search results do not identify the app version. The original URL could not be opened because the browser connection timed out. This is **not** a claim to have reviewed every screen in the linked version or verified a pixel-identical implementation of that version.

Applied references, each inspected as an actual image:

- [Home](https://mobbin.com/screens/04517e3b-abac-4250-8af0-433d2c26d7de?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): top name/account shortcut, small banner, vertically stacked colored account cards, lower links and four bottom tabs. Moa replaces bank content with real account names, balances, investments, pensions, debts and bills. No bank logo, character art or bank transactions are copied.
- [Accounts flow](https://mobbin.com/flows/c06af808-c004-44db-8ba8-cd555924e0c4?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): four category pills, count/total strip, white account rows and add action. Categories map to deposits, investments, loans and retirement. All six flow screen IDs were returned; inline previews 1, 4 and 6 were inspected, not the unshown screens.
- [Account detail](https://mobbin.com/screens/feb24f49-a82b-487e-9ebe-c81dc0d29e84?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): colored balance header, centered balance, two actions and plain detail rows. Moa shows edit/add and actual recorded facts. It does not invent account-linked transaction history when the source data has no account linkage.
- [Account management](https://mobbin.com/screens/dc9a9d01-be4a-4c2e-84f1-37c1256787c6?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): grouped label/value information, retained in detail and loan principal/interest breakdowns.
- [Full menu](https://mobbin.com/screens/fdb0a7da-2be4-40d3-a41b-7a6f26a44a6a?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): name/settings header and grouped full-width service rows, mapped to Moa's existing routes.
- [Card management](https://mobbin.com/screens/ee24b60b-7732-421b-ba97-c258ecdb80ca?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): grouped card controls and simple navigation. Moa keeps reusable card profiles with monthly bills and the existing card-management editor.
- [Selected calendar date](https://mobbin.com/screens/e4e404a0-1594-4e9d-86c1-f639c6eb26f0?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): compact seven-column calendar, circular yellow selection, sparse day labels. Moa adds small income/expense dots and the existing day events underneath.
- [Reservation management](https://mobbin.com/screens/8af87774-864d-454a-a652-0189ab39273c?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): month choice, total strip and compact dated rows, adapted for planned inflows/outflows.
- [Amount entry](https://mobbin.com/screens/fae852b5-aae8-43c3-b004-d048607ebb4a?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): large touch targets and yellow confirmation action. Moa uses its validated native form inputs and device keyboard, not a fake bank-transfer keypad.
- [Bottom sheet](https://mobbin.com/screens/f27ae668-4581-438e-bfec-9a82781b3122?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): rounded modal sheet and calm actions, used for confirmations/settings. Complex record editing uses a full-height form so loan fields remain usable.

The precise mapping for forecast, budget and analytics rows is Moa-specific judgment; these are not claimed to be KakaoBank screens. The mobile UI deliberately omits desktop chart grids, column resizing, saved-view tooling and dashboard arranging. Desktop keeps those features and its existing purple design. Moa remains clearly named Moa and does not claim banking functionality.

## Behavior

- At 760 CSS pixels and below the mobile composition is selected. `?display=mobile` previews the same composition on desktop; `?display=desktop` explicitly selects desktop. Both use the exact same authenticated API.
- Bottom tabs: home, inflows/outflows, assets, all services. Detail links carry existing record IDs in the hash; those links degrade to the category on desktop.
- Every original route has a mobile presentation. The advanced AI comparison reuses its existing controls and service readiness; this change does not configure or spend an AI key.
- Home and lists derive from current portfolio records; empty accounts do not receive sample data.
- Loan detail includes rate, repayment method, next principal/interest/total and up to 12 months of the existing amortization schedule. Manual loans keep their existing semantics; term loans use the existing equal-principal/equal-payment logic.
- Card profiles remain fixed. Monthly entry records both `cardAccountId` and `billingMonth`; actual due dates may belong to a different month. Editing retains these fields.
- Mobile record search/category/sort are view-only. Cashflow and fixed expense labels retain card-bill duplicate exclusion.
- The compact calendar derives from `eventsForMonth`; card-included expense rows are not debited a second time.
- Forecasts retain the existing assumptions, salary-date calculations and pension contributions. They do not change actual account balances automatically.

## Synchronization and safeguards

Both layouts check for a newer server revision on focus, online, page visibility and every 30 seconds while visible. Financial data is requested with `cache: no-store`. Concurrent checks coalesce. An old/equal revision is ignored. A response started before a local edit/save cannot replace it.

No refresh is applied during an open dialog, pending entry/card drafts, dashboard editing, a save, a focused editable input, demo mode or an AI request. The server still rejects stale PUT revisions. Network failure preserves the current data. Existing private access remains unchanged.

## Verification

- Final full suite: 211 tests passed, including all 199 existing desktop/financial/security tests and 12 new mobile/synchronization tests. Worker build passed with 45 local assets; bundled Worker syntax and whitespace checks passed.
- Mobile integration tests cover all routes with populated and empty portfolios, account details, desktop/mobile shared edits, cross-month card bills, remote update conflicts, privacy, calendar duplicate exclusion, record filters and AI unavailable state.
- Sync tests cover coalescing, stale responses, edits during requests, errors/retry and hidden-page/lifecycle behavior.
- Browser rendering QA could not run: managed preview returned `relay could not open browser port 4173: timed out waiting for relay readiness`. No screenshot or pixel-match claim is made. No alternate preview server/browser path was used.


## Color and hierarchy correction — 2026-11-18

User feedback: the mobile version felt harder to read than KakaoBank, especially the color combinations.

The same [Accounts reference](https://mobbin.com/flows/c06af808-c004-44db-8ba8-cd555924e0c4?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) was inspected again through Mobbin MCP. Its returned high-resolution home image measures 1179 pixels wide, corresponding to a 393-pixel phone at 3×. The dominant reference canvas is `#f7f7f7` and the primary mint card is `#c8e3d6`. These measurements are evidence for the canvas/primary surface, not a claim that the revised secondary palette is identical to KakaoBank.

Three changes:

1. Keep the header, banner, account stack and four bottom tabs. Give only the primary deposit card the full mint surface; additional deposit cards and unpaid-card summaries are white. Investment, retirement and loan surfaces use lighter versions of their existing hues with dark balances. The lighter secondary palette is a response to this user's feedback, not a color sample claimed from the reference.
2. Place institution/count metadata beside card names and keep loan interest below its balance. All original records, amounts, detail links and edit actions remain. Separate income/expense labels replace the ambiguous slash between banner values. Compact card padding and type make the primary account distinct from secondary summaries.
3. Lower the specificity of shared mobile resets with `:where(.m-app)` so local home/menu headings and section labels can use their intended sizes. Previously the shared heading selector overrode local heading sizes. Fix the missing menu-header flex alignment, improve secondary/navigation text contrast and make the desktop-only mobile preview use the reference's phone width. Real phone widths remain responsive.

No API, account, storage, calculation or desktop-layout change. The same portfolio remains in use. No new dependencies.

Verification: 10 targeted mobile/desktop-frame tests passed, including empty/populated routes, shared edits, cross-month cards, privacy, calendar and AI unavailable state. Worker build (45 assets), bundled syntax and whitespace checks passed. Declared foreground/background pairs for primary balances exceed 10:1; checked compact metadata/navigation pairs are at least 4.7:1. These are source-color calculations, not browser-computed measurements. Managed preview still fails with the relay-readiness timeout; actual browser rendering and before/after screenshots remain unverified.

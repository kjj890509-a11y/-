# Stripe reference redesign · 2026-11-17 KST

Scope: restyle the whole Moa web shell and its existing views, explicitly requested by the user. Preserve all financial content, calculations, routes, authentication, server persistence, home inline drilldowns, forms, privacy masking and AI connection readiness. The user explicitly asks to use the Stripe appearance; this overrides the Mobbin skill default of retaining the previous teal theme. No new dependency or Stripe logo/wordmark is introduced.

Job: find an asset or upcoming obligation, understand its amount, and view or update its details.
Baseline: 18 routes, six primary groups, pale gray canvas, large rounded panels, teal active fills, tab pills. The home summary already changes details in place. Search is category-local; exports only support JSON backups.

Mobbin MCP provides search captures, not an exact release URL reader, original CSS, font files or pixel measurements. The supplied release URL is the requested direction; exact membership of search results in that release is unverified. All references below were visually inspected from MCP previews. Measurements are implementation choices from images, not source CSS claims.

| Problem / move | Observed Stripe evidence | Implementation | Preserved |
|---|---|---|---|
| Shell and category discovery | Home search and compact sidebar: https://mobbin.com/screens/ed214911-d939-4369-b40a-2ebd4c0be155 | White shell, purple accents, compact navigation; shared top search and keyboard command dialog | Six groups, every route and existing AI/privacy/settings access |
| Pills and heavyweight card styling obscure a consistent hierarchy | Billing overview: https://mobbin.com/screens/e957507b-f8da-4da4-859b-236fb39c61c8 | Heading above underlined section tabs; thin borders, restrained corners; shared type and spacing | Existing titles and all tab destinations |
| Home should read as financial reporting | Organization performance: https://mobbin.com/screens/ed214911-d939-4369-b40a-2ebd4c0be155 | Joined summary metric grid, light report panels, fine chart grid and purple series | Same four totals, inline selection, budget/outlook/allocation/upcoming, 6/12-month range |
| Asset details should read as a ledger | Balances summary/activity: https://mobbin.com/screens/962aff6d-3422-401a-b4a1-26ad06283c99 | Aligned list rows and compact table headings/controls | All account fields, loan details, notes, edit/delete actions and empty states |
| Data should be reusable from the current view | Transactions list with top export affordance: https://mobbin.com/screens/f706524f-2964-47a5-ba06-4fdf75779e0f | CSV export per visible data table with labels and currently displayed rows; spreadsheet formula escaping | JSON backups remain; masked amounts export masked; no automatic financial mutation |

Useful additions: local search across menus and own registered record names/institutions; Ctrl/Cmd+K, keyboard navigation; per-table CSV download. All search runs in current-tab memory and makes no external request.

Intentional adaptations: Korean text uses available system Korean fonts, Moa identity and financial data remain. Stripe's payment operations and commercial account data are not copied. Readable minimum text and touch targets retained even where screenshots are denser. No claim of pixel-identical fonts or rendering.

Validation: npm test passed all 109 tests. npm run build produced the Worker with 23 local assets; node --check and git diff --check passed. A separate jsdom + SQLite run exercised 18 routes, 6 menu groups, saves for 7 categories, planned inclusion, chart/privacy controls, and command-palette focus/keyboard selection into an account editor. These are DOM checks, not browser screenshots. Managed preview failed with relay could not open browser port 4173 / timed out waiting for relay readiness; it was stopped. Browser visual comparison, phone layout and before/after screenshots remain unverified. No original screenshot or financial data was put in public assets.

# Module Map

Verified 2026-11-02. Search symbols first; inspect only affected paths and callers.

| Feature | Main paths | Entry points / notes |
|---|---|---|
| App/navigation/API client | `src/main.jsx`, `shared/workspaces.js` | App, api, usePagedProducts, workspaceFor |
| Server/storage | `server.js` | Express routes; DATA_DIR; SQLite startup |
| Authentication | `server.js`, `server/google-auth.js`, `src/AccountPicker.jsx` | /api/login, registerGoogleAuth |
| People/roles | `shared/roles.js`, `server/roles.js`, `src/Employees.jsx` | roleAccess, managesWarehouse, registerPeople |
| Product filters/catalog | `src/ProductFilterPanel.jsx`, `src/ProductSearchFilters.jsx`, `src/BrandModelFields.jsx`, `shared/product-filters.js`, `src/CategoriesPage.jsx`, `server/brands.js` | matchesProduct, BrandModelFilters; /api/products-page in server.js |
| Movements/Anode/repair | `server.js`, `shared/movements.js`, `src/MovementForm.jsx`, `src/ExternalWork.jsx` | /api/movements; /api/receipts/:id/complete |
| Stage stock | `server/stock-stages.js`, `src/StockStages.jsx`, `shared/stock-stages.js` | changeStock, resolveStockStage, StageTransfer |
| Packing/defects | `server/packing-orders.js`, `src/PackingOrders.jsx`, `src/PackingLinePicker.jsx` | setupPackingOrders; prepare, issue, accept, finish, confirm-defects, receive |
| Stock work | `server/stock-work-orders.js`, `src/StockWorkOrders.jsx` | setupStockWorkOrders; claim, complete |
| Operations/legacy | `server/operations.js`, `src/Operations.jsx`, `src/RoleOverview.jsx` | setupOperations; legacy requests, data import/export, role access |
| Excel/composition | `src/xlsx-composition.js`, `server/bundled-catalog.js`, `server/composition-summary.js`, `imports/catalog-2026-10-30.json` | parseCompositionWorkbook, importBundledCatalog, withCompositionSummary |
| Receipt/packing print | `src/OutboundReceipt.jsx`, `src/ReceiptDetails.jsx`, `src/ReceiptList.jsx`, `src/PackingPrint.jsx`, `shared/outbound-print.js`, `shared/packing-print.js` | Printable documents; CSV exportReport in main.jsx |
| QR/batch labels | `src/Operations.jsx`, `shared/qr.js`, `shared/product-scan.js`, `src/QrScanner.jsx` | Labels, printLabel, qrMatrix, productFromScan |
| Dashboard | `src/AdminDashboard.jsx`, `src/DashboardActivity.jsx`, `server/dashboard-activity.js` | registerDashboardActivity, dashboardActivity |
| Styles | `src/style.css`, `src/operations.css`, `src/product-kinds.css`, `src/packing-print.css` | Shared layouts plus scoped workflow/print styles |
| PWA/build | `scripts/build-pwa.mjs`, `src/InstallApp.jsx`, `package.json` | npm run build |
| Backup/accounts | `scripts/backup-database.mjs`, `scripts/restore-backup.mjs`, `scripts/setup-accounts.mjs` | CLI maintenance; review target database before running |
| Tests | `test/`, `scripts/check-batch-labels.mjs`, `scripts/check-packing-production.mjs`, `scripts/check-stock-work.mjs` | npm test; focused browser checks after build |

Workflow reference: `docs/LUONG-HOAT-DONG-HIEN-TAI.md`; source wins if behavior changes.

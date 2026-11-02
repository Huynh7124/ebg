# Architecture

Verified against source on 2026-11-02. Source takes precedence over this map.

- Purpose: EBG inventory, warehouse movements, packing/processing handoffs, stock work, labels and reporting.
- Frontend: React with Vite; `index.html` loads `src/main.jsx` (`App`). Role-based page navigation uses URL hashes; shared request helper `api` sends JSON and CSRF headers to `/api`.
- Backend: Express in `server.js`, Node ESM with built-in `node:sqlite` (use Node 24). Same server provides API and Vite middleware in development, or `dist` in production.
- Store: SQLite at `${DATA_DIR || 'data'}/ebg.db`, WAL enabled. Schema creation/migrations occur at startup in server modules. Sessions also persist in SQLite. Keep database/backups out of Git; deployment requires persistent storage.
- Authentication: account picker by default; `REQUIRE_PASSWORD=1` enables passwords. Google OAuth requires configured credentials and an existing unlocked account matching the verified email; no new-email approval queue.
- Authorization: four roles in `shared/roles.js`; server guards in `server/roles.js`, `server/operations.js` and workflow endpoints. UI visibility is not a substitute for API authorization.
- Data flow: UI action -> API validation/role check -> SQLite transaction for multi-step movements -> audit/receipts -> client reload. Warehouse issue deducts stock once; preparation does not reserve it.
- Packing: warehouse prepares/issues -> owning packer receives/dispatches -> processor claims/finishes -> warehouse confirms defects -> packer receives good output/completes.
- Stock work: separate from packing. Claim records processor and return time; completion records progress only, not warehouse receipt or settlement of inProduction.
- Inventory: product classification differs from stage balances. `changeStock` and stage triggers maintain totals. Stage transfers are same-product 1:1 moves, not assembly.
- Legacy: operations request/BOM APIs remain despite removed request/work UI. Do not infer removal from navigation alone.
- Excel: startup `--bundled-catalog` imports bundled inventory once with existing-balance protection; interactive composition import does not add stock.
- Printing: outbound/packing document helpers plus Labels in `src/Operations.jsx`; batch QR+name printing uses an iframe, A4 20 labels/page or roll layout. Printing does not mutate inventory.
- Build: `npm run build` runs Vite and PWA asset generation. Service worker caches public assets, not API data; server connectivity is required for operations.
- Checks: `npm test` uses node:test; `scripts/check-*.mjs` provide browser checks, generally against temporary databases. Build before production browser checks. Check scripts for dated fixtures before diagnosing a failure.

- Reviewed composition editing: warehouse/Admin can copy a same-unit structure and replace component references in product details via CompositionEditor; existing BOM cycle checks/versioning apply. No automatic identity merge or stock adjustment.
- Admin dashboard metrics open product or activity lists. Activity detail rows use the same timezone/period aggregation as totals; backlog lists represent current state.

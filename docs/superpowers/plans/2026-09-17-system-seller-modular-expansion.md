# System-Seller Modular Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved modular expansion of System-Seller while preserving the existing production core.

**Architecture:** Keep the current static HTML/JavaScript application and Supabase core, add isolated frontend modules registered through a modular shell, and complete missing database/RPC/storage primitives with RLS. High-risk multi-record operations stay transactional in Postgres; private business files stay in a private Supabase Storage bucket; PWA/offline support uses a service worker plus an idempotent server replay queue.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS 2.116.0, Supabase Postgres/RLS/RPC/Storage/Edge Functions, JSZip 3.10.1 for portable backups, pdf-lib 1.17.1 in Edge Functions.

**Spec:** `docs/superpowers/specs/2026-09-17-system-seller-modular-expansion-design.md`

## Global Constraints

- Preserve existing authentication, organization isolation, orders, inventory, finance, team roles, audit, backup, profile and deployment flows.
- Do not add Shopee, Mercado Livre or WhatsApp integrations.
- No sale-price recommendation/calculation for 3D printing.
- All organization-owned exposed tables use RLS and organization membership checks.
- No secret/service-role/provider credentials in browser code.
- Critical multi-record writes use RPCs and idempotency where applicable.
- Existing partial payments remain core functionality.

---

### Task 1: Track and complete database foundation
**Files:** create `supabase/migrations/20260917041435_modular_expansion_foundation.sql`; create `supabase/migrations/20260917_modular_expansion_completion.sql`.
**Produces:** quote history/stage management, payment due dates, generated documents, email outbox, sync conflicts/client mutations, private business-files bucket policies, reporting/notification/offline/backup RPCs.
- [ ] Mirror the already-applied foundation migration into GitHub.
- [ ] Add the completion migration with RLS/grants and transactional RPCs.
- [ ] Apply the completion migration to project `tkdokwisgeqmflixvmff`.
- [ ] Run security/performance advisors and smoke-test the schema/RPC signatures.

### Task 2: Modular shell and navigation
**Files:** create `js/modular-shell.js`; create `modules.css`; modify `index.html`.
**Produces:** `S.registerPage()`, grouped navigation for Operação/Comercial/Financeiro/Estoque/Gestão, settings and 3D conditional navigation.
- [ ] Register new page routing without rewriting `core.js`.
- [ ] Add module scripts/styles and PWA metadata to `index.html`.
- [ ] Verify all existing page routes continue to resolve.

### Task 3: Quotes and customer-specific pricing
**Files:** create `js/customer-pricing.js`, `js/quotes.js`.
**Consumes:** `create_quote`, `set_quote_status`, `convert_quote_to_order`, `customer_product_prices`.
**Produces:** quote CRUD/status/conversion UI and special-price CRUD/prefill.
- [ ] Add special-pricing page and CRUD.
- [ ] Wrap order form to prefill customer-specific prices without altering historical prices.
- [ ] Add quote list/create/detail/status/conversion flows.
- [ ] Verify conversion is idempotent and prices are preserved.

### Task 4: Production and calendar
**Files:** create `js/production.js`, `js/calendar.js`.
**Consumes:** production tables and production RPCs.
**Produces:** production board, stage configuration/history, daily/weekly calendar.
- [ ] Add production tracking page and edit modal.
- [ ] Add admin stage management.
- [ ] Add daily/weekly calendar derived from order/production data.
- [ ] Verify stage history and overdue indicators.

### Task 5: Costs, profitability and reports
**Files:** create `js/costs.js`, `js/reports.js`.
**Produces:** cost entry, order/date profit summaries, receivables/workload/top customers/products/channel indicators, CSV export.
- [ ] Implement cost/profit page.
- [ ] Implement expanded reports page and CSV download.
- [ ] Add dashboard enrichment hook.

### Task 6: Attachments and optional 3D inventory
**Files:** create `js/attachments.js`, `js/inventory-3d.js`.
**Consumes:** private `business-files` bucket, attachments tables, filament RPCs/settings.
**Produces:** private quote/order/payment attachments and optional 3D settings/roll inventory/consumption/job details.
- [ ] Add validated private upload/list/download/delete helpers.
- [ ] Integrate attachment panels into quote/order detail.
- [ ] Add settings toggle and 3D stock page.
- [ ] Verify no negative filament stock can be produced.

### Task 7: Notifications and email delivery
**Files:** create `js/notifications.js`; create `supabase/functions/send-business-email/index.ts`.
**Produces:** deduplicated in-app alerts, email outbox/retry UI and authenticated Edge Function sender using `BREVO_API_KEY` server secret.
- [ ] Add notification refresh/read UI.
- [ ] Add queue/retry email operations.
- [ ] Deploy authenticated email Edge Function.
- [ ] Verify missing provider secret fails safely without rolling back business state.

### Task 8: Business PDF documents
**Files:** create `js/documents.js`; create `supabase/functions/business-document/index.ts`.
**Produces:** server-generated branded quotation/receipt/work-order PDFs in private Storage plus immutable snapshot metadata.
- [ ] Deploy authenticated PDF Edge Function.
- [ ] Add documents page and generation/download actions.
- [ ] Verify private PDF access and snapshot persistence.

### Task 9: PWA and controlled offline synchronization
**Files:** create `manifest.webmanifest`, `service-worker.js`, `js/pwa.js`, `js/offline-sync.js`.
**Produces:** installable PWA, cached shell/data, offline queue for allowed mutations, idempotent replay and conflict UI.
- [ ] Add service worker/app manifest and offline shell caching.
- [ ] Wrap safe reads with cache fallback.
- [ ] Queue permitted quote/order/production/note writes when offline.
- [ ] Replay through `apply_offline_mutation` and surface conflicts.

### Task 10: Backup/restore expansion
**Files:** create `js/backup-expansion.js` and update backup RPC migration.
**Produces:** v3 quick JSON backup and full portable ZIP with private files, restore validation/reporting and backward compatibility.
- [ ] Extend backup snapshot with all new durable tables and file manifest.
- [ ] Add ZIP export/import using JSZip.
- [ ] Restore data in dependency order then restore private files with explicit failure reporting.

### Task 11: Verification and release hardening
**Files:** modify `.github/workflows/*` only as needed; update `README.md` and `docs/RELEASE_CHECKLIST.md`.
- [ ] Run JS syntax/static-reference checks and database smoke queries.
- [ ] Run Supabase security/performance advisors and fix actionable new issues.
- [ ] Verify existing login/order/payment/backup routes still load.
- [ ] Verify new module routes, RLS, storage policies, PWA assets and Edge Functions.
- [ ] Commit final release documentation/status.

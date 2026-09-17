# System Seller — Full Quality Audit Report

Date: 2026-09-17

Repository: `FrontWork08/System-Seller`

Audit branch: `audit/full-system-quality-2026-09-17`

Baseline: `main` at `00ced523f9eb38214797001fb46b037054961695`

## Executive summary

The audit reviewed the full System Seller application across boot/PWA, authentication and authorization, orders/payments, products/stock, customers/pricing, quotes, production/calendar, 3D workflows, finance/reports, documents/attachments, backups, offline synchronization, notifications/email, deployment, and security posture.

The audit found a small set of reproducible defects and hardening gaps. All reproducible Critical/High/Medium defects found during this audit were corrected. Regression coverage was added for the corrected behavioral defects where automation was practical.

No destructive production-data test was used. Database verification relied on read-only integrity queries, schema/function/policy inspection, advisor checks, and versioned migrations. Production schema changes introduced by the audit were mirrored into repository migrations.

## Findings corrected

### 1. Backup restore could silently lose audit history

Severity: Critical

The backup exporter included `audit_logs`, and the documented backup policy treated audit history as covered business state, but restore v1/v2 did not reinsert the exported audit rows.

Fix:
- added `private.restore_audit_logs_backup_impl`;
- restore now replaces the organization's exported audit history at the end of the restore transaction;
- restore writes a new `workspace_backup / restore_completed` audit entry after the historical rows are restored;
- migration: `20260917175529_audit_restore_and_offline_tenant_isolation.sql`.

Regression test: `tests/backup-audit-log-restore.test.cjs`.

### 2. Offline production conflict lookup was not tenant-scoped early enough

Severity: Critical

`production_update` could read production metadata for the requested order id before first proving that the order belonged to the caller's organization.

Fix:
- validate the order with both `id` and `organization_id` before reading production state;
- scope the `order_production` lookup by organization as well;
- versioned in the same `20260917175529` migration.

Regression test: `tests/offline-production-tenant-isolation.test.cjs`.

### 3. Anonymous role retained unnecessary RPC execution grants

Severity: High hardening issue

Several public RPC endpoints were executable by the Supabase `anon` role even though the functions internally required authentication. No data bypass was found because the functions still checked `auth.uid()`/role, but the external grant was unnecessary attack surface.

Fix:
- revoked `EXECUTE` from `anon` for all application operational RPCs;
- kept execution for `authenticated` users and service roles;
- verified after migration that every public application RPC reports `anon_execute = false` and `authenticated_execute = true`;
- migration: `20260917181253_revoke_anon_app_rpc_execution.sql`.

Regression test: `tests/rpc-anon-permissions.test.cjs`.

### 4. Viewer notification page attempted a write-only refresh

Severity: Medium

The Viewer role could open notifications but the page refresh path attempted to generate operational notification rows, which requires write-capable membership.

Fix:
- added `js/notification-permission-guard.js`;
- Viewer skips the write-producing refresh while still reading existing notifications.

Regression test: `tests/notifications-viewer-readonly.test.cjs`.

### 5. Viewer production UI exposed edit controls

Severity: Medium

The database correctly rejected writes from Viewer, but the production modal still presented editable inputs and a Save button.

Fix:
- added `js/production-readonly-guard.js`;
- production detail/history remains visible;
- controls are disabled and the submit action is removed for Viewer.

Regression test: `tests/production-viewer-readonly.test.cjs`.

### 6. Viewer 3D inventory UI exposed write actions

Severity: Medium

Viewer could see New roll, Consume, Edit, and editable 3D job controls even though RLS blocked the writes.

Fix:
- added `js/inventory-3d-readonly-guard.js`;
- Viewer remains able to inspect filament and 3D job data;
- create/consume/edit controls and dynamically decorated 3D write fields are removed/disabled.

Regression test: `tests/inventory-3d-viewer-readonly.test.cjs`.

### 7. Viewer could enqueue offline production writes

Severity: Medium

Offline production cards remained editable for Viewer. The mutation could enter IndexedDB and only fail later during server synchronization, leaving avoidable pending work.

Fix:
- added `js/offline-viewer-readonly-guard.js`;
- Viewer production cards are read-only offline and the submit path is blocked before queue insertion.

Regression test: `tests/offline-production-viewer-readonly.test.cjs`.

### 8. Viewer saw conflict-resolution controls

Severity: Medium

Viewer can legitimately read synchronization conflicts, but the page exposed Apply offline and Keep server controls even though resolution is restricted to owner/admin/operator.

Fix:
- added `js/sync-conflicts-readonly-guard.js`;
- conflict details remain visible while resolution controls are removed for Viewer.

Regression test: `tests/sync-conflicts-viewer-readonly.test.cjs`.

### 9. Receipt generation was available where complete payment history was not

Severity: Medium

Operators could attempt to generate a receipt/payment statement, but financial-transaction detail is admin-restricted. That could create an incomplete receipt even though the underlying finance rows remained protected.

Fix:
- added `js/document-permission-guard.js`;
- Viewer is read-only in document history;
- Operator can generate non-financial operational documents;
- receipt/payment statement generation is restricted to owner/admin.

Regression test: `tests/documents-role-permissions.test.cjs`.

### 10. Dashboard finance expansion could show a misleading profit value to non-admins

Severity: Medium

The report module appended a gross-profit KPI to the dashboard for roles that could not read `order_costs`. With RLS returning no cost rows, the displayed value could effectively equal revenue rather than true gross profit.

Fix:
- report-driven finance KPI expansion now exits immediately for non-admin roles after the base dashboard renders.

Regression test: `tests/dashboard-finance-role.test.cjs`.

### 11. Report date boundaries did not consistently use the configured business timezone

Severity: Medium

Report order ranges used bare timestamp strings such as `YYYY-MM-DDT00:00:00` and an inclusive `23:59:59` endpoint. This could drift at timezone boundaries and omit fractional-second records at the end of a day.

Fix:
- start boundary now uses `S.zonedInputToIso(range.start + 'T00:00')`;
- end boundary is local midnight of the next day;
- order query uses an exclusive `.lt('sold_at', end)` upper bound;
- first-of-month derives from `S.todayIso()` so the configured timezone is used consistently.

Regression test: `tests/report-timezone-range.test.cjs`.

## False positive removed during the audit

An initial pass suggested customer-specific pricing was disconnected from direct order creation. A deeper code trace found the existing integration in `js/order-extensions.js`, including customer changes, product changes, and restoring the customer price after a manual override is disabled.

A redundant listener created during investigation was removed before merge. The existing behavior is now protected by `tests/order-customer-special-pricing.test.cjs`.

## Audit waves

### Wave 1 — Boot, PWA, cache, navigation

Reviewed service-worker install/activation/fallback logic, cache versioning, versioned asset fallback, and app boot references. Existing service-worker regression coverage remains active. New guard modules were added to `index.html` and the PWA shell cache.

Result: no unresolved reproducible defect found after fixes.

### Wave 2 — Authentication, profile, organizations, team, authorization

Reviewed login/signup/recovery/logout routing, role helpers, RLS status, organization scoping, security-definer functions, and public RPC grants.

Result: RLS enabled on all public application tables reviewed; anonymous RPC grants hardened by `20260917181253`.

### Wave 3 — Orders and payments

Reviewed direct order creation, initial payment, multiple partial payments, payment-method metadata, order totals, balance synchronization, and payment status.

Production integrity query result: zero order total/subtotal/payment-summary mismatches.

Existing regression: multiple legitimate partial payments remain supported.

### Wave 4 — Products, inventory, stock integrity

Reviewed product/stock flows, stock movement ledger consistency, low-stock state, and organization linkage.

Production integrity query result: zero stock-ledger mismatches and zero cross-organization order-item mismatches.

### Wave 5 — Customers and personalized pricing

Reviewed saved customer-product prices, order application, quote application, manual override behavior, and historical snapshots.

Result: existing implementation confirmed; regression coverage added to prevent accidental disconnection.

### Wave 6 — Quotes and conversion

Reviewed quote totals, status transitions/history, conversion workflow, and backup coverage.

Production integrity query result: zero quote subtotal/total mismatches and zero converted quotes missing their converted order.

Quote status history backup/restore remains covered by existing regression tests.

### Wave 7 — Production and calendar

Reviewed stage management, stage history, order-production organization linkage, role permissions, calendar linkage, and offline production updates.

Production integrity query result: zero cross-organization production rows and zero orders with multiple simultaneously open stage-history rows.

Viewer UI and offline role mismatches corrected.

### Wave 8 — 3D module and filament inventory

Reviewed optional module state, filament roll balances, consumption rules, automatic 3D cost/pricing formula, editable final price, persistence, and backup coverage.

Production integrity query result: zero negative/over-initial filament balances.

Viewer UI mismatch corrected. Existing 3D formula and backup regressions remain active.

### Wave 9 — Costs, finance, dashboard, reports

Reviewed cost access, revenue/received/receivable, gross profit, dashboard role behavior, report range filtering, and CSV path.

Dashboard role mismatch and timezone boundary defect corrected.

### Wave 10 — Attachments and generated documents

Reviewed private attachment/document flows and generated business documents. Receipt generation role mismatch corrected so payment statements cannot be generated from an incomplete finance view.

No privileged storage credential was introduced into browser code.

### Wave 11 — Backup and restoration

Reviewed JSON v2 restore composition, payment metadata, quote status history, 3D pricing state, audit history, ownership checks, and migration ordering.

Audit-history data-loss defect corrected. Restore stays owner-only and versioned.

### Wave 12 — Offline queue, synchronization, conflicts

Reviewed allowed mutation types, organization/user queue keys, UUID idempotency, base timestamp conflict detection, reconnect behavior, and conflict resolution permissions.

Cross-tenant production lookup and Viewer queue/control defects corrected.

### Wave 13 — Notifications and business email

Reviewed notification generation/read behavior, deduplication keys, operational notification permissions, and frontend secret handling.

Viewer refresh permission mismatch corrected.

A real external email send was not used as an audit requirement because it depends on provider/account configuration. Code-path review and frontend credential checks remain part of CI.

### Wave 14 — Deployment, public pages, security posture

Reviewed Vercel preview deployment status, PWA/public assets, frontend credential validation, Supabase advisors, RLS, migration alignment, and application RPC grants.

The audit preview deployment reached Vercel `Ready` during the review.

## Production data integrity evidence

Read-only checks performed against the connected Supabase project returned zero violations for:

- order total mismatch;
- order subtotal versus item total mismatch;
- order paid amount versus valid paid income mismatch;
- product stock versus latest inventory ledger balance mismatch;
- quote total mismatch;
- quote subtotal mismatch;
- multiple open production-stage history rows per order;
- production row organization mismatch;
- order-item organization mismatch;
- negative/over-initial filament balance;
- converted quote missing converted order.

No existing business records were intentionally modified for these checks.

## Security/advisor review

Supabase Security Advisor found no new database/RLS security finding caused by the audit.

Account-level warning still present:
- leaked-password protection is disabled. This is an authentication/account configuration setting rather than a repository code defect and was not silently enabled by the audit.

Performance Advisor reported unused indexes. In a young/low-volume project this is informational and not sufficient evidence to remove indexes; no index was removed without workload evidence.

## Migrations introduced by the audit

- `20260917175529_audit_restore_and_offline_tenant_isolation.sql`
- `20260917181253_revoke_anon_app_rpc_execution.sql`

Both migrations were applied to the connected Supabase project and committed to the audit branch.

## Regression tests introduced/updated

- `backup-audit-log-restore.test.cjs`
- `dashboard-finance-role.test.cjs`
- `documents-role-permissions.test.cjs`
- `inventory-3d-viewer-readonly.test.cjs`
- `notifications-viewer-readonly.test.cjs`
- `offline-production-tenant-isolation.test.cjs`
- `offline-production-viewer-readonly.test.cjs`
- `order-customer-special-pricing.test.cjs`
- `production-viewer-readonly.test.cjs`
- `report-timezone-range.test.cjs`
- `rpc-anon-permissions.test.cjs`
- `sync-conflicts-viewer-readonly.test.cjs`

Existing tests for partial payments, service-worker fallback, quote-history backup, and 3D pricing/backup remain in the suite.

## External/deferred items

These are not unresolved code defects from this audit:

1. Supabase leaked-password protection is account-level configuration and remains disabled until the account owner chooses to enable it.
2. Official Shopee/Mercado Livre synchronization remains intentionally out of scope.
3. A real provider-delivered business email is dependent on external provider/account configuration; the audit did not send unsolicited production email.

## Merge gate

The audit is ready to merge only when the final branch head has:

- complete GitHub CI green;
- JavaScript syntax validation green;
- modular reference/behavior checks green;
- privileged frontend credential scan green;
- Vercel preview deployment ready;
- no unresolved Critical/High/Medium defect found by this audit.

After merge, the production deployment must be checked for successful boot/public availability before the audit is marked complete.

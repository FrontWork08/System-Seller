# System Seller Full Quality Audit Design

## Goal

Perform a full behavioral and technical audit of System Seller, identify reproducible defects across the product, fix every defect found within the agreed scope, and add regression coverage so the same failures do not return silently.

The audit does not claim mathematical “zero bugs”. Completion means: every defect found by this audit is either fixed and verified or explicitly documented with evidence explaining why it could not be safely changed in the same audit.

## Baseline

Repository: `FrontWork08/System-Seller`

Production branch baseline at audit start: `main` commit `00ced523f9eb38214797001fb46b037054961695`.

Architecture: static HTML/CSS/JavaScript frontend, Supabase backend, private storage, Edge Functions, PWA/service worker, Vercel deployment.

Existing CI already checks Node syntax, selected behavior markers, references, manifest/service-worker basics, frontend credential leakage, and the current unit tests. The audit will extend this with behavioral regression tests where gaps are found.

## Core Principles

1. Find root cause before fixing symptoms.
2. Reproduce every bug consistently whenever possible.
3. Add a failing regression test before the fix when the failure can be automated.
4. Make the smallest safe change that corrects the root cause.
5. Do not bundle unrelated refactors into bug fixes.
6. Preserve existing user data and historical business records.
7. Never use destructive production tests when a transaction, rollback, read-only query, temporary test record, or isolated branch can prove the behavior.
8. Keep frontend secrets limited to public/publishable configuration; never introduce privileged credentials into browser code.
9. Respect existing business decisions, including multiple partial payments, customer-specific pricing, optional 3D workflows, controlled offline mode, and restorable backups.
10. Marketplace APIs remain deferred; their absence is not a bug unless an existing UI falsely claims that synchronization is active.

## Severity Model

### Critical

A bug that can expose another organization’s data, bypass authorization, corrupt or irreversibly lose data, break backup restoration, duplicate or misstate financial records, or make the application unavailable for normal use.

### High

A bug that blocks a primary workflow such as login, creating an order, receiving a payment, stock movement, quote conversion, production updates, document generation, or restoring a valid backup.

### Medium

A bug that produces wrong business-state calculations, stale UI state, inconsistent offline synchronization, missing history, incorrect reports, broken navigation, or misleading operational feedback while a workaround still exists.

### Low

A visual, copy, responsiveness, or non-critical usability defect that does not corrupt data or block the workflow.

Critical and High bugs are fixed before merge. Medium bugs found during the audit are also fixed unless doing so would require a separate architectural redesign. Low bugs are fixed when bounded and safe; otherwise they are documented for a follow-up batch rather than mixed into riskier backend changes.

## Audit Waves

### Wave 1 — Boot, PWA, cache, and navigation

Audit:
- application boot sequence;
- service-worker install/update/activation;
- cache-version transitions;
- versioned asset lookup;
- offline fallback behavior;
- stale cache recovery;
- browser refresh and reopening installed PWA;
- route/page loading;
- logout/login transition;
- modal and navigation state after errors.

Expected regressions to protect include the previously fixed infinite-loading failure caused by service-worker cache mismatch.

### Wave 2 — Authentication, profile, organizations, team, and authorization

Audit:
- signup;
- email confirmation redirect;
- login/logout;
- password reset;
- session restore;
- profile creation race conditions;
- profile-photo access;
- organization membership;
- owner/admin/operator/viewer boundaries;
- team invites;
- privileged RPC grants;
- RLS coverage on exposed tables;
- unauthorized cross-organization reads and writes.

The audit must inspect Supabase security advisors and must not weaken RLS or grant broad access merely to make a failing operation work.

### Wave 3 — Orders and payments

Audit:
- order creation;
- multiple items;
- discounts and shipping;
- customer-specific prices;
- initial payments;
- repeated partial payments;
- overpayment rejection;
- full-payment transition;
- refunds/cancellations where supported;
- financial transaction history;
- `paid_amount`, balance, and `payment_status` synchronization;
- order status transitions;
- duplicate submission behavior;
- data shown after reopening an order.

Financial totals must be derived consistently from active paid transactions and must not create duplicate or hidden income entries.

### Wave 4 — Products, inventory, and stock integrity

Audit:
- product CRUD/restore behavior;
- stock decreases during orders;
- stock reversal when applicable;
- no negative stock where forbidden;
- concurrent or duplicate mutations;
- low-stock states;
- historical order-item snapshots after product edits/deactivation;
- search and pagination consistency.

### Wave 5 — Customers and personalized pricing

Audit:
- customer CRUD;
- saved customer-product prices;
- application of saved prices to new orders and quotes;
- manual override behavior;
- historical orders remaining unchanged after pricing edits;
- deletion/deactivation edge cases.

### Wave 6 — Quotes and conversion

Audit:
- quote creation;
- item totals, discounts, shipping, validity, notes;
- quote status transitions;
- quote status history;
- attachments;
- explicit quote-to-order conversion;
- idempotency and duplicate conversion protection;
- preservation of quote snapshots and customer pricing;
- backup/restoration of quote history.

### Wave 7 — Production and calendar

Audit:
- default stages;
- custom stage ordering and activation;
- production assignment;
- responsible users;
- planned dates;
- stage-history entries;
- calendar inclusion and date boundaries;
- overdue/stalled calculations;
- offline stage updates and conflicts.

### Wave 8 — 3D module and filament inventory

Audit:
- optional `enable_3d` behavior;
- filament roll creation and remaining weight;
- consumption validation;
- low-stock alerts;
- material/color linkage;
- 3D job snapshots;
- automatic pricing formula;
- material, energy, machine-use, labor/finishing, and margin calculations;
- suggested price versus editable final price;
- order/quote price application;
- 3D pricing backup/restoration.

The audit must preserve the rule that the suggested price is automatic but the final charged price remains editable.

### Wave 9 — Costs, finance, dashboard, and reports

Audit:
- order costs;
- cost categories;
- revenue totals;
- received versus receivable;
- gross profit and margin;
- average ticket;
- overdue calculations;
- top product/customer/store aggregations;
- date-range boundaries and timezone handling;
- CSV export;
- exclusion of cancelled/refunded transactions where appropriate;
- consistency between dashboard, order details, and financial transaction tables.

### Wave 10 — Attachments and generated documents

Audit:
- private upload permissions;
- file type/size handling;
- signed URLs;
- deletion permissions;
- quote/order/payment attachment linkage;
- PDF/print document snapshots;
- receipt/payment statement correctness after partial payments;
- production work orders;
- business identity fields.

### Wave 11 — Backup and restoration

Audit:
- JSON v2 export;
- portable ZIP export;
- current modular table coverage;
- quote status history;
- 3D pricing settings and snapshots;
- payment metadata;
- attachment manifest/files;
- restore ordering and foreign keys;
- old compatible backup behavior;
- owner-only restore authorization;
- transactional failure safety;
- post-restore data consistency.

Every table or setting considered part of the portable business state must be either included or explicitly excluded by documented policy.

### Wave 12 — Offline queue, synchronization, and conflicts

Audit:
- allowed mutation types;
- mutation UUID/idempotency;
- base `updated_at` conflict detection;
- cache reads while offline;
- reconnect behavior;
- repeated sync attempts;
- conflict resolution;
- online-only financial/inventory operations remaining blocked offline;
- stale UI refresh after synchronization.

### Wave 13 — Notifications and business email

Audit:
- overdue/due-soon/outstanding balance notifications;
- low product and low filament warnings;
- stalled production warnings;
- deduplication;
- collection summaries;
- email outbox states;
- Edge Function error handling;
- provider-not-configured behavior;
- no secret exposure in frontend.

A real external email send is only considered verified if provider configuration is available and a controlled test can be performed safely.

### Wave 14 — Deployment, public pages, and security posture

Audit:
- Vercel production accessibility;
- static asset availability;
- security headers;
- PWA manifest;
- public marketing page;
- privacy/terms/support/account-deletion links;
- `noindex` behavior for the private app;
- frontend credential scans;
- Supabase security advisors;
- production migration/repository migration alignment.

Known account-level configuration such as leaked-password protection may require dashboard/account settings rather than a code migration. Such items are reported separately from code defects.

## Evidence and Testing Strategy

For each reproducible defect:

1. Record the failing behavior and affected subsystem.
2. Trace it to the responsible frontend code, database constraint/RPC/policy, service worker, storage rule, Edge Function, or deployment configuration.
3. Add a regression test before the fix whenever practical.
4. Prove the test fails for the original reason.
5. Apply the smallest root-cause fix.
6. Prove the new test passes.
7. Run the full existing test suite and syntax/static validation.
8. If backend behavior changed, verify database schema/functions/indexes/policies with read-only queries and run Supabase advisors.
9. If production data must be exercised, prefer `BEGIN ... ROLLBACK`, temporary disposable records, or an isolated environment. Never permanently alter existing business data merely to test a fix.
10. Verify the deployed application for relevant public/boot flows after merge.

## Test Coverage Expansion

The audit will add tests around discovered failure modes rather than creating a large abstract test framework first. Priority test categories are:

- payment and financial invariants;
- stock invariants;
- quote conversion idempotency;
- backup section coverage and restore compatibility;
- service-worker/cache invariants;
- 3D pricing formulas and persistence;
- offline mutation eligibility/idempotency;
- permission/grant/RLS invariants that can be asserted safely;
- document/report calculations when pure functions or stable fixtures make automation practical.

## Data Integrity Invariants

The audit treats these as hard rules:

- an organization cannot read or mutate another organization’s protected data;
- a payment cannot exceed an order’s remaining balance;
- multiple legitimate partial payments are allowed;
- received totals equal valid active payment transactions;
- stock cannot silently diverge from successful inventory mutations;
- quote conversion cannot create multiple orders from one explicit conversion action;
- old orders/quotes preserve their historical price snapshots;
- backup restoration must not silently drop covered business data;
- final 3D price remains editable even when a suggested price is calculated;
- offline mode cannot bypass operations intentionally restricted to online execution.

## Change Management

All audit implementation work will occur on the branch `audit/full-system-quality-2026-09-17` or short-lived child branches based on it.

Each independent bug should be committed separately or in a narrowly related batch so a regression can be reverted without discarding unrelated fixes.

No direct production schema change is considered complete until a matching migration exists in the repository and the production migration history is aligned.

Critical production fixes may be applied to the Supabase project before final merge only when necessary to stop active data corruption or a broken core workflow; the same change must immediately be represented in the audit branch migration and verified before merge.

## Completion Criteria

The audit is complete when all of the following are true:

- every audit wave has been inspected;
- all reproducible Critical and High bugs found are fixed;
- all reproducible Medium bugs found are fixed unless they require a separately approved architectural redesign;
- bounded Low bugs found during touched flows are fixed or documented;
- each fixed behavioral bug has regression coverage where automation is practical;
- full GitHub CI is green on the final audit commit;
- JavaScript syntax checks pass for every frontend module and service worker;
- no privileged credentials are present in frontend code;
- Supabase security/performance advisors are reviewed after final DDL/RPC/policy changes;
- no new security warnings caused by the audit remain unresolved;
- production migration history matches committed migrations introduced by the audit;
- the live production site passes final boot/login-page/public-page smoke checks;
- an audit report summarizes bugs found, fixes applied, tests added, known external configuration warnings, and any explicitly deferred architectural issue.

## Out of Scope

Unless a defect requires it for correctness, this audit does not:

- redesign the entire visual system;
- rewrite the application into another framework;
- implement Shopee or Mercado Livre official APIs;
- add unrelated new business features;
- change pricing/economic rules that are already deliberate product decisions;
- silently enable paid/external services or modify account-level settings that require the owner’s explicit confirmation.

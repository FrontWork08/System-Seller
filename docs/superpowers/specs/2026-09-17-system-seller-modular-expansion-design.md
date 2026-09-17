# System-Seller — Modular Expansion Design

Date: 2026-09-17
Status: Approved design, pending implementation plan
Repository: FrontWork08/System-Seller

## 1. Goal

Evolve the existing System-Seller into a broader operational management platform without rewriting the working core and without adding Shopee or Mercado Livre API integrations yet.

The expansion must preserve the existing authentication, organization isolation, orders, inventory, finance, team roles, audit, backup, profile and deployment flows while introducing new capabilities as isolated modules.

## 2. Architectural direction

Use a modular evolution of the current application.

The existing core remains responsible for authentication, organizations/stores, customers/products, orders/order items, payments/financial transactions, team membership/permissions, audit and backup/restore.

New capabilities are implemented as separate frontend modules and separate database tables/functions where appropriate. Modules communicate through stable IDs and database functions rather than depending on another module's internal implementation.

All organization-owned data includes `organization_id` and follows the existing Row Level Security model. Critical multi-record operations use transactional RPCs rather than unrelated browser writes.

Server-side jobs that require secrets or privileged outbound calls, such as business-notification email delivery, use Supabase server-side functionality/Edge Functions with secrets kept out of the browser.

## 3. Functional scope

### 3.1 Quotes

Add a quotation workflow containing organization, customer, optional store/channel, items, quantities, unit prices, discounts/shipping when applicable, optional expiration date, notes, attachments, status and status history.

A quote can remain valid indefinitely when no expiration is set. Expired quotes are visually identified.

Approval does not automatically create an order. An approved quote exposes **Convert to order**. Conversion copies customer, items, prices, dates, notes and relevant references into a normal order and stores a permanent quote/order link.

Conversion is transactional and idempotent so the same quote cannot accidentally generate multiple orders.

### 3.2 Production workflow

Add production tracking to orders with these default stages:

1. Aguardando pagamento
2. Na fila
3. Em produção
4. Acabamento
5. Pronto
6. Enviado/Retirada
7. Entregue

Quotes are pre-order records and are not production stages.

Each organization can add, rename, reorder and deactivate stages. A stage can be permanently deleted only when no historical or active record references it. Historical entries remain readable even after a stage is renamed or deactivated.

Each order may store current production stage, stage history, planned start, planned finish, estimated duration in minutes, delivery due date, optional responsible team member and operational notes.

### 3.3 Production calendar

Add daily and weekly calendar views based on order production/delivery fields. Surface planned starts/finishes, delivery deadlines, overdue work, duration estimates and current stage.

The calendar is a view of order data, not a separate source of truth.

### 3.4 Customer-specific pricing

Support a saved preferred price for each `(customer, product)` pair plus the historical prices actually charged in quotes and orders.

The saved price can prefill a quote/order item, while the final unit price remains manually editable per transaction. Changing the saved price never rewrites historical records.

### 3.5 Costs and profitability

Track costs independently from sale price, with categories for material, packaging, shipping paid by the company, marketplace/payment fees, labor and other.

Costs can be linked to an entire order or a specific order item. Derive item cost/profit, order cost/profit and profit summaries by date range.

Sale price remains manual. Cost tracking must not calculate, recommend or override selling price.

### 3.6 Optional 3D-printing module

The 3D-printing module is optional per organization and is enabled in organization settings. When disabled, 3D-specific navigation and fields are hidden.

When enabled, it supports 3D model/job references, STL/3MF attachments, material, color, estimated/actual print duration, finishing notes and material consumption.

The selling price for 3D work remains fully manual. Internal costs may be recorded, but the system does not calculate or suggest a sale price.

### 3.7 3D material inventory

Track filament/material rolls individually with material type, color, brand, initial weight, remaining weight, purchase cost, acquisition date, status and notes.

Material consumption is stored as movement records and may reference an order/order item. Consumption updates remaining weight transactionally and never allows negative stock. Low-material alerts use organization-configurable thresholds.

### 3.8 Attachments

Allow attachments on quotes and orders, including images, PDFs, STL, 3MF and other explicitly allowed file types.

Use private Supabase Storage scoped by organization and record. Metadata includes organization, entity type/id, storage path, original filename, MIME type, size, uploader and creation time.

Validate allowed type and size. Business files are never public; access uses authenticated authorization and private/signed URLs.

### 3.9 Payments and collections UX

Build on the existing partial-payment implementation. Order detail prominently shows total, received amount, remaining balance, payment status, payment history and payment method for each entry.

Add optional due date for outstanding balance, payment-proof attachments and clearer collection messaging.

Provide a copyable customer-facing collection summary generated from live order data. WhatsApp sending is out of scope now, but this message model must be reusable by a future integration.

### 3.10 Notifications and email

Add notifications for overdue orders, delivery due soon, outstanding payments, low product/material stock, production stalled beyond a configured threshold, failed email and offline-sync conflict.

Channels in scope are in-app and email. WhatsApp remains future work.

Notifications are deduplicated. A failed email never rolls back the business transaction that triggered it; failure is recorded and can be retried.

Business notification emails are sent server-side so provider credentials never reach the browser.

### 3.11 Dashboard and reports

Extend the dashboard with current-period revenue, amount receivable, overdue orders, due-today/soon work, average ticket, top products, top customers, sales by store/channel, recorded costs, gross profit, low-stock alerts and production workload.

Reports support useful date ranges and CSV export. Formal PDFs are covered by the document module below.

### 3.12 Business documents

Generate branded PDFs for:

- quotation;
- receipt/payment statement;
- production/work order.

Documents include organization logo/company information and configurable optional fields.

Generation starts from canonical, server-authorized data. Persisted document records store the source entity, generation time and immutable snapshot metadata so later record edits do not pretend that an older generated document contained newer information.

### 3.13 PWA and controlled offline mode

Make System-Seller installable as a Progressive Web App.

Offline capabilities:

- view cached operational data;
- create draft/new quotes;
- create draft/new orders;
- update permitted production stages;
- update operational notes.

Operations requiring live connectivity:

- payments/refunds;
- team/permission changes;
- destructive operations;
- critical stock movements;
- 3D material consumption affecting authoritative inventory;
- backup/restore;
- sensitive financial writes.

Offline mutations use a local queue containing a client mutation ID, base record version/timestamp, user and local timestamp. Synchronization is idempotent. If the server record changed after the client's base version, the client never silently overwrites it; a sync conflict is created for explicit resolution.

## 4. Navigation and UX

Group navigation into:

**Operação:** Dashboard, Pedidos, Orçamentos, Produção, Calendário.

**Comercial:** Clientes, Produtos, Preços especiais, Documentos.

**Financeiro:** Receitas/despesas, Pagamentos pendentes, Custos, Lucro, Relatórios.

**Estoque:** Produtos/estoque, Movimentações, Estoque 3D when enabled.

**Gestão:** Equipe, Lojas/canais, Notificações, Backup, Auditoria, Configurações.

Mobile prioritizes quick order/quote creation, customer lookup, production-stage changes and calendar use instead of wide tables.

Provide clear states for overdue, due today, awaiting payment, partially paid, low stock, stalled production, pending offline sync and sync conflict.

## 5. Authorization

Continue using `owner`, `admin`, `operator` and `viewer` while enforcing module-specific behavior in the database.

Baseline:

- owner/admin: organization/module/stage configuration, team, sensitive finance, backup and audit;
- operator: operational order/quote work, production updates and notes subject to organization membership;
- viewer: read-only access to allowed operational views.

Sensitive financial/administrative data remains restricted. Hiding UI controls alone is never considered authorization.

## 6. Data and transaction boundaries

The order remains the main operational record after quote conversion. New tables reference existing core records instead of copying them unnecessarily.

Critical transactional operations include quote-to-order conversion, payment/refund, product-stock decrement/restore, 3D-material consumption/restore and production transitions with side effects.

Retryable client mutations use idempotency keys where practical.

## 7. Error handling

Business operations return structured user-safe errors without exposing privileged internals.

Email and notification delivery failures are decoupled when failure should not invalidate the primary business transaction.

Offline conflicts are explicit; conflicting business edits never use silent last-write-wins.

## 8. Backup and restore

Extend organization backup coverage to all new durable business tables and files.

Provide two owner-only backup products:

1. **Quick JSON backup** — structured database data and attachment/file manifest, suitable for frequent operational backups and restoring records when files already remain in Storage.
2. **Full portable backup archive** — a downloadable archive containing `backup.json` plus private organization-owned attachments/documents required for portability.

Full restore accepts the portable archive, validates schema/version/organization ownership, restores records in dependency order, re-uploads included private files and restores their metadata/path relationships. Missing or invalid files are reported explicitly instead of silently ignored.

Restore preserves relational links, quote/order conversion links, production history, special pricing, costs, 3D inventory/movements, attachment metadata and generated-document metadata.

Backup/restore remains owner-only and server-validated. Current backups remain supported through versioned compatibility/migrations rather than being invalidated by the new format.

## 9. Security

Requirements:

- RLS on all organization-owned tables;
- no service-role/provider secrets in browser code;
- private Storage for business files;
- upload type/size validation;
- signed/authenticated file access;
- RPC authorization for critical operations;
- audit sensitive changes;
- preserve cross-organization isolation guarantees.

The existing Auth warning for leaked-password protection remains a production-hardening item independent of this expansion.

## 10. Testing strategy

Cover both isolated modules and end-to-end high-risk flows:

- quote creation/approval/one-time conversion;
- customer-specific/custom price preservation;
- partial payment, remaining balance and refund;
- product-stock decrement and cancellation restore;
- cost/profit calculations;
- 3D roll consumption and negative-stock prevention;
- production stage/history;
- role permissions;
- cross-organization isolation;
- private attachment access;
- notification deduplication;
- offline retry/idempotency/conflict detection;
- quick and full backup/restore.

CI continues validating JavaScript syntax/static references/security checks and expands incrementally as modules are added.

## 11. Frontend modularization

Do not continue concentrating new functionality in the already large `js/actions.js` and `js/pages.js` files.

Introduce focused modules, for example:

- `js/quotes.js`
- `js/production.js`
- `js/calendar.js`
- `js/costs.js`
- `js/customer-pricing.js`
- `js/attachments.js`
- `js/notifications.js`
- `js/inventory-3d.js`
- `js/reports.js`
- `js/documents.js`
- `js/pwa.js`
- `js/offline-sync.js`

Exact filenames may change during implementation, but responsibilities remain isolated. Shared helpers move into the core only when genuinely generic.

## 12. Delivery sequencing

Implement incrementally so each phase leaves the system deployable:

1. shared schema foundations and organization module settings;
2. quotes + customer-specific pricing;
3. safe quote-to-order conversion;
4. production stages/history;
5. production calendar;
6. costs/profit;
7. attachments;
8. optional 3D module + roll inventory;
9. notifications/email;
10. business PDF documents;
11. dashboard/reports;
12. PWA shell + offline read cache;
13. controlled offline mutation queue + conflict resolution;
14. full portable backup/restore extension and complete regression pass.

Existing partial payments remain core functionality and are integrated into the new screens rather than rebuilt.

## 13. Explicitly out of scope

- Shopee API integration;
- Mercado Livre API integration;
- WhatsApp sending/integration;
- automatic or suggested sale-price calculation for 3D printing;
- unrestricted offline financial/inventory writes;
- full rewrite into a new framework.

## 14. Success criteria

The expansion is successful when:

- existing core workflows still pass regression checks;
- organizations can use quotes, production, calendar, costs, special prices, attachments, notifications, reports and documents without marketplace integrations;
- each organization can independently enable the optional 3D module;
- 3D inventory accurately tracks rolls/material consumption;
- quote-to-order conversion is safe and non-duplicating;
- partial payments/outstanding balances remain correct;
- desktop/mobile workflows are practical;
- PWA installation works;
- permitted offline work synchronizes safely and conflicts are surfaced instead of overwritten;
- new data is isolated by organization;
- quick JSON and full portable backups can be restored safely;
- CI and database/security checks pass before release.

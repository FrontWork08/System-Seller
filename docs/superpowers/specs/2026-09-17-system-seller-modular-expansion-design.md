# System-Seller — Modular Expansion Design

Date: 2026-09-17
Status: Approved design, pending implementation plan
Repository: FrontWork08/System-Seller

## 1. Goal

Evolve the existing System-Seller into a broader operational management platform without rewriting the working core and without adding Shopee or Mercado Livre API integrations yet.

The expansion must preserve the existing authentication, organization isolation, orders, inventory, finance, team roles, audit, backup, profile and deployment flows while introducing new capabilities as isolated modules.

## 2. Architectural direction

Use a modular evolution of the current application.

The existing core remains responsible for:

- authentication;
- organizations and stores;
- customers and products;
- orders and order items;
- payments and financial transactions;
- team membership and permissions;
- audit;
- backup and restore.

New capabilities are implemented as separate frontend modules and separate database tables/functions where appropriate. New modules must not depend on another module's internal implementation. They communicate through stable record identifiers and database functions.

All organization-owned data must include `organization_id` and follow the existing Row Level Security model. Critical multi-record operations must be transactional RPCs rather than a sequence of unrelated browser writes.

## 3. Scope

### 3.1 Quotes

Add a complete quotation workflow.

A quote contains:

- organization;
- customer;
- optional store/channel;
- items;
- quantities;
- unit prices, including customer-specific or manually customized prices;
- discounts and shipping when applicable;
- optional expiration date;
- notes;
- attachments;
- status and status history.

A quote can remain valid without an expiration date. When an expiration date is set, the UI must clearly show expired quotes.

Approval does not automatically create an order. An approved quote exposes a **Convert to order** action. Conversion copies the customer, items, prices, due/delivery information, notes and relevant references into a normal order, and stores a permanent link between quote and order.

Conversion must be idempotent so the same quote cannot accidentally generate multiple orders.

### 3.2 Production workflow

Add production tracking to orders.

Provide default stages:

1. Aguardando pagamento
2. Na fila
3. Em produção
4. Acabamento
5. Pronto
6. Enviado/Retirada
7. Entregue

Quotes remain a separate pre-order state and are not themselves a production stage.

Each organization can:

- add stages;
- rename stages;
- reorder stages;
- deactivate/remove unused stages when safe.

Historic records must remain readable even if a stage is later renamed or deactivated.

Each order may store:

- current production stage;
- stage history;
- planned start;
- planned finish;
- estimated duration in minutes;
- delivery due date;
- optional responsible team member;
- operational notes.

### 3.3 Production calendar

Add daily and weekly calendar views using the production and delivery fields already stored on orders.

The calendar must surface:

- planned production starts;
- planned production finishes;
- delivery deadlines;
- overdue work;
- duration estimates;
- current production stage.

Do not duplicate order data into an independent calendar source of truth.

### 3.4 Customer-specific pricing

Support customer-specific prices per product.

The system must provide both:

- a saved preferred price for a `(customer, product)` pair;
- historical prices actually charged in quotes and orders.

When creating a quote/order, the saved customer price can prefill the item price, but the user can still override the final unit price for that transaction.

Changes to saved prices must never rewrite historical orders or quotes.

### 3.5 Costs and profitability

Track operational costs independently from sale price.

Supported cost categories include:

- material;
- packaging;
- shipping paid by the company;
- marketplace/payment fees;
- labor;
- other.

Costs can be linked to:

- an entire order;
- a specific order item.

The system must derive and display:

- item cost;
- item gross profit;
- order cost;
- order gross profit;
- profit summaries by date range.

Sale price remains manual. Cost tracking must not automatically change, recommend or override the selling price.

### 3.6 Optional 3D-printing module

The 3D-printing capability is optional per organization and is enabled from organization settings.

When disabled, 3D-specific navigation and fields are hidden.

When enabled, the module supports operational metadata such as:

- 3D-print job/model references;
- STL/3MF and related attachments;
- material;
- color;
- estimated/actual print duration;
- finishing notes;
- material consumption.

The selling price for 3D work remains fully manual. The system may record internal costs, but it must not calculate or suggest a selling price automatically.

### 3.7 3D material inventory

Track filament/material rolls individually.

Each roll can store:

- material type;
- color;
- brand;
- initial weight;
- current/remaining weight;
- purchase cost;
- acquisition date;
- status;
- notes.

Material consumption is stored as immutable movement records and may be associated with an order or order item.

A consumption operation must update remaining weight transactionally. Negative remaining weight is not allowed.

The system should expose low-material warnings using organization-configurable thresholds.

### 3.8 Attachments

Allow attachments on quotes and orders, including images, PDFs, STL, 3MF and other explicitly allowed file types.

Use private Supabase Storage paths scoped by organization and record.

Attachment metadata must include at least:

- organization;
- entity type;
- entity id;
- storage path;
- original filename;
- MIME type;
- size;
- uploader;
- created time.

Validate file type and size before finalizing upload metadata. Access must use authenticated authorization and private/signed access rather than public buckets for business files.

### 3.9 Payments and collections UX

Build on the existing partial-payment implementation.

Order detail should make the following immediately visible:

- total;
- received amount;
- remaining balance;
- payment status;
- payment history;
- method used for each payment.

Add optional due date for outstanding balance, proof/attachment support, and clearer collection messaging.

Provide a copyable customer-facing collection summary generated from live order data. WhatsApp sending itself is out of scope for this version, but the message-generation boundary must be reusable by a future integration.

### 3.10 Internal notifications and email

Add a notification subsystem for events such as:

- overdue orders;
- delivery due soon;
- outstanding payments;
- low product/material inventory;
- production item stopped in the same stage beyond a configured threshold;
- failed outbound email;
- offline synchronization conflict.

Channels in scope:

- in-app notifications;
- email.

WhatsApp is intentionally not integrated now, but notification payloads should be channel-neutral enough to support it later.

Notifications must be deduplicated so recurring checks do not create repeated identical alerts.

A failed email must not roll back the business operation that triggered it. Delivery failure is recorded for retry/visibility.

### 3.11 Dashboard and reports

Extend the dashboard with operational and financial indicators, including:

- current-period revenue;
- amount still receivable;
- overdue orders;
- orders due today/soon;
- average ticket;
- top-selling products;
- top customers by sales;
- sales by store/channel;
- estimated/recorded costs;
- gross profit;
- low inventory alerts;
- production workload.

Reports should support useful date ranges and CSV export. PDF export is required for formal business documents described below; other report PDFs can be added when justified during implementation.

### 3.12 Business documents

Generate branded PDF documents using current database data.

Required documents:

- quotation;
- receipt/payment statement;
- production/work order.

Documents include organization logo and company information and support configurable optional fields.

Generation must use current server-authorized data rather than trusting arbitrary values provided by the browser.

### 3.13 PWA and controlled offline mode

Make System-Seller installable as a Progressive Web App.

Offline capabilities in scope:

- view cached operational data;
- create draft/new quotes;
- create draft/new orders;
- update permitted production stages;
- update operational notes.

Operations that require live connectivity:

- payments and refunds;
- user/team/permission changes;
- destructive operations;
- critical stock movements;
- 3D material consumption that changes authoritative inventory;
- backup/restore;
- sensitive financial writes.

Offline writes are placed in a local queue with a client mutation id, record version/base timestamp, user and local timestamp.

On reconnect, synchronization must be idempotent. If the server record changed after the client's base version, the system must not silently overwrite it. A synchronization conflict is recorded and surfaced for resolution.

## 4. Navigation and user experience

Group the application navigation into logical areas.

### Operação

- Dashboard
- Pedidos
- Orçamentos
- Produção
- Calendário

### Comercial

- Clientes
- Produtos
- Preços especiais
- Documentos

### Financeiro

- Receitas/despesas
- Pagamentos pendentes
- Custos
- Lucro
- Relatórios

### Estoque

- Produtos/estoque
- Movimentações
- Estoque 3D (only when enabled)

### Gestão

- Equipe
- Lojas/canais
- Notificações
- Backup
- Auditoria
- Configurações

The responsive/mobile experience prioritizes quick creation of orders/quotes, customer lookup, production-stage updates and calendar viewing instead of wide desktop tables.

Provide clear visual states for:

- overdue;
- due today;
- awaiting payment;
- partially paid;
- low stock;
- stalled production;
- pending offline synchronization;
- synchronization conflict.

## 5. Authorization

Continue using the existing roles (`owner`, `admin`, `operator`, `viewer`) while enforcing finer-grained behavior inside each module.

Expected baseline:

- owner/admin: organization configuration, stage configuration, module enablement, team, sensitive finance, backup and audit;
- operator: operational order/quote work, production updates and notes, subject to existing organization membership;
- viewer: read-only access to allowed operational views;
- sensitive financial and administrative information remains restricted according to existing policy.

Authorization is enforced in the database, not only by hiding UI controls.

## 6. Data and transaction boundaries

The order remains the primary operational record after quote conversion.

New records reference the existing core rather than copying it unnecessarily.

Important transactional operations include:

- quote to order conversion;
- payment/refund;
- product inventory decrement/restore;
- 3D material consumption/restore;
- production-stage transitions where side effects exist.

Every client-generated mutation that can be retried should carry an idempotency key where practical.

## 7. Error handling

Business operations return structured errors suitable for user-facing messages without exposing privileged internals.

Email, document-generation and notification side effects must be decoupled where failure should not invalidate the primary business transaction.

Offline conflicts must be explicit; last-write-wins is not acceptable for conflicting business edits.

## 8. Backup and restore

Extend organization backup coverage to all new durable business tables.

Restore must preserve:

- relational links;
- quote/order conversion links;
- production history;
- special pricing;
- costs;
- notification records when included by policy;
- 3D inventory and material movements;
- attachment metadata.

Binary Storage files require an explicit backup policy separate from JSON metadata. The implementation plan must decide whether operational export includes downloadable binaries or documents the Storage backup dependency clearly.

Restore remains owner-only and must use server-side validation.

## 9. Security

Requirements:

- RLS on all organization-owned tables;
- no service-role or privileged credentials in the browser;
- private Storage for business attachments;
- size/type validation for uploads;
- signed/authenticated file access;
- RPC authorization for critical operations;
- audit sensitive changes;
- keep current cross-organization isolation guarantees.

The existing Auth warning for leaked-password protection should be treated as a production-hardening item, but it is independent of this modular expansion.

## 10. Testing strategy

New modules require both isolated tests and end-to-end business-flow validation.

High-risk flows to cover:

- quote creation, approval and one-time conversion to order;
- custom/customer-specific price preservation;
- partial payment and remaining balance;
- refund behavior;
- product stock decrement and cancellation restore;
- cost and profit calculations;
- 3D roll consumption and prevention of negative stock;
- production stage/history behavior;
- role permissions;
- cross-organization isolation;
- private attachment access;
- notification deduplication;
- offline queue retry/idempotency;
- offline conflict detection;
- backup/restore of newly introduced records.

CI must continue validating JavaScript syntax/static references/security checks and should be expanded as new modules are introduced rather than waiting until the end of the project.

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

Exact filenames can be adjusted during implementation, but responsibilities should stay isolated.

Shared helpers belong in the core only when they are truly generic.

## 12. Delivery sequencing

Implementation should be incremental so each phase leaves the system deployable.

Recommended dependency order:

1. shared schema foundations/module settings;
2. quotes + customer-specific pricing;
3. quote-to-order conversion;
4. production stages + history;
5. production calendar;
6. costs/profit;
7. attachments;
8. optional 3D module + roll inventory;
9. notifications/email;
10. business PDF documents;
11. dashboard/reports;
12. PWA shell + offline read cache;
13. controlled offline mutation queue + conflict resolution;
14. backup/restore extension and full regression pass.

Payments already implemented remain part of the core and should be integrated into the new screens rather than rebuilt.

## 13. Explicitly out of scope for this expansion

- Shopee API integration;
- Mercado Livre API integration;
- WhatsApp sending/integration;
- automatic or suggested sale-price calculation for 3D printing;
- unrestricted offline financial or inventory writes;
- full application rewrite into a new framework.

## 14. Success criteria

The expansion is successful when:

- existing core workflows still pass regression checks;
- organizations can use quotes, production, calendar, costs, special prices, attachments, notifications, reports and documents without marketplace integrations;
- organizations can independently enable the optional 3D module;
- 3D inventory accurately tracks rolls and material consumption;
- quote-to-order conversion is safe and non-duplicating;
- partial payments and outstanding balance remain correct;
- desktop and mobile workflows are practical;
- PWA installation works;
- permitted offline work synchronizes safely and conflicts are surfaced instead of overwritten;
- new data remains isolated by organization and covered by backup/restore policy;
- CI and database/security checks pass before release.

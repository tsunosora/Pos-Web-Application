# 📡 Referensi Endpoint API

> Dibangkitkan otomatis oleh `tools/gen-wiki-referensi.js` — jangan disunting tangan.
> Jalankan ulang skripnya setelah menambah fitur.


PosPro menyajikan **594 endpoint** dalam **75 controller**.
Sebanyak **60 endpoint tanpa penjaga login** — itu memang disengaja untuk
halaman publik (landing, artikel, tautan penilaian, verifikasi PIN) dan webhook,
tetapi daftar ini juga berguna saat mengaudit akses.

**Cara membaca kolom Penjaga:** `JwtAuthGuard` = wajib token login ·
`RolesGuard`/`ManagerGuard`/`OwnerGuard` = dibatasi peran · `MenuGuard` = peran yang diberi menunya
(Akses Menu Role) · `BoardOrUserGuard` = token papan kerja dari PIN atau token login ·
kosong = terbuka (publik/webhook/PIN per permintaan).
Rinciannya di [Model Akses & Keamanan](keamanan-akses.md).

## Ringkasan per kelompok

| Jalur dasar | Kelas | Endpoint | Berkas |
|---|---|---:|---|
| `/` | AppController | 1 | `backend/src/app.controller.ts` |
| `/articles` | ArticlesController | 7 | `backend/src/articles/articles.controller.ts` |
| `/auth` | AuthController | 2 | `backend/src/auth/auth.controller.ts` |
| `/backup` | BackupController | 8 | `backend/src/backup/backup.controller.ts` |
| `/bank-accounts` | BankAccountsController | 5 | `backend/src/bank-accounts/bank-accounts.controller.ts` |
| `/batches` | BatchesController | 5 | `backend/src/batches/batches.controller.ts` |
| `/bonus` | BonusController | 4 | `backend/src/bonus/bonus.controller.ts` |
| `/branch-inbox` | BranchInboxController | 10 | `backend/src/branch-inbox/branch-inbox.controller.ts` |
| `/branch-ledger` | BranchLedgerController | 7 | `backend/src/branch-ledger/branch-ledger.controller.ts` |
| `/branch-settings` | BranchSettingsController | 2 | `backend/src/branch-settings/branch-settings.controller.ts` |
| `/branch-stock` | BranchStockController | 4 | `backend/src/branch-stock/branch-stock.controller.ts` |
| `/branch-work-orders` | BranchWorkOrdersController | 7 | `backend/src/branch-work-orders/branch-work-orders.controller.ts` |
| `/branches` | BranchesController | 4 | `backend/src/branches/branches.controller.ts` |
| `/cashflow` | CashflowController | 8 | `backend/src/cashflow/cashflow.controller.ts` |
| `/cashflow-requests` | CashflowRequestsController | 5 | `backend/src/cashflow-requests/cashflow-requests.controller.ts` |
| `/categories` | CategoriesController | 5 | `backend/src/categories/categories.controller.ts` |
| `/click-counting` | ClickCountingController | 19 | `backend/src/click-counting/click-counting.controller.ts` |
| `/company-branches` | CompanyBranchesController | 6 | `backend/src/company-branches/company-branches.controller.ts` |
| `/competitors` | CompetitorsController | 4 | `backend/src/competitors/competitors.controller.ts` |
| `/crm/custom-product-metrics` | CustomProductMetricsController | 4 | `backend/src/crm/custom-product-metrics/custom-product-metrics.controller.ts` |
| `/crm/follow-ups` | FollowUpsController | 7 | `backend/src/crm/follow-ups/follow-ups.controller.ts` |
| `/crm/kpi` | KpiController | 11 | `backend/src/crm/kpi/kpi.controller.ts` |
| `/crm/lead-sources` | LeadSourcesController | 2 | `backend/src/crm/leads/lead-sources.controller.ts` |
| `/crm/leads` | LeadsController | 13 | `backend/src/crm/leads/leads.controller.ts` |
| `/crm/public` | KpiPublicController | 5 | `backend/src/crm/kpi/kpi-public.controller.ts` |
| `/crm/templates` | TemplatesController | 7 | `backend/src/crm/templates/templates.controller.ts` |
| `/cs-rating` | CsRatingController | 4 | `backend/src/cs-rating/cs-rating.controller.ts` |
| `/cs-rating/public` | CsRatingPublicController | 5 | `backend/src/cs-rating/cs-rating-public.controller.ts` |
| `/customers` | CustomersController | 11 | `backend/src/customers/customers.controller.ts` |
| `/customers` | CustomersPublicController | 1 | `backend/src/customers/customers.controller.ts` |
| `/designers` | DesignersAdminController | 4 | `backend/src/designers/designers.controller.ts` |
| `/designers` | DesignersPublicController | 2 | `backend/src/designers/designers.controller.ts` |
| `/discord` | DiscordController | 3 | `backend/src/discord/discord.controller.ts` |
| `/fixed-expenses` | FixedExpensesController | 4 | `backend/src/fixed-expenses/fixed-expenses.controller.ts` |
| `/hpp` | HppController | 12 | `backend/src/hpp/hpp.controller.ts` |
| `/hr` | HrSummaryController | 2 | `backend/src/integrations/hr-summary.controller.ts` |
| `/hr/pin` | HrPinController | 1 | `backend/src/integrations/hr-pin.controller.ts` |
| `/integrations` | StaffKpiController | 5 | `backend/src/integrations/staff-kpi.controller.ts` |
| `/invoices` | InvoiceController | 8 | `backend/src/invoice/invoice.controller.ts` |
| `/landing` | LandingController | 6 | `backend/src/landing/landing.controller.ts` |
| `/meta-ads` | MetaAdsController | 9 | `backend/src/meta-ads/meta-ads.controller.ts` |
| `/orders/public` | PublicOrdersController | 1 | `backend/src/crm/leads/public-orders.controller.ts` |
| `/print-queue` | PrintQueueController | 8 | `backend/src/print-queue/print-queue.controller.ts` |
| `/printer-relay` | PrinterRelayController | 9 | `backend/src/printer-relay/printer-relay.controller.ts` |
| `/production` | ProductionController | 28 | `backend/src/production/production.controller.ts` |
| `/production-categories` | ProductionCategoriesController | 4 | `backend/src/production-categories/production-categories.controller.ts` |
| `/products` | ProductsController | 25 | `backend/src/products/products.controller.ts` |
| `/products/public` | ProductsPublicController | 3 | `backend/src/products/products-public.controller.ts` |
| `/reports` | ReportsController | 23 | `backend/src/reports/reports.controller.ts` |
| `/reports/inter-branch-usage` | InterBranchUsageController | 1 | `backend/src/inter-branch-usage/inter-branch-usage.controller.ts` |
| `/sales-orders` | SalesOrdersController | 10 | `backend/src/sales-orders/sales-orders.controller.ts` |
| `/sales-orders/designer` | SalesOrdersPublicController | 12 | `backend/src/sales-orders/sales-orders-public.controller.ts` |
| `/settings` | SettingsController | 7 | `backend/src/settings/settings.controller.ts` |
| `/social` | MetaMessagingController | 22 | `backend/src/meta-messaging/meta-messaging.controller.ts` |
| `/social/data-deletion` | DataDeletionController | 2 | `backend/src/meta-messaging/data-deletion.controller.ts` |
| `/social/webhook` | SocialWebhookController | 2 | `backend/src/meta-messaging/social-webhook.controller.ts` |
| `/stock-movements` | StockMovementsController | 4 | `backend/src/stock-movements/stock-movements.controller.ts` |
| `/stock-opname/public` | StockOpnamePublicController | 3 | `backend/src/stock-opname/stock-opname.controller.ts` |
| `/stock-opname/sessions` | StockOpnameAdminController | 5 | `backend/src/stock-opname/stock-opname.controller.ts` |
| `/stock-purchases` | StockPurchasesController | 2 | `backend/src/stock-purchases/stock-purchases.controller.ts` |
| `/stock-transfers` | StockTransferController | 3 | `backend/src/stock-transfer/stock-transfer.controller.ts` |
| `/stock-transfers` | StockTransfersController | 2 | `backend/src/stock-transfers/stock-transfers.controller.ts` |
| `/studio-ai` | StudioAiController | 8 | `backend/src/studio-ai/studio-ai.controller.ts` |
| `/suppliers` | SuppliersController | 8 | `backend/src/suppliers/suppliers.controller.ts` |
| `/sync` | SyncController | 3 | `backend/src/sync/sync.controller.ts` |
| `/task-board` | TaskBoardController | 31 | `backend/src/task-board/task-board.controller.ts` |
| `/task-board/pin` | TaskBoardPinController | 6 | `backend/src/task-board/task-board-pin.controller.ts` |
| `/transactions` | TransactionsController | 15 | `backend/src/transactions/transactions.controller.ts` |
| `/units` | UnitsController | 5 | `backend/src/units/units.controller.ts` |
| `/users` | UsersController | 10 | `backend/src/users/users.controller.ts` |
| `/webhook` | WebhookController | 1 | `backend/src/webhook/webhook.controller.ts` |
| `/whatsapp` | WhatsappCloudController | 73 | `backend/src/whatsapp-cloud/whatsapp-cloud.controller.ts` |
| `/whatsapp` | WhatsappController | 10 | `backend/src/whatsapp/whatsapp.controller.ts` |
| `/whatsapp/webhook` | WhatsappWebhookController | 2 | `backend/src/whatsapp-cloud/webhook.controller.ts` |
| `/work-orders` | WorkOrdersController | 7 | `backend/src/crm/work-orders/work-orders.controller.ts` |

---

## AppController — `/`

Berkas: `backend/src/app.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/` | `getHello` | — _terbuka_ | — |

## ArticlesController — `/articles`

Berkas: `backend/src/articles/articles.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/articles/public` | `listPublic` | — _terbuka_ | — |
| GET | `/articles/public/:slug` | `getBySlug` | — _terbuka_ | — |
| GET | `/articles` | `list` | `JwtAuthGuard` | — |
| GET | `/articles/:id` | `getOne` | `JwtAuthGuard` | — |
| POST | `/articles` | `create` | `JwtAuthGuard, MenuGuard` | — |
| PUT | `/articles/:id` | `update` | `JwtAuthGuard, MenuGuard` | — |
| DELETE | `/articles/:id` | `remove` | `JwtAuthGuard, MenuGuard` | — |

## AuthController — `/auth`

Berkas: `backend/src/auth/auth.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/auth/login` | `login` | — _terbuka_ | — |
| GET | `/auth/me` | `getMe` | `JwtAuthGuard` | — |

## BackupController — `/backup`

Berkas: `backend/src/backup/backup.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, ManagerGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/backup/groups` | `getGroups` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/backup/export` | `exportBackup` | `OwnerGuard` | — |
| POST | `/backup/preview` | `previewBackup` | `OwnerGuard` | — |
| POST | `/backup/restore` | `restoreBackup` | `OwnerGuard` | — |
| GET | `/backup/rclone/status` | `getRcloneStatus` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/backup/rclone/settings` | `saveRcloneSettings` | `OwnerGuard` | — |
| POST | `/backup/rclone/trigger` | `triggerRcloneBackup` | `JwtAuthGuard, ManagerGuard` | — |
| GET | `/backup/rclone/progress` | `getRcloneProgress` | `JwtAuthGuard, ManagerGuard` | — |

## BankAccountsController — `/bank-accounts`

Berkas: `backend/src/bank-accounts/bank-accounts.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/bank-accounts` | `findAll` | `JwtAuthGuard` | — |
| POST | `/bank-accounts` | `create` | `ManagerGuard` | — |
| PATCH | `/bank-accounts/:id` | `update` | `ManagerGuard` | — |
| PATCH | `/bank-accounts/:id/reset-balance` | `resetBalance` | `ManagerGuard` | — |
| DELETE | `/bank-accounts/:id` | `remove` | `ManagerGuard` | — |

## BatchesController — `/batches`

Berkas: `backend/src/batches/batches.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/batches` | `create` | `JwtAuthGuard` | — |
| GET | `/batches` | `findAll` | `JwtAuthGuard` | — |
| GET | `/batches/:id` | `findOne` | `JwtAuthGuard` | — |
| PATCH | `/batches/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/batches/:id` | `remove` | `JwtAuthGuard` | — |

## BonusController — `/bonus`

Berkas: `backend/src/bonus/bonus.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/bonus/targets` | `listTargets` | `JwtAuthGuard` | — |
| POST | `/bonus/targets` | `upsertTarget` | `JwtAuthGuard` | — |
| POST | `/bonus/adjustments` | `upsertAdjustment` | `JwtAuthGuard` | — |
| GET | `/bonus/achievement` | `achievement` | `JwtAuthGuard` | — |

## BranchInboxController — `/branch-inbox`

Berkas: `backend/src/branch-inbox/branch-inbox.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branch-inbox` | `list` | `JwtAuthGuard` | — |
| GET | `/branch-inbox/unread-count` | `unreadCount` | `JwtAuthGuard` | — |
| GET | `/branch-inbox/ready-outbox` | `readyOutbox` | `JwtAuthGuard` | — |
| GET | `/branch-inbox/outbox` | `outbox` | `JwtAuthGuard` | — |
| POST | `/branch-inbox/:id/confirm-pickup` | `confirmPickup` | `JwtAuthGuard` | — |
| GET | `/branch-inbox/debug/routing` | `debugRouting` | `JwtAuthGuard` | — |
| GET | `/branch-inbox/:id` | `detail` | `JwtAuthGuard` | — |
| POST | `/branch-inbox/:id/acknowledge` | `acknowledge` | `JwtAuthGuard` | — |
| POST | `/branch-inbox/:id/ready` | `markReady` | `JwtAuthGuard` | — |
| POST | `/branch-inbox/:id/handover` | `markHandover` | `JwtAuthGuard` | — |

## BranchLedgerController — `/branch-ledger`

Berkas: `backend/src/branch-ledger/branch-ledger.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branch-ledger` | `list` | `JwtAuthGuard` | — |
| GET | `/branch-ledger/summary` | `summary` | `JwtAuthGuard` | — |
| GET | `/branch-ledger/:id` | `detail` | `JwtAuthGuard` | — |
| GET | `/branch-ledger/:id/bank-accounts` | `bankAccounts` | `JwtAuthGuard` | — |
| POST | `/branch-ledger/:id/settle-cash` | `settleCash` | `JwtAuthGuard` | — |
| GET | `/branch-ledger/:id/from-branch-stock` | `fromBranchStock` | `JwtAuthGuard` | — |
| POST | `/branch-ledger/:id/settle-stock` | `settleStock` | `JwtAuthGuard` | — |

## BranchSettingsController — `/branch-settings`

Berkas: `backend/src/branch-settings/branch-settings.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branch-settings/:branchId` | `getOne` | `JwtAuthGuard` | — |
| PUT | `/branch-settings/:branchId` | `upsert` | `ManagerGuard` | — |

## BranchStockController — `/branch-stock`

Berkas: `backend/src/branch-stock/branch-stock.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branch-stock/list` | `list` | `JwtAuthGuard` | — |
| GET | `/branch-stock/matrix` | `matrix` | `JwtAuthGuard` | — |
| GET | `/branch-stock/variant/:variantId` | `getStock` | `JwtAuthGuard` | — |
| POST | `/branch-stock/adjust` | `adjust` | `ManagerGuard` | — |

## BranchWorkOrdersController — `/branch-work-orders`

Berkas: `backend/src/branch-work-orders/branch-work-orders.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branch-work-orders/summary` | `getSummary` | `JwtAuthGuard` | — |
| GET | `/branch-work-orders` | `list` | `JwtAuthGuard` | — |
| GET | `/branch-work-orders/:id` | `findOne` | `JwtAuthGuard` | — |
| POST | `/branch-work-orders` | `create` | `JwtAuthGuard` | — |
| POST | `/branch-work-orders/:id/proof` | `uploadProof` | `JwtAuthGuard` | — |
| PATCH | `/branch-work-orders/:id/status` | `updateStatus` | `JwtAuthGuard` | — |
| PATCH | `/branch-work-orders/:id/items/:itemId/toggle` | `toggleItemDone` | `JwtAuthGuard` | — |

## BranchesController — `/branches`

Berkas: `backend/src/branches/branches.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/branches` | `findAll` | `JwtAuthGuard` | — |
| POST | `/branches` | `create` | `JwtAuthGuard` | — |
| PATCH | `/branches/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/branches/:id` | `remove` | `JwtAuthGuard` | — |

## CashflowController — `/cashflow`

Berkas: `backend/src/cashflow/cashflow.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/cashflow` | `create` | `JwtAuthGuard` | — |
| GET | `/cashflow` | `findAll` | `JwtAuthGuard` | — |
| GET | `/cashflow/monthly-trend` | `getMonthlyTrend` | `JwtAuthGuard` | — |
| GET | `/cashflow/bank-accounts-summary` | `getBankAccountsSummary` | `JwtAuthGuard` | — |
| GET | `/cashflow/category-breakdown` | `getCategoryBreakdown` | `JwtAuthGuard` | — |
| GET | `/cashflow/platform-breakdown` | `getPlatformBreakdown` | `JwtAuthGuard` | — |
| PATCH | `/cashflow/:id` | `update` | `ManagerGuard` | — |
| DELETE | `/cashflow/:id` | `remove` | `ManagerGuard` | — |

## CashflowRequestsController — `/cashflow-requests`

Berkas: `backend/src/cashflow-requests/cashflow-requests.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/cashflow-requests` | `create` | `JwtAuthGuard` | — |
| GET | `/cashflow-requests/pending` | `getPending` | `JwtAuthGuard` | — |
| GET | `/cashflow-requests/mine` | `getMine` | `JwtAuthGuard` | — |
| PATCH | `/cashflow-requests/:id/approve` | `approve` | `JwtAuthGuard` | — |
| PATCH | `/cashflow-requests/:id/reject` | `reject` | `JwtAuthGuard` | — |

## CategoriesController — `/categories`

Berkas: `backend/src/categories/categories.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/categories` | `create` | `JwtAuthGuard` | — |
| GET | `/categories` | `findAll` | `JwtAuthGuard` | — |
| GET | `/categories/:id` | `findOne` | `JwtAuthGuard` | — |
| PATCH | `/categories/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/categories/:id` | `remove` | `ManagerGuard` | — |

## ClickCountingController — `/click-counting`

Berkas: `backend/src/click-counting/click-counting.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/click-counting/upload-photo` | `` | `MenuGuard` | — |
| GET | `/click-counting/rates` | `getRates` | `JwtAuthGuard` | — |
| POST | `/click-counting/rates` | `createRate` | `ManagerGuard` | — |
| POST | `/click-counting/rates/seed` | `seedRates` | `ManagerGuard` | — |
| PUT | `/click-counting/rates/:id` | `updateRate` | `ManagerGuard` | — |
| DELETE | `/click-counting/rates/:id` | `deleteRate` | `ManagerGuard` | — |
| GET | `/click-counting/logs` | `getLogs` | `MenuGuard` | — |
| POST | `/click-counting/logs` | `createLog` | `MenuGuard` | — |
| DELETE | `/click-counting/logs/:id` | `deleteLog` | `ManagerGuard` | — |
| GET | `/click-counting/rejects` | `getRejects` | `MenuGuard` | — |
| POST | `/click-counting/rejects` | `createReject` | `MenuGuard` | — |
| DELETE | `/click-counting/rejects/:id` | `deleteReject` | `ManagerGuard` | — |
| GET | `/click-counting/meter` | `getMeterReadings` | `MenuGuard` | — |
| GET | `/click-counting/meter/by-date` | `getMeterByDate` | `MenuGuard` | — |
| POST | `/click-counting/meter` | `upsertMeterReading` | `MenuGuard` | — |
| DELETE | `/click-counting/meter/:id` | `deleteMeterReading` | `ManagerGuard` | — |
| GET | `/click-counting/vendor-bill` | `getVendorBill` | `MenuGuard` | — |
| GET | `/click-counting/reconciliation` | `getReconciliation` | `MenuGuard` | — |
| GET | `/click-counting/dashboard` | `getDashboard` | `MenuGuard` | — |

## CompanyBranchesController — `/company-branches`

Berkas: `backend/src/company-branches/company-branches.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/company-branches/public-active` | `publicActive` | — _terbuka_ | — |
| GET | `/company-branches` | `findAll` | `JwtAuthGuard` | — |
| GET | `/company-branches/active` | `findAllActive` | `JwtAuthGuard` | — |
| POST | `/company-branches` | `create` | `JwtAuthGuard, ManagerGuard` | — |
| PATCH | `/company-branches/:id` | `update` | `JwtAuthGuard, ManagerGuard` | — |
| DELETE | `/company-branches/:id` | `remove` | `JwtAuthGuard, OwnerGuard` | — |

## CompetitorsController — `/competitors`

Berkas: `backend/src/competitors/competitors.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/competitors` | `findAll` | `JwtAuthGuard` | — |
| POST | `/competitors` | `create` | `JwtAuthGuard` | — |
| PATCH | `/competitors/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/competitors/:id` | `remove` | `JwtAuthGuard` | — |

## CustomProductMetricsController — `/crm/custom-product-metrics`

Berkas: `backend/src/crm/custom-product-metrics/custom-product-metrics.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, RolesGuard` · peran: `...ADMIN_ROLES`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/custom-product-metrics` | `list` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/crm/custom-product-metrics` | `create` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/crm/custom-product-metrics/:id` | `update` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| DELETE | `/crm/custom-product-metrics/:id` | `remove` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |

## FollowUpsController — `/crm/follow-ups`

Berkas: `backend/src/crm/follow-ups/follow-ups.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/follow-ups` | `list` | `JwtAuthGuard` | — |
| GET | `/crm/follow-ups/badge-count` | `badgeCount` | `JwtAuthGuard` | — |
| GET | `/crm/follow-ups/:id` | `detail` | `JwtAuthGuard` | — |
| POST | `/crm/follow-ups` | `create` | `JwtAuthGuard` | — |
| PATCH | `/crm/follow-ups/:id/done` | `markDone` | `JwtAuthGuard` | — |
| PATCH | `/crm/follow-ups/:id/skip` | `skip` | `JwtAuthGuard` | — |
| DELETE | `/crm/follow-ups/:id` | `remove` | `JwtAuthGuard` | — |

## KpiController — `/crm/kpi`

Berkas: `backend/src/crm/kpi/kpi.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/kpi` | `report` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/product-trend` | `productTrend` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/designer-leaderboard` | `designerLeaderboard` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/operator-leaderboard` | `operatorLeaderboard` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/team-leaderboard` | `teamLeaderboard` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/design-output` | `designOutput` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/cs-trend` | `csTrend` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/designer-trend` | `designerTrend` | `JwtAuthGuard` | — |
| POST | `/crm/kpi/discord-recap` | `discordRecap` | `ManagerGuard` | — |
| GET | `/crm/kpi/source-breakdown` | `sourceBreakdown` | `JwtAuthGuard` | — |
| GET | `/crm/kpi/detail` | `detail` | `JwtAuthGuard` | — |

## LeadSourcesController — `/crm/lead-sources`

Berkas: `backend/src/crm/leads/lead-sources.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/lead-sources` | `list` | `JwtAuthGuard` | — |
| POST | `/crm/lead-sources` | `upsert` | `JwtAuthGuard` | — |

## LeadsController — `/crm/leads`

Berkas: `backend/src/crm/leads/leads.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/leads` | `list` | `JwtAuthGuard` | — |
| GET | `/crm/leads/status-summary` | `statusSummary` | `JwtAuthGuard` | — |
| GET | `/crm/leads/export` | `exportLeads` | `JwtAuthGuard` | — |
| GET | `/crm/leads/:id` | `detail` | `JwtAuthGuard` | — |
| POST | `/crm/leads` | `create` | `JwtAuthGuard` | — |
| PATCH | `/crm/leads/:id` | `update` | `JwtAuthGuard` | — |
| POST | `/crm/leads/:id/activities` | `addActivity` | `JwtAuthGuard` | — |
| POST | `/crm/leads/:id/convert` | `convert` | `JwtAuthGuard` | — |
| POST | `/crm/leads/:id/close-lost` | `closeLost` | `JwtAuthGuard` | — |
| POST | `/crm/leads/:id/mark-invalid` | `markInvalid` | `JwtAuthGuard` | — |
| POST | `/crm/leads/:id/link-so` | `linkToSalesOrder` | `JwtAuthGuard` | — |
| DELETE | `/crm/leads/:id` | `remove` | `ManagerGuard` | — |
| POST | `/crm/leads/upload-image` | `` | `JwtAuthGuard` | — |

## KpiPublicController — `/crm/public`

Berkas: `backend/src/crm/kpi/kpi-public.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/crm/public/verify-pin` | `verifyPin` | — _terbuka_ | — |
| POST | `/crm/public/dashboard` | `dashboard` | — _terbuka_ | — |
| POST | `/crm/public/leaderboard` | `leaderboard` | — _terbuka_ | — |
| POST | `/crm/public/spend` | `addSpend` | — _terbuka_ | — |
| POST | `/crm/public/spend/delete` | `deleteSpend` | — _terbuka_ | — |

## TemplatesController — `/crm/templates`

Berkas: `backend/src/crm/templates/templates.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/crm/templates` | `list` | `JwtAuthGuard` | — |
| GET | `/crm/templates/:id` | `detail` | `JwtAuthGuard` | — |
| POST | `/crm/templates` | `create` | `JwtAuthGuard` | — |
| PATCH | `/crm/templates/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/crm/templates/:id` | `remove` | `JwtAuthGuard` | — |
| GET | `/crm/templates/:id/render` | `render` | `JwtAuthGuard` | — |
| POST | `/crm/templates/seed-defaults` | `seed` | `JwtAuthGuard` | — |

## CsRatingController — `/cs-rating`

Berkas: `backend/src/cs-rating/cs-rating.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/cs-rating/invite` | `invite` | `JwtAuthGuard` | — |
| GET | `/cs-rating/summary` | `summary` | `JwtAuthGuard` | — |
| GET | `/cs-rating/config` | `config` | `JwtAuthGuard` | — |
| PATCH | `/cs-rating/config` | `upsertConfig` | `JwtAuthGuard` | — |

## CsRatingPublicController — `/cs-rating/public`

Berkas: `backend/src/cs-rating/cs-rating-public.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/cs-rating/public/branch/:branchId` | `branchPoll` | — _terbuka_ | — |
| GET | `/cs-rating/public/branch/:branchId/staff` | `branchStaff` | — _terbuka_ | — |
| POST | `/cs-rating/public/branch/:branchId/submit` | `branchSubmit` | — _terbuka_ | — |
| GET | `/cs-rating/public/:token` | `verify` | — _terbuka_ | — |
| POST | `/cs-rating/public/:token/submit` | `submit` | — _terbuka_ | — |

## CustomersController — `/customers`

Berkas: `backend/src/customers/customers.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/customers` | `create` | `JwtAuthGuard` | — |
| GET | `/customers` | `findAll` | `JwtAuthGuard` | — |
| GET | `/customers/with-stats` | `findAllWithStats` | `JwtAuthGuard` | — |
| GET | `/customers/summary` | `summary` | `JwtAuthGuard` | — |
| POST | `/customers/dedupe` | `dedupe` | `ManagerGuard` | — |
| GET | `/customers/lookup` | `lookup` | `JwtAuthGuard` | — |
| GET | `/customers/export-data` | `findAllForExport` | `JwtAuthGuard` | — |
| GET | `/customers/:id/analytics` | `getAnalytics` | `JwtAuthGuard` | — |
| GET | `/customers/:id/crm-timeline` | `getCrmTimeline` | `JwtAuthGuard` | — |
| PATCH | `/customers/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/customers/:id` | `remove` | `ManagerGuard` | — |

## CustomersPublicController — `/customers`

Berkas: `backend/src/customers/customers.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/customers/public/search` | `searchPublic` | — _terbuka_ | — |

## DesignersAdminController — `/designers`

Berkas: `backend/src/designers/designers.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/designers` | `findAll` | `JwtAuthGuard` | — |
| POST | `/designers` | `create` | `ManagerGuard` | — |
| PATCH | `/designers/:id` | `update` | `ManagerGuard` | — |
| DELETE | `/designers/:id` | `remove` | `ManagerGuard` | — |

## DesignersPublicController — `/designers`

Berkas: `backend/src/designers/designers.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/designers/public` | `listPublic` | — _terbuka_ | — |
| POST | `/designers/public/verify` | `verifyPin` | — _terbuka_ | — |

## DiscordController — `/discord`

Berkas: `backend/src/discord/discord.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, ManagerGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/discord/config` | `getConfig` | `JwtAuthGuard, ManagerGuard` | — |
| PATCH | `/discord/config` | `update` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/discord/test/:channel` | `test` | `JwtAuthGuard, ManagerGuard` | — |

## FixedExpensesController — `/fixed-expenses`

Berkas: `backend/src/fixed-expenses/fixed-expenses.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/fixed-expenses` | `findAll` | `JwtAuthGuard` | — |
| POST | `/fixed-expenses` | `create` | `JwtAuthGuard` | — |
| PATCH | `/fixed-expenses/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/fixed-expenses/:id` | `remove` | `JwtAuthGuard` | — |

## HppController — `/hpp`

Berkas: `backend/src/hpp/hpp.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, MenuGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/hpp` | `create` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/hpp/overview` | `getOverview` | `ManagerGuard` | — |
| GET | `/hpp` | `findAll` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/hpp/by-variant/:variantId` | `findByVariant` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/hpp/by-product/:productId` | `findByProduct` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/hpp/:id` | `findOne` | `JwtAuthGuard, MenuGuard` | — |
| PATCH | `/hpp/:id` | `update` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/hpp/:id/apply-to-variant` | `applyToVariant` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/hpp/:id/apply-variants-custom` | `applyVariantsCustom` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/hpp/:id/apply-variants-bom` | `applyVariantsBom` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/hpp/:id/apply-to-variants` | `applyToVariants` | `JwtAuthGuard, MenuGuard` | — |
| DELETE | `/hpp/:id` | `remove` | `JwtAuthGuard, MenuGuard` | — |

## HrSummaryController — `/hr`

Berkas: `backend/src/integrations/hr-summary.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/hr/summary` | `summary` | `RolesGuard` | `...HR_ROLES` |
| GET | `/hr/my-portal` | `myPortal` | `JwtAuthGuard` | — |

## HrPinController — `/hr/pin`

Berkas: `backend/src/integrations/hr-pin.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/hr/pin/my-portal` | `myPortal` | — _terbuka_ | — |

## StaffKpiController — `/integrations`

Berkas: `backend/src/integrations/staff-kpi.controller.ts`
Penjaga tingkat kelas: `ApiKeyGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/integrations/staff-list` | `staffList` | `ApiKeyGuard` | — |
| GET | `/integrations/staff-kpi` | `kpi` | `ApiKeyGuard` | — |
| GET | `/integrations/staff-daily` | `daily` | `ApiKeyGuard` | — |
| GET | `/integrations/staff-pin` | `hasPin` | `ApiKeyGuard` | — |
| POST | `/integrations/staff-pin/verify` | `verifyPin` | `ApiKeyGuard` | — |

## InvoiceController — `/invoices`

Berkas: `backend/src/invoice/invoice.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, MenuGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/invoices` | `create` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/invoices` | `findAll` | `JwtAuthGuard, MenuGuard` | — |
| GET | `/invoices/:id` | `findOne` | `JwtAuthGuard, MenuGuard` | — |
| PATCH | `/invoices/:id` | `update` | `JwtAuthGuard, MenuGuard` | — |
| PATCH | `/invoices/:id/status` | `updateStatus` | `JwtAuthGuard, MenuGuard` | — |
| PATCH | `/invoices/:id/type` | `updateType` | `ManagerGuard` | — |
| POST | `/invoices/:id/convert-to-invoice` | `convertToInvoice` | `JwtAuthGuard, MenuGuard` | — |
| DELETE | `/invoices/:id` | `remove` | `JwtAuthGuard, MenuGuard` | — |

## LandingController — `/landing`

Berkas: `backend/src/landing/landing.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/landing/public` | `getPublic` | — _terbuka_ | — |
| GET | `/landing` | `getAdmin` | `JwtAuthGuard` | — |
| PUT | `/landing` | `update` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/landing/publish` | `publish` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/landing/unpublish` | `unpublish` | `JwtAuthGuard, MenuGuard` | — |
| POST | `/landing/restore-previous` | `restorePrevious` | `JwtAuthGuard, MenuGuard` | — |

## MetaAdsController — `/meta-ads`

Berkas: `backend/src/meta-ads/meta-ads.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, RolesGuard` · peran: `...ADMIN_ROLES`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/meta-ads/accounts` | `accounts` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/meta-ads/overview` | `overview` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/meta-ads/account` | `setAccount` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/meta-ads/labels` | `labels` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/meta-ads/labels` | `upsertLabel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/meta-ads/labels/delete` | `deleteLabel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/meta-ads/campaign-label` | `assignCampaignLabel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/meta-ads/campaign-profit` | `setCampaignProfit` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/meta-ads/ads` | `adBreakdown` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |

## PublicOrdersController — `/orders/public`

Berkas: `backend/src/crm/leads/public-orders.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/orders/public` | `create` | `PublicOrderThrottleGuard` | — |

## PrintQueueController — `/print-queue`

Berkas: `backend/src/print-queue/print-queue.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/print-queue/jobs` | `list` | `BoardOrUserGuard` | — |
| GET | `/print-queue/stats` | `stats` | `BoardOrUserGuard` | — |
| POST | `/print-queue/pin/verify` | `verifyPin` | — _terbuka_ | — |
| POST | `/print-queue/jobs/:id/start` | `start` | `BoardOrUserGuard` | — |
| POST | `/print-queue/jobs/:id/finish` | `finish` | `BoardOrUserGuard` | — |
| POST | `/print-queue/jobs/:id/pickup` | `pickup` | `BoardOrUserGuard` | — |
| POST | `/print-queue/jobs/bulk-pickup` | `bulkPickup` | `BoardOrUserGuard` | — |
| POST | `/print-queue/jobs/:id/notes` | `notes` | `BoardOrUserGuard` | — |

## PrinterRelayController — `/printer-relay`

Berkas: `backend/src/printer-relay/printer-relay.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/printer-relay/poll` | `poll` | — _terbuka_ | — |
| POST | `/printer-relay/ack` | `ack` | — _terbuka_ | — |
| POST | `/printer-relay/jobs` | `submit` | `JwtAuthGuard` | — |
| GET | `/printer-relay/status` | `status` | `JwtAuthGuard` | — |
| GET | `/printer-relay/devices` | `list` | `JwtAuthGuard` | — |
| POST | `/printer-relay/devices` | `create` | `JwtAuthGuard` | — |
| PATCH | `/printer-relay/devices/:id` | `update` | `JwtAuthGuard` | — |
| POST | `/printer-relay/devices/:id/rotate-token` | `rotate` | `JwtAuthGuard` | — |
| DELETE | `/printer-relay/devices/:id` | `remove` | `JwtAuthGuard` | — |

## ProductionController — `/production`

Berkas: `backend/src/production/production.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/production/jobs` | `getJobs` | `BoardOrUserGuard` | — |
| GET | `/production/rolls` | `getRolls` | `BoardOrUserGuard` | — |
| GET | `/production/stats` | `getStats` | `BoardOrUserGuard` | — |
| GET | `/production/pipeline/jobs` | `getPipelineJobs` | `JwtAuthGuard` | — |
| PATCH | `/production/pipeline/jobs/:id` | `updatePipelineStage` | `JwtAuthGuard` | — |
| POST | `/production/pipeline/jobs/:id/proof-image` | `` | `JwtAuthGuard` | — |
| DELETE | `/production/pipeline/jobs/:id` | `deleteJob` | `JwtAuthGuard, ManagerGuard` | — |
| PATCH | `/production/pipeline/jobs/:id/cancel` | `cancelJob` | `JwtAuthGuard, ManagerGuard` | — |
| PATCH | `/production/pipeline/proofs/:proofId/delete` | `deleteProofImage` | `JwtAuthGuard` | — |
| GET | `/production/pipeline/public/jobs` | `getPublicPipelineJobs` | — _terbuka_ | — |
| PATCH | `/production/pipeline/public/jobs/:id` | `updatePublicPipelineStage` | — _terbuka_ | — |
| POST | `/production/pipeline/public/jobs/:id/proof-image` | `` | — _terbuka_ | — |
| PATCH | `/production/pipeline/public/proofs/:proofId/delete` | `deletePublicProofImage` | — _terbuka_ | — |
| GET | `/production/pipeline/jobs/:id/activities` | `getJobActivities` | `JwtAuthGuard` | — |
| POST | `/production/pin/verify` | `verifyPin` | — _terbuka_ | — |
| POST | `/production/jobs/:id/start` | `startJob` | `BoardOrUserGuard` | — |
| POST | `/production/jobs/:id/complete` | `completeJob` | `BoardOrUserGuard` | — |
| POST | `/production/jobs/:id/start-assembly` | `startAssembly` | `BoardOrUserGuard` | — |
| POST | `/production/jobs/:id/complete-assembly` | `completeAssembly` | `BoardOrUserGuard` | — |
| POST | `/production/jobs/:id/pickup` | `pickupJob` | `BoardOrUserGuard` | — |
| POST | `/production/jobs/bulk-pickup` | `bulkPickup` | `BoardOrUserGuard` | — |
| POST | `/production/batches` | `createBatch` | `BoardOrUserGuard` | — |
| POST | `/production/batches/:id/complete` | `completeBatch` | `BoardOrUserGuard` | — |
| POST | `/production/meter/upload-photo` | `` | `BoardOrUserGuard` | — |
| POST | `/production/meter/reading` | `upsertMeterReading` | `BoardOrUserGuard` | — |
| GET | `/production/meter/readings` | `getMeterReadings` | `BoardOrUserGuard` | — |
| POST | `/production/meter/reject` | `createReject` | `BoardOrUserGuard` | — |
| GET | `/production/meter/rejects` | `getRejects` | `BoardOrUserGuard` | — |

## ProductionCategoriesController — `/production-categories`

Berkas: `backend/src/production-categories/production-categories.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/production-categories` | `findAll` | `JwtAuthGuard` | — |
| POST | `/production-categories` | `create` | `ManagerGuard` | — |
| PATCH | `/production-categories/:id` | `update` | `ManagerGuard` | — |
| DELETE | `/production-categories/:id` | `remove` | `ManagerGuard` | — |

## ProductsController — `/products`

Berkas: `backend/src/products/products.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/products` | `create` | `JwtAuthGuard` | — |
| POST | `/products/bulk-import` | `bulkImport` | `JwtAuthGuard` | — |
| DELETE | `/products/bulk` | `bulkRemove` | `ManagerGuard` | — |
| GET | `/products` | `findAll` | `JwtAuthGuard` | — |
| GET | `/products/:id` | `findOne` | `JwtAuthGuard` | — |
| GET | `/products/:id/composite/options` | `getCompositeOptions` | `JwtAuthGuard` | — |
| POST | `/products/:id/composite/compute` | `computeComposite` | `JwtAuthGuard` | — |
| PATCH | `/products/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/products/:id` | `remove` | `ManagerGuard` | — |
| POST | `/products/:id/variants` | `addVariant` | `JwtAuthGuard` | — |
| PATCH | `/products/variants/:variantId` | `updateVariant` | `JwtAuthGuard` | — |
| DELETE | `/products/variants/:variantId` | `removeVariant` | `ManagerGuard` | — |
| POST | `/products/:id/upload-image` | `` | `JwtAuthGuard` | — |
| POST | `/products/:id/upload-images` | `` | `JwtAuthGuard` | — |
| POST | `/products/variants/:variantId/upload-image` | `` | `JwtAuthGuard` | — |
| POST | `/products/:id/ingredients` | `addIngredient` | `JwtAuthGuard` | — |
| PATCH | `/products/:id/ingredients/:ingId` | `updateIngredient` | `JwtAuthGuard` | — |
| DELETE | `/products/:id/ingredients/:ingId` | `removeIngredient` | `ManagerGuard` | — |
| GET | `/products/variants/:variantId/price-tiers` | `getPriceTiers` | `JwtAuthGuard` | — |
| PUT | `/products/variants/:variantId/price-tiers` | `replacePriceTiers` | `JwtAuthGuard` | — |
| DELETE | `/products/variants/:variantId/price-tiers/:tierId` | `removePriceTier` | `ManagerGuard` | — |
| GET | `/products/variants/:variantId/variant-ingredients` | `getVariantIngredients` | `JwtAuthGuard` | — |
| PUT | `/products/variants/:variantId/variant-ingredients` | `replaceVariantIngredients` | `JwtAuthGuard` | — |
| DELETE | `/products/variants/:variantId/variant-ingredients/:ingId` | `removeVariantIngredient` | `ManagerGuard` | — |
| GET | `/products/variants/:variantId/stock-history` | `getVariantStockHistory` | `JwtAuthGuard` | — |

## ProductsPublicController — `/products/public`

Berkas: `backend/src/products/products-public.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/products/public` | `findAllPublic` | — _terbuka_ | — |
| GET | `/products/public/best-sellers` | `bestSellers` | — _terbuka_ | — |
| GET | `/products/public/:id` | `findOnePublic` | — _terbuka_ | — |

## ReportsController — `/reports`

Berkas: `backend/src/reports/reports.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/reports/current-shift` | `getCurrentShift` | `JwtAuthGuard` | — |
| GET | `/reports/profit` | `getProfitReport` | `MenuGuard` | — |
| GET | `/reports/orders-by-hour` | `getOrdersByHour` | `ManagerGuard` | — |
| GET | `/reports/closing` | `getMonthlyClosing` | `ManagerGuard` | — |
| GET | `/reports/finance/candles` | `getFinanceCandles` | `ManagerGuard` | — |
| GET | `/reports/finance/heatmap` | `getFinanceHeatmap` | `ManagerGuard` | — |
| GET | `/reports/finance/journal` | `getFinanceJournal` | `ManagerGuard` | — |
| GET | `/reports/finance/anomalies` | `getFinanceAnomalies` | `ManagerGuard` | — |
| GET | `/reports/finance/expense-breakdown` | `getFinanceExpenseBreakdown` | `ManagerGuard` | — |
| GET | `/reports/finance/comparison` | `getFinanceComparison` | `ManagerGuard` | — |
| GET | `/reports/finance/reconciliation` | `getFinanceReconciliation` | `ManagerGuard` | — |
| GET | `/reports/finance/consolidation` | `getFinanceConsolidation` | `ManagerGuard` | — |
| GET | `/reports/finance/monthly-report` | `getFinanceMonthlyReport` | `ManagerGuard` | — |
| GET | `/reports/finance/daily-target-status` | `getDailyTargetStatus` | `JwtAuthGuard` | — |
| POST | `/reports/finance/close-branch` | `closeBranchBalance` | `OwnerGuard` | — |
| POST | `/reports/finance/fund-branch` | `fundBranchBalance` | `OwnerGuard` | — |
| GET | `/reports/finance/central-treasury` | `getCentralTreasury` | `ManagerGuard` | — |
| POST | `/reports/finance/central-expense` | `addCentralExpense` | `OwnerGuard` | — |
| GET | `/reports/staff-list` | `getStaffList` | `JwtAuthGuard` | — |
| POST | `/reports/close-shift` | `FilesInterceptor` | `JwtAuthGuard` | — |
| GET | `/reports/shift-history` | `getShiftHistory` | `MenuGuard` | — |
| POST | `/reports/shift/:id/resend` | `resendShiftReport` | `MenuGuard` | — |
| PATCH | `/reports/shift/:id/amend` | `amendShiftReport` | `ManagerGuard` | — |

## InterBranchUsageController — `/reports/inter-branch-usage`

Berkas: `backend/src/inter-branch-usage/inter-branch-usage.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/reports/inter-branch-usage` | `report` | `JwtAuthGuard` | — |

## SalesOrdersController — `/sales-orders`

Berkas: `backend/src/sales-orders/sales-orders.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/sales-orders` | `list` | `JwtAuthGuard` | — |
| GET | `/sales-orders/pending-invoice-count` | `pendingInvoiceCount` | `JwtAuthGuard` | — |
| GET | `/sales-orders/active-by-customer` | `activeByCustomer` | `JwtAuthGuard` | — |
| GET | `/sales-orders/:id` | `findOne` | `JwtAuthGuard` | — |
| POST | `/sales-orders` | `create` | `JwtAuthGuard` | — |
| PATCH | `/sales-orders/:id` | `update` | `JwtAuthGuard` | — |
| POST | `/sales-orders/:id/proofs` | `FilesInterceptor` | `JwtAuthGuard` | — |
| DELETE | `/sales-orders/:id/proofs/:proofId` | `removeProof` | `JwtAuthGuard` | — |
| POST | `/sales-orders/:id/send-wa` | `sendWa` | `JwtAuthGuard` | — |
| POST | `/sales-orders/:id/cancel` | `cancel` | `JwtAuthGuard` | — |

## SalesOrdersPublicController — `/sales-orders/designer`

Berkas: `backend/src/sales-orders/sales-orders-public.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/sales-orders/designer/my-list` | `mySOs` | — _terbuka_ | — |
| POST | `/sales-orders/designer/my-stats` | `myStats` | — _terbuka_ | — |
| POST | `/sales-orders/designer/detail/:id` | `detail` | — _terbuka_ | — |
| POST | `/sales-orders/designer/lead-by-phone` | `leadByPhone` | — _terbuka_ | — |
| POST | `/sales-orders/designer/cs-leads` | `csLeads` | — _terbuka_ | — |
| POST | `/sales-orders/designer` | `create` | — _terbuka_ | — |
| POST | `/sales-orders/designer/:id/create-lead` | `createLead` | — _terbuka_ | — |
| POST | `/sales-orders/designer/:id/update` | `update` | — _terbuka_ | — |
| POST | `/sales-orders/designer/:id/proofs` | `FilesInterceptor` | — _terbuka_ | — |
| DELETE | `/sales-orders/designer/:id/proofs/:proofId` | `removeProof` | — _terbuka_ | — |
| POST | `/sales-orders/designer/:id/send-wa` | `sendWa` | — _terbuka_ | — |
| POST | `/sales-orders/designer/:id/cancel` | `cancel` | — _terbuka_ | — |

## SettingsController — `/settings`

Berkas: `backend/src/settings/settings.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/settings/public` | `getPublicSettings` | — _terbuka_ | — |
| GET | `/settings` | `getSettings` | `JwtAuthGuard` | — |
| PATCH | `/settings` | `updateSettings` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/settings/upload-qris` | `` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/settings/upload-logo` | `` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/settings/upload-login-bg` | `` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/settings/upload-login-logo` | `` | `JwtAuthGuard, ManagerGuard` | — |

## MetaMessagingController — `/social`

Berkas: `backend/src/meta-messaging/meta-messaging.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/social/channels` | `listChannels` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/social/channels` | `createChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/social/channels/:id` | `updateChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| DELETE | `/social/channels/:id` | `removeChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/social/webhook-debug` | `webhookDebug` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/social/test-connection` | `testConnection` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/social/pages-from-token` | `pagesFromToken` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/social/detect-ig` | `detectIg` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/social/channels/:id/subscribe` | `subscribe` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/social/counts` | `counts` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| GET | `/social/conversations` | `listConversations` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| GET | `/social/conversations/:id/messages` | `getMessages` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/conversations/:id/reply` | `reply` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/contacts/:id/lead` | `contactLead` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| GET | `/social/comments` | `listComments` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/comments/sync` | `syncComments` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| GET | `/social/comments/sync-status` | `syncStatus` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| GET | `/social/comments/:id` | `getThread` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| PATCH | `/social/comments/:id` | `updateThread` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/comments/:id/reply` | `replyComment` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/comments/:id/hide` | `hideComment` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |
| POST | `/social/comments/:id/lead` | `commentLead` | `JwtAuthGuard, RolesGuard` | `...INBOX_ROLES` |

## DataDeletionController — `/social/data-deletion`

Berkas: `backend/src/meta-messaging/data-deletion.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/social/data-deletion` | `request` | — _terbuka_ | — |
| GET | `/social/data-deletion` | `status` | — _terbuka_ | — |

## SocialWebhookController — `/social/webhook`

Berkas: `backend/src/meta-messaging/social-webhook.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/social/webhook` | `verify` | — _terbuka_ | — |
| POST | `/social/webhook` | `receive` | — _terbuka_ | — |

## StockMovementsController — `/stock-movements`

Berkas: `backend/src/stock-movements/stock-movements.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/stock-movements` | `create` | `MenuGuard` | — |
| GET | `/stock-movements` | `findAll` | `JwtAuthGuard` | — |
| GET | `/stock-movements/waste` | `findWaste` | `JwtAuthGuard` | — |
| GET | `/stock-movements/:id` | `findOne` | `JwtAuthGuard` | — |

## StockOpnamePublicController — `/stock-opname/public`

Berkas: `backend/src/stock-opname/stock-opname.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/stock-opname/public/:token/verify` | `verify` | — _terbuka_ | — |
| GET | `/stock-opname/public/:token/products` | `products` | — _terbuka_ | — |
| POST | `/stock-opname/public/:token/submit` | `submit` | — _terbuka_ | — |

## StockOpnameAdminController — `/stock-opname/sessions`

Berkas: `backend/src/stock-opname/stock-opname.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/stock-opname/sessions` | `start` | `JwtAuthGuard` | — |
| GET | `/stock-opname/sessions` | `list` | `JwtAuthGuard` | — |
| GET | `/stock-opname/sessions/:id` | `detail` | `JwtAuthGuard` | — |
| PATCH | `/stock-opname/sessions/:id/cancel` | `cancel` | `JwtAuthGuard` | — |
| POST | `/stock-opname/sessions/:id/finish` | `finish` | `JwtAuthGuard` | — |

## StockPurchasesController — `/stock-purchases`

Berkas: `backend/src/stock-purchases/stock-purchases.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/stock-purchases` | `create` | `MenuGuard` | — |
| GET | `/stock-purchases` | `findAll` | `JwtAuthGuard` | — |

## StockTransferController — `/stock-transfers`

Berkas: `backend/src/stock-transfer/stock-transfer.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/stock-transfers` | `list` | `JwtAuthGuard` | — |
| GET | `/stock-transfers/:id` | `getOne` | `JwtAuthGuard` | — |
| POST | `/stock-transfers` | `create` | `MenuGuard` | — |

## StockTransfersController — `/stock-transfers`

Berkas: `backend/src/stock-transfers/stock-transfers.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/stock-transfers` | `create` | `JwtAuthGuard` | — |
| GET | `/stock-transfers` | `list` | `JwtAuthGuard` | — |

## StudioAiController — `/studio-ai`

Berkas: `backend/src/studio-ai/studio-ai.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, RolesGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/studio-ai/config` | `getConfig` | `JwtAuthGuard, RolesGuard` | `...OWNER_ROLES` |
| PUT | `/studio-ai/config` | `updateConfig` | `JwtAuthGuard, RolesGuard` | `...OWNER_ROLES` |
| POST | `/studio-ai/test` | `test` | `JwtAuthGuard, RolesGuard` | `...OWNER_ROLES` |
| GET | `/studio-ai/status` | `status` | `JwtAuthGuard, RolesGuard` | — |
| POST | `/studio-ai/ideas` | `ideas` | `JwtAuthGuard, RolesGuard` | — |
| POST | `/studio-ai/fill` | `fill` | `JwtAuthGuard, RolesGuard` | — |
| POST | `/studio-ai/chat` | `chat` | `JwtAuthGuard, RolesGuard` | — |
| POST | `/studio-ai/chat/stream` | `chatStream` | `JwtAuthGuard, RolesGuard` | — |

## SuppliersController — `/suppliers`

Berkas: `backend/src/suppliers/suppliers.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/suppliers` | `findAll` | `JwtAuthGuard` | — |
| GET | `/suppliers/:id` | `findOne` | `JwtAuthGuard` | — |
| POST | `/suppliers` | `create` | `JwtAuthGuard` | — |
| PATCH | `/suppliers/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/suppliers/:id` | `remove` | `ManagerGuard` | — |
| POST | `/suppliers/:id/items` | `addItem` | `JwtAuthGuard` | — |
| PATCH | `/suppliers/items/:itemId` | `updateItem` | `JwtAuthGuard` | — |
| DELETE | `/suppliers/items/:itemId` | `removeItem` | `ManagerGuard` | — |

## SyncController — `/sync`

Berkas: `backend/src/sync/sync.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/sync/pull` | `pull` | `SyncAuthGuard` | — |
| POST | `/sync/push` | `push` | `SyncAuthGuard` | — |
| POST | `/sync/register-device` | `registerDevice` | `JwtAuthGuard, OwnerGuard` | — |

## TaskBoardController — `/task-board`

Berkas: `backend/src/task-board/task-board.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/task-board/my-day` | `myDay` | `JwtAuthGuard` | — |
| POST | `/task-board/checkin` | `checkin` | `JwtAuthGuard` | — |
| GET | `/task-board/warnings/mine` | `myWarnings` | `JwtAuthGuard` | — |
| POST | `/task-board/warnings/ack` | `ackWarnings` | `JwtAuthGuard` | — |
| GET | `/task-board/reminders/mine` | `myReminders` | `JwtAuthGuard` | — |
| GET | `/task-board/today/mine` | `myToday` | `JwtAuthGuard` | — |
| GET | `/task-board/board` | `board` | `JwtAuthGuard` | — |
| GET | `/task-board/board/pdf` | `boardPdf` | `JwtAuthGuard` | — |
| GET | `/task-board/sign` | `sign` | `JwtAuthGuard` | — |
| PATCH | `/task-board/sign` | `setSign` | `JwtAuthGuard` | — |
| GET | `/task-board/trial` | `trial` | `JwtAuthGuard` | — |
| PATCH | `/task-board/trial` | `setTrial` | `JwtAuthGuard` | — |
| POST | `/task-board/warnings` | `createWarning` | `JwtAuthGuard` | — |
| GET | `/task-board/monitor` | `monitor` | `JwtAuthGuard` | — |
| GET | `/task-board/monitor/recap` | `recap` | `JwtAuthGuard` | — |
| GET | `/task-board/schedules` | `listSchedules` | `JwtAuthGuard` | — |
| POST | `/task-board/schedules` | `createSchedule` | `JwtAuthGuard` | — |
| PATCH | `/task-board/schedules/:id` | `updateSchedule` | `JwtAuthGuard` | — |
| DELETE | `/task-board/schedules/:id` | `deleteSchedule` | `JwtAuthGuard` | — |
| POST | `/task-board/schedules/generate-now` | `generateNow` | `JwtAuthGuard` | — |
| GET | `/task-board/items` | `listItems` | `JwtAuthGuard` | — |
| POST | `/task-board/upload-images` | `FilesInterceptor` | `JwtAuthGuard` | — |
| POST | `/task-board/items` | `createItem` | `JwtAuthGuard` | — |
| PATCH | `/task-board/items/:id` | `updateItem` | `JwtAuthGuard` | — |
| PATCH | `/task-board/items/:id/move` | `moveItem` | `JwtAuthGuard` | — |
| DELETE | `/task-board/items/:id` | `deleteItem` | `JwtAuthGuard` | — |
| GET | `/task-board/summary` | `summary` | `JwtAuthGuard` | — |
| GET | `/task-board/groups` | `listGroups` | `JwtAuthGuard` | — |
| POST | `/task-board/groups` | `createGroup` | `JwtAuthGuard` | — |
| PATCH | `/task-board/groups/:id` | `updateGroup` | `JwtAuthGuard` | — |
| DELETE | `/task-board/groups/:id` | `deleteGroup` | `JwtAuthGuard` | — |

## TaskBoardPinController — `/task-board/pin`

Berkas: `backend/src/task-board/task-board-pin.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/task-board/pin/state` | `state` | — _terbuka_ | — |
| POST | `/task-board/pin/board` | `board` | — _terbuka_ | — |
| POST | `/task-board/pin/board/pdf` | `boardPdf` | — _terbuka_ | — |
| POST | `/task-board/pin/checkin` | `checkin` | — _terbuka_ | — |
| POST | `/task-board/pin/warnings/ack` | `ack` | — _terbuka_ | — |
| POST | `/task-board/pin/items/:id/done` | `done` | — _terbuka_ | — |

## TransactionsController — `/transactions`

Berkas: `backend/src/transactions/transactions.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/transactions` | `create` | `JwtAuthGuard` | — |
| GET | `/transactions` | `findAll` | `JwtAuthGuard` | — |
| GET | `/transactions/dashboard/metrics` | `getDashboardMetrics` | `JwtAuthGuard` | — |
| GET | `/transactions/dashboard/cashier-stats` | `getCashierStats` | `JwtAuthGuard` | — |
| GET | `/transactions/dashboard/chart` | `getChartData` | `JwtAuthGuard` | — |
| GET | `/transactions/reports/summary` | `getSummaryReport` | `JwtAuthGuard` | — |
| GET | `/transactions/edit-requests` | `getEditRequests` | `JwtAuthGuard` | — |
| PATCH | `/transactions/edit-requests/:requestId/review` | `reviewEditRequest` | `JwtAuthGuard` | — |
| GET | `/transactions/:id` | `findOne` | `JwtAuthGuard` | — |
| POST | `/transactions/:id/add-dp` | `addPartialPayment` | `JwtAuthGuard` | — |
| POST | `/transactions/:id/pay-off` | `payOff` | `JwtAuthGuard` | — |
| PATCH | `/transactions/:id/payment-method` | `updatePaymentMethod` | `ManagerGuard` | — |
| PATCH | `/transactions/:id` | `editTransactionDirect` | `JwtAuthGuard` | — |
| POST | `/transactions/:id/edit-request` | `createEditRequest` | `JwtAuthGuard` | — |
| DELETE | `/transactions/:id` | `deleteTransaction` | `JwtAuthGuard` | — |

## UnitsController — `/units`

Berkas: `backend/src/units/units.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/units` | `create` | `JwtAuthGuard` | — |
| GET | `/units` | `findAll` | `JwtAuthGuard` | — |
| GET | `/units/:id` | `findOne` | `JwtAuthGuard` | — |
| PATCH | `/units/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/units/:id` | `remove` | `ManagerGuard` | — |

## UsersController — `/users`

Berkas: `backend/src/users/users.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/users` | `create` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/users` | `findAll` | `JwtAuthGuard` | — |
| GET | `/users/roles` | `getRoles` | `JwtAuthGuard` | — |
| PATCH | `/users/:id` | `updateUser` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/users/:id/status` | `setUserStatus` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| DELETE | `/users/:id` | `deleteUser` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/users/roles` | `createRole` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/users/roles/:id` | `updateRole` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| DELETE | `/users/roles/:id` | `deleteRole` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/users/roles/:id/menu-access` | `updateRoleMenuAccess` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |

## WebhookController — `/webhook`

Berkas: `backend/src/webhook/webhook.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/webhook/github` | `handleGithub` | — _terbuka_ | — |

## WhatsappCloudController — `/whatsapp`

Berkas: `backend/src/whatsapp-cloud/whatsapp-cloud.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/whatsapp/catalog` | `listCatalog` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/catalog-config` | `getCatalogConfig` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/catalog-config` | `setCatalogConfig` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/catalog` | `createCatalogProduct` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/catalog/upload-image` | `uploadCatalogImage` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/catalog/:productId` | `updateCatalogProduct` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| DELETE | `/whatsapp/catalog/:productId` | `deleteCatalogProduct` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/catalog/pos-links` | `catalogPosLinks` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/catalog/from-product` | `catalogFromProduct` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/quick-replies` | `listQuickReplies` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/quick-replies` | `createQuickReply` | `JwtAuthGuard, WaInboxGuard` | — |
| PATCH | `/whatsapp/quick-replies/:id` | `updateQuickReply` | `JwtAuthGuard, WaInboxGuard` | — |
| DELETE | `/whatsapp/quick-replies/:id` | `removeQuickReply` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/qr-links` | `listQrLinks` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/qr-links` | `createQrLink` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/qr-links/:id` | `updateQrLink` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| DELETE | `/whatsapp/qr-links/:id` | `removeQrLink` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/analytics` | `getAnalytics` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/analytics/cs-benchmark` | `getCsBenchmark` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/health` | `health` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/whatsapp/access-token` | `getAccessToken` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/whatsapp/access-token/debug` | `debugAccessToken` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/whatsapp/access-token` | `setAccessToken` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/whatsapp/channels` | `listChannels` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/whatsapp/channels` | `createChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/whatsapp/channels/:id` | `updateChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| DELETE | `/whatsapp/channels/:id` | `deleteChannel` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/whatsapp/channels/:id/profile` | `getChannelProfile` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/whatsapp/channels/:id/profile` | `updateChannelProfile` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/whatsapp/channels/:id/profile-picture` | `updateChannelProfilePicture` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| GET | `/whatsapp/templates` | `listTemplates` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/templates` | `createTemplate` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/templates/sync` | `syncTemplates` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/templates/:id` | `updateTemplate` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| DELETE | `/whatsapp/templates/:id` | `deleteTemplate` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/templates/:id/submit` | `submitTemplate` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/reminders/config` | `reminderConfigs` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/reminders/config/:eventType` | `setReminderConfig` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/reminders/order-ready/:transactionId` | `triggerOrderReady` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/auto-replies` | `listAutoReplies` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/auto-replies` | `createAutoReply` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| PATCH | `/whatsapp/auto-replies/:id` | `updateAutoReply` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| DELETE | `/whatsapp/auto-replies/:id` | `deleteAutoReply` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/broadcasts` | `listBroadcasts` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/broadcast-contacts` | `broadcastContacts` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts/preview` | `previewBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts` | `createBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/broadcasts/:id` | `broadcastReport` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/broadcasts/:id/recipients` | `broadcastRecipients` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts/:id/run` | `runBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts/:id/pause` | `pauseBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts/:id/resume` | `resumeBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| POST | `/whatsapp/broadcasts/:id/cancel` | `cancelBroadcast` | `JwtAuthGuard, RolesGuard` | `...TEMPLATE_ROLES` |
| GET | `/whatsapp/conversations` | `listConversations` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/conversations/:id/sales-orders` | `conversationSalesOrders` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/conversations/:id/notas` | `conversationNotas` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/sales-orders/:id/conversation` | `salesOrderConversation` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/agents` | `listAgents` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/conversations/:id` | `getConversation` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/leads/:leadId/conversation` | `resolveConversationByLead` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/conversations/:id/messages` | `getMessages` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/messages/:id/media` | `getMessageMedia` | `JwtAuthGuard, WaInboxGuard` | — |
| GET | `/whatsapp/media/storage/stats` | `mediaStats` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| POST | `/whatsapp/media/storage/cleanup` | `mediaCleanup` | `JwtAuthGuard, RolesGuard` | `...ADMIN_ROLES` |
| PATCH | `/whatsapp/conversations/:id` | `updateConversation` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/conversations/start` | `startConversation` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/conversations/:id/reply` | `reply` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/conversations/:id/reply-template` | `replyTemplate` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/conversations/:id/reply-media` | `replyMedia` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/conversations/:id/send-product` | `sendProduct` | `JwtAuthGuard, WaInboxGuard` | — |
| PATCH | `/whatsapp/contacts/:id/name` | `setContactName` | `JwtAuthGuard, WaInboxGuard` | — |
| POST | `/whatsapp/messages/:id/react` | `react` | `JwtAuthGuard, WaInboxGuard` | — |
| DELETE | `/whatsapp/messages/:id` | `deleteMessage` | `JwtAuthGuard, WaInboxGuard` | — |

## WhatsappController — `/whatsapp`

Berkas: `backend/src/whatsapp/whatsapp.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard, ManagerGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/whatsapp/status` | `getStatus` | `JwtAuthGuard, ManagerGuard` | — |
| GET | `/whatsapp/config` | `getConfig` | `JwtAuthGuard, ManagerGuard` | — |
| GET | `/whatsapp/groups` | `getGroups` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/logout` | `logout` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/send` | `sendToGroup` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/broadcast` | `broadcast` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/announce` | `announce` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/config/broadcast-groups` | `updateBroadcastGroups` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/config/announcement` | `setAnnouncement` | `JwtAuthGuard, ManagerGuard` | — |
| POST | `/whatsapp/config/design-group` | `setDesignGroup` | `JwtAuthGuard, ManagerGuard` | — |

## WhatsappWebhookController — `/whatsapp/webhook`

Berkas: `backend/src/whatsapp-cloud/webhook.controller.ts`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| GET | `/whatsapp/webhook` | `verify` | — _terbuka_ | — |
| POST | `/whatsapp/webhook` | `receive` | — _terbuka_ | — |

## WorkOrdersController — `/work-orders`

Berkas: `backend/src/crm/work-orders/work-orders.controller.ts`
Penjaga tingkat kelas: `JwtAuthGuard`

| Metode | Jalur | Handler | Penjaga | Peran |
|---|---|---|---|---|
| POST | `/work-orders/upload` | `` | `JwtAuthGuard` | — |
| GET | `/work-orders/job/:jobId` | `getByJob` | `JwtAuthGuard` | — |
| GET | `/work-orders/options` | `getOptions` | `JwtAuthGuard` | — |
| GET | `/work-orders/:id` | `getOne` | `JwtAuthGuard` | — |
| POST | `/work-orders` | `create` | `JwtAuthGuard` | — |
| PATCH | `/work-orders/:id` | `update` | `JwtAuthGuard` | — |
| DELETE | `/work-orders/:id` | `remove` | `JwtAuthGuard` | — |

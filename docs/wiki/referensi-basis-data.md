# 🗄️ Referensi Basis Data

> Dibangkitkan otomatis oleh `tools/gen-wiki-referensi.js` — jangan disunting tangan.
> Jalankan ulang skripnya setelah menambah fitur.


**108 tabel**, **1538 kolom**, dan **38 himpunan nilai (enum)**.
Nama di kolom pertama adalah nama tabel di MySQL; nama model Prisma ditulis di judulnya.
Keterangan diambil dari komentar di `backend/prisma/schema.prisma`, jadi kalau ada
kolom yang belum jelas maknanya, tambahkan komentarnya di sana — bukan di sini.

## Daftar tabel

| Tabel | Model | Kolom | Untuk apa |
|---|---|---:|---|
| `ad_labels` | AdLabel | 9 | Label custom iklan Meta (mis. "Voliko Paris", "Divisi Spanduk"). Satu akun iklan dipakai lintas cabang/perusah |
| `articles` | Article | 13 | Artikel / blog untuk landing. content = HTML dari editor rich text (Tiptap). |
| `bank_accounts` | BankAccount | 12 | — |
| `batches` | Batch | 10 | — |
| `bonus_adjustments` | BonusAdjustment | 10 | Penyesuaian bonus manual per karyawan per bulan (data yg tak ada di sistem): qualityEligible = Bonus Kualitas  |
| `bonus_targets` | BonusTarget | 14 | Target & nominal bonus per cabang × posisi (CS/Designer/Operator). Diatur owner di Dashboard Owner. metric = u |
| `branch_monthly_closings` | BranchMonthlyClosing | 12 | Tutup buku bulanan per cabang: catatan pengosongan saldo (setor ke pusat) + pemberian modal. Idempoten via @@u |
| `branch_settings` | BranchSettings | 16 | Konfigurasi per-cabang (1-1 dengan CompanyBranch). Di-split dari StoreSettings supaya tiap cabang punya WA gro |
| `branch_stocks` | BranchStock | 7 | Stok per cabang. Sumber kebenaran stok di multi-cabang. `ProductVariant.stock` tetap dipertahankan sebagai cac |
| `branch_work_order_items` | BranchWorkOrderItem | 12 | — |
| `branch_work_orders` | BranchWorkOrder | 14 | — |
| `branches` | Branch | 8 | — |
| `cashflow_change_requests` | CashflowChangeRequest | 15 | — |
| `cashflows` | Cashflow | 21 | — |
| `categories` | Category | 12 | — |
| `central_treasury_entries` | CentralTreasuryEntry | 9 | Kas Pusat — dompet owner terpisah dari semua cabang. IN: setoran tutup buku tiap cabang. OUT: modal ke cabang  |
| `click_logs` | ClickLog | 12 | Log klik per transaksi (dari POS atau manual) |
| `click_rates` | ClickRate | 12 | Konfigurasi harga klik per jenis cetak |
| `company_branches` | CompanyBranch | 46 | — |
| `competitors` | Competitor | 9 | — |
| `cs_rating_configs` | CsRatingConfig | 8 | ─── Penilaian CS (poling Ya/Tidak + bintang) ──────────────────────────────── Konfigurasi pertanyaan poling. b |
| `cs_rating_responses` | CsRatingResponse | 20 | 1 baris = 1 undangan penilaian. submittedAt null = belum dijawab (link masih aktif). |
| `custom_product_metrics` | CustomProductMetric | 13 | Metrik produk custom untuk leaderboard — owner mendefinisikan 1+ "produk khusus" yang dihitung sebagai kolom t |
| `customers` | Customer | 20 | — |
| `designers` | Designer | 8 | — |
| `devices` | Device | 7 | Perangkat (device) offline yang tersinkron ke pusat. Tiap instal aplikasi desktop = 1 Device dengan token raha |
| `discord_config` | DiscordConfig | 6 | Konfigurasi notifikasi Discord (singleton, id=1). webhooks: map channel→URL { sales, production, finance, inve |
| `fixed_expenses` | FixedExpense | 10 | Beban tetap bulanan yang diatur owner (gaji, sewa ruko, angsuran mesin, supplier, dll). Dipakai di Dashboard O |
| `follow_ups` | FollowUp | 22 | — |
| `hpp_fixed_costs` | HppFixedCost | 5 | — |
| `hpp_variable_costs` | HppVariableCost | 9 | — |
| `hpp_worksheets` | HppWorksheet | 13 | — |
| `ingredients` | Ingredient | 10 | — |
| `inter_branch_ledger` | InterBranchLedger | 16 | =========================== INTER-BRANCH LEDGER (Buku Titipan Antar Cabang) Saat transaksi titip cetak diserah |
| `invoice_items` | InvoiceItem | 7 | — |
| `invoices` | Invoice | 26 | — |
| `jersey_work_orders` | JerseyWorkOrder | 30 | Work Order Jersey — surat perintah kerja produksi jersey custom. Diterbitkan setelah desain ACC (job pindah DE |
| `landing_config` | LandingConfig | 9 | Landing page builder (singleton, id=1). data/draftData = struktur Puck (JSON). data = versi terpublikasi (dire |
| `lead_activities` | LeadActivity | 11 | — |
| `lead_images` | LeadImage | 7 | — |
| `lead_items` | LeadItem | 14 | — |
| `lead_source_options` | LeadSourceOption | 6 | Master data sumber lead "CUSTOM" (mis. "Shopee", "Brosur Pameran"). Dipakai bersama semua CS/cabang untuk menc |
| `leads` | Lead | 46 | — |
| `ledger_settlements` | LedgerSettlement | 12 | — |
| `machine_rejects` | MachineReject | 13 | Log reject mesin (error, test print, kalibrasi) |
| `marketing_spend` | MarketingSpend | 7 | Pengeluaran iklan marketing (diinput tim marketing di /marketing) — untuk benchmark ROAS/CPL/CAC per sumber. G |
| `message_templates` | MessageTemplate | 8 | — |
| `meta_ad_maps` | MetaAdMap | 6 | Cache peta iklan→campaign Meta (referral.source_id = adId). Dipakai webhook untuk resolve label lead tanpa pan |
| `meta_campaign_labels` | MetaCampaignLabel | 8 | Config per-campaign Meta (1 baris/campaign): label opsional + profit produk. productProfit dipakai patokan CPR |
| `meter_readings` | MeterReading | 12 | Pembacaan counter mesin harian — tiap hari ada 1 record |
| `print_jobs` | PrintJob | 19 | — |
| `printer_devices` | PrinterDevice | 12 | Perangkat printer relay per cabang (print server). Agen di komputer utama konek WebSocket KELUAR ke backend pa |
| `product_variants` | ProductVariant | 38 | — |
| `production_batches` | ProductionBatch | 11 | — |
| `production_categories` | ProductionCategory | 9 | Jenis produksi yang bisa DITAMBAH/EDIT/HAPUS user (Banner, Stiker, Laser Cut, dst). Dipakai untuk breakdown pr |
| `production_job_activities` | ProductionJobActivity | 11 | Audit log per production job — track siapa pindah card kapan dari/ke stage apa, upload/hapus proof, set info j |
| `production_job_proofs` | ProductionJobProof | 7 | Multi proof images per production job (di-upload di stage DESIGN sebagai bukti ACC). proofImageUrl di Producti |
| `production_jobs` | ProductionJob | 46 | — |
| `products` | Product | 26 | — |
| `roles` | Role | 4 | — |
| `sales_order_items` | SalesOrderItem | 13 | — |
| `sales_order_proofs` | SalesOrderProof | 6 | — |
| `sales_orders` | SalesOrder | 27 | — |
| `shift_reports` | ShiftReport | 35 | — |
| `social_channels` | SocialChannel | 14 | Channel sosial = 1 Page/akun IG. Untuk INSTAGRAM: igId = IG business id (rute webhook), pageId+accessToken Pag |
| `social_contacts` | SocialContact | 14 | Kontak sosial (PSID Messenger / IGSID Instagram) + tautan CRM. |
| `social_conversations` | SocialConversation | 13 | — |
| `social_messages` | SocialMessage | 15 | — |
| `stock_movements` | StockMovement | 12 | — |
| `stock_opname_items` | StockOpnameItem | 12 | — |
| `stock_opname_sessions` | StockOpnameSession | 13 | — |
| `stock_purchase_items` | StockPurchaseItem | 7 | — |
| `stock_purchases` | StockPurchase | 9 | — |
| `stock_transfer_items` | StockTransferItem | 7 | — |
| `stock_transfers` | StockTransfer | 11 | Transfer stok antar cabang (1 baris = 1 transfer header). Setiap transfer otomatis bikin 2 StockMovement (OUT  |
| `store_settings` | StoreSettings | 39 | — |
| `supplier_items` | SupplierItem | 9 | — |
| `suppliers` | Supplier | 11 | — |
| `sync_push` | SyncPush | 7 | Antrean push: mutasi transaksional yang dibuat di device lokal, menunggu didorong ke pusat. Diisi oleh interce |
| `sync_state` | SyncState | 3 | Dipakai HANYA di DB lokal (mode 100% offline). Di server pusat tetap ada tapi kosong. Cursor & state sinkronis |
| `synced_ops` | SyncedOp | 6 | Jejak idempotensi delta-sync offline. Tiap mutasi yang dibuat device saat offline punya clientId (UUID v4) uni |
| `task_group_members` | TaskGroupMember | 5 | — |
| `task_groups` | TaskGroup | 9 | — |
| `task_items` | TaskItem | 23 | — |
| `task_schedules` | TaskSchedule | 27 | ===== PAPAN TUGAS KARYAWAN (Kanban + jadwal berulang) ===== |
| `task_shift_checkins` | TaskShiftCheckin | 7 | Pilihan shift harian karyawan untuk piket. 1 baris per user per tanggal. |
| `task_warnings` | TaskWarning | 11 | Teguran tugas ke karyawan. Pop-up hanya tampil ke user penerima. |
| `transaction_edit_requests` | TransactionEditRequest | 13 | — |
| `transaction_items` | TransactionItem | 23 | — |
| `transactions` | Transaction | 49 | — |
| `units` | Unit | 5 | — |
| `users` | User | 36 | — |
| `variant_ingredients` | VariantIngredient | 13 | — |
| `variant_price_tiers` | VariantPriceTier | 9 | — |
| `wa_auto_reply_rules` | WaAutoReplyRule | 9 | Aturan balasan otomatis rule-based (bukan AI). Dievaluasi saat pesan masuk; selalu dalam jendela 24 jam (pesan |
| `wa_broadcast_recipients` | WaBroadcastRecipient | 12 | — |
| `wa_broadcasts` | WaBroadcast | 20 | Kampanye broadcast: kirim satu template ke segmen kontak (opt-out dihormati). |
| `wa_channels` | WaChannel | 14 | Satu nomor WhatsApp Business terdaftar (per cabang). phone_number_id & waba_id dari Meta; token/app_secret TID |
| `wa_config` | WaConfig | 4 | Konfigurasi WA Cloud global (singleton id=1). Token override env (diinput via Settings). |
| `wa_contacts` | WaContact | 17 | Identitas kontak WA <-> tautan CRM. waId = 62xxx (toWaPhone), phoneNormalized = 81xxx (samakan Lead.phoneNorma |
| `wa_conversations` | WaConversation | 15 | Thread percakapan inbox (per channel + contact). windowExpiresAt = lastInbound+24j. |
| `wa_messages` | WaMessage | 29 | Pesan masuk/keluar. waMessageId (id Meta) unik = idempotensi anti-duplikat webhook. |
| `wa_qr_links` | WaQrLink | 11 | QR "klik-untuk-chat" WhatsApp kustom per sumber (Walk-in, Brosur, dll). Kode ditanam sebagai #kode di pesan pr |
| `wa_quick_replies` | WaQuickReply | 9 | Pesan cepat / canned message (BUKAN template Meta). Dipanggil di composer inbox dengan mengetik "/pintasan". B |
| `wa_reminder_configs` | WaReminderConfig | 7 | Konfigurasi reminder otomatis per jenis event POS (Fase 8). Satu baris per eventType: ORDER_READY \| PAYMENT_D |
| `wa_reminder_logs` | WaReminderLog | 8 | Log + dedup reminder terkirim (1 reminder per event per referensi). |
| `wa_templates` | WaTemplate | 18 | Template pesan resmi Meta (Fase 5). Dipakai untuk balasan di LUAR jendela 24 jam & broadcast. CATATAN: templat |
| `wa_webhook_events` | WaWebhookEvent | 7 | Log mentah webhook Meta (audit + retry aman). Bukan idempotensi (bisa banyak status per pesan) — dedup pembuat |

---

## Rincian kolom

### AdLabel — `ad_labels`

> Label custom iklan Meta (mis. "Voliko Paris", "Divisi Spanduk"). Satu akun iklan
> dipakai lintas cabang/perusahaan → label per campaign untuk pisah biaya & lead.
> branchId opsional: bila diisi, lead dari iklan berlabel ini otomatis masuk cabang
> tsb (atribusi cabang otomatis). Dedup case-insensitive via normalizedName.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `normalizedName` | `String` | `normalized_name` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `campaigns` | `MetaCampaignLabel[]` | _sama_ | — |
| `leads` | `Lead[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### Article — `articles`

> Artikel / blog untuk landing. content = HTML dari editor rich text (Tiptap).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `title` | `String` | _sama_ | — |
| `slug` | `String` | _sama_ | — |
| `excerpt` | `String?` | _sama_ | — |
| `content` | `String?` | _sama_ | — |
| `coverImage` | `String?` | `cover_image` | — |
| `status` | `String` | _sama_ | DRAFT \| PUBLISHED |
| `publishedAt` | `DateTime?` | `published_at` | — |
| `authorName` | `String?` | `author_name` | — |
| `seoTitle` | `String?` | `seo_title` | — |
| `seoDescription` | `String?` | `seo_description` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@index([status, publishedAt])`

### BankAccount — `bank_accounts`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `bankName` | `String` | `bank_name` | — |
| `accountNumber` | `String` | `account_number` | — |
| `accountOwner` | `String` | `account_owner` | — |
| `currentBalance` | `Decimal` | `current_balance` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `transactions` | `Transaction[]` | _sama_ | — |
| `cashflows` | `Cashflow[]` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### Batch — `batches`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `batchNumber` | `String` | `batch_number` | — |
| `expirationDate` | `DateTime?` | `expiration_date` | — |
| `stock` | `Int` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `productVariant` | `ProductVariant` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### BonusAdjustment — `bonus_adjustments`

> Penyesuaian bonus manual per karyawan per bulan (data yg tak ada di sistem):
> qualityEligible = Bonus Kualitas layak (tak ada komplain valid);
> forfeited = bonus gugur (pelanggaran kebijakan piutang tanpa approval owner).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `role` | `String` | _sama_ | — |
| `employeeName` | `String` | `employee_name` | — |
| `periodMonth` | `String` | `period_month` | YYYY-MM |
| `qualityEligible` | `Boolean` | `quality_eligible` | — |
| `forfeited` | `Boolean` | _sama_ | — |
| `note` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@unique([branchId, role, employeeName, periodMonth])`

### BonusTarget — `bonus_targets`

> Target & nominal bonus per cabang × posisi (CS/Designer/Operator). Diatur owner
> di Dashboard Owner. metric = ukuran pencapaian (OMZET/DESIGN_ACC/NOTA). Bonus
> dievaluasi BULANAN (target harian hanya untuk progress harian di UI).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `role` | `String` | _sama_ | CS \| DESIGNER \| OPERATOR |
| `metric` | `String` | _sama_ | OMZET \| DESIGN_ACC \| NOTA |
| `gajiPokok` | `Decimal` | `gaji_pokok` | — |
| `bonusKualitas` | `Decimal` | `bonus_kualitas` | — |
| `bonusTim` | `Decimal` | `bonus_tim` | — |
| `bonusPribadi` | `Decimal` | `bonus_pribadi` | — |
| `targetTim` | `Decimal` | `target_tim` | target bulanan tim |
| `targetPribadi` | `Decimal` | `target_pribadi` | target bulanan pribadi |
| `periodTim` | `String` | `period_tim` | label: HARIAN \| BULANAN |
| `periodPribadi` | `String` | `period_pribadi` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@unique([branchId, role])`

### BranchMonthlyClosing — `branch_monthly_closings`

> Tutup buku bulanan per cabang: catatan pengosongan saldo (setor ke pusat) + pemberian modal.
> Idempoten via @@unique([year, month, branchId]) — cegah dobel-tutup / dobel-modal.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `year` | `Int` | _sama_ | — |
| `month` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `status` | `String` | _sama_ | CLOSED \| FUNDED |
| `collectedBank` | `Decimal` | `collected_bank` | — |
| `collectedCash` | `Decimal` | `collected_cash` | — |
| `modalTotal` | `Decimal` | `modal_total` | — |
| `snapshot` | `Json?` | _sama_ | — |
| `closedBy` | `String?` | `closed_by` | — |
| `closedAt` | `DateTime` | `closed_at` | — |
| `fundedAt` | `DateTime?` | `funded_at` | — |

Indeks & kunci: `@@unique([year, month, branchId])` · `@@index([branchId])`

### BranchSettings — `branch_settings`

> Konfigurasi per-cabang (1-1 dengan CompanyBranch).
> Di-split dari StoreSettings supaya tiap cabang punya WA group, PIN operator, identitas nota sendiri.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `operatorPin` | `String?` | `operator_pin` | — |
| `waReportGroupId` | `String?` | `wa_report_group_id` | — |
| `waBroadcastGroups` | `Json?` | `wa_broadcast_groups` | Array of group IDs |
| `waDesignGroupId` | `String?` | `wa_design_group_id` | — |
| `storeName` | `String?` | `store_name` | — |
| `storeAddress` | `String?` | `store_address` | — |
| `storePhone` | `String?` | `store_phone` | — |
| `notaHeader` | `String?` | `nota_header` | — |
| `notaFooter` | `String?` | `nota_footer` | — |
| `logoUrl` | `String?` | `logo_url` | — |
| `titipanFeePercent` | `Decimal?` | `titipan_fee_percent` | Persentase fee layanan cetak titipan masuk. Default 0 — sesuai konsep bisnis 1 owner / 1 perusahaan: cabang ganti real cost saja (bahan + klik), tanpa margin antar cabang. Naikkan kalau setup berubah jadi multi-owner/franchise. Dipakai waktu auto-create InterBranchLedger: serviceFee = costAmount * (titipanFeePercent/100). |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch` | _sama_ | — |

### BranchStock — `branch_stocks`

> Stok per cabang. Sumber kebenaran stok di multi-cabang.
> `ProductVariant.stock` tetap dipertahankan sebagai cache agregat (sum semua cabang)
> supaya kode lama (laporan HPP, dll.) tidak pecah.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `stock` | `Int` | _sama_ | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

Indeks & kunci: `@@unique([branchId, productVariantId])` · `@@index([branchId])` · `@@index([productVariantId])`

### BranchWorkOrderItem — `branch_work_order_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `workOrderId` | `Int` | `work_order_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `quantity` | `Int` | _sama_ | — |
| `widthCm` | `Float?` | `width_cm` | — |
| `heightCm` | `Float?` | `height_cm` | — |
| `unitType` | `String?` | `unit_type` | — |
| `pcs` | `Int?` | _sama_ | — |
| `note` | `String?` | _sama_ | — |
| `isDone` | `Boolean` | `is_done` | item ini sudah selesai dikerjakan |
| `workOrder` | `BranchWorkOrder` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

Indeks & kunci: `@@index([workOrderId])`

### BranchWorkOrder — `branch_work_orders`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `woNumber` | `String` | `wo_number` | WO-YYYYMMDD-XXXX |
| `branchId` | `Int` | `branch_id` | — |
| `referenceNumber` | `String?` | `reference_number` | nomor nota cabang |
| `notes` | `String?` | _sama_ | — |
| `proofFilename` | `String?` | `proof_filename` | foto nota cabang |
| `status` | `BranchWorkOrderStatus` | _sama_ | — |
| `receivedBy` | `String?` | `received_by` | kasir pusat yang input |
| `cancelReason` | `String?` | `cancel_reason` | — |
| `completedAt` | `DateTime?` | `completed_at` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch` | _sama_ | — |
| `items` | `BranchWorkOrderItem[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])` · `@@index([status])` · `@@index([createdAt])`

### Branch — `branches`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `address` | `String?` | _sama_ | — |
| `latitude` | `Decimal?` | _sama_ | — |
| `longitude` | `Decimal?` | _sama_ | — |
| `omset` | `Decimal?` | _sama_ | Omset bulanan (Rp) |
| `margin` | `Decimal?` | _sama_ | Margin (%) |
| `createdAt` | `DateTime?` | `created_at` | — |

### CashflowChangeRequest — `cashflow_change_requests`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `cashflowId` | `Int` | `cashflow_id` | — |
| `requesterId` | `Int` | `requester_id` | — |
| `type` | `ChangeRequestType` | _sama_ | — |
| `status` | `ChangeRequestStatus` | _sama_ | — |
| `payload` | `Json?` | _sama_ | — |
| `requesterNote` | `String?` | `requester_note` | — |
| `reviewerNote` | `String?` | `reviewer_note` | — |
| `reviewedBy` | `Int?` | `reviewed_by` | — |
| `reviewedAt` | `DateTime?` | `reviewed_at` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `cashflow` | `Cashflow` | _sama_ | — |
| `requester` | `User` | _sama_ | — |
| `reviewer` | `User?` | _sama_ | — |

### Cashflow — `cashflows`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `type` | `CashflowType` | _sama_ | — |
| `category` | `String` | _sama_ | — |
| `amount` | `Decimal` | _sama_ | — |
| `note` | `String?` | _sama_ | — |
| `userId` | `Int?` | `user_id` | — |
| `bankAccountId` | `Int?` | `bank_account_id` | — |
| `paymentMethod` | `PaymentMethod?` | `payment_method` | — |
| `platformSource` | `String?` | `platform_source` | — |
| `branchName` | `String?` | `branch_name` | Tag display (mirror dari Transaction.branchName untuk konteks WA). BUKAN sumber scoping — pakai branchId. |
| `branchId` | `Int?` | `branch_id` | FK cabang — authoritative untuk scoping |
| `date` | `DateTime` | _sama_ | — |
| `shiftReportId` | `Int?` | `shift_report_id` | tag pengeluaran ke shift tertentu |
| `excludeFromShift` | `Boolean` | `exclude_from_shift` | true = tidak masuk laporan shift manapun (retroaktif/lupa) |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `user` | `User?` | _sama_ | — |
| `bankAccount` | `BankAccount?` | _sama_ | — |
| `shiftReport` | `ShiftReport?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `changeRequests` | `CashflowChangeRequest[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### Category — `categories`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `parentId` | `Int?` | `parent_id` | — |
| `countsAsPcs` | `Boolean` | `counts_as_pcs` | false = item kategori ini TIDAK dihitung di metrik pcs (add-on/komponen seperti kerah/lengan yang menempel ke produk utama, bukan barang terpisah) |
| `productionCategoryId` | `Int?` | `production_category_id` | Klasifikasi produksi utk leaderboard operator (Banner/Stiker/Laser Cut, dst). FK ke ProductionCategory yang bisa di-CRUD user. null = bukan kategori produksi. |
| `products` | `Product[]` | _sama_ | — |
| `opnameSessions` | `StockOpnameSession[]` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `parent` | `Category?` | _sama_ | — |
| `children` | `Category[]` | _sama_ | — |
| `productionCategory` | `ProductionCategory?` | _sama_ | — |

Indeks & kunci: `@@index([updatedAt]) // delta-sync: pull "where updatedAt > since"`

### CentralTreasuryEntry — `central_treasury_entries`

> Kas Pusat — dompet owner terpisah dari semua cabang.
> IN: setoran tutup buku tiap cabang. OUT: modal ke cabang + beli bahan + lainnya.
> Saldo pusat = SUM(IN) - SUM(OUT).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `direction` | `String` | _sama_ | IN \| OUT |
| `category` | `String` | _sama_ | SETORAN_CABANG \| MODAL_CABANG \| BELI_BAHAN \| LAINNYA |
| `amount` | `Decimal` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | cabang terkait (setoran/modal) |
| `note` | `String?` | _sama_ | — |
| `date` | `DateTime` | _sama_ | — |
| `createdBy` | `String?` | `created_by` | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([direction])` · `@@index([date])`

### ClickLog — `click_logs`

> Log klik per transaksi (dari POS atau manual)

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `clickRateId` | `Int` | `click_rate_id` | — |
| `transactionItemId` | `Int?` | `transaction_item_id` | — |
| `quantity` | `Int` | _sama_ | — |
| `pricePerClick` | `Decimal` | `price_per_click` | — |
| `totalCost` | `Decimal` | `total_cost` | — |
| `date` | `DateTime` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `clickRate` | `ClickRate` | _sama_ | — |
| `transactionItem` | `TransactionItem?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |

Indeks & kunci: `@@index([branchId])`

### ClickRate — `click_rates`

> Konfigurasi harga klik per jenis cetak

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `paperSize` | `ClickPaperSize` | `paper_size` | — |
| `colorMode` | `ClickColorMode` | `color_mode` | — |
| `sideMode` | `ClickSideMode` | `side_mode` | — |
| `pricePerClick` | `Decimal` | `price_per_click` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `clickLogs` | `ClickLog[]` | _sama_ | — |
| `products` | `Product[]` | _sama_ | — |
| `variants` | `ProductVariant[]` | _sama_ | — |

Indeks & kunci: `@@unique([paperSize, colorMode, sideMode])`

### CompanyBranch — `company_branches`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `code` | `String?` | _sama_ | Kode singkat: PST, BTL, dll. Untuk prefix WO/INV. |
| `address` | `String?` | _sama_ | — |
| `phone` | `String?` | _sama_ | — |
| `notaHeader` | `String?` | `nota_header` | Override header nota cabang ini |
| `notaFooter` | `String?` | `nota_footer` | Override footer nota cabang ini |
| `logoUrl` | `String?` | `logo_url` | Logo khusus cabang (override storeLogo) |
| `dailyTargetOverride` | `Decimal?` | `daily_target_override` | null = auto dari beban bulanan ÷ hari |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `users` | `User[]` | _sama_ | — |
| `settings` | `BranchSettings?` | _sama_ | — |
| `workOrders` | `BranchWorkOrder[]` | _sama_ | — |
| `branchStocks` | `BranchStock[]` | _sama_ | — |
| `transactions` | `Transaction[]` | _sama_ | — |
| `productionTransactions` | `Transaction[]` | _sama_ | Titipan cetak masuk |
| `stockMovements` | `StockMovement[]` | _sama_ | — |
| `batches` | `Batch[]` | _sama_ | — |
| `stockPurchases` | `StockPurchase[]` | _sama_ | — |
| `opnameSessions` | `StockOpnameSession[]` | _sama_ | — |
| `productionJobs` | `ProductionJob[]` | _sama_ | — |
| `printJobs` | `PrintJob[]` | _sama_ | — |
| `cashflows` | `Cashflow[]` | _sama_ | — |
| `bankAccounts` | `BankAccount[]` | _sama_ | — |
| `shiftReports` | `ShiftReport[]` | _sama_ | — |
| `clickLogs` | `ClickLog[]` | _sama_ | — |
| `machineRejects` | `MachineReject[]` | _sama_ | — |
| `meterReadings` | `MeterReading[]` | _sama_ | — |
| `transfersOut` | `StockTransfer[]` | _sama_ | — |
| `transfersIn` | `StockTransfer[]` | _sama_ | — |
| `ledgersFrom` | `InterBranchLedger[]` | _sama_ | — |
| `ledgersTo` | `InterBranchLedger[]` | _sama_ | — |
| `leads` | `Lead[]` | _sama_ | — |
| `followUps` | `FollowUp[]` | _sama_ | — |
| `invoices` | `Invoice[]` | _sama_ | — |
| `csRatingConfigs` | `CsRatingConfig[]` | _sama_ | — |
| `csRatings` | `CsRatingResponse[]` | _sama_ | — |
| `printerDevices` | `PrinterDevice[]` | _sama_ | — |
| `waChannels` | `WaChannel[]` | _sama_ | — |
| `socialChannels` | `SocialChannel[]` | _sama_ | — |
| `taskSchedules` | `TaskSchedule[]` | _sama_ | — |
| `taskItems` | `TaskItem[]` | _sama_ | — |
| `taskGroups` | `TaskGroup[]` | _sama_ | — |
| `adLabels` | `AdLabel[]` | _sama_ | — |

### Competitor — `competitors`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `type` | `String?` | _sama_ | e.g., "Digital Printing", "Sablon" |
| `address` | `String?` | _sama_ | — |
| `latitude` | `Decimal` | _sama_ | — |
| `longitude` | `Decimal` | _sama_ | — |
| `notes` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### CsRatingConfig — `cs_rating_configs`

> ─── Penilaian CS (poling Ya/Tidak + bintang) ────────────────────────────────
> Konfigurasi pertanyaan poling. branchId null = default global (berlaku semua cabang).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |
| `question` | `String` | _sama_ | — |
| `thankYouText` | `String` | `thank_you_text` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### CsRatingResponse — `cs_rating_responses`

> 1 baris = 1 undangan penilaian. submittedAt null = belum dijawab (link masih aktif).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `token` | `String` | _sama_ | dipakai di URL /nilai/[token] |
| `branchId` | `Int?` | `branch_id` | — |
| `customerId` | `Int?` | `customer_id` | — |
| `salesOrderId` | `Int?` | `sales_order_id` | — |
| `transactionId` | `Int?` | `transaction_id` | — |
| `assignedCsId` | `Int?` | `assigned_cs_id` | CS pelanggan (Customer.assignedCsId) |
| `assignedCsName` | `String?` | `assigned_cs_name` | snapshot nama CS |
| `designerName` | `String?` | `designer_name` | snapshot desainer yg closing SO |
| `question` | `String` | _sama_ | snapshot pertanyaan saat undangan dibuat |
| `answer` | `Boolean?` | _sama_ | — |
| `stars` | `Int?` | _sama_ | — |
| `comment` | `String?` | _sama_ | — |
| `submittedAt` | `DateTime?` | `submitted_at` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `customer` | `Customer?` | _sama_ | — |
| `salesOrder` | `SalesOrder?` | _sama_ | — |
| `transaction` | `Transaction?` | _sama_ | — |
| `assignedCs` | `User?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])` · `@@index([assignedCsId])` · `@@index([submittedAt])`

### CustomProductMetric — `custom_product_metrics`

> Metrik produk custom untuk leaderboard — owner mendefinisikan 1+ "produk khusus"
> yang dihitung sebagai kolom tersendiri (mis. "Jersey Kantor", "Stiker Premium").
> Aturan match OR: item cocok bila memenuhi salah satu dari variant/kategori/keyword.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | nama internal (untuk owner) |
| `label` | `String` | _sama_ | header kolom pendek di leaderboard |
| `isActive` | `Boolean` | `is_active` | — |
| `displayOrder` | `Int` | `display_order` | — |
| `productIds` | `Json?` | `product_ids` | number[] — produk terdaftar (semua variannya match) |
| `productVariantIds` | `Json?` | `product_variant_ids` | number[] |
| `categoryIds` | `Json?` | `category_ids` | number[] |
| `nameKeywords` | `Json?` | `name_keywords` | string[] (contains, case-insensitive) |
| `countMode` | `String` | `count_mode` | Cara menghitung item yang cocok: PCS \| QTY \| OMZET \| NOTA |
| `roles` | `Json?` | _sama_ | Leaderboard yang menampilkan kolom ini: ["CS","DESIGNER","OPERATOR"] |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### Customer — `customers`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `phone` | `String?` | _sama_ | — |
| `address` | `String?` | _sama_ | — |
| `leadSource` | `LeadSource?` | `lead_source` | CRM fields — semua nullable supaya backward compat dengan customer existing |
| `assignedCsId` | `Int?` | `assigned_cs_id` | — |
| `referrerCustomerId` | `Int?` | `referrer_customer_id` | — |
| `tags` | `Json?` | _sama_ | ["sekolah", "akademi", "event-tahunan"] |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `salesOrders` | `SalesOrder[]` | _sama_ | — |
| `csRatings` | `CsRatingResponse[]` | _sama_ | — |
| `assignedCs` | `User?` | _sama_ | — |
| `referrer` | `Customer?` | _sama_ | — |
| `referrals` | `Customer[]` | _sama_ | — |
| `fromLeads` | `Lead[]` | _sama_ | — |
| `activities` | `LeadActivity[]` | _sama_ | — |
| `followUps` | `FollowUp[]` | _sama_ | — |
| `waContacts` | `WaContact[]` | _sama_ | — |
| `socialContacts` | `SocialContact[]` | _sama_ | — |

Indeks & kunci: `@@index([assignedCsId])` · `@@index([updatedAt]) // delta-sync: pull "where updatedAt > since"`

### Designer — `designers`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `pin` | `String` | _sama_ | — |
| `branchName` | `String?` | `branch_name` | nama cabang desainer ini (untuk auto-tag SO) |
| `branchId` | `Int?` | `branch_id` | FK cabang home desainer — atribusi leaderboard (resolve dari branchName) |
| `isActive` | `Boolean` | `is_active` | — |
| `userId` | `Int?` | `user_id` | Akun tugas (User) orang ini → pop-up piket/teguran/pengingat di halaman ber-PIN (/so-designer, /produksi, /cetak). Null = belum terhubung. |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([branchId])` · `@@index([userId])`

### Device — `devices`

> Perangkat (device) offline yang tersinkron ke pusat. Tiap instal aplikasi desktop =
> 1 Device dengan token rahasia (x-device-token) untuk auth ke /sync/* — menggantikan
> JWT user (tak kadaluarsa, ter-scope cabang, bisa dicabut).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | cabang device (null = semua/owner) |
| `name` | `String` | _sama_ | — |
| `token` | `String` | _sama_ | — |
| `lastSyncAt` | `DateTime?` | `last_sync_at` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([branchId])`

### DiscordConfig — `discord_config`

> Konfigurasi notifikasi Discord (singleton, id=1).
> webhooks: map channel→URL { sales, production, finance, inventory, leaderboard, system }
> events  : map event→bool  { shiftRecap, dealClosing, jobReady, lowStock, backup, error, champion }
> Terpisah dari StoreSettings.discordWebhookUrl (yang khusus notif GitHub commit).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `enabled` | `Boolean` | _sama_ | — |
| `webhooks` | `Json?` | _sama_ | Webhook GLOBAL/SISTEM (event lintas-cabang: champion/backup/error + event tanpa cabang) |
| `events` | `Json?` | _sama_ | Toggle per-event (global, berlaku semua cabang) |
| `branchConfigs` | `Json?` | `branch_configs` | { [branchId]: { webhooks: { channel: url } } } — webhook per cabang |
| `updatedAt` | `DateTime` | `updated_at` | — |

### FixedExpense — `fixed_expenses`

> Beban tetap bulanan yang diatur owner (gaji, sewa ruko, angsuran mesin,
> supplier, dll). Dipakai di Dashboard Owner untuk menghitung estimasi laba
> bersih (Laba Kotor − beban tetap). branchId null = pusat/semua cabang.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `category` | `String` | _sama_ | GAJI \| SEWA \| ANGSURAN \| SUPPLIER \| LAINNYA |
| `amount` | `Decimal` | _sama_ | nominal per bulan |
| `branchId` | `Int?` | `branch_id` | null = pusat / semua cabang |
| `dueDay` | `Int?` | `due_day` | tanggal jatuh tempo (1-31), opsional |
| `note` | `String?` | _sama_ | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@index([branchId])`

### FollowUp — `follow_ups`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `type` | `FollowUpType` | _sama_ | — |
| `status` | `FollowUpStatus` | _sama_ | — |
| `dueDate` | `DateTime` | `due_date` | — |
| `doneAt` | `DateTime?` | `done_at` | — |
| `leadId` | `Int?` | `lead_id` | — |
| `customerId` | `Int?` | `customer_id` | — |
| `assignedToId` | `Int?` | `assigned_to_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `notes` | `String?` | _sama_ | — |
| `doneNotes` | `String?` | `done_notes` | — |
| `templateId` | `Int?` | `template_id` | — |
| `sourceRef` | `String?` | `source_ref` | mis. "production-pickup:job-123" |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `lead` | `Lead?` | _sama_ | — |
| `customer` | `Customer?` | _sama_ | — |
| `assignedTo` | `User?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `template` | `MessageTemplate?` | _sama_ | — |
| `createdBy` | `User?` | _sama_ | — |

Indeks & kunci: `@@index([status, dueDate])` · `@@index([assignedToId, status])` · `@@index([branchId, status])` · `@@index([customerId, type])`

### HppFixedCost — `hpp_fixed_costs`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `worksheetId` | `Int` | `worksheet_id` | — |
| `name` | `String` | _sama_ | — |
| `amount` | `Decimal` | _sama_ | — |
| `worksheet` | `HppWorksheet` | _sama_ | — |

### HppVariableCost — `hpp_variable_costs`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `worksheetId` | `Int` | `worksheet_id` | — |
| `productVariantId` | `Int?` | `product_variant_id` | null if custom material |
| `customMaterialName` | `String?` | `custom_material_name` | — |
| `customPrice` | `Decimal?` | `custom_price` | — |
| `usageAmount` | `Decimal` | `usage_amount` | — |
| `usageUnit` | `String` | `usage_unit` | — |
| `worksheet` | `HppWorksheet` | _sama_ | — |
| `productVariant` | `ProductVariant?` | _sama_ | — |

### HppWorksheet — `hpp_worksheets`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productName` | `String` | `product_name` | — |
| `targetVolume` | `Int` | `target_volume` | — |
| `targetMargin` | `Decimal` | `target_margin` | — |
| `productVariantId` | `Int?` | `product_variant_id` | — |
| `productId` | `Int?` | `product_id` | — |
| `appliedAt` | `DateTime?` | `applied_at` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `variableCosts` | `HppVariableCost[]` | _sama_ | — |
| `fixedCosts` | `HppFixedCost[]` | _sama_ | — |
| `productVariant` | `ProductVariant?` | _sama_ | — |
| `product` | `Product?` | _sama_ | — |

### Ingredient — `ingredients`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productId` | `Int` | `product_id` | — |
| `name` | `String` | _sama_ | — |
| `quantity` | `Decimal` | _sama_ | — |
| `unit` | `String` | _sama_ | — |
| `price` | `Decimal` | _sama_ | — |
| `subtotal` | `Decimal` | _sama_ | — |
| `rawMaterialVariantId` | `Int?` | `raw_material_variant_id` | — |
| `product` | `Product` | _sama_ | — |
| `rawMaterialVariant` | `ProductVariant?` | _sama_ | — |

### InterBranchLedger — `inter_branch_ledger`

> ===========================
> INTER-BRANCH LEDGER (Buku Titipan Antar Cabang)
> Saat transaksi titip cetak diserahkan (handoverStatus=DISERAHKAN), sistem otomatis
> catat hutang cabang pemesan (fromBranch) ke cabang pelaksana (toBranch) sebesar
> HPP bahan + fee layanan (BranchSettings.titipanFeePercent).
> Settlement lewat cash (2 Cashflow pair) atau kirim stok bahan.
> ===========================

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `transactionId` | `Int` | `transaction_id` | — |
| `fromBranchId` | `Int` | `from_branch_id` | cabang pemesan (yang berhutang, tempat kasir/revenue) |
| `toBranchId` | `Int` | `to_branch_id` | cabang pelaksana (yang punya piutang, tempat produksi) |
| `costAmount` | `Decimal` | `cost_amount` | total HPP bahan × qty |
| `serviceFee` | `Decimal` | `service_fee` | fee layanan = costAmount × titipanFeePercent |
| `totalAmount` | `Decimal` | `total_amount` | costAmount + serviceFee |
| `settledAmount` | `Decimal` | `settled_amount` | — |
| `status` | `String` | _sama_ | PENDING \| PARTIAL \| SETTLED \| CANCELLED |
| `notes` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `transaction` | `Transaction` | _sama_ | — |
| `fromBranch` | `CompanyBranch` | _sama_ | — |
| `toBranch` | `CompanyBranch` | _sama_ | — |
| `settlements` | `LedgerSettlement[]` | _sama_ | — |

Indeks & kunci: `@@index([fromBranchId, status])` · `@@index([toBranchId, status])`

### InvoiceItem — `invoice_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `invoiceId` | `Int` | `invoice_id` | — |
| `description` | `String` | _sama_ | — |
| `unit` | `String?` | _sama_ | Satuan: pcs, m², lembar, set, dll |
| `quantity` | `Int` | _sama_ | — |
| `price` | `Decimal` | _sama_ | — |
| `invoice` | `Invoice` | _sama_ | — |

### Invoice — `invoices`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `invoiceNumber` | `String` | `invoice_number` | — |
| `type` | `InvoiceType` | _sama_ | — |
| `clientName` | `String` | `client_name` | — |
| `clientCompany` | `String?` | `client_company` | Instansi/PT |
| `clientAddress` | `String?` | `client_address` | Alamat Lengkap |
| `clientPhone` | `String?` | `client_phone` | No. HP/Telp |
| `clientEmail` | `String?` | `client_email` | Email Perusahaan |
| `date` | `DateTime` | _sama_ | — |
| `dueDate` | `DateTime?` | `due_date` | — |
| `validUntil` | `DateTime?` | `valid_until` | Quotation: masa berlaku penawaran |
| `status` | `InvoiceStatus` | _sama_ | — |
| `subtotal` | `Decimal` | _sama_ | — |
| `taxRate` | `Decimal` | `tax_rate` | % PPN |
| `taxAmount` | `Decimal` | `tax_amount` | Rp PPN |
| `discount` | `Decimal` | _sama_ | Diskon (Rp) |
| `total` | `Decimal` | _sama_ | Grand Total (Subtotal + PPN - Diskon) |
| `notes` | `String?` | _sama_ | Syarat & Ketentuan, Garansi, dll |
| `letterCity` | `String?` | `letter_city` | Kota pengirim, mis. "Bantul" |
| `signatoryName` | `String?` | `signatory_name` | Nama penanda tangan |
| `signatoryPhone` | `String?` | `signatory_phone` | No. HP penanda tangan |
| `branchId` | `Int?` | `branch_id` | Cabang pemilik invoice (multi-cabang). Null = warisan (di-backfill ke Pusat) |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `items` | `InvoiceItem[]` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### JerseyWorkOrder — `jersey_work_orders`

> Work Order Jersey — surat perintah kerja produksi jersey custom.
> Diterbitkan setelah desain ACC (job pindah DESIGN → PRINT). Berisi spec
> lengkap untuk tukang print + tukang jahit: jenis kerah, bahan, jumlah order
> per garment & size, pola print yang harus dicetak, QC checklist, tanggal
> tiap tahap produksi. 1-1 dengan ProductionJob.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productionJobId` | `Int` | `production_job_id` | — |
| `woNumber` | `String?` | `wo_number` | kode produksi mis. 03.070526.M |
| `orderDate` | `DateTime?` | `order_date` | Header |
| `source` | `String?` | _sama_ | META, WA, IG, dll (dari lead.source) |
| `designerName` | `String?` | `designer_name` | — |
| `deadline` | `DateTime?` | _sama_ | — |
| `customerName` | `String?` | `customer_name` | Identitas produk |
| `collarType` | `String?` | `collar_type` | V-Neck, O-Neck, Shanghai, dll |
| `fabricType` | `String?` | `fabric_type` | Milano, Dryfit, Hyget, dll |
| `mockupImageUrl` | `String?` | `mockup_image_url` | DEPRECATED single — first image (backward compat) |
| `printLayoutImageUrl` | `String?` | `print_layout_image_url` | DEPRECATED single — first image |
| `mockupImages` | `Json?` | `mockup_images` | array URL gambar mockup desain (multi) |
| `printLayoutImages` | `Json?` | `print_layout_images` | array URL gambar layout pola print (multi) |
| `shortSleeveItems` | `Json?` | `short_sleeve_items` | Atasan Lengan Pendek |
| `longSleeveItems` | `Json?` | `long_sleeve_items` | Atasan Lengan Panjang |
| `pantsItems` | `Json?` | `pants_items` | Celana |
| `printPatterns` | `Json?` | `print_patterns` | Pola print — JSON [{name, qty, ok}] |
| `qcChecklist` | `Json?` | `qc_checklist` | QC checklist — JSON [{criteria, ok, note, inspector}] |
| `tglPrint` | `DateTime?` | `tgl_print` | Tanggal tahap produksi |
| `tglPress` | `DateTime?` | `tgl_press` | — |
| `tglJahit` | `DateTime?` | `tgl_jahit` | — |
| `printInspector` | `String?` | `print_inspector` | — |
| `jahitInspector` | `String?` | `jahit_inspector` | — |
| `notes` | `String?` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `productionJob` | `ProductionJob` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### LandingConfig — `landing_config`

> Landing page builder (singleton, id=1). data/draftData = struktur Puck (JSON).
> data = versi terpublikasi (dirender ke publik), draftData = simpanan editor.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `data` | `Json?` | _sama_ | — |
| `draftData` | `Json?` | _sama_ | — |
| `published` | `Boolean` | _sama_ | — |
| `customDomain` | `String?` | `custom_domain` | — |
| `seoTitle` | `String?` | `seo_title` | — |
| `seoDescription` | `String?` | `seo_description` | — |
| `faviconUrl` | `String?` | `favicon_url` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### LeadActivity — `lead_activities`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `leadId` | `Int?` | `lead_id` | — |
| `customerId` | `Int?` | `customer_id` | — |
| `kind` | `String` | _sama_ | FIRST_CONTACT, MESSAGE, CALL, MEETING, PROPOSAL_SENT, STATUS_CHANGE, FOLLOW_UP_DONE, NOTE, AFTER_SALES_SCHEDULED, CONVERTED, dll |
| `text` | `String?` | _sama_ | — |
| `meta` | `Json?` | _sama_ | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `lead` | `Lead?` | _sama_ | — |
| `customer` | `Customer?` | _sama_ | — |
| `createdBy` | `User?` | _sama_ | — |

Indeks & kunci: `@@index([leadId, createdAt])` · `@@index([customerId, createdAt])`

### LeadImage — `lead_images`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `leadId` | `Int` | `lead_id` | — |
| `filename` | `String` | _sama_ | path relatif (/uploads/lead_xxx.jpg) |
| `caption` | `String?` | _sama_ | — |
| `position` | `Int` | _sama_ | urutan slider |
| `createdAt` | `DateTime` | `created_at` | — |
| `lead` | `Lead` | _sama_ | — |

Indeks & kunci: `@@index([leadId, position])`

### LeadItem — `lead_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `leadId` | `Int` | `lead_id` | — |
| `productVariantId` | `Int?` | `product_variant_id` | null = custom item (produk belum terdaftar) |
| `description` | `String` | _sama_ | display name (auto-fill dari product variant atau manual) |
| `quantity` | `Int` | _sama_ | — |
| `unitPrice` | `Decimal` | `unit_price` | — |
| `widthCm` | `Float?` | `width_cm` | — |
| `heightCm` | `Float?` | `height_cm` | — |
| `unitType` | `String?` | `unit_type` | — |
| `note` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | delta-sync offline |
| `lead` | `Lead` | _sama_ | — |
| `productVariant` | `ProductVariant?` | _sama_ | — |

Indeks & kunci: `@@index([leadId])` · `@@index([productVariantId])`

### LeadSourceOption — `lead_source_options`

> Master data sumber lead "CUSTOM" (mis. "Shopee", "Brosur Pameran").
> Dipakai bersama semua CS/cabang untuk mencegah penumpukan nama yang sama
> beda huruf besar/kecil: dedup lewat normalizedName (lowercase+trim) @unique.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | nama tampilan (casing pertama yang dipakai) |
| `normalizedName` | `String` | `normalized_name` | kunci dedup |
| `usageCount` | `Int` | `usage_count` | berapa kali dipakai — untuk urutan populer |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### Lead — `leads`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `phone` | `String?` | _sama_ | — |
| `phoneNormalized` | `String?` | `phone_normalized` | normalized untuk dedup (strip +62/0/spasi) |
| `source` | `LeadSource` | _sama_ | — |
| `sourceDetail` | `String?` | `source_detail` | — |
| `ctwaClid` | `String?` | `ctwa_clid` | Atribusi iklan Meta (Click-to-WhatsApp). Terisi bila prospek datang dari klik iklan: adId = referral.source_id, ctwaClid = click-id (utk pencocokan konversi), adReferral = objek referral mentah (headline/body/media/source_url) utk audit. |
| `adId` | `String?` | `ad_id` | — |
| `adReferral` | `Json?` | `ad_referral` | — |
| `adCampaignName` | `String?` | `ad_campaign_name` | nama campaign Meta (denormal, utk label chat CTWA) |
| `adLabelId` | `Int?` | `ad_label_id` | label custom iklan (per campaign) → pisah cabang/perusahaan |
| `status` | `LeadStatus` | _sama_ | — |
| `level` | `LeadLevel` | _sama_ | — |
| `needs` | `String?` | _sama_ | — |
| `estimatedValue` | `Decimal?` | `estimated_value` | — |
| `city` | `String?` | _sama_ | — |
| `assignedToId` | `Int?` | `assigned_to_id` | — |
| `followUpDate` | `DateTime?` | `follow_up_date` | — |
| `deliveryDeadline` | `DateTime?` | `delivery_deadline` | — |
| `firstResponseAt` | `DateTime?` | `first_response_at` | — |
| `convertedCustomerId` | `Int?` | `converted_customer_id` | — |
| `convertedSalesOrderId` | `Int?` | `converted_sales_order_id` | — |
| `convertedTransactionId` | `Int?` | `converted_transaction_id` | — |
| `closeLostReason` | `String?` | `close_lost_reason` | — |
| `designerName` | `String?` | `designer_name` | Cek desain pra-jual (kerja tim CS+Designer). designerName = snapshot nama designer yg mengecek; outcome lead (closing/gagal) dibagi ke CS & designer. |
| `designVerdict` | `String?` | `design_verdict` | BISA \| TIDAK_BISA \| REVISI |
| `designCheckedAt` | `DateTime?` | `design_checked_at` | — |
| `imageUrl` | `String?` | `image_url` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `intakeAt` | `DateTime?` | `intake_at` | jam masuk lead sesungguhnya (CS-set, bisa beda dari createdAt) |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `closedAt` | `DateTime?` | `closed_at` | — |
| `assignedTo` | `User?` | _sama_ | — |
| `createdBy` | `User?` | _sama_ | — |
| `convertedCustomer` | `Customer?` | _sama_ | — |
| `convertedSO` | `SalesOrder?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `adLabel` | `AdLabel?` | _sama_ | — |
| `activities` | `LeadActivity[]` | _sama_ | — |
| `followUps` | `FollowUp[]` | _sama_ | — |
| `items` | `LeadItem[]` | _sama_ | — |
| `images` | `LeadImage[]` | _sama_ | — |
| `waContacts` | `WaContact[]` | _sama_ | — |
| `socialContacts` | `SocialContact[]` | _sama_ | — |

Indeks & kunci: `@@index([status, followUpDate])` · `@@index([assignedToId, status])` · `@@index([branchId, status])` · `@@index([phoneNormalized])` · `@@index([designerName, status])` · `@@index([adId])` · `@@index([adLabelId])`

### LedgerSettlement — `ledger_settlements`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `ledgerId` | `Int` | `ledger_id` | — |
| `settlementType` | `String` | `settlement_type` | CASH \| STOCK |
| `amount` | `Decimal` | _sama_ | — |
| `cashflowPayerId` | `Int?` | `cashflow_payer_id` | Cashflow EXPENSE di cabang pemesan (fromBranch) |
| `cashflowPayeeId` | `Int?` | `cashflow_payee_id` | Cashflow INCOME di cabang pelaksana (toBranch) |
| `stockMovementOutId` | `Int?` | `stock_movement_out_id` | OUT dari fromBranch |
| `stockMovementInId` | `Int?` | `stock_movement_in_id` | IN ke toBranch |
| `notes` | `String?` | _sama_ | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `ledger` | `InterBranchLedger` | _sama_ | — |

Indeks & kunci: `@@index([ledgerId])`

### MachineReject — `machine_rejects`

> Log reject mesin (error, test print, kalibrasi)

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `rejectType` | `RejectType` | `reject_type` | — |
| `cause` | `RejectCause` | `cause` | — |
| `counterType` | `CounterType` | `counter_type` | — |
| `quantity` | `Int` | _sama_ | — |
| `pricePerClick` | `Decimal` | `price_per_click` | — |
| `totalCost` | `Decimal` | `total_cost` | — |
| `photoUrl` | `String?` | `photo_url` | — |
| `notes` | `String?` | _sama_ | — |
| `date` | `DateTime` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### MarketingSpend — `marketing_spend`

> Pengeluaran iklan marketing (diinput tim marketing di /marketing) — untuk
> benchmark ROAS/CPL/CAC per sumber. Global (semua cabang).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `date` | `DateTime` | _sama_ | tanggal pengeluaran |
| `source` | `String` | _sama_ | nilai LeadSource (WHATSAPP, INSTAGRAM, ...) |
| `amount` | `Decimal` | _sama_ | — |
| `note` | `String?` | _sama_ | nama campaign/iklan (opsional) |
| `branchId` | `Int?` | `branch_id` | null = pusat / semua cabang |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([date])` · `@@index([branchId])`

### MessageTemplate — `message_templates`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `category` | `String` | _sama_ | GREETING, FU_LEAD, PROGRESS_UPDATE, AFTER_SALES, REPEAT_ORDER, CUSTOM |
| `bodyTemplate` | `String` | `body_template` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `followUps` | `FollowUp[]` | _sama_ | — |

Indeks & kunci: `@@index([category, isActive])`

### MetaAdMap — `meta_ad_maps`

> Cache peta iklan→campaign Meta (referral.source_id = adId). Dipakai webhook untuk
> resolve label lead tanpa panggil Meta tiap pesan. Diisi saat lihat dashboard iklan
> atau saat assign label campaign.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `adId` | `String` | `ad_id` | — |
| `campaignId` | `String` | `campaign_id` | — |
| `campaignName` | `String?` | `campaign_name` | nama campaign Meta (cache) → label chat CTWA |
| `adAccountId` | `String?` | `ad_account_id` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@index([campaignId])`

### MetaCampaignLabel — `meta_campaign_labels`

> Config per-campaign Meta (1 baris/campaign): label opsional + profit produk.
> productProfit dipakai patokan CPR (target = profit × 5%). campaignId = id Meta.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `campaignId` | `String` | `campaign_id` | — |
| `adLabelId` | `Int?` | `ad_label_id` | — |
| `productProfit` | `Decimal?` | `product_profit` | — |
| `adAccountId` | `String?` | `ad_account_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `label` | `AdLabel?` | _sama_ | — |

Indeks & kunci: `@@index([adLabelId])`

### MeterReading — `meter_readings`

> Pembacaan counter mesin harian — tiap hari ada 1 record

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `readingDate` | `DateTime` | `reading_date` | — |
| `totalCount` | `Int` | `total_count` | — |
| `fullColorCount` | `Int` | `full_color_count` | — |
| `blackCount` | `Int` | `black_count` | — |
| `singleColorCount` | `Int` | `single_color_count` | — |
| `photoUrl` | `String?` | `photo_url` | — |
| `notes` | `String?` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@unique([branchId, readingDate])` · `@@index([branchId])`

### PrintJob — `print_jobs`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `jobNumber` | `String` | `job_number` | — |
| `transactionId` | `Int` | `transaction_id` | — |
| `transactionItemId` | `Int` | `transaction_item_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `status` | `PrintJobStatus` | _sama_ | — |
| `quantity` | `Int` | _sama_ | — |
| `notes` | `String?` | _sama_ | — |
| `startedAt` | `DateTime?` | `started_at` | — |
| `finishedAt` | `DateTime?` | `finished_at` | — |
| `pickedUpAt` | `DateTime?` | `picked_up_at` | — |
| `operatorName` | `String?` | `operator_name` | — |
| `coOperators` | `Json?` | `co_operators` | rekan kerja sama (array nama, bagi rata 1/N) |
| `operatorBranchId` | `Int?` | `operator_branch_id` | Cabang operator cetak saat finish (dari PIN cabang) — atribusi leaderboard per cabang home operator, beda dari `branchId` (cabang job/transaksi). Null utk data lama. |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `transaction` | `Transaction` | _sama_ | — |
| `transactionItem` | `TransactionItem` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([status])` · `@@index([transactionId])` · `@@index([branchId])` · `@@index([operatorBranchId])`

### PrinterDevice — `printer_devices`

> Perangkat printer relay per cabang (print server). Agen di komputer utama
> konek WebSocket KELUAR ke backend pakai `token` (bukan JWT user); kasir cetak
> lewat aplikasi https → backend rutekan job ESC/POS ke agen cabang yang online.
> Koneksi agen ke printer: PILIHAN USB (COM) atau Bluetooth (RFCOMM/COM/BLE).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `branchId` | `Int` | `branch_id` | — |
| `name` | `String` | _sama_ | — |
| `token` | `String` | _sama_ | rahasia agen (acak) — kredensial handshake |
| `connection` | `String` | _sama_ | pilihan user: "usb" \| "bluetooth" |
| `mode` | `String` | _sama_ | teknis turunan: com \| rfcomm \| ble |
| `target` | `String?` | _sama_ | USB→COM5 ; Bluetooth→MAC/COM (diisi agen/admin) |
| `lastSeenAt` | `DateTime?` | `last_seen_at` | update saat connect/disconnect (tampilan online) |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### ProductVariant — `product_variants`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productId` | `Int` | `product_id` | — |
| `sku` | `String` | _sama_ | — |
| `variantName` | `String?` | `variant_name` | — |
| `price` | `Decimal` | _sama_ | — |
| `hpp` | `Decimal` | _sama_ | — |
| `stock` | `Int` | _sama_ | — |
| `size` | `String?` | _sama_ | — |
| `color` | `String?` | _sama_ | — |
| `variantImageUrl` | `String?` | `variant_image_url` | — |
| `isRollMaterial` | `Boolean` | `is_roll_material` | — |
| `rollPhysicalWidth` | `Decimal?` | `roll_physical_width` | — |
| `rollEffectivePrintWidth` | `Decimal?` | `roll_effective_print_width` | — |
| `clickRateId` | `Int?` | `click_rate_id` | override klik per-varian |
| `clicksPerUnit` | `Float?` | `clicks_per_unit` | klik per unit terjual |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `product` | `Product` | _sama_ | — |
| `clickRate` | `ClickRate?` | _sama_ | — |
| `batches` | `Batch[]` | _sama_ | — |
| `movements` | `StockMovement[]` | _sama_ | — |
| `transactionItems` | `TransactionItem[]` | _sama_ | — |
| `hppVariableCosts` | `HppVariableCost[]` | _sama_ | — |
| `ingredientsAsRaw` | `Ingredient[]` | _sama_ | — |
| `opnameItems` | `StockOpnameItem[]` | _sama_ | — |
| `rollJobs` | `ProductionJob[]` | _sama_ | — |
| `batchRolls` | `ProductionBatch[]` | _sama_ | — |
| `supplierItems` | `SupplierItem[]` | _sama_ | — |
| `priceTiers` | `VariantPriceTier[]` | _sama_ | — |
| `variantIngredients` | `VariantIngredient[]` | _sama_ | — |
| `variantIngredientsAsRaw` | `VariantIngredient[]` | _sama_ | — |
| `hppWorksheets` | `HppWorksheet[]` | _sama_ | — |
| `purchaseItems` | `StockPurchaseItem[]` | _sama_ | — |
| `leadItems` | `LeadItem[]` | _sama_ | — |
| `salesOrderItems` | `SalesOrderItem[]` | _sama_ | — |
| `branchWorkOrderItems` | `BranchWorkOrderItem[]` | _sama_ | — |
| `branchStocks` | `BranchStock[]` | _sama_ | — |
| `transferItems` | `StockTransferItem[]` | _sama_ | — |

Indeks & kunci: `@@index([updatedAt]) // delta-sync: pull "where updatedAt > since"`

### ProductionBatch — `production_batches`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `batchNumber` | `String` | `batch_number` | — |
| `rollVariantId` | `Int?` | `roll_variant_id` | — |
| `usedWaste` | `Boolean` | `used_waste` | — |
| `rollLengthUsed` | `Decimal?` | `roll_length_used` | — |
| `status` | `String` | _sama_ | — |
| `startedAt` | `DateTime?` | `started_at` | — |
| `completedAt` | `DateTime?` | `completed_at` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `rollVariant` | `ProductVariant?` | _sama_ | — |
| `jobs` | `ProductionJob[]` | _sama_ | — |

### ProductionCategory — `production_categories`

> Jenis produksi yang bisa DITAMBAH/EDIT/HAPUS user (Banner, Stiker, Laser Cut, dst).
> Dipakai untuk breakdown produksi per kategori di leaderboard operator.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `source` | `ProductionSource` | _sama_ | — |
| `measureBy` | `ProductionMeasure` | `measure_by` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `sortOrder` | `Int` | `sort_order` | — |
| `categories` | `Category[]` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |

### ProductionJobActivity — `production_job_activities`

> Audit log per production job — track siapa pindah card kapan dari/ke stage apa,
> upload/hapus proof, set info jahit, dll. Dipakai sebagai history untuk admin.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `jobId` | `Int` | `job_id` | — |
| `action` | `String` | _sama_ | STAGE_CHANGE, PROOF_UPLOAD, PROOF_DELETE, JAHIT_INFO, QC_NOTE, RETURN_REASON |
| `fromStage` | `String?` | `from_stage` | — |
| `toStage` | `String?` | `to_stage` | — |
| `actorName` | `String?` | `actor_name` | nama operator/desainer (dari board) atau user (admin) |
| `actorRole` | `String?` | `actor_role` | ADMIN \| OPERATOR |
| `actorWeight` | `Float` | `actor_weight` | bobot kredit 1/N saat kerja sama beberapa operator |
| `branchId` | `Int?` | `branch_id` | Cabang operator saat aksi (dari PIN cabang yang dipakai) — untuk atribusi leaderboard per cabang home operator (bukan cabang produksi job). Null utk data lama/aksi admin. |
| `meta` | `Json?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([jobId, createdAt])` · `@@index([branchId])`

### ProductionJobProof — `production_job_proofs`

> Multi proof images per production job (di-upload di stage DESIGN sebagai bukti ACC).
> proofImageUrl di ProductionJob tetap di-keep sebagai legacy single-image fallback.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `jobId` | `Int` | `job_id` | — |
| `filename` | `String` | _sama_ | — |
| `caption` | `String?` | _sama_ | — |
| `position` | `Int` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `job` | `ProductionJob` | _sama_ | — |

Indeks & kunci: `@@index([jobId, position])`

### ProductionJob — `production_jobs`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `jobNumber` | `String` | `job_number` | — |
| `transactionId` | `Int` | `transaction_id` | — |
| `transactionItemId` | `Int` | `transaction_item_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `status` | `String` | _sama_ | — |
| `priority` | `String` | _sama_ | — |
| `deadline` | `DateTime?` | _sama_ | — |
| `notes` | `String?` | _sama_ | — |
| `operatorNote` | `String?` | `operator_note` | — |
| `usedWaste` | `Boolean` | `used_waste` | — |
| `isSubOrder` | `Boolean` | `is_sub_order` | job disub ke printing luar → startJob tidak potong bahan |
| `rollVariantId` | `Int?` | `roll_variant_id` | — |
| `rollLengthUsed` | `Decimal?` | `roll_length_used` | — |
| `batchId` | `Int?` | `batch_id` | — |
| `startedAt` | `DateTime?` | `started_at` | — |
| `completedAt` | `DateTime?` | `completed_at` | — |
| `assemblyStartedAt` | `DateTime?` | `assembly_started_at` | — |
| `assemblyCompletedAt` | `DateTime?` | `assembly_completed_at` | — |
| `assemblyNote` | `String?` | `assembly_note` | — |
| `pickedUpAt` | `DateTime?` | `picked_up_at` | — |
| `pipelineStage` | `String?` | `pipeline_stage` | Pipeline kanban (admin view) — alur produksi end-to-end. Independen dari `status` (yang dipakai operator PIN-mode di /produksi). Default DESIGN. Stages: DESIGN, PRINT, ANTRIAN_PRESS, JAHIT, QC_PACKING, KIRIM, RETUR, SELESAI |
| `proofImageUrl` | `String?` | `proof_image_url` | Proof image yang sudah ACC siap cetak (di-upload di stage DESIGN) |
| `lastUpdatedBy` | `String?` | `last_updated_by` | Audit terakhir — nama operator/desainer yang terakhir update card ini |
| `lastUpdatedAt` | `DateTime?` | `last_updated_at` | — |
| `penjahitName` | `String?` | `penjahit_name` | Jahit stage info (di-set saat card di-drag ke kolom JAHIT via modal) |
| `jahitInDate` | `DateTime?` | `jahit_in_date` | — |
| `jahitEstimate` | `DateTime?` | `jahit_estimate` | — |
| `designerName` | `String?` | `designer_name` | Desainer yang ditugaskan (nama bebas, diisi saat convert dari CRM atau manual) |
| `isExpress` | `Boolean` | `is_express` | Order express: dicentang CS saat convert lead, tampil sebagai badge merah di pipeline |
| `designEnteredAt` | `DateTime?` | `design_entered_at` | Waktu proof pertama diupload — dasar skala aman/normal/urgent di kanban DESIGN |
| `qcNote` | `String?` | `qc_note` | QC & Packing notes |
| `shippedAt` | `DateTime?` | `shipped_at` | Kirim / Retur tracking |
| `returnedAt` | `DateTime?` | `returned_at` | — |
| `returnReason` | `String?` | `return_reason` | — |
| `cancelledAt` | `DateTime?` | `cancelled_at` | Batal / klien tidak jadi order — desain sudah dikerjakan tapi order tidak lanjut. Job di-hide dari kanban aktif tapi tetap dihitung di leaderboard designer. |
| `cancelReason` | `String?` | `cancel_reason` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `transaction` | `Transaction` | _sama_ | — |
| `transactionItem` | `TransactionItem` | _sama_ | — |
| `rollVariant` | `ProductVariant?` | _sama_ | — |
| `batch` | `ProductionBatch?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `proofs` | `ProductionJobProof[]` | _sama_ | — |
| `workOrder` | `JerseyWorkOrder?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### Product — `products`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `description` | `String?` | _sama_ | — |
| `categoryId` | `Int` | `category_id` | — |
| `unitId` | `Int` | `unit_id` | — |
| `imageUrl` | `String?` | `image_url` | — |
| `imageUrls` | `String?` | `image_urls` | — |
| `pricingMode` | `PricingMode` | `pricing_mode` | — |
| `areaUnit` | `String` | `area_unit` | basis luas AREA_BASED: 'M2' (per m²) \| 'CM2' (per cm²) |
| `productType` | `ProductType` | `product_type` | — |
| `compositeConfig` | `Json?` | `composite_config` | — |
| `pricePerUnit` | `Decimal?` | `price_per_unit` | — |
| `requiresProduction` | `Boolean` | `requires_production` | — |
| `hasAssemblyStage` | `Boolean` | `has_assembly_stage` | — |
| `trackStock` | `Boolean` | `track_stock` | — |
| `isActive` | `Boolean` | `is_active` | false = diarsipkan (soft-delete). Riwayat transaksi tetap aman. |
| `clickRateId` | `Int?` | `click_rate_id` | ClickRate yang berlaku untuk produk ini |
| `clicksPerUnit` | `Float?` | `clicks_per_unit` | Jumlah klik per unit terjual |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `category` | `Category` | _sama_ | — |
| `unit` | `Unit` | _sama_ | — |
| `variants` | `ProductVariant[]` | _sama_ | — |
| `ingredients` | `Ingredient[]` | _sama_ | — |
| `hppWorksheets` | `HppWorksheet[]` | _sama_ | — |
| `clickRate` | `ClickRate?` | _sama_ | — |

Indeks & kunci: `@@index([updatedAt]) // delta-sync: pull "where updatedAt > since"`

### Role — `roles`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `menuAccess` | `String?` | `menu_access` | JSON array href menu yg boleh dilihat; null = pakai preset divisi |
| `users` | `User[]` | _sama_ | — |

### SalesOrderItem — `sales_order_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `salesOrderId` | `Int` | `sales_order_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `quantity` | `Int` | _sama_ | — |
| `widthCm` | `Float?` | `width_cm` | — |
| `heightCm` | `Float?` | `height_cm` | — |
| `unitType` | `String?` | `unit_type` | — |
| `pcs` | `Int?` | _sama_ | — |
| `customPrice` | `Float?` | `custom_price` | — |
| `note` | `String?` | _sama_ | — |
| `updatedAt` | `DateTime` | `updated_at` | delta-sync offline |
| `salesOrder` | `SalesOrder` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

Indeks & kunci: `@@index([salesOrderId])`

### SalesOrderProof — `sales_order_proofs`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `salesOrderId` | `Int` | `sales_order_id` | — |
| `filename` | `String` | _sama_ | — |
| `caption` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `salesOrder` | `SalesOrder` | _sama_ | — |

Indeks & kunci: `@@index([salesOrderId])`

### SalesOrder — `sales_orders`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `soNumber` | `String` | `so_number` | — |
| `status` | `SalesOrderStatus` | _sama_ | — |
| `customerId` | `Int?` | `customer_id` | — |
| `customerName` | `String` | `customer_name` | — |
| `customerPhone` | `String?` | `customer_phone` | — |
| `customerAddress` | `String?` | `customer_address` | — |
| `designerName` | `String` | `designer_name` | — |
| `branchName` | `String?` | `branch_name` | cabang asal SO (untuk atribusi pendapatan) |
| `notes` | `String?` | _sama_ | — |
| `label` | `String?` | _sama_ | nama event/pekerjaan: chip di samping nama pelanggan & dicetak di nota |
| `marketplace` | `String?` | _sama_ | platform marketplace (Shopee/Tokopedia/…); terisi = order marketplace, HP boleh kosong |
| `marketplaceOrderNo` | `String?` | `marketplace_order_no` | — |
| `deadline` | `DateTime?` | _sama_ | — |
| `sentToWaAt` | `DateTime?` | `sent_to_wa_at` | — |
| `invoicedAt` | `DateTime?` | `invoiced_at` | — |
| `cancelledAt` | `DateTime?` | `cancelled_at` | — |
| `cancelReason` | `String?` | `cancel_reason` | — |
| `transactionId` | `Int?` | `transaction_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `customer` | `Customer?` | _sama_ | — |
| `transaction` | `Transaction?` | _sama_ | — |
| `items` | `SalesOrderItem[]` | _sama_ | — |
| `proofs` | `SalesOrderProof[]` | _sama_ | — |
| `fromLeads` | `Lead[]` | _sama_ | — |
| `csRatings` | `CsRatingResponse[]` | _sama_ | — |

Indeks & kunci: `@@index([status])` · `@@index([customerId])`

### ShiftReport — `shift_reports`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `adminName` | `String` | `admin_name` | — |
| `shiftName` | `String` | `shift_name` | — |
| `openedAt` | `DateTime` | `opened_at` | — |
| `closedAt` | `DateTime` | `closed_at` | — |
| `expectedCash` | `Decimal` | `expected_cash` | Cash Information |
| `actualCash` | `Decimal` | `actual_cash` | — |
| `cashDifference` | `Decimal` | `cash_difference` | — |
| `expectedQris` | `Decimal` | `expected_qris` | QRIS Information |
| `actualQris` | `Decimal` | `actual_qris` | — |
| `qrisDifference` | `Decimal` | `qris_difference` | — |
| `expectedTransfer` | `Decimal` | `expected_transfer` | Transfer Information |
| `actualTransfer` | `Decimal` | `actual_transfer` | — |
| `transferDifference` | `Decimal` | `transfer_difference` | — |
| `expectedBankBalances` | `Json?` | `expected_bank_balances` | Detailed breakdowns for WA report |
| `actualBankBalances` | `Json?` | `actual_bank_balances` | Saldo Laporan mBanking |
| `realBankBalances` | `Json?` | `real_bank_balances` | Saldo Real di Bank |
| `shiftExpenses` | `Json?` | `shift_expenses` | — |
| `structuredExpenses` | `Json?` | `structured_expenses` | Pengeluaran terstruktur per metode |
| `kasbon` | `Json?` | `kasbon` | [{name: string, amount: number}] |
| `setorKas` | `Json?` | `setor_kas` | [{bankName: string, amount: number}] |
| `tarikTunai` | `Json?` | `tarik_tunai` | [{bankName: string, amount: number}] |
| `tukarTransferKeCash` | `Decimal` | `tukar_transfer_ke_cash` | Konversi transfer masuk menjadi kas fisik |
| `additionalIncomes` | `Json?` | `additional_incomes` | [{bankName: string, amount: number, description: string}] |
| `expensesTotal` | `Decimal` | `expenses_total` | — |
| `notes` | `String?` | _sama_ | — |
| `amendedAt` | `DateTime?` | `amended_at` | diisi saat laporan dikoreksi |
| `amendNote` | `String?` | `amend_note` | catatan alasan koreksi |
| `proofImages` | `Json?` | `proof_images` | array of uploaded image paths |
| `whatsappMessage` | `String?` | `whatsapp_message` | backup pesan WA untuk resend |
| `paymentExchanges` | `Json?` | `payment_exchanges` | [{from, to, amount}] |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `cashflows` | `Cashflow[]` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### SocialChannel — `social_channels`

> Channel sosial = 1 Page/akun IG. Untuk INSTAGRAM: igId = IG business id (rute
> webhook), pageId+accessToken Page yang terhubung (untuk kirim via Send API).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `label` | `String` | _sama_ | — |
| `platform` | `SocialPlatform` | _sama_ | — |
| `pageId` | `String` | `page_id` | Facebook Page ID |
| `igId` | `String?` | `ig_id` | IG business account id (INSTAGRAM) |
| `accessToken` | `String` | `access_token` | Page access token |
| `branchId` | `Int?` | `branch_id` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `conversations` | `SocialConversation[]` | _sama_ | — |
| `messages` | `SocialMessage[]` | _sama_ | — |
| `contacts` | `SocialContact[]` | _sama_ | — |

Indeks & kunci: `@@index([platform])`

### SocialContact — `social_contacts`

> Kontak sosial (PSID Messenger / IGSID Instagram) + tautan CRM.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `platform` | `SocialPlatform` | _sama_ | — |
| `externalId` | `String` | `external_id` | PSID / IGSID |
| `name` | `String?` | _sama_ | — |
| `leadId` | `Int?` | `lead_id` | — |
| `customerId` | `Int?` | `customer_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `channel` | `SocialChannel` | _sama_ | — |
| `lead` | `Lead?` | _sama_ | — |
| `customer` | `Customer?` | _sama_ | — |
| `conversations` | `SocialConversation[]` | _sama_ | — |
| `messages` | `SocialMessage[]` | _sama_ | — |

Indeks & kunci: `@@unique([channelId, externalId])`

### SocialConversation — `social_conversations`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `contactId` | `Int` | `contact_id` | — |
| `status` | `String` | _sama_ | OPEN \| CLOSED |
| `lastMessageAt` | `DateTime?` | `last_message_at` | — |
| `unreadCount` | `Int` | `unread_count` | — |
| `assignedToId` | `Int?` | `assigned_to_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `channel` | `SocialChannel` | _sama_ | — |
| `contact` | `SocialContact` | _sama_ | — |
| `assignedTo` | `User?` | _sama_ | — |
| `messages` | `SocialMessage[]` | _sama_ | — |

Indeks & kunci: `@@index([channelId, status])`

### SocialMessage — `social_messages`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `conversationId` | `Int` | `conversation_id` | — |
| `contactId` | `Int` | `contact_id` | — |
| `externalId` | `String?` | `external_id` | mid (dedup) |
| `direction` | `SocialDirection` | _sama_ | — |
| `type` | `String` | _sama_ | TEXT \| IMAGE \| ... |
| `body` | `String?` | _sama_ | — |
| `mediaUrl` | `String?` | `media_url` | — |
| `sentById` | `Int?` | `sent_by_id` | user pengirim (outbound manusia) |
| `createdAt` | `DateTime` | `created_at` | — |
| `channel` | `SocialChannel` | _sama_ | — |
| `conversation` | `SocialConversation` | _sama_ | — |
| `contact` | `SocialContact` | _sama_ | — |
| `sentBy` | `User?` | _sama_ | — |

Indeks & kunci: `@@unique([externalId])` · `@@index([conversationId, id])`

### StockMovement — `stock_movements`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `type` | `MovementType` | _sama_ | — |
| `quantity` | `Decimal` | _sama_ | — |
| `reason` | `String?` | _sama_ | — |
| `balanceAfter` | `Float?` | `balance_after` | — |
| `referenceId` | `String?` | `reference_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `date` | `DateTime?` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `productVariant` | `ProductVariant` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |

Indeks & kunci: `@@index([branchId])` · `@@index([referenceId])`

### StockOpnameItem — `stock_opname_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `sessionId` | `String` | `session_id` | — |
| `operatorName` | `String` | `operator_name` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `systemStock` | `Int` | `system_stock` | — |
| `actualStock` | `Int` | `actual_stock` | — |
| `variance` | `Int` | _sama_ | — |
| `isEstimated` | `Boolean` | `is_estimated` | — |
| `estimationNotes` | `String?` | `estimation_notes` | — |
| `submittedAt` | `DateTime` | `submitted_at` | — |
| `session` | `StockOpnameSession` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

### StockOpnameSession — `stock_opname_sessions`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `String` | _sama_ | — |
| `notes` | `String?` | _sama_ | — |
| `categoryId` | `Int?` | `category_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `status` | `OpnameStatus` | _sama_ | — |
| `expiresAt` | `DateTime` | `expires_at` | — |
| `startDate` | `DateTime` | `start_date` | — |
| `endDate` | `DateTime?` | `end_date` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `category` | `Category?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `items` | `StockOpnameItem[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### StockPurchaseItem — `stock_purchase_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `purchaseId` | `Int` | `purchase_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `quantity` | `Int` | _sama_ | — |
| `unitPrice` | `Decimal?` | `unit_price` | — |
| `purchase` | `StockPurchase` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

### StockPurchase — `stock_purchases`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `invoiceNumber` | `String?` | `invoice_number` | — |
| `supplierId` | `Int?` | `supplier_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `notes` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `supplier` | `Supplier?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `items` | `StockPurchaseItem[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### StockTransferItem — `stock_transfer_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `transferId` | `Int` | `transfer_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `quantity` | `Decimal` | _sama_ | — |
| `note` | `String?` | _sama_ | — |
| `transfer` | `StockTransfer` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

Indeks & kunci: `@@index([transferId])` · `@@index([productVariantId])`

### StockTransfer — `stock_transfers`

> Transfer stok antar cabang (1 baris = 1 transfer header).
> Setiap transfer otomatis bikin 2 StockMovement (OUT cabang asal, IN cabang tujuan)
> supaya histori per cabang tetap konsisten.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `transferNumber` | `String` | `transfer_number` | TRF-YYYYMMDD-XXXX |
| `fromBranchId` | `Int` | `from_branch_id` | — |
| `toBranchId` | `Int` | `to_branch_id` | — |
| `notes` | `String?` | _sama_ | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `fromBranch` | `CompanyBranch` | _sama_ | — |
| `toBranch` | `CompanyBranch` | _sama_ | — |
| `createdBy` | `User?` | _sama_ | — |
| `items` | `StockTransferItem[]` | _sama_ | — |

Indeks & kunci: `@@index([fromBranchId])` · `@@index([toBranchId])` · `@@index([createdAt])`

### StoreSettings — `store_settings`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `storeName` | `String` | `store_name` | — |
| `storeAddress` | `String?` | `store_address` | — |
| `storePhone` | `String?` | `store_phone` | — |
| `qrisImageUrl` | `String?` | `qris_image_url` | — |
| `logoImageUrl` | `String?` | `logo_image_url` | — |
| `enableAdvancedPricing` | `Boolean` | `enable_advanced_pricing` | — |
| `enableTax` | `Boolean` | `enable_tax` | — |
| `taxRate` | `Decimal` | `tax_rate` | — |
| `receiptDefaultFormat` | `String` | `receipt_default_format` | "A5" \| "THERMAL_58" |
| `loginBgImages` | `String?` | `login_bg_images` | — |
| `loginTaglines` | `String?` | `login_taglines` | — |
| `loginLogoUrl` | `String?` | `login_logo_url` | Custom logo untuk login page (replace animasi Voliko centerpiece). Support SVG/PNG/JPG. Kalau null, animasi Voliko default tetap. |
| `themeMode` | `String?` | `theme_mode` | Theme color app-wide (di-expose via CSS variable --theme-primary, --theme-bg). |
| `themePrimaryColor` | `String?` | `theme_primary_color` | — |
| `themeSecondaryColor` | `String?` | `theme_secondary_color` | — |
| `themeGradientDirection` | `String?` | `theme_gradient_direction` | — |
| `operatorPin` | `String?` | `operator_pin` | — |
| `marketingPin` | `String?` | `marketing_pin` | — |
| `notifyNewTransaction` | `Boolean` | `notify_new_transaction` | — |
| `notifyLowStock` | `Boolean` | `notify_low_stock` | — |
| `notifyOfflineSync` | `Boolean` | `notify_offline_sync` | — |
| `notifyShiftReminder` | `Boolean` | `notify_shift_reminder` | — |
| `lowStockThreshold` | `Int` | `low_stock_threshold` | — |
| `shiftReminderTime` | `String?` | `shift_reminder_time` | — |
| `shiftReminderTime2` | `String?` | `shift_reminder_time_2` | — |
| `piketTrialUntil` | `String?` | `piket_trial_until` | Piket: sampai tanggal ini ("YYYY-MM-DD") = masa uji coba → tanpa teguran otomatis & tak dihitung rekap. |
| `piketSignatures` | `String?` | `piket_signatures` | Piket: tanda tangan PDF jadwal — JSON [{label,userId,roleId}] maks 3 slot, diatur owner/manajer di Pengaturan. Kosong = titik-titik (tanda tangan manual). |
| `notifyGithubCommit` | `Boolean` | `notify_github_commit` | — |
| `discordWebhookUrl` | `String?` | `discord_webhook_url` | — |
| `githubWebhookSecret` | `String?` | `github_webhook_secret` | — |
| `rcloneEnabled` | `Boolean` | `rclone_enabled` | Rclone Auto-Backup |
| `rcloneRemote` | `String?` | `rclone_remote` | — |
| `rcloneSchedule` | `String?` | `rclone_schedule` | — |
| `rcloneKeepCount` | `Int` | `rclone_keep_count` | — |
| `rcloneLastBackupAt` | `DateTime?` | `rclone_last_backup_at` | — |
| `rcloneLastStatus` | `String?` | `rclone_last_status` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |

### SupplierItem — `supplier_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `supplierId` | `Int` | `supplier_id` | — |
| `productVariantId` | `Int` | `product_variant_id` | — |
| `purchasePrice` | `Decimal` | `purchase_price` | — |
| `notes` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `supplier` | `Supplier` | _sama_ | — |
| `productVariant` | `ProductVariant` | _sama_ | — |

### Supplier — `suppliers`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `contactPerson` | `String?` | `contact_person` | — |
| `phone` | `String?` | _sama_ | — |
| `email` | `String?` | _sama_ | — |
| `address` | `String?` | _sama_ | — |
| `notes` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `items` | `SupplierItem[]` | _sama_ | — |
| `stockPurchases` | `StockPurchase[]` | _sama_ | — |

### SyncPush — `sync_push`

> Antrean push: mutasi transaksional yang dibuat di device lokal, menunggu didorong
> ke pusat. Diisi oleh interceptor saat POST /transactions berhasil (mode lokal).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `clientId` | `String` | `client_id` | UUID (idempotensi ke pusat) |
| `type` | `String` | _sama_ | transaction.create \| cashflow.create |
| `payload` | `Json` | _sama_ | payload create asli (bentuk persis yang dikirim frontend) |
| `localId` | `Int?` | `local_id` | id record di DB lokal |
| `centralId` | `Int?` | `central_id` | id hasil di pusat (setelah push) |
| `pushedAt` | `DateTime?` | `pushed_at` | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([pushedAt])`

### SyncState — `sync_state`

> Dipakai HANYA di DB lokal (mode 100% offline). Di server pusat tetap ada tapi kosong.
> Cursor & state sinkronisasi lokal⟷pusat.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `key` | `String` | _sama_ | mis. "pullCursor" |
| `value` | `String` | _sama_ | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### SyncedOp — `synced_ops`

> Jejak idempotensi delta-sync offline. Tiap mutasi yang dibuat device saat offline
> punya clientId (UUID v4) unik. Saat push, server cek clientId dulu: kalau sudah ada
> → balas serverId lama (idempoten, retry/duplikat tak menggandakan transaksi).
> Tanpa relasi FK ke CompanyBranch (branchId scalar) supaya additif & tak menyentuh model lain.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `clientId` | `String` | `client_id` | UUID v4 dari device |
| `type` | `String` | _sama_ | transaction.create \| cashflow.create |
| `serverId` | `Int?` | `server_id` | PK record hasil buat di server (dipetakan balik ke klien) |
| `branchId` | `Int?` | `branch_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([branchId])`

### TaskGroupMember — `task_group_members`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `groupId` | `Int` | `group_id` | — |
| `userId` | `Int` | `user_id` | — |
| `group` | `TaskGroup` | _sama_ | — |
| `user` | `User` | _sama_ | — |

Indeks & kunci: `@@unique([groupId, userId])`

### TaskGroup — `task_groups`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `branchId` | `Int?` | `branch_id` | null = global (owner) |
| `createdById` | `Int?` | `created_by` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `members` | `TaskGroupMember[]` | _sama_ | — |
| `schedules` | `TaskSchedule[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### TaskItem — `task_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `scheduleId` | `Int?` | `schedule_id` | null = tugas ad-hoc (sekali) |
| `title` | `String` | _sama_ | snapshot dari schedule |
| `description` | `String?` | _sama_ | — |
| `priority` | `String` | _sama_ | — |
| `status` | `String` | _sama_ | TODO \| IN_PROGRESS \| DONE |
| `index` | `Int` | _sama_ | urutan dalam kolom (pola kan: integer index) |
| `periodKey` | `String?` | `period_key` | "YYYY-MM-DD" occurrence (idempoten) |
| `dueDate` | `DateTime?` | `due_date` | — |
| `note` | `String?` | _sama_ | catatan karyawan |
| `imageUrls` | `String?` | `image_urls` | JSON array URL lampiran gambar (brief/contoh) |
| `assigneeId` | `Int?` | `assignee_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `completedAt` | `DateTime?` | `completed_at` | — |
| `completedById` | `Int?` | `completed_by` | — |
| `verifiedByOwnerAt` | `DateTime?` | `verified_by_owner_at` | — |
| `createdById` | `Int?` | `created_by` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `schedule` | `TaskSchedule?` | _sama_ | — |
| `assignee` | `User?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `completedBy` | `User?` | _sama_ | — |

Indeks & kunci: `@@unique([scheduleId, assigneeId, periodKey])` · `@@index([branchId, status])` · `@@index([assigneeId, status])`

### TaskSchedule — `task_schedules`

> ===== PAPAN TUGAS KARYAWAN (Kanban + jadwal berulang) =====

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `title` | `String` | _sama_ | — |
| `description` | `String?` | _sama_ | — |
| `frequency` | `String` | _sama_ | ONCE \| DAILY \| WEEKLY \| MONTHLY |
| `daysOfWeek` | `String?` | `days_of_week` | CSV ISO "1,3,5" (1=Sen..7=Min), utk WEEKLY |
| `dayOfMonth` | `Int?` | `day_of_month` | 1-28, utk MONTHLY |
| `skipWeekends` | `Boolean` | `skip_weekends` | utk DAILY |
| `timeOfDay` | `String?` | `time_of_day` | "09:00" (jam jatuh tempo) |
| `priority` | `String` | _sama_ | LOW \| NORMAL \| HIGH \| URGENT |
| `startDate` | `DateTime?` | `start_date` | — |
| `endDate` | `DateTime?` | `end_date` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `shiftSlot` | `String?` | `shift_slot` | Piket: "PAGI" \| "KEDUA" → kartu hanya dibuat utk karyawan yang memilih shift itu hari ini (saat pilih shift, bukan cron harian). Null = jadwal biasa. |
| `rotationUserIds` | `String?` | `rotation_user_ids` | Giliran harian: CSV userId berurutan, berputar tiap hari kalender dihitung dari startDate. Bila diisi, target assignee/grup/divisi/semua diabaikan. |
| `assigneeId` | `Int?` | `assignee_id` | user spesifik (personal, privat) |
| `groupId` | `Int?` | `group_id` | grup tim kustom (beberapa karyawan terpilih) |
| `targetRole` | `String?` | `target_role` | mis. "OPERATOR" → semua operator cabang |
| `targetAll` | `Boolean` | `target_all` | broadcast ke semua karyawan (tim) |
| `branchId` | `Int?` | `branch_id` | null = global (semua cabang) |
| `createdById` | `Int?` | `created_by` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `assignee` | `User?` | _sama_ | — |
| `group` | `TaskGroup?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `createdBy` | `User?` | _sama_ | — |
| `items` | `TaskItem[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])` · `@@index([isActive])`

### TaskShiftCheckin — `task_shift_checkins`

> Pilihan shift harian karyawan untuk piket. 1 baris per user per tanggal.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `userId` | `Int` | `user_id` | — |
| `branchId` | `Int?` | `branch_id` | — |
| `dateKey` | `String` | `date_key` | "YYYY-MM-DD" |
| `shift` | `String` | _sama_ | PAGI \| KEDUA \| LIBUR |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@unique([userId, dateKey])` · `@@index([branchId, dateKey])`

### TaskWarning — `task_warnings`

> Teguran tugas ke karyawan. Pop-up hanya tampil ke user penerima.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `userId` | `Int` | `user_id` | penerima teguran |
| `branchId` | `Int?` | `branch_id` | — |
| `dateKey` | `String` | `date_key` | hari tugas yang ditegur |
| `kind` | `String` | _sama_ | AUTO (lewat batas) \| MANUAL (owner/manajer) |
| `taskItemId` | `Int?` | `task_item_id` | AUTO: kartu yang ditegur |
| `message` | `String` | _sama_ | — |
| `createdById` | `Int?` | `created_by` | — |
| `createdByName` | `String?` | `created_by_name` | — |
| `acknowledgedAt` | `DateTime?` | `acknowledged_at` | ditekan "Saya mengerti" |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@unique([kind, taskItemId]) // 1 teguran otomatis per kartu; MANUAL (null) tak bentrok` · `@@index([userId, acknowledgedAt])` · `@@index([branchId, dateKey])`

### TransactionEditRequest — `transaction_edit_requests`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `transactionId` | `Int` | `transaction_id` | — |
| `requestedById` | `Int` | `requested_by_id` | — |
| `reviewedById` | `Int?` | `reviewed_by_id` | — |
| `status` | `EditRequestStatus` | _sama_ | — |
| `reason` | `String` | _sama_ | — |
| `editData` | `Json` | `edit_data` | — |
| `reviewNote` | `String?` | `review_note` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `transaction` | `Transaction` | _sama_ | — |
| `requestedBy` | `User` | _sama_ | — |
| `reviewedBy` | `User?` | _sama_ | — |

### TransactionItem — `transaction_items`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `transactionId` | `Int` | `transaction_id` | — |
| `productVariantId` | `Int?` | `product_variant_id` | — |
| `customName` | `String?` | `custom_name` | nama item custom (tanpa varian katalog) |
| `quantity` | `Int` | _sama_ | — |
| `priceAtTime` | `Decimal` | `price_at_time` | — |
| `hppAtTime` | `Decimal` | `hpp_at_time` | — |
| `isSubOrder` | `Boolean` | `is_sub_order` | item ini disub ke printing luar |
| `subPrice` | `Decimal?` | `sub_price` | harga printing luar per m²/satuan (basis sama dgn priceAtTime) |
| `subVendor` | `String?` | `sub_vendor` | nama printing luar (opsional, catatan) |
| `widthCm` | `Decimal?` | `width_cm` | — |
| `heightCm` | `Decimal?` | `height_cm` | — |
| `areaCm2` | `Decimal?` | `area_cm2` | — |
| `pcs` | `Int?` | _sama_ | jumlah kopi/PCS untuk AREA_BASED |
| `unitType` | `String?` | `unit_type` | 'm', 'cm', 'menit' |
| `note` | `String?` | _sama_ | — |
| `clickType` | `String?` | `click_type` | "A3+ WARNA", "A4 BW", dll |
| `createdAt` | `DateTime?` | `created_at` | — |
| `transaction` | `Transaction` | _sama_ | — |
| `productVariant` | `ProductVariant?` | _sama_ | — |
| `productionJob` | `ProductionJob?` | _sama_ | — |
| `printJob` | `PrintJob?` | _sama_ | — |
| `clickLogs` | `ClickLog[]` | _sama_ | — |

### Transaction — `transactions`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `invoiceNumber` | `String` | `invoice_number` | — |
| `totalAmount` | `Decimal` | `total_amount` | — |
| `tax` | `Decimal` | _sama_ | — |
| `discount` | `Decimal` | _sama_ | — |
| `shippingCost` | `Decimal` | `shipping_cost` | — |
| `marketplaceFee` | `Decimal` | `marketplace_fee` | — |
| `marketplaceFeeItems` | `Json?` | `marketplace_fee_items` | [{name:string, amount:number}] |
| `grandTotal` | `Decimal` | `grand_total` | — |
| `paymentMethod` | `PaymentMethod` | `payment_method` | — |
| `status` | `TransactionStatus` | _sama_ | — |
| `customerName` | `String?` | `customer_name` | — |
| `customerPhone` | `String?` | `customer_phone` | — |
| `customerAddress` | `String?` | `customer_address` | — |
| `dueDate` | `DateTime?` | `due_date` | — |
| `downPayment` | `Decimal` | `down_payment` | — |
| `cashierName` | `String?` | `cashier_name` | — |
| `employeeName` | `String?` | `employee_name` | — |
| `bankAccountId` | `Int?` | `bank_account_id` | — |
| `dpPaymentMethod` | `PaymentMethod?` | `dp_payment_method` | — |
| `dpBankAccountId` | `Int?` | `dp_bank_account_id` | — |
| `productionPriority` | `String` | `production_priority` | — |
| `productionDeadline` | `DateTime?` | `production_deadline` | — |
| `productionNotes` | `String?` | `production_notes` | — |
| `label` | `String?` | _sama_ | nama event/pekerjaan (disalin dari SO); bukan bagian nama pelanggan |
| `marketplace` | `String?` | _sama_ | platform marketplace (disalin dari SO / dipilih kasir) |
| `marketplaceOrderNo` | `String?` | `marketplace_order_no` | — |
| `checkoutNumber` | `String?` | `checkout_number` | — |
| `paidAt` | `DateTime?` | `paid_at` | — |
| `checkoutCashierName` | `String?` | `checkout_cashier_name` | — |
| `branchName` | `String?` | `branch_name` | Tag display asal SO dari desainer eksternal (free-text, diturunkan dari SalesOrder.branchName). BUKAN sumber scoping tenant — pakai branchId untuk itu. |
| `branchId` | `Int?` | `branch_id` | FK ke CompanyBranch — authoritative untuk scoping multi-cabang |
| `productionBranchId` | `Int?` | `production_branch_id` | Titip cetak ke cabang lain: kalau diisi & berbeda dari branchId, maka ProductionJob/PrintJob/ClickLog dibuat di cabang produksi (bukan di cabang transaksi). Pendapatan tetap di branchId (cabang kasir). |
| `handoverStatus` | `String?` | `handover_status` | Status fulfillment titipan cetak dari sisi cabang penerima (independen dari status produksi per-item). BARU = baru masuk inbox, belum di-acknowledge operator cabang tujuan. DIPROSES = operator cabang tujuan sudah buka & acknowledge, sedang dikerjakan. SIAP_AMBIL = semua item selesai dikerjakan, menunggu diambil/dikirim. DISERAHKAN = sudah diserahkan ke kurir/pengambil (flow titipan selesai). |
| `handoverAckAt` | `DateTime?` | `handover_ack_at` | — |
| `handoverReadyAt` | `DateTime?` | `handover_ready_at` | — |
| `handoverDoneAt` | `DateTime?` | `handover_done_at` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `items` | `TransactionItem[]` | _sama_ | — |
| `bankAccount` | `BankAccount?` | _sama_ | — |
| `productionJobs` | `ProductionJob[]` | _sama_ | — |
| `printJobs` | `PrintJob[]` | _sama_ | — |
| `editRequests` | `TransactionEditRequest[]` | _sama_ | — |
| `salesOrder` | `SalesOrder?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `productionBranch` | `CompanyBranch?` | _sama_ | — |
| `interBranchLedger` | `InterBranchLedger?` | _sama_ | — |
| `csRatings` | `CsRatingResponse[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])` · `@@index([productionBranchId])`

### Unit — `units`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `products` | `Product[]` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |

### User — `users`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String?` | _sama_ | — |
| `email` | `String` | _sama_ | — |
| `phone` | `String?` | _sama_ | — |
| `passwordHash` | `String` | `password_hash` | — |
| `roleId` | `Int?` | `role_id` | — |
| `branchId` | `Int?` | `branch_id` | Cabang tempat user ditugaskan; null = Owner/SuperAdmin (akses semua cabang) |
| `isActive` | `Boolean` | `is_active` | false = akun dinonaktifkan (tak bisa login, token dicabut) |
| `resignedAt` | `DateTime?` | `resigned_at` | Karyawan keluar/resign: akun TIDAK dihapus (riwayat lead/kas/tugas ikut hilang), cukup isActive=false + tanggal keluar di bawah ini supaya laporan lama tetap utuh. |
| `resignNote` | `String?` | `resign_note` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `role` | `Role?` | _sama_ | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `cashflows` | `Cashflow[]` | _sama_ | — |
| `cashflowRequests` | `CashflowChangeRequest[]` | _sama_ | — |
| `cashflowReviews` | `CashflowChangeRequest[]` | _sama_ | — |
| `editRequests` | `TransactionEditRequest[]` | _sama_ | — |
| `editReviews` | `TransactionEditRequest[]` | _sama_ | — |
| `stockTransfers` | `StockTransfer[]` | _sama_ | — |
| `leadsAssigned` | `Lead[]` | _sama_ | CRM relations |
| `leadsCreated` | `Lead[]` | _sama_ | — |
| `customersAssigned` | `Customer[]` | _sama_ | — |
| `activitiesCreated` | `LeadActivity[]` | _sama_ | — |
| `followUpsAssigned` | `FollowUp[]` | _sama_ | — |
| `followUpsCreated` | `FollowUp[]` | _sama_ | — |
| `csRatings` | `CsRatingResponse[]` | _sama_ | — |
| `waConversations` | `WaConversation[]` | _sama_ | WhatsApp CRM |
| `waMessagesSent` | `WaMessage[]` | _sama_ | — |
| `socialConversations` | `SocialConversation[]` | _sama_ | — |
| `socialMessagesSent` | `SocialMessage[]` | _sama_ | — |
| `taskSchedulesAssigned` | `TaskSchedule[]` | _sama_ | Papan Tugas Karyawan |
| `taskSchedulesCreated` | `TaskSchedule[]` | _sama_ | — |
| `taskItemsAssigned` | `TaskItem[]` | _sama_ | — |
| `taskItemsCompleted` | `TaskItem[]` | _sama_ | — |
| `taskGroupMemberships` | `TaskGroupMember[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### VariantIngredient — `variant_ingredients`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `variantId` | `Int` | `variant_id` | — |
| `name` | `String` | _sama_ | — |
| `quantity` | `Decimal` | _sama_ | — |
| `unit` | `String` | _sama_ | — |
| `price` | `Decimal` | _sama_ | — |
| `isServiceCost` | `Boolean` | `is_service_cost` | — |
| `isShared` | `Boolean` | `is_shared` | — |
| `rawMaterialVariantId` | `Int?` | `raw_material_variant_id` | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `variant` | `ProductVariant` | _sama_ | — |
| `rawMaterialVariant` | `ProductVariant?` | _sama_ | — |

### VariantPriceTier — `variant_price_tiers`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `variantId` | `Int` | `variant_id` | — |
| `tierName` | `String?` | `tier_name` | — |
| `minQty` | `Int` | `min_qty` | — |
| `maxQty` | `Int?` | `max_qty` | — |
| `price` | `Decimal` | _sama_ | — |
| `createdAt` | `DateTime?` | `created_at` | — |
| `updatedAt` | `DateTime?` | `updated_at` | — |
| `variant` | `ProductVariant` | _sama_ | — |

### WaAutoReplyRule — `wa_auto_reply_rules`

> Aturan balasan otomatis rule-based (bukan AI). Dievaluasi saat pesan masuk;
> selalu dalam jendela 24 jam (pesan baru saja masuk) → aman kirim teks.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int?` | `channel_id` | null = berlaku semua channel |
| `trigger` | `WaAutoReplyTrigger` | _sama_ | — |
| `keywords` | `Json?` | _sama_ | ["harga","lokasi"] untuk trigger KEYWORD |
| `replyText` | `String` | `reply_text` | — |
| `isActive` | `Boolean` | `is_active` | — |
| `priority` | `Int` | _sama_ | makin besar makin diprioritaskan |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

Indeks & kunci: `@@index([channelId, isActive])`

### WaBroadcastRecipient — `wa_broadcast_recipients`

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `broadcastId` | `Int` | `broadcast_id` | — |
| `contactId` | `Int` | `contact_id` | — |
| `waId` | `String` | `wa_id` | — |
| `status` | `WaRecipientStatus` | _sama_ | — |
| `waMessageId` | `String?` | `wa_message_id` | — |
| `errorMessage` | `String?` | `error_message` | — |
| `varsJson` | `Json?` | `vars_json` | nilai variabel personalisasi per-penerima (dari CSV) |
| `sentAt` | `DateTime?` | `sent_at` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `broadcast` | `WaBroadcast` | _sama_ | — |
| `contact` | `WaContact` | _sama_ | — |

Indeks & kunci: `@@unique([broadcastId, contactId])` · `@@index([status])`

### WaBroadcast — `wa_broadcasts`

> Kampanye broadcast: kirim satu template ke segmen kontak (opt-out dihormati).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `templateId` | `Int` | `template_id` | — |
| `status` | `WaBroadcastStatus` | _sama_ | — |
| `scheduledAt` | `DateTime?` | `scheduled_at` | — |
| `startedAt` | `DateTime?` | `started_at` | — |
| `completedAt` | `DateTime?` | `completed_at` | — |
| `segmentJson` | `Json?` | `segment_json` | definisi filter segmen |
| `variableMapJson` | `Json?` | `variable_map_json` | mapping variabel template |
| `totalCount` | `Int` | `total_count` | — |
| `sentCount` | `Int` | `sent_count` | — |
| `failedCount` | `Int` | `failed_count` | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `channel` | `WaChannel` | _sama_ | — |
| `template` | `WaTemplate` | _sama_ | — |
| `recipients` | `WaBroadcastRecipient[]` | _sama_ | — |
| `messages` | `WaMessage[]` | _sama_ | — |

Indeks & kunci: `@@index([status])`

### WaChannel — `wa_channels`

> Satu nomor WhatsApp Business terdaftar (per cabang). phone_number_id & waba_id
> dari Meta; token/app_secret TIDAK di sini (ada di env, Business-level).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `label` | `String` | _sama_ | "CS Pusat", "Cabang Betoyo" |
| `phoneNumberId` | `String` | `phone_number_id` | dari Meta (rute webhook) |
| `wabaId` | `String` | `waba_id` | — |
| `catalogId` | `String?` | `catalog_id` | katalog Commerce (opsional; auto-resolve dari WABA bila kosong) |
| `displayNumber` | `String?` | `display_number` | 628xxx (info tampilan) |
| `branchId` | `Int?` | `branch_id` | null = global (semua cabang) |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `branch` | `CompanyBranch?` | _sama_ | — |
| `conversations` | `WaConversation[]` | _sama_ | — |
| `messages` | `WaMessage[]` | _sama_ | — |
| `broadcasts` | `WaBroadcast[]` | _sama_ | — |

Indeks & kunci: `@@index([branchId])`

### WaConfig — `wa_config`

> Konfigurasi WA Cloud global (singleton id=1). Token override env (diinput via Settings).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `accessToken` | `String?` | `access_token` | — |
| `adAccountId` | `String?` | `ad_account_id` | Ad Account Meta terpilih utk modul Ads (mis. "act_510575292057613"). Kosong = auto-pilih akun pertama dari me/adaccounts. Token WA yg sama dipakai (scope ads_read). |
| `updatedAt` | `DateTime` | `updated_at` | — |

### WaContact — `wa_contacts`

> Identitas kontak WA <-> tautan CRM. waId = 62xxx (toWaPhone), phoneNormalized =
> 81xxx (samakan Lead.phoneNormalized via toLeadKey) untuk pencocokan.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `waId` | `String` | `wa_id` | — |
| `phoneNormalized` | `String` | `phone_normalized` | — |
| `profileName` | `String?` | `profile_name` | nama dari WA (bisa berubah otomatis) |
| `customName` | `String?` | `custom_name` | nama yang di-set CS (prioritas tampil) |
| `leadId` | `Int?` | `lead_id` | — |
| `customerId` | `Int?` | `customer_id` | — |
| `optedOut` | `Boolean` | `opted_out` | — |
| `optedOutAt` | `DateTime?` | `opted_out_at` | — |
| `lastInboundAt` | `DateTime?` | `last_inbound_at` | basis jendela layanan 24 jam |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `lead` | `Lead?` | _sama_ | — |
| `customer` | `Customer?` | _sama_ | — |
| `conversations` | `WaConversation[]` | _sama_ | — |
| `messages` | `WaMessage[]` | _sama_ | — |
| `broadcastRecipients` | `WaBroadcastRecipient[]` | _sama_ | — |

Indeks & kunci: `@@index([phoneNormalized])` · `@@index([leadId])` · `@@index([customerId])`

### WaConversation — `wa_conversations`

> Thread percakapan inbox (per channel + contact). windowExpiresAt = lastInbound+24j.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `contactId` | `Int` | `contact_id` | — |
| `status` | `WaConversationStatus` | _sama_ | — |
| `assignedToId` | `Int?` | `assigned_to_id` | — |
| `lastMessageAt` | `DateTime?` | `last_message_at` | — |
| `windowExpiresAt` | `DateTime?` | `window_expires_at` | — |
| `unreadCount` | `Int` | `unread_count` | — |
| `snoozedUntil` | `DateTime?` | `snoozed_until` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `channel` | `WaChannel` | _sama_ | — |
| `contact` | `WaContact` | _sama_ | — |
| `assignedTo` | `User?` | _sama_ | — |
| `messages` | `WaMessage[]` | _sama_ | — |

Indeks & kunci: `@@index([status])` · `@@index([assignedToId])` · `@@index([channelId, lastMessageAt])`

### WaMessage — `wa_messages`

> Pesan masuk/keluar. waMessageId (id Meta) unik = idempotensi anti-duplikat webhook.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `channelId` | `Int` | `channel_id` | — |
| `conversationId` | `Int` | `conversation_id` | — |
| `contactId` | `Int` | `contact_id` | — |
| `waMessageId` | `String?` | `wa_message_id` | — |
| `direction` | `WaDirection` | _sama_ | — |
| `type` | `WaMessageType` | _sama_ | — |
| `status` | `WaMessageStatus` | _sama_ | — |
| `body` | `String?` | _sama_ | teks / caption |
| `templateName` | `String?` | `template_name` | — |
| `mediaUrl` | `String?` | `media_url` | — |
| `mediaMimeType` | `String?` | `media_mime_type` | — |
| `payloadJson` | `Json?` | `payload_json` | raw payload utk audit/interaktif |
| `errorCode` | `String?` | `error_code` | — |
| `errorMessage` | `String?` | `error_message` | — |
| `sentById` | `Int?` | `sent_by_id` | User agen (outbound manual) |
| `broadcastId` | `Int?` | `broadcast_id` | pesan hasil broadcast (null = chat biasa) |
| `replyToId` | `Int?` | `reply_to_id` | pesan yang dibalas/dikutip (self-relation) |
| `reactionsJson` | `Json?` | `reactions_json` | { customer?: string, agent?: string } emoji reaksi |
| `deletedAt` | `DateTime?` | `deleted_at` | soft-delete: sembunyikan dari CRM (data tetap, non-destruktif) |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `channel` | `WaChannel` | _sama_ | — |
| `conversation` | `WaConversation` | _sama_ | — |
| `contact` | `WaContact` | _sama_ | — |
| `sentBy` | `User?` | _sama_ | — |
| `broadcast` | `WaBroadcast?` | _sama_ | — |
| `replyTo` | `WaMessage?` | _sama_ | — |
| `replies` | `WaMessage[]` | _sama_ | — |

Indeks & kunci: `@@index([conversationId, createdAt])` · `@@index([status])` · `@@index([broadcastId])` · `@@index([replyToId])`

### WaQrLink — `wa_qr_links`

> QR "klik-untuk-chat" WhatsApp kustom per sumber (Walk-in, Brosur, dll).
> Kode ditanam sebagai #kode di pesan prefill → atribusi sumber lead otomatis.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | nama internal, mis. "Leads Walk-in" |
| `code` | `String` | _sama_ | marker #kode di pesan (atribusi) |
| `channelId` | `Int?` | `channel_id` | nomor tujuan (WaChannel) |
| `source` | `String` | _sama_ | LeadSource: WALK_IN \| REFERRAL \| CUSTOM \| ... |
| `sourceDetail` | `String?` | `source_detail` | — |
| `prefillText` | `String` | `prefill_text` | pesan siap-kirim (termasuk #kode) |
| `scanCount` | `Int` | `scan_count` | jumlah lead masuk via QR ini |
| `isActive` | `Boolean` | `is_active` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### WaQuickReply — `wa_quick_replies`

> Pesan cepat / canned message (BUKAN template Meta). Dipanggil di composer inbox
> dengan mengetik "/pintasan". Bebas teks — sah dikirim dalam jendela 24 jam.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `shortcut` | `String` | _sama_ | pintasan setelah "/" (mis. "harga") |
| `title` | `String?` | _sama_ | label opsional untuk memudahkan pencarian |
| `body` | `String` | _sama_ | isi pesan |
| `isActive` | `Boolean` | `is_active` | — |
| `sortOrder` | `Int` | `sort_order` | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### WaReminderConfig — `wa_reminder_configs`

> Konfigurasi reminder otomatis per jenis event POS (Fase 8). Satu baris per
> eventType: ORDER_READY | PAYMENT_DUE | FOLLOWUP_DUE.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `eventType` | `String` | `event_type` | — |
| `enabled` | `Boolean` | _sama_ | — |
| `channelId` | `Int?` | `channel_id` | — |
| `templateId` | `Int?` | `template_id` | WaTemplate APPROVED yang dipakai |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |

### WaReminderLog — `wa_reminder_logs`

> Log + dedup reminder terkirim (1 reminder per event per referensi).

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `eventType` | `String` | `event_type` | — |
| `refId` | `Int` | `ref_id` | id transaksi / follow-up |
| `contactId` | `Int?` | `contact_id` | — |
| `waMessageId` | `String?` | `wa_message_id` | — |
| `status` | `String` | _sama_ | SENT \| SKIPPED \| FAILED |
| `detail` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@unique([eventType, refId])`

### WaTemplate — `wa_templates`

> Template pesan resmi Meta (Fase 5). Dipakai untuk balasan di LUAR jendela 24
> jam & broadcast. CATATAN: template bersifat per-WABA; MVP menyimpan satu status
> (WABA tempat terakhir submit di submittedWabaId). Bila multi-WABA, submit ulang
> per WABA. `MessageTemplate` lama (crm) untuk teks internal bebas tetap terpisah.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `name` | `String` | _sama_ | nama Meta: a-z 0-9 _ (snake_case) |
| `language` | `String` | _sama_ | — |
| `category` | `String` | _sama_ | MARKETING\|UTILITY\|AUTHENTICATION |
| `status` | `WaTemplateStatus` | _sama_ | — |
| `bodyText` | `String` | `body_text` | placeholder {{1}}, {{2}} |
| `headerText` | `String?` | `header_text` | — |
| `footerText` | `String?` | `footer_text` | — |
| `buttonsJson` | `Json?` | `buttons_json` | — |
| `variableSample` | `Json?` | `variable_sample` | contoh nilai variabel utk preview |
| `variableLabels` | `Json?` | `variable_labels` | keterangan tiap variabel {{1}},{{2}} (untuk tim) |
| `metaTemplateId` | `String?` | `meta_template_id` | — |
| `submittedWabaId` | `String?` | `submitted_waba_id` | — |
| `rejectedReason` | `String?` | `rejected_reason` | — |
| `createdById` | `Int?` | `created_by_id` | — |
| `createdAt` | `DateTime` | `created_at` | — |
| `updatedAt` | `DateTime` | `updated_at` | — |
| `broadcasts` | `WaBroadcast[]` | _sama_ | — |

Indeks & kunci: `@@unique([name, language])`

### WaWebhookEvent — `wa_webhook_events`

> Log mentah webhook Meta (audit + retry aman). Bukan idempotensi (bisa banyak
> status per pesan) — dedup pembuatan pesan pakai WaMessage.waMessageId.

| Kolom | Tipe | Kolom MySQL | Keterangan |
|---|---|---|---|
| `id` | `Int` | _sama_ | — |
| `eventType` | `String` | `event_type` | "message" \| "status" |
| `waMessageId` | `String?` | `wa_message_id` | — |
| `payloadJson` | `Json` | `payload_json` | — |
| `processed` | `Boolean` | _sama_ | — |
| `error` | `String?` | _sama_ | — |
| `createdAt` | `DateTime` | `created_at` | — |

Indeks & kunci: `@@index([processed])`

---

## Himpunan nilai (enum)

- **BranchWorkOrderStatus**: `ANTRIAN` · `PROSES` · `SELESAI` · `DIBATALKAN`
- **CashflowType**: `INCOME` · `EXPENSE`
- **ChangeRequestStatus**: `PENDING` · `APPROVED` · `REJECTED`
- **ChangeRequestType**: `EDIT` · `DELETE`
- **ClickColorMode**: `COLOR` · `BW`
- **ClickPaperSize**: `A3_PLUS` · `A4`
- **ClickSideMode**: `SIMPLEX` · `DUPLEX`
- **CounterType**: `FULL_COLOR` · `BLACK` · `SINGLE_COLOR`
- **EditRequestStatus**: `PENDING` · `APPROVED` · `REJECTED`
- **FollowUpStatus**: `PENDING` · `DONE` · `SKIPPED`
- **FollowUpType**: `LEAD_FU` · `AFTER_SALES` · `REPEAT_ORDER` · `PAYMENT_REMINDER`
- **InvoiceStatus**: `DRAFT` · `SENT` · `PAID` · `CANCELLED` · `ACCEPTED` · `REJECTED` · `EXPIRED`
- **InvoiceType**: `INVOICE` · `QUOTATION`
- **LeadLevel**: `HOT` · `WARM` · `COLD`
- **LeadSource**: `WHATSAPP` · `INSTAGRAM` · `FACEBOOK` · `TIKTOK` · `MARKETPLACE` · `REFERRAL` · `WEBSITE` · `WALK_IN` · `REPEAT_ORDER` · `OTHER` · `CUSTOM`
- **LeadStatus**: `NEW` · `FOLLOW_UP` · `NEGOTIATION` · `CLOSED_WON` · `CLOSED_LOST` · `INVALID`
- **MovementType**: `IN` · `OUT` · `ADJUST`
- **OpnameStatus**: `ONGOING` · `COMPLETED` · `CANCELLED`
- **PaymentMethod**: `CASH` · `QRIS` · `BANK_TRANSFER`
- **PricingMode**: `UNIT` · `AREA_BASED` · `COMPOSITE`
- **PrintJobStatus**: `ANTRIAN` · `PROSES` · `SELESAI` · `DIAMBIL`
- **ProductionMeasure**: `AREA` · `PCS`
- **ProductionSource**: `CETAK` · `PRODUKSI`
- **ProductType**: `SELLABLE` · `RAW_MATERIAL` · `SERVICE`
- **RejectCause**: `MACHINE` · `HUMAN`
- **RejectType**: `MACHINE_ERROR` · `TEST_PRINT` · `CALIBRATION` · `HUMAN_ERROR`
- **SalesOrderStatus**: `DRAFT` · `SENT` · `INVOICED` · `CANCELLED`
- **SocialDirection**: `INBOUND` · `OUTBOUND`
- **SocialPlatform**: `MESSENGER` · `INSTAGRAM`
- **TransactionStatus**: `PENDING` · `PARTIAL` · `PAID` · `FAILED`
- **WaAutoReplyTrigger**: `KEYWORD` · `GREETING` · `AWAY` · `DEFAULT`
- **WaBroadcastStatus**: `DRAFT` · `SCHEDULED` · `RUNNING` · `PAUSED` · `COMPLETED` · `FAILED` · `CANCELLED`
- **WaConversationStatus**: `OPEN` · `PENDING` · `SNOOZED` · `CLOSED`
- **WaDirection**: `INBOUND` · `OUTBOUND`
- **WaMessageStatus**: `QUEUED` · `SENT` · `DELIVERED` · `READ` · `FAILED`
- **WaMessageType**: `TEXT` · `IMAGE` · `DOCUMENT` · `AUDIO` · `VIDEO` · `STICKER` · `TEMPLATE` · `LOCATION` · `CONTACT` · `INTERACTIVE` · `UNKNOWN`
- **WaRecipientStatus**: `PENDING` · `SENT` · `DELIVERED` · `READ` · `FAILED` · `SKIPPED`
- **WaTemplateStatus**: `DRAFT` · `PENDING` · `APPROVED` · `REJECTED` · `PAUSED` · `DISABLED`

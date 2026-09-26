# 🧭 Referensi Halaman

> Dibangkitkan otomatis oleh `tools/gen-wiki-referensi.js` — jangan disunting tangan.
> Jalankan ulang skripnya setelah menambah fitur.


**106 halaman** di aplikasi. **56** di antaranya punya menu di sidebar;
sisanya dibuka dari dalam halaman lain (detail, form), lewat PIN (papan kerja),
atau memang halaman publik tanpa login.

| Jalur | Menu | Kelompok menu | Batas peran | Berkas |
|---|---|---|---|---|
| `/` | Dashboard | (tautan atas) | — | `frontend/src/app/page.tsx` |
| `/articles` | Artikel | Landing Page | — | `frontend/src/app/articles/page.tsx` |
| `/articles/edit/[id]` | — | — | — | `frontend/src/app/articles/edit/[id]/page.tsx` |
| `/artikel` | — | — | — | `frontend/src/app/artikel/page.tsx` |
| `/artikel/[slug]` | — | — | — | `frontend/src/app/artikel/[slug]/page.tsx` |
| `/beranda` | Beranda Saya | Tim & Kinerja | — | `frontend/src/app/beranda/page.tsx` |
| `/branch-ledger` | Buku Titipan | Produksi & Cetak | — | `frontend/src/app/branch-ledger/page.tsx` |
| `/branch-orders` | Order Cabang | Pelanggan & Order | — | `frontend/src/app/branch-orders/page.tsx` |
| `/branch-orders/[id]` | — | — | — | `frontend/src/app/branch-orders/[id]/page.tsx` |
| `/branch-orders/new` | — | — | — | `frontend/src/app/branch-orders/new/page.tsx` |
| `/cashflow` | Cashflow Bisnis | Penjualan & Keuangan | — | `frontend/src/app/cashflow/page.tsx` |
| `/cetak` | — | — | — | `frontend/src/app/cetak/page.tsx` |
| `/click-counting` | Klik Mesin Cetak | Produksi & Cetak | — | `frontend/src/app/click-counting/page.tsx` |
| `/crm` | CRM Dashboard | Pelanggan & Order | — | `frontend/src/app/crm/page.tsx` |
| `/crm/follow-ups` | Tugas Follow-up | Pelanggan & Order | — | `frontend/src/app/crm/follow-ups/page.tsx` |
| `/crm/leads` | Leads CRM | Pelanggan & Order | — | `frontend/src/app/crm/leads/page.tsx` |
| `/crm/social` | Inbox Sosial (IG/FB) | WhatsApp CRM | — | `frontend/src/app/crm/social/page.tsx` |
| `/crm/templates` | Template Pesan | Pelanggan & Order | — | `frontend/src/app/crm/templates/page.tsx` |
| `/crm/whatsapp` | Inbox Chat | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/page.tsx` |
| `/crm/whatsapp/analytics` | Analitik | WhatsApp CRM | Manajer+ | `frontend/src/app/crm/whatsapp/analytics/page.tsx` |
| `/crm/whatsapp/auto-reply` | Balasan Otomatis | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/auto-reply/page.tsx` |
| `/crm/whatsapp/broadcast` | Broadcast | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/broadcast/page.tsx` |
| `/crm/whatsapp/catalog` | Katalog Produk | WhatsApp CRM | Manajer+ | `frontend/src/app/crm/whatsapp/catalog/page.tsx` |
| `/crm/whatsapp/qr` | QR Chat | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/qr/page.tsx` |
| `/crm/whatsapp/quick-replies` | Pesan Cepat | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/quick-replies/page.tsx` |
| `/crm/whatsapp/reminders` | Reminder POS | WhatsApp CRM | Manajer+ | `frontend/src/app/crm/whatsapp/reminders/page.tsx` |
| `/crm/whatsapp/settings` | Pengaturan Channel | WhatsApp CRM | Manajer+ | `frontend/src/app/crm/whatsapp/settings/page.tsx` |
| `/crm/whatsapp/templates` | Template Meta | WhatsApp CRM | — | `frontend/src/app/crm/whatsapp/templates/page.tsx` |
| `/customers` | Data Pelanggan | Pelanggan & Order | — | `frontend/src/app/customers/page.tsx` |
| `/desainer` | Studio Desain | (tautan atas) | — | `frontend/src/app/desainer/page.tsx` |
| `/hapus-data` | — | — | — | `frontend/src/app/hapus-data/page.tsx` |
| `/help` | — | — | — | `frontend/src/app/help/page.tsx` |
| `/inventory` | Manajemen Stok | Inventori & Stok | — | `frontend/src/app/inventory/page.tsx` |
| `/inventory/categories` | — | — | — | `frontend/src/app/inventory/categories/page.tsx` |
| `/inventory/opname` | Stok Opname | Inventori & Stok | — | `frontend/src/app/inventory/opname/page.tsx` |
| `/inventory/products/[id]/edit` | — | — | — | `frontend/src/app/inventory/products/[id]/edit/page.tsx` |
| `/inventory/products/new` | — | — | — | `frontend/src/app/inventory/products/new/page.tsx` |
| `/inventory/suppliers` | Data Supplier | Inventori & Stok | — | `frontend/src/app/inventory/suppliers/page.tsx` |
| `/inventory/transfer` | Transfer Stok Cabang | Inventori & Stok | — | `frontend/src/app/inventory/transfer/page.tsx` |
| `/inventory/units` | — | — | — | `frontend/src/app/inventory/units/page.tsx` |
| `/invoices` | Invoice & Penawaran | Pelanggan & Order | — | `frontend/src/app/invoices/page.tsx` |
| `/kebijakan-privasi` | — | — | — | `frontend/src/app/kebijakan-privasi/page.tsx` |
| `/landing` | — | — | — | `frontend/src/app/landing/page.tsx` |
| `/landing-builder` | — | — | — | `frontend/src/app/landing-builder/page.tsx` |
| `/landing-page` | Landing Page | Landing Page | — | `frontend/src/app/landing-page/page.tsx` |
| `/leaderboard` | Leaderboard | Tim & Kinerja | — | `frontend/src/app/leaderboard/page.tsx` |
| `/login` | — | — | — | `frontend/src/app/login/page.tsx` |
| `/maps` | Peta Cuan Lokasi | Analisa & Kalkulator | — | `frontend/src/app/maps/page.tsx` |
| `/marketing` | — | — | — | `frontend/src/app/marketing/page.tsx` |
| `/nilai/[token]` | — | — | — | `frontend/src/app/nilai/[token]/page.tsx` |
| `/nilai/cabang/[branchId]` | — | — | — | `frontend/src/app/nilai/cabang/[branchId]/page.tsx` |
| `/opname/[token]` | — | — | — | `frontend/src/app/opname/[token]/page.tsx` |
| `/owner` | Dashboard Owner | (tautan atas) | Owner | `frontend/src/app/owner/page.tsx` |
| `/owner/akses-menu` | — | — | — | `frontend/src/app/owner/akses-menu/page.tsx` |
| `/owner/analisa-keuangan` | — | — | — | `frontend/src/app/owner/analisa-keuangan/page.tsx` |
| `/owner/hpp-produk` | Rumus HPP per Produk | Analisa & Kalkulator | Owner | `frontend/src/app/owner/hpp-produk/page.tsx` |
| `/owner/iklan` | Iklan Meta | WhatsApp CRM | Owner | `frontend/src/app/owner/iklan/page.tsx` |
| `/owner/laporan-bulanan` | — | — | — | `frontend/src/app/owner/laporan-bulanan/page.tsx` |
| `/p/[id]` | — | — | — | `frontend/src/app/p/[id]/page.tsx` |
| `/pos` | Kasir POS | Penjualan & Keuangan | — | `frontend/src/app/pos/page.tsx` |
| `/pos/close-shift` | — | — | — | `frontend/src/app/pos/close-shift/page.tsx` |
| `/print-queue` | Antrian Cetak Paper | Produksi & Cetak | — | `frontend/src/app/print-queue/page.tsx` |
| `/produksi` | Antrian Produksi | Produksi & Cetak | — | `frontend/src/app/produksi/page.tsx` |
| `/produksi/board` | — | — | — | `frontend/src/app/produksi/board/page.tsx` |
| `/produksi/pipeline` | Pipeline Produksi | Produksi & Cetak | — | `frontend/src/app/produksi/pipeline/page.tsx` |
| `/reports/hpp` | Kalkulator HPP | Analisa & Kalkulator | — | `frontend/src/app/reports/hpp/page.tsx` |
| `/reports/inter-branch-usage` | Laporan Bahan Titipan | Inventori & Stok | — | `frontend/src/app/reports/inter-branch-usage/page.tsx` |
| `/reports/profit` | Laporan Laba Kotor | Penjualan & Keuangan | — | `frontend/src/app/reports/profit/page.tsx` |
| `/reports/sales` | Rekap Penjualan | Penjualan & Keuangan | — | `frontend/src/app/reports/sales/page.tsx` |
| `/reports/shift-history` | Riwayat Tutup Shift | Penjualan & Keuangan | — | `frontend/src/app/reports/shift-history/page.tsx` |
| `/reports/stock` | Laporan Stok | Inventori & Stok | — | `frontend/src/app/reports/stock/page.tsx` |
| `/reports/tutup-buku` | Tutup Buku Bulanan | Penjualan & Keuangan | Manajer+ | `frontend/src/app/reports/tutup-buku/page.tsx` |
| `/sales-orders` | Sales Order | Pelanggan & Order | — | `frontend/src/app/sales-orders/page.tsx` |
| `/sales-orders/[id]` | — | — | — | `frontend/src/app/sales-orders/[id]/page.tsx` |
| `/sales-orders/new` | — | — | — | `frontend/src/app/sales-orders/new/page.tsx` |
| `/settings` | — | — | — | `frontend/src/app/settings/page.tsx` |
| `/settings/akses-menu` | — | — | — | `frontend/src/app/settings/akses-menu/page.tsx` |
| `/settings/backup` | — | — | — | `frontend/src/app/settings/backup/page.tsx` |
| `/settings/bank-accounts` | — | — | — | `frontend/src/app/settings/bank-accounts/page.tsx` |
| `/settings/branch-config` | — | — | — | `frontend/src/app/settings/branch-config/page.tsx` |
| `/settings/branches` | — | — | — | `frontend/src/app/settings/branches/page.tsx` |
| `/settings/designers` | — | — | — | `frontend/src/app/settings/designers/page.tsx` |
| `/settings/discord` | — | — | — | `frontend/src/app/settings/discord/page.tsx` |
| `/settings/general` | — | — | — | `frontend/src/app/settings/general/page.tsx` |
| `/settings/langganan` | — | — | — | `frontend/src/app/settings/langganan/page.tsx` |
| `/settings/login` | — | — | — | `frontend/src/app/settings/login/page.tsx` |
| `/settings/notifications` | — | — | — | `frontend/src/app/settings/notifications/page.tsx` |
| `/settings/payments` | — | — | — | `frontend/src/app/settings/payments/page.tsx` |
| `/settings/printer` | — | — | — | `frontend/src/app/settings/printer/page.tsx` |
| `/settings/users` | — | — | — | `frontend/src/app/settings/users/page.tsx` |
| `/settings/whatsapp` | — | — | — | `frontend/src/app/settings/whatsapp/page.tsx` |
| `/so-designer` | — | — | — | `frontend/src/app/so-designer/page.tsx` |
| `/so-designer/dashboard` | — | — | — | `frontend/src/app/so-designer/dashboard/page.tsx` |
| `/so-designer/detail/[id]` | — | — | — | `frontend/src/app/so-designer/detail/[id]/page.tsx` |
| `/so-designer/new` | — | — | — | `frontend/src/app/so-designer/new/page.tsx` |
| `/titipan-keluar` | Titipan Keluar | Produksi & Cetak | — | `frontend/src/app/titipan-keluar/page.tsx` |
| `/titipan-masuk` | Titipan Masuk | Produksi & Cetak | — | `frontend/src/app/titipan-masuk/page.tsx` |
| `/transactions/[id]` | — | — | — | `frontend/src/app/transactions/[id]/page.tsx` |
| `/transactions/dp` | DP / Piutang | Penjualan & Keuangan | — | `frontend/src/app/transactions/dp/page.tsx` |
| `/transactions/edit-requests` | Permintaan Edit | Pelanggan & Order | Manajer+ | `frontend/src/app/transactions/edit-requests/page.tsx` |
| `/tugas` | Papan Tugas | Tim & Kinerja | — | `frontend/src/app/tugas/page.tsx` |
| `/tugas/grup` | Grup Tim | Tim & Kinerja | Manajer+ | `frontend/src/app/tugas/grup/page.tsx` |
| `/tugas/jadwal` | Jadwal Tugas | Tim & Kinerja | Manajer+ | `frontend/src/app/tugas/jadwal/page.tsx` |
| `/tugas/pantau` | Pantau Piket | Tim & Kinerja | Manajer+ | `frontend/src/app/tugas/pantau/page.tsx` |
| `/tugas/papan-piket` | Papan Piket | Tim & Kinerja | — | `frontend/src/app/tugas/papan-piket/page.tsx` |
| `/tv/leaderboard` | — | — | — | `frontend/src/app/tv/leaderboard/page.tsx` |

## Halaman tanpa menu

Biasanya salah satu dari: halaman detail/form yang dibuka dari daftar,
papan kerja ber-PIN, atau halaman publik.

- `/articles/edit/[id]` _(jalur dinamis)_
- `/artikel`
- `/artikel/[slug]` _(jalur dinamis)_
- `/branch-orders/[id]` _(jalur dinamis)_
- `/branch-orders/new`
- `/cetak`
- `/hapus-data`
- `/help`
- `/inventory/categories`
- `/inventory/products/[id]/edit` _(jalur dinamis)_
- `/inventory/products/new`
- `/inventory/units`
- `/kebijakan-privasi`
- `/landing`
- `/landing-builder`
- `/login`
- `/marketing`
- `/nilai/[token]` _(jalur dinamis)_
- `/nilai/cabang/[branchId]` _(jalur dinamis)_
- `/opname/[token]` _(jalur dinamis)_
- `/owner/akses-menu`
- `/owner/analisa-keuangan`
- `/owner/laporan-bulanan`
- `/p/[id]` _(jalur dinamis)_
- `/pos/close-shift`
- `/produksi/board`
- `/sales-orders/[id]` _(jalur dinamis)_
- `/sales-orders/new`
- `/settings`
- `/settings/akses-menu`
- `/settings/backup`
- `/settings/bank-accounts`
- `/settings/branch-config`
- `/settings/branches`
- `/settings/designers`
- `/settings/discord`
- `/settings/general`
- `/settings/langganan`
- `/settings/login`
- `/settings/notifications`
- `/settings/payments`
- `/settings/printer`
- `/settings/users`
- `/settings/whatsapp`
- `/so-designer`
- `/so-designer/dashboard`
- `/so-designer/detail/[id]` _(jalur dinamis)_
- `/so-designer/new`
- `/transactions/[id]` _(jalur dinamis)_
- `/tv/leaderboard`

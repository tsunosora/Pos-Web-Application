# Notifikasi Discord

Kirim event penting toko ke channel Discord lewat **webhook**, dengan **multi-channel** dan **toggle per-event**, diatur dari `Pengaturan › Discord` (`/settings/discord`).

> Berbeda dari integrasi Discord lama di `Pengaturan › Notifikasi` (yang khusus notif commit GitHub & low-stock sederhana). Sistem ini lebih lengkap dan terstruktur per channel.

## Channel

Buat 1 webhook Discord untuk tiap channel (di Discord: *Channel Settings › Integrations › Webhooks › New Webhook*), lalu tempel URL-nya:

| Channel | Isi |
|---|---|
| `#penjualan` | Transaksi & deal closing |
| `#produksi` | Pesanan siap diambil |
| `#keuangan` | Rekap tutup shift |
| `#stok-gudang` | Stok menipis |
| `#leaderboard` | Pengumuman juara CS |
| `#sistem` | Backup & error |

Channel yang URL-nya dikosongkan akan otomatis dilewati. Gunakan tombol **Test** di tiap channel untuk memverifikasi.

## Event (Tier 1 + Juara)

| Event | Channel | Pemicu |
|---|---|---|
| Rekap Tutup Shift | keuangan | Saat kasir tutup shift |
| Lead Baru Masuk | penjualan | Setiap lead baru dibuat (real-time) |
| Deal Closing Baru | penjualan | Lead di-convert (CLOSED_WON) |
| Pesanan Siap Diambil | produksi | Job cetak selesai (SELESAI) |
| Stok Menipis | stok-gudang | Stok ≤ batas minimum setelah transaksi |
| Status Backup | sistem | Backup otomatis berhasil/gagal |
| Error Sistem | sistem | Error server (≥500) — throttle 60 detik |
| Pengumuman Juara | leaderboard | Otomatis tiap **Senin 08:00 WIB** (cron) + manual via `POST /crm/kpi/discord-recap` |

Semua event **default aktif**. Master switch di atas halaman mematikan seluruh notifikasi Discord sekaligus.

**Juara leaderboard**: 👑 Sultan Cuan (omzet lead + walk-in POS), 🔥 Raja Lead (lead terbanyak), 🎯 Sniper Closing (closing rate tertinggi, min 3 lead).

## Aktivasi (developer)

Konfigurasi tersimpan di tabel `discord_config`. Setelah menarik perubahan ini:

```bash
cd backend
# hentikan backend dulu (agar Prisma Client bisa di-generate ulang)
npx prisma generate
# jalankan backend lagi
```

Tanpa `prisma generate` + restart, endpoint config akan error karena model `DiscordConfig` belum ada di Prisma Client.

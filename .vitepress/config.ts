import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PosPro',
  description: 'Dokumentasi lengkap PosPro — Aplikasi Kasir & Manajemen Toko Berbasis Web',
  srcDir: 'docs/wiki',
  base: '/Pos-Web-Application/',

  head: [
    ['link', { rel: 'icon', href: '/Pos-Web-Application/favicon.ico' }],
  ],

  themeConfig: {
    siteTitle: 'PosPro Docs',

    nav: [
      { text: 'Mulai di Sini', link: '/alur-bisnis' },
      { text: 'Wiki Lengkap', link: '/' },
      { text: 'v5.1', items: [{ text: 'Lihat Daftar Isi', link: '/#daftar-isi-wiki' }] },
    ],

    sidebar: [
      {
        text: '📖 Panduan Awal',
        items: [
          { text: '🚀 Tur Singkat (12 Layar)', link: '/tur-singkat' },
          { text: 'Beranda', link: '/' },
          { text: 'Wiki Lengkap (Daftar Isi)', link: '/README' },
          { text: '🔄 Alur Bisnis', link: '/alur-bisnis' },
          { text: '📅 Contoh Alur 1 Hari CS', link: '/contoh-alur-cs-harian' },
        ]
      },
      {
        text: '🛒 Kasir & Penjualan',
        items: [
          { text: '🛒 Kasir POS', link: '/kasir-pos' },
          { text: '🔒 Tutup Shift', link: '/tutup-shift' },
          { text: '💳 DP & Piutang', link: '/dp-piutang' },
          { text: '📊 Laporan Penjualan', link: '/laporan-penjualan' },
          { text: '📄 Invoice & SPH (B2B)', link: '/invoice-sph' },
          { text: '🧾 Nota Thermal 58mm', link: '/nota-thermal-58mm' },
        ]
      },
      {
        text: '🏷️ Produk & Stok',
        items: [
          { text: '🏷️ Katalog Produk & Harga', link: '/katalog-produk' },
          { text: '📦 Stok Masuk, Transfer & Mutasi', link: '/stok-masuk-transfer' },
          { text: '📊 Laporan Stok', link: '/laporan-stok' },
          { text: '📋 Stok Opname', link: '/stock-opname' },
          { text: '🏭 Data Supplier', link: '/suppliers' },
          { text: '🧮 Kalkulator HPP', link: '/hpp-calculator' },
        ]
      },
      {
        text: '🖨️ Produksi & Cetak',
        items: [
          { text: '🖨️ Antrian Produksi', link: '/produksi' },
          { text: '🖨️ Mesin Cetak & Antrian Paper', link: '/mesin-cetak' },
          { text: '🎨 Sales Order & Designer', link: '/sales-orders' },
          { text: '🖨️ Printer Relay Agent', link: '/printer-relay-agent' },
        ]
      },
      {
        text: '🏢 Multi-Cabang',
        items: [
          { text: '🏢 Mode Cabang', link: '/mode-cabang' },
          { text: '🔁 Titip Cetak Antar Cabang', link: '/titip-cetak' },
          { text: '📒 Buku Titipan (Ledger)', link: '/buku-titipan' },
        ]
      },
      {
        text: '👥 Tim & Kinerja',
        items: [
          { text: '🧹 Papan Tugas & Piket', link: '/papan-tugas-piket' },
          { text: '👥 Akun & PIN Karyawan', link: '/karyawan-akun-pin' },
          { text: '🗓️ Absensi & Portal HR', link: '/absensi-hr' },
          { text: '🏆 Leaderboard & Metrik Custom', link: '/leaderboard' },
          { text: '⭐ Penilaian Pelayanan (CS)', link: '/rating-cs' },
        ]
      },
      {
        text: '💬 CRM & Pemasaran',
        items: [
          { text: '🎯 CRM — Lead & Follow-Up', link: '/crm' },
          { text: '💬 WhatsApp CRM (Cloud API)', link: '/whatsapp-cloud' },
          { text: '📣 Inbox Sosial & Iklan Meta', link: '/sosial-iklan' },
          { text: '📥 Inbox Sosial (DM & Komentar)', link: '/inbox-sosial' },
          { text: '🔌 Menghubungkan Meta', link: '/hubungkan-meta' },
          { text: '🎨 Studio Desain AI', link: '/studio-ai' },
          { text: '🏪 Landing Page Builder', link: '/landing' },
          { text: '📰 Artikel / Blog', link: '/artikel' },
          { text: '🗺️ Peta Cuan Lokasi', link: '/peta-cuan' },
        ]
      },
      {
        text: '💰 Keuangan',
        items: [
          { text: '💸 Cashflow Bisnis', link: '/cashflow' },
          { text: '📈 Keuangan Owner', link: '/keuangan-owner' },
          { text: '📜 Riwayat Tutup Shift', link: '/riwayat-shift' },
        ]
      },
      {
        text: '⚙️ Pengaturan & Teknis',
        items: [
          { text: '⚙️ Pengaturan', link: '/pengaturan' },
          { text: '🖥️ Antarmuka & Fitur Kecil', link: '/antarmuka' },
          { text: '📣 Dashboard Marketing', link: '/marketing' },
          { text: '🔔 Notifikasi Real-Time', link: '/notifications' },
          { text: '🤖 Notifikasi Discord', link: '/discord' },
          { text: '💾 Backup & Restore', link: '/backup' },
          { text: '🚀 Panduan Deployment', link: '/deployment' },
          { text: '🖥️ Aplikasi Desktop Offline', link: '/desktop-offline' },
          { text: '💻 Setup Pengembangan Lokal', link: '/setup-lokal' },
          { text: '🌐 Halaman Publik', link: '/halaman-publik' },
          { text: '🔐 Model Akses & Keamanan', link: '/keamanan-akses' },
        ]
      },
      {
        text: '📚 Referensi (dari kode)',
        collapsed: true,
        items: [
          { text: '📡 Endpoint API', link: '/referensi-endpoint' },
          { text: '🗄️ Basis Data', link: '/referensi-basis-data' },
          { text: '🧭 Halaman Aplikasi', link: '/referensi-halaman' },
          { text: '⚙️ Env & Pekerjaan Terjadwal', link: '/referensi-env-cron' },
        ]
      },
      {
        text: '📢 Arsip',
        collapsed: true,
        items: [
          { text: 'Pengumuman v3.3 (CRM)', link: '/discord-announcement-v3.3' },
        ]
      }
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Cari dokumentasi...',
                buttonAriaLabel: 'Cari'
              },
              modal: {
                noResultsText: 'Tidak ada hasil untuk',
                resetButtonTitle: 'Reset pencarian',
                footer: {
                  selectText: 'pilih',
                  navigateText: 'navigasi',
                  closeText: 'tutup'
                }
              }
            }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tsunosora/Pos-Web-Application' }
    ],

    footer: {
      message: 'PosPro — Aplikasi Kasir & Manajemen Toko Berbasis Web',
      copyright: 'VOLIKO IMOGIRI © 2026'
    },

    editLink: {
      pattern: 'https://github.com/tsunosora/Pos-Web-Application/edit/main/docs/wiki/:path',
      text: 'Edit halaman ini di GitHub'
    },

    lastUpdated: {
      text: 'Terakhir diperbarui',
      formatOptions: {
        dateStyle: 'long',
      }
    },

    docFooter: {
      prev: 'Halaman Sebelumnya',
      next: 'Halaman Berikutnya'
    },

    outline: {
      label: 'Di halaman ini',
      level: [2, 3]
    },

    returnToTopLabel: 'Kembali ke atas',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Mode Terang',
    darkModeSwitchTitle: 'Mode Gelap',
  },

  markdown: {
    lineNumbers: false,
  },
})

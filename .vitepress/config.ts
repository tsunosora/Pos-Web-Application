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
          { text: 'Beranda', link: '/' },
          { text: 'Wiki Lengkap (Daftar Isi)', link: '/README' },
          { text: '🔄 Alur Bisnis', link: '/alur-bisnis' },
        ]
      },
      {
        text: '🏪 Operasional Harian',
        items: [
          { text: '🖨️ Antrian Produksi', link: '/produksi' },
          { text: '🖨️ Antrian Cetak Paper', link: '/mesin-cetak' },
          { text: '📄 Invoice & SPH (B2B)', link: '/invoice-sph' },
          { text: '🎨 Sales Order & Designer', link: '/sales-orders' },
          { text: '🏭 Data Supplier', link: '/suppliers' },
          { text: '📋 Stok Opname', link: '/stock-opname' },
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
        text: '💰 Laporan & Keuangan',
        items: [
          { text: '💸 Cashflow Bisnis', link: '/cashflow' },
          { text: '📊 Laporan Stok', link: '/laporan-stok' },
          { text: '📜 Riwayat Tutup Shift', link: '/riwayat-shift' },
          { text: '🧮 Kalkulator HPP', link: '/hpp-calculator' },
          { text: '🗺️ Peta Cuan Lokasi', link: '/peta-cuan' },
        ]
      },
      {
        text: '⚙️ Pengaturan & Teknis',
        items: [
          { text: '💾 Backup & Restore', link: '/backup' },
          { text: '🚀 Panduan Deployment', link: '/deployment' },
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

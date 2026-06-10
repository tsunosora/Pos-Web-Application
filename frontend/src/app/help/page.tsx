"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft, BookOpen, Menu, X, ChevronDown,
    ShoppingCart, Package, Wallet, BarChart3, Printer,
    FileText, MessageSquare, Settings, HelpCircle,
    Banknote, Building2, CheckCircle, AlertCircle, Info,
    TrendingDown, Sparkles, Store,
} from "lucide-react";

// ─── Helper UI ────────────────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <h2
            id={id}
            className="scroll-mt-20 text-xl font-bold text-gray-900 mt-10 mb-4 pb-3 border-b border-gray-200"
        >
            {children}
        </h2>
    );
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
    return (
        <h3 id={id} className="scroll-mt-20 text-base font-semibold text-gray-800 mt-6 mb-3">
            {children}
        </h3>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-gray-600 leading-relaxed mb-3 text-[15px]">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
    return <ul className="list-disc list-inside space-y-1.5 text-gray-600 mb-4 text-[15px] pl-2">{children}</ul>;
}

function Code({ children }: { children: React.ReactNode }) {
    return (
        <code className="bg-gray-100 border border-gray-200 text-green-700 px-1.5 py-0.5 rounded text-[13px] font-mono">
            {children}
        </code>
    );
}

function Callout({
    type = "info",
    title,
    children,
}: {
    type?: "info" | "tip" | "warning" | "danger";
    title?: string;
    children: React.ReactNode;
}) {
    const cfg = {
        info: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-800", icon: <Info size={15} className="flex-shrink-0 mt-0.5" /> },
        tip: { bg: "bg-green-50", border: "border-green-400", text: "text-green-800", icon: <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> },
        warning: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800", icon: <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> },
        danger: { bg: "bg-red-50", border: "border-red-400", text: "text-red-800", icon: <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> },
    };
    const c = cfg[type];
    return (
        <div className={`${c.bg} ${c.border} border-l-4 rounded-r-lg p-4 mb-4`}>
            <div className={`flex gap-2 ${c.text} text-sm`}>
                {c.icon}
                <div>
                    {title && <div className="font-semibold mb-0.5">{title}</div>}
                    {children}
                </div>
            </div>
        </div>
    );
}

function Table({
    headers,
    rows,
}: {
    headers: string[];
    rows: (string | React.ReactNode)[][];
}) {
    return (
        <div className="overflow-x-auto mb-6 rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-gray-50">
                        {headers.map((h, i) => (
                            <th
                                key={i}
                                className="border-b border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 even:bg-gray-50/40 hover:bg-green-50/50 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-2.5 text-gray-600 align-top">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Steps({ steps }: { steps: { title: string; desc?: React.ReactNode }[] }) {
    return (
        <div className="space-y-3 mb-6">
            {steps.map((s, i) => (
                <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                    </div>
                    <div>
                        <div className="font-medium text-gray-800 text-sm">{s.title}</div>
                        {s.desc && <div className="text-gray-500 text-sm mt-0.5">{s.desc}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function SecPengantar() {
    return (
        <>
            <div className="mb-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                        <Store className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Panduan PosPro</h1>
                        <p className="text-sm text-gray-500">Manual book lengkap untuk operator, kasir, dan pemilik toko</p>
                    </div>
                </div>
                <P>
                    <strong>PosPro</strong> adalah aplikasi kasir berbasis web untuk bisnis modern — percetakan digital, toko kelontong,
                    kafe, konveksi, atau usaha jasa. Tidak perlu install aplikasi tambahan; cukup buka browser dan langsung bisa digunakan.
                </P>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                        { icon: "🛒", label: "Kasir POS" },
                        { icon: "📦", label: "Stok & Inventori" },
                        { icon: "🖨️", label: "Antrian Produksi" },
                        { icon: "📊", label: "Laporan & Keuangan" },
                        { icon: "📄", label: "Invoice & SPH" },
                        { icon: "🤖", label: "WhatsApp Bot" },
                        { icon: "🏢", label: "Multi-Cabang" },
                        { icon: "🎯", label: "CRM & Follow-Up" },
                    ].map((f) => (
                        <div key={f.label} className="bg-white rounded-lg p-3 text-center border border-green-100">
                            <div className="text-xl mb-1">{f.icon}</div>
                            <div className="text-xs font-medium text-gray-600">{f.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <H2 id="setup">Setup Pertama Kali</H2>
            <P>Lakukan langkah-langkah ini <strong>sekali</strong> saat pertama kali menggunakan PosPro.</P>
            <Steps steps={[
                { title: "Profil Toko — /settings/general", desc: "Isi nama toko, alamat, telepon, upload logo. Atur tarif PPN dan PIN Operator untuk akses halaman Produksi." },
                { title: "Akun Pengguna — /settings/users", desc: "Buat akun untuk setiap kasir/staf. Role: Admin, Manager, Kasir, Owner." },
                { title: "Rekening Bank — /settings/bank-accounts", desc: "Daftarkan rekening bank untuk menerima transfer. Masing-masing muncul sebagai pilihan di kasir." },
                { title: "Produk & Inventori — /inventory", desc: "Buat kategori produk, input semua produk (biasa atau Area Based untuk cetak). Set HPP setiap varian agar laporan laba akurat." },
                { title: "Supplier — /inventory/suppliers (opsional)", desc: "Input data supplier dan harga beli per varian produk." },
                { title: "WhatsApp Bot — /settings/whatsapp", desc: "Scan QR Code untuk menghubungkan bot. Setup grup penerima laporan shift." },
            ]} />

            <H2 id="login">Login & Dashboard</H2>
            <P>
                Akses aplikasi di browser. Masukkan <strong>Email</strong> dan <strong>Password</strong>, klik <strong>Sign In</strong>.
                Jika sesi kadaluarsa (JWT expired), sistem otomatis redirect ke halaman login — keranjang kasir tetap aman di browser.
            </P>
            <Table
                headers={["Kartu Dashboard", "Keterangan"]}
                rows={[
                    ["Total Penjualan Hari Ini", "Jumlah uang masuk dari semua transaksi hari ini"],
                    ["Jumlah Transaksi", "Berapa kali terjadi penjualan"],
                    ["Produk Terjual", "Total item yang sudah laku"],
                    ["Saldo per Rekening", "Saldo terkini di setiap rekening bank terdaftar"],
                ]}
            />
        </>
    );
}

function SecKasir() {
    return (
        <>
            <H2 id="kasir">Kasir / POS</H2>
            <P>
                Halaman kasir (<Code>/pos</Code>) adalah inti aplikasi — tempat mencatat transaksi penjualan secara real-time.
            </P>

            <H3>Cara Bertransaksi</H3>
            <Steps steps={[
                { title: "Cari & Tambah Produk", desc: "Ketik nama produk di kotak pencarian, atau scan barcode (klik ikon kamera). Klik produk untuk masuk keranjang." },
                { title: "Atur Keranjang", desc: "Klik +/− untuk ubah jumlah. Produk Area Based otomatis menampilkan modal input Lebar × Tinggi. Produk bertanda ∞ bisa ditambah tanpa batas." },
                { title: "Atur Tagihan (Opsional)", desc: <>Isi <strong>Diskon</strong> (dikurangi dari subtotal) dan <strong>Ongkos Kirim</strong> (ditambah ke total). Formula: Subtotal − Diskon + Pajak + Ongkos Kirim.</> },
                { title: "Pilih Metode Pembayaran", desc: "Tunai, Transfer Bank, QRIS, KREDIT (nota kredit tanpa DP), atau BAYAR NANTI (simpan tanpa bayar)." },
                { title: "Isi Data Pelanggan", desc: "Ketik nama atau HP — dropdown dari database muncul otomatis. Pelanggan baru tersimpan otomatis." },
                { title: "Selesaikan Transaksi", desc: "Klik Konfirmasi Lunas / Konfirmasi DP / Simpan Nota Kredit / Simpan Invoice. Struk muncul otomatis — bisa cetak atau kirim WA." },
            ]} />

            <H3>Metode Pembayaran</H3>
            <Table
                headers={["Metode", "Keterangan"]}
                rows={[
                    ["Tunai (Cash)", "Masukkan nominal diterima — kembalian dihitung otomatis"],
                    ["Transfer Bank", "Pilih rekening tujuan dari daftar rekening toko"],
                    ["QRIS", "Tampilkan QR code ke pelanggan untuk dipindai"],
                    ["KREDIT", "Nota kredit tanpa uang muka — ada jatuh tempo (preset atau manual)"],
                    ["BAYAR NANTI", "Invoice tersimpan status PENDING — bayar nanti via menu Piutang"],
                ]}
            />
            <Callout type="tip" title="KREDIT vs DP">
                DP = pelanggan sudah bayar sebagian. KREDIT = belum ada pembayaran sama sekali, hanya nota + jatuh tempo.
            </Callout>

            <H3>Produk Digital Printing (Area Based)</H3>
            <Table
                headers={["Satuan", "Input", "Cocok untuk"]}
                rows={[
                    ["m (m²)", "Lebar × Tinggi dalam meter", "Harga per m² (standar percetakan)"],
                    ["cm (cm²)", "Lebar × Tinggi dalam cm", "Harga per cm²"],
                    ["menit", "Durasi di kolom lebar", "Jasa berbasis waktu"],
                ]}
            />

            <H3>Potongan Platform / Marketplace Fee</H3>
            <P>
                Untuk transaksi dari marketplace (Shopee, Tokopedia, dll) yang kena potongan platform, input potongan di bagian
                bawah form checkout POS sebelum konfirmasi.
            </P>
            <Steps steps={[
                { title: "Gulir ke bagian Potongan Platform di form checkout", desc: "Klik + Tambah Potongan." },
                { title: "Isi nama platform dan nominal", desc: <>Contoh: Shopee Rp 8.000, AdminFee Rp 2.000. Bisa tambah beberapa baris sekaligus.</> },
                { title: "Preview Nett muncul otomatis", desc: "Diterima (nett) = Grand Total − Total Potongan." },
                { title: "Konfirmasi Transaksi", desc: "Cashflow tercatat: INCOME sebesar nett yang diterima + EXPENSE Biaya Platform terpisah." },
            ]} />
            <Callout type="info" title="Cashflow Split Otomatis">
                Potongan marketplace TIDAK mengurangi Grand Total nota — harga closing ke pelanggan tetap utuh.
                Yang berubah hanya cashflow: income masuk sebesar yang benar-benar diterima, expense Biaya Platform dicatat terpisah.
            </Callout>

            <H3>Struk & Setelah Transaksi</H3>
            <Ul>
                <li>Struk muncul otomatis setelah transaksi selesai</li>
                <li>Klik <strong>Cetak</strong> untuk printer thermal — baris Diskon dan Ongkos Kirim muncul jika nilainya &gt; 0</li>
                <li>Klik <strong>Kirim WA</strong> untuk mengirim ringkasan ke WhatsApp pelanggan</li>
                <li>Status transaksi: <strong>LUNAS</strong> (hijau), <strong>DP / BELUM LUNAS</strong> (kuning), <strong>BELUM DIBAYAR</strong> (biru)</li>
            </Ul>
        </>
    );
}

function SecInventori() {
    return (
        <>
            <H2 id="inventori">Manajemen Produk & Stok</H2>
            <P>Kelola produk, varian, bahan baku, dan stok di <Code>/inventory</Code>.</P>

            <H3>Tipe Produk</H3>
            <Table
                headers={["Tipe", "Keterangan"]}
                rows={[
                    ["Produk Jual (SELLABLE)", "Dijual ke pelanggan — muncul di kasir"],
                    ["Bahan Baku (RAW_MATERIAL)", "Material produksi — TIDAK muncul di kasir, digunakan sebagai BOM"],
                    ["Jasa (SERVICE)", "Layanan tanpa stok fisik"],
                ]}
            />

            <H3>Cara Tambah Produk</H3>
            <Steps steps={[
                { title: "Klik + Tambah Produk", desc: "Tombol di pojok kanan atas." },
                { title: "Isi nama, kategori, satuan, harga jual", desc: "Pilih mode harga: Normal (per unit) atau Area Based (per m²/cm²/menit)." },
                { title: "Atur Lacak Stok", desc: "Aktif: stok terpotong otomatis. Nonaktif (∞): produk/jasa tanpa kontrol stok." },
                { title: "Upload foto produk (opsional)", desc: "Format JPG, PNG, WEBP, JFIF." },
                { title: "Tambahkan Varian (jika ada pilihan)", desc: "Ukuran, warna, jenis — stok dan harga bisa berbeda per varian." },
                { title: "Tambahkan Bahan Baku (BOM)", desc: "Stok bahan otomatis terpotong saat produk terjual." },
                { title: "Klik Simpan", desc: "" },
            ]} />

            <H3>Harga Bertingkat (Price Tiers)</H3>
            <P>Setiap varian bisa punya beberapa level harga berdasarkan qty. Contoh:</P>
            <Table
                headers={["Range Qty", "Harga per Unit"]}
                rows={[
                    ["1–5 pcs", "Rp 25.000"],
                    ["6–20 pcs", "Rp 22.000"],
                    ["21+ pcs", "Rp 18.000"],
                ]}
            />
            <P>Cara set: Edit Produk → Varian → klik <strong>+ Tambah Tier</strong>. Harga berubah otomatis di kasir sesuai qty.</P>

            <H3>Aksi di Kolom Tabel Inventori</H3>
            <Table
                headers={["Tombol", "Fungsi"]}
                rows={[
                    [<Code key="plus">+</Code>, "Tambah stok / catat stok masuk"],
                    ["ikon jam", "Lihat riwayat stok (Kartu Stok) lengkap"],
                    ["⋮ (kebab menu)", "Catat Susut, Edit Produk, Kalkulator HPP, Salin Link, Hapus"],
                ]}
            />

            <H3>Pembelian Bahan Baku</H3>
            <Steps steps={[
                { title: "Inventori → klik tombol Pembelian (hijau)", desc: "" },
                { title: "Pilih Supplier (opsional)", desc: "Harga beli terisi otomatis dari data supplier." },
                { title: "Isi No. Invoice & Catatan", desc: "" },
                { title: "Cari dan tambahkan produk ke keranjang", desc: "Atur jumlah dan harga beli per item." },
                { title: "Klik Simpan Pembelian", desc: "Stok semua item bertambah sekaligus." },
            ]} />

            <H3>Impor Massal (Bulk Import)</H3>
            <Steps steps={[
                { title: "Inventori → klik Import Excel", desc: "" },
                { title: "Download Template", desc: "File Excel dengan contoh dan panduan kolom." },
                { title: "Isi data produk", desc: "Nama, kategori, varian, harga, HPP, stok." },
                { title: "Upload file → lihat preview validasi", desc: "" },
                { title: "Klik Impor", desc: "Produk valid tersimpan; error per baris ditampilkan." },
            ]} />

            <H3>Stok Opname</H3>
            <P>
                Hitung fisik stok berkala di <Code>/inventory/opname</Code>. Admin membuat sesi opname dan bagikan link ke karyawan.
                Karyawan hitung stok via link tanpa perlu login. Setelah selesai, admin konfirmasi — selisih stok diupdate otomatis.
            </P>

            <H3>Data Supplier — /inventory/suppliers</H3>
            <Ul>
                <li>Input data supplier (nama, kontak, alamat)</li>
                <li>Hubungkan ke varian produk dengan harga beli per varian</li>
                <li>Saat pembelian bahan baku, pilih supplier → harga beli terisi otomatis</li>
                <li>Supplier Item bisa ada tanpa link ke varian produk (opsional)</li>
            </Ul>
        </>
    );
}

function SecPiutang() {
    return (
        <>
            <H2 id="piutang">DP & Piutang</H2>
            <P>Kelola semua transaksi belum lunas di <Code>/transactions/dp</Code>.</P>

            <H3>Tab Filter</H3>
            <Table
                headers={["Tab", "Keterangan", "Badge"]}
                rows={[
                    ["Semua", "Semua transaksi belum lunas", "—"],
                    ["DP", "Pelanggan bayar sebagian (uang muka)", "🟡 Kuning"],
                    ["Kredit", "Nota kredit — belum ada bayaran, ada jatuh tempo", "🟣 Ungu"],
                    ["Bayar Nanti", "Invoice tersimpan tanpa pembayaran", "🔵 Biru"],
                ]}
            />

            <H3>Informasi per Nota</H3>
            <Table
                headers={["Kolom", "Keterangan"]}
                rows={[
                    ["Total Tagihan", "Harga total transaksi"],
                    ["Sudah Dibayar", "Jumlah DP yang sudah masuk (0 untuk kredit/bayar nanti)"],
                    ["Sisa Tagihan", "Yang masih harus dilunasi"],
                    ["Jatuh Tempo", "Deadline pelunasan — merah jika sudah lewat"],
                ]}
            />

            <H3>Cara Mencatat Pelunasan</H3>
            <Steps steps={[
                { title: "Cari pelanggan di daftar piutang", desc: "Gunakan tab filter atau search." },
                { title: "Klik tombol Bayar → pilih Lunas Penuh", desc: "" },
                { title: "Isi Nominal Diterima (opsional)", desc: "Untuk menghitung kembalian." },
                { title: "Isi Potongan Platform jika ada (opsional)", desc: <>Klik <strong>+ Tambah</strong> di bagian Potongan Platform / Fee. Isi nama dan nominal per kategori potongan (Shopee, GoFood, dll). Preview nett langsung muncul.</> },
                { title: "Pilih Metode Pembayaran, Kasir & Waktu Checkout", desc: "Waktu bisa dibackdate." },
                { title: "Klik Proses Pelunasan", desc: "Sistem update sisa tagihan, catat ke Cashflow sebagai INCOME + EXPENSE Biaya Platform (jika ada fee)." },
            ]} />

            <Callout type="info">
                Setiap pelunasan dicatat di Cashflow dengan nomor checkout (SC-YYYYMMDD-XXXX) terpisah dari nomor nota asli.
                Jika ada potongan platform yang belum diisi saat transaksi awal, bisa diisi saat pelunasan — sistem otomatis menyimpan ke nota dan memisahkan cashflow.
            </Callout>
        </>
    );
}

function SecLaporan() {
    return (
        <>
            <H2 id="laporan-penjualan">Laporan Penjualan</H2>
            <P>Pusat analisis transaksi toko di <Code>/reports/sales</Code>. Filter periode berlaku untuk semua tab sekaligus.</P>
            <Table
                headers={["Tab", "Konten"]}
                rows={[
                    ["Ringkasan", "3 kartu metrik (Pendapatan, Volume, Basket Size), Top 5 Produk, Distribusi Metode Pembayaran"],
                    ["Trend Produk ⭐", "Ranking produk dengan badge tren ↑↓ vs periode sebelumnya, toggle Qty vs Revenue"],
                    ["Histori Log ⭐", "Tabel semua transaksi, search by nama/nomor invoice, expand detail item per baris"],
                ]}
            />
            <P><strong>Filter:</strong> Hari Ini / Kemarin / Minggu Ini / Bulan Ini / Bulan Lalu / Tahun Ini / Semua / Kustom.</P>
            <P><strong>Export Excel</strong> menyertakan kolom: Pelanggan, Ongkos Kirim, <strong>Potongan Marketplace</strong>, dan <strong>Diterima (Nett)</strong> — kolom nett otomatis kosong untuk transaksi tanpa potongan platform.</P>
            <P>Detail transaksi di tab Histori Log juga menampilkan breakdown potongan per kategori (Shopee, Tokopedia, dll) beserta total yang diterima nett.</P>

            <H2 id="tutup-shift">Tutup Shift</H2>
            <P>Rekonsiliasi kas akhir shift di <Code>/pos/close-shift</Code>.</P>
            <Steps steps={[
                { title: "Identitas Kasir", desc: "Pilih nama kasir dan jenis shift (Pagi / Siang / Long Shift)." },
                { title: "Panel Kiri — Data Sistem (Baca Saja)", desc: "Total pendapatan, rincian per metode bayar, dan Target Saldo Bank sudah terisi otomatis." },
                { title: "Panel Kanan — Aktual (Isi Kasir)", desc: "Hitung uang di laci → isi Uang Tunai. Buka aplikasi QRIS → isi total QRIS. Badge LEBIH/KURANG/BALANCE muncul otomatis." },
                { title: "Catat Pengeluaran Shift", desc: "Klik + Tambah Item → isi keterangan, nominal, metode bayar." },
                { title: "Saldo Rekening Bank", desc: "Buka mBanking masing-masing rekening → isi saldo aktual." },
                { title: "Lampirkan Foto & Kirim", desc: "Upload foto bukti (laci, QRIS, mBanking) maks. 20 foto. Klik Kirim Laporan Shift ke Discord." },
            ]} />
            <Callout type="tip">
                Riwayat semua laporan shift bisa dilihat, disalin, atau dikirim ulang di <Code>/reports/shift-history</Code>.
            </Callout>

            <H2 id="cashflow">Cashflow Bisnis</H2>
            <P>Arus kas pemasukan dan pengeluaran di <Code>/cashflow</Code>.</P>
            <Ul>
                <li><strong>Chart Tren 6 Bulan</strong> — perbandingan visual pemasukan vs pengeluaran</li>
                <li><strong>Entry Otomatis</strong>: setiap transaksi kasir LUNAS langsung tercatat sebagai INCOME</li>
                <li><strong>Filter Periode</strong> fleksibel dengan breakdown per kategori</li>
                <li><strong>Export Excel</strong> untuk pembukuan manual</li>
            </Ul>
            <Callout type="warning">
                Entry Cashflow dengan <Code>userId = null</Code> adalah entri otomatis dari transaksi kasir — jangan dihapus atau diedit secara manual.
            </Callout>

            <H2 id="laporan-laba">Laporan Laba Kotor</H2>
            <P>Analisis margin profit per produk di <Code>/reports/profit</Code>.</P>
            <Table
                headers={["Kolom", "Keterangan"]}
                rows={[
                    ["Total Pendapatan", "Harga jual × jumlah terjual"],
                    ["Total HPP", "Modal per unit × jumlah terjual"],
                    ["Laba Kotor", "Pendapatan − Total HPP"],
                    ["Margin %", "(Laba Kotor ÷ Pendapatan) × 100%"],
                ]}
            />
            <Callout type="tip">
                Pastikan HPP varian sudah diisi (via Kalkulator HPP) agar laporan ini menampilkan margin yang akurat.
            </Callout>

            <H2 id="laporan-stok">Laporan Stok</H2>
            <P>Pergerakan stok per periode di <Code>/reports/stock</Code>. Filter tipe: IN / OUT / ADJUST. Export tersedia dalam format CSV.</P>
            <Table
                headers={["Tipe", "Warna", "Artinya"]}
                rows={[
                    ["MASUK", "Hijau", "Stok bertambah (pembelian, stok awal, opname naik)"],
                    ["KELUAR", "Merah", "Stok berkurang (penjualan, produksi, opname turun)"],
                    ["SESUAIKAN", "Biru", "Penyesuaian manual dari sesi Stok Opname"],
                ]}
            />
        </>
    );
}

function SecProduksi() {
    return (
        <>
            <H2 id="produksi">Antrian Produksi</H2>
            <P>
                Modul khusus percetakan digital di <Code>/produksi</Code>. Setiap order cetak dari kasir otomatis menjadi <em>job</em> yang dikelola operator — tanpa perlu login akun utama.
            </P>
            <Callout type="info" title="Cara Akses Operator">
                Buka <Code>/produksi</Code> → masukkan PIN Operator. Session aktif 24 jam.
                PIN diatur di Pengaturan → Umum → kolom PIN Operator.
            </Callout>

            <H3>Status Job</H3>
            <Table
                headers={["Badge", "Status", "Keterangan"]}
                rows={[
                    ["🟡", "ANTRIAN", "Job belum dikerjakan"],
                    ["🔵", "PROSES", "Job sedang dikerjakan"],
                    ["🟠", "MENUNGGU PASANG", "Cetak selesai, menunggu pemasangan (produk rakitan)"],
                    ["🟤", "DIPASANG", "Dalam proses pemasangan"],
                    ["🟢", "SELESAI", "Selesai, menunggu diambil pelanggan"],
                    ["⚪", "DIAMBIL", "Pelanggan sudah mengambil pesanan"],
                ]}
            />

            <H3>Mode 1 — Cetak Satuan (per Job)</H3>
            <Steps steps={[
                { title: "Klik ▶ Mulai pada job", desc: "Dialog muncul — pilih bahan roll, atau centang Pakai Waste jika memakai sisa bahan." },
                { title: "Luas Bahan (m²) otomatis terhitung", desc: "Bisa diubah manual jika perlu." },
                { title: "Klik Mulai Cetak", desc: "Status berubah ke PROSES + stok roll terpotong." },
                { title: "Setelah selesai, klik ✓ Selesai", desc: "Produk biasa → SELESAI. Produk rakitan → MENUNGGU PASANG." },
                { title: "Di tab SELESAI, klik 📦 Diambil", desc: "Saat pelanggan mengambil pesanan." },
            ]} />

            <H3>Mode 2 — Gabung Cetak (Batch)</H3>
            <Steps steps={[
                { title: "Klik Gabung Cetak (kanan atas)", desc: "" },
                { title: "Centang job-job yang ingin digabung", desc: "Hanya job berstatus ANTRIAN." },
                { title: "Pilih bahan roll atau centang Pakai Waste", desc: "Total luas (m²) tampil otomatis." },
                { title: "Klik Buat Batch", desc: "Nomor batch dibuat (misal: BATCH-0001), semua job masuk PROSES." },
                { title: "Klik ✓ Selesai Batch", desc: "Semua job dalam batch berubah ke SELESAI." },
            ]} />

            <H3>Setup Produk Cetak</H3>
            <Steps steps={[
                { title: "Edit produk → mode harga = Area Based", desc: "" },
                { title: "Centang Perlu Proses Produksi", desc: "Setiap penjualan produk ini akan membuat job di antrian produksi." },
                { title: "Centang Produk Rakitan (jika ada tahap pasang)", desc: "Contoh: Standing Banner, Neon Box. Tambahkan komponen BOM di bagian Ingredient." },
                { title: "Daftarkan Bahan Roll sebagai varian RAW_MATERIAL", desc: "Centang 'Bahan Roll', isi lebar fisik dan lebar efektif cetak." },
            ]} />

            <H3>Pemotongan Stok</H3>
            <Table
                headers={["Kondisi", "Waktu Potong"]}
                rows={[
                    ["Pakai bahan roll baru", "Saat klik Mulai Cetak (sebesar luas m²)"],
                    ["Pakai sisa/waste", "Tidak ada pemotongan stok"],
                    ["Batch + bahan roll", "Saat klik Buat Batch (total luas gabungan)"],
                    ["Produk rakitan (BOM)", "Saat klik Mulai Pasang (komponen rangka/frame)"],
                ]}
            />

            <H3>Prioritas & Deadline</H3>
            <Table
                headers={["Prioritas", "Keterangan"]}
                rows={[
                    ["Normal", "Masuk antrian biasa (urut waktu masuk)"],
                    ["EXPRESS 🔴", "Muncul di urutan paling atas antrian, ditandai badge merah"],
                ]}
            />
            <P>Job melewati deadline tampil badge <strong className="text-red-600">TERLAMBAT</strong> berwarna merah.</P>

            <H3 id="pipeline-produksi">Pipeline Produksi — /produksi/pipeline</H3>
            <P>
                Tampilan Kanban board untuk memantau alur kerja produksi — berbeda dari antrian operator, Pipeline diakses oleh admin/manager
                dengan login biasa (bukan PIN operator).
            </P>
            <Table
                headers={["Kolom Pipeline", "Tahap"]}
                rows={[
                    ["Design", "Sedang dalam proses desain — upload proof di sini"],
                    ["Print", "Antrian cetak"],
                    ["Antrian Press", "Menunggu mesin press/laminasi"],
                    ["Jahit", "Proses jahit — input nama penjahit & estimasi jadi"],
                    ["QC & Packing", "Quality control & pengemasan"],
                    ["Kirim", "Dalam pengiriman ke pelanggan"],
                    ["Retur", "Dikembalikan — isi alasan retur"],
                    ["Selesai", "Selesai semua proses"],
                ]}
            />
            <H3>Filter Pipeline</H3>
            <P>Di halaman Pipeline Produksi tersedia dua filter yang bisa dikombinasikan:</P>
            <Ul>
                <li><strong>Search bar</strong> — cari berdasarkan nama pelanggan, nomor invoice, atau nomor job</li>
                <li><strong>Filter Prioritas</strong> — tombol pill: Semua / URGENT / HIGH / NORMAL / LOW</li>
            </Ul>
            <P>Counter di header menampilkan "Menampilkan X dari Y job" saat filter aktif. Klik <strong>Reset filter</strong> untuk hapus semua sekaligus.</P>
        </>
    );
}

function SecInvoice() {
    return (
        <>
            <H2 id="invoice">Invoice & Penawaran Harga (SPH)</H2>
            <P>Buat dokumen bisnis profesional di <Code>/invoices</Code>.</P>

            <H3>Invoice vs SPH</H3>
            <Table
                headers={["", "Invoice (Faktur)", "SPH (Penawaran Harga)"]}
                rows={[
                    ["Tujuan", "Menagih klien yang sudah sepakat", "Menawarkan harga ke calon klien"],
                    ["Nomor", "INV-YYYYMMDD-XXX", "SPH-YYYYMMDD-XXX"],
                    ["Tanggal penting", "Jatuh Tempo (due date)", "Berlaku Hingga (valid until)"],
                    ["Cocok untuk", "Tagihan pekerjaan yang sudah disepakati", "Penawaran ke procurement perusahaan"],
                ]}
            />

            <H3>Alur Kerja Umum</H3>
            <Steps steps={[
                { title: "Buat SPH", desc: "Isi data klien (nama, perusahaan, alamat, email), tambah item dari katalog atau manual, set masa berlaku." },
                { title: "Cetak PDF & Kirim ke Klien", desc: "" },
                { title: "Klien Setuju?", desc: <>Klik <strong>Konversi ke Invoice</strong> → Invoice baru terbuat otomatis, SPH berubah status ke DITERIMA.</> },
                { title: "Tagih Pembayaran", desc: "Invoice dicetak ulang dan dikirim ke klien." },
            ]} />

            <P>
                Invoice & SPH terpisah per cabang: staff hanya melihat dokumen cabangnya. Owner pilih
                cabang dulu sebelum membuat dokumen baru.
            </P>

            <H3>Status Dokumen</H3>
            <Table
                headers={["Status", "Invoice", "SPH"]}
                rows={[
                    ["DRAFT", "Baru dibuat, belum dikirim", "Baru dibuat"],
                    ["SENT", "Sudah dikirim, belum dibayar", "Sudah dikirim, menunggu respons"],
                    ["PAID / ACCEPTED", "Invoice sudah dibayar", "SPH disetujui klien"],
                    ["CANCELLED / REJECTED", "Dibatalkan", "Klien menolak"],
                    ["EXPIRED", "—", "Masa berlaku habis"],
                ]}
            />
        </>
    );
}

function SecCRM() {
    return (
        <>
            <H2 id="crm">CRM — Lead Pipeline & Follow-Up</H2>
            <P>Sistem untuk mengelola calon customer dari lead masuk sampai repeat order.</P>

            <H3>4 Halaman CRM</H3>
            <Table
                headers={["Halaman", "Fungsi"]}
                rows={[
                    [<Code key="crm">/crm</Code>, "Dashboard KPI — metrik performa (response time, closing rate, dll)"],
                    [<Code key="leads">/crm/leads</Code>, "Pipeline Lead — input lead baru, kanban drag-drop, convert ke customer"],
                    [<Code key="fu">/crm/follow-ups</Code>, "Daily Worklist — tugas follow-up hari ini (halaman paling sering dibuka)"],
                    [<Code key="tmpl">/crm/templates</Code>, "Template WA — pesan siap copy-paste untuk berbagai skenario"],
                ]}
            />

            <H3>Status Lead</H3>
            <Table
                headers={["Status", "Artinya"]}
                rows={[
                    ["🆕 NEW", "Baru chat, belum di-follow up"],
                    ["📞 FOLLOW_UP", "Sedang dalam proses pendekatan"],
                    ["💬 NEGOTIATION", "Sedang diskusi harga/detail order"],
                    ["✅ CLOSED_WON", "Deal! Sudah bayar atau komitmen bayar"],
                    ["❌ CLOSED_LOST", "Tidak jadi order"],
                    ["💝 AFTER_SALES", "Pasca-order — follow up testimoni & review"],
                    ["🔁 REPEAT_ORDER", "Customer lama yang perlu di-ping ulang"],
                ]}
            />

            <H3>Convert Lead ke Customer</H3>
            <P>Saat lead mencapai status <strong>CLOSED_WON</strong>, klik <strong>Convert</strong>. Sistem otomatis membuat:</P>
            <Ul>
                <li>Record <strong>Customer</strong> baru (atau link ke yang sudah ada)</li>
                <li><strong>Sales Order (SPK)</strong> dengan detail produk dari lead</li>
                <li><strong>Invoice</strong> atau <strong>SPH</strong> siap kirim ke klien</li>
                <li>Jika pembayaran <strong>LUNAS</strong>, bisa isi Potongan Marketplace langsung di modal convert</li>
            </Ul>
            <Callout type="tip" title="Link Nota di Detail Lead">
                Setelah lead diconvert ke nota produksi, panel detail lead menampilkan tautan langsung ke nota — klik <strong>Lihat Nota #ID</strong>
                untuk membuka nota transaksi. Riwayat aktivitas lead juga mencatat link nota untuk audit trail.
            </Callout>

            <H3>Follow-Up Otomatis</H3>
            <Ul>
                <li><strong>After-Sales</strong>: otomatis dibuat 3 hari setelah status CLOSED_WON untuk minta testimoni</li>
                <li><strong>Repeat Order</strong>: sistem weekly cek customer dormant dan buat reminder follow-up</li>
            </Ul>

            <H3>Sales Order & Designer Portal</H3>
            <P>
                Sales Order (<Code>/sales-orders</Code>) adalah SPK (Surat Perintah Kerja) untuk order yang memerlukan proses desain.
                Designer dapat mengakses portal di <Code>/so-designer</Code> dengan PIN — tanpa perlu login ke akun kasir.
            </P>
            <Ul>
                <li>Kasir buat Sales Order → broadcast ke channel Discord internal (#produksi)</li>
                <li>Designer buka portal, lihat detail order, upload proof desain (paste screenshot)</li>
                <li>Kasir approve proof → order siap dicetak</li>
            </Ul>
        </>
    );
}

function SecWhatsApp() {
    return (
        <>
            <H2 id="whatsapp">WhatsApp Bot</H2>
            <P>Bot WhatsApp berjalan langsung di server PosPro — tidak perlu aplikasi atau layanan pihak ketiga.</P>

            <H3>Cara Menghubungkan</H3>
            <Steps steps={[
                { title: "Buka Pengaturan → WhatsApp Bot", desc: "" },
                { title: "Tunggu QR Code muncul di layar", desc: "" },
                { title: "Di HP: WhatsApp → Perangkat Tertaut → Tautkan Perangkat", desc: "" },
                { title: "Scan QR Code", desc: "Status berubah menjadi TERHUBUNG SEDIA ✅." },
            ]} />

            <H3>Setup Grup Laporan</H3>
            <Steps steps={[
                { title: "Tambahkan nomor bot ke grup WhatsApp", desc: "Contoh grup: 'Owner VOLIKO'." },
                { title: "Ketik !getgroupid di grup", desc: "Bot balas dengan ID grup (format angka panjang diakhiri @g.us)." },
                { title: "Ketik !botadmin setreportgroup [ID_GRUP]", desc: "Bot siap mengirim laporan shift ke grup tersebut ✅." },
            ]} />

            <H3>Perintah Bot</H3>
            <Table
                headers={["Perintah", "Fungsi"]}
                rows={[
                    ["!getgroupid", "Tampilkan ID grup ini"],
                    ["!botadmin status", "Cek status bot"],
                    ["!botadmin addgroup [ID]", "Izinkan bot beroperasi di grup ini"],
                    ["!botadmin removegroup [ID]", "Cabut izin grup"],
                    ["!botadmin listgroups", "Lihat semua grup yang diizinkan"],
                    ["!botadmin setreportgroup [ID]", "Atur grup tujuan laporan shift"],
                ]}
            />
            <Callout type="tip" title="Jika Bot Terputus">
                Masuk ke Pengaturan → WhatsApp Bot → klik <strong>Logout &amp; Restart Bot</strong> → scan QR Code ulang.
            </Callout>
            <Callout type="info" title="Broadcast vs Laporan Shift">
                <strong>Broadcast</strong> mengirim ke semua grup di <Code>broadcastGroups[]</Code>.
                <strong> Laporan Shift</strong> hanya ke satu <Code>reportGroupId</Code>.
            </Callout>
        </>
    );
}

function SecCabang() {
    return (
        <>
            <H2 id="multi-cabang">Multi-Cabang</H2>
            <P>
                Kelola banyak cabang dalam satu sistem — transaksi, stok, kas, shift, dan invoice
                masing-masing terpisah per cabang. Konfigurasi di <Code>/settings/branches</Code>.
            </P>

            <H3>Role dalam Multi-Cabang</H3>
            <Table
                headers={["Role", "Hak Akses"]}
                rows={[
                    ["Owner", "Lihat semua cabang, switch antar cabang via Branch Switcher di header"],
                    ["Staff/Kasir", "Hanya akses satu cabang (cabang yang ditugaskan)"],
                ]}
            />

            <H3>Data yang Terpisah per Cabang</H3>
            <P>Staff hanya bisa melihat & mengubah data cabangnya sendiri — termasuk saat membuka langsung lewat link/ID.</P>
            <Table
                headers={["Terpisah per cabang", "Dibagikan ke semua cabang"]}
                rows={[
                    ["Transaksi / penjualan & piutang", "Pelanggan (Customer)"],
                    ["Kas (Cashflow) & tutup shift", "Supplier"],
                    ["Stok, opname, pembelian, transfer", "Katalog produk & kategori"],
                    ["Invoice & SPH", "—"],
                    ["Antrian produksi & rekening bank", "—"],
                ]}
            />
            <P>
                Catatan: <strong>Invoice/SPH lama</strong> (sebelum fitur pemisahan ini) otomatis
                ditandai milik cabang <strong>Pusat</strong>. Owner perlu memilih cabang dulu sebelum
                membuat invoice baru (tidak bisa dari mode "Semua Cabang").
            </P>

            <H3>Titip Cetak Antar Cabang</H3>
            <P>Kasir cabang A bisa membuat nota yang dicetak di cabang B (pelaksana).</P>
            <Steps steps={[
                { title: "Kasir cabang A buat transaksi dengan toggle Titipkan ke Cabang Lain", desc: "Pilih cabang pelaksana yang akan mengerjakan." },
                { title: "Notifikasi popup muncul di cabang pelaksana", desc: "Halaman /titipan-masuk menampilkan order masuk." },
                { title: "Operator klik Terima & Kerjakan", desc: "Job masuk antrian /produksi di cabang pelaksana." },
                { title: "Cashflow & ledger antar cabang tercatat otomatis", desc: "Buku Titipan — /branch-ledger." },
            ]} />

            <H3>Buku Titipan — /branch-ledger</H3>
            <P>Ledger hutang-piutang antar cabang. Settlement bisa dilakukan dengan:</P>
            <Ul>
                <li><strong>Tunai</strong> — 2 cashflow entry dibuat otomatis (pengeluaran di pemesan, pemasukan di pelaksana)</li>
                <li><strong>Kirim Stok</strong> — transfer stok sebagai pembayaran hutang</li>
            </Ul>
        </>
    );
}

function SecPengaturan() {
    return (
        <>
            <H2 id="pengaturan">Pengaturan & Admin</H2>

            <H3>Profil Toko — /settings/general</H3>
            <Ul>
                <li>Nama toko, alamat, nomor telepon, logo (tampil di invoice, struk, halaman login)</li>
                <li>Tarif pajak (PPN) — berlaku untuk kasir dan invoice</li>
                <li>PIN Operator — untuk akses halaman Produksi tanpa login</li>
                <li>Fee Titipan Cetak — markup biaya saat menerima titipan dari cabang lain</li>
            </Ul>

            <H3>Manajemen User — /settings/users</H3>
            <Table
                headers={["Role", "Hak Akses"]}
                rows={[
                    ["Admin", "Akses penuh — semua fitur dan pengaturan"],
                    ["Manager", "Hampir semua akses + approve permintaan edit transaksi"],
                    ["Kasir", "Kasir, transaksi, dan laporan dasar"],
                    ["Owner", "Lihat semua cabang, laporan keuangan lengkap"],
                ]}
            />

            <H3>Tampilan Login — /settings/login</H3>
            <Ul>
                <li>Upload foto latar halaman login — efek Ken Burns (zoom + geser) otomatis, berganti setiap 6 detik</li>
                <li>Tambah tagline/slogan yang berganti setiap 5 detik</li>
                <li>Logo & nama toko diambil otomatis dari Profil Toko</li>
            </Ul>

            <H3>Backup & Restore — /settings/backup</H3>
            <Steps steps={[
                { title: "Klik Export Backup", desc: "Sistem generate file ZIP berisi dump database MySQL — download otomatis." },
                { title: "Simpan file ZIP di tempat aman", desc: "Bisa di cloud, USB, atau storage eksternal." },
                { title: "Auto-backup via Rclone (opsional)", desc: "Konfigurasi di Settings → Backup — backup otomatis ke Google Drive atau cloud storage lainnya." },
                { title: "Restore", desc: "Hubungi administrator untuk prosedur restore dari file backup." },
            ]} />

            <H3>Kalkulator HPP — /reports/hpp</H3>
            <Steps steps={[
                { title: "+ Buat Worksheet Baru", desc: "Pilih produk yang ingin dihitung HPP-nya." },
                { title: "Input biaya variabel (bahan baku)", desc: "Pilih dari stok atau input manual. Mode Lebar × Tinggi (m²) tersedia untuk bahan lembaran." },
                { title: "Input biaya tetap", desc: "Listrik, sewa, gaji — isi nama + nominal bulanan + target produksi per bulan." },
                { title: "Multi-Varian (opsional)", desc: "Hitung HPP beberapa ukuran sekaligus, tambah biaya finishing per ukuran (laminasi, cutting)." },
                { title: "Simpan hasil", desc: "Daftarkan sebagai produk baru ATAU terapkan ke varian yang sudah ada." },
            ]} />

            <H3>Peta Cuan Lokasi — /maps</H3>
            <Ul>
                <li>Tampilkan posisi semua cabang toko di peta interaktif</li>
                <li>Tambah & lacak kompetitor — input nama, tipe bisnis, koordinat/alamat</li>
                <li>Pencarian bisnis di area tertentu by keyword (via Overpass + Nominatim)</li>
                <li>Pin warna berbeda berdasarkan margin cabang</li>
            </Ul>
        </>
    );
}

function SecFAQ() {
    const faqs = [
        { q: "Apakah PosPro bisa dipakai di HP?", a: "Ya. Tampilan responsif untuk HP, tablet, dan PC. Untuk kasir aktif, tablet atau PC lebih nyaman." },
        { q: "Data tersimpan di mana?", a: "Data tersimpan di database server lokal milik toko (MySQL). Anda memiliki kendali penuh atas data sendiri." },
        { q: "Bisa multi-kasir (lebih dari satu perangkat)?", a: "Ya — berbasis web, beberapa perangkat bisa login bersamaan dari jaringan yang sama." },
        { q: "Bagaimana cara tambah akun kasir baru?", a: "Login sebagai Admin → Pengaturan → Manajemen User → + Tambah User → isi nama, email, password." },
        { q: "Job produksi tidak muncul di antrian?", a: "Pastikan produk sudah dicentang 'Perlu Proses Produksi' di halaman Edit Produk. Tanpa flag ini, penjualan produk tidak membuat job." },
        { q: "PIN operator lupa — bagaimana?", a: "Admin ubah PIN di Pengaturan → Umum, lalu beritahu operator PIN baru." },
        { q: "Kenapa stok komponen rakitan tidak terpotong saat cetak?", a: "Disengaja. Stok bahan cetak (roll) dipotong saat Mulai Cetak. Stok komponen rakitan dipotong saat Mulai Pasang — memastikan stok hanya berkurang saat bahan benar-benar dipakai." },
        { q: "Ada fitur laporan pajak?", a: "PosPro mendukung PPN di Invoice & SPH. Untuk laporan pajak formal, gunakan export Excel dan olah di aplikasi akuntansi." },
        { q: "Bot WhatsApp terputus — apa yang dilakukan?", a: "Pengaturan → WhatsApp Bot → klik Logout & Restart Bot → scan QR Code ulang." },
        { q: "Cara backup data?", a: "Pengaturan → Backup → klik Export Backup. File ZIP didownload otomatis. Disarankan backup berkala dan simpan di cloud storage." },
        { q: "Laporan Cashflow tidak sesuai?", a: "Periksa entry dengan userId = null (entry otomatis dari kasir). Jangan hapus entry otomatis tersebut — itu adalah record transaksi penjualan." },
        { q: "Produk Area Based tidak muncul di kasir?", a: "Pastikan tipe produk adalah 'Produk Jual' (SELLABLE), bukan 'Bahan Baku'. Bahan Baku tidak muncul di kasir." },
        { q: "Bagaimana mencatat potongan Shopee/Tokopedia?", a: "Di POS, gulir ke bawah form checkout → klik + Tambah Potongan → isi nama platform dan nominal. Bisa lebih dari satu baris. Cashflow otomatis split: INCOME (nett diterima) + EXPENSE Biaya Platform. Jika lupa diisi saat transaksi, bisa diisi saat pelunasan di menu DP & Piutang." },
        { q: "Potongan marketplace hanya untuk transaksi marketplace?", a: "Tidak wajib. Field ini bisa digunakan untuk potongan apapun — komisi agen, GoFood, GrabFood, dll. Isi sesuai kebutuhan." },
        { q: "Filter di Pipeline Produksi tidak berfungsi?", a: "Filter bekerja di sisi client — data sudah dimuat saat halaman dibuka. Klik Reset filter untuk memastikan semua filter bersih. Jika data tidak update, tunggu 60 detik (auto-refresh) atau reload halaman." },
    ];

    return (
        <>
            <H2 id="faq">FAQ & Troubleshooting</H2>
            <div className="space-y-3">
                {faqs.map((faq, i) => (
                    <details
                        key={i}
                        className="group border border-gray-200 rounded-lg overflow-hidden"
                    >
                        <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors list-none">
                            <span className="font-medium text-gray-800 text-sm">{faq.q}</span>
                            <ChevronDown
                                size={16}
                                className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180"
                            />
                        </summary>
                        <div className="px-4 py-3 text-gray-600 text-sm leading-relaxed border-t border-gray-100">
                            {faq.a}
                        </div>
                    </details>
                ))}
            </div>
        </>
    );
}

// ─── ALUR SISTEM ─────────────────────────────────────────────────────────────

function SecAlurSistem() {
    const modules = [
        { emoji: "🎯", label: "CRM & Lead",      desc: "Kelola calon pelanggan, follow-up terjadwal",    color: "bg-violet-50 border-violet-200 text-violet-800" },
        { emoji: "🛒", label: "Kasir POS",        desc: "Transaksi, pembayaran, struk real-time",          color: "bg-blue-50 border-blue-200 text-blue-800" },
        { emoji: "🖨️", label: "Produksi",         desc: "Antrian & pipeline kanban cetak",                 color: "bg-cyan-50 border-cyan-200 text-cyan-800" },
        { emoji: "📦", label: "Inventori",        desc: "Produk, stok, bahan baku, HPP",                  color: "bg-orange-50 border-orange-200 text-orange-800" },
        { emoji: "📊", label: "Laporan",          desc: "Penjualan, cashflow, laba, stok opname",         color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
        { emoji: "📄", label: "Invoice & SPH",    desc: "Penawaran & nota tagihan B2B",                   color: "bg-amber-50 border-amber-200 text-amber-800" },
        { emoji: "🤖", label: "WhatsApp Bot",     desc: "Notifikasi & broadcast otomatis",                color: "bg-green-50 border-green-200 text-green-800" },
        { emoji: "🏢", label: "Multi-Cabang",     desc: "Kelola beberapa cabang sekaligus",               color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
    ];

    const roles = [
        {
            role: "👑 Owner / Admin",
            desc: "Akses penuh ke semua fitur",
            modules: ["Laporan & Cashflow", "CRM Dashboard", "Pengaturan", "Backup Data"],
            color: "bg-purple-50 border-purple-300",
            badge: "bg-purple-100 text-purple-700",
        },
        {
            role: "🛒 Kasir",
            desc: "Operasional transaksi harian",
            modules: ["Kasir POS", "Piutang & DP", "Invoice", "Tutup Shift"],
            color: "bg-blue-50 border-blue-300",
            badge: "bg-blue-100 text-blue-700",
        },
        {
            role: "🖨️ Operator Produksi",
            desc: "Kerjakan dan pantau job cetak",
            modules: ["Antrian Produksi", "Pipeline Kanban", "Upload Foto Bukti"],
            color: "bg-cyan-50 border-cyan-300",
            badge: "bg-cyan-100 text-cyan-700",
        },
        {
            role: "📱 CS / Marketing",
            desc: "Kelola prospek & komunikasi",
            modules: ["CRM Leads", "Follow-Up Terjadwal", "WhatsApp Bot", "Performa CS"],
            color: "bg-green-50 border-green-300",
            badge: "bg-green-100 text-green-700",
        },
    ];

    const mainFlow = [
        {
            emoji: "🙋",
            title: "Pelanggan Datang / Menghubungi",
            desc: "Via WhatsApp, Instagram, datang langsung ke toko, atau dari marketplace",
            tag: "CRM → Tambah Lead",
            tagColor: "bg-violet-100 text-violet-700",
            card: "from-violet-50 to-purple-50 border-violet-200",
            dot: "bg-violet-500",
        },
        {
            emoji: "📞",
            title: "CS Follow-Up & Negosiasi",
            desc: "Lead dicatat, CS di-assign, follow-up dijadwalkan. Status: Baru → Follow Up → Negosiasi",
            tag: "CRM → Pipeline Lead",
            tagColor: "bg-pink-100 text-pink-700",
            card: "from-pink-50 to-rose-50 border-pink-200",
            dot: "bg-pink-500",
        },
        {
            emoji: "🛒",
            title: "Deal! Kasir Input Transaksi",
            desc: "Lead di-convert → transaksi terbuat otomatis. Atau kasir input manual di POS. Pilih produk, ukuran, harga, metode bayar.",
            tag: "Kasir POS",
            tagColor: "bg-blue-100 text-blue-700",
            card: "from-blue-50 to-indigo-50 border-blue-200",
            dot: "bg-blue-500",
        },
        {
            emoji: "📄",
            title: "Nota Terbit & Pembayaran Dicatat",
            desc: "Struk dicetak / dikirim WA. Cashflow terbuat otomatis. DP → status Belum Lunas, bisa dilunasi kapan saja.",
            tag: "Nota / Invoice",
            tagColor: "bg-indigo-100 text-indigo-700",
            card: "from-indigo-50 to-blue-50 border-indigo-200",
            dot: "bg-indigo-500",
        },
        {
            emoji: "🖨️",
            title: "Job Cetak Masuk Produksi",
            desc: "Untuk produk cetak, job antrian terbuat otomatis. Operator buka halaman Produksi, masukkan bahan roll, mulai cetak.",
            tag: "Antrian Produksi",
            tagColor: "bg-cyan-100 text-cyan-700",
            card: "from-cyan-50 to-teal-50 border-cyan-200",
            dot: "bg-cyan-500",
        },
        {
            emoji: "🎨",
            title: "Proses Produksi Bertahap",
            desc: "Admin geser card di Pipeline Kanban sesuai progres. Foto bukti design bisa diupload di tahap DESIGN.",
            tag: "Pipeline Kanban",
            tagColor: "bg-teal-100 text-teal-700",
            card: "from-teal-50 to-emerald-50 border-teal-200",
            dot: "bg-teal-500",
        },
        {
            emoji: "📦",
            title: "Packing & Pengiriman / Pickup",
            desc: "Barang selesai, di-packing, dikirim atau diambil pelanggan. Upload foto bukti kirim untuk konfirmasi.",
            tag: "KIRIM → SELESAI",
            tagColor: "bg-emerald-100 text-emerald-700",
            card: "from-emerald-50 to-green-50 border-emerald-200",
            dot: "bg-emerald-500",
        },
        {
            emoji: "🔄",
            title: "After Sales & Repeat Order",
            desc: "Sistem otomatis jadwalkan follow-up 3 hari setelah pickup. CS hubungi pelanggan → peluang repeat order!",
            tag: "CRM After Sales",
            tagColor: "bg-amber-100 text-amber-700",
            card: "from-amber-50 to-orange-50 border-amber-200",
            dot: "bg-amber-500",
        },
    ];

    const pipelineStages = [
        { label: "DESIGN",        emoji: "🎨", color: "bg-slate-100 text-slate-700 border-slate-300" },
        { label: "PRINT",         emoji: "🖨️", color: "bg-blue-100 text-blue-700 border-blue-300" },
        { label: "PRESS",         emoji: "⚡", color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
        { label: "JAHIT",         emoji: "🧵", color: "bg-purple-100 text-purple-700 border-purple-300" },
        { label: "QC & PACKING",  emoji: "✅", color: "bg-amber-100 text-amber-700 border-amber-300" },
        { label: "KIRIM",         emoji: "🚚", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
        { label: "SELESAI",       emoji: "🎉", color: "bg-green-100 text-green-700 border-green-300" },
    ];

    return (
        <>
            <H2 id="alur-sistem">Alur Sistem PosPro</H2>
            <P>
                Gambaran menyeluruh bagaimana PosPro bekerja — dari pelanggan pertama kali menghubungi,
                proses transaksi, produksi, hingga barang sampai di tangan pelanggan dan follow-up after sales.
            </P>

            {/* ── 1. Peta Modul ─────────────────────────────────────── */}
            <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-700">
                    <span className="text-xl">🗺️</span> Peta Modul — 8 Fitur Utama PosPro
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {modules.map((m) => (
                        <div key={m.label} className={`rounded-xl border p-3 ${m.color}`}>
                            <div className="mb-1 text-2xl">{m.emoji}</div>
                            <div className="mb-0.5 text-xs font-bold">{m.label}</div>
                            <div className="text-[11px] leading-tight opacity-75">{m.desc}</div>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-[11px] text-gray-400">
                    Semua modul terhubung satu sama lain — transaksi POS otomatis menciptakan job produksi, cashflow, dan data laporan secara bersamaan.
                </p>
            </div>

            {/* ── 2. Siapa Pakai Apa ────────────────────────────────── */}
            <H3>Siapa Pakai Apa?</H3>
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roles.map((r) => (
                    <div key={r.role} className={`rounded-xl border-2 p-4 ${r.color}`}>
                        <div className="mb-0.5 text-sm font-bold text-gray-800">{r.role}</div>
                        <div className="mb-2.5 text-xs text-gray-500">{r.desc}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {r.modules.map((mod) => (
                                <span key={mod} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.badge}`}>
                                    {mod}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 3. Alur Transaksi Utama ───────────────────────────── */}
            <H3>Alur Transaksi — dari Pertama Hubungi sampai Selesai</H3>
            <div className="mb-8">
                {mainFlow.map((f, i) => (
                    <div key={i}>
                        <div className={`flex items-start gap-3 rounded-xl border bg-gradient-to-r p-3.5 ${f.card}`}>
                            {/* Step dot */}
                            <div className="relative flex flex-col items-center self-stretch">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow ${f.dot}`}>
                                    {i + 1}
                                </div>
                                {i < mainFlow.length - 1 && (
                                    <div className="mt-1 w-0.5 flex-1 rounded-full bg-gray-200" />
                                )}
                            </div>
                            <div className="flex-1 pb-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="text-base">{f.emoji}</span>
                                    <span className="text-sm font-bold text-gray-800">{f.title}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.tagColor}`}>
                                        {f.tag}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-gray-600">{f.desc}</p>
                            </div>
                        </div>
                        {i < mainFlow.length - 1 && <div className="my-0.5 ml-4 text-center text-xs text-gray-300">▼</div>}
                    </div>
                ))}
            </div>

            {/* ── 4. Pipeline Produksi Mini-view ────────────────────── */}
            <H3>Tahapan Pipeline Produksi</H3>
            <p className="mb-3 text-[13px] text-gray-500">
                Setiap job cetak bergerak melewati tahapan ini. Admin drag card di kanban, operator lihat di halaman Produksi.
            </p>
            <div className="mb-3 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex min-w-max items-center gap-1.5">
                    {pipelineStages.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                            <div className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-center font-semibold ${s.color}`}>
                                <span className="text-xl">{s.emoji}</span>
                                <span className="text-[11px]">{s.label}</span>
                            </div>
                            {i < pipelineStages.length - 1 && (
                                <span className="text-sm font-bold text-gray-300">→</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <span className="text-base">↩️</span>
                <p className="text-[12px] text-red-700">
                    <strong>RETUR</strong> — jika ada cacat/salah, card bisa ditandai Retur dengan keterangan alasan, lalu dikerjakan ulang dari tahap awal.
                </p>
            </div>

            {/* ── 5. Alur Keuangan ──────────────────────────────────── */}
            <H3>Alur Keuangan</H3>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="mb-2 text-2xl">💵</div>
                    <div className="mb-2 text-sm font-bold text-green-800">Pembayaran Lunas</div>
                    <div className="space-y-1 text-[12px] text-green-700">
                        <div className="flex items-center gap-1.5"><span>→</span> Tunai masuk ke Kas</div>
                        <div className="flex items-center gap-1.5"><span>→</span> Transfer ke Rekening Bank</div>
                        <div className="flex items-center gap-1.5"><span>→</span> QRIS tercatat otomatis</div>
                    </div>
                    <div className="mt-3 rounded-lg bg-green-100 px-2.5 py-1.5 text-[11px] text-green-800">
                        Cashflow <strong>INCOME</strong> terbuat otomatis saat transaksi dikonfirmasi
                    </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-2 text-2xl">⏳</div>
                    <div className="mb-2 text-sm font-bold text-amber-800">DP & Piutang</div>
                    <div className="space-y-1 text-[12px] text-amber-700">
                        <div className="flex items-center gap-1.5"><span>→</span> DP dibayar sebagian</div>
                        <div className="flex items-center gap-1.5"><span>→</span> Sisa masuk menu Piutang</div>
                        <div className="flex items-center gap-1.5"><span>→</span> Lunasi saat barang diambil</div>
                    </div>
                    <div className="mt-3 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-800">
                        Status: <strong>PARTIAL</strong> → setelah lunas → <strong>PAID</strong>
                    </div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="mb-2 text-2xl">🏪</div>
                    <div className="mb-2 text-sm font-bold text-rose-800">Fee Marketplace</div>
                    <div className="space-y-1 text-[12px] text-rose-700">
                        <div className="flex items-center gap-1.5"><span>→</span> Input potongan Shopee/Tokopedia</div>
                        <div className="flex items-center gap-1.5"><span>→</span> Income = nett yang diterima</div>
                        <div className="flex items-center gap-1.5"><span>→</span> Fee tercatat sebagai Expense</div>
                    </div>
                    <div className="mt-3 rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11px] text-rose-800">
                        Cashflow <strong>split otomatis</strong> — harga ke pelanggan tidak berubah
                    </div>
                </div>
            </div>

            <Callout type="tip" title="Mulai dari Mana?">
                Bagi pengguna baru: setup <strong>Produk & Stok</strong> dulu → coba <strong>Transaksi pertama di Kasir</strong> → cek hasilnya di <strong>Laporan Penjualan</strong>.
                Tiga langkah itu sudah cukup untuk operasional dasar hari pertama.
            </Callout>
        </>
    );
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

const NAV_GROUPS = [
    {
        label: "Pengantar",
        icon: <BookOpen size={14} />,
        items: [
            { id: "alur-sistem", label: "Alur Sistem" },
            { id: "setup", label: "Setup Pertama Kali" },
            { id: "login", label: "Login & Dashboard" },
        ],
    },
    {
        label: "Operasional",
        icon: <ShoppingCart size={14} />,
        items: [
            { id: "kasir", label: "Kasir / POS" },
            { id: "inventori", label: "Produk & Stok" },
            { id: "piutang", label: "DP & Piutang" },
        ],
    },
    {
        label: "Laporan & Keuangan",
        icon: <BarChart3 size={14} />,
        items: [
            { id: "laporan-penjualan", label: "Laporan Penjualan" },
            { id: "tutup-shift", label: "Tutup Shift" },
            { id: "cashflow", label: "Cashflow" },
            { id: "laporan-laba", label: "Laporan Laba Kotor" },
            { id: "laporan-stok", label: "Laporan Stok" },
        ],
    },
    {
        label: "Produksi & Cetak",
        icon: <Printer size={14} />,
        items: [
            { id: "produksi", label: "Antrian Produksi" },
            { id: "pipeline-produksi", label: "Pipeline & Filter" },
        ],
    },
    {
        label: "Dokumen B2B & CRM",
        icon: <FileText size={14} />,
        items: [
            { id: "invoice", label: "Invoice & SPH" },
            { id: "crm", label: "CRM & Lead Pipeline" },
        ],
    },
    {
        label: "Komunikasi",
        icon: <MessageSquare size={14} />,
        items: [{ id: "whatsapp", label: "WhatsApp Bot" }],
    },
    {
        label: "Multi-Cabang",
        icon: <Building2 size={14} />,
        items: [{ id: "multi-cabang", label: "Mode Cabang & Titip Cetak" }],
    },
    {
        label: "Pengaturan",
        icon: <Settings size={14} />,
        items: [{ id: "pengaturan", label: "Pengaturan & Admin" }],
    },
    {
        label: "FAQ",
        icon: <HelpCircle size={14} />,
        items: [{ id: "faq", label: "FAQ & Troubleshooting" }],
    },
];

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
    const [open, setOpen] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        NAV_GROUPS.forEach((g) => { init[g.label] = true; });
        return init;
    });

    return (
        <div className="h-full overflow-y-auto py-4 px-2">
            <div className="mb-4 px-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Panduan PosPro</div>
                <button
                    onClick={() => onNavigate("setup")}
                    className="text-[13px] text-green-700 hover:underline font-medium"
                >
                    ← Mulai dari sini
                </button>
            </div>
            {NAV_GROUPS.map((g) => {
                const isOpen = open[g.label] !== false;
                return (
                    <div key={g.label} className="mb-1">
                        <button
                            onClick={() => setOpen((p) => ({ ...p, [g.label]: !p[g.label] }))}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <span className="flex items-center gap-1.5">{g.icon}{g.label}</span>
                            <ChevronDown size={11} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                        </button>
                        {isOpen && (
                            <div className="mt-0.5 mb-2 space-y-0.5">
                                {g.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => onNavigate(item.id)}
                                        className={`w-full text-left px-4 py-1.5 rounded-md text-[13px] transition-colors ${activeId === item.id
                                            ? "bg-green-100 text-green-800 font-semibold border-l-2 border-green-500 pl-[14px]"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeId, setActiveId] = useState("setup");

    function scrollTo(id: string) {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveId(id);
            setSidebarOpen(false);
        }
    }

    useEffect(() => {
        const allIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting);
                if (visible.length > 0) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-24px 0px -70% 0px", threshold: 0 }
        );
        allIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 h-14 border-b border-gray-200 bg-white/95 backdrop-blur-sm flex items-center px-4 gap-3 shadow-sm">
                <Link
                    href="/"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors shrink-0"
                >
                    <ArrowLeft size={15} />
                    <span className="hidden sm:inline">Kembali ke Aplikasi</span>
                </Link>
                <div className="w-px h-5 bg-gray-200 hidden sm:block" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-gray-900 text-sm">Panduan PosPro</span>
                        <span className="hidden sm:inline text-gray-400 text-sm ml-2">Manual Book &amp; Dokumentasi</span>
                    </div>
                </div>
                <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">v5.2</span>
                <button
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle menu"
                >
                    {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </header>

            <div className="flex flex-1">
                {/* Sidebar Desktop */}
                <aside className="hidden lg:block w-60 shrink-0 border-r border-gray-100 sticky top-14 self-start h-[calc(100vh-3.5rem)]">
                    <Sidebar activeId={activeId} onNavigate={scrollTo} />
                </aside>

                {/* Sidebar Mobile */}
                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                        <aside className="fixed top-14 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-200 lg:hidden overflow-y-auto shadow-xl">
                            <Sidebar activeId={activeId} onNavigate={scrollTo} />
                        </aside>
                    </>
                )}

                {/* Content */}
                <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-8 max-w-3xl">
                    <SecPengantar />
                    <SecAlurSistem />
                    <SecKasir />
                    <SecInventori />
                    <SecPiutang />
                    <SecLaporan />
                    <SecProduksi />
                    <SecInvoice />
                    <SecCRM />
                    <SecWhatsApp />
                    <SecCabang />
                    <SecPengaturan />
                    <SecFAQ />

                    <div className="mt-16 pt-8 border-t border-gray-200 text-center">
                        <p className="text-sm font-semibold text-gray-600">PosPro Manual Book</p>
                        <p className="text-xs text-gray-400 mt-1">© 2026 Muhammad Faisal. All rights reserved.</p>
                        <Link href="/" className="inline-block mt-4 text-sm text-green-600 hover:text-green-700 hover:underline font-medium">
                            ← Kembali ke Aplikasi
                        </Link>
                    </div>
                </main>

                {/* Right gutter */}
                <div className="hidden xl:block w-12 shrink-0" />
            </div>
        </div>
    );
}

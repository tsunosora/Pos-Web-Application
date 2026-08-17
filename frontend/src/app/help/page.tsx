"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft, BookOpen, Menu, X, ChevronDown,
    ShoppingCart, Package, Wallet, BarChart3, Printer,
    FileText, MessageSquare, Settings, HelpCircle,
    Banknote, Building2, CheckCircle, AlertCircle, Info,
    TrendingDown, Sparkles, Store, Monitor,
} from "lucide-react";
import { usePagination, PaginationBar } from "@/components/ui/pagination";

// ─── Helper UI ────────────────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <h2
            id={id}
            className="scroll-mt-20 text-xl font-bold text-foreground mt-10 mb-4 pb-3 border-b border-border"
        >
            {children}
        </h2>
    );
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
    return (
        <h3 id={id} className="scroll-mt-20 text-base font-semibold text-foreground mt-6 mb-3">
            {children}
        </h3>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground leading-relaxed mb-3 text-[15px]">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
    return <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mb-4 text-[15px] pl-2">{children}</ul>;
}

function Code({ children }: { children: React.ReactNode }) {
    return (
        <code className="bg-muted border border-border text-accent-foreground px-1.5 py-0.5 rounded text-[13px] font-mono">
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
        info: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300", icon: <Info size={15} className="flex-shrink-0 mt-0.5" /> },
        tip: { bg: "bg-primary/10", border: "border-primary", text: "text-accent-foreground", icon: <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> },
        warning: { bg: "bg-amber-500/10", border: "border-amber-500", text: "text-amber-700 dark:text-amber-300", icon: <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> },
        danger: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-700 dark:text-red-300", icon: <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> },
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
        <div className="overflow-x-auto mb-6 rounded-xl border border-border shadow-sm">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-muted/50">
                        {headers.map((h, i) => (
                            <th
                                key={i}
                                className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0 even:bg-muted/30 hover:bg-primary/10 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-2.5 text-muted-foreground align-top">
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
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                    </div>
                    <div>
                        <div className="font-medium text-foreground text-sm">{s.title}</div>
                        {s.desc && <div className="text-muted-foreground text-sm mt-0.5">{s.desc}</div>}
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
                { title: "Notifikasi Discord — /settings/discord", desc: "Isi webhook URL per channel untuk tiap cabang (penjualan, produksi, keuangan, dll) — laporan shift, lead, SO, dan stok terkirim otomatis ke Discord." },
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

function SecProdukCustom() {
    return (
        <>
            <H2 id="produk-custom">Produk Custom (Buku & Konfigurasi)</H2>
            <P>
                Beberapa produk bersifat KONFIGURASI (composite): harga dirakit dari komponen,
                bukan harga tetap. Contoh: <strong>Buku Custom</strong>.
            </P>
            <H3>Cara Kerja Buku Custom</H3>
            <Steps
                steps={[
                    { title: "Dirakit dari 3 bagian", desc: "ISI (cetak kertas per lembar A3, bahan bebas) + COVER (cetak 1 lembar) + JILID (finishing)." },
                    { title: "Ukuran & bahan", desc: "Ukuran A6 / A5 / A4 / A3. Bahan isi & cover bebas (Art Paper, HVS, Ivory/Art Cartoon, dll)." },
                    { title: "Finishing", desc: "Spiral / Steples / Binding Lem / Steples+Lakban." },
                    { title: "Konversi halaman → lembar A3 (cetak bolak-balik)", desc: "A3=2, A4=4, A5=8, A6=16 halaman per lembar. Lembar A3 isi = ceil(jumlah halaman ÷ angka tsb)." },
                    { title: "Rumus harga", desc: "Harga = (lembar A3 × harga cetak isi) + (harga cetak cover) + (harga jilid)." },
                ]}
            />
            <Callout type="tip" title="Contoh Hitung">
                A5, 40 halaman, isi Art Paper 150, cover Ivory 260, jilid Spiral ≈ Rp37.000.
                Lembar A3 isi = ceil(40 ÷ 8) = 5 lembar.
            </Callout>
            <H3>Cara Order di POS</H3>
            <Steps
                steps={[
                    { title: "Pilih produk Buku Custom", desc: "Muncul form konfigurasi (ukuran / halaman / bahan / finishing) → harga otomatis." },
                    { title: "Bila konfigurator nonaktif", desc: "Rakit manual: Cetak Isi ×N + Cetak Cover ×1 + Jilid ×1." },
                ]}
            />
            <H3>Aktif / Nonaktifkan Konfigurator</H3>
            <P>
                Di editor produk (<Code>/inventory</Code> → edit produk) ada toggle <strong>Konfigurator Produk Custom</strong>.
                Aktif = mode konfigurasi (COMPOSITE). Nonaktif = produk biasa (varian &quot;Mulai dari …&quot;). Konfigurasi tetap tersimpan saat nonaktif, jadi aman diaktifkan lagi.
            </P>
            <Callout type="info" title="Untuk Asisten AI">
                Saat customer tanya harga buku/makalah/laporan: tanyakan ukuran, jumlah halaman,
                bahan isi & cover, dan finishing — lalu hitung dengan rumus di atas.
            </Callout>
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

function SecLeaderboard() {
    return (
        <>
            <H2 id="leaderboard">Leaderboard Kinerja</H2>
            <P>Papan peringkat kinerja tim di <Code>/leaderboard</Code>. Angka dihitung otomatis dari data nota, lead, SO, dan job produksi — tidak ada input manual. Filter periode dan cabang berlaku untuk semua divisi sekaligus.</P>
            <Table
                headers={["Divisi", "Isi utama"]}
                rows={[
                    ["Tim / Cabang", "Omzet nota dibagi rata per peran → diakumulasi per cabang home"],
                    ["CS / Sales", "Leads, closing, pcs, cuan (net), omzet (bagian), pengiriman, respon"],
                    ["Designer", "Cek desain, produktivitas jasa desain, SO dibuat, nota, ACC, omzet"],
                    ["Operator", "Job cetak, lembar, job produksi, selesai, breakdown per kategori"],
                ]}
            />
            <P>Setiap section punya panel <strong>“Cara Hitung &amp; Sumber Angka”</strong> yang bisa dibuka untuk melihat rumus tiap kolom.</P>

            <H2 id="metrik-custom">Metrik Produk Custom ⭐</H2>
            <P>Fitur untuk <strong>Owner</strong>: buat kolom sendiri di leaderboard yang menghitung <strong>produk khusus</strong> — misal “Roll Up Banner F340” atau “Jersey Kantor”. Kolom ini terpisah dari metrik bawaan, jadi tidak mengubah/menggandakan angka yang sudah ada. Bisa membuat lebih dari satu metrik (tiap metrik = satu kolom).</P>

            <H3>Cara membuat</H3>
            <Steps steps={[
                { title: "Buka Owner Dashboard", desc: <>Masuk <Code>/owner</Code> → gulir ke panel <strong>“Metrik Produk Custom”</strong> → klik <strong>Tambah</strong>.</> },
                { title: "Isi Nama & Label", desc: "Nama = keterangan internal (mis. Roll Up Banner F340). Label = teks pendek yang muncul sebagai judul kolom di leaderboard (mis. Roll Up)." },
                { title: "Pilih Cara Hitung", desc: "PCS (default), QTY, OMZET, atau NOTA — menentukan angka apa yang muncul di kolom." },
                { title: "Pilih Tampil di Leaderboard", desc: "Centang CS, Designer, dan/atau Operator — kolom hanya muncul di divisi yang dipilih." },
                { title: "Pilih Produk / Varian dari Inventori", desc: "Cari & centang varian yang ingin dilacak. Tiap varian dihitung terpisah (karena namanya beda) — mis. hanya varian F340, bukan F300." },
                { title: "Simpan", desc: "Kolom langsung muncul di /leaderboard pada divisi yang dipilih. Bisa diedit, dinonaktifkan, atau dihapus kapan saja." },
            ]} />

            <H3>Cara hitung (countMode)</H3>
            <Table
                headers={["Mode", "Yang dihitung", "Tampil sebagai"]}
                rows={[
                    ["PCS", "Σ jumlah barang (qty × pcs)", "“5 pcs”"],
                    ["QTY", "Σ baris quantity", "“5 qty”"],
                    ["OMZET", "Σ harga × qty", "“Rp …”"],
                    ["NOTA", "Berapa nota mengandung produk itu", "“5 nota”"],
                ]}
            />

            <H3>Atribusi ke siapa</H3>
            <Table
                headers={["Divisi", "Dihitung dari"]}
                rows={[
                    ["CS", "Nota lead closing yang ia pegang + transaksi walk-in yang ia layani"],
                    ["Designer", "Nota dari SO (Sales Order) yang ia buat"],
                    ["Operator", "Item dari job cetak/produksi yang ia kerjakan sampai selesai"],
                ]}
            />

            <Callout type="tip" title="Tiap varian = produk berbeda">
                Karena nama varian berbeda, tiap varian diperlakukan sebagai item tersendiri. Pilih varian yang tepat — hanya varian yang dicentang yang dihitung.
            </Callout>
            <Callout type="tip" title="Aturan lanjutan (opsional)">
                Selain memilih varian, bisa juga mencocokkan berdasarkan <strong>kategori</strong> atau <strong>kata kunci nama</strong> (mis. “jersey”) lewat bagian “Aturan lanjutan”. Cocok bila produknya banyak dan ingin cakupan luas.
            </Callout>
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

            <H3 id="alur-order">Alur Order CS &amp; Desainer (Satu Pintu)</H3>
            <Callout type="tip" title="Prinsip Satu Pintu — CS pemilik lead">
                Setiap calon order = <strong>1 lead</strong>, dan <strong>CS yang memegangnya</strong>. Desainer boleh ikut
                (cek desain / bikin SO), tapi pekerjaannya <strong>menempel ke lead CS</strong> — bukan bikin data paralel.
                Jadi <strong>tidak ada lead dobel</strong>. Semua order berakhir di titik yang sama: <strong>nota dibuat di KASIR (POS)</strong> biar formatnya seragam.
            </Callout>

            {/* ── Diagram alur visual ── */}
            <div className="my-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Alur utama (CS)</div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 font-medium text-gray-800">📥 Customer masuk</span>
                    <span className="text-gray-400 font-bold">→</span>
                    <span className="px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-800 font-medium">👤 CS buat Lead<span className="block text-[11px] font-normal">produk boleh belakangan</span></span>
                    <span className="text-gray-400 font-bold">→</span>
                    <span className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-medium">Follow-up / Nego</span>
                </div>
                <div className="flex flex-wrap items-start gap-2 pl-3">
                    <span className="text-gray-400 font-bold mt-1.5">└─ FINAL →</span>
                    <div className="flex flex-col gap-2">
                        <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">✅ DEAL → <strong>🧾 Buat Nota di Kasir</strong> → buat customer+SO → POS → nota jadi → lead <strong>CLOSED_WON</strong> otomatis</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium">❌ BATAL → tombol <strong>Lost</strong> → isi alasan + (opsional) produk yang batal</span>
                    </div>
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-1">Sisi Desainer</div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1.5 rounded-lg bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 font-medium">🎨 Desainer bikin SO → &quot;SO jadi Lead&quot;</span>
                    <span className="text-gray-400 font-bold">→</span>
                    <span className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium">cek nomor HP</span>
                    <span className="text-gray-400 font-bold">→</span>
                    <div className="flex flex-col gap-1.5">
                        <span className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-800">HP sudah ada lead CS? → <strong>tempel ke lead itu</strong> (satu pintu, tanpa dobel)</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-800">belum ada? → baru bikin lead (designer kontak pertama)</span>
                    </div>
                </div>
            </div>

            <H3>Cek Desain (pra-jual) — kerja tim CS &amp; Desainer</H3>
            <P>
                Kalau customer tanya <em>&quot;ini bisa dicetak nggak?&quot;</em> sebelum deal: di detail lead, CS menunjuk
                <strong> Desainer</strong> yang mengecek, lalu isi hasilnya — <strong>Bisa / Tidak bisa / Revisi</strong>.
                Outcome lead (closing/batal) dihitung untuk <strong>CS dan Desainer sekaligus</strong> (kerja tim) — jadi effort
                cek desain yang batal pun tetap tercatat di KPI desainer.
            </P>

            <H3>3 Jalur Order (siapa pertama pegang customer)</H3>
            <P>Titik akhir sama (nota di POS). Bedanya cuma awalnya:</P>
            <Table
                headers={["Jalur", "Kapan terjadi", "Langkahnya", "Kredit"]}
                rows={[
                    [
                        <strong key="a">A. Lewat CS</strong>,
                        "Customer chat WA/IG ke CS, belum ada SO",
                        <>CS catat lead → follow-up → deal → klik <strong>🧾 Buat Nota di Kasir</strong> → POS terbuka, finalisasi produk &amp; bayar → nota jadi. (Ada juga &quot;Nota cepat tanpa kasir&quot; untuk kasus khusus.)</>,
                        "CS",
                    ],
                    [
                        <strong key="d">B. Lewat Desainer</strong>,
                        "Customer langsung ke desainer, order sudah pasti",
                        <>Desainer buat SO → tombol <strong>Buat Nota (Kirim)</strong> → kasir buka POS &quot;Buat dari SO&quot; → checkout</>,
                        "Desainer",
                    ],
                    [
                        <strong key="b">C. Gabungan (Lead Order)</strong>,
                        "Order lewat desainer tapi masih nego / belum pasti",
                        <>Desainer buat SO → tombol <strong>Lead Order (CS)</strong> → lead otomatis dibuat & tertaut → CS follow-up → klik <strong>🧾 Buat Nota di POS</strong> → checkout → lead otomatis closing</>,
                        "CS + Desainer (1 nota yang sama)",
                    ],
                ]}
            />
            <Callout type="warning" title="Anti lead/nota dobel — otomatis">
                Saat desainer menekan <strong>&quot;SO jadi Lead&quot;</strong>, sistem <strong>cek nomor HP dulu</strong>: kalau customer
                sudah punya lead CS yang aktif, SO <strong>otomatis ditempel</strong> ke lead itu (jadi Negosiasi) — <strong>tidak bikin lead baru</strong>.
                Jadi tabrakan &quot;CS sudah bikin lead, lalu desainer bikin lagi&quot; sudah tertangani sendiri.
                Untuk SO yang dibuat di tempat lain, CS juga bisa pakai tombol <strong>Tautkan SO</strong> di detail lead.
            </Callout>
            <H3>Langkah CS di jalur C (Lead Order)</H3>
            <Steps steps={[
                { title: "Lead muncul otomatis di /crm/leads", desc: "Desainer menekan Lead Order — lead langsung berstatus Negosiasi, level HOT, estimasi harga terisi dari item SO. Notif masuk ke Discord #penjualan." },
                { title: "CS follow-up seperti biasa", desc: "Chat customer, catat aktivitas, naik-turunkan status. Kotak ungu “Tertaut ke Sales Order” tampil di detail lead." },
                { title: "Deal → klik “🧾 Buat Nota di POS”", desc: "POS terbuka dengan cart ter-prefill dari SO. Checkout seperti transaksi biasa." },
                { title: "Selesai otomatis", desc: "Lead jadi CLOSED_WON menunjuk nota itu, SO jadi INVOICED. CS dapat closing, desainer dapat omzet — tanpa nota dobel." },
            ]} />

            <H3>Tombol closing di detail lead</H3>
            <P>
                Saat lead deal, ada <strong>dua tombol</strong> — utama dan cadangan:
            </P>
            <Table
                headers={["Tombol", "Untuk apa", "Yang terjadi"]}
                rows={[
                    [<strong key="k">🧾 Buat Nota di Kasir <span className="text-emerald-600">(utama)</span></strong>, "Alur normal — nota dibuat di kasir", "Buat customer + SO → diarahkan ke POS (cart ter-prefill) → CS finalisasi & bayar → nota jadi → lead CLOSED_WON otomatis"],
                    [<strong key="c">Nota cepat (tanpa kasir)</strong>, "Kasus khusus — butuh nota langsung", "Langsung bikin customer + nota + job produksi dari lead, tanpa lewat kasir (model lama / Convert)"],
                ]}
            />
            <P>Saat pakai <strong>Nota cepat / Convert</strong>, sistem membuat:</P>
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
                Designer mengakses portal di <Code>/so-designer</Code> dengan PIN — tanpa perlu login ke akun kasir —
                dan bisa membuat SO sendiri (upload proof ACC, paste screenshot, edit selama belum jadi nota).
            </P>
            <P>Saat menyimpan SO, desainer memilih <strong>satu dari tiga tombol</strong> sesuai kepastian order:</P>
            <Table
                headers={["Tombol", "Kapan dipakai", "Yang terjadi"]}
                rows={[
                    [<strong key="d">Simpan Draft</strong>, "Masih dikerjakan, belum final", "SO tersimpan DRAFT — bisa diedit / dikirim nanti dari detail"],
                    [<strong key="l">Lead Order (CS)</strong>, "Order belum pasti / customer masih nego", "Lead CRM otomatis dibuat & tertaut ke SO — CS yang lanjut follow-up (jalur C di atas)"],
                    [<strong key="n">Buat Nota (Kirim)</strong>, "Order sudah pasti", "SO di-broadcast ke Discord #produksi — kasir tinggal buka POS “Buat dari SO” lalu checkout"],
                ]}
            />

            <H3>Leaderboard Tim — lihat performa CS &amp; Desainer</H3>
            <P>
                Semua KPI tim ada di menu <strong>Tim &amp; Kinerja → Leaderboard</strong> (<Code>/leaderboard</Code>):
                performa <strong>CS</strong> (leads, closing, lost, cuan bersih) dan <strong>Desainer</strong>
                (cek desain, produktivitas jasa desain, SO dibuat, omzet) — lengkap dengan <strong>gelar juara</strong>
                (Raja Cuan, Raja Closing, Raja SO, Raja Desain, dll), grafik, filter periode/divisi/cabang, dan
                tombol <strong>&quot;Cara Hitung&quot;</strong> di tiap angka biar tim tahu sumber penghitungannya.
            </P>
        </>
    );
}

function SecWhatsApp() {
    return (
        <>
            <H2 id="whatsapp">Notifikasi: Discord & WhatsApp Bot</H2>

            <H3>Discord (utama)</H3>
            <P>
                Notifikasi PosPro kini dikirim via <strong>Discord webhook per cabang</strong> — lead baru,
                deal closing, Surat Order + gambar desain, pesanan siap diambil, stok menipis, tutup shift,
                transaksi baru, backup, dan error sistem.
            </P>
            <Steps steps={[
                { title: "Buka Pengaturan → Discord", desc: "Aktifkan master toggle notifikasi." },
                { title: "Isi webhook URL per channel untuk tiap cabang", desc: "Channel: penjualan, produksi, keuangan, inventory, leaderboard, system. Buat webhook dari Discord: Server Settings → Integrations → Webhooks." },
                { title: "Klik Test per channel", desc: "Pastikan pesan test masuk ke channel yang benar. Event cabang hanya terkirim ke webhook cabang itu." },
            ]} />

            <H3>WhatsApp Bot (opsional — nonaktif default)</H3>
            <Callout type="warning" title="Bot WA dinonaktifkan secara default">
                Sejak notifikasi pindah ke Discord, bot WhatsApp tidak dijalankan otomatis. Untuk
                mengaktifkan kembali: set <Code>WHATSAPP_ENABLED=true</Code> di file <Code>.env</Code> backend
                lalu restart server.
            </Callout>
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

function SecWhatsAppCRM() {
    return (
        <section className="mb-12">
            <H2 id="whatsapp-crm">WhatsApp CRM (Cloud API resmi Meta)</H2>
            <P>
                Inbox WhatsApp bisnis terpadu di <Code>/crm/whatsapp</Code> memakai <strong>WhatsApp Business Cloud API resmi Meta</strong> — balas chat pelanggan langsung dari PosPro,
                kirim media, template, broadcast, reminder otomatis, dan ukur performa CS. Semua percakapan tersambung ke Lead pipeline & leaderboard.
            </P>
            <Callout type="info" title="Beda dengan “WhatsApp Bot” lama">
                Modul ini <strong>resmi & terpisah</strong> dari bot lama (scan QR, untuk notifikasi Discord/grup). WhatsApp CRM ini pakai nomor bisnis terdaftar di Meta, stabil, dan tidak perlu HP menyala.
            </Callout>

            <H3 id="wa-alur-masuk">Alur pesan masuk (otomatis)</H3>
            <Steps steps={[
                { title: "Pelanggan chat ke nomor bisnis", desc: "Pesan dikirim Meta ke server via Webhook (sudah diverifikasi + tanda tangan diperiksa)." },
                { title: "Diarahkan ke channel/cabang", desc: "Berdasarkan phone_number_id → cocokkan ke Channel WA cabang." },
                { title: "Tautkan / auto-buat Lead", desc: "Nomor dicocokkan ke Lead (dedup by HP); kalau belum ada & fitur aktif → Lead baru status NEW sumber WHATSAPP." },
                { title: "Auto-reply (opsional)", desc: "Jika ada aturan cocok (kata kunci / salam / di luar jam) → balasan otomatis." },
                { title: "Muncul di Inbox", desc: "Percakapan tampil dengan penanda belum dibaca; media diarsipkan ke server." },
            ]} />

            <H3 id="wa-inbox">Inbox Chat — balas & kelola percakapan</H3>
            <P>Fungsi-fungsi di panel percakapan:</P>
            <Ul>
                <li><strong>Balas teks</strong> — ketik & Enter. <strong>Emoji picker</strong> (tombol 😊) sisip emoji di posisi kursor.</li>
                <li><strong>Kirim lampiran</strong> (📎) — gambar, dokumen, PDF, Word/Excel/PowerPoint, audio, video (maks 90MB). Klik gambar → <strong>pratinjau layar penuh</strong> + tombol unduh.</li>
                <li><strong>Reply/kutip</strong> — hover pesan → Balas; kutipan menampilkan thumbnail media, dan <strong>diklik untuk lompat</strong> ke pesan aslinya.</li>
                <li><strong>Reaksi emoji</strong> — hover → 😊 → 👍❤️😂😮😢🙏 (klik lagi untuk hapus).</li>
                <li><strong>Tanda dibaca</strong> — membuka percakapan otomatis menandai pesan pelanggan “dibaca” (centang biru di sisi mereka).</li>
                <li><strong>Ambil chat</strong> — tombol “Ambil” menjadikan Anda pemilik percakapan (juga otomatis saat Anda membalas chat tanpa pemilik).</li>
                <li><strong>Badge Lead</strong> — header menampilkan tahap pipeline lead tertaut + tautan membuka lead di CRM.</li>
                <li><strong>Selesai</strong> — tandai percakapan CLOSED.</li>
            </Ul>
            <Callout type="warning" title="Jendela layanan 24 jam (aturan Meta)">
                Dalam <strong>24 jam</strong> sejak pesan terakhir pelanggan, Anda bebas balas teks/media. Di <strong>luar 24 jam</strong>, hanya bisa mengirim <strong>template</strong> yang sudah di-<em>APPROVED</em> Meta.
            </Callout>

            <H3 id="wa-template">Template Pesan Meta — /crm/whatsapp/templates</H3>
            <P>Template = pesan pra-tulis yang disetujui Meta, dipakai untuk balas di luar 24 jam, broadcast, dan reminder.</P>
            <Steps steps={[
                { title: "Buat template", desc: <>Nama huruf kecil/underscore, bahasa, kategori. Ketik isi dengan variabel <Code>{"{{1}}"}</Code>, <Code>{"{{2}}"}</Code>.</> },
                { title: "Isi keterangan tiap variabel", desc: "Form otomatis mendeteksi variabel → beri keterangan (mis. Nama pelanggan) + contoh nilai (wajib agar lolos review)." },
                { title: "Submit ke Meta", desc: "Status jadi PENDING → tunggu review (menit–jam) → APPROVED." },
                { title: "Sinkron status", desc: "Tombol Sinkron menarik status terbaru dari Meta." },
            ]} />
            <Callout type="info" title="Kategori template">
                <strong>UTILITY</strong> (transaksional: pesanan siap, tagihan) — murah. <strong>MARKETING</strong> (promo) — lebih mahal. <strong>AUTHENTICATION</strong> (OTP).
            </Callout>

            <H3 id="wa-broadcast">Broadcast — /crm/whatsapp/broadcast</H3>
            <P>Blast template ke segmen kontak (dijalankan bertahap dengan throttle). Kontak yang <strong>opt-out</strong> otomatis dikecualikan. Butuh template APPROVED.</P>

            <H3 id="wa-reminder">Reminder POS otomatis — /crm/whatsapp/reminders</H3>
            <P>Hubungkan event POS ke template → pelanggan dapat WA otomatis:</P>
            <Table
                headers={["Event", "Kapan terkirim", "Contoh template"]}
                rows={[
                    ["ORDER_READY", "Pesanan ditandai siap diambil", "pesanan_siap"],
                    ["PAYMENT_DUE", "Tagihan/pembayaran jatuh tempo", "reminder_pembayaran"],
                    ["FOLLOWUP_DUE", "Follow-up terjadwal jatuh tempo", "(template follow-up)"],
                ]}
            />

            <H3 id="wa-autoreply">Auto-reply — /crm/whatsapp/auto-reply</H3>
            <P>Balasan otomatis berbasis aturan: <strong>kata kunci</strong>, <strong>salam</strong> (chat pertama), <strong>di luar jam</strong>, atau <strong>default</strong>. Balas “STOP” dari pelanggan → otomatis opt-out.</P>

            <H3 id="wa-analitik">Analitik, Biaya & Kecepatan Balas CS — /crm/whatsapp/analytics</H3>
            <Ul>
                <li><strong>Metrik pesan</strong> — masuk/keluar, % terkirim & dibaca, lead dari WA, performa broadcast, grafik harian.</li>
                <li><strong>Estimasi biaya</strong> — volume pesan berbayar per kategori (Marketing/Utilitas/Autentikasi) × tarif yang Anda setel → total. Pesan layanan (dalam 24 jam) gratis. Tarif resmi tetap dari WhatsApp Manager → Billing.</li>
                <li><strong>Kecepatan balas CS</strong> — First Response Time per agen (rata-rata, median, tercepat, %≤target). Dinilai ke <strong>agen yang benar-benar membalas</strong>; auto-reply tak dihitung.</li>
            </Ul>

            <H3 id="wa-media">Penyimpanan Media — /crm/whatsapp/settings</H3>
            <P>Media inbound & outbound diarsipkan permanen ke server (kartu <strong>Penyimpanan Media</strong>): total dipakai, sisa disk, rincian per bulan, dan tombol <strong>bersihkan media sebelum tanggal</strong> (riwayat teks tetap).</P>
            <Callout type="warning" title="Kenapa perlu arsip">
                Meta hanya menyimpan file media ±30 hari. Arsip lokal memastikan gambar/dokumen lama tetap bisa dibuka.
            </Callout>

            <H3 id="wa-channel">Pengaturan Channel & Profil Bisnis — /crm/whatsapp/settings</H3>
            <Ul>
                <li><strong>Channel per cabang</strong> — daftarkan nomor (Phone Number ID + WABA ID), aktif/nonaktif, <strong>Health check</strong> verifikasi kredensial.</li>
                <li><strong>Profil bisnis</strong> — tombol “Profil”: about, deskripsi, alamat, email, kategori, website, dan <strong>ganti foto profil</strong> — tersimpan langsung ke Meta.</li>
            </Ul>

            <H3 id="wa-leaderboard">Integrasi ke Leaderboard CS</H3>
            <P>Metrik WhatsApp menyatu di <Code>/leaderboard</Code> divisi CS (bukan silo terpisah):</P>
            <Ul>
                <li>Kolom <strong>Balas WA</strong> (kecepatan + %≤target) & <strong>Chat WA</strong> (jumlah percakapan ditangani), champion <strong>Tercepat Balas WA</strong>.</li>
                <li>Klik angkanya → <strong>rincian per chat</strong> (waktu balas tiap percakapan).</li>
                <li>Atribusi konsisten ke <strong>pengirim balasan</strong>; navigasi dua arah lead ↔ chat.</li>
            </Ul>

            <H3 id="wa-peran">Peran & akses</H3>
            <Table
                headers={["Fitur", "Peran"]}
                rows={[
                    ["Inbox (balas, reply, reaksi)", "CS · Marketing · Admin · Owner"],
                    ["Template, Broadcast, Reminder, Auto-reply", "Owner · Admin · Marketing"],
                    ["Channel, Profil, Penyimpanan media", "Owner · Admin"],
                    ["Analitik, Biaya, Benchmark CS", "Owner · Admin · Marketing"],
                ]}
            />

            <H3 id="wa-setup">Setup awal (sekali — Owner/Admin)</H3>
            <Steps steps={[
                { title: "Meta App + produk WhatsApp", desc: "Buat WABA, daftarkan nomor bisnis (verifikasi OTP)." },
                { title: "Token & rahasia", desc: "Isi WA_ACCESS_TOKEN (System User, permanen), WA_APP_SECRET, WA_VERIFY_TOKEN, WA_APP_ID di .env server; set WA_CLOUD_ENABLED=true." },
                { title: "Webhook", desc: <>Callback <Code>https://DOMAIN/whatsapp/webhook</Code> + verify token; subscribe field <Code>messages</Code>.</> },
                { title: "Daftarkan Channel + Verifikasi Bisnis + Pembayaran", desc: "Tambah Channel per cabang; selesaikan Business Verification & metode pembayaran di Meta agar bisa kirim ke semua pelanggan." },
            ]} />
            <Callout type="tip" title="Tips penting">
                Gunakan token <strong>permanen (System User, Never expire)</strong> — token 24 jam akan mati. Buat template UTILITY dulu (murah & cepat approve) untuk reminder pesanan.
            </Callout>
        </section>
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
                { title: "Pilih grup data → klik Export Backup", desc: "Sistem generate file ZIP berisi dump database MySQL + foto (proof SO, gambar lead, dll) — download otomatis. Grup data bisa dipilih sebagian (mis. hanya transaksi & CRM)." },
                { title: "Simpan file ZIP di tempat aman", desc: "Bisa di cloud, USB, atau storage eksternal." },
                { title: "Auto-Backup Server via Rclone", desc: "Konfigurasi di bagian bawah halaman Backup — jadwal cron, jumlah file yang disimpan, dan remote tujuan (Google Drive dll). Status & daftar file backup lokal tampil di halaman yang sama, plus notifikasi hasil backup ke Discord." },
                { title: "Restore mandiri dari halaman yang sama", desc: "Upload/drag file backup (.zip/.sql) → sistem tampilkan preview isi per tabel → pilih tabel yang mau direstore → pilih mode Skip Existing (aman) atau Overwrite (hapus & tulis ulang) → konfirmasi. Foto & konfigurasi ikut dipulihkan dari file ZIP." },
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
        { q: "Bot WhatsApp terputus / tidak jalan?", a: "Bot WhatsApp kini NONAKTIF secara default — notifikasi sudah pindah ke Discord (Pengaturan → Discord). Kalau masih ingin memakai bot WA, set WHATSAPP_ENABLED=true di file .env backend lalu restart server, kemudian scan ulang QR di Pengaturan → WhatsApp Bot." },
        { q: "Cara backup data?", a: "Pengaturan → Backup → pilih grup data → klik Export Backup (file ZIP berisi database + foto terdownload otomatis). Aktifkan juga Auto-Backup Server (rclone) supaya backup terjadwal otomatis ke cloud storage." },
        { q: "Cara restore data dari backup?", a: "Pengaturan → Backup → bagian Restore → upload/drag file backup (.zip/.sql). Sistem menampilkan preview isi per tabel — pilih tabel yang mau direstore, pilih mode Skip Existing (aman, hanya isi data yang belum ada) atau Overwrite (hapus & tulis ulang), lalu konfirmasi." },
        { q: "Bagaimana setting notifikasi Discord per cabang?", a: "Pengaturan → Discord → aktifkan master toggle → isi webhook URL per channel (penjualan, produksi, keuangan, inventory, dll) untuk TIAP cabang → klik Test per channel. Event cabang hanya terkirim ke webhook cabang itu." },
        { q: "Lead Order desainer itu apa?", a: "Dari portal desainer, setelah membuat SO desainer bisa menekan tombol 'Lead Order (CS)'. Sistem otomatis membuat lead CRM tertaut, menyalin gambar desain ke galeri lead, dan mengirim notifikasi + gambar ke Discord CS (#penjualan) dan #produksi. Kalau SO direvisi lalu Lead Order ditekan lagi, data & gambar lead ikut tersinkron dan Discord mendapat notif revisi." },
        { q: "Kenapa sebelum 'Buat Nota di POS' dari lead diminta isi CS & sumber lead?", a: "Supaya KPI CS dan laporan sumber lead akurat. Lead bikinan desainer hanya tahu 'SO Desainer' — sumber sebenarnya (WA, IG, walk-in, dll) hanya diketahui CS. Isi kedua field di modal, lalu sistem lanjut ke POS di tab yang sama." },
        { q: "Harga di lead/SO kok beda dengan harga di nota?", a: "Sudah tidak lagi — harga tier varian (harga bertingkat di Manajemen Stok) kini dipakai konsisten di item lead CRM, estimasi SO desainer, dan nota POS. Harga hasil nego yang diketik manual oleh CS tetap dihormati dan tidak ditimpa." },
        { q: "Kenapa nomor nota sekarang ada kode cabangnya (SO-PST-...)?", a: "Penomoran nota, SO, dan nomor checkout kini per cabang: SO-{KODE}-{TANGGAL}-{URUT}. Tiap cabang punya urutan harian sendiri sehingga nomor antar cabang tidak bercampur. Pastikan setiap cabang punya Kode di Pengaturan → Cabang." },
        { q: "Kenapa jumlah pcs di CRM tidak menghitung kerah/lengan?", a: "Item dari kategori add-on (komponen yang menempel ke produk utama) sengaja tidak dihitung di metrik pcs — supaya 1 jersey + kerah + lengan terhitung 1 pcs, bukan 3. Atur lewat Inventori → Kategori → centang/matikan 'hitung pcs' per kategori." },
        { q: "Bagaimana memfilter CRM Dashboard per cabang/staff/waktu?", a: "Di bagian atas CRM Dashboard ada filter waktu (Hari Ini / 7 Hari / Bulan Ini / Custom), filter Cabang (khusus Owner), dan filter Staff. Ketiganya berlaku untuk semua metrik, chart, dan leaderboard di halaman itu." },
        { q: "Laporan Cashflow tidak sesuai?", a: "Periksa entry dengan userId = null (entry otomatis dari kasir). Jangan hapus entry otomatis tersebut — itu adalah record transaksi penjualan." },
        { q: "Produk Area Based tidak muncul di kasir?", a: "Pastikan tipe produk adalah 'Produk Jual' (SELLABLE), bukan 'Bahan Baku'. Bahan Baku tidak muncul di kasir." },
        { q: "Bagaimana mencatat potongan Shopee/Tokopedia?", a: "Di POS, gulir ke bawah form checkout → klik + Tambah Potongan → isi nama platform dan nominal. Bisa lebih dari satu baris. Cashflow otomatis split: INCOME (nett diterima) + EXPENSE Biaya Platform. Jika lupa diisi saat transaksi, bisa diisi saat pelunasan di menu DP & Piutang." },
        { q: "Potongan marketplace hanya untuk transaksi marketplace?", a: "Tidak wajib. Field ini bisa digunakan untuk potongan apapun — komisi agen, GoFood, GrabFood, dll. Isi sesuai kebutuhan." },
        { q: "Filter di Pipeline Produksi tidak berfungsi?", a: "Filter bekerja di sisi client — data sudah dimuat saat halaman dibuka. Klik Reset filter untuk memastikan semua filter bersih. Jika data tidak update, tunggu 60 detik (auto-refresh) atau reload halaman." },
        { q: "Apakah kasir tetap jalan saat internet putus?", a: "Ya, jika memakai Aplikasi Desktop (Windows). Aplikasi desktop menjalankan database & backend-nya sendiri sehingga semua fitur (kasir, stok, laporan, CRM) tetap jalan 100% offline. Transaksi yang dibuat offline otomatis tersinkron ke server pusat begitu kembali online." },
        { q: "Transaksi offline saya sudah aman belum?", a: "Transaksi offline baru benar-benar aman setelah tersinkron ke pusat. Pastikan perangkat online secara berkala. Aplikasi desktop juga auto-backup setiap dibuka (7 backup terakhir) dan bisa backup manual .sql kapan saja lewat menunya." },
        { q: "Bagaimana cetak struk thermal 58mm?", a: "Saat mencetak nota, pilih format Thermal 58mm (format A5 lama tetap ada). Koneksi ke printer bisa via Bluetooth (Web Bluetooth di Chrome/Android), Aplikasi Desktop (langsung ke printer Windows/USB), Printer Relay (untuk cabang tanpa desktop app), atau fallback dialog print browser." },
        { q: "Cetak Bluetooth tidak jalan di iPhone?", a: "Web Bluetooth tidak didukung di Safari iOS, jadi cetak thermal via Bluetooth langsung dari iPhone/iPad tidak bisa. Gunakan Aplikasi Desktop, Printer Relay, atau fallback print browser sebagai gantinya." },
        { q: "Alur desainer (SO → Lead → Nota) jalan di aplikasi desktop offline?", a: "Ya, untuk KONVERSI. SalesOrder & Lead ikut ditarik ke perangkat desktop, jadi kasir bisa membuka SO/Lead, prefill keranjang, dan buat nota meski offline. Saat nota tersinkron ke pusat, SO otomatis jadi INVOICED dan lead jadi CLOSED_WON. Yang perlu online: MEMBUAT SO/Lead baru (portal desainer /so-designer & closing 'Buat Nota di Kasir' pada lead yang belum punya SO). Foto proof desain juga hanya tampil saat online (file gambar tidak ikut disinkron)." },
    ];

    // Paginasi — aktif saat FAQ melebihi 20 item
    const pg = usePagination(faqs, 20);

    return (
        <>
            <H2 id="faq">FAQ & Troubleshooting</H2>
            <div className="space-y-3">
                {pg.pageItems.map((faq, i) => (
                    <details
                        key={`${pg.page}-${i}`}
                        className="group border border-border rounded-xl overflow-hidden"
                    >
                        <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-muted/50 hover:bg-muted transition-colors list-none">
                            <span className="font-medium text-foreground text-sm">{faq.q}</span>
                            <ChevronDown
                                size={16}
                                className="text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-180"
                            />
                        </summary>
                        <div className="px-4 py-3 text-muted-foreground text-sm leading-relaxed border-t border-border">
                            {faq.a}
                        </div>
                    </details>
                ))}
            </div>
            <PaginationBar {...pg} />
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
            desc: "Lead dicatat (manual oleh CS, atau otomatis dari tombol Lead Order desainer), CS di-assign, follow-up dijadwalkan. Status: Baru → Follow Up → Negosiasi",
            tag: "CRM → Pipeline Lead",
            tagColor: "bg-pink-100 text-pink-700",
            card: "from-pink-50 to-rose-50 border-pink-200",
            dot: "bg-pink-500",
        },
        {
            emoji: "🛒",
            title: "Deal! Kasir Input Transaksi",
            desc: "Lead di-convert → transaksi terbuat otomatis. Atau nota dibuat dari SO desainer (POS → Buat dari SO; lead yang tertaut otomatis closing). Atau kasir input manual di POS.",
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

function SecThermal() {
    return (
        <>
            <H2 id="thermal">Cetak Nota Thermal 58mm</H2>
            <P>
                Selain nota A5 (PDF/browser), PosPro mendukung cetak <strong>struk thermal 58mm</strong> —
                cocok untuk printer struk mini kasir. Struk dirender otomatis (logo, item, total, footer)
                lalu dikirim ke printer. Format A5 lama tetap tersedia dan tidak berubah.
            </P>

            <H3>Cara Mengaktifkan</H3>
            <Steps steps={[
                { title: "Pilih format Thermal 58mm", desc: <>Saat mencetak nota, pilih opsi struk <strong>Thermal 58mm</strong> (default A5 tetap ada).</> },
                { title: "Pilih metode koneksi printer", desc: "Sesuaikan dengan perangkat kamu — lihat tabel di bawah." },
                { title: "Cetak", desc: "Struk otomatis dirender dan dikirim ke printer thermal." },
            ]} />

            <H3>Metode Koneksi Printer</H3>
            <Table
                headers={["Metode", "Kapan dipakai"]}
                rows={[
                    [<><strong>Bluetooth</strong> (Web Bluetooth)</>, "Printer thermal Bluetooth langsung dari HP/laptop (Chrome/Android). Struk dikirim sebagai gambar raster ESC/POS."],
                    [<><strong>Aplikasi Desktop</strong></>, "Cetak langsung ke printer Windows (spooler RAW) atau USB/COM. Bisa juga dijadikan pusat cetak — melayani cetak dari device lain (lihat Aplikasi Desktop)."],
                    [<><strong>Printer Relay</strong></>, "Untuk cabang tanpa aplikasi desktop: agen relay (di PC printer) meneruskan job cetak memakai token printer."],
                    [<><strong>Browser (fallback)</strong></>, "Cetak lewat dialog print browser bila metode di atas tak tersedia."],
                ]}
            />

            <Callout type="warning" title="Safari / iOS">
                Web Bluetooth <strong>tidak didukung di Safari iOS</strong>. Untuk iPhone/iPad,
                gunakan Aplikasi Desktop, Printer Relay, atau fallback browser.
            </Callout>

            <Callout type="tip" title="Nota panjang">
                Struk dengan banyak item dikirim sebagai gambar raster yang bisa berukuran besar —
                sistem sudah menaikkan batas ukuran kiriman agar nota panjang tidak gagal terkirim.
            </Callout>
        </>
    );
}

function SecDesktop() {
    return (
        <>
            <H2 id="desktop-app">Aplikasi Desktop (Offline)</H2>
            <P>
                PosPro tersedia sebagai <strong>aplikasi desktop Windows</strong> yang berjalan
                <strong> 100% offline</strong> — seluruh fitur (kasir, stok, laporan, CRM) tetap jalan
                tanpa internet. Data lokal otomatis tersinkron ke server pusat saat kembali online.
            </P>

            <Callout type="info" title="Kapan pakai versi desktop?">
                Untuk kasir yang harus tetap jalan meski internet putus, atau cabang dengan koneksi
                tidak stabil. Versi web/PWA tetap tersedia dan berbagi data yang sama.
            </Callout>

            <H3>Cara Kerja Offline</H3>
            <P>
                Aplikasi membawa database & backend-nya sendiri di dalam komputer. Setiap perangkat punya
                salinan data lokal (model <em>single-device</em>) yang dijahit ke pusat:
            </P>
            <Ul>
                <li><strong>Transaksi offline</strong> disimpan lokal, lalu <strong>dikirim ke pusat</strong> begitu online (otomatis tiap ±30 detik).</li>
                <li><strong>Data master</strong> (produk, harga, user, pelanggan, supplier) yang diubah di pusat <strong>turun otomatis</strong> ke perangkat.</li>
                <li>Cetak nota thermal jalan langsung ke printer — tanpa agen <Code>.bat</Code>/Python.</li>
            </Ul>
            <P>Operasi offline yang ikut tersinkron ke pusat:</P>
            <Ul>
                <li><strong>Transaksi jual</strong> + potong stok + cashflow-nya</li>
                <li><strong>Kas manual</strong> (kas masuk/keluar/biaya)</li>
                <li><strong>Pembelian / stok masuk</strong> dan <strong>stok opname</strong></li>
                <li><strong>Transfer stok antar cabang</strong></li>
            </Ul>
            <Callout type="info" title="Selalu konsisten">
                Stok & data keluar-masuk dijaga konsisten dua arah: setiap operasi diberi penanda unik
                sehingga <strong>tidak terhitung ganda</strong> walau sinkron diulang, dan nilai stok
                otoritatif dari pusat dikembalikan ke tiap perangkat.
            </Callout>

            <H3>Pemasangan Pertama (First-Run)</H3>
            <Steps steps={[
                { title: "Install aplikasi", desc: "Jalankan installer .exe. Database & backend sudah dibundel di dalamnya — tidak perlu install terpisah." },
                { title: "Daftarkan perangkat ke pusat", desc: "Masukkan alamat server pusat + token pendaftaran (dari Owner). Perangkat mendapat device token permanen — aman meski database di-reset." },
                { title: "Data awal terunduh", desc: "Produk, user, dan master data ditarik dari pusat. Setelah ini login & transaksi jalan penuh tanpa internet." },
            ]} />

            <H3>Backup, Recovery & Reset</H3>
            <Table
                headers={["Fitur", "Fungsi"]}
                rows={[
                    [<><strong>Auto-backup</strong></>, "Backup otomatis setiap aplikasi dibuka (menyimpan 7 backup terakhir)."],
                    [<><strong>Backup manual</strong></>, "Simpan file backup .sql ke lokasi pilihan kapan saja."],
                    [<><strong>Recovery</strong></>, "Bila database lokal rusak, aplikasi menawarkan pemulihan otomatis dari pusat."],
                    [<><strong>Reset</strong></>, "Hapus data lokal & tarik ulang dari pusat. Device token dipertahankan (tidak membuat perangkat ganda)."],
                ]}
            />

            <Callout type="warning" title="Sinkron sebelum perangkat hilang">
                Transaksi yang dibuat offline <strong>baru benar-benar aman setelah tersinkron ke pusat</strong>.
                Pastikan perangkat online secara berkala agar data tidak hilang bila komputer rusak atau hilang.
            </Callout>

            <H3>Jadikan Pusat Cetak (1 printer untuk banyak kasir)</H3>
            <P>
                Secara default aplikasi desktop hanya mencetak <strong>notanya sendiri</strong>. Namun PC yang
                terhubung ke printer bisa dijadikan <strong>pusat cetak cabang</strong>: kasir lain (tablet/HP/PC,
                cukup browser) mengirim nota, dan printer di PC ini yang mencetak — <strong>tanpa memasang apa pun
                di device lain</strong>.
            </P>
            <Steps steps={[
                { title: "Buat token printer di pusat", desc: <>Owner buka <Code>Settings → Printer</Code> di server pusat, tambahkan perangkat printer, lalu salin token-nya.</> },
                { title: "Isikan token di PC printer", desc: <>Masukkan token ke konfigurasi aplikasi (<Code>printerRelayToken</Code>). Setelah itu aplikasi otomatis melayani cetak dari device lain.</> },
                { title: "Kasir lain langsung cetak", desc: "Di device kasir lain, pilih metode Aplikasi Desktop/Printer Relay — nota tercetak di printer PC pusat." },
            ]} />
            <Callout type="warning" title="Syarat">
                PC pusat cetak <strong>harus menyala</strong> dan aplikasi berjalan. Semua device harus di
                <strong> cabang yang sama</strong>. Bila PC pusat mati, device lain tidak bisa mencetak.
            </Callout>

            <H3>Update Otomatis</H3>
            <P>
                Saat versi baru tersedia, aplikasi menampilkan <strong>banner notifikasi di dalam aplikasi</strong> —
                cukup klik <strong>Unduh</strong> lalu <strong>Pasang</strong>. Tidak perlu mengunduh installer manual.
            </P>
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
            { id: "produk-custom", label: "Produk Custom" },
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
            { id: "leaderboard", label: "Leaderboard Kinerja" },
            { id: "metrik-custom", label: "Metrik Produk Custom" },
        ],
    },
    {
        label: "Produksi & Cetak",
        icon: <Printer size={14} />,
        items: [
            { id: "produksi", label: "Antrian Produksi" },
            { id: "pipeline-produksi", label: "Pipeline & Filter" },
            { id: "thermal", label: "Cetak Nota Thermal 58mm" },
        ],
    },
    {
        label: "Dokumen B2B & CRM",
        icon: <FileText size={14} />,
        items: [
            { id: "invoice", label: "Invoice & SPH" },
            { id: "crm", label: "CRM & Lead Pipeline" },
            { id: "alur-order", label: "Alur Order CS & Desainer" },
        ],
    },
    {
        label: "Komunikasi",
        icon: <MessageSquare size={14} />,
        items: [
            { id: "whatsapp-crm", label: "WhatsApp CRM (Cloud API)" },
            { id: "whatsapp", label: "Notifikasi (Discord & WA Bot)" },
        ],
    },
    {
        label: "Multi-Cabang",
        icon: <Building2 size={14} />,
        items: [{ id: "multi-cabang", label: "Mode Cabang & Titip Cetak" }],
    },
    {
        label: "Aplikasi Desktop",
        icon: <Monitor size={14} />,
        items: [{ id: "desktop-app", label: "Aplikasi Desktop (Offline)" }],
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
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Panduan PosPro</div>
                <button
                    onClick={() => onNavigate("setup")}
                    className="text-[13px] text-accent-foreground hover:underline font-medium"
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
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
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
                                            ? "bg-primary/15 text-foreground font-semibold border-l-2 border-primary pl-[14px]"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
        <div className="min-h-dvh bg-background flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-4 gap-3 shadow-sm">
                <Link
                    href="/"
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                    <ArrowLeft size={15} />
                    <span className="hidden sm:inline">Kembali ke Aplikasi</span>
                </Link>
                <div className="w-px h-5 bg-border hidden sm:block" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen size={14} className="text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-foreground text-sm">Panduan PosPro</span>
                        <span className="hidden sm:inline text-muted-foreground text-sm ml-2">Manual Book &amp; Dokumentasi</span>
                    </div>
                </div>
                <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">v5.3</span>
                <button
                    className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle menu"
                >
                    {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </header>

            <div className="flex flex-1">
                {/* Sidebar Desktop */}
                <aside className="hidden lg:block w-60 shrink-0 border-r border-border sticky top-14 self-start h-[calc(100vh-3.5rem)]">
                    <Sidebar activeId={activeId} onNavigate={scrollTo} />
                </aside>

                {/* Sidebar Mobile */}
                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
                        <aside className="fixed top-14 left-0 bottom-0 z-50 w-64 bg-card border-r border-border lg:hidden overflow-y-auto shadow-xl">
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
                    <SecProdukCustom />
                    <SecPiutang />
                    <SecLaporan />
                    <SecLeaderboard />
                    <SecProduksi />
                    <SecThermal />
                    <SecInvoice />
                    <SecCRM />
                    <SecWhatsApp />
                    <SecWhatsAppCRM />
                    <SecCabang />
                    <SecDesktop />
                    <SecPengaturan />
                    <SecFAQ />

                    <div className="mt-16 pt-8 border-t border-border text-center">
                        <p className="text-sm font-semibold text-foreground">PosPro Manual Book</p>
                        <p className="text-xs text-muted-foreground mt-1">© 2026 Muhammad Faisal. All rights reserved.</p>
                        <Link href="/" className="inline-block mt-4 text-sm text-accent-foreground hover:underline font-medium">
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

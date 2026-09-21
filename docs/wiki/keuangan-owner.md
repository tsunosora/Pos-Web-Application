# 📈 Keuangan Owner

Kumpulan halaman yang hanya dilihat pemilik: bukan "berapa penjualan hari ini"
(itu ada di [Laporan Penjualan](laporan-penjualan.md)), tapi **apakah usahanya
sehat**.

![Dashboard owner](images/owner.webp)

Laporan laba kotor yang dipakai sehari-hari:

![Laporan laba kotor](images/profit.webp)

## Dashboard Owner dari atas ke bawah

Halaman **`/owner`** adalah satu layar panjang yang dibaca dari atas ke bawah.
Tiga tombol di bilah oranye membawa ke turunannya: *Analisa Keuangan*,
*Laporan Bulanan*, dan kembali ke aplikasi biasa.

### Delapan angka pokok

![Dashboard Owner: delapan kartu ringkasan keuangan dan bagian beban tetap bulanan](images/own-1-ringkasan.webp)

| Kartu | Isinya |
|---|---|
| **Omzet (terbayar)** | uang dari transaksi lunas, beserta jumlah transaksinya |
| **Laba Kotor** | omzet − HPP, lengkap dengan persentase margin |
| **Estimasi Laba Bersih** | laba kotor − beban tetap |
| **Piutang** | sisa tagihan **semua** nota belum lunas (DP & Bayar Nanti) di cabang terpilih, saat ini — tidak ikut periode |
| **HPP (modal)** | harga pokok barang yang terjual |
| **Beban Tetap / Bulan** | gaji, sewa, angsuran mesin — diisi sendiri di bawahnya |
| **Biaya Operasional (kas)** | pengeluaran kas periode itu (informasi; tidak dikurangkan lagi) |
| **Saldo Bank** | saldo tercatat dari penutupan shift |

Pemilih periode (*Hari Ini / 7 Hari / Bulan Ini / Kustom*) dan pemilih cabang
di kanan mengganti seluruh isi halaman.

Sejak 22 September 2026:

- **Omzet, Laba Kotor, dan Laba Bersih** dihitung menurut **tanggal lunas** nota
  (nota lama tanpa tanggal lunas memakai tanggal nota) — nota 30 Agustus yang
  lunas 2 September masuk September. Berlaku juga di `/reports/profit`.
- **Laba Kotor** sudah **dikurangi potongan marketplace**, jadi kategori kas
  *biaya platform* dan *pengosongan* (pindah saldo ke pusat) tidak lagi ikut
  Biaya Operasional.
- **Piutang** dulu hanya nota lead yang dibuat dalam periode; walk-in dan nota
  lama tidak terhitung.

### Tren, jam ramai, dan laba per kategori

![Bagian tengah dashboard: tren arus kas, jam ramai, dan laba per kategori](images/own-2-tengah.webp)

Berurutan: **Tren Arus Kas 6 bulan**, **Kapan Order Ramai / Sepi**, lalu
**Laba per Kategori / Mesin** — tabel yang menyandingkan omzet, modal, laba,
dan margin tiap kategori, sehingga terlihat pekerjaan mana yang tipis
marginnya meski ramai.

### Saldo, produk penyumbang laba, dan lead

![Saldo kas & bank, top produk penyumbang laba, serta ringkasan lead CRM](images/own-3-bawah.webp)

**Saldo Kas & Bank** memecah arus masuk/keluar per kanal (tunai, QRIS, bank).
**Top Produk Penyumbang Laba** mengurutkan delapan produk dengan laba kotor
tertinggi — bukan yang paling laku, tapi yang paling menghasilkan. Di bawahnya
ringkasan **Leads (CRM)**: total lead, closing, lost, closing rate, dan
sumbernya.

### Bonus, metrik kustom, dan beban tugas

![Bagian bawah dashboard: pengaturan bonus, pencapaian bonus, metrik produk custom, dan beban tugas karyawan](images/own-4-akhir.webp)

Empat bagian terakhir mengurus orang, bukan uang:

- **Pengaturan Bonus** per cabang dan **Pencapaian Bonus** — target dan
  realisasinya.
- **Metrik Produk Custom** — menentukan produk apa yang dihitung khusus di
  [Leaderboard](leaderboard.md).
- **Beban Tugas Karyawan** — siapa yang menumpuk pekerjaan, terhubung ke
  [Papan Tugas & Piket](papan-tugas-piket.md).
- **Penilaian CS** — rekap bintang dari [Rating CS](rating-cs.md).

## Langkah demi langkah

### 1. Laba kotor: omzet dikurangi HPP

![Laporan Laba Kotor dengan ringkasan pendapatan dikurangi harga pokok penjualan](images/ko-1-laba.webp)

Halaman **`/reports/profit`** menjawab pertanyaan yang tidak dijawab laporan
penjualan: dari omzet sekian, berapa yang benar-benar jadi laba setelah
dikurangi modal bahan. Angkanya memakai HPP yang disusun di
[Kalkulator HPP](hpp-calculator.md).

### 2. Rincian per produk & margin

![Rincian laba kotor per produk beserta margin](images/ko-2-rincian.webp)

Di sinilah terlihat produk yang ramai tapi tipis marginnya — informasi yang
tidak muncul di leaderboard maupun rekap penjualan.

### 3. Analisa keuangan: saldo kas sebagai candlestick

![Halaman Analisa Keuangan menampilkan grafik candlestick saldo kas harian](images/ko-3-analisa.webp)

**`/owner/analisa-keuangan`** menggambar saldo kas berjalan seperti grafik
saham: tiap batang mewakili satu periode (harian/mingguan/bulanan), sehingga
hari ramai dan hari sepi terbaca sebagai pola, bukan sebagai deretan angka.

### 4. Perbandingan periode & ke mana uang pergi

![Bagian perbandingan periode dengan omzet, pengeluaran, laba bersih, dan rincian pengeluaran](images/ko-4-anomali.webp)

Bagian bawahnya membandingkan periode berjalan dengan periode sebelumnya —
omzet, pengeluaran, dan laba bersih beserta selisih persennya — lalu memecah
**"Pengeluaran ke Mana"** per kategori. Ini bahan rapat bulanan yang biasanya
harus disusun manual di spreadsheet.

## Analisa Keuangan — `/owner/analisa-keuangan`

Satu halaman dengan banyak sudut pandang, masing-masing punya endpoint sendiri
di `/reports/finance/*`:

| Yang dijawab | Endpoint |
|---|---|
| Untung-rugi bulan ini, per cabang & gabungan | `/consolidation` |
| Perbandingan antar periode atau antar cabang | `/comparison` |
| Ke mana uang keluar (per kategori) | `/expense-breakdown` |
| Hari & jam paling ramai | `/heatmap`, `/orders-by-hour` |
| Pergerakan harian ala grafik lilin | `/candles` |
| Kejanggalan yang perlu diperiksa | `/anomalies` |
| Apakah target harian tercapai | `/daily-target-status` |
| Jurnal ringkas semua arus uang | `/journal` |
| Pencocokan kas sistem vs kas fisik | `/reconciliation` |

**Anomali** dan **rekonsiliasi** adalah yang paling berguna dalam praktik:
keduanya menunjuk selisih yang perlu ditelusuri, bukan sekadar menampilkan
angka besar.

Sejak 22 September 2026:

- **Perbandingan periode** untuk satu bulan kalender penuh memakai **bulan
  kalender sebelumnya** (Maret dibanding 1–28/29 Februari). Dulu mundur sepanjang
  hari yang sama (Maret dibanding 29 Januari–28 Februari). Laporan Bulanan ikut.
- **Rekonsiliasi** hanya menjumlahkan rekening **cabang terpilih**, sama dengan
  selisih shift-nya (dulu rekening semua cabang).
- **Target harian**: bila tidak diisi manual, target = (beban tetap cabang + bagian
  beban pusat) ÷ jumlah hari. Beban pusat kini dibagi rata ke **semua cabang aktif**,
  juga saat yang dilihat hanya satu cabang (dulu cabang itu menanggung seluruhnya).
  Omzet hari ini hanya pemasukan penjualan — modal pusat & pelunasan titipan tidak ikut.

Sejak 22 September 2026 rentang bawaan halaman analisa (bila tanggal tidak
dipilih) dimulai **tanggal 1 bulan ini menurut WIB**. Dulu tanggal 1 pukul 00.00
WIB terbaca sebagai akhir bulan lalu, sehingga satu hari bulan lalu ikut
terhitung. Temuan anomali (selisih kas shift, pengeluaran janggal) juga
dikelompokkan per hari WIB.

### Tutup buku bulanan

![Tutup Buku Bulanan: pendapatan per kanal per pekan, pengeluaran per kategori, dan daftar piutang](images/tb-1-tutupbuku.webp)

**`/reports/tutup-buku`** menyusun laporan akhir bulan **berbasis kas**: empat
kartu ringkas (Pendapatan, Pengeluaran, Laba/Rugi kas, Sisa Piutang), lalu
tabel *Pendapatan per Kanal* yang dipecah per pekan (01–07, 08–14, 15–21,
22–28, 29–30) untuk Cash, Transfer, dan QRIS.

Di bawahnya *Pengeluaran per Kategori* dengan pemecahan pekan yang sama, dan
daftar **piutang outstanding** beserta DP yang sudah masuk. Tombol **Excel**
dan **PDF** mengunduh versi yang siap dikirim.

### Laporan bulanan dengan analisa otomatis

![Laporan Bulanan Owner: omzet, pengeluaran, laba, margin, dan enam kotak analisa otomatis](images/lbl-1-bulanan.webp)

**`/owner/laporan-bulanan`** melakukan hal yang biasanya dikerjakan manual:
membaca angka bulan itu lalu menuliskan kesimpulannya. Enam kotak analisanya:

| Kotak | Isi contohnya |
|---|---|
| **Ringkasan Eksekutif** | laba, margin, dan perbandingan dengan bulan lalu |
| **Perkembangan Perusahaan** | tren beberapa bulan, bulan terbaik & terlemah |
| **Efisiensi Biaya** | pos biaya terbesar dan kenaikan yang perlu dicek |
| **Kesehatan Arus Kas** | piutang belum tertagih, hari paling ramai & paling sepi |
| **Peringatan** | pergerakan uang tidak jelas yang perlu ditinjau |
| **Rekomendasi** | tindakan konkret, mis. menagih piutang jatuh tempo |

Centang **Sertakan beban tetap** menambahkan biaya tetap bulanan ke
perhitungan, dan seluruh laporan bisa diekspor PDF/Excel.

## Kas pusat & pendanaan cabang

Untuk usaha bercabang, uang sering berpindah antar cabang dan pusat:

| Endpoint | Untuk |
|---|---|
| `/reports/finance/central-treasury` | saldo kas pusat (`central_treasury_entries`) |
| `/reports/finance/fund-branch` | mengirim modal ke cabang |
| `/reports/finance/central-expense` | pengeluaran yang ditanggung pusat |
| `/reports/finance/close-branch` | menutup buku satu cabang |

## Tutup Buku Bulanan — `/reports/tutup-buku`

Mengunci satu bulan agar angkanya tidak berubah lagi setelah dilaporkan.
Hasilnya tersimpan di `branch_monthly_closings`, dan laporan bulanannya
dibangkitkan di **`/owner/laporan-bulanan`** (`/reports/finance/monthly-report`).

Kunci ini penting saat ada koreksi nota belakangan: laporan bulan yang sudah
ditutup tetap seperti saat dilaporkan.

## Biaya tetap

Gaji, sewa, langganan, angsuran mesin — dicatat sekali di `fixed_expenses`
beserta tanggal jatuh temponya, lalu ikut masuk perhitungan laba supaya
"untung" yang muncul bukan hanya laba kotor.

> Isi tabel ini termasuk data paling sensitif di aplikasi (nominal gaji per
> orang). Perhatikan siapa yang boleh melihat menu ini — lihat
> [Akses Menu Role](karyawan-akun-pin.md#akses-menu-per-peran).

## Bonus & target

`bonus_targets` menetapkan target (per orang, per peran, atau per cabang) dan
`bonus_adjustments` mencatat penambahan/pengurangan manual. Angka pencapaiannya
diambil dari data yang sama dengan [Leaderboard](leaderboard.md), jadi tidak ada
rekap terpisah yang harus diisi tangan.

## Rekening bank & metode bayar

`bank_accounts` menyimpan rekening penerima transfer; saat kasir memilih
`BANK_TRANSFER` ia memilih rekening mana. Itulah yang memungkinkan
[Tutup Shift](tutup-shift.md) menghitung saldo yang seharusnya **per rekening**,
bukan hanya satu angka transfer.

## Permintaan perubahan kas

Staf tidak bisa mengubah catatan kas yang sudah masuk. Perubahannya diajukan
(`cashflow_change_requests`) dan disetujui Manajer — jejaknya tetap ada, jadi
koreksi tidak bisa dipakai untuk menutupi selisih.

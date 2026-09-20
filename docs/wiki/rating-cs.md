# ⭐ Penilaian Pelayanan (Rating CS)

Fitur kecil dengan pengaruh besar: pelanggan menilai pelayanan lewat tautan,
tanpa memasang aplikasi dan tanpa login.

## Alurnya

1. Owner/Manajer menyiapkan pertanyaan dan tampilannya di
   `GET/POST /cs-rating/config`.
2. CS mengirim undangan menilai (`POST /cs-rating/invite`) — biasanya lewat
   WhatsApp setelah pesanan diambil.
3. Pelanggan membuka **`/nilai/[token]`**. Tokennya sekali pakai dan tidak bisa
   ditebak, jadi tidak perlu login.
4. Jawaban masuk ke `cs_rating_responses` lewat
   `POST /cs-rating/public/:token/submit`.
5. Rekapnya dibaca di `GET /cs-rating/summary`.

Ada juga tautan **per cabang** (`/nilai/cabang/[branchId]`) untuk dipasang
sebagai QR di meja kasir — siapa pun boleh menilai tanpa diundang.

## Kenapa memakai tautan publik

Meminta pelanggan membuat akun hanya untuk memberi nilai akan membuat tidak ada
yang mengisi. Tokennya panjang dan acak; yang bisa dilakukan pemegang tautan
hanyalah mengisi penilaian satu kali.

Konfigurasinya disimpan di `cs_rating_configs` (bisa berbeda per cabang), dan
hasilnya ikut menjadi salah satu kolom di [Leaderboard](leaderboard.md).

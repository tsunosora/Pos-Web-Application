# Artikel / Blog

Buat artikel dengan editor **rich text** (seperti Word), tampilkan di landing page & halaman blog publik.

## Kelola artikel (admin)
- Menu **Artikel** di sidebar → `/articles`.
- **Artikel Baru** → isi: Judul, Slug (otomatis dari judul kalau dikosongkan), Gambar Sampul, Ringkasan, Penulis, **Isi Artikel** (editor: bold/italic, H2/H3, list, quote, link, sisip gambar), dan SEO (judul & deskripsi).
- Tombol **Draft** (simpan tanpa tayang) atau **Terbitkan** (tampil ke publik).

## Tampilan publik
- **Halaman blog**: `/artikel` (daftar) dan `/artikel/[slug]` (detail) — otomatis SEO (title/description/og-image dari artikel).
- **Blok di landing**: tambahkan blok **"Daftar Artikel"** di Landing Builder untuk menampilkan kartu artikel terbaru (atur jumlah, kolom, tautan "Lihat semua").
- Hanya artikel berstatus **Terbit** yang tampil ke publik.

## Domain
Halaman `/artikel` juga otomatis tersedia di domain custom landing (lihat [Landing Page](landing.md)).

## Aktivasi (developer)
- Backend: `npx prisma generate` lalu restart (tabel `articles`).
- Frontend: dependency Tiptap (`@tiptap/*`) sudah di `package.json`.

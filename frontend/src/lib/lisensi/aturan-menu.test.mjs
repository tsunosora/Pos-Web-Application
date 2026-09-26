/**
 * Tes murni untuk aturan "menu ikut isi kunci lisensi".
 *
 * Jalankan: `cd frontend && npm test`  (di balik layar: `node --test src/lib/lisensi/`)
 *
 * TANPA jest, tanpa React, tanpa node_modules. Node ≥ 22.18 bisa mengimpor `.ts` langsung
 * (tipe-nya dilepas sendiri), dan `aturan-menu.ts` sengaja tidak punya satu pun import — jadi
 * tes ini jalan di mesin yang `frontend/node_modules`-nya belum dipasang sekalipun.
 *
 * Yang dijaga di sini bukan kerapian kode, tapi empat keputusan yang kalau dilanggar merugikan
 * klien: gagal-terbuka saat permintaannya gagal, gagal-terbuka saat lisensi tidak ditegakkan,
 * menu tanpa pemetaan tetap tampil, dan hanya-baca tidak pernah menyembunyikan menu apa pun.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    PETA_FITUR_MENU,
    bolehLihatMenu,
    buatPunyaFitur,
    kodeFiturMenu,
    spandukLisensi,
} from './aturan-menu.ts';

/** Kunci paket Produksi yang disederhanakan — cukup untuk menguji tampil/sembunyi. */
const kunciProduksi = (ubah = {}) => ({
    ditegakkan: true,
    status: 'aktif',
    hanyaBaca: false,
    alasan: null,
    produk: 'qendali',
    paket: 'produksi',
    klien: 'toko-budi',
    namaKlien: 'Toko Budi',
    fitur: [
        'pos.core', 'catalog.core', 'customers.core', 'inventory.stock', 'inventory.opname',
        'hpp.calc', 'reports.profit', 'ar.dp', 'shift.close', 'invoice.quotation',
        'finance.cashflow', 'crm.leads', 'printer.relay', 'backup.cloud', 'notify.discord',
        'production.board', 'production.pipeline', 'print.queue', 'click.counting',
        'so.designer', 'site.landing', 'cs.rating', 'tasks.piket', 'team.leaderboard',
        'domain.sendiri',
    ],
    batas: { 'limit.users': 8, 'limit.branches': null },
    berlakuSampai: '2026-10-25T00:00:00.000Z',
    tenggangSampai: '2026-11-08T00:00:00.000Z',
    sisaHari: 29,
    sisaHariTenggang: 43,
    ...ubah,
});

/** Instalasi tanpa kunci — bentuk yang sama dengan `KOSONG` di `keadaan-lisensi.ts`. */
const tanpaKunci = () => ({
    ditegakkan: false,
    status: 'tanpa_lisensi',
    hanyaBaca: false,
    alasan: null,
    produk: null,
    paket: null,
    klien: null,
    namaKlien: null,
    fitur: [],
    batas: {},
    berlakuSampai: null,
    tenggangSampai: null,
    sisaHari: null,
    sisaHariTenggang: null,
});

// ── 1. Fitur ada → menunya tampil ─────────────────────────────────────────────────────

test('fitur ada di kunci → menunya tampil', () => {
    const punya = buatPunyaFitur(kunciProduksi());
    assert.equal(bolehLihatMenu('/print-queue', punya), true);
    assert.equal(bolehLihatMenu('/produksi', punya), true);
    assert.equal(bolehLihatMenu('/click-counting', punya), true);
    assert.equal(bolehLihatMenu('/landing-page', punya), true);
    assert.equal(bolehLihatMenu('/leaderboard', punya), true);
});

// ── 2. Fitur tidak ada → menunya sembunyi ─────────────────────────────────────────────

test('fitur tidak ada di kunci → menunya sembunyi', () => {
    const punya = buatPunyaFitur(kunciProduksi());
    // Paket Produksi tidak punya WhatsApp (add-on), sosial, iklan Meta, cabang, tutup buku.
    assert.equal(bolehLihatMenu('/crm/whatsapp', punya), false);
    assert.equal(bolehLihatMenu('/crm/whatsapp/broadcast', punya), false);
    assert.equal(bolehLihatMenu('/crm/social', punya), false);
    assert.equal(bolehLihatMenu('/owner/iklan', punya), false);
    assert.equal(bolehLihatMenu('/branch-ledger', punya), false);
    assert.equal(bolehLihatMenu('/branch-orders', punya), false);
    assert.equal(bolehLihatMenu('/reports/tutup-buku', punya), false);
    // Studio Desain itu add-on `ai.studio`, tidak ikut paket.
    assert.equal(bolehLihatMenu('/desainer', punya), false);
});

test('add-on yang dipasang membuat menunya muncul', () => {
    const punya = buatPunyaFitur(kunciProduksi({ fitur: [...kunciProduksi().fitur, 'wa.cloud'] }));
    assert.equal(bolehLihatMenu('/crm/whatsapp', punya), true);
    assert.equal(bolehLihatMenu('/crm/whatsapp/templates', punya), true);
    // Inbox ada, broadcast belum — `wa.automation` kode terpisah.
    assert.equal(bolehLihatMenu('/crm/whatsapp/broadcast', punya), false);
});

// ── 3. GAGAL AMBIL → semua tampil ─────────────────────────────────────────────────────

test('gagal ambil /saya/fitur (null/undefined) → SEMUA menu tampil', () => {
    for (const kosong of [null, undefined]) {
        const punya = buatPunyaFitur(kosong);
        for (const href of Object.keys(PETA_FITUR_MENU)) {
            assert.equal(bolehLihatMenu(href, punya), true, `${href} harus tampil saat data belum ada`);
        }
        assert.equal(punya('fitur.yang.tidak.pernah.ada'), true);
    }
});

test('bolehLihatMenu tanpa penjawab fitur → tampil', () => {
    assert.equal(bolehLihatMenu('/print-queue'), true);
    assert.equal(bolehLihatMenu('/print-queue', null), true);
    assert.equal(bolehLihatMenu('/print-queue', undefined), true);
});

test('bentuk jawaban rusak (fitur bukan array) → semua tampil', () => {
    const punya = buatPunyaFitur({ ...kunciProduksi(), fitur: 'print.queue' });
    assert.equal(bolehLihatMenu('/print-queue', punya), true);
    assert.equal(bolehLihatMenu('/crm/whatsapp', punya), true);
});

// ── 4. TIDAK DITEGAKKAN → semua tampil ────────────────────────────────────────────────

test('lisensi tidak ditegakkan (tanpa kunci) → SEMUA menu tampil', () => {
    const punya = buatPunyaFitur(tanpaKunci());
    for (const href of Object.keys(PETA_FITUR_MENU)) {
        assert.equal(bolehLihatMenu(href, punya), true, `${href} harus tampil tanpa lisensi`);
    }
});

test('kunci ADA tapi ditolak (fitur kosong) → semua tampil, bukan semua hilang', () => {
    // Kunci rusak / alamat salah / produk lain: `keadaan-lisensi.ts` menjawab ditegakkan:true,
    // status hanya_baca, fitur []. Kalau ini ditutup, seluruh menu lenyap sekaligus — padahal
    // justru saat itu klien perlu membuka laporan lamanya.
    const punya = buatPunyaFitur({
        ...tanpaKunci(),
        ditegakkan: true,
        status: 'hanya_baca',
        hanyaBaca: true,
        alasan: 'tanda_tangan_tidak_cocok',
    });
    for (const href of Object.keys(PETA_FITUR_MENU)) {
        assert.equal(bolehLihatMenu(href, punya), true, `${href} harus tampil saat kuncinya ditolak`);
    }
});

// ── 5. Menu tanpa pemetaan → tampil ───────────────────────────────────────────────────

test('menu tanpa pemetaan tetap tampil, walau kuncinya kosong melompong', () => {
    const punya = buatPunyaFitur({ ...tanpaKunci(), ditegakkan: true, fitur: ['pos.core'] });
    for (const href of ['/', '/pos', '/beranda', '/reports/sales', '/owner', '/maps',
        '/transactions/edit-requests', '/settings/langganan', '/settings/general',
        '/halaman/yang/belum/ada']) {
        assert.equal(kodeFiturMenu(href), null, `${href} tidak boleh ada di peta`);
        assert.equal(bolehLihatMenu(href, punya), true, `${href} harus tampil`);
    }
});

test('menu yang TIDAK BOLEH pernah dipetakan', () => {
    // Penjaga sengaja: kalau suatu hari ada yang memetakan salah satu href ini, tes ini gagal
    // duluan. Alasannya di komentar `PETA_FITUR_MENU`, ringkasnya: kasir tidak boleh kehilangan
    // layar jualannya, staf tidak boleh melihat menu kosong, dan jalan keluar dari hanya-baca
    // (halaman Langganan) tidak boleh ikut hilang.
    for (const href of ['/', '/pos', '/beranda', '/reports/sales', '/settings/langganan']) {
        assert.equal(PETA_FITUR_MENU[href], undefined, `${href} tidak boleh dipetakan ke kode fitur`);
    }
});

// ── 6. Hanya-baca tidak pernah menyembunyikan menu (aturan 4) ─────────────────────────

test('hanya-baca dengan daftar fitur utuh: menu baca tetap tampil semua', () => {
    const punya = buatPunyaFitur(kunciProduksi({
        status: 'hanya_baca',
        hanyaBaca: true,
        alasan: 'masa_berlaku_habis',
        sisaHari: -20,
        sisaHariTenggang: -6,
    }));
    // Laporan, pencarian, dan cetak ulang harus tetap bisa dibuka saat hanya-baca.
    assert.equal(bolehLihatMenu('/reports/profit', punya), true);
    assert.equal(bolehLihatMenu('/reports/stock', punya), true);
    assert.equal(bolehLihatMenu('/reports/hpp', punya), true);
    assert.equal(bolehLihatMenu('/customers', punya), true);
    assert.equal(bolehLihatMenu('/invoices', punya), true);
    // Yang memang tidak dibeli tetap sembunyi — itu soal paket, bukan soal hanya-baca.
    assert.equal(bolehLihatMenu('/crm/whatsapp', punya), false);
});

// ── 7. Bentuk peta ────────────────────────────────────────────────────────────────────

test('peta menu: href rapi & kode fitur berbentuk kosakata paket.json', () => {
    const bentukKode = /^[a-z][a-z0-9]*\.[a-z0-9_]+$/;
    for (const [href, kode] of Object.entries(PETA_FITUR_MENU)) {
        assert.ok(href.startsWith('/'), `href ${href} harus mulai dengan /`);
        assert.ok(!href.endsWith('/'), `href ${href} tidak boleh diakhiri /`);
        assert.match(kode, bentukKode, `kode ${kode} (${href}) tidak berbentuk kode fitur`);
    }
});

test('kodeFiturMenu mengembalikan kode yang sama dengan petanya', () => {
    assert.equal(kodeFiturMenu('/print-queue'), 'print.queue');
    assert.equal(kodeFiturMenu('/desainer'), 'ai.studio');
    assert.equal(kodeFiturMenu('/settings/akses-menu'), 'rbac.menu');
    assert.equal(kodeFiturMenu('/tidak/ada'), null);
});

// ── 8. Spanduk ────────────────────────────────────────────────────────────────────────

test('tanpa lisensi / tidak ditegakkan / aktif → TIDAK ADA spanduk', () => {
    assert.equal(spandukLisensi(null), null);
    assert.equal(spandukLisensi(undefined), null);
    assert.equal(spandukLisensi(tanpaKunci()), null);
    assert.equal(spandukLisensi(kunciProduksi()), null);
    // Bahkan kalau statusnya aneh, penegakan mati = tidak ada spanduk.
    assert.equal(spandukLisensi({ ...tanpaKunci(), status: 'hanya_baca', hanyaBaca: true }), null);
});

test('tenggang → peringatan halus yang menyebut sisa hari, bisa ditutup', () => {
    const s = spandukLisensi(kunciProduksi({ status: 'tenggang', sisaHari: 0, sisaHariTenggang: 9 }));
    assert.ok(s);
    assert.equal(s.nada, 'peringatan');
    assert.equal(s.bisaDitutup, true);
    assert.match(s.pesan, /9 hari/);
    assert.match(s.pesan, /hanya-baca/);
    // Tidak boleh menakut-nakuti: masa tenggang MASIH boleh mencatat.
    assert.match(s.pesan, /masih bisa dicatat/i);
});

test('tenggang tanpa angka sisa hari tetap masuk akal dibaca', () => {
    const s = spandukLisensi(kunciProduksi({ status: 'tenggang', sisaHariTenggang: null }));
    assert.ok(s);
    assert.match(s.pesan, /beberapa hari/);
});

test('hanya-baca → spanduk genting, tidak bisa ditutup, menyebut yang masih bisa', () => {
    const s = spandukLisensi(kunciProduksi({ status: 'hanya_baca', hanyaBaca: true }));
    assert.ok(s);
    assert.equal(s.nada, 'genting');
    assert.equal(s.bisaDitutup, false);
    assert.match(s.pesan, /dibuka, dicari, dan dicetak ulang/);
    assert.match(s.pesan, /belum bisa dicatat/);
});

/**
 * Tes murni untuk baris "Pengguna: 4 dari 5" di Pengaturan → Langganan.
 *
 * Jalankan: `cd frontend && npm test`
 *
 * Yang dijaga di sini bukan kerapian tampilan, tapi supaya layar ini tidak pernah BOHONG:
 * tanpa batas jangan ditulis seperti ada batas, nol jangan terbaca seperti tanpa batas, dan
 * klien yang sudah lewat batas harus melihat kalimat yang menenangkan — bukan angka merah
 * tanpa penjelasan yang membuat dia mengira karyawannya baru saja dihapus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaPemakaian, barisPemakaian } from './pemakaian-batas.ts';

const kunci = (batas, pemakaian, ubah = {}) => ({
    ditegakkan: true,
    status: 'aktif',
    paket: 'usaha',
    batas,
    pemakaian,
    ...ubah,
});

test('tanpa lisensi / data belum ada: tidak menampilkan apa pun', () => {
    assert.deepEqual(barisPemakaian(null), []);
    assert.deepEqual(barisPemakaian(undefined), []);
    assert.deepEqual(barisPemakaian({ ditegakkan: false, batas: { 'limit.users': 5 }, pemakaian: { 'limit.users': 9 } }), []);
    assert.equal(adaPemakaian(null), false);
});

test('batas null = tanpa batas → barisnya disembunyikan, bukan ditulis "tanpa batas"', () => {
    const baris = barisPemakaian(kunci({ 'limit.users': null, 'limit.branches': 1 }, { 'limit.branches': 1 }));
    assert.deepEqual(baris.map((b) => b.kode), ['limit.branches']);
});

test('kode batas yang tidak ada di kunci juga disembunyikan', () => {
    assert.deepEqual(barisPemakaian(kunci({}, {})), []);
});

test('di bawah batas: angkanya apa adanya, tanpa penanda & tanpa catatan', () => {
    const [b] = barisPemakaian(kunci({ 'limit.users': 15 }, { 'limit.users': 4 }));
    assert.equal(b.nama, 'Pengguna');
    assert.equal(b.teks, '4 dari 15 pengguna');
    assert.equal(b.nada, 'biasa');
    assert.equal(b.catatan, null);
});

test('tinggal satu slot: penanda halus, kalimatnya tidak menakut-nakuti', () => {
    const [b] = barisPemakaian(kunci({ 'limit.users': 5 }, { 'limit.users': 4 }));
    assert.equal(b.nada, 'dekat');
    assert.equal(b.catatan, 'Tinggal 1 pengguna lagi.');
});

test('pas di batas: penuh, dan catatannya menyebut apa yang belum bisa', () => {
    const [b] = barisPemakaian(kunci({ 'limit.users': 5 }, { 'limit.users': 5 }));
    assert.equal(b.nada, 'penuh');
    assert.equal(b.teks, '5 dari 5 pengguna');
    assert.match(b.catatan, /Sudah penuh/);
});

test('klien lama di ATAS batas: angkanya jujur, catatannya menegaskan data lama tetap jalan', () => {
    const [b] = barisPemakaian(kunci({ 'limit.users': 5 }, { 'limit.users': 8 }));
    assert.equal(b.teks, '8 dari 5 pengguna');
    assert.equal(b.nada, 'penuh');
    assert.match(b.catatan, /tetap jalan seperti biasa/);
    assert.match(b.catatan, /menambah pengguna baru/);
});

test('batas 0 TETAP tampil — nol berarti tidak termasuk paket, beda dari tanpa batas', () => {
    const [b] = barisPemakaian(kunci({ 'limit.branches': 0 }, { 'limit.branches': 0 }, { paket: 'gratis' }));
    assert.equal(b.teks, '0 dari 0 cabang');
    assert.equal(b.nada, 'penuh');
    assert.match(b.catatan, /Tidak termasuk paket ini/);
});

test('hitungan yang tidak dikirim backend tidak ditebak jadi nol', () => {
    // Backend melewati kode yang querynya gagal. Menampilkan "0 dari 5" di situ = bohong.
    assert.deepEqual(barisPemakaian(kunci({ 'limit.users': 5 }, {})), []);
    assert.deepEqual(barisPemakaian(kunci({ 'limit.users': 5 }, null)), []);
});

test('urutannya tetap: Pengguna dulu, lalu Cabang', () => {
    const baris = barisPemakaian(
        kunci({ 'limit.branches': 3, 'limit.users': 5 }, { 'limit.branches': 1, 'limit.users': 2 }),
    );
    assert.deepEqual(baris.map((b) => b.nama), ['Pengguna', 'Cabang']);
    assert.equal(adaPemakaian(baris.length ? kunci({ 'limit.users': 5 }, { 'limit.users': 2 }) : null), true);
});

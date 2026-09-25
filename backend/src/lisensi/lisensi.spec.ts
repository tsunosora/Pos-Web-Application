/**
 * Tes MURNI lisensi: tanpa database, tanpa jaringan, tanpa Nest.
 *
 * Pasangan kunci Ed25519-nya dibuat di dalam tes ini sendiri — kunci privat penerbit yang
 * sungguhan tidak pernah masuk repo mana pun, termasuk sebagai bahan tes.
 *
 * Kasusnya sengaja meniru `qendali/test/lisensi.test.mjs` (sisi penerbit) supaya kalau suatu
 * hari dua sisi berbeda, ketahuannya dari tes yang gagal — bukan dari klien yang menelepon.
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import {
    IsiKunci,
    alamatCocok,
    bacaIsi,
    batasFitur,
    periksaKunci,
    punyaFitur,
    statusMasaBerlaku,
    verifikasi,
} from './periksa-kunci';
import { batasLisensi, bolehFitur, nilaiKeadaan } from './keadaan-lisensi';

const HARI = 24 * 60 * 60 * 1000;
const TERBIT = new Date('2026-09-20T00:00:00Z');

function buatPasanganKunci() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return {
        privat: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        publik: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
}

const kunci = buatPasanganKunci();
const lain = buatPasanganKunci();

/** Isi kunci contoh — bentuknya sama dengan yang disusun `susunIsi()` di penerbit. */
function isiContoh(ubah: Partial<IsiKunci> & { berlakuHari?: number } = {}): IsiKunci {
    const { berlakuHari = 35, ...sisa } = ubah;
    return {
        versi: 1,
        kid: 'uji-1',
        klien: 'voliko',
        namaKlien: 'Voliko Digital Printing',
        produk: 'qendali',
        paket: 'bisnis',
        fitur: ['branch.ledger', 'pos.core', 'production.board'],
        batas: { 'limit.users': null, 'limit.branches': 3 },
        alamatSah: ['kasir.volikoprint.com'],
        terbitPada: TERBIT.toISOString(),
        berlakuSampai: new Date(TERBIT.getTime() + berlakuHari * HARI).toISOString(),
        tenggangHari: 14,
        ...sisa,
    };
}

function tandatangani(isi: IsiKunci, privat: string): string {
    const bagianIsi = Buffer.from(JSON.stringify(isi)).toString('base64url');
    const ttd = sign(null, Buffer.from(`q1.${bagianIsi}`), privat);
    return `q1.${bagianIsi}.${ttd.toString('base64url')}`;
}

const pada = (hari: number) => new Date(TERBIT.getTime() + hari * HARI);

describe('periksa-kunci (verifikasi tanda tangan)', () => {
    it('kunci yang baru terbit lolos verifikasi', () => {
        const hasil = verifikasi(tandatangani(isiContoh(), kunci.privat), kunci.publik);
        expect(hasil.sah).toBe(true);
        expect(hasil.isi?.klien).toBe('voliko');
    });

    it('isi yang diutak-atik ditolak', () => {
        const asli = tandatangani(isiContoh(), kunci.privat);
        const isi = bacaIsi(asli)!;
        isi.paket = 'gratis';
        isi.fitur = [...isi.fitur, 'ai.studio'];
        const palsu = `q1.${Buffer.from(JSON.stringify(isi)).toString('base64url')}.${asli.split('.')[2]}`;
        const hasil = verifikasi(palsu, kunci.publik);
        expect(hasil.sah).toBe(false);
        expect(hasil.sah === false && hasil.alasan).toBe('tanda_tangan_tidak_cocok');
    });

    it('kunci dari penanda tangan lain ditolak', () => {
        const hasil = verifikasi(tandatangani(isiContoh(), lain.privat), kunci.publik);
        expect(hasil.sah === false && hasil.alasan).toBe('tanda_tangan_tidak_cocok');
    });

    it('peta kid memilih kunci publik yang benar, kid asing ditolak', () => {
        const peta = { 'uji-1': kunci.publik, 'prod-1': lain.publik };
        expect(verifikasi(tandatangani(isiContoh(), kunci.privat), peta).sah).toBe(true);
        const asing = verifikasi(tandatangani(isiContoh({ kid: 'entah' }), kunci.privat), peta);
        expect(asing.sah === false && asing.alasan).toBe('kid_tidak_dikenal');
    });

    it('teks asal-asalan tidak bikin error, cuma ditolak dengan alasan', () => {
        const alasan = (k: string, pub: unknown = kunci.publik) => {
            const h = verifikasi(k, pub as string);
            return h.sah === false ? h.alasan : 'sah';
        };
        expect(alasan('bukan-kunci')).toBe('bentuk_kunci_salah');
        expect(alasan('q2.aaa.bbb')).toBe('amplop_tidak_dikenal');
        expect(alasan('q1.xxx.yyy')).toBe('isi_rusak');
        expect(alasan(tandatangani(isiContoh({ versi: 2 }), kunci.privat))).toBe('versi_isi_tidak_didukung');
        expect(bacaIsi('bukan-kunci')).toBeNull();
    });

    it('kunci publik yang rusak dilaporkan sebagai tanda_tangan_rusak, bukan meledak', () => {
        const rusak = { 'uji-1': '-----BEGIN PUBLIC KEY-----\nbukan-kunci\n-----END PUBLIC KEY-----\n' };
        const hasil = verifikasi(tandatangani(isiContoh(), kunci.privat), rusak);
        expect(hasil.sah === false && hasil.alasan).toBe('tanda_tangan_rusak');
    });
});

describe('periksa-kunci (masa berlaku & alamat)', () => {
    it('aktif, lalu tenggang, lalu kedaluwarsa', () => {
        const isi = isiContoh();
        expect(statusMasaBerlaku(isi, { sekarang: pada(10) }).status).toBe('aktif');
        expect(statusMasaBerlaku(isi, { sekarang: pada(40) }).status).toBe('tenggang');
        expect(statusMasaBerlaku(isi, { sekarang: pada(60) }).status).toBe('kedaluwarsa');
    });

    it('jam mesin yang dimundurkan tidak memperpanjang lisensi', () => {
        const isi = isiContoh();
        const terakhirTerlihat = new Date('2026-11-20T00:00:00Z');
        const jujur = statusMasaBerlaku(isi, { sekarang: terakhirTerlihat, terakhirTerlihat });
        expect(jujur.status).toBe('kedaluwarsa');

        const dicurangi = statusMasaBerlaku(isi, { sekarang: pada(5), terakhirTerlihat });
        expect(dicurangi.status).toBe('kedaluwarsa');
        expect(dicurangi.jamMundur).toBe(true);
    });

    it('jam yang meleset sedikit (< 2 jam) masih ditoleransi', () => {
        const terakhirTerlihat = new Date('2026-09-25T10:00:00Z');
        const hasil = statusMasaBerlaku(isiContoh(), {
            sekarang: new Date('2026-09-25T09:00:00Z'),
            terakhirTerlihat,
        });
        expect(hasil.jamMundur).toBe(false);
    });

    it('alamat sah membatasi kunci ke satu pemasangan, termasuk pola *.', () => {
        const isi = isiContoh({ alamatSah: ['voliko.qendali.com', '*.cabang.qendali.com'] });
        expect(alamatCocok(isi, 'voliko.qendali.com')).toBe(true);
        expect(alamatCocok(isi, 'https://voliko.qendali.com/pos')).toBe(true);
        expect(alamatCocok(isi, 'VOLIKO.qendali.com:3001')).toBe(true);
        expect(alamatCocok(isi, 'dua.cabang.qendali.com')).toBe(true);
        expect(alamatCocok(isi, 'cabang.qendali.com')).toBe(true);
        expect(alamatCocok(isi, 'klienlain.qendali.com')).toBe(false);
        expect(alamatCocok(isi, null)).toBe(false);
        expect(alamatCocok(isiContoh({ alamatSah: [] }), 'apa-saja.test')).toBe(true);
    });

    it('periksaKunci menolak kunci yang dipasang di alamat lain', () => {
        const hasil = periksaKunci(tandatangani(isiContoh(), kunci.privat), {
            kunciPublik: kunci.publik,
            alamat: 'klienlain.qendali.com',
            sekarang: pada(5),
        });
        expect(hasil.sah).toBe(false);
        expect(hasil.sah === false && hasil.alasan).toBe('alamat_tidak_sah');
        expect(hasil.hanyaBaca).toBe(true);
    });

    it('fitur dibaca per kode, batas yang tak ada di kunci = tanpa batas', () => {
        const isi = isiContoh();
        expect(punyaFitur(isi, 'production.board')).toBe(true);
        expect(punyaFitur(isi, 'ads.meta')).toBe(false);
        expect(batasFitur(isi, 'limit.branches')).toBe(3);
        expect(batasFitur(isi, 'limit.users')).toBeNull();
        expect(batasFitur(isi, 'limit.customers')).toBeNull();
    });
});

describe('keadaan-lisensi (gagal-terbuka)', () => {
    const kunciPublik = { 'uji-1': kunci.publik };

    it('tanpa kunci tersimpan: penegakan MATI dan semua fitur terbuka', () => {
        for (const tanpa of [null, '', '   ', undefined]) {
            const k = nilaiKeadaan({ kunci: tanpa, kunciPublik });
            expect(k.ditegakkan).toBe(false);
            expect(k.status).toBe('tanpa_lisensi');
            expect(k.hanyaBaca).toBe(false);
            expect(bolehFitur(k, 'ai.studio')).toBe(true);
            expect(bolehFitur(k, 'fitur.yang.belum.pernah.ada')).toBe(true);
            expect(batasLisensi(k, 'limit.users')).toBeNull();
        }
    });

    it('kunci sah: penegakan menyala, fitur yang tidak ada di kunci ditolak', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: 'kasir.volikoprint.com',
            sekarang: pada(5),
        });
        expect(k.ditegakkan).toBe(true);
        expect(k.status).toBe('aktif');
        expect(k.hanyaBaca).toBe(false);
        expect(k.paket).toBe('bisnis');
        expect(bolehFitur(k, 'production.board')).toBe(true);
        expect(bolehFitur(k, 'ai.studio')).toBe(false);
        expect(batasLisensi(k, 'limit.branches')).toBe(3);
        expect(batasLisensi(k, 'limit.users')).toBeNull();
    });

    it('masa tenggang MASIH boleh menulis — kalau tidak, tenggang tak ada gunanya', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: 'kasir.volikoprint.com',
            sekarang: pada(40),
        });
        expect(k.status).toBe('tenggang');
        expect(k.hanyaBaca).toBe(false);
        expect(k.sisaHariTenggang).toBeGreaterThan(0);
    });

    it('lewat tenggang: hanya-baca, tapi daftar fiturnya TETAP ada (boleh baca & cetak)', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: 'kasir.volikoprint.com',
            sekarang: pada(60),
        });
        expect(k.status).toBe('hanya_baca');
        expect(k.hanyaBaca).toBe(true);
        expect(k.alasan).toBe('masa_berlaku_habis');
        expect(bolehFitur(k, 'production.board')).toBe(true);
    });

    it('jam yang dimundurkan tidak mengembalikan lisensi yang sudah habis', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: 'kasir.volikoprint.com',
            terakhirTerlihat: new Date('2026-11-20T00:00:00Z').toISOString(),
            sekarang: pada(5), // "dimundurkan" ke masa aktif
        });
        expect(k.status).toBe('hanya_baca');
        expect(k.jamMundur).toBe(true);
    });

    it('kunci yang diutak-atik: hanya-baca dan TANPA fitur apa pun', () => {
        const asli = tandatangani(isiContoh(), kunci.privat);
        const isi = bacaIsi(asli)!;
        isi.fitur = [...isi.fitur, 'ai.studio'];
        const palsu = `q1.${Buffer.from(JSON.stringify(isi)).toString('base64url')}.${asli.split('.')[2]}`;
        const k = nilaiKeadaan({ kunci: palsu, kunciPublik, sekarang: pada(5) });
        expect(k.ditegakkan).toBe(true);
        expect(k.hanyaBaca).toBe(true);
        expect(k.alasan).toBe('tanda_tangan_tidak_cocok');
        expect(k.fitur).toEqual([]);
        expect(bolehFitur(k, 'ai.studio')).toBe(false);
        expect(bolehFitur(k, 'pos.core')).toBe(false);
    });

    it('kunci produk lain (Qendali Event) ditolak', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh({ produk: 'qendali_event' }), kunci.privat),
            kunciPublik,
            alamat: 'kasir.volikoprint.com',
            sekarang: pada(5),
        });
        expect(k.hanyaBaca).toBe(true);
        expect(k.alasan).toBe('produk_tidak_cocok');
        expect(k.fitur).toEqual([]);
    });

    it('kunci sah tapi dipasang di alamat lain: hanya-baca dengan alasan alamat', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: 'kasir-orang-lain.com',
            sekarang: pada(5),
        });
        expect(k.alasan).toBe('alamat_tidak_sah');
        expect(k.hanyaBaca).toBe(true);
    });

    it('alamat null (pemasangan offline/desktop) tidak diperiksa', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh(), kunci.privat),
            kunciPublik,
            alamat: null,
            sekarang: pada(5),
        });
        expect(k.status).toBe('aktif');
    });

    it('kid yang tidak ada di peta: hanya-baca, bukan diam-diam terbuka', () => {
        const k = nilaiKeadaan({
            kunci: tandatangani(isiContoh({ kid: 'prod-9' }), kunci.privat),
            kunciPublik,
            sekarang: pada(5),
        });
        expect(k.ditegakkan).toBe(true);
        expect(k.alasan).toBe('kid_tidak_dikenal');
        expect(k.hanyaBaca).toBe(true);
    });
});

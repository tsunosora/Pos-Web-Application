/**
 * Pemegang keadaan lisensi untuk seluruh backend: memuat kunci dari simpanan, menyegarkannya
 * ke qendali.com (saat boot + sekali sehari), dan menjawab pertanyaan "boleh pakai fitur ini?".
 *
 * Yang tidak boleh dilupakan:
 * - Gagal menyegarkan BUKAN bencana. Pakai kunci lama, coba lagi besok, catat di log.
 *   Verifikasinya lokal, jadi internet mati tidak menyentuh hak akses sama sekali.
 * - 403 `langganan_berhenti` juga TIDAK mematikan aplikasi. Kunci lama tetap dipakai sampai
 *   masa berlakunya benar-benar habis, lalu jadi hanya-baca. Tidak ada kasir yang mati
 *   mendadak di tengah jam kerja gara-gara tagihan.
 * - Tanpa kunci tersimpan = penegakan MATI (gagal-terbuka). Lihat `keadaan-lisensi.ts`.
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Keadaan, batasLisensi, bolehFitur, nilaiKeadaan } from './keadaan-lisensi';
import { kunciPublikLisensi } from './kunci-publik';
import { verifikasi } from './periksa-kunci';
import { SIMPANAN_KOSONG, Simpanan, bacaSimpanan, berkasLisensi, tulisSimpanan } from './simpanan-lisensi';

/** Alamat penerbit. Produksi: https://qendali.com — sengaja jadi bawaan, bukan wajib diisi. */
const URL_BAWAAN = 'https://qendali.com';

@Injectable()
export class LisensiService implements OnApplicationBootstrap {
    private readonly log = new Logger('Lisensi');
    private simpanan: Simpanan = { ...SIMPANAN_KOSONG };

    /**
     * Keadaan di-cache 60 detik: penjaga hanya-baca dipanggil di SETIAP permintaan, dan
     * memverifikasi tanda tangan tiap kali itu sia-sia. 60 detik cukup rapat — status cuma
     * berubah di batas hari (masa berlaku) atau saat penyegaran (yang membuang cache sendiri).
     */
    private memo: { pada: number; nilai: Keadaan } | null = null;
    private static readonly MEMO_MS = 60_000;
    private static readonly TIMEOUT_MS = 10_000;

    private sedangMenyegarkan: Promise<void> | null = null;

    async onApplicationBootstrap(): Promise<void> {
        this.simpanan = await bacaSimpanan();
        this.memo = null;
        this.laporkanKeadaan();
        // Penyegaran saat boot sengaja TIDAK ditunggu: qendali.com yang lambat atau mati tidak
        // boleh menunda aplikasi naik. Hasilnya cuma memengaruhi permintaan setelah dia selesai.
        void this.segarkan('boot');
    }

    /** Sekali sehari, di jam sepi. Gagal? tidak apa-apa — besok dicoba lagi. */
    @Cron('37 3 * * *', { name: 'lisensi-segarkan-harian', timeZone: 'Asia/Jakarta' })
    async segarkanHarian(): Promise<void> {
        await this.segarkan('harian');
    }

    // ── Keadaan ────────────────────────────────────────────────────────────────────────

    keadaan(): Keadaan {
        const sekarang = Date.now();
        if (this.memo && sekarang - this.memo.pada < LisensiService.MEMO_MS) return this.memo.nilai;
        const nilai = nilaiKeadaan({
            kunci: this.simpanan.kunci,
            kunciPublik: kunciPublikLisensi(),
            alamat: this.alamatInstalasi(),
            terakhirTerlihat: this.simpanan.terakhirTerlihat,
        });
        this.memo = { pada: sekarang, nilai };
        return nilai;
    }

    /** Boleh pakai fitur ini? Tanpa kunci = boleh (gagal-terbuka). */
    punyaFitur(kodeFitur: string): boolean {
        return bolehFitur(this.keadaan(), kodeFitur);
    }

    /**
     * Batas angka dari kunci (`limit.users`, `limit.branches`, …). `null` = tanpa batas.
     * BELUM ADA YANG MENEGAKKAN INI — disediakan supaya penegakan berikutnya tidak menebak.
     */
    batasFitur(kodeBatas: string): number | null {
        return batasLisensi(this.keadaan(), kodeBatas);
    }

    hanyaBaca(): boolean {
        return this.keadaan().hanyaBaca;
    }

    /**
     * Alamat instalasi untuk dicocokkan ke `alamatSah` di kunci.
     * `QENDALI_ALAMAT` → `PUBLIC_BASE_URL` → null. null berarti alamat TIDAK diperiksa
     * (pemasangan offline/desktop, atau alamat belum diisi) — sengaja, supaya salah isi env
     * tidak mengunci instalasi yang sah. Sebagai gantinya boot mencatat peringatan.
     */
    alamatInstalasi(): string | null {
        const alamat = (process.env.QENDALI_ALAMAT ?? '').trim();
        if (alamat) return alamat;
        const publik = (process.env.PUBLIC_BASE_URL ?? '').trim();
        if (publik) return publik;
        return null;
    }

    /** Versi aplikasi yang dilaporkan ke penerbit lewat header `X-Qendali-Versi`. */
    versiAplikasi(): string {
        const dariEnv = (process.env.QENDALI_VERSI ?? '').trim();
        if (dariEnv) return dariEnv;
        try {
            const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
                version?: string;
            };
            return pkg.version ?? 'tak-diketahui';
        } catch {
            return 'tak-diketahui';
        }
    }

    /** Untuk `GET /saya/fitur` dan halaman Pengaturan — TANPA kunci mentah & TANPA token. */
    ringkasan() {
        const k = this.keadaan();
        return {
            ditegakkan: k.ditegakkan,
            status: k.status,
            hanyaBaca: k.hanyaBaca,
            alasan: k.alasan,
            jamMundur: k.jamMundur,
            produk: k.produk,
            paket: k.paket,
            klien: k.klien,
            namaKlien: k.namaKlien,
            fitur: k.fitur,
            batas: k.batas,
            berlakuSampai: k.berlakuSampai,
            tenggangSampai: k.tenggangSampai,
            sisaHari: k.sisaHari,
            sisaHariTenggang: k.sisaHariTenggang,
            terakhirTerlihat: k.terakhirTerlihat,
            terakhirDicoba: this.simpanan.terakhirDicoba,
            catatanPenyegaran: this.simpanan.catatanTerakhir,
        };
    }

    // ── Penyegaran ─────────────────────────────────────────────────────────────────────

    /**
     * `GET <QENDALI_LISENSI_URL>/api/lisensi` dengan token instalasi.
     * Tidak pernah melempar galat ke pemanggil: semua kegagalan cukup dicatat.
     */
    async segarkan(pemicu: 'boot' | 'harian' | 'manual' = 'manual'): Promise<void> {
        if (this.sedangMenyegarkan) return this.sedangMenyegarkan;
        this.sedangMenyegarkan = this.jalankanPenyegaran(pemicu).finally(() => {
            this.sedangMenyegarkan = null;
        });
        return this.sedangMenyegarkan;
    }

    private async jalankanPenyegaran(pemicu: string): Promise<void> {
        const token = (process.env.QENDALI_LISENSI_TOKEN ?? '').trim();
        if (!token) {
            // Tidak ada token = instalasi ini tidak dikelola qendali.com (dev, Voliko sekarang).
            // Bukan galat, dan JANGAN dijadikan galat: ini jalur normal gagal-terbuka.
            if (pemicu === 'boot') {
                this.log.warn(
                    'QENDALI_LISENSI_TOKEN belum diisi — penyegaran lisensi dilewati. ' +
                        'Penegakan tetap mati kalau tidak ada kunci tersimpan.',
                );
            }
            return;
        }

        const dasar = ((process.env.QENDALI_LISENSI_URL ?? '').trim() || URL_BAWAAN).replace(/\/+$/, '');
        const alamat = `${dasar}/api/lisensi`;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), LisensiService.TIMEOUT_MS);
        let catatan = '';

        try {
            const res = await fetch(alamat, {
                headers: {
                    authorization: `Bearer ${token}`,
                    'x-qendali-versi': this.versiAplikasi(),
                    accept: 'application/json',
                },
                signal: ac.signal,
            });

            const badan = (await res.json().catch(() => ({}))) as {
                kunci?: string;
                alasan?: string;
                baru?: boolean;
                paket?: string;
            };

            if (res.status === 403) {
                // Langganan berhenti. BUKAN tombol mematikan: kunci lama tetap dipakai sampai
                // masa berlakunya habis, baru jadi hanya-baca.
                catatan = `403 ${badan.alasan ?? 'langganan_berhenti'}`;
                this.log.warn(
                    `Penyegaran ditolak (${catatan}). Kunci lama tetap dipakai sampai ` +
                        `${this.keadaan().berlakuSampai ?? 'masa berlakunya habis'} — aplikasi TIDAK dimatikan.`,
                );
                return;
            }
            if (!res.ok) {
                catatan = `HTTP ${res.status}${badan.alasan ? ` ${badan.alasan}` : ''}`;
                this.log.warn(`Penyegaran gagal (${catatan}). Pakai kunci lama, dicoba lagi besok.`);
                return;
            }
            if (!badan.kunci) {
                catatan = 'jawaban tanpa kunci';
                this.log.warn('Penyegaran menjawab 200 tapi tanpa kunci. Pakai kunci lama.');
                return;
            }

            // Verifikasi tanda tangan SEBELUM menimpa kunci yang sudah bekerja. Kalau penerbit
            // (atau sesuatu di tengah jalan) mengirim kunci rusak, instalasi yang sehat jangan
            // sampai ikut rusak — tanda tangan dulu, baru ditulis.
            const uji = verifikasi(badan.kunci, kunciPublikLisensi());
            if (!uji.sah) {
                catatan = `kunci baru ditolak: ${uji.alasan}`;
                this.log.error(`Kunci dari ${dasar} tidak lolos verifikasi (${uji.alasan}). Kunci lama dipertahankan.`);
                return;
            }

            const berubah = badan.kunci.trim() !== (this.simpanan.kunci ?? '');
            catatan = berubah ? 'kunci baru tersimpan' : 'kunci lama masih segar';
            this.simpanan = {
                ...this.simpanan,
                kunci: badan.kunci.trim(),
                terakhirTerlihat: new Date().toISOString(),
            };
            this.memo = null;
            if (berubah) this.log.log(`Kunci lisensi diperbarui (paket ${uji.isi.paket}).`);
        } catch (e: unknown) {
            const pesan = e instanceof Error ? e.message : String(e);
            catatan = pesan.includes('abort') ? 'timeout 10 detik' : pesan;
            this.log.warn(`Tidak bisa menghubungi ${dasar}: ${catatan}. Pakai kunci lama, dicoba lagi besok.`);
        } finally {
            clearTimeout(timer);
            this.simpanan = {
                ...this.simpanan,
                terakhirDicoba: new Date().toISOString(),
                catatanTerakhir: catatan || null,
            };
            try {
                await tulisSimpanan(this.simpanan);
            } catch (e: unknown) {
                const pesan = e instanceof Error ? e.message : String(e);
                this.log.warn(`Gagal menulis ${berkasLisensi()}: ${pesan}. Kunci tetap dipakai dari memori.`);
            }
        }
    }

    // ── Log ringkasan saat boot ────────────────────────────────────────────────────────

    private laporkanKeadaan(): void {
        const k = this.keadaan();
        if (!k.ditegakkan) {
            this.log.warn(
                `Tanpa kunci lisensi (${berkasLisensi()}) — PENEGAKAN MATI, semua fitur terbuka. ` +
                    'Ini disengaja supaya instalasi yang sudah jalan & lingkungan pengembangan tidak rusak.',
            );
            return;
        }
        const siapa = `${k.paket ?? '?'} / ${k.namaKlien ?? k.klien ?? '?'}`;
        if (k.status === 'aktif') {
            this.log.log(`Lisensi ${siapa} aktif, berlaku sampai ${k.berlakuSampai} (${k.sisaHari} hari lagi).`);
        } else if (k.status === 'tenggang') {
            this.log.warn(
                `Lisensi ${siapa} MELEWATI masa berlaku (${k.berlakuSampai}). Masa tenggang ` +
                    `${k.sisaHariTenggang} hari lagi — menulis masih boleh, segera perbarui.`,
            );
        } else {
            this.log.error(
                `Lisensi ${siapa} TIDAK BERLAKU (${k.alasan ?? '-'}) — aplikasi jalan HANYA-BACA: ` +
                    'membaca, mencari, dan mencetak data lama tetap bisa; membuat data baru ditolak.',
            );
        }
        if (k.jamMundur) {
            this.log.error(
                'Jam mesin ini lebih mundur dari stempel penyegaran terakhir. Yang dipakai stempel ' +
                    'penyegaran, bukan jam lokal. Perbaiki jam server (NTP).',
            );
        }
        if (!this.alamatInstalasi()) {
            this.log.warn(
                'QENDALI_ALAMAT / PUBLIC_BASE_URL belum diisi — alamat pemasangan tidak diperiksa ' +
                    'terhadap alamatSah di kunci.',
            );
        }
    }
}

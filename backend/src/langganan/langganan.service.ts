/**
 * Penerus (proxy) ke `/api/aplikasi/*` di qendali.com.
 *
 * KENAPA ADA: halaman Pengaturan → Langganan harus bisa mengubah langganan, dan yang boleh
 * mengubah cuma pemegang TOKEN INSTALASI. Token itu setara kunci — siapa pun yang memegangnya
 * bisa ganti paket, pasang add-on, dan menyatakan tagihan sudah ditransfer. Jadi token TIDAK
 * PERNAH boleh sampai ke browser: frontend memanggil backend ini, backend ini yang memanggil
 * qendali.com sambil menempelkan token dari env. Satu-satunya tempat token dibaca adalah
 * `tokenInstalasi()` di bawah, dan nilainya tidak pernah ikut ke jawaban mana pun.
 *
 * Token & alamat yang dipakai SAMA PERSIS dengan penyegaran lisensi (`QENDALI_LISENSI_TOKEN`,
 * `QENDALI_LISENSI_URL`) — sengaja, supaya pemasang tidak perlu mengisi dua pasang env yang
 * bisa saling tidak cocok.
 *
 * Galat dari penerbit diteruskan APA ADANYA (kode status + badan). Terutama 409 `ditolak`:
 * `pesan`-nya memang ditulis di sisi penerbit untuk langsung dibaca pemilik toko, jadi
 * menerjemahkannya ulang di sini cuma bikin dua versi kalimat yang lama-lama beda.
 */
import { HttpException, Injectable, Logger } from '@nestjs/common';

/** Alamat penerbit. Sama dengan bawaan di `lisensi.service.ts`. */
const URL_BAWAAN = 'https://qendali.com';
const TIMEOUT_MS = 10_000;

/** Jawaban galat dari penerbit: `{salah, pesan}`. Bentuk ini dari `docs/lisensi.md`. */
export interface GalatQendali {
    salah: string;
    pesan: string;
}

@Injectable()
export class LanggananService {
    private readonly log = new Logger('Langganan');

    /**
     * Token instalasi dari env. Kosong = instalasi ini tidak dikelola qendali.com.
     * SATU-SATUNYA pembaca token di seluruh modul ini.
     */
    private tokenInstalasi(): string {
        return (process.env.QENDALI_LISENSI_TOKEN ?? '').trim();
    }

    /** Alamat penerbit, tanpa garis miring di ujung. */
    private dasar(): string {
        return ((process.env.QENDALI_LISENSI_URL ?? '').trim() || URL_BAWAAN).replace(/\/+$/, '');
    }

    /**
     * Apakah instalasi ini tersambung ke qendali.com?
     *
     * `false` itu KEADAAN NORMAL, bukan galat: instalasi lama (Voliko) dan tiap lingkungan
     * pengembangan memang belum punya token. Halaman langganan harus tetap terbuka dan
     * menjelaskan keadaannya, bukan menampilkan layar merah.
     */
    tersambung(): boolean {
        return this.tokenInstalasi().length > 0;
    }

    /** Alamat penerbit untuk ditampilkan (bukan rahasia — token-nya yang rahasia). */
    alamatPenerbit(): string {
        return this.dasar();
    }

    /**
     * Panggil satu endpoint `/api/aplikasi/*` dan kembalikan badannya.
     *
     * Melempar `HttpException` dengan kode status penerbit kalau penerbit menolak, atau 503
     * kalau qendali.com tidak terjangkau. Yang dilempar selalu berbentuk `{salah, pesan}`
     * supaya frontend cuma perlu mengenal satu bentuk.
     */
    async panggil<T = unknown>(
        metode: 'GET' | 'POST' | 'PUT' | 'DELETE',
        jalur: string,
        badan?: unknown,
    ): Promise<T> {
        const token = this.tokenInstalasi();
        if (!token) {
            // Dijaga juga di controller; di sini sebagai jaring terakhir supaya tidak pernah
            // ada panggilan tanpa token yang jawabannya membingungkan (401 dari penerbit).
            throw new HttpException(
                {
                    salah: 'belum_tersambung',
                    pesan:
                        'Instalasi ini belum tersambung ke qendali.com, jadi langganannya belum bisa ' +
                        'diatur dari sini. Hubungi Qendali lewat WhatsApp.',
                } satisfies GalatQendali,
                409,
            );
        }

        const alamat = `${this.dasar()}/api/aplikasi/${jalur}`;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

        try {
            const res = await fetch(alamat, {
                method: metode,
                headers: {
                    authorization: `Bearer ${token}`,
                    accept: 'application/json',
                    ...(badan === undefined ? {} : { 'content-type': 'application/json' }),
                },
                body: badan === undefined ? undefined : JSON.stringify(badan),
                signal: ac.signal,
            });

            const isi = (await res.json().catch(() => ({}))) as Record<string, unknown>;

            if (!res.ok) {
                // Diteruskan apa adanya: `pesan` dari penerbit memang untuk dibaca orang.
                const salah = typeof isi.salah === 'string' ? isi.salah : 'gangguan_server';
                const pesan =
                    typeof isi.pesan === 'string'
                        ? isi.pesan
                        : `qendali.com menolak permintaan (HTTP ${res.status}).`;
                // Yang dicatat cuma kode galat & status — JANGAN pernah mencatat token.
                this.log.warn(`${metode} ${jalur} ditolak penerbit: HTTP ${res.status} ${salah}`);
                throw new HttpException({ salah, pesan } satisfies GalatQendali, res.status);
            }

            return isi as T;
        } catch (e: unknown) {
            if (e instanceof HttpException) throw e;
            const pesan = e instanceof Error ? e.message : String(e);
            const timeout = pesan.toLowerCase().includes('abort');
            this.log.warn(`Tidak bisa menghubungi ${this.dasar()}: ${timeout ? 'timeout 10 detik' : pesan}`);
            // 503, bukan 500: ini gangguan sementara di jaringan/penerbit, bukan bug di sini.
            throw new HttpException(
                {
                    salah: 'tidak_terjangkau',
                    pesan: timeout
                        ? 'qendali.com tidak menjawab dalam 10 detik. Coba lagi sebentar lagi — ' +
                          'langgananmu tidak berubah, dan kasir tetap jalan seperti biasa.'
                        : 'Tidak bisa menghubungi qendali.com. Periksa koneksi internet server, ' +
                          'lalu coba lagi. Langgananmu tidak berubah, dan kasir tetap jalan seperti biasa.',
                } satisfies GalatQendali,
                503,
            );
        } finally {
            clearTimeout(timer);
        }
    }
}

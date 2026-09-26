import { SetMetadata } from '@nestjs/common';

export const FITUR_KEY = 'lisensi:butuh-fitur';
export const FITUR_SALAH_SATU_KEY = 'lisensi:butuh-salah-satu-fitur';

/**
 * Tandai endpoint (atau seluruh controller) sebagai milik satu kode fitur lisensi.
 *
 *     @ButuhFitur('production.board')
 *     @Get('jobs')
 *     list() { … }
 *
 * Kode fiturnya kosakata `data/paket.json` di repo qendali — mis. `production.board`,
 * `print.queue`, `ai.studio`, `branch.ledger`. Tulis kodenya apa adanya; jangan bikin nama
 * baru di sini, nanti kunci yang terbit tidak pernah cocok.
 *
 * **SEMUA kode yang disebut wajib ada di kunci** (DAN). Dipakai kalau memang butuh dua-duanya:
 * `@ButuhFitur('wa.cloud', 'wa.automation')` di broadcast — siaran tanpa channel WA tidak ada
 * artinya. Kalau yang kamu maksud "salah satunya cukup", pakai `@ButuhSalahSatuFitur` di bawah;
 * salah pilih di antara keduanya adalah cara paling gampang menolak klien yang sudah bayar.
 *
 * Penjaganya `FiturGuard`, terpasang GLOBAL (lihat `lisensi.module.ts`) — jadi cukup memasang
 * dekorator ini, tidak perlu ikut `@UseGuards`. Tanpa kunci lisensi, dekorator ini tidak
 * melakukan apa pun (gagal-terbuka).
 *
 * Menyembunyikan menu di frontend BUKAN penegakan — itu kosmetik. Penegakannya di sini.
 */
export const ButuhFitur = (...kodeFitur: string[]) => SetMetadata(FITUR_KEY, kodeFitur);

/**
 * Seperti `@ButuhFitur`, tapi **SALAH SATU kode saja sudah cukup** (ATAU).
 *
 *     @ButuhSalahSatuFitur('crm.leads', 'team.leaderboard', 'cs.rating')
 *     @Controller('crm/kpi')
 *     export class KpiController { … }
 *
 * Untuk halaman yang isinya CAMPUR dari beberapa fitur sekaligus. Contoh yang melahirkannya:
 * dasbor `/crm/kpi` menampilkan kepatuhan follow-up (`crm.leads`), leaderboard desainer &
 * operator (`team.leaderboard`), dan tren rating CS (`cs.rating`) di satu layar. Dengan
 * `@ButuhFitur` ketiga kode itu jadi syarat sekaligus, jadi klien yang cuma berlangganan
 * leaderboard kena 403 di halaman yang sebenarnya separuhnya miliknya — dan itu sebabnya
 * kedua endpoint ini dulu dibiarkan terbuka sama sekali.
 *
 * **Bedanya dengan `@ButuhFitur` dalam satu kalimat:** `@ButuhFitur` = "wajib punya SEMUA",
 * `@ButuhSalahSatuFitur` = "cukup punya SATU". Yang satu penjaga add-on yang memang dijual
 * sepaket; yang satu pintu ke halaman gabungan. Jangan pernah menukar keduanya hanya karena
 * daftar kodenya kebetulan sama panjang — ada tes khusus yang menjaga ini
 * (`penjaga-terjadwal.spec.ts` → "dua dekorator tidak tertukar").
 *
 * Yang TIDAK dilakukannya: menyaring isi jawaban. Klien yang cuma punya `cs.rating` tetap
 * menerima seluruh isi dasbor KPI, termasuk angka leaderboard. Menyaring per bagian butuh
 * pemikiran produk sendiri (panel kosong tanpa penjelasan lebih membingungkan daripada
 * panel yang ada isinya), dan halaman ini sebelumnya tidak dijaga sama sekali — jadi ini
 * tetap lebih rapat daripada keadaan sebelumnya, bukan lebih longgar.
 *
 * Memasang KEDUANYA di satu handler berarti dua-duanya harus lolos (metadatanya beda kunci,
 * jadi tidak saling menimpa). Boleh, tapi hampir selalu tanda daftar fiturnya perlu dipikir
 * ulang, bukan ditumpuk.
 */
export const ButuhSalahSatuFitur = (...kodeFitur: string[]) => SetMetadata(FITUR_SALAH_SATU_KEY, kodeFitur);

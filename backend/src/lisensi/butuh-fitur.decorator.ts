import { SetMetadata } from '@nestjs/common';

export const FITUR_KEY = 'lisensi:butuh-fitur';

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
 * Penjaganya `FiturGuard`, terpasang GLOBAL (lihat `lisensi.module.ts`) — jadi cukup memasang
 * dekorator ini, tidak perlu ikut `@UseGuards`. Tanpa kunci lisensi, dekorator ini tidak
 * melakukan apa pun (gagal-terbuka).
 *
 * Menyembunyikan menu di frontend BUKAN penegakan — itu kosmetik. Penegakannya di sini.
 */
export const ButuhFitur = (...kodeFitur: string[]) => SetMetadata(FITUR_KEY, kodeFitur);

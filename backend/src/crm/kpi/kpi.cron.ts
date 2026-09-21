import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KpiService } from './kpi.service';
import type { BranchContext } from '../../common/branch-context.decorator';

/**
 * Cron pengumuman juara leaderboard ke Discord.
 * Tiap Senin 08:00 WIB kirim rekap juara minggu sebelumnya ke channel #leaderboard.
 *
 * Context cabang: { branchId: null } = semua cabang (branchWhere → tanpa filter).
 * Pengiriman tetap di-gate oleh DiscordConfig (master enabled + toggle `champion`)
 * di dalam DiscordService.send(), jadi cron aman dijalankan tanpa cek tambahan.
 */
@Injectable()
export class KpiCron {
    private readonly logger = new Logger('KpiCron');

    constructor(private readonly kpi: KpiService) {}

    @Cron('0 8 * * 1', { name: 'discord-champion-weekly', timeZone: 'Asia/Jakarta' })
    async weeklyChampion() {
        try {
            const ctx = { branchId: null } as unknown as BranchContext;
            // Minggu LALU penuh: Senin 00.00 – Minggu 23.59 WIB. Dulu "7 hari s/d hari ini" dijalankan
            // Senin 08.00 → Senin 08.00–23.59 tak pernah terhitung di rekap mana pun.
            const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const now = new Date();
            const senin = new Date(now); senin.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
            const minggu = new Date(senin); minggu.setDate(senin.getDate() + 6);
            await this.kpi.sendChampionRecap(ctx, { period: 'custom', start: ymd(senin), end: ymd(minggu), label: `Minggu Lalu (${senin.getDate()}/${senin.getMonth() + 1}–${minggu.getDate()}/${minggu.getMonth() + 1})` } as any);
            this.logger.log('Pengumuman juara mingguan dikirim ke Discord (jika aktif).');
        } catch (err) {
            this.logger.error('Gagal kirim pengumuman juara mingguan', err as Error);
        }
    }
}

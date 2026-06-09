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
            await this.kpi.sendChampionRecap(ctx, { period: 'week' });
            this.logger.log('Pengumuman juara mingguan dikirim ke Discord (jika aktif).');
        } catch (err) {
            this.logger.error('Gagal kirim pengumuman juara mingguan', err as Error);
        }
    }
}

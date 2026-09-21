import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TaskBoardService } from './task-board.service';
import { TaskPiketService } from './task-piket.service';

@Injectable()
export class TaskBoardCron implements OnApplicationBootstrap {
  private readonly logger = new Logger('TaskBoardCron');
  constructor(
    private readonly svc: TaskBoardService,
    private readonly piket: TaskPiketService,
  ) {}

  // Susulan saat server hidup: restart yang melewati 00:05 (mis. pemasangan tengah malam) dulu membuat
  // kartu piket hari itu tak pernah terbuat. Aman diulang (indeks unik jadwal+orang+periode).
  // Hanya sebelum 08.00: kartu yang baru muncul siang hari bisa langsung "terlambat" & kena teguran
  // otomatis padahal karyawan tak pernah melihatnya.
  onApplicationBootstrap() {
    if (new Date().getHours() >= 8) return;
    setTimeout(() => {
      this.generateDaily().catch(() => undefined);
    }, 60_000).unref?.();
  }

  // Tiap hari 00:05 waktu server → buat kartu tugas jatuh tempo hari itu.
  @Cron('5 0 * * *', { name: 'task-board-generate-daily' })
  async generateDaily() {
    try {
      const r = await this.svc.generateDue(new Date());
      this.logger.log(
        `Generate harian: ${r.created} kartu baru (${r.scanned} jadwal aktif).`,
      );
    } catch (e) {
      this.logger.error('Gagal generate kartu harian', e as any);
    }
  }

  // Tiap 5 menit → tegur otomatis tugas yang lewat batas (+ toleransi) & belum Selesai.
  @Cron('*/5 * * * *', { name: 'task-board-auto-warn' })
  async autoWarn() {
    try {
      await this.piket.sendAutoWarnings(new Date());
    } catch (e) {
      this.logger.error('Gagal mengirim teguran otomatis', e as any);
    }
  }
}

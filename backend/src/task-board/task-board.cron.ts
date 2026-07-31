import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TaskBoardService } from './task-board.service';

@Injectable()
export class TaskBoardCron {
  private readonly logger = new Logger('TaskBoardCron');
  constructor(private readonly svc: TaskBoardService) {}

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
}

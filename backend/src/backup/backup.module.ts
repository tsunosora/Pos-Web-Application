import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { RcloneService } from './rclone.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    // ScheduleModule.forRoot() cukup SEKALI di AppModule (global). Mendaftarkannya lagi di
    // sini membuat penjadwal kedua → setiap @Cron/@Interval di aplikasi jalan dua kali.
    // SchedulerRegistry untuk jadwal backup tetap tersedia dari modul global itu.
    imports: [PrismaModule],
    controllers: [BackupController],
    providers: [BackupService, RcloneService],
    exports: [BackupService, RcloneService],
})
export class BackupModule {}

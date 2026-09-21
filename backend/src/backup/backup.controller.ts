import {
    Controller, Post, Get, Body, Res, Req, UseGuards,
    UseInterceptors, UploadedFile, BadRequestException, Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BackupService, BackupGroupKey } from './backup.service';
import { RcloneService } from './rclone.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiscordService } from '../discord/discord.service';
import { ManagerGuard, OwnerGuard, isOwnerLevelRole } from '../auth/role-groups';

// Halaman cadangan setingkat manajer (status & jalankan cadangan terjadwal). Mengunduh cadangan
// penuh (berisi token WA/Meta, PIN, hash sandi), memulihkan, dan mengubah tujuan rclone hanya
// owner — peran "Admin" (kasir/CS) setingkat manajer.
@UseGuards(JwtAuthGuard, ManagerGuard)
@Controller('backup')
export class BackupController {
    private readonly logger = new Logger('BackupAudit');

    constructor(
        private readonly backupService: BackupService,
        private readonly rcloneService: RcloneService,
        private readonly discord: DiscordService,
    ) {}

    // ── Backup manual ────────────────────────────────────────────────────────

    @Get('groups')
    getGroups() {
        return this.backupService.getGroups();
    }

    @Post('export')
    @UseGuards(OwnerGuard)
    async exportBackup(
        @Body() body: { groups: string[]; includeImages?: boolean },
        @Res() res: Response,
        @Req() req: any,
    ) {
        this.logger.warn(`[AUDIT] backup_export user=${req.user?.userId ?? '?'} email=${req.user?.email ?? '?'} grup=${(body.groups || ['all']).join(',')}`);
        const groups = body.groups || ['all'];
        const isAll = groups.includes('all');
        const includeImages = body.includeImages !== false;
        const dateStr = new Date().toISOString().split('T')[0];
        const label = isAll ? 'full' : groups.join('-');
        const suffix = includeImages ? '' : '-dataonly';
        const slug = await this.backupService.getStoreSlug();
        const filename = `pospro-backup-${slug}-${label}${suffix}-${dateStr}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await this.backupService.streamBackupZip(
            isAll ? 'all' : (groups as BackupGroupKey[]),
            res,
            includeImages,
        );
    }

    @Post('preview')
    @UseGuards(OwnerGuard)
    @UseInterceptors(FileInterceptor('file'))
    previewBackup(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File backup wajib diunggah.');
        const isZip = file.originalname.endsWith('.zip') || file.mimetype === 'application/zip';
        return isZip
            ? this.backupService.parseBackupZip(file.buffer)
            : this.backupService.parseBackupFile(file.buffer.toString('utf-8'));
    }

    @Post('restore')
    @UseGuards(OwnerGuard)
    @UseInterceptors(FileInterceptor('file'))
    async restoreBackup(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
        @Body('mode') mode: 'skip' | 'overwrite' = 'skip',
        @Body('tables') tables?: string,
    ) {
        if (!file) throw new BadRequestException('File backup wajib diunggah.');
        const isZip = file.originalname.endsWith('.zip') || file.mimetype === 'application/zip';
        const selectedTables = tables ? tables.split(',').map(t => t.trim()).filter(Boolean) : undefined;
        // Jejak audit (T-01): memulihkan backup bisa menimpa database — catat siapa & apa.
        const siapa = `user=${req.user?.userId ?? '?'} email=${req.user?.email ?? '?'}`;
        const apa = `berkas=${file.originalname} mode=${mode} tabel=${selectedTables?.join(',') || 'semua'}`;
        this.logger.warn(`[AUDIT] backup_restore mulai ${siapa} ${apa}`);
        const hasil = await this.backupService.importBackup(file.buffer, isZip, mode, selectedTables);
        this.logger.warn(`[AUDIT] backup_restore selesai ${siapa}`);
        this.discord.send('backup', {
            title: '♻️ Backup dipulihkan',
            description: `Database dipulihkan dari berkas cadangan oleh ${req.user?.email ?? 'akun tak dikenal'}.`,
            fields: [
                { name: 'Berkas', value: file.originalname.slice(0, 200) },
                { name: 'Mode', value: mode === 'overwrite' ? 'Timpa data yang ada' : 'Lewati data yang sudah ada', inline: true },
                { name: 'Tabel', value: (selectedTables?.join(', ') || 'semua').slice(0, 900), inline: true },
            ],
        }).catch(() => { /* notifikasi gagal tidak membatalkan pemulihan */ });
        return hasil;
    }

    // ── Rclone ───────────────────────────────────────────────────────────────

    @Get('rclone/status')
    async getRcloneStatus(@Req() req: any) {
        const s: any = await this.rcloneService.getStatus();
        // Tujuan & folder cadangan hanya untuk owner.
        return isOwnerLevelRole(req.user?.roleName) ? s : { ...s, remote: s?.remote ? '(diatur owner)' : null, localBackupDir: undefined };
    }

    @Post('rclone/settings')
    @UseGuards(OwnerGuard)
    saveRcloneSettings(@Body() body: {
        enabled: boolean;
        remote?: string;
        schedule?: string;
        keepCount?: number;
    }) {
        return this.rcloneService.saveSettings(body);
    }

    @Post('rclone/trigger')
    async triggerRcloneBackup() {
        const status = await this.rcloneService.getStatus();
        if (!status.installed) {
            throw new BadRequestException('rclone tidak terinstal di server. Instal rclone terlebih dahulu.');
        }
        if (this.rcloneService.getProgress().running) {
            return { success: true, message: 'Backup sudah berjalan', progress: this.rcloneService.getProgress() };
        }
        // Fire and forget — progress dipoll via GET /backup/rclone/progress
        this.rcloneService.runBackup();
        return { success: true, message: 'Backup sedang diproses...', progress: this.rcloneService.getProgress() };
    }

    /** Progress backup manual (fase + persen) — dipoll frontend untuk animasi. */
    @Get('rclone/progress')
    getRcloneProgress() {
        return this.rcloneService.getProgress();
    }
}

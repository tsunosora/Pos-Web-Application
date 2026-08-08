import {
    Controller, Post, Get, Body, Res, UseGuards,
    UseInterceptors, UploadedFile, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BackupService, BackupGroupKey } from './backup.service';
import { RcloneService } from './rclone.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('backup')
export class BackupController {
    constructor(
        private readonly backupService: BackupService,
        private readonly rcloneService: RcloneService,
    ) {}

    // ── Backup manual ────────────────────────────────────────────────────────

    @Get('groups')
    getGroups() {
        return this.backupService.getGroups();
    }

    @Post('export')
    async exportBackup(
        @Body() body: { groups: string[]; includeImages?: boolean },
        @Res() res: Response,
    ) {
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
    @UseInterceptors(FileInterceptor('file'))
    previewBackup(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File backup wajib diunggah.');
        const isZip = file.originalname.endsWith('.zip') || file.mimetype === 'application/zip';
        return isZip
            ? this.backupService.parseBackupZip(file.buffer)
            : this.backupService.parseBackupFile(file.buffer.toString('utf-8'));
    }

    @Post('restore')
    @UseInterceptors(FileInterceptor('file'))
    async restoreBackup(
        @UploadedFile() file: Express.Multer.File,
        @Body('mode') mode: 'skip' | 'overwrite' = 'skip',
        @Body('tables') tables?: string,
    ) {
        if (!file) throw new BadRequestException('File backup wajib diunggah.');
        const isZip = file.originalname.endsWith('.zip') || file.mimetype === 'application/zip';
        const selectedTables = tables ? tables.split(',').map(t => t.trim()).filter(Boolean) : undefined;
        return this.backupService.importBackup(file.buffer, isZip, mode, selectedTables);
    }

    // ── Rclone ───────────────────────────────────────────────────────────────

    @Get('rclone/status')
    getRcloneStatus() {
        return this.rcloneService.getStatus();
    }

    @Post('rclone/settings')
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

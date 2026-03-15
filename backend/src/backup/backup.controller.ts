import {
    Controller, Post, Get, Body, Res, UseGuards,
    UseInterceptors, UploadedFile, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BackupService, BackupGroupKey } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('backup')
export class BackupController {
    constructor(private readonly backupService: BackupService) {}

    // GET /backup/groups — daftar grup filter yang tersedia
    @Get('groups')
    getGroups() {
        return this.backupService.getGroups();
    }

    // POST /backup/export — stream ZIP langsung ke client
    // Body: { groups: ['all'], includeImages: true }
    @Post('export')
    async exportBackup(
        @Body() body: { groups: string[]; includeImages?: boolean },
        @Res() res: Response,
    ) {
        const groups = body.groups || ['all'];
        const isAll = groups.includes('all');
        const includeImages = body.includeImages !== false; // default true

        const dateStr = new Date().toISOString().split('T')[0];
        const label = isAll ? 'full' : groups.join('-');
        const suffix = includeImages ? '' : '-dataonly';
        const filename = `pospro-backup-${label}${suffix}-${dateStr}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await this.backupService.streamBackupZip(
            isAll ? 'all' : (groups as BackupGroupKey[]),
            res,
            includeImages,
        );
    }

    // POST /backup/preview — preview isi file backup (ZIP atau JSON)
    // multipart: file = backup ZIP/JSON
    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    previewBackup(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File backup wajib diunggah.');

        const isZip = file.originalname.endsWith('.zip') || file.mimetype === 'application/zip';

        if (isZip) {
            return this.backupService.parseBackupZip(file.buffer);
        } else {
            const content = file.buffer.toString('utf-8');
            return this.backupService.parseBackupFile(content);
        }
    }

    // POST /backup/restore — restore dari file backup (ZIP atau JSON)
    // multipart: file = backup ZIP/JSON, mode = 'skip' | 'overwrite', tables = opsional comma-separated
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
}

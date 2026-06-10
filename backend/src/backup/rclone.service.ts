import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService, storeSlug } from './backup.service';
import { DiscordService } from '../discord/discord.service';
import { CronJob } from 'cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);
const CRON_JOB_NAME = 'rclone-auto-backup';
const BACKUP_DIR = path.join(process.cwd(), 'backups');

@Injectable()
export class RcloneService implements OnModuleInit {
    private readonly logger = new Logger(RcloneService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly backupService: BackupService,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly discord: DiscordService,
    ) {}

    async onModuleInit() {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        await this.syncCronJob();
    }

    // ── Check rclone installation ────────────────────────────────────────────

    async checkRclone(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('rclone version');
            const match = stdout.match(/rclone v([\d.]+)/);
            return { installed: true, version: match?.[1] ?? 'unknown' };
        } catch {
            return { installed: false };
        }
    }

    // ── Status ───────────────────────────────────────────────────────────────

    async getStatus() {
        const settings: any = await this.prisma.storeSettings.findFirst();
        const { installed, version } = await this.checkRclone();
        const localBackups = this.listLocalBackups();
        return {
            installed,
            version,
            enabled: settings?.rcloneEnabled ?? false,
            remote: settings?.rcloneRemote || null,
            schedule: settings?.rcloneSchedule || '0 2 * * *',
            keepCount: settings?.rcloneKeepCount ?? 7,
            lastBackupAt: settings?.rcloneLastBackupAt || null,
            lastStatus: settings?.rcloneLastStatus || null,
            localBackupDir: BACKUP_DIR,
            localBackups,
        };
    }

    // ── Settings ─────────────────────────────────────────────────────────────

    async saveSettings(data: {
        enabled: boolean;
        remote?: string;
        schedule?: string;
        keepCount?: number;
    }) {
        const settings: any = await this.prisma.storeSettings.findFirst();
        if (!settings) return { success: false, message: 'Settings belum diinisialisasi.' };

        await this.prisma.storeSettings.update({
            where: { id: settings.id },
            data: {
                rcloneEnabled: data.enabled,
                rcloneRemote: data.remote?.trim() || null,
                rcloneSchedule: data.schedule || '0 2 * * *',
                rcloneKeepCount: data.keepCount ?? 7,
            } as any,
        });

        await this.syncCronJob();
        return { success: true };
    }

    // ── Run Backup ───────────────────────────────────────────────────────────

    async runBackup(): Promise<{ success: boolean; message: string; filename?: string }> {
        const settings: any = await this.prisma.storeSettings.findFirst();
        const remote: string | null = settings?.rcloneRemote || null;
        const keepCount: number = settings?.rcloneKeepCount ?? 7;
        const now = new Date();

        let localPath: string | null = null;
        try {
            // Build filename
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
            const filename = `pospro-backup-${storeSlug(settings?.storeName)}-${dateStr}.zip`;
            localPath = path.join(BACKUP_DIR, filename);

            // Save backup ZIP to local file
            this.logger.log(`Generating backup: ${filename}`);
            await this.backupService.writeBackupToFile(localPath);
            this.logger.log(`Backup saved locally: ${localPath}`);

            // Upload via rclone
            if (remote) {
                this.logger.log(`Uploading to rclone remote: ${remote}`);
                const { stderr } = await execAsync(`rclone copy "${localPath}" "${remote}"`, { timeout: 300_000 });
                if (stderr) this.logger.warn(`rclone stderr: ${stderr}`);
                this.logger.log('Upload complete');
            }

            // Prune old local backups
            this.pruneLocalBackups(keepCount);

            // Update last status in DB
            const statusMsg = remote
                ? `Berhasil — upload ke ${remote} (${filename})`
                : `Berhasil — disimpan lokal (${filename})`;
            await this.prisma.storeSettings.update({
                where: { id: settings.id },
                data: { rcloneLastBackupAt: now, rcloneLastStatus: statusMsg } as any,
            });

            this.discord.notifyBackup({ ok: true, detail: statusMsg });
            return { success: true, message: statusMsg, filename };
        } catch (err: any) {
            const msg: string = err?.message ?? String(err);
            this.logger.error('Backup gagal:', msg);
            this.discord.notifyBackup({ ok: false, detail: msg.slice(0, 400) });
            if (settings) {
                await this.prisma.storeSettings.update({
                    where: { id: settings.id },
                    data: { rcloneLastStatus: `Gagal: ${msg.slice(0, 400)}` } as any,
                });
            }
            // Clean up partial file
            if (localPath && fs.existsSync(localPath)) {
                try { fs.unlinkSync(localPath); } catch {}
            }
            return { success: false, message: msg };
        }
    }

    // ── Local file management ─────────────────────────────────────────────────

    listLocalBackups() {
        try {
            return fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('pospro-backup-') && f.endsWith('.zip'))
                .map(f => {
                    const stat = fs.statSync(path.join(BACKUP_DIR, f));
                    return { name: f, size: stat.size, createdAt: stat.mtime };
                })
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch {
            return [];
        }
    }

    private pruneLocalBackups(keepCount: number) {
        try {
            const files = this.listLocalBackups();
            files.slice(keepCount).forEach(f => {
                fs.unlinkSync(path.join(BACKUP_DIR, f.name));
                this.logger.log(`Pruned local backup: ${f.name}`);
            });
        } catch (e) {
            this.logger.warn('Gagal prune backup lokal:', e);
        }
    }

    // ── Cron job ──────────────────────────────────────────────────────────────

    async syncCronJob() {
        try { this.schedulerRegistry.deleteCronJob(CRON_JOB_NAME); } catch {}

        const settings: any = await this.prisma.storeSettings.findFirst();
        if (!settings?.rcloneEnabled) return;

        const schedule = settings.rcloneSchedule || '0 2 * * *';
        try {
            const job = new CronJob(schedule, () => {
                this.logger.log('Running scheduled rclone backup...');
                this.runBackup();
            });
            this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job as any);
            job.start();
            this.logger.log(`Rclone auto-backup dijadwalkan: ${schedule}`);
        } catch (e) {
            this.logger.error('Gagal daftarkan cron job:', e);
        }
    }
}

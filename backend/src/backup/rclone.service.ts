import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService, storeSlug } from './backup.service';
import { DiscordService } from '../discord/discord.service';
import { CronJob } from 'cron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);
const CRON_JOB_NAME = 'rclone-auto-backup';
const BACKUP_DIR = path.join(process.cwd(), 'backups');

export interface BackupProgress {
    running: boolean;
    phase: string;
    percent: number; // 0–100
    detail: string;
    startedAt: string | null;
    finishedAt: string | null;
    ok: boolean | null;
    error: string | null;
}

function fmtBytes(n: number): string {
    if (!n || n < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

@Injectable()
export class RcloneService implements OnModuleInit {
    private readonly logger = new Logger(RcloneService.name);

    // Progress backup manual (in-memory) — dipoll frontend untuk animasi + persen.
    private progress: BackupProgress = {
        running: false,
        phase: 'idle',
        percent: 0,
        detail: '',
        startedAt: null,
        finishedAt: null,
        ok: null,
        error: null,
    };

    getProgress(): BackupProgress {
        return this.progress;
    }

    private setProgress(patch: Partial<BackupProgress>) {
        this.progress = { ...this.progress, ...patch };
    }

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
        if (this.progress.running) {
            return { success: false, message: 'Backup sedang berjalan' };
        }
        // Set running SEBELUM await pertama agar poll frontend langsung melihatnya.
        this.setProgress({
            running: true, phase: 'Menyiapkan…', percent: 2, detail: '',
            startedAt: new Date().toISOString(), finishedAt: null, ok: null, error: null,
        });

        const settings: any = await this.prisma.storeSettings.findFirst();
        const remote: string | null = settings?.rcloneRemote || null;
        const keepCount: number = settings?.rcloneKeepCount ?? 7;
        const now = new Date();

        let localPath: string | null = null;
        try {
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
            const filename = `pospro-backup-${storeSlug(settings?.storeName)}-${dateStr}.zip`;
            localPath = path.join(BACKUP_DIR, filename);

            // 1) Dump DB + arsip ZIP (progress per-tabel → 5..55%).
            this.logger.log(`Generating backup: ${filename}`);
            await this.backupService.writeBackupToFile(localPath, (done, total) => {
                if (done >= total) {
                    this.setProgress({ phase: 'Mengarsipkan (ZIP)…', percent: 55, detail: `${total} tabel` });
                } else {
                    this.setProgress({ phase: `Menyiapkan data (${done}/${total} tabel)`, percent: 5 + Math.round((done / total) * 45), detail: '' });
                }
            });
            const zipSize = fs.existsSync(localPath) ? fs.statSync(localPath).size : 0;
            this.setProgress({ phase: 'Arsip selesai', percent: 60, detail: fmtBytes(zipSize) });
            this.logger.log(`Backup saved locally: ${localPath}`);

            // 2) Upload via rclone dengan progress (60..98%).
            if (remote) {
                this.setProgress({ phase: 'Mengunggah ke Google Drive…', percent: 60, detail: '' });
                this.logger.log(`Uploading to rclone remote: ${remote}`);
                await this.runRcloneCopy(localPath, remote);
                this.setProgress({ phase: 'Unggah selesai', percent: 98, detail: '' });
                this.logger.log('Upload complete');
            } else {
                this.setProgress({ percent: 96 });
            }

            // 3) Prune backup lokal lama.
            this.setProgress({ phase: 'Membersihkan backup lama…', percent: 98 });
            this.pruneLocalBackups(keepCount);

            const statusMsg = remote
                ? `Berhasil — upload ke ${remote} (${filename})`
                : `Berhasil — disimpan lokal (${filename})`;
            await this.prisma.storeSettings.update({
                where: { id: settings.id },
                data: { rcloneLastBackupAt: now, rcloneLastStatus: statusMsg } as any,
            });

            this.setProgress({ running: false, phase: 'Selesai', percent: 100, detail: statusMsg, ok: true, finishedAt: new Date().toISOString() });
            this.discord.notifyBackup({ ok: true, detail: statusMsg });
            return { success: true, message: statusMsg, filename };
        } catch (err: any) {
            const msg: string = err?.message ?? String(err);
            this.logger.error('Backup gagal:', msg);
            this.setProgress({ running: false, phase: 'Gagal', ok: false, error: msg.slice(0, 400), detail: msg.slice(0, 200), finishedAt: new Date().toISOString() });
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

    /** rclone copy dengan progress JSON — update this.progress (rentang 60..98%). */
    private runRcloneCopy(localPath: string, remote: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const proc = spawn('rclone', [
                'copy', localPath, remote,
                '--use-json-log', '--stats', '500ms', '--stats-log-level', 'NOTICE',
            ]);
            let lastLine = '';
            let settled = false;
            const timer = setTimeout(() => {
                proc.kill('SIGKILL');
                if (!settled) { settled = true; reject(new Error('rclone timeout (5 menit)')); }
            }, 300_000);
            const finish = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };

            const onData = (buf: Buffer) => {
                for (const line of buf.toString().split('\n')) {
                    const t = line.trim();
                    if (!t) continue;
                    lastLine = t;
                    try {
                        const obj = JSON.parse(t);
                        const st = obj?.stats;
                        if (st && st.totalBytes > 0) {
                            const up = Math.min(1, st.bytes / st.totalBytes);
                            this.setProgress({
                                phase: 'Mengunggah ke Google Drive…',
                                percent: 60 + Math.round(up * 38),
                                detail: `${fmtBytes(st.bytes)} / ${fmtBytes(st.totalBytes)}${st.speed ? ' • ' + fmtBytes(st.speed) + '/s' : ''}`,
                            });
                        }
                    } catch {
                        // baris non-JSON — abaikan
                    }
                }
            };
            proc.stdout.on('data', onData);
            proc.stderr.on('data', onData);
            proc.on('error', (e) => finish(() => reject(e)));
            proc.on('close', (code) =>
                finish(() => (code === 0 ? resolve() : reject(new Error(`rclone keluar kode ${code}: ${lastLine.slice(0, 200)}`)))),
            );
        });
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

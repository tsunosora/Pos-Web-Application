import { Injectable, Logger } from '@nestjs/common';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

// MIME → ekstensi berkas yang umum (untuk penamaan file lokal).
const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/amr': 'amr',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export interface MediaStorageStats {
    baseDir: string;
    totalBytes: number;
    fileCount: number;
    diskFreeBytes: number;
    diskTotalBytes: number;
    byMonth: Array<{ month: string; bytes: number; files: number }>;
}

/**
 * Penyimpanan media WhatsApp permanen di server (homelab). Media inbound/outbound
 * disalin ke disk (storage/wa-media/YYYY/MM/<msgId>.<ext>) supaya tidak hilang
 * saat retensi Meta (~30 hari) berakhir. Path relatif disimpan di WaMessage.mediaUrl.
 */
@Injectable()
export class MediaStorageService {
    private readonly logger = new Logger(MediaStorageService.name);
    /** Direktori dasar media (bisa dioverride via env WA_MEDIA_DIR). */
    readonly baseDir =
        process.env.WA_MEDIA_DIR || path.join(process.cwd(), 'storage', 'wa-media');

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    private extFor(mime?: string | null, originalName?: string | null): string {
        if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
        const fromName = originalName ? path.extname(originalName).replace(/^\./, '') : '';
        return fromName || (mime?.split('/')[1]?.split(';')[0] || 'bin');
    }

    /** true bila mediaUrl adalah path lokal (bukan URL http Meta). */
    isLocal(mediaUrl?: string | null): boolean {
        return !!mediaUrl && !/^https?:/i.test(mediaUrl) && !mediaUrl.includes('..');
    }

    private absolute(relPath: string): string {
        return path.join(this.baseDir, relPath);
    }

    /** Tulis buffer ke disk, kembalikan path relatif (YYYY/MM/<msgId>.<ext>). */
    async save(
        messageId: number,
        createdAt: Date,
        buffer: Buffer,
        mime?: string | null,
        originalName?: string | null,
    ): Promise<string> {
        const yyyy = String(createdAt.getFullYear());
        const mm = String(createdAt.getMonth() + 1).padStart(2, '0');
        const dir = path.join(this.baseDir, yyyy, mm);
        await fsp.mkdir(dir, { recursive: true });
        const filename = `${messageId}.${this.extFor(mime, originalName)}`;
        await fsp.writeFile(path.join(dir, filename), buffer);
        return path.posix.join(yyyy, mm, filename);
    }

    /** Baca berkas lokal; null bila tak ada. */
    async readLocal(relPath: string): Promise<Buffer | null> {
        if (!this.isLocal(relPath)) return null;
        try {
            return await fsp.readFile(this.absolute(relPath));
        } catch {
            return null;
        }
    }

    /** Unduh media dari Meta lalu simpan lokal + update mediaUrl. Best-effort. */
    async persistFromMeta(
        messageId: number,
        createdAt: Date,
        mediaId: string,
        mime?: string | null,
        originalName?: string | null,
    ): Promise<string | null> {
        try {
            const { buffer, contentType } = await this.cloud.getMediaBinary(mediaId);
            const rel = await this.save(messageId, createdAt, buffer, mime || contentType, originalName);
            await this.prisma.waMessage.update({ where: { id: messageId }, data: { mediaUrl: rel } });
            return rel;
        } catch (e) {
            this.logger.warn(`Gagal simpan media pesan ${messageId}: ${(e as Error).message}`);
            return null;
        }
    }

    /** Simpan buffer (media OUTBOUND yang sudah kita pegang) + update mediaUrl. */
    async persistBuffer(
        messageId: number,
        createdAt: Date,
        buffer: Buffer,
        mime?: string | null,
        originalName?: string | null,
    ): Promise<string | null> {
        try {
            const rel = await this.save(messageId, createdAt, buffer, mime, originalName);
            await this.prisma.waMessage.update({ where: { id: messageId }, data: { mediaUrl: rel } });
            return rel;
        } catch (e) {
            this.logger.warn(`Gagal simpan media OUTBOUND ${messageId}: ${(e as Error).message}`);
            return null;
        }
    }

    /** Statistik disk: total dipakai media WA + sisa/total disk server + rincian bulanan. */
    async stats(): Promise<MediaStorageStats> {
        let totalBytes = 0;
        let fileCount = 0;
        const byMonth: Record<string, { bytes: number; files: number }> = {};
        try {
            const years = await fsp.readdir(this.baseDir, { withFileTypes: true }).catch(() => []);
            for (const y of years) {
                if (!y.isDirectory()) continue;
                const months = await fsp.readdir(path.join(this.baseDir, y.name), { withFileTypes: true });
                for (const mo of months) {
                    if (!mo.isDirectory()) continue;
                    const key = `${y.name}-${mo.name}`;
                    const files = await fsp.readdir(path.join(this.baseDir, y.name, mo.name));
                    for (const f of files) {
                        const st = await fsp.stat(path.join(this.baseDir, y.name, mo.name, f)).catch(() => null);
                        if (!st?.isFile()) continue;
                        totalBytes += st.size;
                        fileCount += 1;
                        byMonth[key] = byMonth[key] || { bytes: 0, files: 0 };
                        byMonth[key].bytes += st.size;
                        byMonth[key].files += 1;
                    }
                }
            }
        } catch (e) {
            this.logger.warn(`Gagal hitung statistik media: ${(e as Error).message}`);
        }

        let diskFreeBytes = 0;
        let diskTotalBytes = 0;
        try {
            await fsp.mkdir(this.baseDir, { recursive: true });
            const vfs = await (fsp as unknown as { statfs: (p: string) => Promise<{ bsize: number; blocks: number; bavail: number }> }).statfs(this.baseDir);
            diskTotalBytes = vfs.bsize * vfs.blocks;
            diskFreeBytes = vfs.bsize * vfs.bavail;
        } catch {
            // statfs tak tersedia di runtime ini — biarkan 0.
        }

        return {
            baseDir: this.baseDir,
            totalBytes,
            fileCount,
            diskFreeBytes,
            diskTotalBytes,
            byMonth: Object.entries(byMonth)
                .map(([month, v]) => ({ month, ...v }))
                .sort((a, b) => a.month.localeCompare(b.month)),
        };
    }

    /**
     * Hapus berkas media untuk pesan yang createdAt < before (mediaUrl lokal),
     * lalu kosongkan mediaUrl (riwayat teks TETAP). Kembalikan jumlah & byte terbebas.
     */
    async cleanupBefore(before: Date): Promise<{ deletedFiles: number; freedBytes: number }> {
        const rows = await this.prisma.waMessage.findMany({
            where: { createdAt: { lt: before }, mediaUrl: { not: null } },
            select: { id: true, mediaUrl: true },
        });
        let deletedFiles = 0;
        let freedBytes = 0;
        const clearedIds: number[] = [];
        for (const r of rows) {
            if (!this.isLocal(r.mediaUrl)) continue;
            const abs = this.absolute(r.mediaUrl as string);
            try {
                const st = await fsp.stat(abs).catch(() => null);
                await fsp.unlink(abs);
                if (st?.isFile()) {
                    freedBytes += st.size;
                    deletedFiles += 1;
                }
            } catch {
                // berkas mungkin sudah tak ada — tetap kosongkan referensi.
            }
            clearedIds.push(r.id);
        }
        if (clearedIds.length) {
            await this.prisma.waMessage.updateMany({
                where: { id: { in: clearedIds } },
                data: { mediaUrl: null },
            });
        }
        return { deletedFiles, freedBytes };
    }
}

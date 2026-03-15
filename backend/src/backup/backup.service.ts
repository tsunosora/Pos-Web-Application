import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// Gunakan require() agar tidak butuh @types/archiver & @types/adm-zip
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

// ─── Grup filter yang bisa dipilih user ────────────────────────────────────
// PENTING: nama harus sesuai Prisma accessor (singular camelCase)
export const BACKUP_GROUPS = {
    master: {
        label: 'Master Data',
        tables: ['role', 'category', 'unit', 'storeSettings', 'bankAccount', 'branch'],
    },
    users: {
        label: 'Pengguna',
        tables: ['user'],
    },
    products: {
        label: 'Produk & Inventori',
        tables: ['product', 'productVariant', 'ingredient', 'variantIngredient', 'variantPriceTier', 'batch', 'stockMovement'],
    },
    suppliers: {
        label: 'Supplier',
        tables: ['supplier', 'supplierItem'],
    },
    customers: {
        label: 'Pelanggan',
        tables: ['customer'],
    },
    hpp: {
        label: 'HPP & Costing',
        tables: ['hppWorksheet', 'hppVariableCost', 'hppFixedCost'],
    },
    transactions: {
        label: 'Transaksi & Penjualan',
        tables: ['transaction', 'transactionItem', 'cashflow'],
    },
    invoices: {
        label: 'Invoice & Penawaran',
        tables: ['invoice', 'invoiceItem'],
    },
    production: {
        label: 'Produksi',
        tables: ['productionBatch', 'productionJob'],
    },
    opname: {
        label: 'Stok Opname',
        tables: ['stockOpnameSession', 'stockOpnameItem'],
    },
    reports: {
        label: 'Laporan Shift',
        tables: ['shiftReport', 'competitor'],
    },
} as const;

export type BackupGroupKey = keyof typeof BACKUP_GROUPS;

// Urutan restore — penting untuk FK integrity
const RESTORE_ORDER = [
    'role', 'storeSettings', 'bankAccount', 'category', 'unit', 'branch', 'competitor',
    'user', 'customer', 'supplier',
    'product', 'productVariant',
    'ingredient', 'variantIngredient', 'variantPriceTier',
    'batch', 'stockMovement', 'supplierItem',
    'hppWorksheet', 'hppVariableCost', 'hppFixedCost',
    'transaction', 'transactionItem', 'cashflow',
    'invoice', 'invoiceItem',
    'productionBatch', 'productionJob',
    'stockOpnameSession', 'stockOpnameItem',
    'shiftReport',
];

// Path folder uploads gambar
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads');

@Injectable()
export class BackupService {
    constructor(private prisma: PrismaService) {}

    // ── Export / Backup — stream ZIP langsung ke response ──────────────────

    async streamBackupZip(
        selectedGroups: BackupGroupKey[] | 'all',
        outputStream: any,
        includeImages = true,
    ): Promise<void> {
        // ── 1. Kumpulkan data DB secara PARALLEL ──────────────────────────
        let tablesToExport: string[];
        if (selectedGroups === 'all') {
            tablesToExport = Object.values(BACKUP_GROUPS).flatMap(g => [...g.tables]);
        } else {
            tablesToExport = selectedGroups.flatMap(g => [...(BACKUP_GROUPS[g]?.tables ?? [])]);
        }
        tablesToExport = [...new Set(tablesToExport)];

        // Query semua tabel secara paralel — jauh lebih cepat dari sequential loop
        const results = await Promise.all(
            tablesToExport.map(async (table) => {
                try {
                    const rows = await (this.prisma as any)[table].findMany();
                    return { table, rows };
                } catch {
                    return { table, rows: [] };
                }
            })
        );

        const data: Record<string, any[]> = {};
        const counts: Record<string, number> = {};
        for (const { table, rows } of results) {
            data[table] = rows;
            counts[table] = rows.length;
        }

        const backupJson = {
            meta: {
                version: '2.0',
                createdAt: new Date().toISOString(),
                app: 'PosPro',
                tables: tablesToExport,
                groups: selectedGroups === 'all' ? Object.keys(BACKUP_GROUPS) : selectedGroups,
                rowCounts: counts,
                includesImages: includeImages,
            },
            data,
        };

        // ── 2. Stream ZIP langsung ke response ────────────────────────────
        return new Promise<void>((resolve, reject) => {
            // Kompresi level 1 untuk data.json, store mode (level 0) untuk gambar
            const archive = archiver('zip', { zlib: { level: 1 } });

            archive.on('error', reject);
            archive.on('finish', resolve);

            // Pipe langsung ke response — tidak buffer di RAM
            archive.pipe(outputStream);

            // Tambahkan data.json
            archive.append(JSON.stringify(backupJson, null, 2), { name: 'data.json' });

            // Tambahkan folder uploads tanpa kompresi ulang (gambar sudah terkompresi)
            if (includeImages && fs.existsSync(UPLOADS_DIR)) {
                archive.directory(UPLOADS_DIR, 'uploads', { store: true } as any);
            }

            archive.finalize();
        });
    }

    // ── Preview Backup File JSON ─────────────────────────────────────────────

    parseBackupFile(content: string) {
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw new BadRequestException('File backup tidak valid atau rusak (bukan JSON).');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format file backup tidak dikenali. Pastikan file berasal dari sistem PosPro.');
        }

        return {
            meta: parsed.meta,
            preview: Object.entries(parsed.data as Record<string, any[]>).map(([table, rows]) => ({
                table,
                count: rows.length,
            })),
            imageCount: 0,
        };
    }

    // ── Preview Backup ZIP ───────────────────────────────────────────────────

    parseBackupZip(fileBuffer: Buffer): { meta: any; preview: { table: string; count: number }[]; imageCount: number } {
        let zip: any;
        try {
            zip = new AdmZip(fileBuffer);
        } catch {
            throw new BadRequestException('File ZIP tidak valid atau rusak.');
        }

        const dataEntry = zip.getEntry('data.json');
        if (!dataEntry) {
            throw new BadRequestException('File ZIP tidak mengandung data.json. Pastikan file berasal dari sistem PosPro.');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(dataEntry.getData().toString('utf-8'));
        } catch {
            throw new BadRequestException('data.json di dalam ZIP tidak valid.');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format data.json tidak dikenali.');
        }

        const imageEntries: any[] = zip.getEntries().filter(
            (e: any) => e.entryName.startsWith('uploads/') && !e.isDirectory
        );

        return {
            meta: parsed.meta,
            preview: Object.entries(parsed.data as Record<string, any[]>).map(([table, rows]) => ({
                table,
                count: rows.length,
            })),
            imageCount: imageEntries.length,
        };
    }

    // ── Import / Restore ────────────────────────────────────────────────────

    async importBackup(
        fileBuffer: Buffer,
        isZip: boolean,
        mode: 'skip' | 'overwrite' = 'skip',
        selectedTables?: string[],
    ) {
        let jsonContent: string;
        let zip: any = null;

        if (isZip) {
            try {
                zip = new AdmZip(fileBuffer);
            } catch {
                throw new BadRequestException('File ZIP tidak valid atau rusak.');
            }
            const dataEntry = zip.getEntry('data.json');
            if (!dataEntry) throw new BadRequestException('File ZIP tidak mengandung data.json.');
            jsonContent = dataEntry.getData().toString('utf-8');
        } else {
            jsonContent = fileBuffer.toString('utf-8');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(jsonContent);
        } catch {
            throw new BadRequestException('File backup tidak valid atau rusak (bukan JSON).');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format file backup tidak dikenali.');
        }

        const backupData: Record<string, any[]> = parsed.data;

        const tablesToRestore = selectedTables
            ? selectedTables.filter(t => backupData[t])
            : RESTORE_ORDER.filter(t => backupData[t] !== undefined);

        const ordered = RESTORE_ORDER.filter(t => tablesToRestore.includes(t));
        const result: Record<string, { success: number; skipped: number; error: string | null }> = {};

        // ── Restore database ──────────────────────────────────────────────
        await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

        try {
            for (const table of ordered) {
                const rows: any[] = backupData[table] || [];
                if (!rows.length) {
                    result[table] = { success: 0, skipped: 0, error: null };
                    continue;
                }

                result[table] = { success: 0, skipped: 0, error: null };

                if (mode === 'overwrite') {
                    try {
                        await (this.prisma as any)[table].deleteMany({});
                        const cleaned = rows.map(r => this.cleanRow(r));
                        await (this.prisma as any)[table].createMany({ data: cleaned, skipDuplicates: true });
                        result[table].success = cleaned.length;
                    } catch (e: any) {
                        result[table].error = e.message?.substring(0, 200) ?? 'Unknown error';
                    }
                } else {
                    let success = 0;
                    let skipped = 0;
                    for (const row of rows) {
                        try {
                            const cleaned = this.cleanRow(row);
                            await (this.prisma as any)[table].upsert({
                                where: { id: cleaned.id },
                                create: cleaned,
                                update: {},
                            });
                            success++;
                        } catch {
                            skipped++;
                        }
                    }
                    result[table].success = success;
                    result[table].skipped = skipped;
                }
            }
        } finally {
            await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
        }

        // ── Restore gambar dari ZIP ───────────────────────────────────────
        let imagesRestored = 0;
        if (zip) {
            const imageEntries: any[] = zip.getEntries().filter(
                (e: any) => e.entryName.startsWith('uploads/') && !e.isDirectory
            );
            if (imageEntries.length > 0) {
                if (!fs.existsSync(UPLOADS_DIR)) {
                    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
                }
                for (const entry of imageEntries) {
                    const filename = path.basename(entry.entryName);
                    if (!filename) continue;
                    const destPath = path.join(UPLOADS_DIR, filename);
                    if (mode === 'skip' && fs.existsSync(destPath)) continue;
                    fs.writeFileSync(destPath, entry.getData());
                    imagesRestored++;
                }
            }
        }

        const totalRestored = Object.values(result).reduce((s, r) => s + r.success, 0);
        const totalSkipped = Object.values(result).reduce((s, r) => s + r.skipped, 0);
        const errors = Object.entries(result)
            .filter(([, r]) => r.error)
            .map(([t, r]) => `${t}: ${r.error}`);

        return {
            message: `Restore selesai. ${totalRestored} baris data berhasil, ${totalSkipped} dilewati, ${imagesRestored} gambar dipulihkan.`,
            totalRestored,
            totalSkipped,
            imagesRestored,
            errors,
            detail: result,
        };
    }

    // Bersihkan fields relasi nested sebelum insert
    private cleanRow(row: any): any {
        const cleaned: any = {};
        for (const [key, val] of Object.entries(row)) {
            if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !this.isDateString(val as any)) {
                continue;
            }
            if (Array.isArray(val)) continue;
            cleaned[key] = val;
        }
        return cleaned;
    }

    private isDateString(val: string): boolean {
        return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val);
    }

    // ── Info Grup ───────────────────────────────────────────────────────────

    getGroups() {
        return Object.entries(BACKUP_GROUPS).map(([key, group]) => ({
            key,
            label: group.label,
            tables: group.tables,
        }));
    }
}

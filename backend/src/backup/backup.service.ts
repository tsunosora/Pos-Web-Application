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
        tables: ['role', 'productionCategory', 'category', 'unit', 'storeSettings', 'bankAccount', 'branch', 'discordConfig'],
    },
    branches: {
        label: 'Cabang & Pengaturan Cabang',
        tables: ['companyBranch', 'branchSettings', 'branchStock', 'printerDevice'],
    },
    users: {
        label: 'Pengguna',
        tables: ['user'],
    },
    products: {
        label: 'Produk & Inventori',
        tables: ['product', 'productVariant', 'ingredient', 'variantIngredient', 'variantPriceTier', 'batch', 'stockMovement', 'stockPurchase', 'stockPurchaseItem'],
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
        tables: ['transaction', 'transactionItem', 'cashflow', 'cashflowChangeRequest', 'transactionEditRequest'],
    },
    invoices: {
        label: 'Invoice & Penawaran',
        tables: ['invoice', 'invoiceItem'],
    },
    salesOrders: {
        label: 'Sales Order & Designer',
        tables: ['designer', 'salesOrder', 'salesOrderItem', 'salesOrderProof'],
    },
    production: {
        label: 'Produksi & Antrian Cetak',
        tables: ['productionBatch', 'productionJob', 'productionJobProof', 'productionJobActivity', 'jerseyWorkOrder', 'printJob'],
    },
    branchWorkOrders: {
        label: 'Work Order Antar Cabang',
        tables: ['branchWorkOrder', 'branchWorkOrderItem'],
    },
    stockTransfers: {
        label: 'Transfer Stok Antar Cabang',
        tables: ['stockTransfer', 'stockTransferItem'],
    },
    interBranchLedger: {
        // Hanya berisi titipan paper print (yang punya biaya klik mesin).
        // Titipan banner = tracking via StockMovement, tidak masuk ledger formal.
        label: 'Buku Titipan Antar Cabang (Paper Print Settlement)',
        tables: ['interBranchLedger', 'ledgerSettlement'],
    },
    clickCounting: {
        label: 'Click Counting (Mesin Cetak)',
        tables: ['clickRate', 'clickLog', 'machineReject', 'meterReading'],
    },
    opname: {
        label: 'Stok Opname',
        tables: ['stockOpnameSession', 'stockOpnameItem'],
    },
    reports: {
        label: 'Laporan Shift',
        tables: ['shiftReport', 'competitor'],
    },
    crm: {
        label: 'CRM — Leads, Follow-ups, Templates',
        // Lead + items + images + activities + follow-ups + message templates
        tables: ['lead', 'leadItem', 'leadImage', 'leadActivity', 'followUp', 'messageTemplate'],
    },
    ownerFinance: {
        label: 'Biaya Owner — Beban Tetap, Iklan & Bonus',
        // fixedExpense: beban tetap bulanan (gaji/sewa/angsuran/supplier).
        // marketingSpend: biaya iklan per sumber (dashboard marketing).
        // bonusTarget/bonusAdjustment: target & penyesuaian bonus karyawan.
        tables: ['fixedExpense', 'marketingSpend', 'bonusTarget', 'bonusAdjustment', 'branchMonthlyClosing', 'centralTreasuryEntry'],
    },
    website: {
        label: 'Website — Landing Page & Artikel',
        tables: ['landingConfig', 'article'],
    },
    csRating: {
        label: 'Penilaian CS — Poling Ya/Tidak + Bintang',
        tables: ['csRatingConfig', 'csRatingResponse'],
    },
    sync: {
        label: 'Delta Sync Offline — jejak idempotensi',
        tables: ['syncedOp', 'syncState', 'syncPush', 'device'],
    },
    whatsapp: {
        label: 'WhatsApp CRM — channel, kontak, percakapan, pesan',
        // Cloud API resmi (modul whatsapp-cloud). Fase 5+ (broadcast/template)
        // akan menambah tabelnya sendiri di sini saat dibuat.
        tables: ['waChannel', 'waContact', 'waConversation', 'waTemplate', 'waBroadcast', 'waMessage', 'waWebhookEvent', 'waBroadcastRecipient', 'waAutoReplyRule', 'waReminderConfig', 'waReminderLog'],
    },
} as const;

export type BackupGroupKey = keyof typeof BACKUP_GROUPS;

/** Ubah nama toko jadi slug aman untuk nama file backup (fallback 'pospro'). */
export function storeSlug(name?: string | null): string {
    const slug = (name || '')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'pospro';
}

// Urutan restore — penting untuk FK integrity
export const RESTORE_ORDER = [
    'role', 'storeSettings', 'discordConfig', 'productionCategory', 'category', 'unit', 'branch', 'competitor',
    'companyBranch',                            // tenant root — sebelum semua model operasional ber-branchId
    'bankAccount',                              // FK → companyBranch
    'branchSettings',                           // FK → companyBranch
    'printerDevice',                            // FK → companyBranch (printer relay per cabang)
    'designer',                                 // sebelum salesOrder
    'user',                                     // FK → role + companyBranch (nullable untuk Owner)
    'customer', 'supplier',
    'product', 'productVariant',
    'branchStock',                              // FK → companyBranch + productVariant
    'ingredient', 'variantIngredient', 'variantPriceTier',
    'batch', 'stockMovement', 'supplierItem',
    'stockPurchase', 'stockPurchaseItem',       // pembelian stok → setelah supplier & variant
    'stockTransfer', 'stockTransferItem',       // transfer antar cabang → setelah companyBranch & productVariant
    'hppWorksheet', 'hppVariableCost', 'hppFixedCost',
    'transaction', 'transactionItem',
    'shiftReport',                              // sebelum cashflow karena cashflow punya FK ke shiftReport
    'cashflow', 'cashflowChangeRequest',        // cashflowChangeRequest → setelah cashflow & user
    'transactionEditRequest',                   // → setelah transaction & user
    'invoice', 'invoiceItem',
    'salesOrder', 'salesOrderItem', 'salesOrderProof',
    'productionBatch', 'productionJob',
    'productionJobProof',                       // FK → productionJob (cascade delete)
    'productionJobActivity',                    // FK → productionJob (audit log)
    'jerseyWorkOrder',                          // FK → productionJob (1-1). Setelah productionJob.
    'printJob',
    'branchWorkOrder', 'branchWorkOrderItem',
    'interBranchLedger',                        // FK → transaction + companyBranch (from/to). Setelah transaction & companyBranch.
    'ledgerSettlement',                         // FK → interBranchLedger + cashflow + stockMovement. Setelah ledger & cashflow & movements.
    'clickRate', 'clickLog', 'machineReject', 'meterReading',
    'stockOpnameSession', 'stockOpnameItem',
    'marketingSpend', 'fixedExpense',           // biaya owner — branchId scalar (tanpa FK keras), aman di sini
    'bonusTarget', 'bonusAdjustment',           // bonus karyawan — branchId scalar, tanpa FK keras
    'branchMonthlyClosing',                     // tutup buku bulanan per cabang — branchId scalar, tanpa FK keras
    'centralTreasuryEntry',                     // kas pusat (dompet owner) — branchId scalar, tanpa FK keras

    // CRM — diletakkan paling akhir karena bisa reference banyak entity:
    //   lead.assignedToId → user
    //   lead.convertedCustomerId → customer
    //   lead.convertedSalesOrderId → salesOrder
    //   leadItem.productVariantId → productVariant
    //   followUp.customerId → customer; followUp.leadId → lead
    'messageTemplate',                          // standalone — no FK
    'lead',                                     // FK → user, customer, salesOrder, companyBranch
    'leadItem',                                 // FK → lead, productVariant
    'leadImage',                                // FK → lead
    'leadActivity',                             // FK → lead, customer, user
    'followUp',                                 // FK → lead, customer, user, branch, messageTemplate
    // Penilaian CS — config dulu, lalu response (FK → customer, user, salesOrder, transaction, companyBranch)
    'csRatingConfig',
    'csRatingResponse',
    // Website — standalone (tanpa FK)
    'landingConfig',
    'article',
    // Delta-sync — standalone (branchId scalar, tanpa FK keras)
    'device',
    'syncedOp',
    'syncState',
    'syncPush',
    // WhatsApp CRM — setelah companyBranch, user, lead, customer (semua FK-nya).
    'waChannel',                                // FK → companyBranch (nullable)
    'waContact',                                // FK → lead, customer (nullable)
    'waConversation',                           // FK → waChannel, waContact, user
    'waTemplate',                               // standalone (createdById scalar, tanpa FK keras)
    'waBroadcast',                              // FK → waChannel, waTemplate. Sebelum waMessage (FK broadcastId).
    'waMessage',                                // FK → waChannel, waConversation, waContact, user, waBroadcast
    'waWebhookEvent',                           // standalone (audit log)
    'waBroadcastRecipient',                     // FK → waBroadcast, waContact
    'waAutoReplyRule',                          // standalone (channelId scalar, tanpa FK keras)
    'waReminderConfig',                         // standalone (channelId/templateId scalar)
    'waReminderLog',                            // standalone (audit + dedup)
];

// Path folder uploads gambar (3x up = backend root ketika dikompilasi ke dist/backup/)
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads');
// Path config WhatsApp bot
const WA_CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'whatsapp_bot_config.json');

@Injectable()
export class BackupService {
    constructor(private prisma: PrismaService) {}

    /** Slug nama toko untuk penamaan file backup. */
    async getStoreSlug(): Promise<string> {
        try {
            const s: any = await this.prisma.storeSettings.findFirst();
            return storeSlug(s?.storeName);
        } catch {
            return 'pospro';
        }
    }

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

        const hasWaConfig = fs.existsSync(WA_CONFIG_PATH);

        const backupJson = {
            meta: {
                version: '4.0', // v4.0: + branchMonthlyClosing & centralTreasuryEntry (grup Biaya Owner — konsolidasi tutup buku + kas pusat), + grup Penilaian CS: csRatingConfig & csRatingResponse. v3.9: + bonusTarget & bonusAdjustment (grup Biaya Owner). v3.8: + jerseyWorkOrder (grup Produksi), + grup Biaya Owner: fixedExpense (beban tetap) & marketingSpend (iklan). v3.7: + discordConfig (grup Master), + grup Website: landingConfig & article (landing builder Puck + blog). v3.6: ProductionJob isExpress/designEnteredAt/cancelledAt/cancelReason, LeadStatus INVALID, marketplaceFee, Lead.convertedTransactionId.
                createdAt: new Date().toISOString(),
                app: 'PosPro',
                tables: tablesToExport,
                groups: selectedGroups === 'all' ? Object.keys(BACKUP_GROUPS) : selectedGroups,
                rowCounts: counts,
                includesImages: includeImages,
                includesWaConfig: hasWaConfig,
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

            // Tambahkan konfigurasi WhatsApp bot jika ada
            if (hasWaConfig) {
                archive.file(WA_CONFIG_PATH, { name: 'whatsapp_bot_config.json' });
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
            hasWaConfig: false,
        };
    }

    // ── Preview Backup ZIP ───────────────────────────────────────────────────

    parseBackupZip(fileBuffer: Buffer): { meta: any; preview: { table: string; count: number }[]; imageCount: number; hasWaConfig: boolean } {
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

        const hasWaConfig = !!zip.getEntry('whatsapp_bot_config.json');

        return {
            meta: parsed.meta,
            preview: Object.entries(parsed.data as Record<string, any[]>).map(([table, rows]) => ({
                table,
                count: rows.length,
            })),
            imageCount: imageEntries.length,
            hasWaConfig,
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

        // ── Restore konfigurasi WhatsApp dari ZIP ─────────────────────────
        let waConfigRestored = false;
        if (zip) {
            const waConfigEntry = zip.getEntry('whatsapp_bot_config.json');
            if (waConfigEntry) {
                // Pada mode skip, jangan timpa config yang sudah ada
                if (mode === 'overwrite' || !fs.existsSync(WA_CONFIG_PATH)) {
                    try {
                        fs.writeFileSync(WA_CONFIG_PATH, waConfigEntry.getData());
                        waConfigRestored = true;
                    } catch {
                        // Gagal tulis config — tidak fatal
                    }
                }
            }
        }

        const totalRestored = Object.values(result).reduce((s, r) => s + r.success, 0);
        const totalSkipped = Object.values(result).reduce((s, r) => s + r.skipped, 0);
        const errors = Object.entries(result)
            .filter(([, r]) => r.error)
            .map(([t, r]) => `${t}: ${r.error}`);

        const parts = [`${totalRestored} baris data berhasil`, `${totalSkipped} dilewati`, `${imagesRestored} foto dipulihkan`];
        if (waConfigRestored) parts.push('konfigurasi WhatsApp dipulihkan');

        return {
            message: `Restore selesai. ${parts.join(', ')}.`,
            totalRestored,
            totalSkipped,
            imagesRestored,
            waConfigRestored,
            errors,
            detail: result,
        };
    }

    // Bersihkan fields relasi nested sebelum insert.
    // Data dari JSON.parse tidak mengandung Prisma-specific types (Date/Decimal objects),
    // hanya primitives, JSON objects, dan JSON arrays — semua harus dipertahankan.
    private cleanRow(row: any): any {
        const cleaned: any = {};
        for (const [key, val] of Object.entries(row)) {
            // Lewati nested Prisma relation objects (ditandai dengan field 'id' sendiri)
            // Dalam praktiknya ini tidak muncul karena kita pakai findMany() tanpa include,
            // tapi sebagai precaution tetap kita filter.
            if (
                val !== null &&
                typeof val === 'object' &&
                !Array.isArray(val) &&
                !(val instanceof Date) &&
                'id' in (val as any) &&
                ('createdAt' in (val as any) || 'updatedAt' in (val as any))
            ) {
                continue; // Nested Prisma model — lewati
            }
            // Lewati array of nested Prisma objects (relation lists)
            if (
                Array.isArray(val) &&
                val.length > 0 &&
                typeof val[0] === 'object' &&
                val[0] !== null &&
                'id' in val[0] &&
                ('createdAt' in val[0] || 'updatedAt' in val[0])
            ) {
                continue; // Nested relation array — lewati
            }
            // Pertahankan semua nilai lainnya termasuk JSON fields (objects/arrays biasa)
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

    // ── Write backup ZIP langsung ke file (untuk rclone) ───────────────────
    async writeBackupToFile(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const writeStream = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            this.streamBackupZip('all', writeStream, true).catch(reject);
        });
    }
}

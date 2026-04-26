/**
 * Multi-Branch Foundation Init Script (PR1)
 *
 * Jalankan SEKALI setelah `prisma db push` untuk schema PR1:
 *   npx ts-node backend/prisma/scripts/multi-branch-init.ts
 *
 * Yang dilakukan:
 * 1. Pastikan role OWNER & SUPERADMIN ada di tabel Role.
 * 2. Auto-create `CompanyBranch { name: 'Pusat', code: 'PST' }` kalau belum ada.
 *    (Catatan: kita TIDAK hard-code id=1 — pakai id hasil insert.)
 * 3. Backfill `User.branchId = pusat.id` untuk semua user non-owner yang branchId-nya masih null.
 * 4. Migrate `StoreSettings.operatorPin` + `whatsapp_bot_config.json`
 *    ke `BranchSettings(branchId = pusat.id)` kalau belum ada.
 *
 * Aman dijalankan berulang (idempotent).
 *
 * PR2+ akan menambahkan backfill untuk Transaction/Cashflow/Stock/dll.
 * PR1 hanya tagging foundation — belum ada filtering aktif.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const OWNER_ROLE_NAMES = ['OWNER', 'SUPERADMIN'];

async function ensureRoles() {
    console.log('[1/4] Pastikan role OWNER & SUPERADMIN ada...');
    for (const name of OWNER_ROLE_NAMES) {
        const existing = await prisma.role.findFirst({ where: { name } });
        if (!existing) {
            await prisma.role.create({ data: { name } });
            console.log(`       + Role "${name}" dibuat.`);
        } else {
            console.log(`       = Role "${name}" sudah ada (id=${existing.id}).`);
        }
    }
}

async function ensurePusat(): Promise<{ id: number; name: string }> {
    console.log('[2/4] Pastikan CompanyBranch "Pusat" ada...');
    let pusat = await prisma.companyBranch.findFirst({
        where: {
            OR: [{ code: 'PST' }, { name: 'Pusat' }],
        },
    });
    if (!pusat) {
        pusat = await prisma.companyBranch.create({
            data: {
                name: 'Pusat',
                code: 'PST',
                isActive: true,
            },
        });
        console.log(`       + Cabang "Pusat" dibuat (id=${pusat.id}).`);
    } else {
        // Pastikan code terisi
        if (!pusat.code) {
            pusat = await prisma.companyBranch.update({
                where: { id: pusat.id },
                data: { code: 'PST' },
            });
            console.log(`       ~ Cabang "Pusat" diupdate dengan code=PST.`);
        }
        console.log(`       = Cabang "Pusat" sudah ada (id=${pusat.id}).`);
    }
    return { id: pusat.id, name: pusat.name };
}

async function backfillUserBranch(pusatId: number) {
    console.log('[3/4] Backfill User.branchId untuk staff...');
    const ownerRoles = await prisma.role.findMany({
        where: { name: { in: OWNER_ROLE_NAMES } },
        select: { id: true, name: true },
    });
    const ownerRoleIds = ownerRoles.map((r) => r.id);

    const staffUsers = await prisma.user.findMany({
        where: {
            branchId: null,
            roleId: { notIn: ownerRoleIds.length ? ownerRoleIds : [-1] },
        },
        select: { id: true, email: true },
    });

    if (staffUsers.length === 0) {
        console.log('       = Tidak ada user staff yang perlu di-backfill.');
        return;
    }

    const res = await prisma.user.updateMany({
        where: {
            id: { in: staffUsers.map((u) => u.id) },
        },
        data: { branchId: pusatId },
    });
    console.log(`       + ${res.count} user staff di-assign ke cabang Pusat.`);

    // Owner/SuperAdmin: biarkan branchId null (akses semua cabang)
    const ownerUsers = await prisma.user.count({
        where: { roleId: { in: ownerRoleIds.length ? ownerRoleIds : [-1] } },
    });
    console.log(
        `       = ${ownerUsers} user Owner/SuperAdmin dibiarkan branchId=null (akses semua cabang).`,
    );
}

async function migrateSettingsToBranch(pusatId: number) {
    console.log('[4/4] Migrate StoreSettings & WA config → BranchSettings(Pusat)...');

    const existing = await (prisma as any).branchSettings.findUnique({
        where: { branchId: pusatId },
    });
    if (existing) {
        console.log(
            `       = BranchSettings untuk Pusat sudah ada (id=${existing.id}), skip.`,
        );
        return;
    }

    const store = await prisma.storeSettings.findFirst();

    // Read WA config JSON
    let waReportGroupId: string | null = null;
    let waBroadcastGroups: string[] = [];
    let waDesignGroupId: string | null = null;

    const waConfigPath = path.join(process.cwd(), 'whatsapp_bot_config.json');
    if (fs.existsSync(waConfigPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(waConfigPath, 'utf-8'));
            waReportGroupId = raw.reportGroupId ?? null;
            waBroadcastGroups = Array.isArray(raw.broadcastGroupIds)
                ? raw.broadcastGroupIds
                : [];
            waDesignGroupId = raw.designGroupId ?? null;
            console.log('       ~ WA config dibaca dari whatsapp_bot_config.json.');
        } catch (e) {
            console.warn('       ! Gagal parse whatsapp_bot_config.json:', e);
        }
    } else {
        console.log('       = whatsapp_bot_config.json tidak ditemukan, skip WA migrate.');
    }

    await (prisma as any).branchSettings.create({
        data: {
            branchId: pusatId,
            operatorPin: store?.operatorPin ?? null,
            waReportGroupId,
            waBroadcastGroups: waBroadcastGroups.length ? waBroadcastGroups : undefined,
            waDesignGroupId,
            storeName: store?.storeName ?? null,
            storeAddress: store?.storeAddress ?? null,
            storePhone: store?.storePhone ?? null,
            logoUrl: store?.logoImageUrl ?? null,
        },
    });
    console.log(`       + BranchSettings untuk Pusat (id=${pusatId}) dibuat.`);
}

async function backfillOperationalBranchId(pusatId: number) {
    console.log('[5/8] Backfill branchId di tabel operasional → Pusat...');

    const targets: Array<{ name: string; model: string }> = [
        { name: 'Transaction', model: 'transaction' },
        { name: 'StockMovement', model: 'stockMovement' },
        { name: 'Batch', model: 'batch' },
        { name: 'StockPurchase', model: 'stockPurchase' },
        { name: 'StockOpnameSession', model: 'stockOpnameSession' },
        { name: 'ProductionJob', model: 'productionJob' },
        { name: 'PrintJob', model: 'printJob' },
    ];

    for (const t of targets) {
        try {
            const res = await (prisma as any)[t.model].updateMany({
                where: { branchId: null },
                data: { branchId: pusatId },
            });
            console.log(`       + ${t.name}: ${res.count} row di-tag ke Pusat.`);
        } catch (e: any) {
            console.warn(`       ! ${t.name}: gagal — ${e.message}`);
        }
    }
}

async function seedBranchStocks(pusatId: number) {
    console.log('[6/8] Seed BranchStock untuk cabang Pusat dari ProductVariant.stock...');
    const variants = await prisma.productVariant.findMany({
        select: { id: true, stock: true },
    });
    let inserted = 0;
    let skipped = 0;
    for (const v of variants) {
        const existing = await (prisma as any).branchStock.findUnique({
            where: {
                branchId_productVariantId: {
                    branchId: pusatId,
                    productVariantId: v.id,
                },
            },
        });
        if (existing) {
            skipped++;
            continue;
        }
        await (prisma as any).branchStock.create({
            data: {
                branchId: pusatId,
                productVariantId: v.id,
                stock: v.stock ?? 0,
            },
        });
        inserted++;
    }
    console.log(`       + ${inserted} BranchStock baru dibuat, ${skipped} sudah ada (skip).`);
}

async function ensureBranchStocksForAllBranches() {
    console.log('[7/8] Pastikan setiap cabang aktif punya row BranchStock untuk semua variant...');
    const branches = await (prisma as any).companyBranch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });
    const variants = await prisma.productVariant.findMany({ select: { id: true } });
    let totalInserted = 0;
    for (const b of branches) {
        for (const v of variants) {
            try {
                await (prisma as any).branchStock.upsert({
                    where: {
                        branchId_productVariantId: {
                            branchId: b.id,
                            productVariantId: v.id,
                        },
                    },
                    update: {}, // jangan reset stok kalau sudah ada
                    create: {
                        branchId: b.id,
                        productVariantId: v.id,
                        stock: 0,
                    },
                });
                totalInserted++;
            } catch {
                // ignore unique conflicts
            }
        }
        console.log(`       = Cabang "${b.name}" disinkron.`);
    }
    console.log(`       + Total upsert: ${totalInserted}.`);
}

async function main() {
    console.log('=== Multi-Branch Init (PR1+PR2) ===\n');
    await ensureRoles();
    const pusat = await ensurePusat();
    await backfillUserBranch(pusat.id);
    await migrateSettingsToBranch(pusat.id);
    await backfillOperationalBranchId(pusat.id);
    await seedBranchStocks(pusat.id);
    await ensureBranchStocksForAllBranches();
    console.log('\n[8/8] Selesai. Cabang Pusat id =', pusat.id);
    console.log('Next: restart backend, deploy frontend, jalankan smoke test.');
}

main()
    .catch((err) => {
        console.error('FATAL:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

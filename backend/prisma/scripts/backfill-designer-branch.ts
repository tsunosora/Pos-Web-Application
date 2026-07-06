/**
 * Backfill: isi Designer.branchId dari Designer.branchName (teks) untuk data lama.
 * Dipakai fitur leaderboard omzet-split (atribusi bagian desainer ke cabang home).
 *
 * Desainer tanpa branchName (= Pusat) dibiarkan branchId null. Matching:
 *   exact name → exact code → partial contains (dua arah), case-insensitive.
 *
 * Run sekali (SETELAH `npx prisma db push` + `npx prisma generate`):
 *   cd backend && npx ts-node prisma/scripts/backfill-designer-branch.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function matchBranchId(
    branchName: string | null | undefined,
    branches: { id: number; name: string | null; code: string | null }[],
): number | null {
    const q = (branchName ?? '').toLowerCase().trim();
    if (!q) return null;
    const hit =
        branches.find(b => (b.name ?? '').toLowerCase().trim() === q) ||
        branches.find(b => (b.code ?? '').toLowerCase().trim() === q) ||
        branches.find(b => {
            const n = (b.name ?? '').toLowerCase().trim();
            return n && (n.includes(q) || q.includes(n));
        });
    return hit?.id ?? null;
}

async function main() {
    const branches: any[] = await (prisma as any).companyBranch.findMany({
        where: { isActive: true }, select: { id: true, name: true, code: true },
    });
    const designers: any[] = await (prisma as any).designer.findMany({
        select: { id: true, name: true, branchName: true, branchId: true },
    });
    console.log(`Found ${designers.length} designer(s), ${branches.length} active branch(es).`);

    let updated = 0, pusat = 0, unmatched = 0, already = 0;
    for (const d of designers) {
        if (d.branchId != null) { already++; continue; }
        if (!d.branchName?.trim()) { pusat++; continue; } // Pusat → biarkan null
        const bid = matchBranchId(d.branchName, branches);
        if (bid == null) {
            console.log(`  ? Designer #${d.id} "${d.name}" — branchName "${d.branchName}" tak cocok cabang mana pun, dilewati`);
            unmatched++;
            continue;
        }
        await (prisma as any).designer.update({ where: { id: d.id }, data: { branchId: bid } });
        console.log(`  ✓ Designer #${d.id} "${d.name}" → branchId ${bid} (dari "${d.branchName}")`);
        updated++;
    }

    console.log(`\nDone. Updated ${updated}, sudah terisi ${already}, Pusat/null ${pusat}, tak cocok ${unmatched}.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

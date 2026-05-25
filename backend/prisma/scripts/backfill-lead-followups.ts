/**
 * Backfill: bikin FollowUp task untuk Lead yang sudah punya followUpDate
 * tapi belum punya pending FollowUp type=LEAD_FU.
 *
 * Run sekali:
 *   cd backend && npx ts-node prisma/scripts/backfill-lead-followups.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Cari semua lead yang punya followUpDate & status != CLOSED
    const leads: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, name, follow_up_date AS followUpDate, assigned_to_id AS assignedToId,
               branch_id AS branchId, status
        FROM leads
        WHERE follow_up_date IS NOT NULL
          AND status NOT IN ('CLOSED_WON', 'CLOSED_LOST')
    `);
    console.log(`Found ${leads.length} active lead(s) with followUpDate`);

    let created = 0;
    let skipped = 0;

    for (const lead of leads) {
        // Cek pending FU sudah ada?
        const existing: any[] = await prisma.$queryRawUnsafe(
            `SELECT id FROM follow_ups WHERE lead_id = ? AND type = 'LEAD_FU' AND status = 'PENDING' LIMIT 1`,
            lead.id,
        );
        if (existing.length > 0) {
            console.log(`  Lead #${lead.id} "${lead.name}" — already has pending FU, skip`);
            skipped++;
            continue;
        }

        await prisma.$executeRawUnsafe(
            `INSERT INTO follow_ups
                (type, status, due_date, lead_id, assigned_to_id, branch_id, notes, source_ref, created_at, updated_at)
             VALUES ('LEAD_FU', 'PENDING', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            lead.followUpDate,
            lead.id,
            lead.assignedToId,
            lead.branchId,
            `Backfilled dari Lead "${lead.name}" (followUpDate existing)`,
            `lead-fudate:${lead.id}`,
        );
        console.log(`  ✓ Lead #${lead.id} "${lead.name}" → FU created (due ${new Date(lead.followUpDate).toLocaleDateString('id-ID')})`);
        created++;
    }

    console.log(`\nDone. Created ${created} FollowUp record(s), skipped ${skipped}.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

/**
 * Backfill atribusi iklan Meta (Click-to-WhatsApp) ke Lead lama.
 *
 * Data `referral` dari klik iklan SUDAH tersimpan di WaMessage.payloadJson sejak
 * lama — hanya belum diekstrak ke kolom Lead. Script ini memindai pesan masuk
 * yang punya `referral`, lalu mengisi Lead terkait (adId/ctwaClid/adReferral +
 * source FACEBOOK/INSTAGRAM). ADITIF & non-destruktif:
 *   - hanya lead yang BELUM ditandai iklan (adId IS NULL) yang disentuh
 *   - source hanya ditimpa bila masih generik WHATSAPP (sumber spesifik dihormati)
 *
 * Aman diulang (idempoten). Jalankan sekali di server:
 *   cd backend && npx ts-node prisma/scripts/backfill-ad-referral.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pickReferral(payload: any): any | null {
    const raw = typeof payload === 'string' ? safeParse(payload) : payload;
    const ref = raw?.referral;
    if (ref && (ref.source_id || ref.ctwa_clid || ref.source_url)) return ref;
    return null;
}

function safeParse(s: string): any {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

async function main() {
    // Kandidat: pesan masuk yang punya objek referral, kontaknya tertaut lead.
    const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT m.id AS messageId, m.created_at AS createdAt, c.lead_id AS leadId, m.payload_json AS payloadJson
        FROM wa_messages m
        JOIN wa_contacts c ON c.id = m.contact_id
        WHERE m.direction = 'INBOUND'
          AND c.lead_id IS NOT NULL
          AND JSON_EXTRACT(m.payload_json, '$.referral') IS NOT NULL
        ORDER BY m.created_at ASC
    `);
    console.log(`Found ${rows.length} inbound message(s) with a referral payload.`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
        const ref = pickReferral(row.payloadJson);
        if (!ref) {
            skipped++;
            continue;
        }
        const lead = await prisma.lead.findUnique({
            where: { id: row.leadId },
            select: { id: true, name: true, source: true, adId: true },
        });
        if (!lead) {
            skipped++;
            continue;
        }
        // Sudah ditandai iklan → jangan timpa (idempoten, hormati atribusi pertama).
        if (lead.adId) {
            skipped++;
            continue;
        }

        const canOverride = lead.source === 'WHATSAPP' || lead.source == null;
        const url: string = String(ref.source_url || '').toLowerCase();
        const platform = url.includes('instagram') || url.includes('ig.me') ? 'INSTAGRAM' : 'FACEBOOK';
        const headline: string | null = ref.headline ? String(ref.headline).slice(0, 150) : null;
        const adId: string | null = ref.source_id ? String(ref.source_id).slice(0, 64) : null;
        const ctwaClid: string | null = ref.ctwa_clid ? String(ref.ctwa_clid).slice(0, 512) : null;

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                ...(canOverride ? { source: platform as any } : {}),
                ...(canOverride && headline ? { sourceDetail: headline } : {}),
                adId,
                ctwaClid,
                adReferral: ref,
            },
        });
        await prisma.leadActivity.create({
            data: {
                leadId: lead.id,
                kind: 'MESSAGE',
                text: `[Backfill] Terdeteksi dari Iklan Meta${headline ? `: "${headline}"` : ''}${adId ? ` (ad ${adId})` : ''}`,
                meta: { source: 'meta-ads-backfill', adId, ctwaClid, sourceType: ref.source_type ?? null },
            },
        });
        console.log(`  ✓ Lead #${lead.id} "${lead.name}" → iklan ${platform}${adId ? ` (ad ${adId})` : ''}`);
        updated++;
    }

    console.log(`\nDone. Ditandai ${updated} lead dari iklan, dilewati ${skipped}.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

/**
 * Kompresi sekali-jalan untuk gambar LAMA yang sudah terlanjur tersimpan di
 * folder upload (upload baru sudah otomatis terkompresi di endpoint-nya).
 *
 * - Scan rekursif: public/uploads/ dan uploads/
 * - Resize maks 1600px + re-encode kualitas ~80 (logika sama dengan
 *   compress-image.util yang dipakai endpoint upload)
 * - In-place, nama file tetap — tidak ada perubahan database
 * - Aman diulang (idempoten): file yang sudah kecil/optimal dilewati karena
 *   hasil kompresi hanya dipakai bila lebih kecil dari aslinya
 *
 * Run sekali:
 *   cd backend && npx ts-node prisma/scripts/compress-existing-images.ts
 * Lihat dulu tanpa mengubah apa pun:
 *   cd backend && npx ts-node prisma/scripts/compress-existing-images.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import { compressImage } from '../../src/common/utils/compress-image.util';

const ROOTS = ['public/uploads', 'uploads'];
const COMPRESSIBLE = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp']);
const MIN_SIZE = 30 * 1024;   // < 30KB → lewati, tidak sebanding waktu prosesnya
const CONCURRENCY = 4;        // batasi supaya CPU/RAM server tidak tersedot

const dryRun = process.argv.includes('--dry-run');

function walk(dir: string, out: string[] = []): string[] {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (e.isFile()) out.push(full);
    }
    return out;
}

const fmtMB = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB';

async function main() {
    const files: { path: string; size: number }[] = [];
    for (const root of ROOTS) {
        const abs = path.join(process.cwd(), root);
        for (const f of walk(abs)) {
            const ext = path.extname(f).toLowerCase();
            if (!COMPRESSIBLE.has(ext)) continue;
            if (f.endsWith('.tmp')) continue;
            const size = fs.statSync(f).size;
            if (size < MIN_SIZE) continue;
            files.push({ path: f, size });
        }
    }

    const totalBefore = files.reduce((s, f) => s + f.size, 0);
    console.log(`Target: ${files.length} gambar (${fmtMB(totalBefore)}) di ${ROOTS.join(', ')}`);
    if (dryRun) {
        console.log('--dry-run: tidak ada file yang diubah.');
        return;
    }
    if (files.length === 0) return;

    let done = 0, saved = 0, untouched = 0;
    // Proses berkelompok dengan batas konkurensi
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (f) => {
            await compressImage(f.path); // best-effort, tidak pernah throw
            const after = fs.statSync(f.path).size;
            if (after < f.size) saved += f.size - after;
            else untouched++;
            done++;
        }));
        if (done % 100 < CONCURRENCY) {
            console.log(`  ${done}/${files.length} diproses... hemat sejauh ini ${fmtMB(saved)}`);
        }
    }

    const totalAfter = totalBefore - saved;
    console.log('\nSelesai ✅');
    console.log(`  Diproses        : ${done} gambar`);
    console.log(`  Sudah optimal   : ${untouched} gambar (tidak diubah)`);
    console.log(`  Ukuran sebelum  : ${fmtMB(totalBefore)}`);
    console.log(`  Ukuran sesudah  : ${fmtMB(totalAfter)}`);
    console.log(`  Hemat           : ${fmtMB(saved)} (${totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : 0}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

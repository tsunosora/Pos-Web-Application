/**
 * Pengaman global: tolak body permintaan yang berbentuk "tulisan relasi bersarang" Prisma
 * (`{ branch: { update: { users: { update: { … role: { connect … } } } } } }`).
 *
 * ValidationPipe global sengaja tanpa whitelist (lihat main.ts), jadi kunci asing di body ikut
 * sampai ke service. Beberapa service dulu meneruskan body utuh ke `prisma.x.update({ data })`
 * (mis. /batches, /units, /products) → akun login mana pun bisa menjadikan dirinya Owner,
 * mengganti sandi rekan, atau mengarsipkan semua produk. Perbaikan per service tetap dilakukan;
 * ini lapis kedua untuk service yang belum tersaring.
 *
 * Klien sah (frontend, website toko, aplikasi desktop) tidak pernah mengirim kunci operator Prisma
 * dengan isi objek/array. Webhook pihak luar (Meta, GitHub) dikecualikan karena bentuknya milik
 * pengirim dan tidak pernah diteruskan ke Prisma sebagai `data`.
 */
const OPERATOR_PRISMA = new Set([
    'connect', 'connectOrCreate', 'create', 'createMany', 'update', 'updateMany',
    'upsert', 'delete', 'deleteMany', 'set', 'disconnect',
]);

const JALUR_DIKECUALIKAN = [/^\/whatsapp\/webhook/, /^\/social\/webhook/, /^\/social\/data-deletion/, /^\/webhook\//];

/** Kunci operator Prisma pertama (berisi objek/array) di dalam nilai, atau null. */
export function cariOperatorPrisma(v: unknown, kedalaman = 0): string | null {
    if (v == null || typeof v !== 'object' || kedalaman > 32) return null;
    if (Array.isArray(v)) {
        for (const x of v) {
            const k = cariOperatorPrisma(x, kedalaman + 1);
            if (k) return k;
        }
        return null;
    }
    for (const [k, isi] of Object.entries(v as Record<string, unknown>)) {
        if (OPERATOR_PRISMA.has(k) && isi !== null && typeof isi === 'object') return k;
        const dalam = cariOperatorPrisma(isi, kedalaman + 1);
        if (dalam) return dalam;
    }
    return null;
}

export function tolakTulisanBersarang(req: any, res: any, next: any) {
    const metode = String(req.method || '').toUpperCase();
    if (metode === 'GET' || metode === 'HEAD' || metode === 'OPTIONS') return next();
    const jalur = String(req.path || req.url || '');
    if (JALUR_DIKECUALIKAN.some((re) => re.test(jalur))) return next();
    const kunci = cariOperatorPrisma(req.body);
    if (!kunci) return next();
    // eslint-disable-next-line no-console
    console.warn(`[SECURITY] body berisi operator Prisma "${kunci}" ditolak: ${metode} ${jalur} ip=${req.ip}`);
    res.status(400).json({ statusCode: 400, message: 'Format permintaan tidak dikenal.', error: 'Bad Request' });
}

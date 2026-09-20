/**
 * Membuat berkas seed untuk PENGEMBANGAN LOKAL dari database produksi.
 *
 *   npx ts-node prisma/scripts/dump-dev-seed.ts [folder-tujuan]
 *
 * Hasilnya satu berkas .sql.gz berisi:
 *   - struktur SELURUH tabel (kosong), sehingga aplikasi bisa jalan penuh;
 *   - data MASTER apa adanya (katalog, harga jual, satuan, kategori, cabang);
 *   - data SAMAR untuk tabel yang memuat orang atau rahasia (nama & nomor
 *     diganti nilai buatan, PIN/token dibuang).
 *
 * Aturan keamanannya DEFAULT-TOLAK di dua lapis:
 *   1. Tabel yang tidak terdaftar di MASTER/SAMAR ikut strukturnya saja —
 *      jadi tabel baru (transaksi, chat, HPP) tidak pernah bocor by default.
 *   2. Di tabel SAMAR, kolom teks yang tidak punya aturan eksplisit di
 *      SAMAR[tabel] dijadikan NULL — jadi kolom baru pun tidak ikut terbawa.
 *
 * Yang SENGAJA tidak ikut: seluruh transaksi, nota, SO, pekerjaan produksi &
 * cetak, stok, kas, chat WhatsApp, lead, HPP, rekening bank, dan token API.
 * Data itu tidak dibutuhkan untuk mengembangkan fitur, dan tidak boleh ada di
 * laptop siapa pun.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const SANDI_DEV = 'dev12345'; // sandi seragam untuk semua akun di seed

/**
 * Tabel yang datanya aman dibawa apa adanya: katalog & harga JUAL (yang memang
 * dilihat pelanggan), kategori, satuan, cabang, dan daftar tugas piket.
 *
 * Yang sengaja TIDAK di sini walau terlihat seperti master:
 *   - fixed_expenses  → ternyata daftar gaji karyawan beserta nominalnya
 *   - ingredients, variant_ingredients, supplier_items → harga beli/bahan = HPP
 *   - wa_*, message_templates, landing_config → naskah promosi + nomor & email toko
 *   - printer_devices, ad_labels → identitas perangkat & kampanye milik klien
 */
const MASTER = [
    'roles', 'branches', 'company_branches',
    'categories', 'units', 'products', 'product_variants', 'variant_price_tiers',
    'click_rates', 'production_categories', 'custom_product_metrics',
    'task_groups', 'task_schedules', 'bonus_targets', 'competitors',
];

/**
 * Tabel yang datanya ikut TAPI disamarkan. Nilai aturan:
 *   - fungsi  → hasilnya dipakai sebagai nilai kolom
 *   - 'apaAdanya' → salin dari produksi (hanya untuk teks yang jelas aman)
 * Kolom teks tanpa aturan → NULL (atau '' bila NOT NULL).
 */
type Aturan = 'apaAdanya' | ((baris: Record<string, any>) => string | null);
const SAMAR: Record<string, Record<string, Aturan>> = {
    users: {
        name: (r) => `Pengguna ${r.id}`,
        email: (r) => `pengguna${r.id}@contoh.test`,
        phone: (r) => `08110${String(r.id).padStart(6, '0')}`,
        password_hash: () => HASH_DEV,
    },
    designers: {
        name: (r) => `Desainer ${r.id}`,
        pin: (r) => String(1000 + Number(r.id)),
        branch_name: 'apaAdanya', // nama cabang, bukan nama orang
    },
    customers: {
        name: (r) => `Pelanggan ${r.id}`,
        phone: (r) => `08120${String(r.id).padStart(6, '0')}`,
    },
    suppliers: {
        name: (r) => `Supplier ${r.id}`,
        phone: (r) => `08130${String(r.id).padStart(6, '0')}`,
    },
    store_settings: {
        store_name: () => 'Toko Contoh',
        operator_pin: () => '1234',
        marketing_pin: () => '1234',
        receipt_default_format: 'apaAdanya',
        shift_reminder_time: 'apaAdanya',
        shift_reminder_time_2: 'apaAdanya',
        theme_mode: 'apaAdanya',
        theme_primary_color: 'apaAdanya',
        theme_secondary_color: 'apaAdanya',
        theme_gradient_direction: 'apaAdanya',
    },
    branch_settings: {
        store_name: (r) => `Cabang ${r.branch_id}`,
        operator_pin: () => '1234',
    },
};

let HASH_DEV = '';

const TIPE_ANGKA = new Set(['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal', 'float', 'double', 'bit', 'year']);
const TIPE_WAKTU = new Set(['datetime', 'timestamp', 'date', 'time']);
const TIPE_TEKS_AMAN = new Set(['enum', 'set']); // himpunan nilai tetap, bukan teks bebas

const kutip = (v: string) =>
    `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '')}'`;

const waktu = (d: Date) => {
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

/** Baca DATABASE_URL dari backend/.env tanpa pernah menampilkannya. */
function bacaKoneksi(): { host: string; port: string; user: string; pass: string; db: string } {
    const berkas = path.resolve(__dirname, '../../.env');
    const isi = fs.existsSync(berkas) ? fs.readFileSync(berkas, 'utf8') : '';
    const url = process.env.DATABASE_URL
        ?? isi.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
    if (!url) throw new Error('DATABASE_URL tidak ditemukan di environment maupun backend/.env');
    const u = new URL(url);
    return {
        host: u.hostname || '127.0.0.1',
        port: u.port || '3306',
        user: decodeURIComponent(u.username),
        pass: decodeURIComponent(u.password),
        db: u.pathname.replace(/^\//, ''),
    };
}

/** Nama database harus mendahului daftar tabel — itu tata cara mysqldump. */
function mysqldump(k: ReturnType<typeof bacaKoneksi>, opsi: string[], tabel: string[] = []): string {
    try {
        return execFileSync('mysqldump', [
            `--host=${k.host}`, `--port=${k.port}`, `--user=${k.user}`,
            '--skip-comments', '--skip-set-charset', '--no-tablespaces',
            '--skip-add-locks', '--skip-lock-tables', '--single-transaction',
            ...opsi, k.db, ...tabel,
        ], {
            env: { ...process.env, MYSQL_PWD: k.pass },
            maxBuffer: 512 * 1024 * 1024,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (e: any) {
        // Buang peringatan rutin soal MYSQL_PWD supaya sebab aslinya terbaca.
        const sebab = String(e.stderr || e.message)
            .split('\n').filter((l) => l && !/insecure|password on the command line/i.test(l)).join(' ');
        throw new Error(`mysqldump gagal: ${sebab}`);
    }
}

async function main() {
    const tujuan = process.argv[2] || path.resolve(__dirname, '../../backups');
    const k = bacaKoneksi();
    const prisma = new PrismaClient();
    HASH_DEV = await bcrypt.hash(SANDI_DEV, 10);

    const semua: string[] = (
        await prisma.$queryRawUnsafe<{ t: string }[]>(
            "SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
        )
    ).map((r) => r.t);

    // Penjagaan: nama di daftar yang tidak ada lagi di database = salah tulis.
    const hilang = [...MASTER, ...Object.keys(SAMAR)].filter((t) => !semua.includes(t));
    if (hilang.length) throw new Error(`Tabel di daftar tapi tidak ada di database: ${hilang.join(', ')}`);
    const tumpang = MASTER.filter((t) => t in SAMAR);
    if (tumpang.length) throw new Error(`Tabel ada di MASTER dan SAMAR sekaligus: ${tumpang.join(', ')}`);

    const bagian: string[] = [
        '-- Seed pengembangan PosPro — TANPA data transaksi & TANPA data pribadi.',
        `-- Dibuat ${new Date().toISOString()} oleh prisma/scripts/dump-dev-seed.ts`,
        `-- Semua akun memakai sandi: ${SANDI_DEV}`,
        'SET FOREIGN_KEY_CHECKS = 0;',
        'SET NAMES utf8mb4;',
        '',
        '-- ==== STRUKTUR SELURUH TABEL ====',
        mysqldump(k, ['--no-data']),
        '',
        '-- ==== DATA MASTER ====',
        mysqldump(k, ['--no-create-info', '--complete-insert'], MASTER),
        '',
        '-- ==== DATA SAMAR ====',
    ];

    const ringkas: string[] = [];
    for (const tabel of Object.keys(SAMAR)) {
        const kolom = await prisma.$queryRawUnsafe<{ n: string; d: string; nul: string }[]>(
            'SELECT COLUMN_NAME n, DATA_TYPE d, IS_NULLABLE nul FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
            tabel,
        );
        const baris = await prisma.$queryRawUnsafe<Record<string, any>[]>(`SELECT * FROM \`${tabel}\``);
        const aturan = SAMAR[tabel];
        const dipakai = new Set<string>();

        const nilai = (r: Record<string, any>, c: { n: string; d: string; nul: string }): string => {
            const v = r[c.n];
            const a = aturan[c.n];
            if (typeof a === 'function') { dipakai.add(c.n); const h = a(r); return h === null ? 'NULL' : kutip(h); }
            if (v === null || v === undefined) return 'NULL';
            if (TIPE_ANGKA.has(c.d)) return typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
            if (TIPE_WAKTU.has(c.d)) return kutip(v instanceof Date ? waktu(v) : String(v));
            if (TIPE_TEKS_AMAN.has(c.d) || a === 'apaAdanya') { if (a === 'apaAdanya') dipakai.add(c.n); return kutip(String(v)); }
            return c.nul === 'YES' ? 'NULL' : "''"; // teks bebas tanpa aturan → dibuang
        };

        if (baris.length) {
            const namaKolom = kolom.map((c) => `\`${c.n}\``).join(', ');
            bagian.push(`-- ${tabel}: ${baris.length} baris, kolom teks tanpa aturan dikosongkan`);
            for (const r of baris) {
                bagian.push(`INSERT INTO \`${tabel}\` (${namaKolom}) VALUES (${kolom.map((c) => nilai(r, c)).join(', ')});`);
            }
        }
        const tanpaAturan = kolom
            .filter((c) => !TIPE_ANGKA.has(c.d) && !TIPE_WAKTU.has(c.d) && !TIPE_TEKS_AMAN.has(c.d) && !(c.n in aturan))
            .map((c) => c.n);
        ringkas.push(`  ${tabel}: ${baris.length} baris disamarkan` + (tanpaAturan.length ? ` · dikosongkan: ${tanpaAturan.join(', ')}` : ''));
        const takTerpakai = Object.keys(aturan).filter((c) => !dipakai.has(c) && baris.length > 0);
        if (takTerpakai.length) ringkas.push(`    (aturan tak terpakai — kolom hilang? ${takTerpakai.join(', ')})`);
    }

    bagian.push('', 'SET FOREIGN_KEY_CHECKS = 1;', '');
    let sql = bagian.join('\n');

    /*
     * Penjaga nama orang. Nama staf kerap menyelip di teks master — produk
     * custom atas nama seseorang, catatan biaya, judul tugas — dan daftar
     * MASTER tidak bisa menangkap itu. Jadi hasil akhirnya disapu sekali lagi:
     *   - nama staf  → disensor otomatis (jumlahnya sedikit, risikonya jelas)
     *   - nama pelanggan → hanya dilaporkan jumlahnya, tidak disensor, karena
     *     banyak yang berupa kata umum sehingga penyensoran merusak katalog.
     * Nama pelanggan juga tidak pernah dicetak ke layar.
     */
    const pola = (n: string[]) =>
        n.map((x) => x.trim()).filter((x) => x.length >= 4)
            .sort((a, b) => b.length - a.length)
            .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const staf = pola([
        ...(await prisma.user.findMany({ select: { name: true } })).map((u) => u.name),
        ...(await prisma.designer.findMany({ select: { name: true } })).map((d) => d.name),
    ].filter((n): n is string => !!n)
        .flatMap((n) => [n, ...n.split(/\s+/)])); // nama lengkap sekaligus tiap suku katanya

    let disensor = 0;
    if (staf.length) {
        sql = sql.replace(new RegExp(`\\b(?:${[...new Set(staf)].join('|')})\\b`, 'gi'), () => { disensor++; return '***'; });
    }

    const pelanggan = pola(
        (await prisma.customer.findMany({ select: { name: true } })).map((c) => c.name).filter((n): n is string => !!n),
    );
    let sisaPelanggan = 0;
    if (pelanggan.length) {
        sisaPelanggan = (sql.match(new RegExp(`\\b(?:${[...new Set(pelanggan)].join('|')})\\b`, 'gi')) || []).length;
    }

    fs.mkdirSync(tujuan, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const keluar = path.join(tujuan, `pospro-dev-seed-${stamp}.sql.gz`);
    fs.writeFileSync(keluar, zlib.gzipSync(Buffer.from(sql, 'utf8'), { level: 9 }));

    const kosong = semua.filter((t) => !MASTER.includes(t) && !(t in SAMAR));
    console.log('Seed pengembangan dibuat.');
    console.log(`  berkas      : ${keluar} (${(fs.statSync(keluar).size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  struktur    : ${semua.length} tabel`);
    console.log(`  data master : ${MASTER.length} tabel`);
    console.log(`  disamarkan  : ${Object.keys(SAMAR).length} tabel`);
    console.log(ringkas.join('\n'));
    console.log(`  kosong      : ${kosong.length} tabel (transaksi, chat, HPP, gaji, token — sengaja tidak dibawa)`);
    console.log(`  nama staf disensor: ${disensor} kemunculan`);
    console.log(`  kemiripan nama pelanggan: ${sisaPelanggan} (dibiarkan — umumnya kata umum di nama produk)`);
    console.log(`  sandi semua akun: ${SANDI_DEV}`);
    await prisma.$disconnect();
}

main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });

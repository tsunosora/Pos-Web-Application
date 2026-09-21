#!/usr/bin/env node
/**
 * Membangkitkan halaman REFERENSI wiki langsung dari kode, supaya dokumentasi
 * yang paling rinci tidak pernah usang:
 *
 *   node tools/gen-wiki-referensi.cjs
 *
 * Keluaran (ditulis ulang setiap dijalankan):
 *   docs/wiki/referensi-endpoint.md    — seluruh endpoint API + penjaga aksesnya
 *   docs/wiki/referensi-basis-data.md  — seluruh tabel & kolom beserta komentarnya
 *   docs/wiki/referensi-halaman.md     — seluruh halaman frontend + menu induknya
 *   docs/wiki/referensi-env-cron.md    — variabel lingkungan & pekerjaan terjadwal
 *
 * Ditulis tanpa dependensi supaya bisa dijalankan di mana saja, termasuk di
 * laptop yang baru meng-clone repo.
 */
const fs = require('node:fs');
const path = require('node:path');

const AKAR = path.resolve(__dirname, '..');
const WIKI = path.join(AKAR, 'docs', 'wiki');
const STEMPEL = `> Dibangkitkan otomatis oleh \`tools/gen-wiki-referensi.js\` — jangan disunting tangan.\n> Jalankan ulang skripnya setelah menambah fitur.\n`;

const jelajah = (dir, cocok, hasil = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) jelajah(p, cocok, hasil);
        else if (cocok(p)) hasil.push(p);
    }
    return hasil;
};

const rel = (p) => path.relative(AKAR, p).replace(/\\/g, '/');
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

// ───────────────────────────── 1. Endpoint API ─────────────────────────────
const METODE = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All'];

function bacaEndpoint() {
    const berkas = jelajah(path.join(AKAR, 'backend', 'src'), (p) => p.endsWith('.controller.ts'));
    const polaRute = new RegExp(`@(${METODE.join('|')})\\(\\s*(?:['"\`]([^'"\`]*)['"\`])?`);
    const keluar = [];
    for (const f of berkas) {
        const baris = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        let tumpuk = [];   // dekorator yang sedang menumpuk
        let kini = null;   // controller yang sedang dibaca
        for (const l of baris) {
            const t = l.trim();
            if (t.startsWith('@')) { tumpuk.push(t); continue; }

            // Satu berkas bisa memuat BEBERAPA kelas controller (mis. versi publik
            // lalu versi berpenjaga), plus kelas DTO. Jadi setiap "export class"
            // memulai konteks baru, dan hanya yang berdekorator @Controller dipakai.
            const kelas = t.match(/^export class (\w+)/);
            if (kelas) {
                const dek = tumpuk.join(' ');
                if (dek.includes('@Controller(')) {
                    kini = {
                        kelas: kelas[1],
                        berkas: rel(f),
                        dasar: (dek.match(/@Controller\(\s*['"\`]([^'"\`]*)['"\`]/) || [])[1] || '',
                        penjagaKelas: [...dek.matchAll(/@UseGuards\(([^)]*)\)/g)].map((m) => m[1]).join(', '),
                        peranKelas: [...dek.matchAll(/@Roles\(([^)]*)\)/g)].map((m) => m[1]).join(', '),
                        rute: [],
                    };
                    keluar.push(kini);
                } else {
                    kini = null; // kelas DTO / helper → bukan endpoint
                }
                tumpuk = [];
                continue;
            }

            const dek = tumpuk.join(' ');
            const m = dek.match(polaRute);
            if (m && t && kini) {
                const nama = (t.match(/^(?:async\s+)?([A-Za-z0-9_]+)\s*\(/) || [])[1] ?? '';
                const penjaga = [...dek.matchAll(/@UseGuards\(([^)]*)\)/g)].map((x) => x[1]).join(', ') || kini.penjagaKelas;
                const peran = [...dek.matchAll(/@Roles\(([^)]*)\)/g)].map((x) => x[1]).join(', ') || kini.peranKelas;
                const jalur = ('/' + [kini.dasar, m[2] ?? ''].filter(Boolean).join('/')).replace(/\/+/g, '/');
                kini.rute.push({ metode: m[1].toUpperCase(), jalur, nama, penjaga, peran });
            }
            if (t) tumpuk = [];
        }
    }
    return keluar.filter((c) => c.rute.length).sort((a, b) => (a.dasar || '~').localeCompare(b.dasar || '~') || a.kelas.localeCompare(b.kelas));
}

function tulisEndpoint(data) {
    const total = data.reduce((n, c) => n + c.rute.length, 0);
    const bebas = data.flatMap((c) => c.rute).filter((r) => !r.penjaga).length;
    const baris = [
        '# 📡 Referensi Endpoint API', '', STEMPEL, '',
        `PosPro menyajikan **${total} endpoint** dalam **${data.length} controller**.`,
        `Sebanyak **${bebas} endpoint tanpa penjaga login** — itu memang disengaja untuk`,
        'halaman publik (landing, artikel, tautan penilaian, verifikasi PIN) dan webhook,',
        'tetapi daftar ini juga berguna saat mengaudit akses.', '',
        '**Cara membaca kolom Penjaga:** `JwtAuthGuard` = wajib token login ·',
        '`RolesGuard`/`ManagerGuard`/`OwnerGuard` = dibatasi peran · `MenuGuard` = peran yang diberi menunya',
        '(Akses Menu Role) · `BoardOrUserGuard` = token papan kerja dari PIN atau token login ·',
        'kosong = terbuka (publik/webhook/PIN per permintaan).',
        'Rinciannya di [Model Akses & Keamanan](keamanan-akses.md).', '',
        '## Ringkasan per kelompok', '',
        '| Jalur dasar | Kelas | Endpoint | Berkas |', '|---|---|---:|---|',
        ...data.map((c) => `| \`/${c.dasar}\` | ${c.kelas} | ${c.rute.length} | \`${c.berkas}\` |`),
        '', '---', '',
    ];
    for (const c of data) {
        baris.push(`## ${c.kelas} — \`/${c.dasar}\``, '', `Berkas: \`${c.berkas}\``);
        if (c.penjagaKelas) baris.push(`Penjaga tingkat kelas: \`${esc(c.penjagaKelas)}\`${c.peranKelas ? ` · peran: \`${esc(c.peranKelas)}\`` : ''}`);
        baris.push('', '| Metode | Jalur | Handler | Penjaga | Peran |', '|---|---|---|---|---|');
        for (const r of c.rute) {
            baris.push(`| ${r.metode} | \`${r.jalur}\` | \`${r.nama}\` | ${r.penjaga ? `\`${esc(r.penjaga)}\`` : '— _terbuka_' } | ${r.peran ? `\`${esc(r.peran)}\`` : '—'} |`);
        }
        baris.push('');
    }
    fs.writeFileSync(path.join(WIKI, 'referensi-endpoint.md'), baris.join('\n'));
    return { total, controller: data.length, bebas };
}

// ───────────────────────────── 2. Basis data ─────────────────────────────
function bacaModel() {
    const isi = fs.readFileSync(path.join(AKAR, 'backend', 'prisma', 'schema.prisma'), 'utf8');
    const baris = isi.split(/\r?\n/);
    const model = [];
    const enumerasi = [];
    let kini = null, jenis = null, catatan = [], komentarKolom = [];

    for (const l of baris) {
        const t = l.trim();
        if (/^model\s+\w+\s*\{/.test(t)) {
            kini = { nama: t.split(/\s+/)[1], tabel: null, kolom: [], catatan: catatan.slice(), indeks: [] };
            jenis = 'model'; catatan = []; komentarKolom = []; continue;
        }
        if (/^enum\s+\w+\s*\{/.test(t)) {
            kini = { nama: t.split(/\s+/)[1], nilai: [] }; jenis = 'enum'; catatan = []; continue;
        }
        if (t === '}' && kini) {
            (jenis === 'model' ? model : enumerasi).push(kini);
            kini = null; jenis = null; continue;
        }
        if (!kini) { if (t.startsWith('//')) catatan.push(t.replace(/^\/+\s?/, '')); else catatan = []; continue; }
        if (jenis === 'enum') { if (t && !t.startsWith('//')) kini.nilai.push(t.split(/\s+/)[0]); continue; }

        // dalam model
        if (t.startsWith('@@map(')) { kini.tabel = (t.match(/@@map\(\s*['"`]([^'"`]+)/) || [])[1]; continue; }
        if (t.startsWith('@@')) { kini.indeks.push(t); continue; }
        if (!t) { komentarKolom = []; continue; }
        if (t.startsWith('//')) { komentarKolom.push(t.replace(/^\/+\s?/, '')); continue; }
        const m = t.match(/^(\w+)\s+([\w\[\]?]+)(.*)$/);
        if (!m) { komentarKolom = []; continue; }
        const sisa = m[3] || '';
        // Komentar bisa di ujung baris, atau satu-dua baris DI ATAS kolomnya —
        // gaya kedua dipakai untuk penjelasan panjang, jadi keduanya dipungut.
        const ketMentah = (sisa.match(/\/\/\s*(.*)$/) || [])[1] || komentarKolom.join(' ');
        // Komentar schema sesekali memuat pengenal akun nyata (mis. act_<digit>
        // milik akun iklan Meta). Wiki ini publik, jadi angkanya disamarkan
        // tanpa perlu mengubah schema.
        const ket = ketMentah.replace(/\b(act_)\d{6,}/g, '$1XXXXXXXXXX');
        komentarKolom = [];
        kini.kolom.push({
            nama: m[1], tipe: m[2],
            map: (sisa.match(/@map\(\s*['"`]([^'"`]+)/) || [])[1] || '',
            atribut: sisa.replace(/\/\/.*$/, '').trim(),
            ket,
        });
    }
    model.sort((a, b) => (a.tabel || a.nama).localeCompare(b.tabel || b.nama));
    enumerasi.sort((a, b) => a.nama.localeCompare(b.nama));
    return { model, enumerasi };
}

function tulisBasisData({ model, enumerasi }) {
    const kolomTotal = model.reduce((n, m) => n + m.kolom.length, 0);
    const baris = [
        '# 🗄️ Referensi Basis Data', '', STEMPEL, '',
        `**${model.length} tabel**, **${kolomTotal} kolom**, dan **${enumerasi.length} himpunan nilai (enum)**.`,
        'Nama di kolom pertama adalah nama tabel di MySQL; nama model Prisma ditulis di judulnya.',
        'Keterangan diambil dari komentar di `backend/prisma/schema.prisma`, jadi kalau ada',
        'kolom yang belum jelas maknanya, tambahkan komentarnya di sana — bukan di sini.', '',
        '## Daftar tabel', '',
        '| Tabel | Model | Kolom | Untuk apa |', '|---|---|---:|---|',
        ...model.map((m) => `| \`${m.tabel || '—'}\` | ${m.nama} | ${m.kolom.length} | ${esc(m.catatan.join(' ')).slice(0, 110) || '—'} |`),
        '', '---', '', '## Rincian kolom', '',
    ];
    for (const m of model) {
        baris.push(`### ${m.nama} — \`${m.tabel || '(tanpa @@map)'}\``, '');
        if (m.catatan.length) baris.push(m.catatan.map((c) => `> ${c}`).join('\n'), '');
        baris.push('| Kolom | Tipe | Kolom MySQL | Keterangan |', '|---|---|---|---|');
        for (const k of m.kolom) {
            baris.push(`| \`${k.nama}\` | \`${k.tipe}\` | ${k.map ? `\`${k.map}\`` : '_sama_'} | ${esc(k.ket) || '—'} |`);
        }
        if (m.indeks.length) baris.push('', `Indeks & kunci: ${m.indeks.map((i) => `\`${i}\``).join(' · ')}`);
        baris.push('');
    }
    baris.push('---', '', '## Himpunan nilai (enum)', '');
    for (const e of enumerasi) baris.push(`- **${e.nama}**: ${e.nilai.map((v) => `\`${v}\``).join(' · ')}`);
    baris.push('');
    fs.writeFileSync(path.join(WIKI, 'referensi-basis-data.md'), baris.join('\n'));
    return { tabel: model.length, kolom: kolomTotal, enum: enumerasi.length };
}

// ───────────────────────────── 3. Halaman frontend ─────────────────────────────
function bacaHalaman() {
    const dir = path.join(AKAR, 'frontend', 'src', 'app');
    const berkas = jelajah(dir, (p) => /[\\/]page\.tsx$/.test(p));
    const nav = fs.readFileSync(path.join(AKAR, 'frontend', 'src', 'components', 'layout', 'nav-config.ts'), 'utf8');

    // Peta href → { label, bagian, batas }
    const peta = new Map();
    let bagian = '(tautan atas)';
    for (const l of nav.split(/\r?\n/)) {
        const b = l.match(/key:\s*'([^']+)',\s*label:\s*'([^']+)'/);
        if (b) { bagian = b[2]; continue; }
        const m = l.match(/name:\s*"([^"]+)",\s*href:\s*"([^"]+)"/);
        if (m) {
            const batas = /ownerOnly:\s*true/.test(l) ? 'Owner' : /managerOnly:\s*true/.test(l) ? 'Manajer+' : '';
            peta.set(m[2], { label: m[1], bagian, batas });
        }
    }

    const halaman = berkas.map((f) => {
        const jalur = '/' + path.relative(dir, path.dirname(f)).replace(/\\/g, '/');
        const rute = jalur === '/.' ? '/' : jalur;
        const n = peta.get(rute);
        return {
            rute,
            berkas: rel(f),
            label: n?.label || '',
            bagian: n?.bagian || '',
            batas: n?.batas || '',
            dinamis: /\[/.test(rute),
        };
    }).sort((a, b) => a.rute.localeCompare(b.rute));

    return halaman;
}

function tulisHalaman(halaman) {
    const diMenu = halaman.filter((h) => h.label).length;
    const baris = [
        '# 🧭 Referensi Halaman', '', STEMPEL, '',
        `**${halaman.length} halaman** di aplikasi. **${diMenu}** di antaranya punya menu di sidebar;`,
        'sisanya dibuka dari dalam halaman lain (detail, form), lewat PIN (papan kerja),',
        'atau memang halaman publik tanpa login.', '',
        '| Jalur | Menu | Kelompok menu | Batas peran | Berkas |', '|---|---|---|---|---|',
        ...halaman.map((h) => `| \`${h.rute}\` | ${h.label || '—'} | ${h.bagian || '—'} | ${h.batas || '—'} | \`${h.berkas}\` |`),
        '',
        '## Halaman tanpa menu', '',
        'Biasanya salah satu dari: halaman detail/form yang dibuka dari daftar,',
        'papan kerja ber-PIN, atau halaman publik.', '',
        ...halaman.filter((h) => !h.label).map((h) => `- \`${h.rute}\`${h.dinamis ? ' _(jalur dinamis)_' : ''}`),
        '',
    ];
    fs.writeFileSync(path.join(WIKI, 'referensi-halaman.md'), baris.join('\n'));
    return { halaman: halaman.length, diMenu };
}

// ───────────────────────────── 4. Env & cron ─────────────────────────────
function bacaEnvCron() {
    const sumberBe = jelajah(path.join(AKAR, 'backend', 'src'), (p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
    const sumberFe = jelajah(path.join(AKAR, 'frontend', 'src'), (p) => /\.(ts|tsx)$/.test(p));

    const kumpul = (berkas) => {
        const peta = new Map();
        for (const f of berkas) {
            const isi = fs.readFileSync(f, 'utf8');
            for (const m of isi.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
                const v = peta.get(m[1]) || new Set();
                v.add(rel(f));
                peta.set(m[1], v);
            }
        }
        return [...peta.entries()].map(([nama, set]) => ({ nama, berkas: [...set] })).sort((a, b) => a.nama.localeCompare(b.nama));
    };

    const cron = [];
    for (const f of sumberBe) {
        const baris = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        for (let i = 0; i < baris.length; i++) {
            const m = baris[i].match(/@(Cron|Interval)\((.*)\)/);
            if (!m) continue;
            let nama = '';
            for (let j = i + 1; j < Math.min(i + 4, baris.length); j++) {
                const n = baris[j].trim().match(/^(?:async\s+)?([A-Za-z0-9_]+)\s*\(/);
                if (n) { nama = n[1]; break; }
            }
            cron.push({ jenis: m[1], jadwal: m[2], nama, berkas: rel(f) });
        }
    }
    return { be: kumpul(sumberBe), fe: kumpul(sumberFe), cron };
}

function tulisEnvCron({ be, fe, cron }) {
    const baris = [
        '# ⚙️ Referensi Variabel Lingkungan & Pekerjaan Terjadwal', '', STEMPEL, '',
        '## Variabel lingkungan backend', '',
        `**${be.length} variabel** dibaca oleh backend. Yang tidak diisi membuat fiturnya`,
        'menganggap diri belum dikonfigurasi — aplikasi tetap jalan, fitur itu saja yang diam.', '',
        '| Variabel | Dipakai di |', '|---|---|',
        ...be.map((v) => `| \`${v.nama}\` | ${v.berkas.slice(0, 3).map((f) => `\`${f}\``).join(', ')}${v.berkas.length > 3 ? ` _(+${v.berkas.length - 3})_` : ''} |`),
        '',
        '## Variabel lingkungan frontend', '',
        'Hanya yang berawalan `NEXT_PUBLIC_` yang sampai ke browser, dan nilainya',
        '**dipanggang saat build** — mengubahnya menuntut build ulang.', '',
        '| Variabel | Dipakai di |', '|---|---|',
        ...fe.map((v) => `| \`${v.nama}\` | ${v.berkas.slice(0, 3).map((f) => `\`${f}\``).join(', ')}${v.berkas.length > 3 ? ` _(+${v.berkas.length - 3})_` : ''} |`),
        '',
        '## Pekerjaan terjadwal', '',
        `**${cron.length} pekerjaan** berjalan sendiri di backend.`,
        'Semua memakai zona waktu server kecuali disebut lain di jadwalnya.', '',
        '| Jenis | Jadwal | Fungsi | Berkas |', '|---|---|---|---|',
        ...cron.map((c) => `| ${c.jenis} | \`${esc(c.jadwal)}\` | \`${c.nama}\` | \`${c.berkas}\` |`),
        '',
    ];
    fs.writeFileSync(path.join(WIKI, 'referensi-env-cron.md'), baris.join('\n'));
    return { be: be.length, fe: fe.length, cron: cron.length };
}

// ───────────────────────────── jalan ─────────────────────────────
const e = tulisEndpoint(bacaEndpoint());
const d = tulisBasisData(bacaModel());
const h = tulisHalaman(bacaHalaman());
const v = tulisEnvCron(bacaEnvCron());
console.log('Referensi wiki dibangkitkan:');
console.log(`  referensi-endpoint.md    : ${e.total} endpoint · ${e.controller} controller · ${e.bebas} tanpa penjaga login`);
console.log(`  referensi-basis-data.md  : ${d.tabel} tabel · ${d.kolom} kolom · ${d.enum} enum`);
console.log(`  referensi-halaman.md     : ${h.halaman} halaman · ${h.diMenu} punya menu`);
console.log(`  referensi-env-cron.md    : ${v.be} env backend · ${v.fe} env frontend · ${v.cron} pekerjaan terjadwal`);

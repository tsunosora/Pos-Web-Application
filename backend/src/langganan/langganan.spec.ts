/**
 * Tes penerus langganan. Tanpa Nest, tanpa DB, tanpa jaringan sungguhan: `fetch` dipalsukan.
 *
 * Yang dijaga di sini, berurutan dari yang paling penting:
 * 1. TOKEN TIDAK PERNAH BOCOR ke jawaban yang dikirim ke browser. Token instalasi setara kunci —
 *    pemegangnya bisa mengubah paket dan menyatakan tagihan sudah dibayar. Kalau tes ini gagal,
 *    JANGAN diakali: berarti ada jalur yang menyalin badan permintaan/header ke jawaban.
 * 2. Galat 409 `ditolak` diteruskan APA ADANYA — `pesan`-nya ditulis penerbit untuk dibaca orang.
 * 3. "Belum tersambung" itu keadaan NORMAL, bukan galat.
 * 4. Yang bukan pemilik ditolak.
 */
import { ForbiddenException, HttpException } from '@nestjs/common';
import { OwnerGuard } from '../auth/role-groups';
import { LisensiService } from '../lisensi/lisensi.service';
import { LanggananController } from './langganan.controller';
import { LanggananService } from './langganan.service';

const TOKEN_UJI = 'token-instalasi-rahasia-buat-tes';

/** Kumpulkan permintaan keluar supaya bisa diperiksa header-nya. */
let permintaan: { url: string; init: RequestInit }[] = [];

function pasangFetch(jawaban: { status: number; badan: unknown } | Error) {
    permintaan = [];
    (global as any).fetch = jest.fn(async (url: string, init: RequestInit) => {
        permintaan.push({ url: String(url), init });
        if (jawaban instanceof Error) throw jawaban;
        return {
            ok: jawaban.status >= 200 && jawaban.status < 300,
            status: jawaban.status,
            json: async () => jawaban.badan,
        } as any;
    });
}

/** LisensiService palsu — cuma `segarkan()` yang dipakai controller. */
function lisensiPalsu() {
    return { segarkan: jest.fn(async () => undefined) } as unknown as LisensiService & {
        segarkan: jest.Mock;
    };
}

// null = "instalasi tanpa token". JANGAN pakai undefined: itu justru memicu nilai bawaan
// parameter, jadi tesnya lulus sambil menguji jalur yang salah (sudah pernah kejadian).
function buat(token: string | null = TOKEN_UJI) {
    if (token === null) delete process.env.QENDALI_LISENSI_TOKEN;
    else process.env.QENDALI_LISENSI_TOKEN = token;
    process.env.QENDALI_LISENSI_URL = 'http://penerbit.uji';
    const lisensi = lisensiPalsu();
    return { ctl: new LanggananController(new LanggananService(), lisensi), lisensi };
}

const envAsli = { ...process.env };
afterEach(() => {
    process.env = { ...envAsli };
    jest.restoreAllMocks();
});

// ── 1. Token tidak pernah sampai ke browser ────────────────────────────────────────────

describe('token instalasi', () => {
    it('dikirim ke penerbit lewat header Authorization, dan TIDAK ADA di jawaban', async () => {
        pasangFetch({ status: 200, badan: { klien: { kode: 'demo' }, fitur: ['pos.core'] } });
        const { ctl } = buat();

        const hasil = await ctl.ringkasan();

        // Masuk ke header permintaan KELUAR…
        const kirim = permintaan[0].init.headers as Record<string, string>;
        expect(kirim.authorization).toBe(`Bearer ${TOKEN_UJI}`);
        expect(permintaan[0].url).toBe('http://penerbit.uji/api/aplikasi/langganan');

        // …tapi tidak pernah ada di jawaban yang dikirim ke browser.
        expect(JSON.stringify(hasil)).not.toContain(TOKEN_UJI);
        expect(hasil).toEqual({ tersambung: true, klien: { kode: 'demo' }, fitur: ['pos.core'] });
    });

    it('tidak ikut di jawaban galat, walau penerbit menolak', async () => {
        pasangFetch({ status: 409, badan: { salah: 'ditolak', pesan: 'Paket itu tidak ada.' } });
        const { ctl } = buat();

        const galat = await ctl.ajukanPerubahan({ jenis: 'ganti_paket', paket: 'ngawur' }).catch((e) => e);

        expect(galat).toBeInstanceOf(HttpException);
        expect(JSON.stringify((galat as HttpException).getResponse())).not.toContain(TOKEN_UJI);
    });

    it('tidak ikut di jawaban saat penerbit tidak terjangkau', async () => {
        pasangFetch(new Error('ECONNREFUSED 127.0.0.1:443'));
        const { ctl } = buat();

        const galat = await ctl.domain().catch((e) => e);

        expect((galat as HttpException).getStatus()).toBe(503);
        expect(JSON.stringify((galat as HttpException).getResponse())).not.toContain(TOKEN_UJI);
    });
});

// ── 2. Galat penerbit diteruskan apa adanya ────────────────────────────────────────────

describe('galat dari penerbit', () => {
    it('409 ditolak: kode status DAN pesannya diteruskan apa adanya', async () => {
        const pesan = 'Masih ada perubahan yang menunggu dibayar. Batalkan dulu yang itu.';
        pasangFetch({ status: 409, badan: { salah: 'ditolak', pesan } });
        const { ctl } = buat();

        const galat = (await ctl
            .ajukanPerubahan({ jenis: 'ganti_paket', paket: 'bisnis' })
            .catch((e) => e)) as HttpException;

        expect(galat.getStatus()).toBe(409);
        // Pesannya TIDAK ditulis ulang di sini — satu kalimat, satu tempat.
        expect(galat.getResponse()).toEqual({ salah: 'ditolak', pesan });
    });

    it('403 langganan_berhenti diteruskan sebagai 403', async () => {
        pasangFetch({ status: 403, badan: { salah: 'langganan_berhenti', pesan: 'Langganan berhenti.' } });
        const { ctl } = buat();

        const galat = (await ctl.batalkanPerubahan().catch((e) => e)) as HttpException;
        expect(galat.getStatus()).toBe(403);
        expect((galat.getResponse() as any).salah).toBe('langganan_berhenti');
    });

    it('jawaban galat tanpa bentuk yang dikenal tetap jadi {salah, pesan}', async () => {
        pasangFetch({ status: 500, badan: '<html>gerbang galat</html>' });
        const { ctl } = buat();

        const galat = (await ctl.domain().catch((e) => e)) as HttpException;
        const isi = galat.getResponse() as { salah: string; pesan: string };
        expect(galat.getStatus()).toBe(500);
        expect(isi.salah).toBe('gangguan_server');
        expect(typeof isi.pesan).toBe('string');
    });

    it('timeout jadi 503 dengan pesan yang menenangkan, bukan 500 tanpa penjelasan', async () => {
        pasangFetch(new Error('The operation was aborted'));
        const { ctl } = buat();

        const galat = (await ctl.domain().catch((e) => e)) as HttpException;
        const isi = galat.getResponse() as { salah: string; pesan: string };
        expect(galat.getStatus()).toBe(503);
        expect(isi.salah).toBe('tidak_terjangkau');
        expect(isi.pesan).toMatch(/kasir tetap jalan/i);
    });
});

// ── 3. Belum tersambung = normal ───────────────────────────────────────────────────────

describe('instalasi yang belum tersambung', () => {
    it('GET ringkasan menjawab tersambung:false, TIDAK melempar galat', async () => {
        pasangFetch({ status: 200, badan: {} });
        const { ctl } = buat(null);

        const hasil = (await ctl.ringkasan()) as { tersambung: boolean; pesan: string };

        expect(hasil.tersambung).toBe(false);
        expect(hasil.pesan).toMatch(/belum tersambung/i);
        // Tidak ada panggilan keluar sama sekali — tanpa token tidak ada yang bisa ditanyakan.
        expect(permintaan).toHaveLength(0);
    });

    it('token berisi spasi saja dihitung kosong', async () => {
        pasangFetch({ status: 200, badan: {} });
        const { ctl } = buat('   ');
        expect(((await ctl.ringkasan()) as { tersambung: boolean }).tersambung).toBe(false);
    });

    it('yang mengubah ditolak rapi (409 belum_tersambung), tanpa menembak penerbit', async () => {
        pasangFetch({ status: 200, badan: {} });
        const { ctl } = buat(null);

        const galat = (await ctl
            .ajukanPerubahan({ jenis: 'ganti_paket', paket: 'bisnis' })
            .catch((e) => e)) as HttpException;

        expect(galat.getStatus()).toBe(409);
        expect((galat.getResponse() as any).salah).toBe('belum_tersambung');
        expect(permintaan).toHaveLength(0);
    });
});

// ── 4. Hanya pemilik ───────────────────────────────────────────────────────────────────

describe('OwnerGuard di /langganan', () => {
    const ctx = (roleName: string | null) =>
        ({ switchToHttp: () => ({ getRequest: () => ({ user: roleName ? { roleName } : {} }) }) }) as any;

    it.each(['Owner', 'pemilik', 'SuperAdmin'])('peran %s boleh', (peran) => {
        expect(new OwnerGuard().canActivate(ctx(peran))).toBe(true);
    });

    it.each(['Kasir', 'Manajer Toko', 'Admin', 'Kepala Produksi', 'Desainer', null])(
        'peran %s DITOLAK — tagihan & paket bukan urusan mereka',
        (peran) => {
            expect(() => new OwnerGuard().canActivate(ctx(peran))).toThrow(ForbiddenException);
        },
    );

    it('controller memang memasang JwtAuthGuard + OwnerGuard', () => {
        // Penjaga dipasang lewat dekorator di kelas; kalau seseorang menghapusnya, tes ini gagal.
        const penjaga = Reflect.getMetadata('__guards__', LanggananController) as unknown[];
        const nama = penjaga.map((g: any) => g.name ?? g.constructor?.name);
        expect(nama).toContain('JwtAuthGuard');
        expect(nama).toContain('OwnerGuard');
    });
});

// ── Penyegaran kunci setelah perubahan langsung berlaku ────────────────────────────────

describe('penyegaran lisensi', () => {
    it('perubahan yang langsung "diterapkan" memicu penyegaran kunci', async () => {
        pasangFetch({ status: 200, badan: { status: 'diterapkan' } });
        const { ctl, lisensi } = buat();

        await ctl.ajukanPerubahan({ jenis: 'lepas_tambahan', tambahan: 'whatsapp_resmi' });

        expect(lisensi.segarkan).toHaveBeenCalledWith('manual');
    });

    it('perubahan yang masih menunggu bayar TIDAK memicu penyegaran — isinya belum berubah', async () => {
        pasangFetch({ status: 200, badan: { status: 'menunggu_bayar', tagihan: { id: 9 } } });
        const { ctl, lisensi } = buat();

        await ctl.ajukanPerubahan({ jenis: 'ganti_paket', paket: 'bisnis' });

        expect(lisensi.segarkan).not.toHaveBeenCalled();
    });
});

// ── Jalur & badan yang dikirim ke penerbit ─────────────────────────────────────────────

describe('pemetaan jalur', () => {
    it.each([
        ['domain', 'GET', 'http://penerbit.uji/api/aplikasi/domain'],
        ['periksaDomain', 'POST', 'http://penerbit.uji/api/aplikasi/domain'],
        ['lepasDomain', 'DELETE', 'http://penerbit.uji/api/aplikasi/domain'],
        ['batalkanPerubahan', 'DELETE', 'http://penerbit.uji/api/aplikasi/perubahan'],
    ])('%s → %s %s', async (metodeCtl, metodeHttp, url) => {
        pasangFetch({ status: 200, badan: {} });
        const { ctl } = buat();
        await (ctl as any)[metodeCtl]();
        expect(permintaan[0].url).toBe(url);
        expect(permintaan[0].init.method).toBe(metodeHttp);
    });

    it('"saya sudah transfer" mengirim id & catatan apa adanya', async () => {
        pasangFetch({ status: 200, badan: { status: 'menunggu_verifikasi' } });
        const { ctl } = buat();

        await ctl.sudahTransfer({ id: 138, catatan: 'TRF BCA 26/9' });

        expect(permintaan[0].url).toBe('http://penerbit.uji/api/aplikasi/tagihan');
        expect(JSON.parse(String(permintaan[0].init.body))).toEqual({ id: 138, catatan: 'TRF BCA 26/9' });
    });

    it('alamat penerbit boleh diakhiri garis miring tanpa bikin jalur dobel', async () => {
        pasangFetch({ status: 200, badan: {} });
        const { ctl } = buat();
        process.env.QENDALI_LISENSI_URL = 'http://penerbit.uji/';
        await ctl.domain();
        expect(permintaan[0].url).toBe('http://penerbit.uji/api/aplikasi/domain');
    });
});

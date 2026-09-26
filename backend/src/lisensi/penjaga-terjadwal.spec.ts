/**
 * Penegakan lisensi untuk pekerjaan yang jalan SENDIRI di dalam proses (cron & alur webhook).
 * Dekorator `@ButuhSalahSatuFitur` diuji di `penjaga-crm-wa.spec.ts` bersama dekorator lain yang
 * terpasang di controller sungguhan.
 *
 * Tanpa Nest, tanpa DB, tanpa jaringan: `LisensiService`-nya dipalsukan, tapi `PenjagaTerjadwal`
 * dan aturannya ASLI — jadi yang diuji keputusan yang benar-benar dipakai produksi.
 *
 * TIGA HAL YANG PALING PENTING DI SINI. Kalau salah satunya gagal, jangan diakali:
 *
 * 1. **GAGAL-TERBUKA.** Tanpa kunci, kunci rusak, penjaga tidak tersuntik, bahkan pemeriksaannya
 *    sendiri yang melempar galat — penjadwalnya JALAN. Penjadwal yang mati diam-diam tidak
 *    meninggalkan jejak galat di mana pun: pemiliknya baru tahu dari pelanggan yang tidak pernah
 *    dihubungi, berhari-hari kemudian.
 * 2. **ANTREAN TIDAK RUSAK.** Pekerjaan yang dilewati tidak ditandai gagal, tidak dihapus, dan
 *    penghitung percobaannya tidak naik. Cara mengujinya di sini: `prisma` palsunya MELEMPAR
 *    kalau disentuh sama sekali. Jadi tes lulus hanya kalau cron-nya benar-benar keluar sebelum
 *    satu baris pun dibaca atau ditulis.
 * 3. **LOG TIDAK BANJIR.** Penjadwal broadcast jalan tiap menit. Satu baris per putaran =
 *    1.440 baris sehari untuk satu klien yang paketnya turun.
 */
import { Logger } from '@nestjs/common';

import { Keadaan } from './keadaan-lisensi';
import { LisensiService } from './lisensi.service';
import { KodePekerjaan, PEKERJAAN_TERJADWAL, putusanTerjadwal } from './aturan-terjadwal';
import { PenjagaTerjadwal, lewatiKarenaLisensi } from './penjaga-terjadwal.service';

import { BroadcastService } from '../whatsapp-cloud/broadcast.service';
import { RemindersService } from '../whatsapp-cloud/reminders.service';
import { TemplatesService } from '../whatsapp-cloud/templates.service';
import { AutoReplyService } from '../whatsapp-cloud/auto-reply.service';
import { SocialCommentsService } from '../meta-messaging/social-comments.service';
import { FollowUpsCron } from '../crm/follow-ups/follow-ups.cron';

const KEADAAN_KOSONG: Keadaan = {
    ditegakkan: false,
    status: 'tanpa_lisensi',
    hanyaBaca: false,
    alasan: null,
    jamMundur: false,
    klien: null,
    namaKlien: null,
    produk: null,
    paket: null,
    fitur: [],
    batas: {},
    berlakuSampai: null,
    tenggangSampai: null,
    sisaHari: null,
    sisaHariTenggang: null,
    terakhirTerlihat: null,
};

const keadaan = (ubah: Partial<Keadaan> = {}): Keadaan => ({ ...KEADAAN_KOSONG, ...ubah });

function lisensiPalsu(ubah: Partial<Keadaan> = {}): LisensiService {
    const k = keadaan(ubah);
    return {
        keadaan: () => k,
        punyaFitur: (kode: string) => (k.ditegakkan ? k.fitur.includes(kode) : true),
    } as unknown as LisensiService;
}

const penjaga = (ubah: Partial<Keadaan> = {}) => new PenjagaTerjadwal(lisensiPalsu(ubah));

/** Paket lengkap WhatsApp + sosial + CRM, seperti Produksi/Bisnis dengan add-on WhatsApp. */
const PUNYA_SEMUA = {
    ditegakkan: true,
    status: 'aktif' as const,
    paket: 'bisnis',
    fitur: ['wa.cloud', 'wa.automation', 'social.inbox', 'crm.leads'],
};

/** Add-on WhatsApp dicabut, sisanya masih ada. Ini kasus yang melahirkan seluruh berkas ini. */
const TANPA_WA = {
    ditegakkan: true,
    status: 'aktif' as const,
    paket: 'usaha',
    fitur: ['pos.core', 'social.inbox', 'crm.leads'],
};

/** Kunci sah tapi masa berlakunya + tenggangnya habis. */
const HANYA_BACA = {
    ...PUNYA_SEMUA,
    status: 'hanya_baca' as const,
    hanyaBaca: true,
    alasan: 'masa_berlaku_habis',
};

/**
 * `prisma` yang MELEMPAR begitu disentuh. Dipakai untuk membuktikan pekerjaan yang dilewati
 * tidak menyentuh antrean sama sekali — bukan cuma "tidak menandainya gagal".
 */
const prismaPeledak = () =>
    new Proxy(
        {},
        {
            get(_t, tabel: string) {
                return new Proxy(
                    {},
                    {
                        get(_t2, aksi: string) {
                            return () => {
                                throw new Error(`prisma.${tabel}.${String(aksi)}() dipanggil padahal harus dilewati`);
                            };
                        },
                    },
                );
            },
        },
    ) as any;

const cloudPeledak = () =>
    ({
        get enabled() {
            return true;
        },
        sendText: () => {
            throw new Error('cloud.sendText() dipanggil padahal harus dilewati');
        },
        sendTemplate: () => {
            throw new Error('cloud.sendTemplate() dipanggil padahal harus dilewati');
        },
    }) as any;

// ══════════════════════════════════════════════════════════════════════════════════════
describe('aturan-terjadwal: putusan per pekerjaan', () => {
    const SEMUA: KodePekerjaan[] = Object.keys(PEKERJAAN_TERJADWAL) as KodePekerjaan[];

    it('GAGAL-TERBUKA: penegakan mati → semua pekerjaan jalan', () => {
        for (const kode of SEMUA) {
            expect(putusanTerjadwal(keadaan(), kode).boleh).toBe(true);
        }
    });

    it('fitur lengkap → semua pekerjaan jalan', () => {
        for (const kode of SEMUA) {
            expect(putusanTerjadwal(keadaan(PUNYA_SEMUA), kode).boleh).toBe(true);
        }
    });

    it('add-on WhatsApp dicabut → pekerjaan WA dilewati, sosial & CRM tetap jalan', () => {
        const k = keadaan(TANPA_WA);
        expect(putusanTerjadwal(k, 'wa.broadcast').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'wa.reminder').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'wa.balasan-otomatis').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'wa.sinkron-template').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'sosial.komentar').boleh).toBe(true);
        expect(putusanTerjadwal(k, 'crm.repeat-order').boleh).toBe(true);
    });

    it('alasan & catatannya menyebut kode fitur yang kurang, bukan sekadar "ditolak"', () => {
        const p = putusanTerjadwal(keadaan(TANPA_WA), 'wa.broadcast');
        expect(p.alasan).toBe('fitur_tidak_ada');
        expect(p.fiturKurang).toEqual(['wa.cloud', 'wa.automation']);
        expect(p.catatan).toContain('wa.cloud');
        expect(p.catatan).toContain('usaha');
        // Kalimatnya wajib menyatakan pekerjaannya TIDAK hilang — yang membacanya di log jangan
        // sampai mengira harus membuat ulang broadcast-nya dari nol.
        expect(p.catatan).toContain('tidak dibatalkan');
    });

    it('cuma satu kode yang kurang → yang itu saja yang dilaporkan', () => {
        const p = putusanTerjadwal(
            keadaan({ ditegakkan: true, paket: 'usaha', fitur: ['wa.cloud'] }),
            'wa.broadcast',
        );
        expect(p.fiturKurang).toEqual(['wa.automation']);
    });

    it('MASA TENGGANG masih jalan penuh — cuma kedaluwarsa yang berhenti', () => {
        const k = keadaan({ ...PUNYA_SEMUA, status: 'tenggang', sisaHariTenggang: 3 });
        for (const kode of SEMUA) {
            expect(putusanTerjadwal(k, kode).boleh).toBe(true);
        }
    });

    it('HANYA-BACA: yang mengirim/membuat data dilewati, yang cuma menarik tetap jalan', () => {
        const k = keadaan(HANYA_BACA);
        // Mengirim = biaya Meta ke kartu klien + data baru di instalasi yang sudah hanya-baca.
        expect(putusanTerjadwal(k, 'wa.broadcast').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'wa.reminder').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'wa.balasan-otomatis').boleh).toBe(false);
        expect(putusanTerjadwal(k, 'crm.repeat-order').boleh).toBe(false);
        // Menarik keadaan dari Meta = alasan yang sama dengan webhook yang dibiarkan terbuka:
        // memblokirnya membuang komentar & status template pelanggan, bukan menghemat apa pun.
        expect(putusanTerjadwal(k, 'wa.sinkron-template').boleh).toBe(true);
        expect(putusanTerjadwal(k, 'sosial.komentar').boleh).toBe(true);
    });

    it('hanya-baca dilaporkan sebagai hanya-baca, BUKAN sebagai fitur yang hilang', () => {
        // Kunci yang tidak sah membuat `fitur` kosong. Kalau fitur diperiksa lebih dulu, log-nya
        // menuduh "wa.cloud dicabut" dan orang yang membacanya pergi ke dasbor yang tidak salah
        // apa-apa, bukan ke tagihan yang belum dibayar.
        const p = putusanTerjadwal(
            keadaan({ ditegakkan: true, status: 'hanya_baca', hanyaBaca: true, alasan: 'tanda_tangan_tidak_cocok' }),
            'wa.broadcast',
        );
        expect(p.alasan).toBe('hanya_baca');
        expect(p.fiturKurang).toEqual([]);
        expect(p.catatan).toContain('tanda_tangan_tidak_cocok');
    });

    it('kode pekerjaan tak dikenal tidak menghentikan apa pun (gagal-terbuka)', () => {
        expect(putusanTerjadwal(keadaan(TANPA_WA), 'ngawur' as KodePekerjaan).boleh).toBe(true);
    });

    it('kode fitur yang dipakai memang kosakata data/paket.json', () => {
        // Salin dari `data/paket.json` di repo qendali. Kode yang dikarang di sini tidak akan
        // pernah cocok dengan kunci yang terbit, dan gejalanya "cron-nya diam tanpa alasan".
        const KOSAKATA = ['wa.cloud', 'wa.automation', 'social.inbox', 'crm.leads', 'cs.rating', 'team.leaderboard'];
        for (const [kode, aturan] of Object.entries(PEKERJAAN_TERJADWAL)) {
            expect(aturan.fitur.length).toBeGreaterThan(0);
            for (const f of aturan.fitur) expect(KOSAKATA).toContain(f);
            // `dipasangDi` bukan hiasan: itu satu-satunya cara menemukan call site-nya dari sini.
            expect(aturan.dipasangDi).toMatch(/\.ts → \w/);
            expect(aturan.nama.length).toBeGreaterThan(5);
            expect(kode).toBeTruthy();
        }
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════
describe('PenjagaTerjadwal', () => {
    it('GAGAL-TERBUKA: penjaga tidak tersuntik → pekerjaannya jalan', () => {
        // `lewatiKarenaLisensi(undefined, …)` WAJIB false. Jangan pernah menggantinya dengan
        // `!penjaga?.bolehJalan(kode)` di call site: itu terbaca sama tapi jadi gagal-TERTUTUP.
        expect(lewatiKarenaLisensi(undefined, 'wa.broadcast')).toBe(false);
    });

    it('pemeriksaan lisensinya sendiri melempar galat → penjadwal TETAP HIDUP', () => {
        const meledak = {
            keadaan: () => {
                throw new Error('simpanan lisensi rusak');
            },
        } as unknown as LisensiService;
        const p = new PenjagaTerjadwal(meledak);
        const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        try {
            expect(p.bolehJalan('wa.broadcast')).toBe(true);
            expect(lewatiKarenaLisensi(p, 'wa.broadcast')).toBe(false);
            expect(log).toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });

    it('LOG TIDAK BANJIR: 200 putaran yang dilewati tetap satu baris', () => {
        const p = penjaga(TANPA_WA);
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        try {
            for (let i = 0; i < 200; i++) expect(p.bolehJalan('wa.broadcast')).toBe(false);
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            warn.mockRestore();
        }
    });

    it('tiap pekerjaan punya baris sendiri (bukan satu baris untuk semuanya)', () => {
        const p = penjaga(TANPA_WA);
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        try {
            p.bolehJalan('wa.broadcast');
            p.bolehJalan('wa.reminder');
            p.bolehJalan('wa.broadcast');
            expect(warn).toHaveBeenCalledTimes(2);
        } finally {
            warn.mockRestore();
        }
    });

    it('alasan yang BERUBAH dicatat lagi — kalau tidak, log berhenti bercerita', () => {
        const kunci = { nilai: keadaan(TANPA_WA) };
        const p = new PenjagaTerjadwal({ keadaan: () => kunci.nilai } as unknown as LisensiService);
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        try {
            p.bolehJalan('wa.broadcast');
            kunci.nilai = keadaan(HANYA_BACA); // fitur kembali, tapi masa berlakunya habis
            p.bolehJalan('wa.broadcast');
            expect(warn).toHaveBeenCalledTimes(2);
            expect(String(warn.mock.calls[1][0])).toContain('HANYA-BACA');
        } finally {
            warn.mockRestore();
        }
    });

    it('pulih → satu baris "jalan lagi", dan sesudahnya diam', () => {
        const kunci = { nilai: keadaan(TANPA_WA) };
        const p = new PenjagaTerjadwal({ keadaan: () => kunci.nilai } as unknown as LisensiService);
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        const info = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        try {
            p.bolehJalan('wa.broadcast');
            kunci.nilai = keadaan(PUNYA_SEMUA);
            expect(p.bolehJalan('wa.broadcast')).toBe(true);
            expect(p.bolehJalan('wa.broadcast')).toBe(true);
            expect(info).toHaveBeenCalledTimes(1);
            expect(String(info.mock.calls[0][0])).toContain('jalan lagi');
        } finally {
            warn.mockRestore();
            info.mockRestore();
        }
    });

    it('putusan() tidak mencatat apa pun — aman dipanggil dari halaman/dasbor', () => {
        const p = penjaga(TANPA_WA);
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        try {
            expect(p.putusan('wa.broadcast').boleh).toBe(false);
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════
describe('penjadwal: yang dilewati TIDAK menyentuh antreannya', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
        warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it('broadcast: SCHEDULED tidak dibaca, tidak diklaim, tidak dijadikan PAUSED', async () => {
        const svc = new BroadcastService(prismaPeledak(), cloudPeledak(), penjaga(TANPA_WA));
        await expect(svc.sweepScheduled()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('broadcast: fitur lengkap → sapuannya benar-benar jalan', async () => {
        const prisma = { waBroadcast: { findMany: jest.fn().mockResolvedValue([]) } } as any;
        const svc = new BroadcastService(prisma, cloudPeledak(), penjaga(PUNYA_SEMUA));
        await svc.sweepScheduled();
        expect(prisma.waBroadcast.findMany).toHaveBeenCalledTimes(1);
    });

    it('reminder: tidak ada WaReminderLog yang ditulis (penanda dedup = FU mati selamanya)', async () => {
        const svc = new RemindersService(prismaPeledak(), cloudPeledak(), penjaga(TANPA_WA));
        await expect(svc.sweepFollowUps()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('reminder: fitur lengkap → follow-up jatuh tempo tetap disapu', async () => {
        const prisma = {
            followUp: { findMany: jest.fn().mockResolvedValue([]) },
            waReminderLog: { findMany: jest.fn().mockResolvedValue([]) },
        } as any;
        const svc = new RemindersService(prisma, cloudPeledak(), penjaga(PUNYA_SEMUA));
        await svc.sweepFollowUps();
        expect(prisma.followUp.findMany).toHaveBeenCalledTimes(1);
    });

    it('sinkron template: tanpa wa.cloud dilewati, hanya-baca TIDAK menghentikannya', async () => {
        const svcLewat = new TemplatesService(prismaPeledak(), cloudPeledak(), penjaga(TANPA_WA));
        await expect(svcLewat.autoSyncStatuses()).resolves.toBeUndefined();

        const prisma = { waChannel: { findMany: jest.fn().mockResolvedValue([]) } } as any;
        const svcJalan = new TemplatesService(prisma, cloudPeledak(), penjaga(HANYA_BACA));
        await svcJalan.autoSyncStatuses();
        expect(prisma.waChannel.findMany).toHaveBeenCalledTimes(1);
    });

    it('komentar sosial: tanpa social.inbox dilewati, hanya-baca TIDAK menghentikannya', async () => {
        const lewat = new SocialCommentsService(
            prismaPeledak(),
            {} as any,
            {} as any,
            {} as any,
            penjaga({ ditegakkan: true, paket: 'usaha', fitur: ['pos.core'] }),
        );
        await expect(lewat.autoSync()).resolves.toBeUndefined();

        const prisma = { socialChannel: { findMany: jest.fn().mockResolvedValue([]) } } as any;
        const jalan = new SocialCommentsService(prisma, {} as any, {} as any, {} as any, penjaga(HANYA_BACA));
        await jalan.autoSync();
        expect(prisma.socialChannel.findMany).toHaveBeenCalledTimes(1);
    });

    it('repeat order CRM: tanpa crm.leads, tidak ada FollowUp yang dibuat', async () => {
        const asli = process.env.CRM_REPEAT_ORDER_AUTO;
        process.env.CRM_REPEAT_ORDER_AUTO = 'on'; // dinyalakan, supaya yang diuji lisensinya
        try {
            const cron = new FollowUpsCron(
                prismaPeledak(),
                penjaga({ ditegakkan: true, paket: 'usaha', fitur: ['pos.core'] }),
            );
            await expect(cron.scheduleRepeatOrders()).resolves.toBeUndefined();
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            if (asli === undefined) delete process.env.CRM_REPEAT_ORDER_AUTO;
            else process.env.CRM_REPEAT_ORDER_AUTO = asli;
        }
    });

    it('repeat order CRM: sakelar pemilik mati → yang dicatat itu, bukan lisensinya', async () => {
        // Fitur ini mati untuk hampir semua instalasi. Kalau lisensi diperiksa lebih dulu, tiap
        // Senin log menuduh paket yang salah untuk pekerjaan yang tidak akan jalan juga.
        const asli = process.env.CRM_REPEAT_ORDER_AUTO;
        delete process.env.CRM_REPEAT_ORDER_AUTO;
        try {
            const cron = new FollowUpsCron(
                prismaPeledak(),
                penjaga({ ditegakkan: true, paket: 'usaha', fitur: ['pos.core'] }),
            );
            await expect(cron.scheduleRepeatOrders()).resolves.toBeUndefined();
            expect(warn).not.toHaveBeenCalled();
        } finally {
            if (asli !== undefined) process.env.CRM_REPEAT_ORDER_AUTO = asli;
        }
    });

    it('keenam service benar-benar MEMINTA PenjagaTerjadwal di konstruktornya', () => {
        // Separuh dari wiring. Separuh yang lain ("modulnya menyediakannya") dijaga
        // `lisensi.module.spec.ts`. Keduanya perlu: parameternya `@Optional()`, jadi kalau salah
        // satu hilang penegakannya lenyap diam-diam — tidak ada galat, tidak ada log, tidak ada
        // tes lain yang gagal. Ini tes yang gagal kalau ada yang "merapikan" konstruktornya.
        const berlisensi = [
            BroadcastService,
            RemindersService,
            TemplatesService,
            AutoReplyService,
            SocialCommentsService,
            FollowUpsCron,
        ];
        for (const kelas of berlisensi) {
            const params: unknown[] = Reflect.getMetadata('design:paramtypes', kelas) ?? [];
            expect(params).toContain(PenjagaTerjadwal);
        }
    });

    it('semua penjadwal di atas jalan seperti biasa tanpa kunci lisensi', async () => {
        const prisma = {
            waBroadcast: { findMany: jest.fn().mockResolvedValue([]) },
            followUp: { findMany: jest.fn().mockResolvedValue([]) },
            waReminderLog: { findMany: jest.fn().mockResolvedValue([]) },
            waChannel: { findMany: jest.fn().mockResolvedValue([]) },
            socialChannel: { findMany: jest.fn().mockResolvedValue([]) },
        } as any;
        const tanpaKunci = penjaga(); // ditegakkan: false
        await new BroadcastService(prisma, cloudPeledak(), tanpaKunci).sweepScheduled();
        await new RemindersService(prisma, cloudPeledak(), tanpaKunci).sweepFollowUps();
        await new TemplatesService(prisma, cloudPeledak(), tanpaKunci).autoSyncStatuses();
        await new SocialCommentsService(prisma, {} as any, {} as any, {} as any, tanpaKunci).autoSync();
        expect(prisma.waBroadcast.findMany).toHaveBeenCalled();
        expect(prisma.followUp.findMany).toHaveBeenCalled();
        expect(prisma.waChannel.findMany).toHaveBeenCalled();
        expect(prisma.socialChannel.findMany).toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════
describe('balasan otomatis WhatsApp', () => {
    const ctxMasuk = () => ({
        channel: { id: 1, phoneNumberId: 'PNID' },
        contact: { id: 7, waId: '628123', optedOut: false },
        conversationId: 3,
        body: 'harga banner berapa?',
        isNew: true,
    });

    afterEach(() => jest.restoreAllMocks());

    it('tanpa add-on WhatsApp: tidak ada balasan terkirim, tidak ada aturan dibaca', async () => {
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        const svc = new AutoReplyService(prismaPeledak(), cloudPeledak(), penjaga(TANPA_WA));
        await expect(svc.handleInbound(ctxMasuk())).resolves.toBeUndefined();
    });

    it('OPT-OUT tetap dicatat walau balasannya tidak boleh dikirim', async () => {
        // "Balas STOP" tertulis di footer template dan tidak ikut kedaluwarsa bersama langganan.
        // Yang hilang cuma pesan konfirmasinya.
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        const update = jest.fn().mockResolvedValue({});
        const cloud = { sendText: jest.fn() } as any;
        const svc = new AutoReplyService({ waContact: { update } } as any, cloud, penjaga(TANPA_WA));
        await svc.handleInbound({ ...ctxMasuk(), body: 'STOP' });
        expect(update).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][0].data.optedOut).toBe(true);
        expect(cloud.sendText).not.toHaveBeenCalled();
    });

    it('hanya-baca juga menghentikan balasan otomatis (tiap balasan ditagih Meta)', async () => {
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        const svc = new AutoReplyService(prismaPeledak(), cloudPeledak(), penjaga(HANYA_BACA));
        await expect(svc.handleInbound(ctxMasuk())).resolves.toBeUndefined();
    });

    it('fitur lengkap → mesin aturannya benar-benar dijalankan', async () => {
        const prisma = {
            waChannel: { findMany: jest.fn().mockResolvedValue([]) },
            waMessage: { findFirst: jest.fn().mockResolvedValue(null) },
            waAutoReplyRule: { findMany: jest.fn().mockResolvedValue([]) },
        } as any;
        const svc = new AutoReplyService(prisma, cloudPeledak(), penjaga(PUNYA_SEMUA));
        await svc.handleInbound(ctxMasuk());
        expect(prisma.waAutoReplyRule.findMany).toHaveBeenCalledTimes(1);
    });
});


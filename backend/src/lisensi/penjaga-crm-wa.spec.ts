/**
 * Penjagaan kode fitur di modul CRM & WhatsApp — diuji ke KELAS CONTROLLER-nya sendiri.
 *
 * Bedanya dengan `penjaga-lisensi.spec.ts`: di sana Reflector-nya dipalsukan, jadi yang diuji cuma
 * keputusan penjaganya. Di sini Reflector-nya ASLI dan metadatanya dibaca dari controller yang
 * sungguhan — persis cara Nest membacanya saat permintaan masuk. Jadi tes ini gagal kalau
 * dekoratornya hilang, pindah metode, atau kode fiturnya salah tulis. Tanpa itu, penjaganya bisa
 * sempurna tapi tidak terpasang di mana pun.
 *
 * TIGA HAL YANG PALING PENTING DI SINI:
 *
 * 1. **Webhook Meta harus tetap terbuka tanpa fitur apa pun.** WhatsApp, Messenger/Instagram, dan
 *    callback hapus-data dipanggil Meta tanpa sesi pengguna. Sekali dijawab 403, Meta menonaktifkan
 *    webhooknya dan pesan pelanggan hilang tanpa jejak — juga untuk klien yang paketnya MEMANG
 *    memuat WhatsApp. Kalau tes ini gagal, jangan diakali: cabut dekoratornya.
 * 2. **Gagal-terbuka.** Tanpa kunci lisensi semua endpoint berpenjaga tetap lewat.
 * 3. **`customers.core` tidak dijaga.** Kodenya ada di semua paket termasuk Gratis, jadi
 *    menjaganya nol gunanya dan cuma menambah kemungkinan salah.
 */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FITUR_KEY } from './butuh-fitur.decorator';
import { FiturGuard } from './fitur.guard';
import { Keadaan } from './keadaan-lisensi';
import { LisensiService } from './lisensi.service';

import { LeadsController } from '../crm/leads/leads.controller';
import { LeadSourcesController } from '../crm/leads/lead-sources.controller';
import { PublicOrdersController } from '../crm/leads/public-orders.controller';
import { FollowUpsController } from '../crm/follow-ups/follow-ups.controller';
import { TemplatesController } from '../crm/templates/templates.controller';
import { KpiPublicController } from '../crm/kpi/kpi-public.controller';
import { WhatsappCloudController } from '../whatsapp-cloud/whatsapp-cloud.controller';
import { WhatsappWebhookController } from '../whatsapp-cloud/webhook.controller';
import { WhatsappController } from '../whatsapp/whatsapp.controller';
import { MetaMessagingController } from '../meta-messaging/meta-messaging.controller';
import { SocialWebhookController } from '../meta-messaging/social-webhook.controller';
import { DataDeletionController } from '../meta-messaging/data-deletion.controller';
import { MetaAdsController } from '../meta-ads/meta-ads.controller';
import { StorefrontController } from '../storefront/storefront.controller';
import { CustomersController } from '../customers/customers.controller';

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

function lisensiPalsu(ubah: Partial<Keadaan> = {}): LisensiService {
    const keadaan: Keadaan = { ...KEADAAN_KOSONG, ...ubah };
    return {
        keadaan: () => keadaan,
        punyaFitur: (kode: string) => (keadaan.ditegakkan ? keadaan.fitur.includes(kode) : true),
    } as unknown as LisensiService;
}

/** Konteks Nest tiruan yang menunjuk ke metode & kelas controller yang SUNGGUHAN. */
const ctx = (kelas: any, metode: string) => {
    const handler = kelas.prototype?.[metode];
    if (typeof handler !== 'function') {
        throw new Error(`${kelas.name}.${metode} tidak ada — metodenya berganti nama?`);
    }
    return {
        getType: () => 'http',
        getHandler: () => handler,
        getClass: () => kelas,
        switchToHttp: () => ({ getRequest: () => ({ method: 'GET', path: '/' }) }),
    } as any;
};

const reflector = new Reflector();

/** Kode fitur yang Nest baca untuk satu metode (metode menimpa kelas, sama seperti FiturGuard). */
const kodeFitur = (kelas: any, metode: string): string[] | undefined =>
    reflector.getAllAndOverride<string[] | undefined>(FITUR_KEY, [ctx(kelas, metode).getHandler(), kelas]);

/** Penjaga dengan kunci yang memuat `fitur` saja. */
const penjaga = (fitur: string[]) =>
    new FiturGuard(reflector, lisensiPalsu({ ditegakkan: true, paket: 'uji', fitur }));

/** Penjaga instalasi tanpa kunci (Voliko & semua lingkungan pengembangan). */
const penjagaTanpaKunci = () => new FiturGuard(reflector, lisensiPalsu());

const tolakan = (g: FiturGuard, kelas: any, metode: string) => {
    try {
        g.canActivate(ctx(kelas, metode));
        throw new Error(`${kelas.name}.${metode} seharusnya ditolak`);
    } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
        return e.getResponse() as Record<string, unknown>;
    }
};

// ── Peta yang diuji ────────────────────────────────────────────────────────────────────────
// Ditulis sebagai data supaya daftarnya bisa dibaca sekali duduk dan dipakai tiga kali:
// "punya fitur → lolos", "tidak punya → 403", dan "tanpa kunci → lolos".

const DIJAGA: Array<[string, any, string, string[]]> = [
    // CRM prospek & follow-up
    ['GET /crm/leads', LeadsController, 'list', ['crm.leads']],
    ['POST /crm/leads', LeadsController, 'create', ['crm.leads']],
    ['GET /crm/leads/export', LeadsController, 'exportLeads', ['crm.leads']],
    ['GET /crm/lead-sources', LeadSourcesController, 'list', ['crm.leads']],
    ['GET /crm/follow-ups', FollowUpsController, 'list', ['crm.leads']],
    ['PATCH /crm/follow-ups/:id/done', FollowUpsController, 'markDone', ['crm.leads']],
    ['GET /crm/templates', TemplatesController, 'list', ['crm.leads']],

    // WhatsApp Cloud — inbox & perkakasnya
    ['GET /whatsapp/conversations', WhatsappCloudController, 'listConversations', ['wa.cloud']],
    ['POST /whatsapp/conversations/:id/reply', WhatsappCloudController, 'reply', ['wa.cloud']],
    ['POST /whatsapp/conversations/start', WhatsappCloudController, 'startConversation', ['wa.cloud']],
    ['GET /whatsapp/channels', WhatsappCloudController, 'listChannels', ['wa.cloud']],
    ['GET /whatsapp/templates', WhatsappCloudController, 'listTemplates', ['wa.cloud']],
    ['GET /whatsapp/catalog', WhatsappCloudController, 'listCatalog', ['wa.cloud']],
    ['GET /whatsapp/qr-links', WhatsappCloudController, 'listQrLinks', ['wa.cloud']],
    ['GET /whatsapp/quick-replies', WhatsappCloudController, 'listQuickReplies', ['wa.cloud']],
    ['GET /whatsapp/analytics', WhatsappCloudController, 'getAnalytics', ['wa.cloud']],
    ['SSE /whatsapp/stream', WhatsappCloudController, 'stream', ['wa.cloud']],

    // WhatsApp Cloud — otomatisasi (add-on yang sama, tapi kode fiturnya sendiri)
    ['GET /whatsapp/broadcasts', WhatsappCloudController, 'listBroadcasts', ['wa.cloud', 'wa.automation']],
    ['POST /whatsapp/broadcasts', WhatsappCloudController, 'createBroadcast', ['wa.cloud', 'wa.automation']],
    ['POST /whatsapp/broadcasts/:id/run', WhatsappCloudController, 'runBroadcast', ['wa.cloud', 'wa.automation']],
    ['GET /whatsapp/auto-replies', WhatsappCloudController, 'listAutoReplies', ['wa.cloud', 'wa.automation']],
    ['POST /whatsapp/auto-replies', WhatsappCloudController, 'createAutoReply', ['wa.cloud', 'wa.automation']],
    ['GET /whatsapp/reminders/config', WhatsappCloudController, 'reminderConfigs', ['wa.cloud', 'wa.automation']],
    ['POST /whatsapp/reminders/order-ready/:id', WhatsappCloudController, 'triggerOrderReady', ['wa.cloud', 'wa.automation']],

    // Inbox Instagram/Facebook & iklan Meta
    ['GET /social/conversations', MetaMessagingController, 'listConversations', ['social.inbox']],
    ['POST /social/conversations/:id/reply', MetaMessagingController, 'reply', ['social.inbox']],
    ['GET /social/comments', MetaMessagingController, 'listComments', ['social.inbox']],
    ['GET /meta-ads/overview', MetaAdsController, 'overview', ['ads.meta']],
    ['POST /meta-ads/labels', MetaAdsController, 'upsertLabel', ['ads.meta']],
];

/**
 * Yang SENGAJA dibiarkan terbuka. Tiga kelompok:
 * - webhook & callback Meta → dipanggil Meta tanpa sesi pengguna (paling gawat kalau salah);
 * - endpoint publik / token tersendiri → dipakai situs & papan TV klien;
 * - yang kode fiturnya ada di semua paket atau masih campur.
 */
const DIKECUALIKAN: Array<[string, any, string]> = [
    ['GET /whatsapp/webhook (verifikasi Meta)', WhatsappWebhookController, 'verify'],
    ['POST /whatsapp/webhook (pesan masuk)', WhatsappWebhookController, 'receive'],
    ['GET /social/webhook (verifikasi Meta)', SocialWebhookController, 'verify'],
    ['POST /social/webhook (DM & komentar masuk)', SocialWebhookController, 'receive'],
    ['POST /social/data-deletion (callback Meta)', DataDeletionController, 'request'],
    ['GET /social/data-deletion (halaman status)', DataDeletionController, 'status'],
    ['GET /storefront/leads (token situs toko)', StorefrontController, 'daftar'],
    ['POST /orders/public (form situs klien)', PublicOrdersController, 'create'],
    ['POST /crm/public/dashboard (PIN, papan TV)', KpiPublicController, 'dashboard'],
    ['GET /customers (customers.core ada di semua paket)', CustomersController, 'findAll'],
    ['GET /whatsapp/status (bot tempel-QR, bukan Cloud API)', WhatsappController, 'getStatus'],
    ['POST /whatsapp/broadcast (bot tempel-QR ke grup)', WhatsappController, 'broadcast'],
];

describe('Penjagaan CRM & WhatsApp — dekoratornya benar-benar terpasang', () => {
    it.each(DIJAGA)('%s dijaga %s', (_nama, kelas, metode, kode) => {
        expect(kodeFitur(kelas, metode)).toEqual(kode);
    });

    it('semua kode fiturnya ada di kosakata data/paket.json', () => {
        // Kalau ada kode di luar daftar ini, kunci yang terbit tidak akan pernah cocok.
        const KOSAKATA = ['crm.leads', 'wa.cloud', 'wa.automation', 'social.inbox', 'ads.meta'];
        for (const [, kelas, metode] of DIJAGA) {
            for (const kode of kodeFitur(kelas, metode) ?? []) {
                expect(KOSAKATA).toContain(kode);
            }
        }
    });

    it('otomatisasi menyebut KEDUA kodenya — siaran tanpa channel WA tidak ada artinya', () => {
        // Dekorator di metode MENIMPA dekorator kelas (getAllAndOverride), tidak menambahi.
        // Jadi `wa.cloud` harus ditulis ulang di metodenya; ini yang menjaga hal itu.
        for (const metode of ['createBroadcast', 'createAutoReply', 'reminderConfigs']) {
            expect(kodeFitur(WhatsappCloudController, metode)).toContain('wa.cloud');
            expect(kodeFitur(WhatsappCloudController, metode)).toContain('wa.automation');
        }
    });
});

describe('Penjagaan CRM & WhatsApp — keputusan penjaganya', () => {
    it.each(DIJAGA)('%s: punya fiturnya → lolos', (_nama, kelas, metode, kode) => {
        expect(penjaga(kode).canActivate(ctx(kelas, metode))).toBe(true);
    });

    it.each(DIJAGA)('%s: tidak punya fiturnya → 403 yang menyebut kodenya', (_nama, kelas, metode, kode) => {
        const isi = tolakan(penjaga(['pos.core']), kelas, metode);
        expect(isi.kode).toBe('lisensi_fitur_tidak_ada');
        expect(isi.fitur).toEqual(kode);
    });

    it.each(DIJAGA)('%s: GAGAL-TERBUKA tanpa kunci lisensi', (_nama, kelas, metode) => {
        expect(penjagaTanpaKunci().canActivate(ctx(kelas, metode))).toBe(true);
    });

    it('kunci ADA tapi daftar fiturnya kosong tetap ditolak — bukan gagal-terbuka', () => {
        // Bedanya dengan frontend: di sini daftar kosong memang berarti tidak punya apa-apa.
        // `ditegakkan: false` yang membuka semuanya, bukan panjang daftarnya.
        const isi = tolakan(penjaga([]), LeadsController, 'list');
        expect(isi.fitur).toEqual(['crm.leads']);
    });

    it('add-on WhatsApp setengah: punya wa.cloud tanpa wa.automation → inbox jalan, broadcast tidak', () => {
        const g = penjaga(['wa.cloud']);
        expect(g.canActivate(ctx(WhatsappCloudController, 'listConversations'))).toBe(true);
        expect(tolakan(g, WhatsappCloudController, 'createBroadcast').fitur).toEqual(['wa.automation']);
    });
});

describe('Yang SENGAJA tidak dijaga', () => {
    it.each(DIKECUALIKAN)('%s tidak punya @ButuhFitur', (_nama, kelas, metode) => {
        expect(kodeFitur(kelas, metode)).toBeUndefined();
    });

    it.each(DIKECUALIKAN)('%s tetap lewat walau kunci tidak memuat fitur apa pun', (_nama, kelas, metode) => {
        expect(penjaga([]).canActivate(ctx(kelas, metode))).toBe(true);
    });

    it('WEBHOOK META: tetap terbuka di kunci apa pun — pesan pelanggan tidak boleh hilang', () => {
        const webhook: Array<[any, string]> = [
            [WhatsappWebhookController, 'verify'],
            [WhatsappWebhookController, 'receive'],
            [SocialWebhookController, 'verify'],
            [SocialWebhookController, 'receive'],
            [DataDeletionController, 'request'],
        ];
        // Empat keadaan kunci sekaligus: kosong, paket Gratis, paket dengan WhatsApp, dan tanpa kunci.
        const semua = [penjaga([]), penjaga(['pos.core']), penjaga(['wa.cloud', 'wa.automation']), penjagaTanpaKunci()];
        for (const g of semua) {
            for (const [kelas, metode] of webhook) {
                expect(g.canActivate(ctx(kelas, metode))).toBe(true);
            }
        }
    });

    it('kelas webhook terpisah dari kelas yang dijaga — jangan pernah disatukan', () => {
        // Kalau suatu hari webhooknya dipindah ke dalam WhatsappCloudController, dekorator kelas
        // di sana akan ikut mengenainya dan tes di atas ini yang pertama memberi tahu.
        expect(WhatsappWebhookController).not.toBe(WhatsappCloudController);
        expect(SocialWebhookController).not.toBe(MetaMessagingController);
        expect(DataDeletionController).not.toBe(MetaMessagingController);
    });
});

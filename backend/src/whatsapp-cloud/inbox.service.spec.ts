import { InboxService } from './inbox.service';

function makePrisma(overrides: any = {}) {
    return {
        waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
        lead: { findFirst: jest.fn().mockResolvedValue(null) },
        waContact: { upsert: jest.fn().mockResolvedValue({ id: 20, leadId: null, customerId: null }) },
        waConversation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 30 }),
            update: jest.fn().mockResolvedValue({ id: 30 }),
        },
        waMessage: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 40 }),
            update: jest.fn().mockResolvedValue({ id: 40 }),
        },
        leadActivity: { create: jest.fn().mockResolvedValue({ id: 50 }) },
        waWebhookEvent: { create: jest.fn().mockResolvedValue({ id: 60 }) },
        ...overrides,
    };
}

const textPayload = (over: any = {}) => ({
    entry: [
        {
            changes: [
                {
                    field: 'messages',
                    value: {
                        metadata: { phone_number_id: 'PN1', display_phone_number: '+62 812' },
                        contacts: [{ profile: { name: 'Budi' }, wa_id: '6281234567890' }],
                        messages: [
                            { from: '6281234567890', id: 'wamid.1', type: 'text', text: { body: 'Halo' }, timestamp: '123' },
                        ],
                        ...over,
                    },
                },
            ],
        },
    ],
});

describe('InboxService.ingestWebhook', () => {
    it('pesan pertama: buat kontak, percakapan (jendela 24 jam), & pesan masuk', async () => {
        const prisma = makePrisma();
        const service = new InboxService(prisma as any, {} as any);

        await service.ingestWebhook(textPayload());

        expect(prisma.waContact.upsert).toHaveBeenCalledTimes(1);
        const upsertArg = prisma.waContact.upsert.mock.calls[0][0];
        expect(upsertArg.where).toEqual({ waId: '6281234567890' });
        expect(upsertArg.create).toMatchObject({ waId: '6281234567890', phoneNormalized: '81234567890', profileName: 'Budi' });

        expect(prisma.waConversation.create).toHaveBeenCalledTimes(1);
        const convArg = prisma.waConversation.create.mock.calls[0][0].data;
        expect(convArg).toMatchObject({ channelId: 10, contactId: 20, status: 'OPEN', unreadCount: 1 });
        const winMs = new Date(convArg.windowExpiresAt).getTime() - Date.now();
        expect(winMs).toBeGreaterThan(23 * 3600 * 1000);
        expect(winMs).toBeLessThanOrEqual(24 * 3600 * 1000 + 1000);

        expect(prisma.waMessage.create).toHaveBeenCalledTimes(1);
        expect(prisma.waMessage.create.mock.calls[0][0].data).toMatchObject({
            direction: 'INBOUND',
            type: 'TEXT',
            status: 'DELIVERED',
            body: 'Halo',
            waMessageId: 'wamid.1',
        });
        // tanpa lead/customer → tak ada aktivitas CRM
        expect(prisma.leadActivity.create).not.toHaveBeenCalled();
    });

    it('idempoten: pesan yg sudah tersimpan dilewati', async () => {
        const prisma = makePrisma();
        prisma.waMessage.findUnique.mockResolvedValue({ id: 99, waMessageId: 'wamid.1' });
        const service = new InboxService(prisma as any, {} as any);

        await service.ingestWebhook(textPayload());

        expect(prisma.waContact.upsert).not.toHaveBeenCalled();
        expect(prisma.waMessage.create).not.toHaveBeenCalled();
    });

    it('channel tak dikenal: catat error, jangan buat data', async () => {
        const prisma = makePrisma({ waChannel: { findUnique: jest.fn().mockResolvedValue(null) } });
        const service = new InboxService(prisma as any, {} as any);

        await service.ingestWebhook(textPayload());

        expect(prisma.waContact.upsert).not.toHaveBeenCalled();
        const evt = prisma.waWebhookEvent.create.mock.calls.find((c: any) => c[0].data.error);
        expect(evt[0].data.error).toMatch(/channel tak dikenal/);
    });

    it('tautan CRM: lead ditemukan → set leadId/customerId + aktivitas MESSAGE', async () => {
        const prisma = makePrisma();
        prisma.lead.findFirst.mockResolvedValue({ id: 5, convertedCustomerId: 7 });
        prisma.waContact.upsert.mockResolvedValue({ id: 20, leadId: 5, customerId: 7 });
        const service = new InboxService(prisma as any, {} as any);

        await service.ingestWebhook(textPayload());

        expect(prisma.lead.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { phoneNormalized: '81234567890' } }),
        );
        expect(prisma.leadActivity.create).toHaveBeenCalledTimes(1);
        expect(prisma.leadActivity.create.mock.calls[0][0].data).toMatchObject({
            leadId: 5,
            customerId: 7,
            kind: 'MESSAGE',
        });
    });

    it('percakapan lama yg terbuka dipakai ulang & jendela diperbarui', async () => {
        const prisma = makePrisma();
        prisma.waConversation.findFirst.mockResolvedValue({ id: 33, status: 'OPEN' });
        const service = new InboxService(prisma as any, {} as any);

        await service.ingestWebhook(textPayload());

        expect(prisma.waConversation.create).not.toHaveBeenCalled();
        expect(prisma.waConversation.update).toHaveBeenCalledTimes(1);
        expect(prisma.waConversation.update.mock.calls[0][0].data.unreadCount).toEqual({ increment: 1 });
    });

    describe('status callback', () => {
        const statusPayload = (status: string) => ({
            entry: [
                {
                    changes: [
                        {
                            value: {
                                metadata: { phone_number_id: 'PN1' },
                                statuses: [{ id: 'wamid.OUT', status, timestamp: '123', recipient_id: '628' }],
                            },
                        },
                    ],
                },
            ],
        });

        it('read → update status pesan jadi READ', async () => {
            const prisma = makePrisma();
            prisma.waMessage.findUnique.mockResolvedValue({ id: 1, waMessageId: 'wamid.OUT', status: 'DELIVERED' });
            const service = new InboxService(prisma as any, {} as any);

            await service.ingestWebhook(statusPayload('read'));

            expect(prisma.waMessage.update).toHaveBeenCalledTimes(1);
            expect(prisma.waMessage.update.mock.calls[0][0].data.status).toBe('READ');
        });

        it('tidak memundurkan status (READ lalu delivered → tak update)', async () => {
            const prisma = makePrisma();
            prisma.waMessage.findUnique.mockResolvedValue({ id: 1, waMessageId: 'wamid.OUT', status: 'READ' });
            const service = new InboxService(prisma as any, {} as any);

            await service.ingestWebhook(statusPayload('delivered'));

            expect(prisma.waMessage.update).not.toHaveBeenCalled();
        });
    });
});

describe('InboxService.replyText — guard jendela 24 jam', () => {
    const HOUR = 3600 * 1000;
    const baseConv = (windowExpiresAt: Date | null, optedOut = false) => ({
        id: 1, channelId: 10, contactId: 20, windowExpiresAt,
        channel: { phoneNumberId: 'PN1' },
        contact: { waId: '6281234567890', optedOut },
    });

    function makeReplyPrisma(conv: any) {
        return {
            waConversation: {
                findUnique: jest.fn().mockResolvedValue(conv),
                update: jest.fn().mockResolvedValue({}),
            },
            waMessage: { create: jest.fn().mockResolvedValue({ id: 77 }) },
        };
    }

    it('mengirim teks & simpan OUTBOUND saat jendela masih terbuka', async () => {
        const prisma = makeReplyPrisma(baseConv(new Date(Date.now() + 2 * HOUR)));
        const cloud = { sendText: jest.fn().mockResolvedValue({ waMessageId: 'wamid.OUT' }) };
        const service = new InboxService(prisma as any, cloud as any);

        const msg = await service.replyText(1, 99, 'Baik kak');

        expect(cloud.sendText).toHaveBeenCalledWith('PN1', '6281234567890', 'Baik kak');
        expect(prisma.waMessage.create.mock.calls[0][0].data).toMatchObject({
            direction: 'OUTBOUND', type: 'TEXT', status: 'SENT', body: 'Baik kak',
            sentById: 99, waMessageId: 'wamid.OUT',
        });
        expect(msg).toEqual({ id: 77 });
    });

    it('menolak (409) saat di luar jendela 24 jam', async () => {
        const prisma = makeReplyPrisma(baseConv(new Date(Date.now() - HOUR)));
        const cloud = { sendText: jest.fn() };
        const service = new InboxService(prisma as any, cloud as any);

        await expect(service.replyText(1, 99, 'telat')).rejects.toThrow(/24 jam|template/i);
        expect(cloud.sendText).not.toHaveBeenCalled();
    });

    it('menolak saat kontak opt-out', async () => {
        const prisma = makeReplyPrisma(baseConv(new Date(Date.now() + HOUR), true));
        const cloud = { sendText: jest.fn() };
        const service = new InboxService(prisma as any, cloud as any);

        await expect(service.replyText(1, 99, 'x')).rejects.toThrow(/opt-out/i);
        expect(cloud.sendText).not.toHaveBeenCalled();
    });

    it('replyTemplate mengirim template tanpa guard 24 jam', async () => {
        const prisma = makeReplyPrisma(baseConv(new Date(Date.now() - 10 * HOUR)));
        const cloud = { sendTemplate: jest.fn().mockResolvedValue({ waMessageId: 'wamid.TPL' }) };
        const service = new InboxService(prisma as any, cloud as any);

        const msg = await service.replyTemplate(1, 99, { name: 'followup', language: 'id' });

        expect(cloud.sendTemplate).toHaveBeenCalledWith('PN1', '6281234567890', 'followup', 'id', []);
        expect(prisma.waMessage.create.mock.calls[0][0].data).toMatchObject({
            direction: 'OUTBOUND', type: 'TEMPLATE', templateName: 'followup', sentById: 99,
        });
        expect(msg).toEqual({ id: 77 });
    });
});

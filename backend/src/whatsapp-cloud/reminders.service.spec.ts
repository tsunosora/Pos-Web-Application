import { RemindersService } from './reminders.service';

function basePrisma(over: any = {}) {
    return {
        waReminderConfig: {
            findUnique: jest.fn().mockResolvedValue({ eventType: 'ORDER_READY', enabled: true, channelId: 3, templateId: 5 }),
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({}),
        },
        waReminderLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue({}),
        },
        waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 3, phoneNumberId: 'PN1' }) },
        waTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 5, name: 'siap_ambil', language: 'id', status: 'APPROVED' }) },
        waContact: { findUnique: jest.fn().mockResolvedValue({ id: 20, optedOut: false }) },
        transaction: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, invoiceNumber: 'INV-001', customerName: 'Budi', customerPhone: '081234567890' }),
        },
        ...over,
    };
}

describe('RemindersService', () => {
    it('getConfigs mengembalikan default utk event yg belum diset', async () => {
        const prisma = basePrisma({ waReminderConfig: { findMany: jest.fn().mockResolvedValue([]) } });
        const svc = new RemindersService(prisma as any, {} as any);
        const cfgs = await svc.getConfigs();
        expect(cfgs.map((c) => c.eventType)).toEqual(['ORDER_READY', 'PAYMENT_DUE', 'FOLLOWUP_DUE']);
        expect(cfgs[0].enabled).toBe(false);
    });

    describe('sendOrderReady', () => {
        it('kirim template + log SENT saat config aktif & template APPROVED', async () => {
            const prisma = basePrisma();
            const cloud = { sendTemplate: jest.fn().mockResolvedValue({ waMessageId: 'w1' }) };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);

            expect(cloud.sendTemplate).toHaveBeenCalledWith(
                'PN1', '6281234567890', 'siap_ambil', 'id',
                [{ type: 'body', parameters: [{ type: 'text', text: 'Budi' }, { type: 'text', text: 'INV-001' }] }],
            );
            expect(prisma.waReminderLog.upsert.mock.calls.at(-1)?.[0].create.status).toBe('SENT');
        });

        it('dedup: sudah SENT → tidak kirim lagi', async () => {
            const prisma = basePrisma();
            prisma.waReminderLog.findUnique.mockResolvedValue({ status: 'SENT' });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);
            expect(cloud.sendTemplate).not.toHaveBeenCalled();
        });

        it('config nonaktif → tidak kirim', async () => {
            const prisma = basePrisma();
            prisma.waReminderConfig.findUnique.mockResolvedValue({ enabled: false, channelId: null, templateId: null });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);
            expect(cloud.sendTemplate).not.toHaveBeenCalled();
        });

        it('kontak opt-out → SKIPPED, tak kirim', async () => {
            const prisma = basePrisma();
            prisma.waContact.findUnique.mockResolvedValue({ id: 20, optedOut: true });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);
            expect(cloud.sendTemplate).not.toHaveBeenCalled();
            expect(prisma.waReminderLog.upsert.mock.calls.at(-1)?.[0].create.status).toBe('SKIPPED');
        });

        it('template belum APPROVED → SKIPPED', async () => {
            const prisma = basePrisma();
            prisma.waTemplate.findUnique.mockResolvedValue({ id: 5, name: 'x', language: 'id', status: 'PENDING' });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);
            expect(cloud.sendTemplate).not.toHaveBeenCalled();
        });

        it('transaksi tanpa nomor pelanggan → tidak apa-apa', async () => {
            const prisma = basePrisma();
            prisma.transaction.findUnique.mockResolvedValue({ id: 1, invoiceNumber: 'INV-001', customerName: null, customerPhone: null });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new RemindersService(prisma as any, cloud as any);

            await svc.sendOrderReady(1);
            expect(cloud.sendTemplate).not.toHaveBeenCalled();
        });
    });

    it('setConfig upsert by eventType', async () => {
        const prisma = basePrisma();
        const svc = new RemindersService(prisma as any, {} as any);
        await svc.setConfig('PAYMENT_DUE', { enabled: true, channelId: 3, templateId: 7 });
        expect(prisma.waReminderConfig.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { eventType: 'PAYMENT_DUE' } }),
        );
    });
});

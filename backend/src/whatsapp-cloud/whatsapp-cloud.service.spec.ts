import { Prisma } from '@prisma/client';
import { WhatsappCloudService } from './whatsapp-cloud.service';

describe('WhatsappCloudService.healthCheck', () => {
    const makePrisma = (channels: any[]) => ({
        waChannel: { findMany: jest.fn().mockResolvedValue(channels) },
    });

    it('mengembalikan ok=true dgn info nomor saat kredensial valid', async () => {
        const prisma = makePrisma([
            { id: 1, label: 'CS Pusat', phoneNumberId: 'PN1', branchId: 5 },
        ]);
        const cloud = {
            enabled: true,
            getPhoneNumberInfo: jest.fn().mockResolvedValue({ verifiedName: 'Toko', displayNumber: '+62 812' }),
        };
        const service = new WhatsappCloudService(prisma as any, cloud as any);

        const res = await service.healthCheck();

        expect(res.enabled).toBe(true);
        expect(res.channelCount).toBe(1);
        expect(res.channels[0]).toMatchObject({ id: 1, ok: true, verifiedName: 'Toko', displayNumber: '+62 812' });
        expect(prisma.waChannel.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('mengisolasi error per channel (ok=false + pesan) tanpa menggagalkan lainnya', async () => {
        const prisma = makePrisma([
            { id: 1, label: 'A', phoneNumberId: 'PN1', branchId: null },
            { id: 2, label: 'B', phoneNumberId: 'PN2', branchId: null },
        ]);
        const cloud = {
            enabled: true,
            getPhoneNumberInfo: jest
                .fn()
                .mockResolvedValueOnce({ verifiedName: 'A-ok' })
                .mockRejectedValueOnce(new Error('WhatsApp Cloud API 401: token invalid')),
        };
        const service = new WhatsappCloudService(prisma as any, cloud as any);

        const res = await service.healthCheck();

        expect(res.channels[0]).toMatchObject({ id: 1, ok: true });
        expect(res.channels[1]).toMatchObject({ id: 2, ok: false });
        expect(res.channels[1].error).toMatch(/401/);
    });

    it('channelCount 0 saat belum ada channel', async () => {
        const prisma = makePrisma([]);
        const cloud = { enabled: false, getPhoneNumberInfo: jest.fn() };
        const service = new WhatsappCloudService(prisma as any, cloud as any);

        const res = await service.healthCheck();

        expect(res.channelCount).toBe(0);
        expect(res.channels).toEqual([]);
        expect(cloud.getPhoneNumberInfo).not.toHaveBeenCalled();
    });
});

describe('WhatsappCloudService — manajemen channel', () => {
    const cloud = { enabled: true, getPhoneNumberInfo: jest.fn() };

    it('createChannel menolak field wajib kosong', async () => {
        const prisma = { waChannel: { create: jest.fn() } };
        const service = new WhatsappCloudService(prisma as any, cloud as any);
        await expect(service.createChannel({ label: '', phoneNumberId: '', wabaId: '' } as any)).rejects.toThrow(/wajib/);
        expect(prisma.waChannel.create).not.toHaveBeenCalled();
    });

    it('createChannel memetakan P2002 → 409 phone_number_id duplikat', async () => {
        const p2002 = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' } as any);
        const prisma = { waChannel: { create: jest.fn().mockRejectedValue(p2002) } };
        const service = new WhatsappCloudService(prisma as any, cloud as any);
        await expect(
            service.createChannel({ label: 'CS', phoneNumberId: 'PN1', wabaId: 'WABA1' }),
        ).rejects.toThrow(/sudah terdaftar/);
    });

    it('deleteChannel diblok bila masih ada percakapan', async () => {
        const prisma = {
            waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 1 }), delete: jest.fn() },
            waConversation: { count: jest.fn().mockResolvedValue(3) },
        };
        const service = new WhatsappCloudService(prisma as any, cloud as any);
        await expect(service.deleteChannel(1)).rejects.toThrow(/nonaktifkan/i);
        expect(prisma.waChannel.delete).not.toHaveBeenCalled();
    });

    it('deleteChannel sukses bila belum ada percakapan', async () => {
        const prisma = {
            waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 1 }), delete: jest.fn().mockResolvedValue({}) },
            waConversation: { count: jest.fn().mockResolvedValue(0) },
        };
        const service = new WhatsappCloudService(prisma as any, cloud as any);
        await expect(service.deleteChannel(1)).resolves.toEqual({ ok: true });
        expect(prisma.waChannel.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
});

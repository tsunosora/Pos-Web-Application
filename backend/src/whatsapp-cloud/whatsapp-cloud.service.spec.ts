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

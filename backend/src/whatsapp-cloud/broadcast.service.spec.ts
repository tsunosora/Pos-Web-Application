import { BroadcastService } from './broadcast.service';

describe('BroadcastService', () => {
    beforeAll(() => {
        // Hindari delay throttle nyata di test.
        jest.spyOn(BroadcastService.prototype as any, 'sleep').mockResolvedValue(undefined);
    });

    describe('buildContactWhere', () => {
        it('selalu kecualikan opt-out', () => {
            const w = new BroadcastService({} as any, {} as any).buildContactWhere();
            expect(w).toEqual({ optedOut: false });
        });
        it('onlyLinked + leadStatus', () => {
            const w = new BroadcastService({} as any, {} as any).buildContactWhere({ onlyLinked: true, leadStatus: 'CLOSED_WON' });
            expect(w.optedOut).toBe(false);
            expect(w.OR).toEqual([{ leadId: { not: null } }, { customerId: { not: null } }]);
            expect(w.lead).toEqual({ is: { status: 'CLOSED_WON' } });
        });
    });

    describe('buildComponents', () => {
        it('kosong bila tak ada variabel', () => {
            expect(new BroadcastService({} as any, {} as any).buildComponents([], { profileName: 'x' })).toEqual([]);
        });
        it('profileName + static jadi body parameters', () => {
            const comps = new BroadcastService({} as any, {} as any).buildComponents(
                [{ source: 'profileName' }, { source: 'static', value: 'Promo' }],
                { profileName: 'Budi' },
            );
            expect(comps).toEqual([{ type: 'body', parameters: [{ type: 'text', text: 'Budi' }, { type: 'text', text: 'Promo' }] }]);
        });
        it('fallback "-" bila kosong (syarat Meta)', () => {
            const comps = new BroadcastService({} as any, {} as any).buildComponents([{ source: 'profileName' }], { profileName: null });
            expect(comps[0].parameters[0].text).toBe('-');
        });
    });

    describe('create', () => {
        it('menolak template belum APPROVED', async () => {
            const prisma = {
                waTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'PENDING' }) },
                waChannel: { findUnique: jest.fn() },
            };
            const svc = new BroadcastService(prisma as any, {} as any);
            await expect(svc.create({ name: 'X', channelId: 1, templateId: 1 })).rejects.toThrow(/APPROVED/);
        });

        it('buat broadcast + recipients dari segmen', async () => {
            const prisma = {
                waTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }) },
                waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 2 }) },
                waContact: { findMany: jest.fn().mockResolvedValue([{ id: 10, waId: '628a' }, { id: 11, waId: '628b' }]) },
                waBroadcast: { create: jest.fn().mockResolvedValue({ id: 99 }) },
                waBroadcastRecipient: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
            };
            const svc = new BroadcastService(prisma as any, {} as any);
            await svc.create({ name: 'Promo', channelId: 2, templateId: 1 });

            expect(prisma.waBroadcast.create.mock.calls[0][0].data).toMatchObject({ status: 'DRAFT', totalCount: 2 });
            expect(prisma.waBroadcastRecipient.createMany.mock.calls[0][0].data).toHaveLength(2);
        });

        it('status SCHEDULED bila ada scheduledAt', async () => {
            const prisma = {
                waTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }) },
                waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 2 }) },
                waContact: { findMany: jest.fn().mockResolvedValue([]) },
                waBroadcast: { create: jest.fn().mockResolvedValue({ id: 99 }) },
                waBroadcastRecipient: { createMany: jest.fn() },
            };
            const svc = new BroadcastService(prisma as any, {} as any);
            await svc.create({ name: 'P', channelId: 2, templateId: 1, scheduledAt: '2026-08-01T10:00:00Z' });
            expect(prisma.waBroadcast.create.mock.calls[0][0].data.status).toBe('SCHEDULED');
        });
    });

    describe('process', () => {
        const fullBroadcast = { id: 99, variableMapJson: [], channel: { phoneNumberId: 'PN1' }, template: { name: 'promo', language: 'id' } };

        function makePrisma(statusSeq: string[], recipients: any[]) {
            let statusIdx = 0;
            const findFirst = jest.fn();
            recipients.forEach((r) => findFirst.mockResolvedValueOnce(r));
            findFirst.mockResolvedValue(null);
            return {
                waBroadcast: {
                    findUnique: jest.fn().mockImplementation((args: any) =>
                        args.include ? Promise.resolve(fullBroadcast) : Promise.resolve({ status: statusSeq[Math.min(statusIdx++, statusSeq.length - 1)] }),
                    ),
                    update: jest.fn().mockResolvedValue({}),
                },
                waBroadcastRecipient: {
                    findFirst,
                    update: jest.fn().mockResolvedValue({}),
                    count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0),
                },
                waContact: { findUnique: jest.fn().mockResolvedValue({ id: 10, profileName: 'Budi', optedOut: false }) },
            };
        }

        it('kirim template ke recipient PENDING lalu COMPLETED', async () => {
            const prisma = makePrisma(['RUNNING'], [{ id: 1, contactId: 10, waId: '628a', status: 'PENDING' }]);
            const cloud = { sendTemplate: jest.fn().mockResolvedValue({ waMessageId: 'wamid.1' }) };
            const svc = new BroadcastService(prisma as any, cloud as any);

            await svc.process(99);

            expect(cloud.sendTemplate).toHaveBeenCalledWith('PN1', '628a', 'promo', 'id', []);
            expect(prisma.waBroadcastRecipient.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', waMessageId: 'wamid.1' }) }),
            );
            expect(prisma.waBroadcast.update.mock.calls.at(-1)?.[0].data).toMatchObject({ status: 'COMPLETED' });
        });

        it('berhenti tanpa kirim bila status CANCELLED', async () => {
            const prisma = makePrisma(['CANCELLED'], [{ id: 1, contactId: 10, waId: '628a', status: 'PENDING' }]);
            const cloud = { sendTemplate: jest.fn() };
            const svc = new BroadcastService(prisma as any, cloud as any);

            await svc.process(99);

            expect(cloud.sendTemplate).not.toHaveBeenCalled();
        });

        it('SKIP kontak opt-out', async () => {
            const prisma = makePrisma(['RUNNING'], [{ id: 1, contactId: 10, waId: '628a', status: 'PENDING' }]);
            prisma.waContact.findUnique = jest.fn().mockResolvedValue({ id: 10, profileName: 'X', optedOut: true });
            const cloud = { sendTemplate: jest.fn() };
            const svc = new BroadcastService(prisma as any, cloud as any);

            await svc.process(99);

            expect(cloud.sendTemplate).not.toHaveBeenCalled();
            expect(prisma.waBroadcastRecipient.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
            );
        });
    });
});

import { TemplatesService, normalizeTemplateName } from './templates.service';

describe('normalizeTemplateName', () => {
    it('jadikan huruf kecil + underscore, buang simbol', () => {
        expect(normalizeTemplateName('Follow Up Lead!')).toBe('follow_up_lead');
        expect(normalizeTemplateName('  Promo-Akhir Tahun  ')).toBe('promoakhir_tahun');
    });
});

describe('TemplatesService', () => {
    const svc = () => new TemplatesService({} as any, {} as any);

    describe('buildComponents', () => {
        it('body saja tanpa contoh variabel', () => {
            const comps = svc().buildComponents({
                bodyText: 'Halo kak', headerText: null, footerText: null, buttonsJson: null, variableSample: null,
            });
            expect(comps).toEqual([{ type: 'BODY', text: 'Halo kak' }]);
        });

        it('header + body(contoh variabel) + footer + buttons', () => {
            const comps = svc().buildComponents({
                bodyText: 'Hai {{1}}, pesanan {{2}} siap',
                headerText: 'Notifikasi',
                footerText: 'PosPro',
                buttonsJson: [{ type: 'QUICK_REPLY', text: 'OK' }],
                variableSample: ['Budi', 'INV-001'],
            });
            expect(comps[0]).toEqual({ type: 'HEADER', format: 'TEXT', text: 'Notifikasi' });
            expect(comps[1]).toMatchObject({ type: 'BODY', text: 'Hai {{1}}, pesanan {{2}} siap', example: { body_text: [['Budi', 'INV-001']] } });
            expect(comps[2]).toEqual({ type: 'FOOTER', text: 'PosPro' });
            expect(comps[3]).toEqual({ type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'OK' }] });
        });
    });

    describe('submit', () => {
        it('kirim ke WABA channel & set status PENDING + metaTemplateId', async () => {
            const template = { id: 1, name: 'followup', language: 'id', category: 'UTILITY', bodyText: 'Hai', headerText: null, footerText: null, buttonsJson: null, variableSample: null };
            const prisma = {
                waTemplate: { findUnique: jest.fn().mockResolvedValue(template), update: jest.fn().mockResolvedValue({ ...template, status: 'PENDING' }) },
                waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 3, wabaId: 'WABA9' }) },
            };
            const cloud = { createTemplate: jest.fn().mockResolvedValue({ id: 'MTID', status: 'PENDING', category: 'UTILITY' }) };
            const service = new TemplatesService(prisma as any, cloud as any);

            await service.submit(1, 3);

            expect(cloud.createTemplate).toHaveBeenCalledWith('WABA9', expect.objectContaining({ name: 'followup', language: 'id' }));
            expect(prisma.waTemplate.update.mock.calls[0][0].data).toMatchObject({ status: 'PENDING', metaTemplateId: 'MTID', submittedWabaId: 'WABA9' });
        });
    });

    describe('syncFromMeta', () => {
        it('memetakan status Meta ke enum & meng-update by name+language', async () => {
            const prisma = {
                waChannel: { findUnique: jest.fn().mockResolvedValue({ id: 3, wabaId: 'WABA9' }) },
                waTemplate: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            };
            const cloud = {
                listTemplates: jest.fn().mockResolvedValue([
                    { name: 'followup', language: 'id', status: 'APPROVED', id: 'M1' },
                    { name: 'promo', language: 'id', status: 'REJECTED', rejected_reason: 'ISI', id: 'M2' },
                ]),
            };
            const service = new TemplatesService(prisma as any, cloud as any);

            const res = await service.syncFromMeta(3);

            expect(res).toEqual({ fetched: 2, updated: 2 });
            expect(prisma.waTemplate.updateMany.mock.calls[0][0]).toMatchObject({
                where: { name: 'followup', language: 'id' }, data: { status: 'APPROVED' },
            });
            expect(prisma.waTemplate.updateMany.mock.calls[1][0].data).toMatchObject({ status: 'REJECTED', rejectedReason: 'ISI' });
        });
    });
});

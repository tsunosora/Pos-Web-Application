import { BadRequestException } from '@nestjs/common';
import { LeadSourcesService } from './lead-sources.service';

/**
 * Regresi bug "penumpukan sumber lead": "instagram" / "Instagram" / "INSTAGRAM"
 * harus memetakan ke normalizedName yang SAMA sehingga upsert mengenai baris yang
 * sama (dedup case-insensitive + spasi berlebih dirapikan).
 */
describe('LeadSourcesService.upsert (dedup sumber lead)', () => {
    let prisma: { leadSourceOption: { upsert: jest.Mock } };
    let service: LeadSourcesService;

    beforeEach(() => {
        prisma = { leadSourceOption: { upsert: jest.fn().mockResolvedValue({ id: 1 }) } };
        service = new LeadSourcesService(prisma as any);
    });

    it.each([
        ['instagram', 'instagram'],
        ['Instagram', 'instagram'],
        ['INSTAGRAM', 'instagram'],
        ['  Brosur   Pameran  ', 'brosur pameran'],
    ])('normalisasi %p → %p (kunci dedup sama)', async (input, expectedNorm) => {
        await service.upsert(input);
        expect(prisma.leadSourceOption.upsert).toHaveBeenCalledTimes(1);
        const arg = prisma.leadSourceOption.upsert.mock.calls[0][0];
        expect(arg.where.normalizedName).toBe(expectedNorm);
        // create menyimpan nama tampilan yang sudah di-trim + rapikan spasi (casing dipertahankan)
        expect(arg.create.normalizedName).toBe(expectedNorm);
        expect(arg.create.name).toBe(input.trim().replace(/\s+/g, ' '));
        // update hanya menaikkan pemakaian, tidak menimpa nama tampilan lama
        expect(arg.update).toEqual({ usageCount: { increment: 1 } });
    });

    it('menolak nama kosong / hanya spasi', async () => {
        await expect(service.upsert('   ')).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.upsert('')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.leadSourceOption.upsert).not.toHaveBeenCalled();
    });
});

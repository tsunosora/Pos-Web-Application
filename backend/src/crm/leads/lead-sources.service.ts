import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Master data sumber lead "CUSTOM" (mis. "Shopee", "Brosur Pameran").
 * Dedup case-insensitive lewat normalizedName supaya "instagram"/"Instagram"/
 * "INSTAGRAM" tidak menumpuk jadi baris berbeda. Global (lintas cabang & CS).
 */
@Injectable()
export class LeadSourcesService {
    constructor(private readonly prisma: PrismaService) {}

    /** Kunci dedup: buang spasi berlebih + lowercase. */
    private normalize(name: string): string {
        return name.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    /** Daftar sumber tersimpan — yang paling sering dipakai di atas. */
    list() {
        return this.prisma.leadSourceOption.findMany({
            orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        });
    }

    /**
     * Simpan/pakai sebuah sumber. Kalau normalized-nya sudah ada → pakai baris
     * itu (hanya naikkan usageCount, casing lama dipertahankan). Kalau baru →
     * buat. Idempoten terhadap variasi huruf besar/kecil.
     */
    async upsert(rawName: string) {
        const name = (rawName ?? '').trim().replace(/\s+/g, ' ');
        if (!name) throw new BadRequestException('Nama sumber tidak boleh kosong.');
        if (name.length > 150) throw new BadRequestException('Nama sumber maksimal 150 karakter.');
        const normalizedName = this.normalize(name);

        return this.prisma.leadSourceOption.upsert({
            where: { normalizedName },
            // update: pertahankan nama tampilan lama (casing pertama), cukup bump pemakaian
            update: { usageCount: { increment: 1 } },
            create: { name, normalizedName, usageCount: 1 },
        });
    }
}

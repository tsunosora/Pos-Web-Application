import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Banding tanpa membocorkan isi lewat lama waktu eksekusi. */
function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}

/**
 * Cocokkan PIN kandidat terhadap daftar PIN milik satu orang.
 * Murni (tanpa Prisma) supaya bisa diuji langsung.
 */
export function pinMatches(pins: string[], candidate: string): boolean {
    const c = candidate.trim();
    if (!c) return false;
    // Jangan hentikan perulangan di kecocokan pertama — waktu eksekusi tetap seragam.
    let ok = false;
    for (const p of pins) {
        if (p && safeEqual(p, c)) ok = true;
    }
    return ok;
}

/**
 * Verifikasi PIN desainer (Pengaturan → Desainer) untuk aplikasi HR.
 *
 * PIN di sini memang dipakai orangnya sehari-hari di halaman ber-PIN
 * (/so-designer, /produksi, /cetak), jadi aplikasi HR boleh menerimanya juga
 * agar karyawan tidak perlu mengingat dua PIN.
 *
 * Endpoint ini HANYA menjawab benar/salah — nilai PIN tidak pernah dikirim keluar.
 */
@Injectable()
export class StaffPinService {
    constructor(private readonly prisma: PrismaService) { }

    private async pinsOf(userId: number): Promise<string[]> {
        const rows = await this.prisma.designer.findMany({
            where: { userId, isActive: true },
            select: { pin: true },
        });
        return rows.map((r) => r.pin).filter((p): p is string => Boolean(p));
    }

    /** Apakah user ini punya PIN desainer yang bisa dipakai? */
    async hasPin(userId: number): Promise<{ hasPin: boolean }> {
        return { hasPin: (await this.pinsOf(userId)).length > 0 };
    }

    /** Benar/salah saja — tidak pernah mengembalikan PIN-nya. */
    async verify(userId: number, pin: string): Promise<{ ok: boolean }> {
        return { ok: pinMatches(await this.pinsOf(userId), pin) };
    }
}

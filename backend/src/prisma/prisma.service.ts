import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            // Batas transaksi interaktif ($transaction(async tx => ...)). Default Prisma
            // terlalu pendek (maxWait 2s / timeout 5s) → saat ramai / ada lock sesaat,
            // transaksi ke-abort ("transaction expired") walau kerjanya wajar. Dinaikkan
            // agar checkout/pelunasan tetap selesai di beban tinggi (mis. menuju 1000+ chat).
            transactionOptions: {
                maxWait: 20_000,  // tunggu slot mulai transaksi maks 20 dtk
                // 19 Sep 2026: penyimpanan host melambat drastis (fsync ±1,6 dtk,
                // disk 100% sibuk) → checkout gagal "transaction expired" di batas
                // 20 dtk padahal kerjanya wajar. Dinaikkan supaya nota tetap
                // TERSIMPAN (lambat) alih-alih hilang. Normal: transaksi <1 dtk.
                timeout: 90_000,
            },
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}

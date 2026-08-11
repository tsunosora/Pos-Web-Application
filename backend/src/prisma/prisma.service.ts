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
                maxWait: 10_000,  // tunggu slot mulai transaksi maks 10 dtk
                timeout: 20_000,  // batas jalannya transaksi 20 dtk
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

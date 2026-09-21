import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Kolom yang boleh diubah lewat PATCH /settings = yang dikirim halaman Pengaturan
// (Umum, Login & Tema, Notifikasi). Kolom lain (rclone*, jejak cadangan, dll.) diabaikan.
// Nilai = panjang maksimum teks.
const TEXT_FIELDS: Record<string, number> = {
    storeName: 200, storePhone: 50, storeAddress: 5000, receiptDefaultFormat: 20,
    operatorPin: 10, marketingPin: 10,
    loginBgImages: 60000, loginTaglines: 60000, loginLogoUrl: 2000,
    themeMode: 20, themePrimaryColor: 20, themeSecondaryColor: 20, themeGradientDirection: 20,
    shiftReminderTime: 5, shiftReminderTime2: 5,
    discordWebhookUrl: 2000, githubWebhookSecret: 200,
};
const BOOL_FIELDS = [
    'enableAdvancedPricing', 'enableTax', 'notifyNewTransaction', 'notifyLowStock',
    'notifyOfflineSync', 'notifyShiftReminder', 'notifyGithubCommit',
];
// Rahasia integrasi: hanya owner yang boleh mengganti (selain owner diabaikan diam-diam).
const OWNER_ONLY_FIELDS = new Set(['discordWebhookUrl', 'githubWebhookSecret']);

/** Saring & validasi isian PATCH /settings. */
export function pickSettingsUpdate(data: any, opts: { isOwner: boolean }): Record<string, any> {
    const src = data && typeof data === 'object' ? data : {};
    const out: Record<string, any> = {};
    const salah = (f: string) => new BadRequestException(`Isian ${f} tidak valid.`);
    for (const [f, max] of Object.entries(TEXT_FIELDS)) {
        if (src[f] === undefined) continue;
        if (OWNER_ONLY_FIELDS.has(f) && !opts.isOwner) continue;
        const v = src[f];
        if (v === null) {
            if (f === 'storeName') throw salah(f);
            out[f] = null;
            continue;
        }
        if (typeof v !== 'string' || v.length > max) throw salah(f);
        if (f === 'storeName' && !v.trim()) throw new BadRequestException('Nama toko wajib diisi.');
        out[f] = v;
    }
    for (const f of BOOL_FIELDS) {
        if (src[f] === undefined) continue;
        if (typeof src[f] !== 'boolean') throw salah(f);
        out[f] = src[f];
    }
    if (src.taxRate !== undefined) {
        const t = typeof src.taxRate === 'string' && src.taxRate.trim() !== '' ? Number(src.taxRate) : src.taxRate;
        if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 100) {
            throw new BadRequestException('Tarif pajak harus angka 0–100.');
        }
        out.taxRate = t;
    }
    if (src.lowStockThreshold !== undefined) {
        const n = Number(src.lowStockThreshold);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw salah('lowStockThreshold');
        out.lowStockThreshold = n;
    }
    return out;
}

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    async getSettings() {
        let settings = await this.prisma.storeSettings.findFirst();
        if (!settings) {
            settings = await this.prisma.storeSettings.create({
                data: {
                    storeName: 'PosPro',
                    storeAddress: '',
                },
            });
        }
        return settings;
    }

    async updateSettings(data: any, opts: { isOwner: boolean } = { isOwner: false }) {
        const clean = pickSettingsUpdate(data, opts);
        const settings = await this.getSettings();
        return this.prisma.storeSettings.update({
            where: { id: settings.id },
            data: clean,
        });
    }

    async updateQrisImage(imageUrl: string) {
        const settings = await this.getSettings();
        return this.prisma.storeSettings.update({
            where: { id: settings.id },
            data: { qrisImageUrl: imageUrl },
        });
    }

    async updateLogoImage(imageUrl: string) {
        const settings = await this.getSettings();
        return this.prisma.storeSettings.update({
            where: { id: settings.id },
            data: { logoImageUrl: imageUrl },
        });
    }

    async updateLoginLogo(imageUrl: string | null) {
        const settings = await this.getSettings();
        return this.prisma.storeSettings.update({
            where: { id: settings.id },
            data: { loginLogoUrl: imageUrl } as any,
        });
    }

    async getPublicSettings() {
        const s = await this.getSettings() as any;
        return {
            storeName: s.storeName,
            storePhone: s.storePhone ?? null,
            // Dipakai halaman publik Kebijakan Privasi & Penghapusan Data (syarat Meta).
            storeAddress: s.storeAddress ?? null,
            logoImageUrl: s.logoImageUrl ?? null,
            loginLogoUrl: s.loginLogoUrl ?? null,
            loginBgImages: s.loginBgImages ? JSON.parse(s.loginBgImages) : [],
            loginTaglines: s.loginTaglines ? JSON.parse(s.loginTaglines) : [],
            theme: {
                mode: s.themeMode ?? 'SOLID',
                primaryColor: s.themePrimaryColor ?? '#4F46E5',
                secondaryColor: s.themeSecondaryColor ?? '#7C3AED',
                gradientDirection: s.themeGradientDirection ?? '135deg',
            },
        };
    }
}

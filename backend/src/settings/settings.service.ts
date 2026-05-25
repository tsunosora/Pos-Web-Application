import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    async updateSettings(data: any) {
        const settings = await this.getSettings();
        return this.prisma.storeSettings.update({
            where: { id: settings.id },
            data,
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

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
}

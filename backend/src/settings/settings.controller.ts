import { Controller, Get, Patch, Post, Body, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, isManagerLevelRole, isOwnerLevelRole } from '../auth/role-groups';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { compressImage } from '../common/utils/compress-image.util';
import { assertRealImage, safeImageExt, safeImageFilter } from '../common/utils/safe-image-upload.util';

const randomHex = () => Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');

// Kolom rahasia pengaturan toko: hanya untuk owner/admin/manajer. Staf lain tetap
// perlu GET /settings (nama toko, pajak, tema, dll.), tapi tidak boleh membaca PIN
// papan kerja, URL webhook, atau tujuan cadangan.
const SECRET_FIELDS = ['operatorPin', 'marketingPin', 'discordWebhookUrl', 'githubWebhookSecret', 'rcloneRemote'] as const;
const OWNER_ONLY_FIELDS = ['discordWebhookUrl', 'githubWebhookSecret', 'rcloneRemote'] as const;

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('public')
    getPublicSettings() {
        return this.settingsService.getPublicSettings();
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getSettings(@Req() req: any) {
        const s: any = await this.settingsService.getSettings();
        if (!s || isOwnerLevelRole(req.user?.roleName)) return s;
        const aman = { ...s };
        // Manajer tetap melihat PIN papan (mereka yang mengelolanya); webhook & tujuan cadangan
        // hanya owner — sama dengan aturan simpannya (peran Admin kasir/CS setingkat manajer).
        const sembunyikan = isManagerLevelRole(req.user?.roleName) ? OWNER_ONLY_FIELDS : SECRET_FIELDS;
        for (const f of sembunyikan) if (f in aman) aman[f] = null;
        return aman;
    }

    // Mengubah pengaturan toko (nama toko di nota, pajak, mode harga, logo, QRIS)
    // hanya setingkat manajer (T-45). Kolom disaring di service; webhook & rahasia
    // integrasi hanya owner.
    @Patch()
    @UseGuards(JwtAuthGuard, ManagerGuard)
    updateSettings(@Body() data: any, @Req() req: any) {
        return this.settingsService.updateSettings(data, { isOwner: isOwnerLevelRole(req.user?.roleName) });
    }

    @Post('upload-qris')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `${randomHex()}${safeImageExt(file.mimetype) ?? '.png'}`),
        }),
        fileFilter: safeImageFilter, // gambar saja (dulu SVG/HTML berlabel gambar ikut tersimpan)
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }))
    async uploadQrisImage(@UploadedFile() file: Express.Multer.File) {
        await assertRealImage(file.path);
        await compressImage(file.path);
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateQrisImage(fileUrl);
        return { url: fileUrl };
    }

    @Post('upload-logo')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `${randomHex()}${safeImageExt(file.mimetype) ?? '.png'}`),
        }),
        fileFilter: safeImageFilter, // gambar saja (dulu SVG/HTML berlabel gambar ikut tersimpan)
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }))
    async uploadLogoImage(@UploadedFile() file: Express.Multer.File) {
        await assertRealImage(file.path);
        await compressImage(file.path);
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateLogoImage(fileUrl);
        return { url: fileUrl };
    }

    @Post('upload-login-bg')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `loginbg_${randomHex()}${safeImageExt(file.mimetype) ?? '.png'}`),
        }),
        fileFilter: safeImageFilter, // gambar saja (dulu SVG/HTML berlabel gambar ikut tersimpan)
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }))
    async uploadLoginBgImage(@UploadedFile() file: Express.Multer.File) {
        await assertRealImage(file.path);
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }

    /** Upload login logo (centerpiece di login page, replace animasi Voliko). */
    @Post('upload-login-logo')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `loginlogo_${randomHex()}${safeImageExt(file.mimetype) ?? '.png'}`),
        }),
        fileFilter: safeImageFilter, // gambar saja (dulu SVG/HTML berlabel gambar ikut tersimpan)
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }))
    async uploadLoginLogo(@UploadedFile() file: Express.Multer.File) {
        // SVG tidak lagi diterima (bisa berisi skrip) — hanya gambar raster.
        await assertRealImage(file.path);
        await compressImage(file.path);
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateLoginLogo(fileUrl);
        return { url: fileUrl };
    }
}

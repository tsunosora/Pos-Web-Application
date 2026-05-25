import { Controller, Get, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { compressImage } from '../common/utils/compress-image.util';

const randomHex = () => Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('public')
    getPublicSettings() {
        return this.settingsService.getPublicSettings();
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    getSettings() {
        return this.settingsService.getSettings();
    }

    @Patch()
    @UseGuards(JwtAuthGuard)
    updateSettings(@Body() data: any) {
        return this.settingsService.updateSettings(data);
    }

    @Post('upload-qris')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `${randomHex()}${extname(file.originalname)}`),
        })
    }))
    async uploadQrisImage(@UploadedFile() file: Express.Multer.File) {
        await compressImage(file.path);
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateQrisImage(fileUrl);
        return { url: fileUrl };
    }

    @Post('upload-logo')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `${randomHex()}${extname(file.originalname)}`),
        })
    }))
    async uploadLogoImage(@UploadedFile() file: Express.Multer.File) {
        await compressImage(file.path);
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateLogoImage(fileUrl);
        return { url: fileUrl };
    }

    @Post('upload-login-bg')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `loginbg_${randomHex()}${extname(file.originalname)}`),
        })
    }))
    async uploadLoginBgImage(@UploadedFile() file: Express.Multer.File) {
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }

    /** Upload login logo (centerpiece di login page, replace animasi Voliko). */
    @Post('upload-login-logo')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => cb(null, `loginlogo_${randomHex()}${extname(file.originalname)}`),
        })
    }))
    async uploadLoginLogo(@UploadedFile() file: Express.Multer.File) {
        // SVG tidak di-compress (vector preserved); raster image (jpg/png) di-compress
        const ext = extname(file.originalname || '').toLowerCase();
        if (ext !== '.svg') {
            await compressImage(file.path);
        }
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateLoginLogo(fileUrl);
        return { url: fileUrl };
    }
}

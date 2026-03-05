import { Controller, Get, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    getSettings() {
        return this.settingsService.getSettings();
    }

    @Patch()
    updateSettings(@Body() data: any) {
        return this.settingsService.updateSettings(data);
    }

    @Post('upload-qris')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    }))
    async uploadQrisImage(@UploadedFile() file: Express.Multer.File) {
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateQrisImage(fileUrl);
        return { url: fileUrl };
    }

    @Post('upload-logo')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: './public/uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    }))
    async uploadLogoImage(@UploadedFile() file: Express.Multer.File) {
        const fileUrl = `/uploads/${file.filename}`;
        await this.settingsService.updateLogoImage(fileUrl);
        return { url: fileUrl };
    }
}

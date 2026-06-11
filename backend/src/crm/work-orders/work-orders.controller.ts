import {
    BadRequestException,
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req,
    UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UpsertWorkOrderDto, WorkOrdersService } from './work-orders.service';
import { compressImage } from '../../common/utils/compress-image.util';

const WO_IMG_DIR = './public/uploads';
try { fs.mkdirSync(WO_IMG_DIR, { recursive: true }); } catch { /* ignore */ }
const randomHex = () => Array(32).fill(null).map(() => Math.round(Math.random() * 16).toString(16)).join('');

@UseGuards(JwtAuthGuard)
@Controller('work-orders')
export class WorkOrdersController {
    constructor(private readonly wo: WorkOrdersService) {}

    /** Upload gambar (mockup / pola print) — return URL relatif. */
    @Post('upload')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: WO_IMG_DIR,
            filename: (_req, file, cb) => cb(null, `wo_${randomHex()}${extname(file.originalname || '.jpg')}`),
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async upload(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File gambar wajib diisi');
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }

    /** Get WO untuk job tertentu — return null kalau belum ada. */
    @Get('job/:jobId')
    getByJob(@Param('jobId', ParseIntPipe) jobId: number) {
        return this.wo.getByJob(jobId);
    }

    /** Opsi dropdown kerah & bahan (default + nilai custom yang pernah disimpan). */
    @Get('options')
    getOptions() {
        return this.wo.getOptions();
    }

    @Get(':id')
    getOne(@Param('id', ParseIntPipe) id: number) {
        return this.wo.getOne(id);
    }

    @Post()
    create(@Body() data: UpsertWorkOrderDto, @Req() req: any) {
        return this.wo.create(data, req?.user?.id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: UpsertWorkOrderDto, @Req() req: any) {
        return this.wo.update(id, data, req?.user?.id);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.wo.remove(id);
    }
}

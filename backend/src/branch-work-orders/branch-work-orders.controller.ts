import {
    Controller, Get, Post, Patch, Param, Body, Query,
    ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../auth/role-groups';
import { BranchWorkOrdersService } from './branch-work-orders.service';
import type { CreateBranchWODto } from './branch-work-orders.service';
import { compressImage } from '../common/utils/compress-image.util';
import { safeImageExt, safeImageFilter } from '../common/utils/safe-image-upload.util';

const proofStorage = diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'public', 'uploads', 'branch-proofs');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        cb(null, `branch-proof-${Date.now()}${safeImageExt(file.mimetype) ?? '.jpg'}`); // ekstensi dari tipe gambar, bukan nama kiriman
    },
});

// Menu "Order Cabang" saja (dulu cukup login: akun mana pun bisa membatalkan/menyelesaikan
// order & mengganti foto bukti — foto lama ikut terhapus).
@UseGuards(JwtAuthGuard, MenuGuard)
@Menu('/branch-orders')
@Controller('branch-work-orders')
export class BranchWorkOrdersController {
    constructor(private readonly service: BranchWorkOrdersService) {}

    @Get('summary')
    getSummary(
        @Query('branchId') branchId?: string,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        return this.service.getSummary({
            branchId: branchId ? Number(branchId) : undefined,
            year: year ? Number(year) : new Date().getFullYear(),
            month: month ? Number(month) : undefined,
        });
    }

    @Get()
    list(
        @Query('branchId') branchId?: string,
        @Query('status') status?: string,
        @Query('month') month?: string,
    ) {
        return this.service.list({
            branchId: branchId ? Number(branchId) : undefined,
            status: status || undefined,
            month: month || undefined,
        });
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Post()
    create(@Body() body: CreateBranchWODto) {
        return this.service.create(body);
    }

    @Post(':id/proof')
    @UseInterceptors(FileInterceptor('file', { storage: proofStorage, fileFilter: safeImageFilter, limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
    async uploadProof(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new Error('File tidak ditemukan');
        await compressImage(file.path);
        const relativePath = `/uploads/branch-proofs/${file.filename}`;
        return this.service.setProof(id, relativePath);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { status: string; cancelReason?: string },
    ) {
        return this.service.updateStatus(id, body.status, body.cancelReason);
    }

    @Patch(':id/items/:itemId/toggle')
    toggleItemDone(
        @Param('id', ParseIntPipe) id: number,
        @Param('itemId', ParseIntPipe) itemId: number,
    ) {
        return this.service.toggleItemDone(id, itemId);
    }
}

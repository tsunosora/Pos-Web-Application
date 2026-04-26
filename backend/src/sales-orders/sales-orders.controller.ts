import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query,
    ParseIntPipe, UseGuards, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesOrdersService } from './sales-orders.service';
import type { CreateSalesOrderDto, SalesOrderStatus, UpdateSalesOrderDto } from './sales-orders.service';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

// Pastikan folder upload ada — multer tidak auto-create
const PROOF_DIR = './public/uploads/so-proofs';
try { fs.mkdirSync(PROOF_DIR, { recursive: true }); } catch { /* ignore */ }

// Map mimetype → ekstensi (kalau file dari paste/clipboard, name biasanya kosong/tanpa ekstensi)
function extFromMime(mime: string | null | undefined): string {
    switch ((mime || '').toLowerCase()) {
        case 'image/png': return '.png';
        case 'image/jpeg': case 'image/jpg': return '.jpg';
        case 'image/gif': return '.gif';
        case 'image/webp': return '.webp';
        case 'image/bmp': return '.bmp';
        case 'image/svg+xml': return '.svg';
        default: return '';
    }
}

const proofStorage = diskStorage({
    destination: PROOF_DIR,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        let ext = extname(file.originalname || '').toLowerCase();
        if (!ext) ext = extFromMime(file.mimetype); // paste/clipboard fallback
        if (!ext) ext = '.png';
        cb(null, `so-proof-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    // Terima kalau MIME type image/* (paling reliable untuk paste/clipboard)
    if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    // Fallback: cek ekstensi nama file
    if (file.originalname && file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg)$/)) {
        return cb(null, true);
    }
    return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
};

@UseGuards(JwtAuthGuard)
@Controller('sales-orders')
export class SalesOrdersController {
    constructor(private readonly service: SalesOrdersService) {}

    @Get()
    list(@Query('status') status?: SalesOrderStatus, @Query('search') search?: string) {
        return this.service.list(status, search);
    }

    @Get('pending-invoice-count')
    pendingInvoiceCount() {
        return this.service.pendingInvoiceCount();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Post()
    create(@Body() body: CreateSalesOrderDto, @CurrentBranch() ctx: BranchContext) {
        // Auto-tag branchName dari cabang aktif user kalau belum di-set di body.
        return this.service.create(body, ctx.branchId);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSalesOrderDto) {
        return this.service.update(id, body);
    }

    @Post(':id/proofs')
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: proofStorage,
            fileFilter: imageFilter,
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
        }),
    )
    async addProofs(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('captions') captionsRaw?: string | string[],
    ) {
        let captions: string[] | undefined;
        if (Array.isArray(captionsRaw)) captions = captionsRaw;
        else if (typeof captionsRaw === 'string') {
            try { captions = JSON.parse(captionsRaw); } catch { captions = [captionsRaw]; }
        }
        return this.service.addProofs(id, files || [], captions);
    }

    @Delete(':id/proofs/:proofId')
    removeProof(
        @Param('id', ParseIntPipe) id: number,
        @Param('proofId', ParseIntPipe) proofId: number,
    ) {
        return this.service.removeProof(id, proofId);
    }

    @Post(':id/send-wa')
    sendWa(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { message?: string },
        @CurrentBranch() ctx: BranchContext,
    ) {
        return this.service.sendToWhatsappGroup(id, body?.message, ctx.branchId);
    }

    @Post(':id/cancel')
    cancel(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
        return this.service.markCancelled(id, body?.reason || '');
    }
}

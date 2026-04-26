/**
 * Sales Order — public endpoints untuk desainer (no JWT).
 * Setiap request harus menyertakan { designerId, pin } untuk verifikasi.
 */
import {
    Controller, Get, Post, Delete, Body, Param, ParseIntPipe,
    UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { SalesOrdersService } from './sales-orders.service';
import { DesignersService } from '../designers/designers.service';
import type { CreateSalesOrderPayload } from './sales-orders-public.types';

const PROOF_DIR = './public/uploads/so-proofs';
try { fs.mkdirSync(PROOF_DIR, { recursive: true }); } catch { /* ignore */ }

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
        if (!ext) ext = extFromMime(file.mimetype);
        if (!ext) ext = '.png';
        cb(null, `so-proof-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    if (file.originalname && file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg)$/)) {
        return cb(null, true);
    }
    return cb(new BadRequestException('Hanya file gambar'), false);
};

async function verifyDesigner(designers: DesignersService, id: number, pin: string) {
    const result = await designers.verifyPin(id, pin);
    if (!result.valid) throw new BadRequestException('PIN desainer tidak valid');
    return result;
}

@Controller('sales-orders/designer')
export class SalesOrdersPublicController {
    constructor(
        private readonly soService: SalesOrdersService,
        private readonly designersService: DesignersService,
    ) {}

    /** Daftar SO milik desainer ini — POST supaya PIN bisa di body */
    @Post('my-list')
    async mySOs(@Body() body: { designerId: number; pin: string }) {
        const result = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.list(undefined, undefined, result.name);
    }

    /** Detail SO (hanya baca, tanpa PIN) */
    @Get('detail/:id')
    async detail(@Param('id', ParseIntPipe) id: number) {
        return this.soService.findOne(id);
    }

    /** Buat SO baru */
    @Post()
    async create(@Body() body: { designerId: number; pin: string } & CreateSalesOrderPayload) {
        const { designerId, pin, ...soData } = body;
        const designer = await verifyDesigner(this.designersService, Number(designerId), pin);
        return this.soService.create({
            ...soData,
            designerName: designer.name!,       // gunakan nama yang terdaftar
            branchName: designer.branchName ?? undefined, // auto-tag cabang dari profil desainer
        });
    }

    /** Upload proof gambar */
    @Post(':id/proofs')
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: proofStorage,
            fileFilter: imageFilter,
            limits: { fileSize: 10 * 1024 * 1024 },
        }),
    )
    async addProofs(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('designerId') designerIdRaw: string,
        @Body('pin') pin: string,
        @Body('captions') captionsRaw?: string,
    ) {
        await verifyDesigner(this.designersService, Number(designerIdRaw), pin);
        let captions: string[] | undefined;
        if (captionsRaw) {
            try { captions = JSON.parse(captionsRaw); } catch { captions = [captionsRaw]; }
        }
        return this.soService.addProofs(id, files || [], captions);
    }

    /** Hapus proof */
    @Delete(':id/proofs/:proofId')
    async removeProof(
        @Param('id', ParseIntPipe) id: number,
        @Param('proofId', ParseIntPipe) proofId: number,
        @Body() body: { designerId: number; pin: string },
    ) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.removeProof(id, proofId);
    }

    /** Kirim ke WA Group */
    @Post(':id/send-wa')
    async sendWa(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; message?: string },
    ) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.sendToWhatsappGroup(id, body.message);
    }

    /** Batalkan SO */
    @Post(':id/cancel')
    async cancel(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; reason?: string },
    ) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.markCancelled(id, body.reason || '');
    }
}

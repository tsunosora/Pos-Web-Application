/**
 * Sales Order — public endpoints untuk desainer (no JWT).
 * Setiap request harus menyertakan { designerId, pin } untuk verifikasi.
 */
import {
    Controller, Post, Delete, Body, Param, ParseIntPipe, HttpCode,
    UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { SalesOrdersService } from './sales-orders.service';
import { DesignersService } from '../designers/designers.service';
import type { CreateSalesOrderPayload } from './sales-orders-public.types';
import { compressImages } from '../common/utils/compress-image.util';
import { assertRealImage, safeImageExt, safeImageFilter } from '../common/utils/safe-image-upload.util';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

const PROOF_DIR = './public/uploads/so-proofs';
try { fs.mkdirSync(PROOF_DIR, { recursive: true }); } catch { /* ignore */ }

// Ekstensi ditentukan server dari tipe gambar (bukan nama asli kiriman), SVG ditolak:
// endpoint ini tanpa login akun, jadi berkas tidak boleh bisa menjadi halaman web (T-18).
const proofStorage = diskStorage({
    destination: PROOF_DIR,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `so-proof-${uniqueSuffix}${safeImageExt(file.mimetype) ?? '.png'}`);
    },
});

async function verifyDesigner(designers: DesignersService, id: number, pin: string) {
    const result = await designers.verifyPin(id, pin);
    if (!result.valid) throw new BadRequestException('PIN desainer tidak valid');
    return result;
}

// Semua endpoint di sini memverifikasi PIN desainer → dibatasi tebakan PIN (T-19).
@UseInterceptors(PinThrottleInterceptor)
@Controller('sales-orders/designer')
export class SalesOrdersPublicController {
    constructor(
        private readonly soService: SalesOrdersService,
        private readonly designersService: DesignersService,
    ) {}

    /** Daftar SO milik desainer ini — POST supaya PIN bisa di body. Paginasi opsional. */
    @Post('my-list')
    async mySOs(@Body() body: { designerId: number; pin: string; page?: number; pageSize?: number }) {
        const result = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.listPaged({
            designerName: result.name,
            page: body.page ? Number(body.page) : 1,
            pageSize: body.pageSize ? Number(body.pageSize) : 20,
        });
    }

    /** Statistik kinerja desainer ini (hari ini & bulan ini, WIB) — kartu "Hore" setelah buat SO. */
    @Post('my-stats')
    async myStats(@Body() body: { designerId: number; pin: string }) {
        const result = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        const name = result.name ?? '';
        return { name, ...(await this.soService.designerStats(name)) };
    }

    /**
     * Detail SO — wajib PIN desainer. Dulu GET tanpa PIN dan id-nya berurutan,
     * sehingga nama + HP semua pelanggan bisa dipanen dengan perulangan (T-21).
     */
    @Post('detail/:id')
    @HttpCode(200) // hanya baca
    async detail(@Param('id', ParseIntPipe) id: number, @Body() body: { designerId: number; pin: string }) {
        await verifyDesigner(this.designersService, Number(body?.designerId), body?.pin);
        return this.soService.findOne(id);
    }

    /**
     * Preview lead aktif untuk satu nomor HP — supaya desainer tahu customer ini
     * sudah punya lead aktif (mis. dibuat CS) sebelum membuat SO. POST agar PIN
     * di body & nomor tidak nyangkut di log URL.
     */
    @Post('lead-by-phone')
    async leadByPhone(@Body() body: { designerId: number; pin: string; phone: string }) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.lookupActiveLeadsByPhone(body.phone || '');
    }

    /**
     * Daftar lead aktif dari CS (belum punya SO) — kartu pilihan di halaman buat SO.
     * Desainer klik kartu → data customer terisi & SO ditempel ke lead itu.
     */
    @Post('cs-leads')
    async csLeads(@Body() body: { designerId: number; pin: string; search?: string }) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.listActiveCsLeads(body.search);
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

    /**
     * "Lead Order" — buat Lead CRM tertaut dari SO ini (designer-first).
     * CS follow-up dari /crm/leads; nota dibuat dari SO di POS → lead auto-closing.
     */
    @Post(':id/create-lead')
    async createLead(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; targetLeadId?: number; forceNewLead?: boolean },
    ) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.createLeadFromSO(id, {
            targetLeadId: body.targetLeadId ? Number(body.targetLeadId) : undefined,
            forceNewLead: !!body.forceNewLead,
        });
    }

    /** Edit SO (perbaiki customer/catatan/item — selama belum di-invoice/dibatalkan) */
    @Post(':id/update')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string } & Partial<CreateSalesOrderPayload>,
    ) {
        const { designerId, pin, ...soData } = body;
        await verifyDesigner(this.designersService, Number(designerId), pin);
        return this.soService.update(id, soData);
    }

    /** Upload proof gambar */
    @Post(':id/proofs')
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: proofStorage,
            fileFilter: safeImageFilter,
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
        try {
            await verifyDesigner(this.designersService, Number(designerIdRaw), pin);
            for (const f of files || []) await assertRealImage(f.path);
        } catch (e) {
            for (const f of files || []) try { fs.unlinkSync(f.path); } catch { /* sudah terhapus */ }
            throw e;
        }
        let captions: string[] | undefined;
        if (captionsRaw) {
            try { captions = JSON.parse(captionsRaw); } catch { captions = [captionsRaw]; }
        }
        await compressImages((files || []).map(f => f.path));
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

    /** Kirim ke Discord #produksi (route tetap "send-wa" untuk kompatibilitas) */
    @Post(':id/send-wa')
    async sendWa(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; message?: string },
    ) {
        await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        return this.soService.sendToDesignChannel(id, body.message);
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

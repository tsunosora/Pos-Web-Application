/**
 * Sales Order — public endpoints untuk desainer (no JWT).
 * Setiap request harus menyertakan { designerId, pin } untuk verifikasi.
 */
import {
    Controller, Post, Delete, Body, Param, ParseIntPipe, HttpCode,
    UseInterceptors, UploadedFiles, BadRequestException, ForbiddenException,
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
import { PrismaService } from '../prisma/prisma.service';
import { maskPhone } from '../common/utils/phone.util';

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

const sameName = (a?: string | null, b?: string | null) =>
    String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Semua endpoint di sini memverifikasi PIN desainer → dibatasi tebakan PIN (T-19).
@UseInterceptors(PinThrottleInterceptor)
@Controller('sales-orders/designer')
export class SalesOrdersPublicController {
    constructor(
        private readonly soService: SalesOrdersService,
        private readonly designersService: DesignersService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * PIN hanya membuktikan SIAPA desainernya, bukan bahwa SO ini miliknya — id SO
     * berurutan, jadi tanpa cek ini desainer bisa mengubah/membatalkan SO orang lain.
     * `editable`: tolak juga SO yang sudah jadi nota / dibatalkan.
     */
    private async ownSo(id: number, designerName: string | undefined, editable = false) {
        const so = await this.soService.findOne(id);
        if (!String(designerName ?? '').trim() || !sameName(so.designerName, designerName)) {
            throw new ForbiddenException('SO ini milik desainer lain');
        }
        if (editable && (so.status === 'INVOICED' || so.status === 'CANCELLED')) {
            throw new BadRequestException('SO yang sudah jadi nota / dibatalkan tidak dapat diubah');
        }
        return so;
    }

    /**
     * Customer dipilih dari pencarian portal → HP yang sampai di klien disamarkan
     * (0812****789). Ganti dengan nomor asli dari customerId, asal samarannya cocok;
     * alamat kosong ikut diisi dari data customer.
     */
    private async unmaskPickedCustomer<T extends Partial<CreateSalesOrderPayload>>(data: T): Promise<T> {
        const phone = String(data.customerPhone ?? '').trim();
        if (!phone.includes('*')) return data;
        const id = Number(data.customerId);
        const c = Number.isInteger(id) && id > 0
            ? await this.prisma.customer.findUnique({ where: { id }, select: { phone: true, address: true } })
            : null;
        if (!c?.phone || maskPhone(c.phone) !== phone) {
            throw new BadRequestException('Nomor HP customer tidak cocok. Pilih ulang customer atau ketik nomornya.');
        }
        return {
            ...data,
            customerPhone: c.phone,
            customerAddress: String(data.customerAddress ?? '').trim() ? data.customerAddress : (c.address ?? null),
        };
    }

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
        const { designerId, pin, ...raw } = body;
        const designer = await verifyDesigner(this.designersService, Number(designerId), pin);
        const soData = await this.unmaskPickedCustomer(raw);
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
        const designer = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        await this.ownSo(id, designer.name);
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
        // Pemilik, cabang & status SO bukan urusan form desainer → dibuang dari isian.
        const { designerId, pin, designerName: _d, branchName: _b, status: _s, customerId, ...raw } = body as any;
        const designer = await verifyDesigner(this.designersService, Number(designerId), pin);
        await this.ownSo(id, designer.name, true);
        // customerId hanya diterima bila terbukti lewat HP samaran customer yang dipilih
        // (unmaskPickedCustomer mencocokkannya); selain itu dibuang.
        const soData = String(raw.customerPhone ?? '').includes('*')
            ? await this.unmaskPickedCustomer({ ...raw, customerId })
            : raw;
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
            const designer = await verifyDesigner(this.designersService, Number(designerIdRaw), pin);
            await this.ownSo(id, designer.name, true);
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
        const designer = await verifyDesigner(this.designersService, Number(body?.designerId), body?.pin);
        await this.ownSo(id, designer.name, true);
        return this.soService.removeProof(id, proofId);
    }

    /** Kirim ke Discord #produksi (route tetap "send-wa" untuk kompatibilitas) */
    @Post(':id/send-wa')
    async sendWa(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; message?: string },
    ) {
        const designer = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        await this.ownSo(id, designer.name);
        return this.soService.sendToDesignChannel(id, body.message);
    }

    /** Batalkan SO */
    @Post(':id/cancel')
    async cancel(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { designerId: number; pin: string; reason?: string },
    ) {
        const designer = await verifyDesigner(this.designersService, Number(body.designerId), body.pin);
        await this.ownSo(id, designer.name);
        return this.soService.markCancelled(id, body.reason || '');
    }
}

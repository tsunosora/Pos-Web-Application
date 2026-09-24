import {
    BadRequestException, ForbiddenException,
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
    UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ManagerGuard } from '../../auth/role-groups';
import { CurrentBranch } from '../../common/branch-context.decorator';
import type { BranchContext } from '../../common/branch-context.decorator';
import { LeadsService } from './leads.service';
import {
    CloseLostDto, ConvertLeadDto, CreateActivityDto, CreateLeadDto, UpdateLeadDto,
} from './leads.dto';
import { compressImage } from '../../common/utils/compress-image.util';

const LEAD_IMG_DIR = './public/uploads';
try { fs.mkdirSync(LEAD_IMG_DIR, { recursive: true }); } catch { /* ignore */ }
/** Export massal data pelanggan (PII) hanya utk Owner/Admin/Manajer — sama dgn isOwner/isManager di frontend. */
function canExportLeads(roleName?: string | null): boolean {
    const n = String(roleName ?? '').trim().toLowerCase();
    return ['owner', 'pemilik', 'superadmin', 'super_admin', 'super admin', 'admin'].includes(n)
        || /manajer|manager|supervisor|kepala/.test(n);
}

const randomHex = () => Array(32).fill(null).map(() => Math.round(Math.random() * 16).toString(16)).join('');

@UseGuards(JwtAuthGuard)
@Controller('crm/leads')
export class LeadsController {
    constructor(private readonly leads: LeadsService) {}

    @Get()
    list(
        @CurrentBranch() ctx: BranchContext,
        @Query('status') status?: string,
        @Query('source') source?: string,
        @Query('assignedToId') assignedToId?: string,
        @Query('level') level?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('search') search?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.leads.list(ctx, {
            status, source, level, dateFrom, dateTo,
            assignedToId: assignedToId ? +assignedToId : undefined,
            search,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get('status-summary')
    statusSummary(@CurrentBranch() ctx: BranchContext) {
        return this.leads.statusSummary(ctx);
    }

    /**
     * Export data lead (CSV/Excel/PDF dibuat di frontend) — detail lengkap tanpa paginasi.
     * statuses = kolom pipeline (koma), dateField = basis tanggal (created | closed), countOnly=1 = hitung saja.
     * HARUS di atas @Get(':id') supaya "export" tidak dibaca sebagai id.
     */
    @Get('export')
    exportLeads(
        @Req() req: any,
        @CurrentBranch() ctx: BranchContext,
        @Query('statuses') statuses?: string,
        @Query('source') source?: string,
        @Query('assignedToId') assignedToId?: string,
        @Query('level') level?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('dateField') dateField?: string,
        @Query('search') search?: string,
        @Query('countOnly') countOnly?: string,
    ) {
        if (!canExportLeads(req.user?.roleName)) {
            throw new ForbiddenException('Export data lead hanya untuk Owner/Admin/Manajer.');
        }
        return this.leads.exportRows(ctx, {
            statuses: statuses ? statuses.split(',') : undefined,
            source, level, dateFrom, dateTo, search,
            assignedToId: assignedToId ? +assignedToId : undefined,
            dateField: dateField === 'closed' ? 'closed' : 'created',
            countOnly: countOnly === '1',
        });
    }

    @Get(':id')
    detail(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.leads.detail(ctx, id);
    }

    @Post()
    create(
        @CurrentBranch() ctx: BranchContext,
        @Body() data: CreateLeadDto,
        @Req() req: any,
    ) {
        return this.leads.create(ctx, data, req?.user?.userId);
    }

    @Patch(':id')
    update(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateLeadDto,
        @Req() req: any,
    ) {
        return this.leads.update(ctx, id, data, req?.user?.userId);
    }

    @Post(':id/activities')
    addActivity(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: CreateActivityDto,
        @Req() req: any,
    ) {
        return this.leads.addActivity(ctx, id, data, req?.user?.userId);
    }

    @Post(':id/convert')
    convert(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: ConvertLeadDto,
        @Req() req: any,
    ) {
        return this.leads.convert(ctx, id, data, req?.user?.userId);
    }

    @Post(':id/close-lost')
    closeLost(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: CloseLostDto,
        @Req() req: any,
    ) {
        return this.leads.closeLost(ctx, id, data, req?.user?.userId);
    }

    @Post(':id/mark-invalid')
    markInvalid(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { reason?: string },
        @Req() req: any,
    ) {
        return this.leads.markInvalid(ctx, id, body.reason || '', req?.user?.userId);
    }

    /**
     * Pindahkan lead ke cabang lain (dua arah). Dipakai bila chat masuk lewat nomor WA satu cabang
     * padahal pesanannya dikerjakan cabang lain — dulu CS hanya bisa menandai invalid/menghapus.
     * Setelah dipindah, lead hilang dari daftar cabang asal dan muncul di cabang tujuan.
     */
    @Patch(':id/branch')
    @UseGuards(ManagerGuard)
    pindahCabang(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { branchId: number },
        @Req() req: any,
    ) {
        return this.leads.pindahCabang(ctx, id, Number(body?.branchId), req?.user?.userId);
    }

    /** Tautkan lead ke SO desainer yang sudah ada (Alur B — tanpa convert/nota baru). */
    @Post(':id/link-so')
    linkToSalesOrder(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { salesOrderId: number | null },
    ) {
        return this.leads.linkToSalesOrder(ctx, id, body.salesOrderId);
    }

    // Menghapus lead menghapus riwayat aktivitas CRM & mengubah KPI lalu → setingkat manajer.
    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.leads.remove(ctx, id);
    }

    /** Upload gambar untuk lead (avatar/produk). Return URL relatif `/uploads/...` */
    @Post('upload-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: LEAD_IMG_DIR,
            filename: (_req, file, cb) => cb(null, `lead_${randomHex()}${extname(file.originalname || '.jpg')}`),
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }
}

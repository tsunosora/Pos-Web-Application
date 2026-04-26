import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ClickCountingService } from './click-counting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { compressImage } from '../common/utils/compress-image.util';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

const execAsync = promisify(exec);
const randomHex = () => Array(32).fill(null).map(() => Math.round(Math.random() * 16).toString(16)).join('');

@UseGuards(JwtAuthGuard)
@Controller('click-counting')
export class ClickCountingController {
  constructor(
    private readonly service: ClickCountingService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Upload Foto Counter / Reject ───────────────────────────────────────────

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './public/uploads',
      filename: (_req, file, cb) => cb(null, `meter_${randomHex()}${extname(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Hanya file gambar yang diizinkan'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    await compressImage(file.path);
    const fileUrl = `/uploads/${file.filename}`;

    // Fire-and-forget: copy to rclone remote jika dikonfigurasi
    (async () => {
      try {
        const settings: any = await this.prisma.storeSettings.findFirst();
        const remote: string | null = settings?.rcloneRemote || null;
        if (remote) {
          await execAsync(`rclone copy "${file.path}" "${remote}/meter-photos"`, { timeout: 60_000 });
        }
      } catch (e) {
        console.warn('[click-counting] rclone upload gagal:', e?.message ?? e);
      }
    })();

    return { url: fileUrl };
  }

  // ─── Click Rates ────────────────────────────────────────────────────────────

  @Get('rates')
  getRates() {
    return this.service.getRates();
  }

  @Post('rates')
  createRate(
    @Body() body: { name: string; paperSize: string; colorMode: string; sideMode: string; pricePerClick: number },
  ) {
    return this.service.createRate(body);
  }

  @Post('rates/seed')
  seedRates() {
    return this.service.seedRates();
  }

  @Put('rates/:id')
  updateRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; pricePerClick?: number; isActive?: boolean },
  ) {
    return this.service.updateRate(id, body);
  }

  @Delete('rates/:id')
  deleteRate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteRate(id);
  }

  // ─── Click Logs ─────────────────────────────────────────────────────────────

  @Get('logs')
  getLogs(
    @CurrentBranch() branchCtx: BranchContext,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getLogs(branchCtx, month ? +month : undefined, year ? +year : undefined);
  }

  @Post('logs')
  createLog(
    @Body() body: { clickRateId: number; quantity: number; date?: string; transactionItemId?: number },
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.createLog(body, branchCtx);
  }

  @Delete('logs/:id')
  deleteLog(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteLog(id);
  }

  // ─── Machine Rejects ────────────────────────────────────────────────────────

  @Get('rejects')
  getRejects(
    @CurrentBranch() branchCtx: BranchContext,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getRejects(branchCtx, month ? +month : undefined, year ? +year : undefined);
  }

  @Post('rejects')
  createReject(
    @Body()
    body: {
      rejectType: string;
      cause?: string;
      counterType?: string;
      quantity: number;
      pricePerClick?: number;
      notes?: string;
      photoUrl?: string;
      date?: string;
    },
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.createReject(body, branchCtx);
  }

  @Delete('rejects/:id')
  deleteReject(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteReject(id);
  }

  // ─── Meter Readings (harian) ────────────────────────────────────────────────

  @Get('meter')
  getMeterReadings(
    @CurrentBranch() branchCtx: BranchContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getMeterReadings(branchCtx, startDate, endDate);
  }

  @Get('meter/by-date')
  getMeterByDate(@Query('date') date: string, @CurrentBranch() branchCtx: BranchContext) {
    return this.service.getMeterReadingByDate(date, branchCtx);
  }

  @Post('meter')
  upsertMeterReading(
    @Body()
    body: {
      readingDate: string;
      totalCount: number;
      fullColorCount: number;
      blackCount: number;
      singleColorCount?: number;
      photoUrl?: string;
      notes?: string;
    },
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.upsertMeterReading(body, branchCtx);
  }

  @Delete('meter/:id')
  deleteMeterReading(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteMeterReading(id);
  }

  // ─── Vendor Bill (rekonsiliasi per range) ───────────────────────────────────

  @Get('vendor-bill')
  getVendorBill(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.getVendorBill(startDate, endDate, branchCtx);
  }

  // ─── Reconciliation (legacy — per bulan) & Dashboard ───────────────────────

  @Get('reconciliation')
  getReconciliation(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.getReconciliation(month, year, branchCtx);
  }

  @Get('dashboard')
  getDashboard(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentBranch() branchCtx: BranchContext,
  ) {
    return this.service.getDashboard(month, year, branchCtx);
  }
}

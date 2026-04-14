import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles, Query, Param, ParseIntPipe } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { compressImage } from '../common/utils/compress-image.util';

export type StructuredExpenseItem = { name: string; amount: number };
export type StructuredExpenses = Record<string, StructuredExpenseItem[]>;
// e.g. { "CASH": [{name: "Beli gula", amount: 28000}], "BCA": [{...}] }

export type AdditionalIncomeItem = { bankName: string; amount: number; description: string };
export type PaymentExchangeItem = { from: string; to: string; amount: number; description: string };

// Define the payload for closing a shift
export class CloseShiftDto {
    adminName: string;
    shiftName: string;
    reportDate?: string;        // tanggal laporan WA (YYYY-MM-DD), opsional
    openedAt: Date | string;
    closedAt: Date | string;

    actualCash: number;
    actualQris: number;
    actualTransfer: number;
    expensesTotal: number;
    notes?: string;

    // Expected totals passed by the client
    expectedCash: number;
    expectedQris: number;
    expectedTransfer: number;

    expectedBankBalances?: Record<string, number>;
    actualBankBalances?: Record<string, number>;   // Saldo Laporan mBanking
    realBankBalances?: Record<string, number>;     // Saldo Real di Bank
    shiftExpenses?: any[];
    structuredExpenses?: StructuredExpenses;       // Pengeluaran terstruktur per metode
    kasbon?: { name: string; amount: number; source?: string }[];  // Kasbon karyawan
    setorKas?: { bankName: string; amount: number }[];  // Setor kas ke rekening
    tarikTunai?: { bankName: string; amount: number }[]; // Tarik tunai dari rekening ke kas
    tukarTransferKeCash?: number; // Konversi transfer masuk menjadi kas fisik
    additionalIncomes?: AdditionalIncomeItem[]; // Pemasukan eksternal langsung ke rekening
    paymentExchanges?: PaymentExchangeItem[]; // Pertukaran antar metode (QRIS↔Tunai, titip transfer, dll)
}

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('current-shift')
    async getCurrentShift() {
        return this.reportsService.calculateCurrentShiftExpectations();
    }

    @Get('profit')
    async getProfitReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.reportsService.getProfitReport(startDate, endDate);
    }

    // Endpoint untuk dropdown daftar staff/kasir
    @Get('staff-list')
    async getStaffList() {
        return this.reportsService.getStaffList();
    }

    @Post('close-shift')
    @UseInterceptors(
        FilesInterceptor('proofImages', 20, {
            storage: diskStorage({
                destination: './uploads/proofs',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async closeShift(
        @Body() body: any,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const dto: CloseShiftDto = {
            adminName: body.adminName,
            shiftName: body.shiftName,
            reportDate: body.reportDate || undefined,
            openedAt: new Date(body.openedAt),
            closedAt: new Date(body.closedAt),
            actualCash: Number(body.actualCash),
            actualQris: Number(body.actualQris),
            actualTransfer: Number(body.actualTransfer),
            expensesTotal: Number(body.expensesTotal),
            notes: body.notes,
            expectedCash: Number(body.expectedCash),
            expectedQris: Number(body.expectedQris),
            expectedTransfer: Number(body.expectedTransfer),
            expectedBankBalances: body.expectedBankBalances ? JSON.parse(body.expectedBankBalances) : undefined,
            actualBankBalances: body.actualBankBalances ? JSON.parse(body.actualBankBalances) : undefined,
            realBankBalances: body.realBankBalances ? JSON.parse(body.realBankBalances) : undefined,
            shiftExpenses: body.shiftExpenses ? JSON.parse(body.shiftExpenses) : undefined,
            structuredExpenses: body.structuredExpenses ? JSON.parse(body.structuredExpenses) : undefined,
            kasbon: body.kasbon ? JSON.parse(body.kasbon) : [],
            setorKas: body.setorKas ? JSON.parse(body.setorKas) : [],
            tarikTunai: body.tarikTunai ? JSON.parse(body.tarikTunai) : [],
            tukarTransferKeCash: Number(body.tukarTransferKeCash || 0),
            additionalIncomes: body.additionalIncomes ? JSON.parse(body.additionalIncomes) : [],
            paymentExchanges: body.paymentExchanges ? JSON.parse(body.paymentExchanges) : [],
        };

        const uploadedPaths = files ? files.map((f) => f.path) : [];

        if (files && files.length > 0) {
            await Promise.all(files.map(f => compressImage(f.path)));
        }

        return this.reportsService.closeShift(dto, uploadedPaths);
    }

    @Get('shift-history')
    async getShiftHistory(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.reportsService.getShiftHistory(Number(page || 1), Number(limit || 20));
    }

    @Post('shift/:id/resend')
    async resendShiftReport(@Param('id', ParseIntPipe) id: number) {
        return this.reportsService.resendShiftReport(id);
    }
}

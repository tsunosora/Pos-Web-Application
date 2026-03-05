import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

// Define the payload for closing a shift
export class CloseShiftDto {
    adminName: string;
    shiftName: string;
    openedAt: Date | string; // from the client
    closedAt: Date | string; // from the client

    actualCash: number;
    actualQris: number;
    actualTransfer: number;
    expensesTotal: number;
    notes?: string;

    // Expected totals passed by the client to be verified/saved
    expectedCash: number;
    expectedQris: number;
    expectedTransfer: number;

    expectedBankBalances?: Record<string, number>;
    actualBankBalances?: Record<string, number>;
    shiftExpenses?: any[];
}

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('current-shift')
    async getCurrentShift() {
        return this.reportsService.calculateCurrentShiftExpectations();
    }

    @Post('close-shift')
    @UseInterceptors(
        FilesInterceptor('proofImages', 5, {
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
        @Body() body: any, // Use any or a partial DTO because multipart sometimes strings values
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const dto: CloseShiftDto = {
            adminName: body.adminName,
            shiftName: body.shiftName,
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
            shiftExpenses: body.shiftExpenses ? JSON.parse(body.shiftExpenses) : undefined,
        };

        const uploadedPaths = files ? files.map((f) => f.path) : [];

        return this.reportsService.closeShift(dto, uploadedPaths);
    }
}

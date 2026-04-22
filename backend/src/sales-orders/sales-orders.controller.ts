import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query,
    ParseIntPipe, UseGuards, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesOrdersService } from './sales-orders.service';
import type { CreateSalesOrderDto, SalesOrderStatus, UpdateSalesOrderDto } from './sales-orders.service';

const proofStorage = diskStorage({
    destination: './public/uploads/so-proofs',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `so-proof-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
    }
    cb(null, true);
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
    create(@Body() body: CreateSalesOrderDto) {
        return this.service.create(body);
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
    sendWa(@Param('id', ParseIntPipe) id: number, @Body() body: { message?: string }) {
        return this.service.sendToWhatsappGroup(id, body?.message);
    }

    @Post(':id/cancel')
    cancel(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
        return this.service.markCancelled(id, body?.reason || '');
    }
}

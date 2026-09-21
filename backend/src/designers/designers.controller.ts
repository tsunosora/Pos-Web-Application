import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DesignersService } from './designers.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { signBoardToken } from '../auth/board-auth';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

/** Endpoint publik — tidak perlu JWT (hanya nama + verifikasi PIN) */
@Controller('designers')
export class DesignersPublicController {
    constructor(
        private readonly service: DesignersService,
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    @Get('public')
    listPublic() {
        return this.service.listPublic();
    }

    /** PIN benar → ikut dapat token papan kerja (dipakai /produksi & /cetak). */
    @Post('public/verify')
    @UseInterceptors(PinThrottleInterceptor)
    async verifyPin(@Body() body: { id: number; pin: string; branchId?: number | null }) {
        const r = await this.service.verifyPin(Number(body.id), body.pin);
        if (!r.valid) return r;
        // Token papan SELALU satu cabang: cabang yang dipilih di layar (karyawan boleh memegang mesin
        // cabang mana pun) bila cabang aktif, selain itu cabang desainer. Dulu kosong = SEMUA cabang.
        let branchId: number | null = r.branchId ?? null;
        const dipilih = Number(body.branchId);
        if (Number.isInteger(dipilih) && dipilih > 0) {
            const b = await this.prisma.companyBranch.findFirst({ where: { id: dipilih, isActive: true }, select: { id: true } });
            if (b) branchId = b.id;
        }
        const boardToken = signBoardToken(this.jwt, { designerId: r.id, name: r.name, branchId });
        const { branchId: _b, ...publik } = r;
        return { ...publik, boardToken };
    }
}

/** Endpoint admin — butuh JWT */
@UseGuards(JwtAuthGuard)
@Controller('designers')
export class DesignersAdminController {
    constructor(private readonly service: DesignersService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    // Menambah/mengubah/menghapus identitas PIN hanya setingkat manajer: kalau
    // semua akun bisa, siapa pun bisa membuat "operator bayangan" (T-31).
    @Post()
    @UseGuards(ManagerGuard)
    create(@Body() body: { name: string; pin: string; branchName?: string; branchId?: number | null; userId?: number | null }) {
        return this.service.create(body);
    }

    @Patch(':id')
    @UseGuards(ManagerGuard)
    update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; pin?: string; isActive?: boolean; branchName?: string | null; branchId?: number | null; userId?: number | null }) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}

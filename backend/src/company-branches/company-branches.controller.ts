import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, OwnerGuard } from '../auth/role-groups';
import { CompanyBranchesService } from './company-branches.service';

@Controller('company-branches')
export class CompanyBranchesController {
    constructor(private readonly service: CompanyBranchesService) {}

    // PUBLIC — untuk branch picker di halaman /produksi & /cetak yang public + PIN gated
    @Get('public-active')
    publicActive() { return this.service.findAllActivePublic(); }

    @Get()
    @UseGuards(JwtAuthGuard)
    findAll() { return this.service.findAll(); }

    @Get('active')
    @UseGuards(JwtAuthGuard)
    findAllActive() { return this.service.findAllActive(); }

    // Menambah/mengubah/menghapus cabang (nama cabang ada di nomor dokumen): setingkat manajer (T-45).
    @Post()
    @UseGuards(JwtAuthGuard, ManagerGuard)
    create(
        @Body() body: {
            name: string; address?: string; phone?: string;
            code?: string; notaHeader?: string; notaFooter?: string; logoUrl?: string;
        },
    ) {
        return this.service.create(body);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            name?: string; address?: string; phone?: string; isActive?: boolean;
            code?: string | null; notaHeader?: string | null; notaFooter?: string | null; logoUrl?: string | null;
            dailyTargetOverride?: number | null;
        },
        @CurrentBranch() ctx: BranchContext,
    ) {
        // Manajer hanya cabangnya sendiri; menonaktifkan & mengganti kode (awalan nomor dokumen)
        // khusus owner. Dulu manajer cabang A bisa menonaktifkan/mengganti kode cabang B.
        if (!ctx.isOwner) {
            if (id !== ctx.userBranchId) throw new ForbiddenException('Hanya boleh mengubah cabang sendiri.');
            if (body?.isActive !== undefined || body?.code !== undefined) throw new ForbiddenException('Status aktif & kode cabang hanya diubah owner.');
        }
        return this.service.update(id, body);
    }

    // Hapus cabang permanen: owner saja (manajer cukup menonaktifkan).
    @Delete(':id')
    @UseGuards(JwtAuthGuard, OwnerGuard)
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

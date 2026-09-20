import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { HrSummaryService } from './hr-summary.service';

/**
 * Kartu "Sekilas HR" di dashboard. Isinya nama karyawan & keterlambatan, jadi
 * dibatasi ke Owner/Manajer — role "Admin" di PosPro dipakai kasir/CS, sehingga
 * sengaja TIDAK diberi akses.
 */
const HR_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'MANAJER', 'MANAGER', 'PEMILIK'] as const;

@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrSummaryController {
    constructor(private readonly service: HrSummaryService) { }

    /** Kartu tim — hanya Owner/Manajer. */
    @UseGuards(RolesGuard)
    @Roles(...HR_ROLES)
    @Get('summary')
    summary() {
        return this.service.summary();
    }

    /**
     * Tautan portal absensi PRIBADI — boleh untuk semua yang sudah login, tapi
     * id-nya diambil dari token, jadi tiap orang hanya dapat tautannya sendiri.
     */
    @Get('my-portal')
    myPortal(@Req() req: any) {
        return this.service.myPortal(Number(req?.user?.userId));
    }
}

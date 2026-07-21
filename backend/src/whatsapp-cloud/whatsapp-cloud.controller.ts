import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsappCloudService } from './whatsapp-cloud.service';

// Manajemen WhatsApp CRM hanya untuk Owner/Admin (RolesGuard case-insensitive).
const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;

@Controller('whatsapp')
export class WhatsappCloudController {
    constructor(private readonly service: WhatsappCloudService) {}

    /** Verifikasi kredensial Cloud API tiap channel aktif (tanpa kirim pesan). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('health')
    health() {
        return this.service.healthCheck();
    }
}

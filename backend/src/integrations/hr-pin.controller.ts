import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { HrSummaryService } from './hr-summary.service';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

/**
 * Kartu "Absensi saya" untuk halaman kerja ber-PIN (/so-designer, /produksi,
 * /cetak). Tidak pakai JwtAuthGuard karena di sana tidak ada login email —
 * pengamannya PIN itu sendiri, diverifikasi di service (pola yang sama dengan
 * task-board/pin dan designers/public/verify).
 */
@UseInterceptors(PinThrottleInterceptor)
@Controller('hr/pin')
export class HrPinController {
    constructor(private readonly service: HrSummaryService) { }

    @Post('my-portal')
    myPortal(@Body() body: { designerId: number; pin: string }) {
        return this.service.myPortalByPin(Number(body?.designerId), String(body?.pin ?? ''));
    }
}

import { Controller, Header, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { NotifSseAuthGuard } from './sse-auth.guard';

@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
    ) { }

    @Sse('stream')
    @Header('X-Accel-Buffering', 'no')
    @Header('Cache-Control', 'no-cache')
    @UseGuards(NotifSseAuthGuard) // token ?token= sah & akun aktif — dicek sebelum stream dibuka
    stream(): Observable<MessageEvent> {
        return this.notificationsService.getObservable();
    }
}

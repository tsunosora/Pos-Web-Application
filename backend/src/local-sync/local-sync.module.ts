import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LocalSyncService } from './local-sync.service';
import { PushCaptureInterceptor } from './push-capture.interceptor';

// Modul sync sisi-lokal. Selalu di-import, tapi service & interceptor no-op kecuali
// POSPRO_LOCAL diset (server pusat tak terpengaruh).
@Module({
  providers: [
    LocalSyncService,
    { provide: APP_INTERCEPTOR, useClass: PushCaptureInterceptor },
  ],
})
export class LocalSyncModule {}

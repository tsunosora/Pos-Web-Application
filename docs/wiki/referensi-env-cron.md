# ⚙️ Referensi Variabel Lingkungan & Pekerjaan Terjadwal

> Dibangkitkan otomatis oleh `tools/gen-wiki-referensi.js` — jangan disunting tangan.
> Jalankan ulang skripnya setelah menambah fitur.


## Variabel lingkungan backend

**52 variabel** dibaca oleh backend. Yang tidak diisi membuat fiturnya
menganggap diri belum dikonfigurasi — aplikasi tetap jalan, fitur itu saja yang diam.

### Env yang mengubah perilaku saat diisi

- `STOREFRONT_TOKEN` — Kunci asal order publik. **Terisi:** `POST /orders/public` hanya menerima request ber-header `X-Storefront-Token` yang cocok (selain itu 403) — bot yang menembak API langsung ditolak. **Kosong:** endpoint terbuka, hanya dibatasi rate limit. Nilainya harus SAMA dengan setelan `storefront_token` di dashboard website toko (`toko/lib.php` mengirimnya). Urutan pemasangan: isi di website dulu, baru di `.env` backend + restart, supaya order tidak sempat tertolak.

| Variabel | Dipakai di |
|---|---|
| `AI_API_KEY` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_AVATAR` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_BASE_URL` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_CHAT_ENABLED` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_ENABLED` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_GREETING` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_MODEL` | `backend/src/studio-ai/studio-ai.service.ts` |
| `AI_NAME` | `backend/src/studio-ai/studio-ai.service.ts` |
| `ALLOWED_ORIGINS` | `backend/src/main.ts` |
| `APP_TZ` | `backend/src/main.ts` |
| `BACKUP_DIR` | `backend/src/backup/rclone.service.ts` |
| `BOARD_TOKEN_EXPIRES` | `backend/src/auth/board-auth.ts` |
| `CRM_REPEAT_ORDER_AUTO` | `backend/src/crm/follow-ups/follow-ups.cron.ts` |
| `HR_API_KEY` | `backend/src/integrations/hr-summary.service.ts` |
| `HR_SUMMARY_URL` | `backend/src/integrations/hr-summary.service.ts` |
| `IG_APP_SECRET` | `backend/src/meta-messaging/data-deletion.controller.ts`, `backend/src/meta-messaging/social-webhook.controller.ts` |
| `JWT_EXPIRES` | `backend/src/auth/auth.module.ts` |
| `JWT_SECRET` | `backend/src/auth/jwt-secret.util.ts`, `backend/src/notifications/notifications.module.ts` |
| `LOGIN_FAIL_MAX` | `backend/src/auth/login-throttle.service.ts` |
| `LOGIN_FAIL_WINDOW_MS` | `backend/src/auth/login-throttle.service.ts` |
| `LOGIN_LOCK_MS` | `backend/src/auth/login-throttle.service.ts` |
| `META_AD_ACCOUNT_ID` | `backend/src/meta-ads/meta-ads.service.ts` |
| `META_VERIFY_TOKEN` | `backend/src/meta-messaging/social-webhook.controller.ts` |
| `PIN_FAIL_MAX` | `backend/src/auth/pin-throttle.interceptor.ts` |
| `PIN_FAIL_WINDOW_MS` | `backend/src/auth/pin-throttle.interceptor.ts` |
| `PIN_LOCK_MS` | `backend/src/auth/pin-throttle.interceptor.ts` |
| `PORT` | `backend/src/main.ts` |
| `POSPRO_BRANCH_ID` | `backend/src/local-sync/local-sync.service.ts` |
| `POSPRO_CENTRAL_TOKEN` | `backend/src/local-sync/local-sync.service.ts` |
| `POSPRO_CENTRAL_URL` | `backend/src/local-sync/local-sync.service.ts` |
| `POSPRO_DEVICE_NAME` | `backend/src/local-sync/local-sync.service.ts` |
| `POSPRO_DEVICE_TOKEN_FILE` | `backend/src/local-sync/local-sync.service.ts` |
| `POSPRO_LOCAL` | `backend/src/local-sync/local-sync.service.ts`, `backend/src/local-sync/push-capture.interceptor.ts` |
| `PUBLIC_BASE_URL` | `backend/src/meta-messaging/data-deletion.controller.ts`, `backend/src/whatsapp-cloud/whatsapp-cloud.controller.ts` |
| `SOCIAL_AUTO_SYNC` | `backend/src/meta-messaging/social-comments.service.ts` |
| `STAFF_KPI_ALLOW_REMOTE` | `backend/src/auth/api-key.guard.ts` |
| `STAFF_KPI_API_KEY` | `backend/src/auth/api-key.guard.ts` |
| `STOREFRONT_TOKEN` | `backend/src/common/public-order-throttle.guard.ts` |
| `STUDIO_AI_CONFIG_PATH` | `backend/src/studio-ai/studio-ai.service.ts` |
| `TZ` | `backend/src/main.ts` |
| `WA_ACCESS_TOKEN` | `backend/src/whatsapp-cloud/cloud-api.service.ts` |
| `WA_APP_ID` | `backend/src/whatsapp-cloud/cloud-api.service.ts` |
| `WA_APP_SECRET` | `backend/src/meta-messaging/data-deletion.controller.ts`, `backend/src/meta-messaging/social-webhook.controller.ts`, `backend/src/whatsapp-cloud/cloud-api.service.ts` _(+1)_ |
| `WA_AUTO_CREATE_LEAD` | `backend/src/whatsapp-cloud/inbox.service.ts` |
| `WA_BROADCAST_RATE_PER_SEC` | `backend/src/whatsapp-cloud/broadcast.service.ts` |
| `WA_CLOUD_ENABLED` | `backend/src/whatsapp-cloud/cloud-api.service.ts` |
| `WA_GRAPH_VERSION` | `backend/src/meta-messaging/meta-api.service.ts`, `backend/src/whatsapp-cloud/cloud-api.service.ts` |
| `WA_MEDIA_DIR` | `backend/src/whatsapp-cloud/media-storage.service.ts` |
| `WA_MEDIA_RETENTION_DAYS` | `backend/src/whatsapp-cloud/media-storage.service.ts` |
| `WA_VERIFY_TOKEN` | `backend/src/meta-messaging/social-webhook.controller.ts`, `backend/src/whatsapp-cloud/webhook.controller.ts` |
| `WHATSAPP_ENABLED` | `backend/src/whatsapp/whatsapp.service.ts` |
| `WHATSAPP_REPORT_GROUP_ID` | `backend/src/whatsapp/whatsapp.service.ts` |

## Variabel lingkungan frontend

Hanya yang berawalan `NEXT_PUBLIC_` yang sampai ke browser, dan nilainya
**dipanggang saat build** — mengubahnya menuntut build ulang.

| Variabel | Dipakai di |
|---|---|
| `NEXT_PUBLIC_API_URL` | `frontend/src/app/api/logo/route.ts`, `frontend/src/app/artikel/[slug]/page.tsx`, `frontend/src/app/artikel/page.tsx` _(+52)_ |
| `NEXT_PUBLIC_BRIDGE_URL` | `frontend/src/lib/thermal/print-thermal.ts` |
| `NEXT_PUBLIC_HR_APP_URL` | `frontend/src/components/dashboard/HrSummaryCard.tsx` |
| `NEXT_PUBLIC_LANDING_DOMAIN` | `frontend/src/middleware.ts` |
| `NEXT_PUBLIC_SHARE_DOMAIN` | `frontend/src/app/inventory/page.tsx`, `frontend/src/middleware.ts` |

## Pekerjaan terjadwal

**10 pekerjaan** berjalan sendiri di backend.
Semua memakai zona waktu server kecuali disebut lain di jadwalnya.

| Jenis | Jadwal | Fungsi | Berkas |
|---|---|---|---|
| Cron | `'0 8 * * 1', { name: 'crm-repeat-order-weekly', timeZone: 'Asia/Jakarta' }` | `scheduleRepeatOrders` | `backend/src/crm/follow-ups/follow-ups.cron.ts` |
| Cron | `'0 8 * * 1', { name: 'discord-champion-weekly', timeZone: 'Asia/Jakarta' }` | `weeklyChampion` | `backend/src/crm/kpi/kpi.cron.ts` |
| Interval | `30000` | `scheduled` | `backend/src/local-sync/local-sync.service.ts` |
| Cron | `'30 */5 * * * *', { name: 'social-comments-auto-sync' }` | `autoSync` | `backend/src/meta-messaging/social-comments.service.ts` |
| Cron | `'5 0 * * *', { name: 'task-board-generate-daily' }` | `generateDaily` | `backend/src/task-board/task-board.cron.ts` |
| Cron | `'*/5 * * * *', { name: 'task-board-auto-warn' }` | `autoWarn` | `backend/src/task-board/task-board.cron.ts` |
| Cron | `'0 * * * * *'` | `sweepScheduled` | `backend/src/whatsapp-cloud/broadcast.service.ts` |
| Cron | `CronExpression.EVERY_DAY_AT_3AM` | `autoCleanupOldMedia` | `backend/src/whatsapp-cloud/media-storage.service.ts` |
| Cron | `'0 */15 * * * *'` | `sweepFollowUps` | `backend/src/whatsapp-cloud/reminders.service.ts` |
| Cron | `'0 */10 * * * *'` | `autoSyncStatuses` | `backend/src/whatsapp-cloud/templates.service.ts` |

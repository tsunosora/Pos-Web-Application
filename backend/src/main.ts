import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true → menyimpan Buffer body mentah (req.rawBody) untuk verifikasi
  // signature webhook WhatsApp Meta (X-Hub-Signature-256). Kompatibel dengan
  // useBodyParser kustom di bawah.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Validasi & sanitasi payload. transform: koersi tipe & jadikan instance DTO.
  //
  // CATATAN: whitelist + forbidNonWhitelisted SENGAJA dimatikan. Hampir semua DTO
  // di proyek ini (leads, auth, users update, dll) belum punya decorator
  // class-validator, seharusnya. Dengan whitelist:true, ValidationPipe menganggap
  // SEMUA properti tanpa decorator sebagai "field asing" -> forbidNonWhitelisted
  // menolak seluruh request (regresi commit b450731: "property X should not exist").
  // JANGAN nyalakan whitelist tanpa forbidNonWhitelisted: itu justru membuang
  // semua field diam-diam (silent data loss) -> update tersimpan kosong.
  // Untuk mengaktifkan kembali keduanya: tambahkan decorator (@IsOptional,
  // @IsString, @IsEnum, @ValidateNested, dst) ke SEMUA DTO lebih dulu, per modul.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: true,
  }));

  // Struk thermal dikirim sebagai raster base64 (bisa >100kb untuk nota panjang)
  // ke /printer-relay/jobs. Naikkan limit body-parser dari default 100kb → 10mb
  // agar tidak ditolak "request entity too large" (PayloadTooLargeError).
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

  // Header keamanan (X-Frame-Options, X-Content-Type-Options, dll).
  // CSP & COEP dimatikan, dan CORP di-set 'cross-origin': backend menyajikan
  // gambar/aset (/uploads) yang dimuat dari origin frontend/storefront berbeda.
  // Default helmet (CORP same-origin) memblokirnya -> ERR_BLOCKED_BY_RESPONSE.NotSameOrigin.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Public read-only endpoints: allow any origin, no credentials needed
  app.use((req: any, res: any, next: any) => {
    const isPublic =
      req.path.startsWith('/products/public') ||
      req.path === '/settings/public' ||
      req.path === '/landing/public' ||
      req.path.startsWith('/articles/public') ||
      req.path.startsWith('/cs-rating/public') ||
      req.path === '/orders/public';
    if (isPublic) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    // Disable cache untuk semua API response. Mencegah CDN (Cloudflare),
    // nginx proxy_cache, atau browser cache JSON response yang bisa stale
    // dan bikin bug seperti URL foto rusak masih tampil walau backend sudah
    // sanitize. Static asset (gambar /uploads, dll) tidak terpengaruh karena
    // di-serve via path lain.
    if (req.method === 'GET' && !req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Enable CORS. Produksi: pakai ALLOWED_ORIGINS (allowlist ketat). Tanpa env
  // (dev/homelab) izinkan localhost & 127.0.0.1 + origin LAN (mis. akses dari HP
  // di jaringan yang sama) supaya tidak kena "Network Error" karena origin beda.
  const explicitOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const lanOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1|(?:192\.168|10|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+)(?::\d+)?$/;
  const allowLan = !process.env.ALLOWED_ORIGINS; // hanya saat allowlist tidak di-set eksplisit
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true); // curl / server-to-server / same-origin
      if (explicitOrigins.includes(origin)) return cb(null, true);
      if (allowLan && lanOriginRe.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Content-Disposition'], // agar frontend bisa baca nama file backup
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

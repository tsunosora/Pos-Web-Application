import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Header keamanan (X-Frame-Options, X-Content-Type-Options, dll).
  // CSP & COEP dimatikan: ini API JSON + ada aset/gambar lintas-origin yang
  // di-serve ke storefront, jadi CSP ketat bisa memblokir hal yang sah.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Public read-only endpoints: allow any origin, no credentials needed
  app.use((req: any, res: any, next: any) => {
    const isPublic =
      req.path.startsWith('/products/public') ||
      req.path === '/settings/public' ||
      req.path === '/landing/public' ||
      req.path.startsWith('/articles/public') ||
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

  // Enable CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Content-Disposition'], // agar frontend bisa baca nama file backup
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

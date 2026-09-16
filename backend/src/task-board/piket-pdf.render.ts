import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';

const logger = new Logger('PiketPdf');

export const PIKET_PDF_FILENAME = 'Jadwal-Piket-Pusat.pdf';

/** "DD/MM/YYYY HH.mm" (jam server) — dicetak di kaki halaman PDF. */
export function stampLabel(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}`;
}

/**
 * HTML → PDF A4 lewat Chromium (puppeteer, sudah terpasang bersama whatsapp-web.js).
 * JavaScript & semua request jaringan dimatikan — isinya hanya teks jadwal yang sudah di-escape.
 */
export async function renderPiketPdf(html: string): Promise<Buffer> {
  let browser: import('puppeteer').Browser | undefined;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on(
      'request',
      (req) =>
        void (req.url().startsWith('data:') ? req.continue() : req.abort()),
    );
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30_000,
    });
    return Buffer.from(pdf);
  } catch (e) {
    logger.error(
      `Gagal membuat PDF jadwal piket: ${(e as Error)?.message ?? e}`,
    );
    throw new ServiceUnavailableException(
      'PDF jadwal piket sedang tidak bisa dibuat. Coba lagi sebentar.',
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export function sendPiketPdf(res: Response, pdf: Buffer): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${PIKET_PDF_FILENAME}"`,
  );
  res.setHeader('Content-Length', String(pdf.length));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end(pdf);
}

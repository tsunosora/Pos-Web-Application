import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  let logoImageUrl: string | null = null;
  try {
    const settingsRes = await fetch(`${base}/settings/public`, { cache: 'no-store' });
    if (!settingsRes.ok) return new NextResponse('Failed to fetch settings', { status: 502 });
    const settings = await settingsRes.json();
    logoImageUrl = settings?.logoImageUrl ?? null;
  } catch {
    return new NextResponse('Settings fetch error', { status: 502 });
  }

  if (!logoImageUrl) return new NextResponse('No logo configured', { status: 404 });

  try {
    const imageRes = await fetch(`${base}${logoImageUrl}`, { cache: 'no-store' });
    if (!imageRes.ok) return new NextResponse('Logo image not found', { status: 502 });

    // Hanya gambar raster. Rute ini berjalan di domain kasir: berkas SVG/HTML yang diunggah sebagai
    // "logo" dulu tersaji di sini sebagai halaman (skrip bisa membaca token login).
    const contentType = (imageRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
      return new NextResponse('Unsupported logo type', { status: 415 });
    }
    const imageBuffer = await imageRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('Image fetch error', { status: 502 });
  }
}

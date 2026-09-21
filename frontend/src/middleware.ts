import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { halamanPublik, tujuanSetelahLogin, urlLogin } from './lib/rute-publik';

export function middleware(request: NextRequest) {
    const host = request.headers.get('host') ?? '';
    const { pathname } = request.nextUrl;

    // Batasi share domain hanya untuk halaman produk publik (/p/*)
    const shareEnv = process.env.NEXT_PUBLIC_SHARE_DOMAIN;
    const shareHost = shareEnv ? new URL(shareEnv).host : null;
    if (shareHost && host === shareHost && !pathname.startsWith('/p/') && !pathname.startsWith('/_next/') && pathname !== '/manifest.webmanifest') {
        return new NextResponse(null, { status: 404 });
    }

    // Domain custom landing: kalau host == NEXT_PUBLIC_LANDING_DOMAIN, selalu
    // sajikan halaman /landing (publik, tanpa login). Pointing DNS + reverse
    // proxy ke app ini diatur di sisi server/hosting.
    const landingEnv = process.env.NEXT_PUBLIC_LANDING_DOMAIN;
    const landingHost = landingEnv ? new URL(landingEnv).host : null;
    if (landingHost && host === landingHost) {
        // Aset & halaman publik yang boleh diakses langsung di domain landing
        if (
            pathname.startsWith('/_next/') || pathname === '/manifest.webmanifest' ||
            pathname.startsWith('/uploads') || pathname === '/landing' ||
            pathname === '/artikel' || pathname.startsWith('/artikel/') ||
            pathname === '/kebijakan-privasi' || pathname === '/hapus-data'
        ) {
            return NextResponse.next();
        }
        // Selain itu (mis. root "/") → sajikan landing
        return NextResponse.rewrite(new URL('/landing', request.url));
    }

    const token = request.cookies.get('token')?.value;
    const isLoginPage = pathname.startsWith('/login');
    // /desainer = halaman Studio Desain mandiri dgn login sendiri (autentikasi ke
    // akun POS via /auth/login) → publik, biar tak dipaksa ke /login POS. Aset
    // iframe /studio-desain/* TETAP butuh cookie token (bukan publik) → hanya
    // termuat setelah login Studio berhasil.
    // /produksi/board (operator pipeline view) tetap PUBLIC (PIN-protected di sisi backend).
    const isPublicPage = halamanPublik(pathname);

    // If there is no token and the user is NOT on the login page (or public paths), redirect to login
    if (!token && !isLoginPage && !isPublicPage) {
        // Bawa jalur asal (?next=) → setelah login kembali ke halaman yang tadi dibuka.
        return NextResponse.redirect(new URL(urlLogin(pathname + request.nextUrl.search), request.url));
    }

    // If there IS a token and the user is trying to access the login page, redirect to dashboard
    if (token && isLoginPage) {
        return NextResponse.redirect(new URL(tujuanSetelahLogin(request.nextUrl.searchParams.get('next')), request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         * - print-agent (skrip agen printer, diunduh oleh .bat tanpa login)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|print-agent).*)',
    ],
};

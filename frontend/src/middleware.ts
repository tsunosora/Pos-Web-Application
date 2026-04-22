import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const host = request.headers.get('host') ?? '';
    const { pathname } = request.nextUrl;

    // Batasi share domain hanya untuk halaman produk publik (/p/*)
    const shareEnv = process.env.NEXT_PUBLIC_SHARE_DOMAIN;
    const shareHost = shareEnv ? new URL(shareEnv).host : null;
    if (shareHost && host === shareHost && !pathname.startsWith('/p/') && !pathname.startsWith('/_next/') && pathname !== '/manifest.webmanifest') {
        return new NextResponse(null, { status: 404 });
    }

    const token = request.cookies.get('token')?.value;
    const isLoginPage = pathname.startsWith('/login');
    const isPublicPage = pathname.startsWith('/opname/') || pathname.startsWith('/produksi') || pathname.startsWith('/cetak') || pathname.startsWith('/p/') || pathname.startsWith('/so-designer');

    // If there is no token and the user is NOT on the login page (or public paths), redirect to login
    if (!token && !isLoginPage && !isPublicPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If there IS a token and the user is trying to access the login page, redirect to dashboard
    if (token && isLoginPage) {
        return NextResponse.redirect(new URL('/', request.url));
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
         */
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)',
    ],
};

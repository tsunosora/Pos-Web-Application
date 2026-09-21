// Dipakai middleware (server) & interceptor 401 (klien) supaya daftar halaman publik tidak
// berbeda di dua tempat.

/** Halaman yang boleh dibuka tanpa login akun POS. */
export function halamanPublik(pathname: string): boolean {
    // /produksi (layar PIN operator) publik, KECUALI /produksi/pipeline (kanban admin → JWT).
    const isProduksiPublic = pathname.startsWith('/produksi') && !pathname.startsWith('/produksi/pipeline');
    // Kebijakan Privasi & Penghapusan Data: wajib bisa dibuka publik (syarat penerbitan aplikasi Meta).
    const isLegalPage = pathname === '/kebijakan-privasi' || pathname === '/hapus-data';
    return pathname.startsWith('/opname/') || isProduksiPublic || pathname.startsWith('/cetak') || pathname.startsWith('/p/')
        || pathname.startsWith('/so-designer') || pathname.startsWith('/marketing') || pathname.startsWith('/tv')
        || pathname === '/artikel' || pathname.startsWith('/artikel/') || pathname.startsWith('/nilai/')
        || pathname.startsWith('/desainer') || isLegalPage;
}

/** Tujuan setelah login dari ?next= — hanya jalur internal ("/…", bukan "//host" atau URL penuh). */
export function tujuanSetelahLogin(next: string | null | undefined): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/login')) return '/';
    return next;
}

/** URL halaman login yang membawa jalur sekarang supaya user kembali ke sana setelah login. */
export function urlLogin(pathDanQuery: string): string {
    return pathDanQuery && pathDanQuery !== '/' && !pathDanQuery.startsWith('/login')
        ? `/login?next=${encodeURIComponent(pathDanQuery)}`
        : '/login';
}

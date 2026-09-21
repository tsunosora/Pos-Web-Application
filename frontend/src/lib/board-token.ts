/**
 * Token papan kerja (/produksi, /cetak). Perangkat di lantai produksi tidak login
 * dengan akun; setelah PIN benar, server memberi token berumur ±24 jam yang wajib
 * dikirim di header `X-Board-Token` ke endpoint /production & /print-queue.
 */
const KEY = 'board_token';
export const BOARD_EXPIRED_EVENT = 'board-session-expired';

export function getBoardToken(): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Simpan token dari balasan verifikasi PIN (abaikan bila tidak ada). */
export function rememberBoardToken(res: { boardToken?: string } | null | undefined) {
    if (!res?.boardToken || typeof window === 'undefined') return;
    try { localStorage.setItem(KEY, res.boardToken); } catch { /* storage diblokir */ }
}

export function clearBoardToken() {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Perangkat ini punya bekal memanggil endpoint papan kerja (token papan kerja atau login akun)? */
export function hasBoardAccess(): boolean {
    if (getBoardToken()) return true;
    try { return !!(localStorage.getItem('token') || sessionStorage.getItem('token')); } catch { return false; }
}

/** Header untuk endpoint papan kerja: token akun login (bila ada) + token papan kerja. */
export function boardAuthHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (typeof window === 'undefined') return h;
    try {
        const user = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (user) h['Authorization'] = `Bearer ${user}`;
    } catch { /* ignore */ }
    const board = getBoardToken();
    if (board) h['X-Board-Token'] = board;
    return h;
}

/**
 * Galat axios → Error berisi pesan server (mis. 429 "Terlalu banyak PIN salah…"),
 * supaya layar PIN menampilkan alasan yang jelas, bukan "status code 429".
 */
export function withServerMessage(err: unknown): Error {
    const e = err as { message?: string; response?: { data?: { message?: unknown } } } | null;
    const msg = e?.response?.data?.message;
    return new Error(typeof msg === 'string' && msg ? msg : e?.message || 'Gagal menghubungi server.');
}

/** Halaman papan kerja yang punya layar PIN sendiri (bukan halaman kantor). */
export function isBoardPage(pathname: string): boolean {
    return pathname === '/cetak' || pathname === '/produksi';
}

/** Server menolak sesi papan kerja → hapus token & minta halaman kembali ke layar PIN. */
export function boardSessionExpired() {
    clearBoardToken();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(BOARD_EXPIRED_EVENT));
}

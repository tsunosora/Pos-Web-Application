/**
 * Ambil JWT secret dengan fail-closed: app menolak boot bila secret tidak di-set
 * atau lemah. Mencegah fallback diam-diam ke nilai default yang bisa ditebak
 * (dulu: 'super-secret'), yang memungkinkan siapa pun memalsukan token.
 */
export function getJwtSecret(): string {
    const s = process.env.JWT_SECRET;
    if (!s || s === 'super-secret' || s.length < 16) {
        throw new Error(
            'JWT_SECRET tidak di-set atau terlalu lemah (min 16 karakter, bukan "super-secret"). ' +
            'Set JWT_SECRET yang kuat di .env sebelum menjalankan aplikasi.',
        );
    }
    return s;
}

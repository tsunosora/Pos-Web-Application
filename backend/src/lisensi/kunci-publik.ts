/**
 * Peta `kid` -> kunci publik penanda tangan lisensi.
 *
 * Kunci PUBLIK aman ditulis di kode, walau reponya nanti dibuka: yang bisa menerbitkan
 * lisensi cuma pemegang kunci PRIVAT (ada di qendali.com, di luar repo). Yang di sini
 * hanya bisa dipakai untuk MEMERIKSA.
 *
 * Rotasi kunci (lihat `docs/lisensi.md` di repo qendali): terbitkan `prod-2`, tambahkan
 * kunci publiknya di sini ATAU lewat env `QENDALI_KUNCI_PUBLIK`, terbitkan ulang lisensi
 * klien, baru hapus `prod-1` setelah semua klien tersegarkan. Karena `kid` ikut di dalam
 * kunci, dua kunci penanda tangan bisa hidup bersamaan tanpa mematikan siapa pun.
 */

/** Kunci pengembangan. Dipakai kunci uji yang dibuat dari repo qendali dengan `--kid=uji-1`. */
const UJI_1 = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMWh3dXB910jHpVpqzXNivcJ+SxC1oJox/sTa4kcdOwc=
-----END PUBLIC KEY-----
`;

/**
 * Kunci PRODUKSI, terbit 26 Sep 2026. Yang menandatangani lisensi klien sungguhan.
 * Privatnya ada di mesin penerbit qendali.com dan tidak pernah masuk repo mana pun.
 */
const PROD_1 = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAO+g//5WH0sDGJCoH0f5yddTr42oB8uRZNGR/odFCwIY=
-----END PUBLIC KEY-----
`;

/**
 * Bawaan yang ikut ter-bundle. Dua kid hidup bersamaan dengan sengaja: `uji-1` untuk
 * pengembangan, `prod-1` untuk klien sungguhan. Kunci berikutnya (`prod-2`) tinggal
 * ditambahkan satu baris di sini, atau lewat env `QENDALI_KUNCI_PUBLIK` supaya tidak
 * perlu build ulang.
 */
const BAWAAN: Record<string, string> = {
    'uji-1': UJI_1,
    'prod-1': PROD_1,
};

/**
 * Kunci tambahan dari env: JSON `{"prod-1":"-----BEGIN PUBLIC KEY-----\\n…"}`.
 * Dipakai supaya kunci produksi bisa dipasang tanpa menyunting kode. Isi yang tidak
 * berbentuk JSON diabaikan dengan peringatan — jangan sampai salah ketik di `.env`
 * membuat seluruh lisensi tak terverifikasi tanpa jejak.
 */
function dariEnv(): Record<string, string> {
    const mentah = (process.env.QENDALI_KUNCI_PUBLIK ?? '').trim();
    if (!mentah) return {};
    try {
        const isi = JSON.parse(mentah) as Record<string, unknown>;
        const hasil: Record<string, string> = {};
        for (const [kid, pem] of Object.entries(isi)) {
            if (typeof pem === 'string' && pem.includes('BEGIN PUBLIC KEY')) hasil[kid] = pem;
        }
        return hasil;
    } catch {
        // eslint-disable-next-line no-console
        console.warn('[Lisensi] QENDALI_KUNCI_PUBLIK bukan JSON yang sah — diabaikan.');
        return {};
    }
}

/** Peta yang dipakai verifikasi. Env menimpa bawaan dengan kid yang sama. */
export function kunciPublikLisensi(): Record<string, string> {
    return { ...BAWAAN, ...dariEnv() };
}

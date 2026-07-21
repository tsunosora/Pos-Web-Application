import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifikasi signature webhook Meta (`X-Hub-Signature-256: sha256=<hex>`).
 * HMAC-SHA256 atas RAW body (bukan hasil JSON.stringify — byte harus persis
 * seperti yang dikirim Meta) memakai App Secret. Perbandingan timing-safe.
 *
 * @returns true HANYA jika signature valid & argumen lengkap.
 */
export function verifyMetaSignature(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
    appSecret: string | undefined,
): boolean {
    if (!rawBody || !signatureHeader || !appSecret) return false;
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

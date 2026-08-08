import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Role di sistem ini DIBUAT DINAMIS oleh admin (nama bebas, mis. "Desainer",
 * "Tim Marketing", "Customer Service"). Maka pencocokan role WA memakai KATA KUNCI
 * (sejalan dengan heuristik isDesigner/isManager di frontend), bukan token persis.
 */
const norm = (r?: string | null) => String(r ?? '').toLowerCase();

export function isDesignerRole(roleName?: string | null): boolean {
    const n = norm(roleName);
    return n.includes('desain') || n.includes('design');
}

export function isOperatorRole(roleName?: string | null): boolean {
    return norm(roleName).includes('operator');
}

/** Role yang inbox-nya DIBATASI ke "milik saya + belum di-assign" (bukan lihat semua). */
export function isScopedInboxRole(roleName?: string | null): boolean {
    return isDesignerRole(roleName) || isOperatorRole(roleName);
}

/** Boleh mengakses inbox WA (staf yang berkomunikasi dengan pelanggan). */
export function roleCanInbox(roleName?: string | null): boolean {
    const n = norm(roleName);
    if (!n) return false;
    // Token pendek/ambigu dicocokkan sebagai kata utuh (hindari false-match).
    const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.includes('cs') || tokens.includes('sales')) return true;
    return (
        isDesignerRole(n) ||
        isOperatorRole(n) ||
        /(owner|pemilik|admin|manaj|manager|supervisor|kepala|customer|service|layanan|pelanggan|marketing|market)/.test(n)
    );
}

/** Guard akses inbox WA berbasis kata kunci role (dinamis). Butuh JwtAuthGuard sebelum ini. */
@Injectable()
export class WaInboxGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const { user } = ctx.switchToHttp().getRequest();
        if (!roleCanInbox(user?.roleName)) {
            throw new ForbiddenException('Akses inbox WhatsApp ditolak untuk role ini');
        }
        return true;
    }
}

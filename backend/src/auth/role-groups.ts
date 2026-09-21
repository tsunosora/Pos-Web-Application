import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Kelompok peran untuk penjaga izin di server. Nama peran dibuat bebas oleh
 * owner (mis. "Manajer Toko", "Kepala Produksi"), jadi dicocokkan per kata kunci.
 *
 * - Setingkat manajer: SAMA PERSIS dengan `isManager` di frontend
 *   (frontend/src/hooks/useCurrentUser.ts): peran yang melihat SEMUA menu.
 *   Menu dan server harus sepakat; kalau tidak, tombol tampil tapi ditolak,
 *   atau sebaliknya menu tersembunyi tapi endpoint-nya terbuka.
 * - Setingkat owner: owner/pemilik/superadmin.
 */
const norm = (r?: string | null) => String(r ?? '').trim().toLowerCase();
const OWNER_NAMES = ['owner', 'pemilik', 'superadmin', 'super_admin', 'super admin'];

export function isOwnerLevelRole(roleName?: string | null): boolean {
    return OWNER_NAMES.includes(norm(roleName));
}

export function isManagerLevelRole(roleName?: string | null): boolean {
    const n = norm(roleName);
    return isOwnerLevelRole(n) || n === 'admin' || /manajer|manager|supervisor|kepala/.test(n);
}

/** Pakai SETELAH JwtAuthGuard: `@UseGuards(JwtAuthGuard, ManagerGuard)`. */
@Injectable()
export class ManagerGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const { user } = ctx.switchToHttp().getRequest();
        if (!isManagerLevelRole(user?.roleName)) {
            throw new ForbiddenException('Akses ditolak: hanya owner, admin, atau manajer.');
        }
        return true;
    }
}

/**
 * Menu yang boleh dibuka tiap peran — CERMIN dari frontend
 * (frontend/src/components/layout/nav-config.ts: MENU_PRESETS & resolveAllowedHrefs).
 * Kalau preset di sana berubah, ubah juga di sini.
 */
const TEAM_BASE = ['/beranda', '/leaderboard', '/tugas', '/tugas/papan-piket'];
const MENU_PRESETS: { match: (n: string) => boolean; hrefs: string[] }[] = [
    { match: (n) => n.includes('kasir') || n.includes('cashier'),
      hrefs: [...TEAM_BASE, '/pos', '/reports/sales', '/reports/shift-history', '/transactions/dp', '/customers', '/invoices', '/sales-orders', '/cashflow'] },
    { match: (n) => n === 'cs' || n.includes('customer') || n.includes('marketing') || n.includes('sales'),
      hrefs: [...TEAM_BASE, '/crm', '/customers', '/crm/leads', '/crm/follow-ups', '/crm/templates', '/invoices', '/sales-orders', '/crm/whatsapp', '/crm/social', '/crm/whatsapp/broadcast', '/crm/whatsapp/qr', '/crm/whatsapp/quick-replies', '/crm/whatsapp/templates'] },
    { match: (n) => n.includes('desain') || n.includes('designer'),
      hrefs: [...TEAM_BASE, '/desainer', '/sales-orders', '/crm/leads', '/crm/whatsapp', '/produksi', '/produksi/pipeline', '/print-queue'] },
    { match: (n) => n.includes('operator') || n.includes('produksi') || n.includes('cetak') || n.includes('print'),
      hrefs: [...TEAM_BASE, '/produksi', '/produksi/pipeline', '/print-queue', '/click-counting', '/titipan-masuk', '/titipan-keluar', '/branch-ledger', '/inventory', '/inventory/opname', '/crm/whatsapp'] },
];

/** Apakah peran ini boleh membuka menu `href` (setingkat manajer selalu boleh)? */
export function roleCanOpenMenu(roleName: string | null | undefined, menuAccess: unknown, href: string): boolean {
    if (isManagerLevelRole(roleName)) return true;
    if (Array.isArray(menuAccess)) return menuAccess.includes(href);
    const n = norm(roleName);
    const preset = MENU_PRESETS.find((p) => p.match(n));
    return !!preset?.hrefs.includes(href);
}

const MENU_KEY = 'menuHref';
/** Endpoint milik sebuah menu: `@Menu('/reports/profit')` + `@UseGuards(JwtAuthGuard, MenuGuard)`. */
export const Menu = (href: string) => SetMetadata(MENU_KEY, href);

/**
 * Server ikut menegakkan "Akses Menu Role": endpoint sebuah halaman hanya boleh
 * dipanggil peran yang memang diberi menu itu. Dulu menu hanya disembunyikan di
 * tampilan, jadi siapa pun yang tahu alamat endpoint tetap bisa memakainya.
 */
@Injectable()
export class MenuGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const href = this.reflector.getAllAndOverride<string>(MENU_KEY, [ctx.getHandler(), ctx.getClass()]);
        if (!href) return true;
        const { user } = ctx.switchToHttp().getRequest();
        if (!roleCanOpenMenu(user?.roleName, user?.menuAccess, href)) {
            throw new ForbiddenException('Akses ditolak: peran Anda tidak diberi menu ini. Minta owner mengaturnya di Akses Menu Role.');
        }
        return true;
    }
}

/** Pakai SETELAH JwtAuthGuard: `@UseGuards(JwtAuthGuard, OwnerGuard)`. */
@Injectable()
export class OwnerGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const { user } = ctx.switchToHttp().getRequest();
        if (!isOwnerLevelRole(user?.roleName)) {
            throw new ForbiddenException('Akses ditolak: hanya owner.');
        }
        return true;
    }
}

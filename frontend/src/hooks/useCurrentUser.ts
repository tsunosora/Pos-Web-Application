import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMe } from '@/lib/api';
import { resolveAllowedHrefs } from '@/components/layout/nav-config';

const OWNER_ROLE_NAMES = ['owner', 'superadmin', 'super_admin', 'super admin'];

export function useCurrentUser() {
    const { data } = useQuery({
        queryKey: ['current-user'],
        queryFn: getMe,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const isManager = useMemo(() => {
        if (!data?.role) return false;
        const n = data.role.name.toLowerCase();
        return (
            n === 'admin' ||
            n === 'owner' ||
            n === 'pemilik' ||
            n.includes('manajer') ||
            n.includes('manager') ||
            n.includes('supervisor') ||
            n.includes('kepala')
        );
    }, [data]);

    const isOwner = useMemo(() => {
        if (!data?.role) return false;
        const n = data.role.name.toLowerCase();
        return OWNER_ROLE_NAMES.includes(n);
    }, [data]);

    // Boleh memberi/mengelola tugas (Papan Tugas): Owner + Manajer SAJA.
    // Admin biasa TIDAK termasuk (beda dengan isManager yang memasukkan admin).
    const canAssignTasks = useMemo(() => {
        if (!data?.role) return false;
        const n = data.role.name.toLowerCase();
        return (
            OWNER_ROLE_NAMES.includes(n) ||
            n === 'pemilik' ||
            n.includes('manajer') ||
            n.includes('manager') ||
            n.includes('supervisor') ||
            n.includes('kepala')
        );
    }, [data]);

    // Role Designer (akses halaman Studio Desain). Role dibuat dinamis oleh admin,
    // jadi cocokkan berdasarkan nama (mis. "Desainer" / "Designer").
    const isDesigner = useMemo(() => {
        if (!data?.role) return false;
        const n = data.role.name.toLowerCase();
        return n.includes('desain') || n.includes('designer');
    }, [data]);

    // Role Operator (divisi cetak/produksi). Inbox WA dibatasi "milik saya + pool".
    const isOperator = useMemo(() => {
        if (!data?.role) return false;
        return data.role.name.toLowerCase().includes('operator');
    }, [data]);

    const branchId = data?.branchId ?? null;
    const branchName = data?.branch?.name ?? null;
    const branchCode = data?.branch?.code ?? null;

    const roleName = data?.role?.name ?? null;
    const menuAccess = data?.role?.menuAccess ?? null;

    // Set href menu yang boleh dilihat user (null = lihat semua, utk owner/manajer).
    const navAllowed = useMemo(
        () => resolveAllowedHrefs({ isOwner, isManager, roleName, menuAccess }),
        [isOwner, isManager, roleName, menuAccess],
    );

    return { currentUser: data, isManager, isOwner, isDesigner, isOperator, canAssignTasks, branchId, branchName, branchCode, roleName, menuAccess, navAllowed };
}

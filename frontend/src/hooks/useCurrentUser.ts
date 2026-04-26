import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMe } from '@/lib/api';

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

    const branchId = data?.branchId ?? null;
    const branchName = data?.branch?.name ?? null;
    const branchCode = data?.branch?.code ?? null;

    return { currentUser: data, isManager, isOwner, branchId, branchName, branchCode };
}

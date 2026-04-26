"use client";

import { Store, CreditCard, Users, Settings, MessageCircle, Building2, Paintbrush, HardDrive, Bell, Palette, GitBranch, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_GROUPS: { title: string; items: { href: string; icon: any; label: string }[] }[] = [
    {
        title: 'Toko',
        items: [
            { href: '/settings/general', icon: Store, label: 'Profil Toko' },
            { href: '/settings/payments', icon: CreditCard, label: 'Pembayaran' },
            { href: '/settings/bank-accounts', icon: Building2, label: 'Rekening Bank' },
            { href: '/settings/login', icon: Paintbrush, label: 'Tampilan Login' },
        ],
    },
    {
        title: 'Tim & Cabang',
        items: [
            { href: '/settings/users', icon: Users, label: 'Manajemen Staf' },
            { href: '/settings/designers', icon: Palette, label: 'Kelola Desainer' },
            { href: '/settings/branches', icon: GitBranch, label: 'Cabang Perusahaan' },
            { href: '/settings/branch-config', icon: SlidersHorizontal, label: 'Per Cabang' },
        ],
    },
    {
        title: 'Sistem',
        items: [
            { href: '/settings/whatsapp', icon: MessageCircle, label: 'Bot WhatsApp' },
            { href: '/settings/notifications', icon: Bell, label: 'Notifikasi' },
            { href: '/settings/backup', icon: HardDrive, label: 'Backup & Recovery' },
        ],
    },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <div className="flex flex-col md:flex-row md:h-[calc(100vh-8rem)] gap-4 md:gap-6">
            {/* Settings Nav */}
            <aside className="md:w-64 rounded-xl border border-border bg-card shadow-sm overflow-hidden md:shrink-0 md:flex md:flex-col">
                {/* Header — desktop only */}
                <div className="hidden md:flex items-center gap-2 p-4 border-b border-border bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                        <Settings className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-sm leading-tight">Pengaturan</h2>
                        <p className="text-[11px] text-muted-foreground leading-tight">Konfigurasi sistem</p>
                    </div>
                </div>

                {/* Mobile — horizontal scroll bar */}
                <nav className="md:hidden flex gap-1 p-2 overflow-x-auto">
                    {NAV_GROUPS.flatMap(g => g.items).map(({ href, icon: Icon, label }) => {
                        const active = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={label}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg shrink-0 transition-colors',
                                    active
                                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Desktop — grouped vertical */}
                <nav className="hidden md:flex md:flex-col p-3 gap-4 overflow-y-auto flex-1">
                    {NAV_GROUPS.map(group => (
                        <div key={group.title}>
                            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.title}</p>
                            <div className="space-y-0.5">
                                {group.items.map(({ href, icon: Icon, label }) => {
                                    const active = pathname === href;
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            title={label}
                                            className={cn(
                                                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                                                active
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                                            <span className="truncate">{label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-y-auto min-h-0">
                {children}
            </div>
        </div>
    );
}

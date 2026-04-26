"use client";

import { Bell, User, Menu, ChevronDown, LogOut, FileText, Settings, Building2, ShoppingCart, Package, RefreshCw, GitCommit, Info, CheckCheck, Trash2 } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { useNotificationStore, AppNotification } from "@/store/notification-store";
import { BranchSwitcher } from "./BranchSwitcher";

// ── Helpers ────────────────────────────────────────────────────────────────
function relativeTime(timestamp: number): string {
    const diff = (Date.now() - timestamp) / 1000;
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}

function NotifIcon({ type }: { type: AppNotification['type'] }) {
    const base = "w-4 h-4";
    switch (type) {
        case 'transaction': return <ShoppingCart className={`${base} text-emerald-600`} />;
        case 'stock': return <Package className={`${base} text-amber-600`} />;
        case 'sync': return <RefreshCw className={`${base} text-blue-600`} />;
        case 'shift': return <FileText className={`${base} text-indigo-600`} />;
        case 'update': return <GitCommit className={`${base} text-violet-600`} />;
        default: return <Info className={`${base} text-slate-500`} />;
    }
}

function notifBg(type: AppNotification['type']): string {
    switch (type) {
        case 'transaction': return 'bg-emerald-100';
        case 'stock': return 'bg-amber-100';
        case 'sync': return 'bg-blue-100';
        case 'shift': return 'bg-indigo-100';
        case 'update': return 'bg-violet-100';
        default: return 'bg-slate-100';
    }
}

export function Header() {
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);
    const router = useRouter();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    // Notification store
    const notifications = useNotificationStore(s => s.notifications);
    const unreadCount = useNotificationStore(s => s.unreadCount);
    const markRead = useNotificationStore(s => s.markRead);
    const markAllRead = useNotificationStore(s => s.markAllRead);
    const clearAll = useNotificationStore(s => s.clearAll);

    // Store settings
    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    // Decode user from JWT
    const [userName, setUserName] = useState('Admin');
    useEffect(() => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.name) setUserName(payload.name);
                else if (payload.email) setUserName(payload.email.split('@')[0]);
            }
        } catch { /* ignore */ }
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleLogout = () => {
        if (confirm('Yakin ingin keluar dari aplikasi?')) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            router.push('/login');
        }
    };

    const storeName = settings?.storeName || 'PosPro';
    const visibleNotifs = notifications.slice(0, 12);

    const handleBellClick = () => {
        setNotifOpen(prev => !prev);
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            {/* Hamburger mobile */}
            <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={toggleSidebar}>
                <Menu className="h-6 w-6" />
            </button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex-1" />

                <div className="flex items-center gap-x-3 lg:gap-x-5">

                    {/* Branch Switcher (Owner) / Badge (Staff) */}
                    <BranchSwitcher />

                    {/* Laporan Shift Button */}
                    <button
                        type="button"
                        onClick={() => router.push('/pos/close-shift')}
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 sm:px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border border-indigo-200"
                    >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Laporan Shift</span>
                    </button>

                    {/* ── Notification Bell ─────────────────────────────────── */}
                    <div className="relative" ref={notifRef}>
                        <button
                            type="button"
                            onClick={handleBellClick}
                            className="-m-2.5 p-2.5 text-muted-foreground hover:text-foreground transition-colors relative"
                            aria-label="Notifikasi"
                        >
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <div className="absolute right-0 mt-2 w-96 rounded-xl bg-background shadow-2xl ring-1 ring-black/5 border border-border overflow-hidden z-50 flex flex-col max-h-[80vh]">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-muted-foreground" />
                                        <p className="font-semibold text-sm">Notifikasi</p>
                                        {unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllRead}
                                                className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-muted transition-colors"
                                                title="Tandai semua dibaca"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Semua dibaca</span>
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={clearAll}
                                                className="flex items-center gap-1 text-xs text-red-500 hover:underline px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                title="Hapus semua"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* List */}
                                <div className="overflow-y-auto flex-1 divide-y divide-border">
                                    {visibleNotifs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                                            <Bell className="w-8 h-8 opacity-30" />
                                            <p className="text-sm">Tidak ada notifikasi</p>
                                        </div>
                                    ) : (
                                        visibleNotifs.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => markRead(notif.id)}
                                                className={`flex gap-3 p-4 hover:bg-muted/40 cursor-pointer transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full ${notifBg(notif.type)} flex items-center justify-center shrink-0`}>
                                                    <NotifIcon type={notif.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <p className={`text-sm font-medium truncate ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                            {notif.title}
                                                        </p>
                                                        {!notif.read && (
                                                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                                                        {relativeTime(notif.timestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-2.5 text-center border-t shrink-0">
                                    <button
                                        onClick={() => { router.push('/settings/notifications'); setNotifOpen(false); }}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Pengaturan Notifikasi
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" />

                    {/* Account Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="-m-1.5 flex items-center gap-2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
                                {logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-primary font-bold text-sm">
                                        {userName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <span className="hidden lg:flex lg:items-center gap-1">
                                <span className="text-sm font-semibold leading-6 text-foreground">{userName}</span>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </span>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-background shadow-xl ring-1 ring-black/5 border border-border overflow-hidden z-50">
                                <div className="px-4 py-3 bg-muted/50 border-b">
                                    <p className="text-xs text-muted-foreground">Login sebagai</p>
                                    <p className="text-sm font-semibold truncate">{userName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{storeName}</p>
                                </div>

                                <div className="py-1">
                                    <button
                                        onClick={() => { router.push('/settings/users'); setDropdownOpen(false); }}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                                    >
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        Manajemen Staff
                                    </button>
                                    <button
                                        onClick={() => { router.push('/settings/general'); setDropdownOpen(false); }}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Settings className="h-4 w-4 text-muted-foreground" />
                                        Pengaturan Toko
                                    </button>
                                    <button
                                        onClick={() => { router.push('/settings/bank-accounts'); setDropdownOpen(false); }}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        Rekening Bank
                                    </button>
                                </div>

                                <div className="border-t py-1">
                                    <button
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Keluar (Logout)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

"use client";

import { Bell, User, Menu, ChevronDown, LogOut, FileText, Settings, Building2, AlertCircle } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export function Header() {
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);
    const router = useRouter();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    // Ambil nama dan logo toko dari settings
    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000, // cache 5 menit
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    // Ambil nama user dari localStorage/JWT
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

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
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

    return (
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            {/* Hamburger mobile */}
            <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={toggleSidebar}>
                <Menu className="h-6 w-6" />
            </button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex-1" />

                <div className="flex items-center gap-x-3 lg:gap-x-5">

                    {/* Tombol Laporan Shift */}
                    <button
                        type="button"
                        onClick={() => router.push('/pos/close-shift')}
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 sm:px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border border-indigo-200"
                    >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Laporan Shift</span>
                    </button>

                    {/* Notifikasi Bell */}
                    <div className="relative" ref={notifRef}>
                        <button
                            type="button"
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="-m-2.5 p-2.5 text-muted-foreground hover:text-foreground transition-colors relative"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                        </button>

                        {notifOpen && (
                            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-background shadow-xl ring-1 ring-black/5 border border-border overflow-hidden z-50">
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                                    <p className="font-semibold text-sm">Notifikasi</p>
                                    <span className="text-xs text-muted-foreground">Hari ini</span>
                                </div>
                                <div className="divide-y divide-border">
                                    <div className="flex gap-3 p-4 hover:bg-muted/40 cursor-pointer">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                            <AlertCircle className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Shift belum ditutup</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Jangan lupa kirim laporan tutup shift sebelum pulang.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 p-4 hover:bg-muted/40 cursor-pointer">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                            <Building2 className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Rekening Bank</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Pastikan saldo awal rekening sudah diatur di Pengaturan.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-2 text-center border-t">
                                    <button onClick={() => { router.push('/settings'); setNotifOpen(false); }} className="text-xs text-primary hover:underline">
                                        Buka Pengaturan
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" />

                    {/* Dropdown Akun */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="-m-1.5 flex items-center gap-2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                            {/* Avatar: logo toko atau inisial */}
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
                                {/* Info nama toko */}
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

"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Loader2, Lock } from "lucide-react";

// Halaman Studio Desain: menyematkan sub-app feeds-auto (statis di
// /studio-desain/) sebagai iframe full-screen. Akses digembok:
//  - middleware POS mewajibkan JWT (route ini BUKAN path publik), dan
//  - role: khusus Designer (+ Owner/Admin/Manajer lewat isManager).
export default function DesainerPage() {
    const { currentUser, isManager, isDesigner } = useCurrentUser();
    const allowed = isManager || isDesigner;

    // Saat role masih dimuat, jangan flash "akses ditolak".
    if (!currentUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                    <Lock className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Khusus Designer</h1>
                <p className="max-w-sm text-sm text-muted-foreground">
                    Halaman Studio Desain hanya bisa diakses oleh role Designer.
                </p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 overflow-hidden overscroll-none bg-black">
            <iframe
                // Path file eksplisit: Next menyajikan public/ tanpa resolusi index
                // direktori, jadi "/studio-desain/" bisa 404. Aset internal tetap
                // absolut (/studio-desain/assets/...) sehingga resolve dengan benar.
                src="/studio-desain/index.html"
                title="Studio Desain"
                className="h-full w-full border-0"
                allow="clipboard-write; clipboard-read"
            />
        </div>
    );
}

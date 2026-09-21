import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Kerangka halaman hukum publik (Kebijakan Privasi, Penghapusan Data) — syarat
 * Meta untuk menerbitkan aplikasi Instagram/Messenger. Identitas usaha diambil
 * dari Profil Toko (/settings/public), bukan ditulis mati di kode.
 */
export interface StoreInfo {
    name: string;
    phone: string | null;
    address: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function getStoreInfo(): Promise<StoreInfo> {
    try {
        const r = await fetch(`${API}/settings/public`, { cache: "no-store" });
        const s = await r.json();
        return { name: s?.storeName || "Toko kami", phone: s?.storePhone ?? null, address: s?.storeAddress ?? null };
    } catch {
        return { name: "Toko kami", phone: null, address: null };
    }
}

/** 0813… → https://wa.me/62813… */
export function waLink(phone: string | null): string | null {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits.startsWith("0") ? `62${digits.slice(1)}` : digits}`;
}

export function LegalPage({ title, updated, store, children }: { title: string; updated: string; store: StoreInfo; children: ReactNode }) {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 leading-relaxed">
                <p className="text-sm font-semibold text-primary">{store.name}</p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui / Last updated: {updated}</p>
                <div className="mt-8 space-y-8">{children}</div>
                <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">{store.name}</p>
                    {store.address && <p>{store.address}</p>}
                    {store.phone && <p>Telepon / WhatsApp: {store.phone}</p>}
                    <p className="pt-2 flex gap-4">
                        <Link href="/kebijakan-privasi" className="underline hover:text-foreground">Kebijakan Privasi</Link>
                        <Link href="/hapus-data" className="underline hover:text-foreground">Penghapusan Data</Link>
                    </p>
                </footer>
            </article>
        </main>
    );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <div className="space-y-3 text-[15px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5">{children}</div>
        </section>
    );
}

/** Blok ringkasan bahasa Inggris untuk peninjau Meta. */
export function English({ children }: { children: ReactNode }) {
    return (
        <section className="rounded-2xl border border-border bg-muted/40 p-5 space-y-3 text-[15px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5">
            <h2 className="text-lg font-bold">English</h2>
            {children}
        </section>
    );
}

import type { Metadata } from "next";
import { LandingRender } from "./LandingRender";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// SEO dari config landing (server-side fetch)
export async function generateMetadata(): Promise<Metadata> {
    try {
        const res = await fetch(`${API}/landing/public`, { cache: "no-store" });
        const d = await res.json();
        return {
            title: d?.seoTitle || "Beranda",
            description: d?.seoDescription || undefined,
            icons: d?.faviconUrl ? [{ url: d.faviconUrl.startsWith("http") ? d.faviconUrl : `${API}${d.faviconUrl}` }] : undefined,
        };
    } catch {
        return { title: "Beranda" };
    }
}

export default function LandingPage() {
    return <LandingRender />;
}

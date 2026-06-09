"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const img = (u?: string) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);
const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

function priceOf(p: any): number {
    const prices = (p.variants || [])
        .map((v: any) => Number(v.price))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    if (prices.length) return Math.min(...prices);
    return Number(p.price) || 0;
}
function imageOf(p: any): string {
    if (p.imageUrl) return img(p.imageUrl);
    const v = (p.variants || []).find((x: any) => x.imageUrl);
    return v ? img(v.imageUrl) : "";
}

export function ProductGridRender({
    heading,
    mode = "all",
    categoryId,
    productIds,
    sort = "newest",
    limit = 6,
    columns = "auto",
    accent = "#4f46e5",
    cta = "on",
    ctaLabel = "Pesan via WhatsApp",
    waNumber,
    ctaLink,
}: {
    heading?: string;
    mode?: "all" | "category" | "manual";
    categoryId?: string;
    productIds?: number[];
    sort?: "newest" | "name" | "priceAsc" | "priceDesc";
    limit?: number;
    columns?: "auto" | "2" | "3" | "4";
    accent?: string;
    cta?: "on" | "off";
    ctaLabel?: string;
    waNumber?: string;
    ctaLink?: string;
}) {
    const [all, setAll] = useState<any[] | null>(null);
    const [storePhone, setStorePhone] = useState<string>("");

    useEffect(() => {
        fetch(`${API}/products/public`, { cache: "no-store" })
            .then((r) => r.json())
            .then((list) => setAll(Array.isArray(list) ? list : []))
            .catch(() => setAll([]));
    }, []);

    // Fallback nomor WA dari pengaturan toko kalau waNumber tidak diisi
    useEffect(() => {
        fetch(`${API}/settings/public`, { cache: "no-store" })
            .then((r) => r.json())
            .then((s) => setStorePhone(s?.storePhone || s?.phone || ""))
            .catch(() => {});
    }, []);

    let items = all || [];
    if (mode === "category" && categoryId) {
        items = items.filter((p) => String(p.categoryId ?? p.category?.id) === String(categoryId));
    } else if (mode === "manual") {
        const ids = Array.isArray(productIds) ? productIds : [];
        items = items.filter((p) => ids.includes(p.id));
    }

    items = [...items];
    if (mode === "manual" && Array.isArray(productIds)) {
        items.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id));
    } else if (sort === "name") {
        items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (sort === "priceAsc") {
        items.sort((a, b) => priceOf(a) - priceOf(b));
    } else if (sort === "priceDesc") {
        items.sort((a, b) => priceOf(b) - priceOf(a));
    } else {
        items.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }
    items = items.slice(0, Number(limit) || 6);

    const gridCols =
        columns && columns !== "auto" ? `repeat(${columns}, 1fr)` : "repeat(auto-fill, minmax(210px, 1fr))";
    const wa = (waNumber || storePhone || "").replace(/\D/g, "");

    return (
        <section style={{ padding: "40px 24px", maxWidth: 1140, margin: "0 auto", textAlign: "center" }}>
            <style>{`
.lp-pc{border:1px solid #eef0f3;border-radius:16px;overflow:hidden;background:#fff;transition:transform .25s ease, box-shadow .25s ease;display:flex;flex-direction:column;text-align:left}
.lp-pc:hover{transform:translateY(-6px);box-shadow:0 18px 34px -18px rgba(0,0,0,.30)}
.lp-pc__imgwrap{position:relative;overflow:hidden;aspect-ratio:1/1;background:#f1f5f9}
.lp-pc__img{width:100%;height:100%;object-fit:cover;transition:transform .45s ease;display:block}
.lp-pc:hover .lp-pc__img{transform:scale(1.07)}
.lp-pc__cat{position:absolute;top:10px;left:10px;background:rgba(255,255,255,.92);color:#475569;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;backdrop-filter:blur(4px)}
.lp-pc__body{padding:14px;display:flex;flex-direction:column;gap:6px;flex:1}
.lp-pc__name{font-weight:600;font-size:14px;color:#0f172a;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px;line-height:1.35}
.lp-pc__btn{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:6px;color:#fff;font-size:12.5px;font-weight:700;padding:9px;border-radius:10px;text-decoration:none;transition:opacity .2s}
.lp-pc__btn:hover{opacity:.9}
`}</style>

            {heading && <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 24, color: "#0f172a" }}>{heading}</h2>}

            {all === null ? (
                <p style={{ color: "#94a3b8" }}>Memuat produk…</p>
            ) : items.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>Belum ada produk.</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 18 }}>
                    {items.map((p) => {
                        const src = imageOf(p);
                        const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Halo, saya mau pesan " + p.name)}` : null;
                        const href = waLink || ctaLink || "#";
                        const isWa = !!waLink;
                        return (
                            <div key={p.id} className="lp-pc">
                                <div className="lp-pc__imgwrap">
                                    {src
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img className="lp-pc__img" src={src} alt={p.name} />
                                        : <div style={{ width: "100%", height: "100%" }} />}
                                    {p.category?.name && <span className="lp-pc__cat">{p.category.name}</span>}
                                </div>
                                <div className="lp-pc__body">
                                    <p className="lp-pc__name">{p.name}</p>
                                    <p style={{ color: accent, fontWeight: 800, fontSize: 16, margin: 0 }}>{rupiah(priceOf(p))}</p>
                                    {cta === "on" && (
                                        <a className="lp-pc__btn" href={href} target="_blank" rel="noreferrer" style={{ background: isWa ? "#25D366" : accent }}>
                                            {ctaLabel || (isWa ? "Pesan via WhatsApp" : "Pesan")}
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

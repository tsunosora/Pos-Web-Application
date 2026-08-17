import { useEffect, useRef, useState } from "react";

/**
 * Render bertahap (infinite scroll) untuk daftar besar.
 *
 * Menampilkan sebagian item dulu (default 60), lalu menambah saat elemen sentinel
 * discroll mendekati layar. Data PENUH tetap di memori — search/filter dilakukan di
 * luar hook (pada `items`), jadi pencarian tetap mencakup semua produk. Hook hanya
 * membatasi berapa yang DIRENDER ke DOM sekaligus → hemat node & paint di load awal.
 *
 * Reset otomatis ke `step` saat identitas `items` berubah (filter/search/data baru).
 * `sentinelRef` dipasang di elemen kosong di BAWAH daftar yang sedang tampil.
 */
export function useIncrementalRender<T>(items: T[], step = 60) {
    const [count, setCount] = useState(step);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Daftar berganti (mis. hasil filter/search) → kembali ke awal.
    useEffect(() => {
        setCount(step);
    }, [items, step]);

    const hasMore = count < items.length;

    useEffect(() => {
        if (!hasMore) return;
        const el = sentinelRef.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
            },
            { rootMargin: "800px 0px" }, // prefetch sebelum benar-benar terlihat
        );
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, step, items]);

    return {
        visible: count >= items.length ? items : items.slice(0, count),
        hasMore,
        remaining: Math.max(0, items.length - count),
        loadMore: () => setCount((c) => c + step),
        sentinelRef,
    };
}

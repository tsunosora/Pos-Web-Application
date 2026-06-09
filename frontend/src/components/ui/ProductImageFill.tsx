"use client";

import { cn } from "@/lib/utils";

interface Props {
    /** URL gambar sudah lengkap (termasuk API_BASE kalau perlu). null/undefined = pakai fallback. */
    src?: string | null;
    alt?: string;
    /** Konten fallback saat tidak ada gambar (mis. inisial nama / ImageIcon). */
    fallback?: React.ReactNode;
    /** className tambahan untuk wrapper (mis. aspect-square / h-44). */
    className?: string;
    /** Tampilkan gradient overlay tipis di bawah untuk readability. Default true. */
    gradient?: boolean;
    /** Scale-up gambar utama saat hover (efek di card). Default true. */
    hoverZoom?: boolean;
    /** Overlay di atas gambar (mis. checkbox, badge) — di-render paling depan. */
    children?: React.ReactNode;
}

/**
 * Gambar produk dengan "blurred backdrop fill":
 *  - Layer 1: gambar yang sama, diperbesar + di-blur → mengisi seluruh kotak,
 *    otomatis match warna dominan foto (tidak ada whitespace canggung).
 *  - Layer 2: gambar utama dengan object-contain → foto TIDAK ke-crop,
 *    terlihat utuh apapun rasio aslinya.
 *  - Layer 3 (opsional): gradient halus di bawah untuk pemisahan visual.
 *
 * Pakai untuk grid produk POS, kartu inventory, hero detail produk —
 * semua jadi konsisten & rapi walau rasio foto beragam.
 */
export function ProductImageFill({
    src, alt = "", fallback, className, gradient = true, hoverZoom = true, children,
}: Props) {
    return (
        <div className={cn("relative overflow-hidden bg-muted/30", className)}>
            {src ? (
                <>
                    {/* Backdrop blur */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-50"
                    />
                    {/* Gambar utama — utuh */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={alt}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                            "relative w-full h-full object-contain p-1 transition-transform",
                            hoverZoom && "group-hover:scale-105",
                        )}
                    />
                    {gradient && (
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
                    )}
                </>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15 group-hover:from-primary/10 group-hover:to-primary/20 transition-colors">
                    {fallback}
                </div>
            )}
            {children}
        </div>
    );
}

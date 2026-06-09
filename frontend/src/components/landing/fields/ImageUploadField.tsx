"use client";

import { useRef, useState } from "react";
import { uploadWorkOrderImage, resolvePhotoUrl } from "@/lib/api";

/**
 * Custom field Puck untuk upload/atur gambar.
 * Simpan URL relatif (mis. /uploads/xxx.jpg) — di-resolve absolut saat render.
 */
export function ImageUploadField({
    value,
    onChange,
}: {
    value?: string;
    onChange: (v: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const src = value ? resolvePhotoUrl(value) || value : null;

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            alert("File harus berupa gambar.");
            return;
        }
        setBusy(true);
        try {
            const url = await uploadWorkOrderImage(f);
            onChange(url);
        } catch (err: any) {
            alert("Upload gagal: " + (err?.response?.data?.message || err?.message || err));
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {src ? (
                <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt="preview"
                        style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }}
                    />
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        style={{ position: "absolute", top: 4, right: 4, background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" }}
                    >
                        Hapus
                    </button>
                </div>
            ) : (
                <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #cbd5e1", borderRadius: 6, color: "#94a3b8", fontSize: 12 }}>
                    Belum ada gambar
                </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: 6 }}>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    style={{ flex: 1, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
                >
                    {busy ? "Mengunggah..." : src ? "Ganti Gambar" : "Unggah Gambar"}
                </button>
            </div>
            <input
                type="text"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder="atau tempel URL gambar"
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}
            />
        </div>
    );
}

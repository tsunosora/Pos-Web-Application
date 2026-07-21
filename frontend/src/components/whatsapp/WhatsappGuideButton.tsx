"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { WhatsappGuideModal } from "./WhatsappGuideModal";

/** Tombol "Panduan" + modal — dipakai di header tiap halaman WhatsApp CRM. */
export function WhatsappGuideButton({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                title="Panduan penggunaan"
                className={className ?? "p-1.5 rounded-lg hover:bg-muted"}
            >
                <HelpCircle className="w-4 h-4 opacity-70" />
            </button>
            <WhatsappGuideModal open={open} onClose={() => setOpen(false)} />
        </>
    );
}

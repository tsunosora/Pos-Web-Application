"use client";

import { Filter, Layers } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import the map component with SSR disabled
const ProfitMap = dynamic(() => import("./MapComponent"), { ssr: false });

export default function MapsPage() {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="sm:flex sm:items-center sm:justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Peta Cuan Lokasi</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Visualisasi profil dan pendapatan berdasarkan lokasi cabang.</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <button className="flex items-center gap-2 bg-card border border-border text-foreground/80 px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        Filter Cabang
                    </button>
                    <button className="flex items-center gap-2 bg-card border border-border text-foreground/80 px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        Ubah Layer
                    </button>
                </div>
            </div>

            <div className="flex-1 glass rounded-xl border border-border overflow-hidden relative min-h-[500px]">
                {/* Overlay map elements */}
                <div className="absolute top-6 left-6 z-10 bg-card/90 backdrop-blur-sm p-4 rounded-xl border border-border shadow-lg max-w-sm pointer-events-none">
                    <h3 className="font-semibold text-foreground mb-3">Legenda Margins</h3>
                    <div className="space-y-2 text-sm text-foreground/80">
                        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#22c55e] block"></span> Profit Tinggi (&gt; 35%)</div>
                        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#f59e0b] block"></span> Profit Sedang (15% - 35%)</div>
                        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#ef4444] block"></span> Profit Rendah (&lt; 15%)</div>
                    </div>
                </div>

                {/* Actual Map */}
                <ProfitMap />
            </div>
        </div>
    );
}


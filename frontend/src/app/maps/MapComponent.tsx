"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { getBranches } from "@/lib/api";
import { Loader2, Map as MapIcon } from "lucide-react";

// Fix standard Leaflet icon path issues in Next.js
const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

export default function MapComponent() {
    const { data: branches, isLoading, error } = useQuery({
        queryKey: ['branches'],
        queryFn: getBranches
    });

    if (isLoading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-sm">Memuat data lokasi cabang...</p>
            </div>
        );
    }

    if (error || !branches) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50">
                <MapIcon className="h-12 w-12 text-destructive/50 mb-4" />
                <p className="text-destructive text-sm font-medium">Gagal memuat peta.</p>
            </div>
        );
    }

    // Determine center from first branch, fallback to Jakarta center.
    const center: [number, number] = branches.length > 0
        ? [branches[0].latitude, branches[0].longitude]
        : [-6.200000, 106.816666];

    const getColorByMargin = (margin: number) => {
        if (margin > 35) return "#22c55e"; // Green (Tinggi)
        if (margin >= 15) return "#f59e0b"; // Orange (Sedang)
        return "#ef4444"; // Red (Rendah)
    };

    return (
        <MapContainer center={center} zoom={11} className="w-full h-full z-0 relative rounded-xl" scrollWheelZoom={true}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {branches.map((branch: any) => (
                <CircleMarker
                    key={branch.id}
                    center={[branch.latitude, branch.longitude]}
                    radius={12}
                    pathOptions={{
                        color: "hsl(var(--background))",
                        weight: 2,
                        fillColor: getColorByMargin(branch.margin),
                        fillOpacity: 0.9,
                    }}
                >
                    <Popup>
                        <div className="text-sm font-sans min-w-[150px]">
                            <p className="font-semibold text-base mb-0 pb-0">{branch.name}</p>
                            <p className="text-xs text-gray-500 mb-2">{branch.address}</p>
                            <div className="flex justify-between font-medium mt-1">
                                <span className="text-gray-500">Omset:</span>
                                <span>Rp {parseFloat(branch.omset).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span className="text-gray-500">Margin:</span>
                                <span style={{ color: getColorByMargin(branch.margin) }}>{branch.margin}%</span>
                            </div>
                        </div>
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}

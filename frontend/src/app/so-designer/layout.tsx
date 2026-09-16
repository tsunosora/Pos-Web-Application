import { DesignerShiftCheck } from "./DesignerShiftCheck";
import { DesignerPiketGate } from "@/components/tugas/PiketPinMounts";

export default function DesignerPortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            {/* Pengingat ganti shift 13.00 WIB — memastikan desainer yang login masih orang yang sama */}
            <DesignerShiftCheck />
            {/* Tugas piket, pengingat & teguran milik desainer yang login PIN */}
            <DesignerPiketGate />
        </>
    );
}

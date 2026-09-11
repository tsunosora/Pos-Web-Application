import { DesignerShiftCheck } from "./DesignerShiftCheck";

export default function DesignerPortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            {/* Pengingat ganti shift 13.00 WIB — memastikan desainer yang login masih orang yang sama */}
            <DesignerShiftCheck />
        </>
    );
}

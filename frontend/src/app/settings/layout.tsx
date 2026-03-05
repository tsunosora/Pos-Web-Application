import { Store, CreditCard, Users, Settings, MessageCircle, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Settings Sidebar */}
            <div className="w-64 glass rounded-xl overflow-hidden shrink-0 flex flex-col">
                <div className="p-4 border-b border-border bg-card/50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Pengaturan
                    </h2>
                </div>
                <div className="p-2 space-y-1 overflow-y-auto flex-1">
                    <Link href="/settings/general" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Store className="h-4 w-4" />
                        Profil Toko
                    </Link>
                    <Link href="/settings/payments" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <CreditCard className="h-4 w-4" />
                        Metode Pembayaran
                    </Link>
                    <Link href="/settings/users" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Users className="h-4 w-4" />
                        Manajemen Staf
                    </Link>
                    <Link href="/settings/whatsapp" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MessageCircle className="h-4 w-4" />
                        Bot WhatsApp
                    </Link>
                    <Link href="/settings/bank-accounts" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Building2 className="h-4 w-4" />
                        Rekening Bank
                    </Link>
                </div>
            </div>

            {/* Settings Content Area */}
            <div className="flex-1 glass rounded-xl overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

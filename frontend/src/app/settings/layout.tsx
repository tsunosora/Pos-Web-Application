import { Store, CreditCard, Users, Settings, MessageCircle, Building2, Paintbrush, HardDrive, Bell, Palette } from 'lucide-react';
import Link from 'next/link';

const NAV_LINKS = [
    { href: '/settings/general',       icon: Store,          label: 'Profil Toko' },
    { href: '/settings/payments',      icon: CreditCard,     label: 'Pembayaran' },
    { href: '/settings/users',         icon: Users,          label: 'Manajemen Staf' },
    { href: '/settings/whatsapp',      icon: MessageCircle,  label: 'Bot WhatsApp' },
    { href: '/settings/bank-accounts', icon: Building2,      label: 'Rekening Bank' },
    { href: '/settings/login',         icon: Paintbrush,     label: 'Tampilan Login' },
    { href: '/settings/backup',        icon: HardDrive,      label: 'Backup & Recovery' },
    { href: '/settings/notifications',  icon: Bell,           label: 'Notifikasi' },
    { href: '/settings/designers',      icon: Palette,        label: 'Kelola Desainer' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col md:flex-row md:h-[calc(100vh-8rem)] gap-4 md:gap-6">
            {/* Settings Nav — horizontal tabs on mobile, vertical sidebar on desktop */}
            <div className="md:w-64 glass rounded-xl overflow-hidden md:shrink-0 md:flex md:flex-col">
                {/* Header — desktop only */}
                <div className="hidden md:flex p-4 border-b border-border bg-card/50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Pengaturan
                    </h2>
                </div>
                {/* Nav links — icon-only on mobile, icon+text on desktop */}
                <nav className="flex md:flex-col p-2 gap-1 justify-around md:justify-start md:overflow-y-auto md:flex-1">
                    {NAV_LINKS.map(({ href, icon: Icon, label }) => (
                        <Link
                            key={href}
                            href={href}
                            title={label}
                            className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 p-2.5 md:px-3 md:py-2.5 rounded-xl md:rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <Icon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                            <span className="hidden md:inline text-sm font-medium">{label}</span>
                        </Link>
                    ))}
                </nav>
            </div>

            {/* Settings Content Area */}
            <div className="flex-1 glass rounded-xl overflow-y-auto min-h-0">
                {children}
            </div>
        </div>
    );
}

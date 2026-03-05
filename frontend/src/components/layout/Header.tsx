import { Bell, User, Menu, ChevronDown, LogOut, FileText } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";

export function Header() {
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);

    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            <button
                type="button"
                className="-m-2.5 p-2.5 text-foreground lg:hidden"
                onClick={toggleSidebar}
            >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex-1"></div>

                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    {/* Separator */}
                    <div
                        className="hidden lg:block lg:h-6 lg:w-px lg:bg-border"
                        aria-hidden="true"
                    />

                    <button
                        type="button"
                        onClick={() => window.location.href = '/pos/close-shift'}
                        className="hidden sm:flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border border-indigo-200"
                    >
                        <FileText className="h-4 w-4" />
                        Laporan Shift
                    </button>

                    <button
                        type="button"
                        className="-m-2.5 p-2.5 text-muted-foreground hover:text-foreground transition-colors relative"
                    >
                        <span className="sr-only">View notifications</span>
                        <Bell className="h-5 w-5" aria-hidden="true" />
                        <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    </button>

                    {/* Profile dropdown Placeholder */}
                    <div className="relative group">
                        <button
                            type="button"
                            className="-m-1.5 flex items-center p-1.5 hover:bg-muted rounded-full transition-colors"
                            id="user-menu-button"
                            aria-expanded="false"
                            aria-haspopup="true"
                        >
                            <span className="sr-only">Open user menu</span>
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="hidden lg:flex lg:items-center">
                                <span
                                    className="ml-4 text-sm font-semibold leading-6 text-foreground"
                                    aria-hidden="true"
                                >
                                    Admin PosPro
                                </span>
                                <ChevronDown
                                    className="ml-2 h-4 w-4 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </span>
                        </button>

                        {/* Dropdown menu */}
                        <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none hidden group-hover:block border border-border">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('token');
                                    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                                    window.location.href = '/login';
                                }}
                                className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-muted"
                                role="menuitem"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

// Simple MapPin Icon since I missed it in import
function MapPinIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

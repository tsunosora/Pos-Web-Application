import { Metadata } from "next";
import { UserAuthForm } from "@/components/user-auth-form";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Footer } from "@/components/layout/Footer";
import { LoginStoreName } from "@/components/LoginStoreName";

export const metadata: Metadata = {
    title: "Login",
    description: "Login to your POS account.",
};

export default function AuthenticationPage() {
    return (
        /*
         * Layout strategy
         * ───────────────
         * Mobile (< lg):
         *   - AnimatedBackground is position:fixed full-screen (z-0).
         *   - Form panel is z-10, min-h-screen, scrollable.
         *   - Glass-morphism card sits over the animated background.
         *
         * Desktop (≥ lg):
         *   - Two-column grid, h-screen on the container so both columns
         *     get a concrete 100vh height — required for flex-1 inside
         *     AnimatedBackground to fill the left column correctly.
         *   - Left  : animated background panel, flex-col, fills 100vh.
         *   - Right : clean form panel, bg-background.
         *
         * AnimatedBackground is rendered twice (one per breakpoint) but
         * exactly one is display:none at any time, so only one animates.
         */
        <div className="min-h-screen lg:grid lg:grid-cols-2 lg:h-screen">

            {/* ── Mobile background: fixed full-screen, hidden on desktop ── */}
            <div className="lg:hidden fixed inset-0 flex flex-col p-8 text-white overflow-hidden">
                <AnimatedBackground />
            </div>

            {/* ── Desktop left column: hidden on mobile ── */}
            <div className="hidden lg:flex flex-col h-full p-10 text-white overflow-hidden relative">
                <AnimatedBackground />
            </div>

            {/* ── Form panel: always visible ──────────────────────────────
                Mobile  : full screen height (z-10 above the fixed bg),
                          glass-morphism card, scrolls if keyboard opens.
                Desktop : second grid column, solid bg, centered plain form.
            ─────────────────────────────────────────────────────────────── */}
            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center
                            bg-transparent lg:bg-background
                            px-5 py-10 sm:px-8 lg:px-10 lg:py-8
                            overflow-y-auto lg:overflow-y-visible">

                <div className="w-full max-w-sm">

                    {/* Glass card: active on mobile, stripped on desktop */}
                    <div className="rounded-2xl border border-white/20 bg-black/45 backdrop-blur-2xl shadow-2xl p-7 sm:p-8
                                    lg:rounded-none lg:border-0 lg:bg-transparent lg:backdrop-blur-none lg:shadow-none lg:p-0">

                        <div className="mb-7 space-y-1.5 text-center">
                            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-foreground">
                                Masuk ke Akun
                            </h1>
                            <p className="text-sm text-white/60 lg:text-muted-foreground">
                                Masukkan username dan password Anda
                            </p>
                        </div>

                        <UserAuthForm mobileGlass />

                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-sm font-semibold text-white/70 lg:text-foreground/70 tracking-wide">
                        <LoginStoreName />
                    </p>
                    <p className="text-xs text-white/40 lg:text-muted-foreground mt-0.5">
                        &copy; 2026 Muhammad Faisal Abdul Hakim
                    </p>
                </div>
            </div>

        </div>
    );
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
    mobileGlass?: boolean;
}

export function UserAuthForm({ className, mobileGlass, ...props }: UserAuthFormProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isRegistering, setIsRegistering] = React.useState<boolean>(false)
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState<boolean>(false)

    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)
        setErrorMsg(null)

        const target = event.target as typeof event.target & {
            email: { value: string };
            password: { value: string };
        };

        const email = target.email.value;
        const password = target.password.value;

        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const endpoint = isRegistering ? `${base}/auth/register` : `${base}/auth/login`;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Authentication failed');
            }

            const data = await res.json();

            if (isRegistering) {
                // If registered successfully, automatically switch to login mode and prefill
                setIsRegistering(false);
                setErrorMsg("Registration successful! Please sign in.");
            } else {
                localStorage.setItem('token', data.access_token);
                // Set cookie for Next.js Middleware. Expires in 1 day to match backend JWT setting.
                const expires = new Date();
                expires.setTime(expires.getTime() + (1 * 24 * 60 * 60 * 1000));
                document.cookie = `token=${data.access_token};expires=${expires.toUTCString()};path=/`;

                // Bersihkan seluruh query cache (memory + IndexedDB) sebelum navigasi.
                // Ini memastikan user baru tidak kebawa data/error dari sesi user sebelumnya,
                // dan semua query di-fetch ulang dengan token baru.
                queryClient.clear();

                router.replace('/');
            }
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            <form onSubmit={onSubmit}>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label className="sr-only" htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            placeholder="name@example.com"
                            type="email"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoCorrect="off"
                            disabled={isLoading}
                            required
                            className={mobileGlass ? "bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/30 lg:bg-background lg:border-input lg:text-foreground lg:placeholder:text-muted-foreground" : ""}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label className="sr-only" htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                name="password"
                                placeholder="Password"
                                type={showPassword ? "text" : "password"}
                                autoCapitalize="none"
                                autoComplete="current-password"
                                disabled={isLoading}
                                required
                                className={cn(
                                    "pr-10",
                                    mobileGlass && "bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/30 lg:bg-background lg:border-input lg:text-foreground lg:placeholder:text-muted-foreground"
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                disabled={isLoading}
                                tabIndex={-1}
                                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                className={cn(
                                    "absolute inset-y-0 right-0 flex items-center pr-3 disabled:opacity-50",
                                    mobileGlass
                                        ? "text-white/60 hover:text-white lg:text-muted-foreground lg:hover:text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    {errorMsg && (
                        <div className="text-sm font-medium text-destructive text-center">
                            {errorMsg}
                        </div>
                    )}
                    <Button disabled={isLoading}>
                        {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isRegistering ? "Daftar" : "Masuk"}
                    </Button>
                </div>
            </form>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className={cn("w-full border-t", mobileGlass && "border-white/20 lg:border-border")} />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className={cn(
                        "px-2",
                        mobileGlass
                            ? "bg-transparent text-white/50 lg:bg-background lg:text-muted-foreground"
                            : "bg-background text-muted-foreground"
                    )}>
                        Or
                    </span>
                </div>
            </div>
            <Button
                variant="outline"
                type="button"
                disabled={isLoading}
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setErrorMsg(null);
                }}
                className={mobileGlass ? "bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white lg:bg-background lg:border-input lg:text-foreground lg:hover:bg-accent lg:hover:text-accent-foreground" : ""}
            >
                {isRegistering ? "Kembali ke Login" : "Buat Akun Baru"}
            </Button>
        </div>
    )
}

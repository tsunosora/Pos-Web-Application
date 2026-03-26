"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomerAnalytics } from "@/lib/api";
import { X, Users, TrendingUp, Wallet, Phone, MapPin, BarChart2, MessageCircle, ShoppingBag, Calendar, Loader2, Package } from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
dayjs.locale("id");

const STATUS_LABEL: Record<string, string> = { PAID: "Lunas", PARTIAL: "DP", PENDING: "Pending", FAILED: "Gagal" };
const STATUS_CLS: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    PENDING: "bg-muted text-muted-foreground",
    FAILED: "bg-destructive/10 text-destructive",
};

export function AnalyticsModal({ customerId, onClose }: { customerId: number; onClose: () => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ["customer-analytics", customerId],
        queryFn: () => getCustomerAnalytics(customerId),
    });

    const avgOrder = data && data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0;

    const waLink = data?.customer?.phone
        ? `https://wa.me/${data.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
            `Halo ${data.customer.name}, kami dari toko kami ingin menginformasikan promo & produk terbaru untuk Anda. Terima kasih sudah menjadi pelanggan setia kami! 🙏`
        )}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm flex items-center justify-between p-5 border-b border-border z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">{data?.customer?.name ?? "Memuat..."}</h2>
                            <p className="text-xs text-muted-foreground">Analitik Pelanggan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {waLink && (
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                            >
                                <MessageCircle className="w-3.5 h-3.5" /> WA Blast
                            </a>
                        )}
                        <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : data ? (
                    <div className="p-5 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            {data.customer.phone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="w-4 h-4 shrink-0" />
                                    <span>{data.customer.phone}</span>
                                </div>
                            )}
                            {data.customer.address && (
                                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{data.customer.address}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Total Order", value: `${data.totalOrders}x`, icon: ShoppingBag, cls: "text-primary bg-primary/10" },
                                { label: "Total Pendapatan", value: `Rp ${data.totalRevenue.toLocaleString("id-ID")}`, icon: Wallet, cls: "text-emerald-600 bg-emerald-100" },
                                { label: "Rata-rata Order", value: `Rp ${Math.round(avgOrder).toLocaleString("id-ID")}`, icon: TrendingUp, cls: "text-amber-600 bg-amber-100" },
                                {
                                    label: "Terakhir Order",
                                    value: data.lastOrderDate ? dayjs(data.lastOrderDate).format("DD MMM YYYY") : "–",
                                    icon: Calendar,
                                    cls: "text-violet-600 bg-violet-100"
                                },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl border border-border p-3 space-y-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.cls}`}>
                                        <s.icon className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-sm font-bold leading-tight break-words">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-border p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-muted-foreground" /> Produk Sering Dipesan
                                </h3>
                                {data.topProducts.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={data.topProducts}
                                            layout="vertical"
                                            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                        >
                                            <XAxis type="number" hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={90}
                                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                formatter={(v: any) => [`${v}x`, "Qty"]}
                                                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
                                            />
                                            <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
                                        Belum ada data produk.
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-border p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-muted-foreground" /> Pengeluaran 6 Bulan Terakhir
                                </h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <AreaChart data={data.monthlySpend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip
                                            formatter={(v: any) => [`Rp ${Number(v).toLocaleString("id-ID")}`, "Total"]}
                                            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
                                        />
                                        <Area type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} fill="url(#spendGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {data.recentTransactions.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="px-4 py-3 border-b border-border bg-muted/30">
                                    <h3 className="text-sm font-semibold">Riwayat Transaksi Terbaru</h3>
                                </div>
                                <div className="divide-y divide-border">
                                    {data.recentTransactions.map((t: any) => (
                                        <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">{t.invoiceNumber}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {t.items.slice(0, 2).join(", ")}{t.items.length > 2 ? ` +${t.items.length - 2} lainnya` : ""}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 space-y-1">
                                                <p className="text-sm font-semibold">Rp {t.downPayment.toLocaleString("id-ID")}</p>
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[t.status] ?? ""}`}>
                                                        {STATUS_LABEL[t.status] ?? t.status}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {dayjs(t.createdAt).format("DD MMM YY")}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

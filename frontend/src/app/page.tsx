"use client";

import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '@/lib/api';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  Map,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Home() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics
  });

  if (isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  const defaultMetrics = metrics || {
    sales: { value: 0, trend: '0%', trendUp: true },
    transactions: { value: 0, trend: '0%', trendUp: true },
    cashflow: { value: 0, trend: '0%', trendUp: true },
    alerts: { count: 0, items: [] }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan aktivitas hari ini di Cabang Utama.
        </p>
      </div>

      {/* Top Value Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Penjualan Hari Ini"
          value={`Rp ${defaultMetrics.sales.value.toLocaleString('id-ID')}`}
          trend={defaultMetrics.sales.trend}
          trendUp={defaultMetrics.sales.trendUp}
          icon={Receipt}
          color="blue"
        />
        <MetricCard
          title="Total Transaksi"
          value={defaultMetrics.transactions.value.toString()}
          trend={defaultMetrics.transactions.trend}
          trendUp={defaultMetrics.transactions.trendUp}
          icon={TrendingUp}
          color="indigo"
        />
        <MetricCard
          title="Kasir Masuk (Cashflow)"
          value={`Rp ${defaultMetrics.cashflow.value.toLocaleString('id-ID')}`}
          trend={defaultMetrics.cashflow.trend}
          trendUp={defaultMetrics.cashflow.trendUp}
          icon={Wallet}
          color="emerald"
        />
        <MetricCard
          title="Peringatan Stok"
          value={`${defaultMetrics.alerts.count} Item`}
          trend={`${defaultMetrics.alerts.count > 0 ? '+' : ''}${defaultMetrics.alerts.count}`}
          trendUp={defaultMetrics.alerts.count === 0}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts and Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-xl p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Peta Cuan Lokasi (Preview)
              </h2>
              <Link
                href="/maps"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Lihat Peta Lengkap &rarr;
              </Link>
            </div>
            <div className="w-full h-[300px] bg-muted/50 rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[url('https://maps.wikimedia.org/osm-intl/12/3273/2138.png')] bg-cover bg-center mix-blend-luminosity"></div>
              <div className="text-center z-10 p-6 bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm max-w-sm">
                <Map className="mx-auto h-8 w-8 text-primary mb-3" />
                <p className="text-sm text-muted-foreground">
                  Integrasi Mapbox akan ditampilkan di sini untuk memvisualisasikan profit per cabang/lokasi secara interaktif.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
              title="Buka Kasir"
              desc="Mulai memproses transaksi pelanggan."
              href="/pos"
              icon={ShoppingCartIcon}
              color="indigo"
            />
            <QuickActionCard
              title="Tambah Produk"
              desc="Masukkan item baru ke dalam inventori."
              href="/inventory"
              icon={Package}
              color="emerald"
            />
          </div>
        </div>

        {/* Right Column: Alerts and Recent Activity */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-chart-5" />
              Stok Menipis
            </h2>
            <div className="space-y-4">
              {defaultMetrics.alerts.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Status stok aman.</p>
              ) : (
                defaultMetrics.alerts.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Batas minimum: {item.limit}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                        Sisa {item.stock}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link href="/inventory" className="block text-center mt-5 text-sm font-medium text-primary hover:text-primary/80">
              Kelola Stok Barang
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

function MetricCard({ title, value, trend, trendUp, icon: Icon, color }: any) {
  const colorStyles: Record<string, string> = {
    blue: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    indigo: "bg-primary/20 text-primary border-primary/30",
    emerald: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    rose: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-lg border", colorStyles[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div
          className={cn(
            "flex items-center text-xs sm:text-sm font-medium px-2 py-1 rounded-full",
            trendUp
              ? "bg-chart-3/10 text-chart-3"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {trendUp ? (
            <ArrowUpRight className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
          ) : (
            <ArrowDownRight className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
          )}
          {trend}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="mt-1 text-xl sm:text-2xl font-bold text-foreground tracking-tight break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickActionCard({ title, desc, href, icon: Icon, color }: any) {
  const colorMap: Record<string, string> = {
    indigo: "hover:border-primary/50 hover:shadow-primary/10 text-primary bg-primary/10",
    emerald: "hover:border-chart-3/50 hover:shadow-chart-3/10 text-chart-3 bg-chart-3/10",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group block glass rounded-xl p-5 border border-border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        colorMap[color].split(' ')[0], colorMap[color].split(' ')[1]
      )}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors", colorMap[color].split(' ')[2], colorMap[color].split(' ')[3])}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  )
}

function ShoppingCartIcon(props: any) {
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
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

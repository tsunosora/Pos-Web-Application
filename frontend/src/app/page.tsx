"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getDashboardMetrics, getSalesChart, getCashierStats } from '@/lib/api';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  Map,
  Loader2,
  CalendarDays,
  BarChart,
  Users,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, BarChart as RechartsBarChart, Bar, Cell, LabelList } from 'recharts';
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIOD_OPTIONS: { key: ChartPeriod; label: string }[] = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'yearly', label: 'Tahunan' },
];

type CashierPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const CASHIER_PERIOD_OPTIONS: { key: CashierPeriod; label: string }[] = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'yearly', label: 'Tahunan' },
  { key: 'custom', label: 'Custom' },
];

function getCashierDateRange(period: CashierPeriod, customStart: string, customEnd: string) {
  const now = dayjs();
  switch (period) {
    case 'daily':   return { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'weekly':  return { start: now.startOf('week').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'monthly': return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'yearly':  return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'custom':  return { start: customStart, end: customEnd };
  }
}

export default function Home() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily');
  const [cashierPeriod, setCashierPeriod] = useState<CashierPeriod>('daily');
  const [cashierCustomStart, setCashierCustomStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [cashierCustomEnd, setCashierCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics
  });

  const { data: chartRaw, isLoading: chartLoading } = useQuery({
    queryKey: ['sales-chart', chartPeriod],
    queryFn: () => getSalesChart(chartPeriod),
  });

  const cashierRange = getCashierDateRange(cashierPeriod, cashierCustomStart, cashierCustomEnd);
  const { data: cashierStats, isLoading: cashierLoading } = useQuery({
    queryKey: ['cashier-stats', cashierRange.start, cashierRange.end],
    queryFn: () => getCashierStats(cashierRange.start, cashierRange.end),
    refetchInterval: cashierPeriod === 'daily' ? 60_000 : false,
    enabled: cashierPeriod !== 'custom' || (!!cashierCustomStart && !!cashierCustomEnd),
  });

  if (isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  const defaultMetrics = metrics || {
    sales: { value: 0, trend: '0%', trendUp: true },
    transactions: { value: 0, trend: '0%', trendUp: true },
    cashflow: { value: 0, trend: '0%', trendUp: true },
    alerts: { count: 0, items: [] },
  };

  const chartData = (chartRaw as any[])?.map((item: any) => ({
    name: item.label,
    Total: item.total,
  })) || [];

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
          <div className="glass rounded-xl p-6 min-h-[400px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Tren Penjualan
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Total pendapatan kotor berdasarkan transaksi lunas.</p>
              </div>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border shrink-0">
                <CalendarDays className="w-4 h-4 text-muted-foreground ml-1.5 mr-0.5" />
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setChartPeriod(opt.key)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                      chartPeriod === opt.key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full mt-4">
              {chartLoading ? (
                <div className="w-full h-[300px] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${(val / 1000).toFixed(0)}k`}
                      dx={-10}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan']}
                      labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Total"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
                  <BarChart className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada data penjualan untuk periode ini.</p>
                </div>
              )}
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

      {/* Performa Kasir — Full Width */}
      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Performa Kasir
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Total invoice lunas per kasir</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
              <Calendar className="w-4 h-4 text-muted-foreground ml-1.5 mr-0.5" />
              {CASHIER_PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setCashierPeriod(opt.key)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    cashierPeriod === opt.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {cashierPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={cashierCustomStart}
                  onChange={e => setCashierCustomStart(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
                />
                <span className="text-xs text-muted-foreground">s/d</span>
                <input
                  type="date"
                  value={cashierCustomEnd}
                  onChange={e => setCashierCustomEnd(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
                />
              </div>
            )}
          </div>
        </div>

        {cashierLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !cashierStats || (cashierStats as any[]).length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
            <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada transaksi untuk periode ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div>
              <ResponsiveContainer width="100%" height={260}>
                <RechartsBarChart
                  data={(cashierStats as any[]).map(k => ({ name: k.name, Revenue: k.revenue, Count: k.count }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" opacity={0.5} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#374151' }}
                    width={100}
                  />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any, name: string) => name === 'Revenue'
                      ? [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan']
                      : [value, 'Invoice']}
                    labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                  />
                  <Bar dataKey="Revenue" radius={[0, 6, 6, 0]} maxBarSize={36}>
                    {(cashierStats as any[]).map((_: any, i: number) => {
                      const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                      return <Cell key={i} fill={barColors[i % barColors.length]} />;
                    })}
                    <LabelList
                      dataKey="Count"
                      position="right"
                      formatter={(v: any) => `${v} inv`}
                      style={{ fontSize: 11, fill: '#6b7280' }}
                    />
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>

            {/* List / Table */}
            <div className="space-y-3">
              {(cashierStats as any[]).map((kasir, i) => {
                const maxRevenue = (cashierStats as any[])[0]?.revenue || 1;
                const pct = Math.round((kasir.revenue / maxRevenue) * 100);
                const colors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500'];
                const bar = colors[i % colors.length];
                return (
                  <div key={kasir.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${bar}`} />
                        <span className="text-sm font-medium text-foreground truncate">{kasir.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-foreground">
                          Rp {kasir.revenue.toLocaleString('id-ID')}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1.5">· {kasir.count} inv</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

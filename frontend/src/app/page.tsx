"use client";

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getDashboardMetrics, getSalesChart, getCashierStats } from '@/lib/api';
import { getBranches } from '@/lib/api/settings';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  Loader2,
  CalendarDays,
  BarChart as BarChartIcon,
  Users,
  Calendar,
  ShoppingCart,
  LayoutDashboard,
  Building2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/responsive-table";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart as RechartsBarChart,
  Bar,
  Cell,
  LabelList,
} from 'recharts';
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
    case 'daily': return { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'weekly': return { start: now.startOf('week').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'monthly': return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'yearly': return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'custom': return { start: customStart, end: customEnd };
  }
}

export default function Home() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily');
  const [cashierPeriod, setCashierPeriod] = useState<CashierPeriod>('daily');
  const [cashierCustomStart, setCashierCustomStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [cashierCustomEnd, setCashierCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  // ── Branch context ─────────────────────────────────────────────────────────
  const { isOwner, branchName: staffBranchName } = useCurrentUser();
  const activeBranchId = useBranchStore(s => s.activeBranchId);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
  });

  const activeBranchLabel = useMemo(() => {
    if (!isOwner) return staffBranchName || 'Cabang Anda';
    if (activeBranchId == null) return 'Semua Cabang';
    const found = (branches as any[] | undefined)?.find(b => b.id === activeBranchId);
    return found?.name || `Cabang #${activeBranchId}`;
  }, [isOwner, staffBranchName, activeBranchId, branches]);

  // ── Data queries ───────────────────────────────────────────────────────────
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics', activeBranchId],
    queryFn: getDashboardMetrics,
  });

  const { data: chartRaw, isLoading: chartLoading } = useQuery({
    queryKey: ['sales-chart', chartPeriod, activeBranchId],
    queryFn: () => getSalesChart(chartPeriod),
  });

  const cashierRange = getCashierDateRange(cashierPeriod, cashierCustomStart, cashierCustomEnd);
  const { data: cashierStats, isLoading: cashierLoading } = useQuery({
    queryKey: ['cashier-stats', cashierRange.start, cashierRange.end, activeBranchId],
    queryFn: () => getCashierStats(cashierRange.start, cashierRange.end),
    refetchInterval: cashierPeriod === 'daily' ? 60_000 : false,
    enabled: cashierPeriod !== 'custom' || (!!cashierCustomStart && !!cashierCustomEnd),
  });

  const defaultMetrics = metrics || {
    sales: { value: 0, trend: '0%', trendUp: true },
    transactions: { value: 0, trend: '0%', trendUp: true },
    cashflow: { value: 0, trend: '0%', trendUp: true },
    alerts: { count: 0, items: [] as any[] },
  };

  const chartData = (chartRaw as any[])?.map((item: any) => ({
    name: item.label,
    Total: item.total,
  })) || [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page header */}
      <PageHeader
        title="Dashboard"
        description={`Ringkasan aktivitas hari ini · ${activeBranchLabel}`}
        icon={LayoutDashboard}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">{activeBranchLabel}</span>
          </span>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          title="Penjualan Hari Ini"
          value={`Rp ${defaultMetrics.sales.value.toLocaleString('id-ID')}`}
          trend={defaultMetrics.sales.trend}
          trendUp={defaultMetrics.sales.trendUp}
          icon={Receipt}
          color="blue"
          loading={isLoading}
        />
        <MetricCard
          title="Total Transaksi"
          value={defaultMetrics.transactions.value.toString()}
          trend={defaultMetrics.transactions.trend}
          trendUp={defaultMetrics.transactions.trendUp}
          icon={TrendingUp}
          color="indigo"
          loading={isLoading}
        />
        <MetricCard
          title="Kasir Masuk"
          value={`Rp ${defaultMetrics.cashflow.value.toLocaleString('id-ID')}`}
          trend={defaultMetrics.cashflow.trend}
          trendUp={defaultMetrics.cashflow.trendUp}
          icon={Wallet}
          color="emerald"
          loading={isLoading}
        />
        <MetricCard
          title="Peringatan Stok"
          value={`${defaultMetrics.alerts.count} Item`}
          trend={`${defaultMetrics.alerts.count > 0 ? '+' : ''}${defaultMetrics.alerts.count}`}
          trendUp={defaultMetrics.alerts.count === 0}
          icon={AlertTriangle}
          color="rose"
          loading={isLoading}
        />
      </div>

      {/* Main grid: chart + side */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
        {/* Left: trend chart + quick actions */}
        <div className="space-y-5 sm:space-y-6 lg:col-span-2">
          <Section
            title="Tren Penjualan"
            subtitle="Total pendapatan kotor dari transaksi lunas"
            icon={TrendingUp}
            actions={
              <SegmentedControl
                value={chartPeriod}
                onChange={setChartPeriod}
                options={PERIOD_OPTIONS}
                leftIcon={CalendarDays}
              />
            }
          >
            <div className="w-full">
              {chartLoading ? (
                <div className="flex h-[280px] sm:h-[300px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                <EmptyState
                  icon={BarChartIcon}
                  title="Belum ada data"
                  description="Belum ada penjualan untuk periode ini. Coba pilih periode lain atau mulai transaksi baru."
                />
              )}
            </div>
          </Section>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <QuickActionCard
              title="Buka Kasir"
              desc="Mulai memproses transaksi pelanggan."
              href="/pos"
              icon={ShoppingCart}
              color="indigo"
            />
            <QuickActionCard
              title="Kelola Inventori"
              desc="Tambah produk baru atau cek stok."
              href="/inventory"
              icon={Package}
              color="emerald"
            />
          </div>
        </div>

        {/* Right: stock alerts */}
        <div className="space-y-5 sm:space-y-6">
          <Section
            title="Stok Menipis"
            subtitle={`${defaultMetrics.alerts.count} item perlu perhatian`}
            icon={AlertTriangle}
            iconTone="warning"
          >
            {defaultMetrics.alerts.items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Stok aman"
                description="Tidak ada item yang mendekati batas minimum saat ini."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {defaultMetrics.alerts.items.map((item: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Min: {item.limit}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive ring-1 ring-inset ring-destructive/20">
                      Sisa {item.stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/inventory"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Kelola Stok Barang
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Section>
        </div>
      </div>

      {/* Performa Kasir — Full width */}
      <Section
        title="Performa Kasir"
        subtitle="Total invoice lunas per kasir"
        icon={Users}
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <SegmentedControl
              value={cashierPeriod}
              onChange={setCashierPeriod}
              options={CASHIER_PERIOD_OPTIONS}
              leftIcon={Calendar}
            />
            {cashierPeriod === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={cashierCustomStart}
                  onChange={e => setCashierCustomStart(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                />
                <span className="text-xs text-muted-foreground">s/d</span>
                <input
                  type="date"
                  value={cashierCustomEnd}
                  onChange={e => setCashierCustomEnd(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                />
              </div>
            )}
          </div>
        }
      >
        {cashierLoading ? (
          <div className="flex h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !cashierStats || (cashierStats as any[]).length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada transaksi"
            description="Tidak ada invoice lunas untuk periode ini."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bar chart — disembunyikan di mobile (list view sudah cukup) */}
            <div className="hidden lg:block">
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
                    formatter={(value: any, name: any) => name === 'Revenue'
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

            {/* List */}
            <div className="space-y-3.5">
              {(cashierStats as any[]).map((kasir, i) => {
                const maxRevenue = (cashierStats as any[])[0]?.revenue || 1;
                const pct = Math.round((kasir.revenue / maxRevenue) * 100);
                const colors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500'];
                const bar = colors[i % colors.length];
                return (
                  <div key={kasir.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={cn("h-2 w-2 shrink-0 rounded-full", bar)} />
                        <span className="truncate text-sm font-medium text-foreground">{kasir.name}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-semibold text-foreground">
                          Rp {kasir.revenue.toLocaleString('id-ID')}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">· {kasir.count} inv</span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'primary',
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  iconTone?: 'primary' | 'warning';
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass = iconTone === 'warning'
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20'
    : 'bg-primary/10 text-primary ring-primary/20';
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1", toneClass)}>
              <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  leftIcon: LeftIcon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  leftIcon?: any;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-1">
      {LeftIcon && <LeftIcon className="ml-1.5 mr-0.5 h-4 w-4 text-muted-foreground" />}
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3',
            value === opt.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: any;
  color: 'blue' | 'indigo' | 'emerald' | 'rose';
  loading?: boolean;
}) {
  const colorStyles: Record<string, string> = {
    blue: "bg-chart-2/10 text-chart-2 ring-chart-2/20",
    indigo: "bg-primary/10 text-primary ring-primary/20",
    emerald: "bg-chart-3/10 text-chart-3 ring-chart-3/20",
    rose: "bg-destructive/10 text-destructive ring-destructive/20",
  };

  return (
    <div className="group rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg ring-1", colorStyles[color])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold",
            trendUp ? "bg-chart-3/10 text-chart-3" : "bg-destructive/10 text-destructive",
          )}
        >
          {trendUp ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
          {trend}
        </div>
      </div>
      <div className="mt-3 sm:mt-4">
        <h3 className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {loading ? (
          <div className="mt-1.5 h-7 w-3/4 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1 text-lg sm:text-2xl font-bold tracking-tight text-foreground break-words">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  href,
  icon: Icon,
  color,
}: {
  title: string;
  desc: string;
  href: string;
  icon: any;
  color: 'indigo' | 'emerald';
}) {
  const colorMap: Record<string, { ring: string; bg: string; text: string; hover: string }> = {
    indigo: { ring: 'ring-primary/20', bg: 'bg-primary/10', text: 'text-primary', hover: 'hover:border-primary/40' },
    emerald: { ring: 'ring-chart-3/20', bg: 'bg-chart-3/10', text: 'text-chart-3', hover: 'hover:border-chart-3/40' },
  };
  const c = colorMap[color];
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        c.hover,
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1", c.bg, c.text, c.ring)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{desc}</p>
      </div>
      <ArrowRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5", c.text)} />
    </Link>
  );
}

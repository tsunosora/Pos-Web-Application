"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Trash2, Loader2, RefreshCw, Settings2, ChevronDown,
    BarChart3, ClipboardList, Wrench, Calculator, Check, X, Camera, AlertTriangle, Receipt, Calendar,
} from "lucide-react";
import {
    getClickRates, getClickLogs, getMachineRejects,
    getClickDashboard,
    createClickLog, deleteClickLog,
    createMachineReject, deleteMachineReject,
    upsertMeterReading, updateClickRate, seedClickRates,
    getMeterReadings, deleteMeterReading, getVendorBill,
    uploadCounterPhoto,
    type ClickRate, type ClickLog, type MachineReject, type MeterReading, type VendorBill,
    type RejectCause, type CounterType,
} from "@/lib/api";
import dayjs from "dayjs";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function PhotoUpload({
    value,
    onChange,
    label = "Foto (opsional)",
}: {
    value: string;
    onChange: (url: string) => void;
    label?: string;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(true);
        try {
            const url = await uploadCounterPhoto(file);
            onChange(url);
        } catch {
            setError("Upload gagal. Coba lagi.");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Camera className="w-3 h-3" /> {label}
            </label>
            {value ? (
                <div className="relative inline-block">
                    <a href={`${API_URL}${value}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`${API_URL}${value}`}
                            alt="Foto counter"
                            className="h-20 w-auto rounded-lg border object-cover"
                        />
                    </a>
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >×</button>
                </div>
            ) : (
                <label className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-sm text-gray-500 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                    {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Mengupload...</>
                    ) : (
                        <><Camera className="w-4 h-4" /> Pilih foto</>
                    )}
                    <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}

const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const REJECT_TYPE_LABELS: Record<string, string> = {
    MACHINE_ERROR: "Error Mesin",
    TEST_PRINT: "Test Print",
    CALIBRATION: "Kalibrasi",
    HUMAN_ERROR: "Human Error",
};

const CAUSE_LABELS: Record<RejectCause, string> = {
    MACHINE: "Mesin (tidak ditagih vendor)",
    HUMAN: "Human Error (tetap ditagih)",
};

const COUNTER_TYPE_LABELS: Record<CounterType, string> = {
    FULL_COLOR: "Full Color",
    BLACK: "Black (BW)",
    SINGLE_COLOR: "Single Color",
};

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#f43f5e", "#14b8a6"];

type Tab = "dashboard" | "logs" | "rejects" | "rekonsiliasi";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClickCountingPage() {
    const now = dayjs();
    const [tab, setTab] = useState<Tab>("dashboard");
    const [month, setMonth] = useState(now.month() + 1);
    const [year, setYear] = useState(now.year());

    const yearOptions = Array.from({ length: 5 }, (_, i) => now.year() - i);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Klik Mesin Cetak</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Pantau pemakaian mesin & biaya klik per bulan</p>
                </div>
                {/* Period picker */}
                <div className="flex items-center gap-2">
                    <select
                        value={month}
                        onChange={e => setMonth(+e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {dayjs().month(i).format("MMMM")}
                            </option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={e => setYear(+e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
                    { key: "logs", label: "Log Klik", icon: ClipboardList },
                    { key: "rejects", label: "Reject Mesin", icon: Wrench },
                    { key: "rekonsiliasi", label: "Rekonsiliasi", icon: Calculator },
                ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            tab === key
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === "dashboard" && <DashboardTab month={month} year={year} />}
            {tab === "logs" && <LogsTab month={month} year={year} />}
            {tab === "rejects" && <RejectsTab month={month} year={year} />}
            {tab === "rekonsiliasi" && <RekonsiliasiTab month={month} year={year} />}
        </div>
    );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ month, year }: { month: number; year: number }) {
    const { data, isLoading } = useQuery({
        queryKey: ["click-dashboard", month, year],
        queryFn: () => getClickDashboard(month, year),
    });

    if (isLoading) return <LoadingState />;
    if (!data) return null;

    const netCost = data.totalCost - data.totalRejectCost;

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Klik Tercatat" value={data.totalClicks.toLocaleString("id-ID")} sub="klik" color="indigo" />
                <StatCard label="Total Biaya Klik" value={formatRp(data.totalCost)} color="purple" />
                <StatCard label="Total Reject" value={data.totalRejects.toLocaleString("id-ID")} sub="klik" color="red" />
                <StatCard label="Biaya Bersih (dibayar)" value={formatRp(netCost)} color="emerald" />
            </div>

            {/* Meter info (pembacaan terakhir dalam periode) */}
            {data.meterReading && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">Pembacaan Counter Terakhir</p>
                        <span className="text-xs text-gray-500">{dayjs(data.meterReading.readingDate).format("DD MMM YYYY")}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs">Total</p>
                            <p className="font-bold text-gray-800">{data.meterReading.totalCount.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Full Color</p>
                            <p className="font-bold text-indigo-700">{data.meterReading.fullColorCount.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Black</p>
                            <p className="font-bold text-gray-800">{data.meterReading.blackCount.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Single Color</p>
                            <p className="font-bold text-gray-600">{data.meterReading.singleColorCount.toLocaleString("id-ID")}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart */}
            {data.byRate.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-4">Klik per Jenis Cetak</p>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={data.byRate} margin={{ left: 0, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: any) => [v.toLocaleString("id-ID"), "Klik"]} />
                            <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
                                {data.byRate.map((_, i) => (
                                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Breakdown table */}
            {data.byRate.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Jenis Cetak</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Klik</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Total Biaya</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.byRate.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{r.quantity.toLocaleString("id-ID")}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{formatRp(r.totalCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data.byRate.length === 0 && (
                <EmptyState message="Belum ada log klik bulan ini" />
            )}
        </div>
    );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab({ month, year }: { month: number; year: number }) {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ clickRateId: 0, quantity: 1, date: dayjs().format("YYYY-MM-DD") });

    const { data: rates = [] } = useQuery<ClickRate[]>({
        queryKey: ["click-rates"],
        queryFn: getClickRates,
    });

    const { data: logs = [], isLoading } = useQuery<ClickLog[]>({
        queryKey: ["click-logs", month, year],
        queryFn: () => getClickLogs(month, year),
    });

    const createMut = useMutation({
        mutationFn: createClickLog,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["click-logs", month, year] });
            qc.invalidateQueries({ queryKey: ["click-dashboard", month, year] });
            qc.invalidateQueries({ queryKey: ["click-reconciliation", month, year] });
            setShowForm(false);
            setForm({ clickRateId: 0, quantity: 1, date: dayjs().format("YYYY-MM-DD") });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteClickLog,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["click-logs", month, year] });
            qc.invalidateQueries({ queryKey: ["click-dashboard", month, year] });
            qc.invalidateQueries({ queryKey: ["click-reconciliation", month, year] });
        },
    });

    const activeRates = rates.filter(r => r.isActive);
    const selectedRate = activeRates.find(r => r.id === form.clickRateId);
    const estimatedCost = selectedRate ? Number(selectedRate.pricePerClick) * form.quantity : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clickRateId) return;
        createMut.mutate({ clickRateId: form.clickRateId, quantity: form.quantity, date: form.date });
    };

    if (isLoading) return <LoadingState />;

    return (
        <div className="space-y-4">
            {/* Add button */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">{logs.length} entri bulan ini</p>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Log
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-indigo-200 p-4 space-y-4">
                    <p className="font-semibold text-gray-800">Tambah Log Klik Baru</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jenis Cetak</label>
                            <select
                                value={form.clickRateId}
                                onChange={e => setForm(f => ({ ...f, clickRateId: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value={0}>-- Pilih --</option>
                                {activeRates.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} — {formatRp(Number(r.pricePerClick))}/klik
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jumlah Klik</label>
                            <input
                                type="number"
                                min={1}
                                value={form.quantity}
                                onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    {estimatedCost > 0 && (
                        <p className="text-sm text-indigo-700 font-medium">
                            Estimasi biaya: {formatRp(estimatedCost)}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={createMut.isPending || !form.clickRateId}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Simpan
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
                        >
                            Batal
                        </button>
                    </div>
                </form>
            )}

            {/* Table */}
            {logs.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tanggal</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Invoice</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Pelanggan</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Jenis</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Klik</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Harga/Klik</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Total</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map(log => {
                                const trx = log.transactionItem?.transaction;
                                return (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-700">{dayjs(log.date).format("DD MMM YYYY")}</td>
                                        <td className="px-4 py-3 text-xs">
                                            {trx ? (
                                                <a
                                                    href={`/transactions/${trx.id}`}
                                                    className="text-indigo-700 font-mono bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    {trx.invoiceNumber}
                                                </a>
                                            ) : (
                                                <span className="text-gray-300 italic">manual</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 text-xs">
                                            {trx?.customerName || <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {log.clickRate.name}
                                            {log.transactionItemId && (
                                                <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">auto</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-700">{log.quantity.toLocaleString("id-ID")}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{formatRp(Number(log.pricePerClick))}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-800">{formatRp(Number(log.totalCost))}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => window.confirm("Hapus log ini?") && deleteMut.mutate(log.id)}
                                                className="text-red-400 hover:text-red-600 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                    {logs.reduce((s, l) => s + l.quantity, 0).toLocaleString("id-ID")}
                                </td>
                                <td />
                                <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                                    {formatRp(logs.reduce((s, l) => s + Number(l.totalCost), 0))}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <EmptyState message="Belum ada log klik bulan ini" />
            )}

            {/* Rate Settings */}
            <RateSettings rates={rates} />
        </div>
    );
}

// ─── Rate Settings (collapsible) ─────────────────────────────────────────────

function RateSettings({ rates }: { rates: ClickRate[] }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState("");

    const seedMut = useMutation({
        mutationFn: seedClickRates,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["click-rates"] });
            alert(res.message);
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { pricePerClick?: number; isActive?: boolean } }) =>
            updateClickRate(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["click-rates"] });
            setEditingId(null);
        },
    });

    return (
        <div className="bg-white rounded-xl border border-gray-200">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Pengaturan Tarif Klik</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                    {rates.length === 0 && (
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-gray-500">Belum ada tarif. Muat tarif default?</p>
                            <button
                                onClick={() => seedMut.mutate()}
                                disabled={seedMut.isPending}
                                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {seedMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Seed Tarif Default
                            </button>
                        </div>
                    )}
                    {rates.length > 0 && (
                        <>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => seedMut.mutate()}
                                    disabled={seedMut.isPending}
                                    className="flex items-center gap-1 text-indigo-600 text-xs font-medium hover:underline"
                                >
                                    <RefreshCw className="w-3 h-3" /> Seed tarif yang belum ada
                                </button>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500">
                                        <th className="text-left pb-2">Nama</th>
                                        <th className="text-right pb-2">Harga/Klik</th>
                                        <th className="text-center pb-2">Aktif</th>
                                        <th className="pb-2" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rates.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="py-2 font-medium text-gray-800">{r.name}</td>
                                            <td className="py-2 text-right">
                                                {editingId === r.id ? (
                                                    <input
                                                        type="number"
                                                        value={editPrice}
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        className="w-28 border border-indigo-300 rounded px-2 py-1 text-sm text-right"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="text-gray-700">{formatRp(Number(r.pricePerClick))}</span>
                                                )}
                                            </td>
                                            <td className="py-2 text-center">
                                                <button
                                                    onClick={() => updateMut.mutate({ id: r.id, data: { isActive: !r.isActive } })}
                                                    className={`w-8 h-4 rounded-full transition-colors ${r.isActive ? "bg-indigo-500" : "bg-gray-300"}`}
                                                >
                                                    <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${r.isActive ? "translate-x-4" : ""}`} />
                                                </button>
                                            </td>
                                            <td className="py-2 pl-2">
                                                {editingId === r.id ? (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => updateMut.mutate({ id: r.id, data: { pricePerClick: +editPrice } })}
                                                            className="text-emerald-600 hover:text-emerald-800"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditingId(r.id); setEditPrice(String(r.pricePerClick)); }}
                                                        className="text-gray-400 hover:text-indigo-600 text-xs"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Rejects Tab ──────────────────────────────────────────────────────────────

function RejectsTab({ month, year }: { month: number; year: number }) {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<{
        rejectType: string;
        cause: RejectCause;
        counterType: CounterType;
        quantity: number;
        pricePerClick: number;
        notes: string;
        photoUrl: string;
        date: string;
    }>({
        rejectType: "MACHINE_ERROR",
        cause: "MACHINE",
        counterType: "FULL_COLOR",
        quantity: 1,
        pricePerClick: 1000,
        notes: "",
        photoUrl: "",
        date: dayjs().format("YYYY-MM-DD"),
    });

    const { data: rejects = [], isLoading } = useQuery<MachineReject[]>({
        queryKey: ["machine-rejects", month, year],
        queryFn: () => getMachineRejects(month, year),
    });

    const createMut = useMutation({
        mutationFn: createMachineReject,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["machine-rejects", month, year] });
            qc.invalidateQueries({ queryKey: ["click-dashboard", month, year] });
            qc.invalidateQueries({ queryKey: ["click-reconciliation", month, year] });
            qc.invalidateQueries({ queryKey: ["vendor-bill"] });
            setShowForm(false);
            setForm({
                rejectType: "MACHINE_ERROR", cause: "MACHINE", counterType: "FULL_COLOR",
                quantity: 1, pricePerClick: 1000, notes: "", photoUrl: "",
                date: dayjs().format("YYYY-MM-DD"),
            });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteMachineReject,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["machine-rejects", month, year] });
            qc.invalidateQueries({ queryKey: ["click-dashboard", month, year] });
            qc.invalidateQueries({ queryKey: ["click-reconciliation", month, year] });
            qc.invalidateQueries({ queryKey: ["vendor-bill"] });
        },
    });

    const estimatedCost = form.pricePerClick * form.quantity;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Auto-sync rejectType dengan cause: HUMAN cause → HUMAN_ERROR, else keep
        const rejectType = (form.cause === "HUMAN" ? "HUMAN_ERROR" : form.rejectType) as typeof form.rejectType;
        createMut.mutate({
            rejectType,
            cause: form.cause,
            counterType: form.counterType,
            quantity: form.quantity,
            pricePerClick: form.pricePerClick,
            notes: form.notes || undefined,
            photoUrl: form.photoUrl || undefined,
            date: form.date,
        });
    };

    if (isLoading) return <LoadingState />;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">{rejects.length} entri reject bulan ini</p>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Reject
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-red-200 p-4 space-y-4">
                    <p className="font-semibold text-gray-800">Tambah Reject Mesin</p>

                    {/* Penyebab — radio */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Penyebab</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {(["MACHINE", "HUMAN"] as RejectCause[]).map(c => (
                                <label
                                    key={c}
                                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                                        form.cause === c
                                            ? c === "HUMAN"
                                                ? "bg-amber-50 border-amber-400 text-amber-800"
                                                : "bg-indigo-50 border-indigo-400 text-indigo-800"
                                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="cause"
                                        value={c}
                                        checked={form.cause === c}
                                        onChange={() => setForm(f => ({
                                            ...f,
                                            cause: c,
                                            rejectType: c === "HUMAN" ? "HUMAN_ERROR" : (f.rejectType === "HUMAN_ERROR" ? "MACHINE_ERROR" : f.rejectType),
                                        }))}
                                        className="accent-indigo-600"
                                    />
                                    <span className="font-medium">{CAUSE_LABELS[c]}</span>
                                </label>
                            ))}
                        </div>
                        {form.cause === "HUMAN" && (
                            <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>Human error akan <b>tetap ditagih vendor</b>. Dicatat hanya untuk keperluan internal.</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Counter</label>
                            <select
                                value={form.counterType}
                                onChange={e => {
                                    const ct = e.target.value as CounterType;
                                    // Auto-update pricePerClick berdasarkan counterType
                                    const defaultPrice = ct === "BLACK" ? 500 : 1000;
                                    setForm(f => ({ ...f, counterType: ct, pricePerClick: defaultPrice }));
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {(Object.keys(COUNTER_TYPE_LABELS) as CounterType[]).map(k => (
                                    <option key={k} value={k}>{COUNTER_TYPE_LABELS[k]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jenis Reject</label>
                            <select
                                value={form.rejectType}
                                onChange={e => setForm(f => ({ ...f, rejectType: e.target.value }))}
                                disabled={form.cause === "HUMAN"}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                            >
                                {Object.entries(REJECT_TYPE_LABELS)
                                    .filter(([k]) => form.cause === "HUMAN" ? k === "HUMAN_ERROR" : k !== "HUMAN_ERROR")
                                    .map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jumlah Klik</label>
                            <input
                                type="number"
                                min={1}
                                value={form.quantity}
                                onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Harga/Klik (Rp)</label>
                            <input
                                type="number"
                                min={0}
                                value={form.pricePerClick}
                                onChange={e => setForm(f => ({ ...f, pricePerClick: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <PhotoUpload
                                value={form.photoUrl}
                                onChange={url => setForm(f => ({ ...f, photoUrl: url }))}
                                label="Foto Reject (opsional)"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
                        <input
                            type="text"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Misal: kertas macet saat kalibrasi"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <p className="text-sm text-red-700 font-medium">Estimasi potongan: {formatRp(estimatedCost)}</p>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={createMut.isPending}
                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Simpan
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50">
                            Batal
                        </button>
                    </div>
                </form>
            )}

            {rejects.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tanggal</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Penyebab</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Counter</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Jenis</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Klik</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Harga/Klik</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Total</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Catatan</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rejects.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-700">{dayjs(r.date).format("DD MMM YYYY")}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            r.cause === "HUMAN"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-emerald-100 text-emerald-700"
                                        }`}>
                                            {r.cause === "HUMAN" ? "Human" : "Mesin"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-xs">{COUNTER_TYPE_LABELS[r.counterType] || r.counterType}</td>
                                    <td className="px-4 py-3">
                                        <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                            {REJECT_TYPE_LABELS[r.rejectType] || r.rejectType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-700">{r.quantity.toLocaleString("id-ID")}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{formatRp(Number(r.pricePerClick))}</td>
                                    <td className="px-4 py-3 text-right font-medium text-red-700">{formatRp(Number(r.totalCost))}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {r.notes || "—"}
                                        {r.photoUrl && (
                                            <a href={`${API_URL}${r.photoUrl}`} target="_blank" rel="noreferrer" className="block mt-1">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={`${API_URL}${r.photoUrl}`} alt="foto" className="h-10 w-auto rounded border object-cover" />
                                            </a>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => window.confirm("Hapus data reject ini?") && deleteMut.mutate(r.id)}
                                            className="text-red-400 hover:text-red-600 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                    {rejects.reduce((s, r) => s + r.quantity, 0).toLocaleString("id-ID")}
                                </td>
                                <td />
                                <td className="px-4 py-3 text-right font-semibold text-red-700">
                                    {formatRp(rejects.reduce((s, r) => s + Number(r.totalCost), 0))}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <EmptyState message="Belum ada data reject bulan ini" />
            )}
        </div>
    );
}

// ─── Rekonsiliasi Tab ─────────────────────────────────────────────────────────

function RekonsiliasiTab({ month, year }: { month: number; year: number }) {
    const qc = useQueryClient();

    // Default range: awal-akhir bulan
    const monthStart = dayjs().year(year).month(month - 1).startOf("month").format("YYYY-MM-DD");
    const monthEnd = dayjs().year(year).month(month - 1).endOf("month").format("YYYY-MM-DD");

    const [meterForm, setMeterForm] = useState({
        readingDate: dayjs().format("YYYY-MM-DD"),
        totalCount: 0,
        fullColorCount: 0,
        blackCount: 0,
        singleColorCount: 0,
        photoUrl: "",
        notes: "",
    });

    const [billRange, setBillRange] = useState({ start: monthStart, end: monthEnd });
    const [billTrigger, setBillTrigger] = useState(0);

    // Riwayat pembacaan dalam bulan aktif (+/- 1 bulan untuk context)
    const histStart = dayjs().year(year).month(month - 1).startOf("month").subtract(1, "month").format("YYYY-MM-DD");
    const histEnd = dayjs().year(year).month(month - 1).endOf("month").format("YYYY-MM-DD");

    const { data: readings = [], isLoading: loadingReadings } = useQuery<MeterReading[]>({
        queryKey: ["meter-readings", histStart, histEnd],
        queryFn: () => getMeterReadings(histStart, histEnd),
    });

    const meterMut = useMutation({
        mutationFn: upsertMeterReading,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["meter-readings"] });
            qc.invalidateQueries({ queryKey: ["click-dashboard", month, year] });
            qc.invalidateQueries({ queryKey: ["vendor-bill"] });
            // reset form
            setMeterForm(f => ({ ...f, totalCount: 0, fullColorCount: 0, blackCount: 0, singleColorCount: 0, photoUrl: "", notes: "" }));
        },
    });

    const deleteMeterMut = useMutation({
        mutationFn: deleteMeterReading,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["meter-readings"] });
            qc.invalidateQueries({ queryKey: ["vendor-bill"] });
        },
    });

    const { data: vendorBill, isFetching: fetchingBill, error: billError } = useQuery<VendorBill>({
        queryKey: ["vendor-bill", billRange.start, billRange.end, billTrigger],
        queryFn: () => getVendorBill(billRange.start, billRange.end),
        enabled: billTrigger > 0,
        retry: false,
    });

    // Validation: Total harus = FC + Black + SC
    const computedSum = meterForm.fullColorCount + meterForm.blackCount + meterForm.singleColorCount;
    const sumMismatch = meterForm.totalCount > 0 && computedSum !== meterForm.totalCount;

    const handleMeterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        meterMut.mutate({
            readingDate: meterForm.readingDate,
            totalCount: meterForm.totalCount,
            fullColorCount: meterForm.fullColorCount,
            blackCount: meterForm.blackCount,
            singleColorCount: meterForm.singleColorCount || 0,
            photoUrl: meterForm.photoUrl || undefined,
            notes: meterForm.notes || undefined,
        });
    };

    const loadReadingToForm = (r: MeterReading) => {
        setMeterForm({
            readingDate: dayjs(r.readingDate).format("YYYY-MM-DD"),
            totalCount: r.totalCount,
            fullColorCount: r.fullColorCount,
            blackCount: r.blackCount,
            singleColorCount: r.singleColorCount,
            photoUrl: r.photoUrl || "",
            notes: r.notes || "",
        });
    };

    // Sort readings ascending by date for delta calculation
    const sortedReadings = [...readings].sort((a, b) =>
        dayjs(a.readingDate).valueOf() - dayjs(b.readingDate).valueOf()
    );

    return (
        <div className="space-y-6">
            {/* ─── Section A: Form Pembacaan Harian ─── */}
            <div className="bg-white rounded-xl border border-indigo-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <p className="font-semibold text-gray-800">Pembacaan Counter Harian</p>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Input pembacaan counter dari foto operator. Satu pembacaan per tanggal (upsert).
                </p>
                <form onSubmit={handleMeterSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                            <input
                                type="date"
                                value={meterForm.readingDate}
                                onChange={e => setMeterForm(f => ({ ...f, readingDate: e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Total Counter</label>
                            <input
                                type="number"
                                min={0}
                                value={meterForm.totalCount || ""}
                                onChange={e => setMeterForm(f => ({ ...f, totalCount: +e.target.value }))}
                                required
                                className={`w-full border rounded-lg px-3 py-2 text-sm ${sumMismatch ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-indigo-700 mb-1">Full Color</label>
                            <input
                                type="number"
                                min={0}
                                value={meterForm.fullColorCount || ""}
                                onChange={e => setMeterForm(f => ({ ...f, fullColorCount: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Black (BW)</label>
                            <input
                                type="number"
                                min={0}
                                value={meterForm.blackCount || ""}
                                onChange={e => setMeterForm(f => ({ ...f, blackCount: +e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Single Color</label>
                            <input
                                type="number"
                                min={0}
                                value={meterForm.singleColorCount || ""}
                                onChange={e => setMeterForm(f => ({ ...f, singleColorCount: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    {sumMismatch && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                <b>Sanity check gagal:</b> Total ({meterForm.totalCount.toLocaleString("id-ID")}) ≠ FC + Black + SC ({computedSum.toLocaleString("id-ID")}).
                                Selisih: {(meterForm.totalCount - computedSum).toLocaleString("id-ID")}. Periksa input lagi.
                            </span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <PhotoUpload
                                value={meterForm.photoUrl}
                                onChange={url => setMeterForm(f => ({ ...f, photoUrl: url }))}
                                label="Foto Counter (opsional)"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
                            <input
                                type="text"
                                value={meterForm.notes}
                                onChange={e => setMeterForm(f => ({ ...f, notes: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={meterMut.isPending}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {meterMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Simpan Pembacaan
                    </button>
                </form>
            </div>

            {/* ─── Section B: Riwayat Pembacaan ─── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <ClipboardList className="w-5 h-5 text-gray-600" />
                    <p className="font-semibold text-gray-800">Riwayat Pembacaan</p>
                    <span className="text-xs text-gray-500 ml-auto">
                        {dayjs(histStart).format("DD MMM")} — {dayjs(histEnd).format("DD MMM YYYY")}
                    </span>
                </div>
                {loadingReadings ? (
                    <LoadingState />
                ) : sortedReadings.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-gray-400 text-sm">Belum ada pembacaan counter</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tanggal</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Total</th>
                                <th className="text-right px-4 py-3 text-indigo-700 font-medium">FC</th>
                                <th className="text-right px-4 py-3 text-gray-700 font-medium">Black</th>
                                <th className="text-right px-4 py-3 text-gray-500 font-medium">SC</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium">Δ Total</th>
                                <th className="text-center px-4 py-3 text-gray-600 font-medium">Check</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedReadings.map((r, idx) => {
                                const prev = idx > 0 ? sortedReadings[idx - 1] : null;
                                const dTotal = prev ? r.totalCount - prev.totalCount : null;
                                const dFC = prev ? r.fullColorCount - prev.fullColorCount : 0;
                                const dB = prev ? r.blackCount - prev.blackCount : 0;
                                const dSC = prev ? r.singleColorCount - prev.singleColorCount : 0;
                                const deltaSumMismatch = prev && dTotal !== null && dTotal !== (dFC + dB + dSC);
                                const ownSumMismatch = r.totalCount !== (r.fullColorCount + r.blackCount + r.singleColorCount);
                                return (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-700 font-medium">
                                            <div>{dayjs(r.readingDate).format("DD MMM YYYY")}</div>
                                            {r.photoUrl && (
                                                <a href={`${API_URL}${r.photoUrl}`} target="_blank" rel="noreferrer" className="block mt-1">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={`${API_URL}${r.photoUrl}`} alt="foto counter" className="h-10 w-auto rounded border object-cover" />
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-800">{r.totalCount.toLocaleString("id-ID")}</td>
                                        <td className="px-4 py-3 text-right text-indigo-700">{r.fullColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-4 py-3 text-right text-gray-800">{r.blackCount.toLocaleString("id-ID")}</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{r.singleColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-4 py-3 text-right">
                                            {dTotal !== null ? (
                                                <span className={dTotal >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                    {dTotal >= 0 ? "+" : ""}{dTotal.toLocaleString("id-ID")}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {ownSumMismatch || deltaSumMismatch ? (
                                                <span title={ownSumMismatch ? "Total ≠ FC+B+SC" : "Δ tidak match"}>
                                                    <AlertTriangle className="w-4 h-4 text-red-500 inline" />
                                                </span>
                                            ) : (
                                                <Check className="w-4 h-4 text-emerald-500 inline" />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex gap-1 justify-end">
                                                <button
                                                    onClick={() => loadReadingToForm(r)}
                                                    className="text-indigo-400 hover:text-indigo-600 p-1 text-xs"
                                                    title="Muat ke form"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => window.confirm("Hapus pembacaan ini?") && deleteMeterMut.mutate(r.id)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ─── Section C: Panel Tagihan Vendor ─── */}
            <div className="bg-white rounded-xl border border-purple-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Receipt className="w-5 h-5 text-purple-600" />
                    <p className="font-semibold text-gray-800">Tagihan Vendor</p>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Hitung tagihan berdasarkan selisih counter mesin dikurangi reject penyebab mesin.
                    Pastikan ada pembacaan counter di atau sebelum kedua tanggal.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Awal</label>
                        <input
                            type="date"
                            value={billRange.start}
                            onChange={e => setBillRange(r => ({ ...r, start: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Akhir</label>
                        <input
                            type="date"
                            value={billRange.end}
                            onChange={e => setBillRange(r => ({ ...r, end: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => setBillTrigger(t => t + 1)}
                        disabled={fetchingBill}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                        {fetchingBill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        Hitung Tagihan
                    </button>
                </div>

                {billError && (
                    <div className="mt-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{(billError as any)?.response?.data?.message || "Gagal menghitung tagihan. Pastikan pembacaan meter tersedia."}</span>
                    </div>
                )}

                {vendorBill && !billError && (
                    <div className="mt-5 space-y-4">
                        {/* Period summary */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-500">Meter Awal ({dayjs(vendorBill.period.actualStart).format("DD MMM YYYY")})</p>
                                <p className="font-mono text-gray-800">
                                    Total {vendorBill.meterStart.totalCount.toLocaleString("id-ID")} · FC {vendorBill.meterStart.fullColorCount.toLocaleString("id-ID")} · B {vendorBill.meterStart.blackCount.toLocaleString("id-ID")}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-500">Meter Akhir ({dayjs(vendorBill.period.actualEnd).format("DD MMM YYYY")})</p>
                                <p className="font-mono text-gray-800">
                                    Total {vendorBill.meterEnd.totalCount.toLocaleString("id-ID")} · FC {vendorBill.meterEnd.fullColorCount.toLocaleString("id-ID")} · B {vendorBill.meterEnd.blackCount.toLocaleString("id-ID")}
                                </p>
                            </div>
                        </div>

                        {/* Sanity check banner */}
                        {vendorBill.sanityCheck.mismatch && (
                            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                    <b>Sanity check:</b> Δ Total ({vendorBill.sanityCheck.actual.toLocaleString("id-ID")}) ≠ Δ FC+B+SC ({vendorBill.sanityCheck.expected.toLocaleString("id-ID")}).
                                    Periksa data pembacaan counter.
                                </span>
                            </div>
                        )}

                        {/* Breakdown table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-gray-600 font-medium">Type</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Meter Awal</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Meter Akhir</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Δ Counter</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Reject Mesin</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Billable</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Tarif</th>
                                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-indigo-700">Full Color</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{vendorBill.meterStart.fullColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{vendorBill.meterEnd.fullColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-800">+{vendorBill.deltas.fullColor.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-red-600">−{vendorBill.machineRejects.fullColor.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-800">{vendorBill.billableClicks.fullColor.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{formatRp(vendorBill.rates.fullColor)}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-indigo-700">{formatRp(vendorBill.costs.fullColor)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-gray-800">Black (BW)</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{vendorBill.meterStart.blackCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{vendorBill.meterEnd.blackCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-800">+{vendorBill.deltas.black.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-red-600">−{vendorBill.machineRejects.black.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-800">{vendorBill.billableClicks.black.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{formatRp(vendorBill.rates.black)}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{formatRp(vendorBill.costs.black)}</td>
                                    </tr>
                                    <tr className="bg-gray-50 text-gray-500">
                                        <td className="px-3 py-2 font-medium italic">Single Color (info)</td>
                                        <td className="px-3 py-2 text-right">{vendorBill.meterStart.singleColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right">{vendorBill.meterEnd.singleColorCount.toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2 text-right">+{vendorBill.deltas.singleColor.toLocaleString("id-ID")}</td>
                                        <td colSpan={4} className="px-3 py-2 text-xs italic">Tidak ditagih vendor</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-purple-50">
                                    <tr>
                                        <td colSpan={7} className="px-3 py-3 font-bold text-gray-800 text-right">Grand Total Tagihan</td>
                                        <td className="px-3 py-3 text-right font-bold text-purple-700 text-lg">{formatRp(vendorBill.costs.grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Human rejects info panel */}
                        {(vendorBill.humanRejects.fullColor > 0 || vendorBill.humanRejects.black > 0) && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Human Error (tetap ditagih vendor — info internal)
                                </p>
                                <p className="text-xs text-amber-700">
                                    FC: {vendorBill.humanRejects.fullColor.toLocaleString("id-ID")} klik ·
                                    Black: {vendorBill.humanRejects.black.toLocaleString("id-ID")} klik
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
    const colorMap: Record<string, string> = {
        indigo: "bg-indigo-50 text-indigo-700",
        purple: "bg-purple-50 text-purple-700",
        red: "bg-red-50 text-red-700",
        emerald: "bg-emerald-50 text-emerald-700",
    };
    return (
        <div className={`rounded-xl p-4 ${colorMap[color] || "bg-gray-50 text-gray-700"}`}>
            <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
            <p className="text-xl font-bold leading-tight">
                {value}
                {sub && <span className="text-sm font-normal ml-1 opacity-75">{sub}</span>}
            </p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-12 text-center">
            <p className="text-gray-400 text-sm">{message}</p>
        </div>
    );
}

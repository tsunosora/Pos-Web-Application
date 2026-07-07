'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, Loader2, Check, Settings2, QrCode, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { StarRating } from '@/components/ui/star-rating';
import { getRatingSummary, getRatingConfig, updateRatingConfig } from '@/lib/api/cs-rating';

interface Props {
    branchId: number | null;
    from: string;
    to: string;
    branches: { id: number; name: string }[];
}

const DEFAULT_QUESTION = 'Apakah Anda puas dengan pelayanan kami?';
const DEFAULT_THANKS = 'Terima kasih atas penilaian Anda!';

/** Ringkasan penilaian CS + editor pertanyaan poling untuk dashboard Owner. */
export function CsRatingSection({ branchId, from, to, branches }: Props) {
    const qc = useQueryClient();
    const branchParam = branchId ?? undefined;

    const [qrOpen, setQrOpen] = useState(false);
    const [origin, setOrigin] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    useEffect(() => { setOrigin(window.location.origin); }, []);

    // Cabang yang ditampilkan QR-nya: kalau owner pilih cabang tertentu → hanya itu; kalau "Semua" → semua cabang.
    const qrBranches = branchId == null ? branches : branches.filter(b => b.id === branchId);

    const summaryQ = useQuery({
        queryKey: ['owner-cs-rating', branchId, from, to],
        queryFn: () => getRatingSummary({ branchId: branchParam, from, to }),
    });
    const cfgQ = useQuery({
        queryKey: ['owner-cs-rating-cfg', branchId],
        queryFn: () => getRatingConfig(branchParam),
    });

    const [editOpen, setEditOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [thankYouText, setThankYouText] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Sinkronkan form dari config yang termuat.
    useEffect(() => {
        const c = cfgQ.data;
        setQuestion(c?.question ?? DEFAULT_QUESTION);
        setThankYouText(c?.thankYouText ?? DEFAULT_THANKS);
        setIsActive(c?.isActive ?? true);
    }, [cfgQ.data]);

    const saveMut = useMutation({
        mutationFn: () => updateRatingConfig({ branchId, question: question.trim(), thankYouText: thankYouText.trim(), isActive }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['owner-cs-rating-cfg', branchId] });
            setEditOpen(false);
        },
    });

    const s = summaryQ.data;

    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-amber-400/15 text-amber-500 p-2"><Star className="h-5 w-5" /></div>
                    <div>
                        <h2 className="font-semibold leading-tight">Penilaian CS</h2>
                        <p className="text-xs text-muted-foreground">Poling pelayanan dari pelanggan (Ya/Tidak + bintang)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setQrOpen(o => !o)}
                        className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted"
                    >
                        <QrCode className="h-3.5 w-3.5" /> QR Meja Kasir
                    </button>
                    <button
                        onClick={() => setEditOpen(o => !o)}
                        className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted"
                    >
                        <Settings2 className="h-3.5 w-3.5" /> Ubah Pertanyaan
                    </button>
                </div>
            </div>

            {/* QR / link statis per cabang (walk-in) */}
            {qrOpen && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Tempel QR ini di meja kasir. Pelanggan (walk-in) scan → langsung menilai tanpa perlu link WhatsApp.
                        Penilaian dari QR tercatat per cabang (tanpa nama petugas).
                    </p>
                    {qrBranches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Tidak ada cabang.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {qrBranches.map(b => {
                                const url = `${origin}/nilai/cabang/${b.id}`;
                                return (
                                    <div key={b.id} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-3 text-center">
                                        <div className="text-xs font-medium truncate w-full">{b.name}</div>
                                        {origin ? (
                                            <div className="bg-white p-2 rounded">
                                                <QRCodeSVG value={url} size={104} />
                                            </div>
                                        ) : (
                                            <div className="h-[120px] w-[120px] flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                                        )}
                                        <button
                                            onClick={async () => {
                                                try { await navigator.clipboard.writeText(url); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1500); } catch { /* non-https */ }
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                        >
                                            {copiedId === b.id ? <><Check className="h-3 w-3 text-emerald-600" /> Tersalin</> : <><Copy className="h-3 w-3" /> Salin link</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Editor pertanyaan */}
            {editOpen && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Pertanyaan {branchId == null ? '(global — semua cabang)' : '(cabang ini)'}</label>
                        <input
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            maxLength={300}
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                            placeholder={DEFAULT_QUESTION}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Ucapan terima kasih</label>
                        <input
                            value={thankYouText}
                            onChange={e => setThankYouText(e.target.value)}
                            maxLength={300}
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                            placeholder={DEFAULT_THANKS}
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                        Aktifkan poling
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setEditOpen(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">Batal</button>
                        <button
                            onClick={() => saveMut.mutate()}
                            disabled={saveMut.isPending || !question.trim()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Simpan
                        </button>
                    </div>
                </div>
            )}

            {/* Ringkasan */}
            {summaryQ.isLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : !s || s.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Belum ada penilaian pada periode ini.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <Tile label="Rata-rata">
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-2xl font-bold">{s.avgStars.toFixed(1)}</span>
                                <StarRating value={Math.round(s.avgStars)} readOnly size={14} />
                            </div>
                        </Tile>
                        <Tile label="Puas (Ya)">
                            <span className="text-2xl font-bold text-emerald-600">{s.yesPercent}%</span>
                        </Tile>
                        <Tile label="Total Penilaian">
                            <span className="text-2xl font-bold">{s.total}</span>
                        </Tile>
                    </div>

                    {s.perPerson.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                                        <th className="py-2 font-medium">Petugas</th>
                                        <th className="py-2 font-medium text-center">Nilai</th>
                                        <th className="py-2 font-medium text-center">Rata Bintang</th>
                                        <th className="py-2 font-medium text-center">% Puas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.perPerson.map((p) => (
                                        <tr key={p.name} className="border-b border-border/50 last:border-0">
                                            <td className="py-2 font-medium">{p.name}</td>
                                            <td className="py-2 text-center text-muted-foreground">{p.count}</td>
                                            <td className="py-2">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <StarRating value={Math.round(p.avgStars)} readOnly size={12} />
                                                    <span className="text-xs text-muted-foreground">{p.avgStars.toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-center">{p.yesPercent}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            {children}
        </div>
    );
}

export default CsRatingSection;

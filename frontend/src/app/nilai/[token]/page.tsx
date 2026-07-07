'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ThumbsUp, ThumbsDown, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { StarRating } from '@/components/ui/star-rating';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type VerifyResult = {
    question: string;
    thankYouText: string;
    alreadySubmitted: boolean;
};

export default function NilaiPage() {
    const params = useParams();
    const token = String(params?.token ?? '');

    const [loading, setLoading] = useState(true);
    const [info, setInfo] = useState<VerifyResult | null>(null);
    const [notFound, setNotFound] = useState(false);

    const [answer, setAnswer] = useState<boolean | null>(null);
    const [stars, setStars] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [thanks, setThanks] = useState('Terima kasih atas penilaian Anda!');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/cs-rating/public/${token}`);
                if (!res.ok) {
                    setNotFound(true);
                    return;
                }
                const data: VerifyResult = await res.json();
                setInfo(data);
                setThanks(data.thankYouText);
                if (data.alreadySubmitted) setDone(true);
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    async function handleSubmit() {
        setError(null);
        if (answer === null) { setError('Pilih Ya atau Tidak dulu ya.'); return; }
        if (stars < 1) { setError('Beri minimal 1 bintang.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/cs-rating/public/${token}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer, stars, comment: comment.trim() || undefined }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.thankYouText) setThanks(data.thankYouText);
                setDone(true);
            } else if (res.status === 409) {
                setDone(true); // sudah pernah dinilai
            } else {
                const d = await res.json().catch(() => null);
                setError(d?.message || 'Gagal mengirim penilaian. Coba lagi.');
            }
        } catch {
            setError('Koneksi bermasalah. Coba lagi.');
        } finally {
            setSubmitting(false);
        }
    }

    // ── States ──
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (notFound || !info) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-3" />
                <h1 className="text-lg font-semibold">Link tidak valid</h1>
                <p className="text-sm text-muted-foreground mt-1">Tautan penilaian sudah tidak berlaku atau salah.</p>
            </div>
        );
    }

    if (done) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-xl font-bold">Terima kasih! 🙏</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">{thanks}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm space-y-7">
                <div className="text-center space-y-2">
                    <h1 className="text-xl font-bold leading-snug">{info.question}</h1>
                    <p className="text-xs text-muted-foreground">Penilaian Anda sangat berarti untuk kami.</p>
                </div>

                {/* Ya / Tidak */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setAnswer(true)}
                        className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition ${
                            answer === true
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/40 text-foreground'
                        }`}
                    >
                        <ThumbsUp className="h-7 w-7" />
                        <span className="text-sm font-semibold">Ya</span>
                    </button>
                    <button
                        onClick={() => setAnswer(false)}
                        className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition ${
                            answer === false
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : 'border-border hover:border-destructive/40 text-foreground'
                        }`}
                    >
                        <ThumbsDown className="h-7 w-7" />
                        <span className="text-sm font-semibold">Tidak</span>
                    </button>
                </div>

                {/* Bintang */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-muted-foreground">Beri bintang</span>
                    <StarRating value={stars} onChange={setStars} size={44} />
                </div>

                {/* Komentar opsional */}
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ada masukan? (opsional)"
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-base font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    Kirim Penilaian
                </button>
            </div>
        </div>
    );
}

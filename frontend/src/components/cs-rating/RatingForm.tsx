'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { StarRating } from '@/components/ui/star-rating';

interface RatingFormProps {
    question: string;
    subtitle?: string;
    initialThanks: string;
    alreadyDone?: boolean;
    /** Kembalikan thankYouText (opsional) untuk ditampilkan. Lempar error → pesan gagal. */
    onSubmit: (v: { answer: boolean; stars: number; comment?: string }) => Promise<{ thankYouText?: string } | void>;
    /** Tampilkan tombol "Beri penilaian lagi" (untuk QR/tablet kasir). */
    allowAgain?: boolean;
}

/** Form penilaian bersama: Ya/Tidak + bintang + komentar. Dipakai halaman token & cabang. */
export function RatingForm({ question, subtitle, initialThanks, alreadyDone = false, onSubmit, allowAgain = false }: RatingFormProps) {
    const [answer, setAnswer] = useState<boolean | null>(null);
    const [stars, setStars] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(alreadyDone);
    const [thanks, setThanks] = useState(initialThanks);
    const [error, setError] = useState<string | null>(null);

    function reset() {
        setAnswer(null); setStars(0); setComment(''); setError(null); setDone(false);
    }

    async function handleSubmit() {
        setError(null);
        if (answer === null) { setError('Pilih Ya atau Tidak dulu ya.'); return; }
        if (stars < 1) { setError('Beri minimal 1 bintang.'); return; }
        setSubmitting(true);
        try {
            const res = await onSubmit({ answer, stars, comment: comment.trim() || undefined });
            if (res && res.thankYouText) setThanks(res.thankYouText);
            setDone(true);
        } catch (e: any) {
            setError(e?.message || 'Gagal mengirim penilaian. Coba lagi.');
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="w-full max-w-sm flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-xl font-bold">Terima kasih! 🙏</h1>
                <p className="text-sm text-muted-foreground mt-2">{thanks}</p>
                {allowAgain && (
                    <button
                        onClick={reset}
                        className="mt-6 inline-flex items-center gap-2 border border-border rounded-xl px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                        Beri penilaian lagi
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm space-y-7">
            <div className="text-center space-y-2">
                <h1 className="text-xl font-bold leading-snug">{question}</h1>
                <p className="text-xs text-muted-foreground">{subtitle ?? 'Penilaian Anda sangat berarti untuk kami.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setAnswer(true)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition ${
                        answer === true ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40 text-foreground'
                    }`}
                >
                    <ThumbsUp className="h-7 w-7" />
                    <span className="text-sm font-semibold">Ya</span>
                </button>
                <button
                    onClick={() => setAnswer(false)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition ${
                        answer === false ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:border-destructive/40 text-foreground'
                    }`}
                >
                    <ThumbsDown className="h-7 w-7" />
                    <span className="text-sm font-semibold">Tidak</span>
                </button>
            </div>

            <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-muted-foreground">Beri bintang</span>
                <StarRating value={stars} onChange={setStars} size={44} />
            </div>

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
    );
}

export default RatingForm;

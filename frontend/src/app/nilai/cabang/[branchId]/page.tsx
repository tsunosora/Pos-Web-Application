'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { RatingForm } from '@/components/cs-rating/RatingForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type BranchPoll = {
    branchName: string;
    question: string;
    thankYouText: string;
};

export default function NilaiCabangPage() {
    const params = useParams();
    const branchId = String(params?.branchId ?? '');

    const [loading, setLoading] = useState(true);
    const [poll, setPoll] = useState<BranchPoll | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!branchId) return;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/cs-rating/public/branch/${branchId}`);
                if (!res.ok) { setNotFound(true); return; }
                setPoll(await res.json());
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [branchId]);

    async function submit(v: { answer: boolean; stars: number; comment?: string }) {
        const res = await fetch(`${API_URL}/cs-rating/public/branch/${branchId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v),
        });
        if (res.ok) return res.json();
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || 'Gagal mengirim penilaian.');
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (notFound || !poll) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-3" />
                <h1 className="text-lg font-semibold">Cabang tidak ditemukan</h1>
                <p className="text-sm text-muted-foreground mt-1">Kode QR/link penilaian tidak valid.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <RatingForm
                question={poll.question}
                subtitle={poll.branchName}
                initialThanks={poll.thankYouText}
                onSubmit={submit}
                allowAgain
            />
        </div>
    );
}

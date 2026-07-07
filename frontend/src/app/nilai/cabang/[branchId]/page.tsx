'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { RatingForm } from '@/components/cs-rating/RatingForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Kunci per-perangkat: 1 penilaian per HP per cabang dalam 6 jam (anti-spam sisi klien).
const LOCK_MS = 6 * 60 * 60 * 1000;
const lockKey = (id: string) => `cs_rated_branch_${id}`;

type BranchPoll = { branchName: string; question: string; thankYouText: string };
type Staff = { id: number; name: string };

export default function NilaiCabangPage() {
    const params = useParams();
    const branchId = String(params?.branchId ?? '');

    const [loading, setLoading] = useState(true);
    const [poll, setPoll] = useState<BranchPoll | null>(null);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [staffId, setStaffId] = useState<number | ''>('');
    const [notFound, setNotFound] = useState(false);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        if (!branchId) return;
        // Cek kunci per-perangkat.
        try {
            const t = Number(localStorage.getItem(lockKey(branchId)) || 0);
            if (t && Date.now() - t < LOCK_MS) setLocked(true);
        } catch { /* localStorage bisa mati di private mode */ }

        (async () => {
            try {
                const [pRes, sRes] = await Promise.all([
                    fetch(`${API_URL}/cs-rating/public/branch/${branchId}`),
                    fetch(`${API_URL}/cs-rating/public/branch/${branchId}/staff`),
                ]);
                if (!pRes.ok) { setNotFound(true); return; }
                setPoll(await pRes.json());
                if (sRes.ok) setStaff(await sRes.json());
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
            body: JSON.stringify({ ...v, staffId: staffId === '' ? undefined : Number(staffId) }),
        });
        if (res.ok) {
            try { localStorage.setItem(lockKey(branchId), String(Date.now())); } catch { /* ignore */ }
            return res.json();
        }
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

    const staffPicker = staff.length > 0 ? (
        <div>
            <label className="block text-sm text-muted-foreground mb-1.5 text-center">Siapa yang melayani Anda? (opsional)</label>
            <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 text-base border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
                <option value="">— Umum / tidak memilih —</option>
                {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
        </div>
    ) : null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <RatingForm
                question={poll.question}
                subtitle={poll.branchName}
                initialThanks={locked ? 'Anda sudah memberi penilaian. Terima kasih 🙏' : poll.thankYouText}
                alreadyDone={locked}
                onSubmit={submit}
                extra={staffPicker}
            />
        </div>
    );
}

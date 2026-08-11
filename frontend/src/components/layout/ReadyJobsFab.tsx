"use client";

import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { useReadyJobs } from '@/hooks/useReadyJobs';

interface Props {
    onClick: () => void;
}

/**
 * Tombol notifikasi "orderan sudah jadi" — anak dari <FloatingActionDock/>,
 * jadi TIDAK mengatur posisinya sendiri (rel yang menempatkan & menaikkannya
 * bersama Asisten AI, aman dari safe-area & tak saling menumpuk).
 *
 * Animasi sengaja dibuat HEMAT (tidak membebani CPU/GPU):
 * - TANPA ping-ring / glow / badge-pulse yang berjalan terus-menerus.
 * - Hanya wiggle one-shot + satu bubble teks singkat saat ada orderan BARU.
 * - Saat idle: cuma badge angka statis. Hemat, tetap informatif.
 * - Hanya muncul kalau ada job SELESAI di cabang aktif.
 */
export function ReadyJobsFab({ onClick }: Props) {
    const { data: jobs = [] } = useReadyJobs();
    const [wiggle, setWiggle] = useState(false);
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [bubbleText, setBubbleText] = useState('');
    const [prevCount, setPrevCount] = useState(-1);

    // Burst singkat (wiggle + bubble) HANYA saat jumlah orderan jadi bertambah.
    useEffect(() => {
        if (prevCount === -1) {
            setPrevCount(jobs.length);
            return;
        }
        if (jobs.length > prevCount) {
            const newCount = jobs.length - prevCount;
            setBubbleText(
                newCount === 1
                    ? 'Orderan baru sudah jadi'
                    : `${newCount} orderan baru sudah jadi`
            );
            setBubbleVisible(true);
            setWiggle(true);
            const t1 = setTimeout(() => setWiggle(false), 1600);
            const t2 = setTimeout(() => setBubbleVisible(false), 4000);
            setPrevCount(jobs.length);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
        setPrevCount(jobs.length);
    }, [jobs.length, prevCount]);

    if (jobs.length === 0) return null;

    return (
        <>
            {/* Wiggle one-shot saja — selesai dalam ~1.6s lalu diam (tak ada animasi infinite). */}
            <style jsx>{`
                @keyframes wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-9deg); }
                    45% { transform: rotate(7deg); }
                    70% { transform: rotate(-4deg); }
                    88% { transform: rotate(2deg); }
                }
                .fab-wiggle { animation: wiggle 0.55s ease-in-out 2; }
                .bubble-in { animation: bubbleIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
                @keyframes bubbleIn {
                    0% { opacity: 0; transform: translateX(12px) scale(0.9); }
                    100% { opacity: 1; transform: translateX(0) scale(1); }
                }
            `}</style>

            <div className="flex items-center gap-2">
                {/* Bubble teks — muncul singkat saat ada orderan baru. Anti-overflow
                    di HP sempit: lebar dibatasi viewport & boleh membungkus. */}
                {bubbleVisible && (
                    <div className="bubble-in relative pointer-events-none">
                        <div className="max-w-[62vw] sm:max-w-[15rem] rounded-2xl rounded-br-sm border border-amber-500/70 bg-card px-3 py-2 shadow-lg">
                            <p className="text-[13px] font-semibold leading-snug text-foreground">{bubbleText}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">Ketuk untuk konfirmasi diambil</p>
                        </div>
                        {/* Ekor menunjuk ke tombol */}
                        <div className="absolute right-[-5px] bottom-3 h-2.5 w-2.5 rotate-[-45deg] border-b border-r border-amber-500/70 bg-card" />
                    </div>
                )}

                <button
                    onClick={onClick}
                    aria-label={`${jobs.length} cetakan siap diambil`}
                    className={`pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full
                        bg-gradient-to-br from-amber-500 to-orange-600 text-white
                        shadow-lg shadow-amber-500/30
                        transition-transform hover:scale-105 active:scale-95
                        ${wiggle ? 'fab-wiggle' : ''}`}
                >
                    <PackageCheck className="h-5 w-5 drop-shadow" />

                    {/* Badge angka statis — indikator utama, tanpa animasi. */}
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-red-600 px-1 text-[10px] font-bold text-white">
                        {jobs.length > 99 ? '99+' : jobs.length}
                    </span>
                </button>
            </div>
        </>
    );
}

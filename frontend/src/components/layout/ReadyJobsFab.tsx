"use client";

import { useEffect, useRef, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { useReadyJobs } from '@/hooks/useReadyJobs';

interface Props {
    onClick: () => void;
}

/**
 * Floating Action Button — eye-catching tombol di pojok kanan bawah,
 * visible di semua halaman admin (kecuali public ones).
 *
 * Layered animations supaya admin pasti notice:
 * - 2 ping rings (animate-ping continuous, 2 sized) — efek halo radar
 * - Glow shadow pulsing (custom keyframe) — shadow napas
 * - Wiggle gentle (custom keyframe) — bel WA-like saat ada job baru
 * - Badge count dengan pulse animation
 * - Hanya muncul kalau ada job SELESAI di cabang aktif
 */
// Pesan rotasi yang muncul bergantian setiap cycle — bikin admin lebih ternotice
// karena teks-nya berubah-ubah, bukan static.
const ROTATING_MESSAGES = [
    '📦 Ada cetakan siap diambil',
    '🔔 Cek pesanan customer yang sudah jadi',
    '✨ Cetakan siap dikonfirmasi',
    '👋 Customer sudah bisa ambil pesanan',
    '⏰ Jangan biarkan customer menunggu',
];

const BUBBLE_VISIBLE_MS = 3500;  // tampil ~3.5 detik
const BUBBLE_HIDDEN_MS = 4000;   // hilang ~4 detik
const BURST_MS = 5500;           // burst saat ada job baru — tampil lebih lama
const ATTENTION_MS = 5000;       // animasi heavy (ping rings + glow + badge pop)
                                 // jalan max 5 detik setelah ada perubahan job,
                                 // lalu auto-stop ke static dot. Hemat GPU saat
                                 // FAB diam jam panjang.

export function ReadyJobsFab({ onClick }: Props) {
    const { data: jobs = [] } = useReadyJobs();
    const [wiggle, setWiggle] = useState(false);
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [bubbleText, setBubbleText] = useState('');
    const [prevCount, setPrevCount] = useState(-1);
    const [messageIdx, setMessageIdx] = useState(0);
    // Animasi heavy (ping/glow/badge-pop) hanya jalan saat "attention" aktif —
    // 5 detik setelah jobs.length berubah naik, atau saat FAB pertama muncul.
    // Selain itu FAB tetap visible (badge + bubble cycle), tapi tidak ada
    // animasi continuous yang bikin GPU compositor selalu kerja.
    const [attention, setAttention] = useState(true);
    const attentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerAttention = (ms = ATTENTION_MS) => {
        setAttention(true);
        if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
        attentionTimerRef.current = setTimeout(() => setAttention(false), ms);
    };

    // Initial: 5s burst saat FAB pertama mount dengan jobs > 0, lalu idle.
    useEffect(() => {
        triggerAttention();
        return () => { if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Trigger burst (wiggle + bubble lama + attention) saat count bertambah
    useEffect(() => {
        if (prevCount === -1) {
            setPrevCount(jobs.length);
            return;
        }
        if (jobs.length > prevCount) {
            const newCount = jobs.length - prevCount;
            setBubbleText(
                newCount === 1
                    ? '🎉 Orderan baru sudah jadi!'
                    : `🎉 ${newCount} orderan baru sudah jadi!`
            );
            setBubbleVisible(true);
            setWiggle(true);
            triggerAttention(BURST_MS);  // animasi heavy ikut burst length
            const t1 = setTimeout(() => setWiggle(false), 2500);
            const t2 = setTimeout(() => setBubbleVisible(false), BURST_MS);
            setPrevCount(jobs.length);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
        setPrevCount(jobs.length);
    }, [jobs.length, prevCount]);

    // Cycle bubble: tampil → hilang → tampil → hilang … selama ada job.
    // Setiap kali tampil, rotate ke pesan berikutnya supaya tidak monoton.
    useEffect(() => {
        if (jobs.length === 0) {
            setBubbleVisible(false);
            return;
        }

        let timerId: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const showBubble = () => {
            if (cancelled) return;
            // Update text dengan jumlah dinamis + pesan rotasi
            const baseMsg = ROTATING_MESSAGES[messageIdx % ROTATING_MESSAGES.length];
            const text = jobs.length > 1
                ? `${baseMsg} (${jobs.length})`
                : baseMsg;
            setBubbleText(text);
            setBubbleVisible(true);
            timerId = setTimeout(hideBubble, BUBBLE_VISIBLE_MS);
        };
        const hideBubble = () => {
            if (cancelled) return;
            setBubbleVisible(false);
            // Naikkan index pesan untuk cycle berikutnya
            setMessageIdx(idx => (idx + 1) % ROTATING_MESSAGES.length);
            timerId = setTimeout(showBubble, BUBBLE_HIDDEN_MS);
        };

        // Initial delay supaya burst dari job baru tidak langsung di-overwrite
        timerId = setTimeout(showBubble, 800);

        return () => {
            cancelled = true;
            if (timerId) clearTimeout(timerId);
        };
        // Sengaja dependency cuma jobs.length — kalau pakai messageIdx, akan reset cycle setiap rotate
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobs.length]);

    if (jobs.length === 0) return null;

    return (
        <>
            {/* Inject keyframes via styled-jsx — tidak butuh tambah ke globals.css */}
            <style jsx>{`
                @keyframes wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    15% { transform: rotate(-12deg); }
                    30% { transform: rotate(10deg); }
                    45% { transform: rotate(-8deg); }
                    60% { transform: rotate(6deg); }
                    75% { transform: rotate(-4deg); }
                    90% { transform: rotate(2deg); }
                }
                @keyframes glowPulse {
                    0%, 100% {
                        box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.5),
                                    0 0 0 0 rgba(245, 158, 11, 0.7);
                    }
                    50% {
                        box-shadow: 0 10px 30px -5px rgba(245, 158, 11, 0.7),
                                    0 0 0 12px rgba(245, 158, 11, 0);
                    }
                }
                @keyframes badgePop {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                }
                @keyframes bubbleSlideIn {
                    0% { opacity: 0; transform: translateX(20px) scale(0.85); }
                    100% { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes bubbleSlideOut {
                    0% { opacity: 1; transform: translateX(0) scale(1); }
                    100% { opacity: 0; transform: translateX(20px) scale(0.85); }
                }
                .fab-wiggle {
                    animation: wiggle 0.7s ease-in-out 3;
                }
                .fab-glow {
                    animation: glowPulse 2s ease-in-out infinite;
                }
                .badge-pop {
                    animation: badgePop 1.5s ease-in-out infinite;
                }
                .bubble-in {
                    animation: bubbleSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                .bubble-out {
                    animation: bubbleSlideOut 0.3s ease-in forwards;
                }
            `}</style>

            <div
                // FAB selalu di kanan-bawah. z-[310] supaya tampil di atas cart sidebar POS (z-[300]).
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[310] print:hidden flex items-center gap-3"
                style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
            >
                {/* Bubble teks — muncul beberapa detik saat ada job baru */}
                {bubbleVisible && (
                    <div
                        className={`relative ${bubbleVisible ? 'bubble-in' : 'bubble-out'}`}
                        style={{ pointerEvents: 'none' }}
                    >
                        <div className="bg-card border-2 border-amber-500 shadow-2xl rounded-2xl rounded-br-sm px-4 py-2.5 max-w-xs">
                            <p className="text-sm font-semibold text-foreground whitespace-nowrap">{bubbleText}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Klik untuk konfirmasi diambil</p>
                        </div>
                        {/* Tail/arrow ke FAB */}
                        <div className="absolute right-[-6px] bottom-3 w-3 h-3 bg-card border-r-2 border-b-2 border-amber-500 rotate-[-45deg]" />
                    </div>
                )}

                {/* Container FAB + ping rings */}
                <div className="relative">
                {/* Ping rings — cuma render saat `attention` ON, supaya GPU
                    compositor tidak terus kerja kalau FAB sudah lama diam. */}
                {attention && (
                    <>
                        <span
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping"
                            style={{ animationDuration: '2s' }}
                        />
                        <span
                            aria-hidden
                            className="absolute -inset-2 rounded-full bg-orange-400/25 animate-ping"
                            style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
                        />
                    </>
                )}

                <button
                    onClick={onClick}
                    aria-label={`${jobs.length} cetakan siap diambil`}
                    className={`relative w-14 h-14 rounded-full
                        bg-gradient-to-br from-amber-500 to-orange-600
                        flex items-center justify-center
                        hover:scale-110 active:scale-95 transition-transform
                        ${attention ? 'fab-glow' : 'shadow-lg shadow-amber-500/40'}
                        ${wiggle ? 'fab-wiggle' : ''}`}
                >
                    <PackageCheck className="w-6 h-6 text-white drop-shadow" />

                    {/* Badge count: pulse hanya saat attention ON */}
                    <span
                        className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-background shadow-lg ${attention ? 'badge-pop' : ''}`}
                    >
                        {jobs.length > 99 ? '99+' : jobs.length}
                    </span>
                </button>
                </div>
            </div>
        </>
    );
}

"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, type IChartApi } from "lightweight-charts";
import type { FinanceCandle } from "@/lib/api/finance-analytics";

// Catatan: token CSS project memakai format lab()/oklch yang TIDAK bisa diparse
// lightweight-charts v4 (lempar "Cannot parse color"). Jadi pakai palet hex eksplisit
// yang mengikuti mode gelap/terang.
function palette() {
    const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    return dark
        ? { text: "#9ca3af", grid: "#262626", border: "#3f3f46", ma: "#a3e635" }
        : { text: "#6b7280", grid: "#eef0f2", border: "#e5e7eb", ma: "#65a30d" };
}

function sma(candles: FinanceCandle[], period: number) {
    const out: { time: string; value: number }[] = [];
    for (let i = period - 1; i < candles.length; i++) {
        let s = 0;
        for (let j = i - period + 1; j <= i; j++) s += candles[j].close;
        out.push({ time: candles[i].time, value: s / period });
    }
    return out;
}

export function CandleChart({ candles, onCandleClick, height = 420 }: { candles: FinanceCandle[]; onCandleClick?: (time: string) => void; height?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const clickRef = useRef(onCandleClick);
    clickRef.current = onCandleClick;

    useEffect(() => {
        if (!ref.current) return;
        const pal = palette();
        const chart: IChartApi = createChart(ref.current, {
            height,
            layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: pal.text, fontFamily: "inherit" },
            grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderColor: pal.border },
            timeScale: { borderColor: pal.border, timeVisible: false },
            autoSize: true,
        });
        const up = "#16a34a", down = "#dc2626";
        const candleSeries = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
        candleSeries.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })) as any);

        const volSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
        chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        volSeries.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)" })) as any);

        if (candles.length >= 7) {
            const ma = chart.addLineSeries({ color: pal.ma, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            ma.setData(sma(candles, 7) as any);
        }
        chart.timeScale().fitContent();
        chart.subscribeClick((p) => { if (p.time && clickRef.current) clickRef.current(String(p.time)); });

        return () => { chart.remove(); };
    }, [candles, height]);

    return <div ref={ref} className="w-full" style={{ height }} />;
}

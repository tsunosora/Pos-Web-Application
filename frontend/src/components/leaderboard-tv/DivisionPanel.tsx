'use client';
import type { ReactNode } from 'react';

export interface TvColumn { key: string; label: string; fmt?: (v: any, row: any) => ReactNode; primary?: boolean }

const MEDAL = ['🥇', '🥈', '🥉'];

export default function DivisionPanel(props: {
  title: string;
  icon?: ReactNode;
  rows: any[];
  columns: TvColumn[];
  sortKey: string;             // kolom untuk menentukan juara & urutan
  topN?: number;               // default 5
  nameKey?: string;            // default 'name'
}) {
  const nameKey = props.nameKey ?? 'name';
  const topN = props.topN ?? 5;
  const sorted = [...props.rows].sort((a, b) => (Number(b[props.sortKey]) || 0) - (Number(a[props.sortKey]) || 0));
  const top = sorted.slice(0, topN);
  const champ = top[0];
  const champCol = props.columns.find(c => c.primary) ?? props.columns.find(c => c.key === props.sortKey);

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card/70 overflow-hidden min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-primary/5">
        {props.icon}
        <h2 className="text-base font-bold uppercase tracking-wide">{props.title}</h2>
      </div>

      {!top.length ? (
        <div className="flex-1 grid place-items-center text-muted-foreground text-sm">Belum ada data</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Kartu Juara */}
          {champ && champCol && (
            <div className="flex items-center justify-between px-4 py-2 bg-amber-400/15">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">🥇</span>
                <span className="text-lg font-extrabold truncate">{champ[nameKey]}</span>
              </div>
              <span className="text-xl font-black text-amber-600 dark:text-amber-300 tabular-nums">
                {champCol.fmt ? champCol.fmt(champ[champCol.key], champ) : champ[champCol.key]}
              </span>
            </div>
          )}
          {/* Tabel Top-N */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-muted-foreground">
                  <th className="text-left font-semibold px-3 py-1 w-8">#</th>
                  <th className="text-left font-semibold px-1 py-1">Nama</th>
                  {props.columns.map(c => (
                    <th key={c.key} className="text-right font-semibold px-3 py-1">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={(r[nameKey] ?? i) + ''} className="border-t border-border/40">
                    <td className="px-3 py-1 tabular-nums">{MEDAL[i] ?? i + 1}</td>
                    <td className="px-1 py-1 font-semibold truncate max-w-[10rem]">{r[nameKey]}</td>
                    {props.columns.map(c => (
                      <td key={c.key} className="px-3 py-1 text-right tabular-nums font-medium">
                        {c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

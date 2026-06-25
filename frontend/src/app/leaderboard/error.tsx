"use client";

// Error boundary khusus route /leaderboard — supaya kalau render gagal,
// muncul pesan error (bukan blank putih) yang bisa dikirim ke developer.
export default function LeaderboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="max-w-2xl mx-auto mt-10">
            <div className="bg-card border border-red-500/30 rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-lg text-red-600 dark:text-red-300">Halaman Leaderboard gagal dimuat</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Ada error saat menampilkan halaman. Detail di bawah — screenshot & kirim ke developer.
                </p>
                <pre className="mt-3 text-xs bg-muted rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap text-foreground">
{error?.message || 'Unknown error'}
{error?.digest ? `\ndigest: ${error.digest}` : ''}
{error?.stack ? `\n\n${error.stack}` : ''}
                </pre>
                <button
                    onClick={reset}
                    className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                    Coba muat ulang
                </button>
            </div>
        </div>
    );
}

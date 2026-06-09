"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getArticles, deleteArticle, resolvePhotoUrl } from "@/lib/api";
import { FileText, Plus, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import dayjs from "dayjs";

export default function ArticlesPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["articles"], queryFn: getArticles });

    const del = useMutation({
        mutationFn: (id: number) => deleteArticle(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articles"] }),
    });

    return (
        <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-indigo-600" /> Artikel</h1>
                    <p className="text-sm text-gray-500">Kelola artikel/blog untuk landing page.</p>
                </div>
                <Link href="/articles/edit/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90">
                    <Plus className="h-4 w-4" /> Artikel Baru
                </Link>
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : !data || data.length === 0 ? (
                <div className="bg-white border rounded-xl p-10 text-center text-gray-500">Belum ada artikel. Klik "Artikel Baru" untuk membuat.</div>
            ) : (
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="text-left px-4 py-3">Judul</th>
                                <th className="text-left px-4 py-3 w-28">Status</th>
                                <th className="text-left px-4 py-3 w-36">Diperbarui</th>
                                <th className="text-right px-4 py-3 w-32">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((a) => (
                                <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {a.coverImage
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={resolvePhotoUrl(a.coverImage) || a.coverImage} alt="" className="w-12 h-9 object-cover rounded" />
                                                : <div className="w-12 h-9 rounded bg-gray-100" />}
                                            <div>
                                                <p className="font-medium text-gray-800">{a.title}</p>
                                                <p className="text-xs text-gray-400 font-mono">/{a.slug}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                            {a.status === "PUBLISHED" ? "Terbit" : "Draft"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{dayjs(a.updatedAt).format("DD MMM YYYY")}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {a.status === "PUBLISHED" && (
                                                <a href={`/artikel/${a.slug}`} target="_blank" rel="noreferrer" title="Lihat" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><ExternalLink className="h-4 w-4" /></a>
                                            )}
                                            <Link href={`/articles/edit/${a.id}`} title="Edit" className="p-1.5 rounded hover:bg-gray-100 text-indigo-600"><Pencil className="h-4 w-4" /></Link>
                                            <button
                                                title="Hapus"
                                                onClick={() => { if (confirm(`Hapus artikel "${a.title}"?`)) del.mutate(a.id); }}
                                                className="p-1.5 rounded hover:bg-gray-100 text-red-500"
                                            ><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPublicProduct } from '@/lib/api/products';
import { getPublicSettings } from '@/lib/api/settings';
import { ChevronLeft, ChevronRight, MessageCircle, Tag, Layers } from 'lucide-react';

interface PriceTier {
    id: number;
    tierName: string | null;
    minQty: number;
    maxQty: number | null;
    price: number;
}

interface Variant {
    id: number;
    variantName: string | null;
    sku: string;
    price: number;
    size: string | null;
    color: string | null;
    variantImageUrl: string | null;
    priceTiers: PriceTier[];
}

interface Product {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imageUrls: string | null;
    pricingMode: 'UNIT' | 'AREA_BASED';
    category: { name: string } | null;
    unit: { name: string } | null;
    variants: Variant[];
}

interface PublicSettings {
    storeName: string;
    storePhone: string | null;
    logoImageUrl: string | null;
}

function formatRupiah(val: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
}

function getBaseUrl() {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return base;
}

function resolveImageUrl(url: string | null | undefined) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${getBaseUrl()}${url}`;
}

export default function PublicProductPage() {
    const params = useParams();
    const id = Number(params.id);

    const [product, setProduct] = useState<Product | null>(null);
    const [settings, setSettings] = useState<PublicSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [activeImageIdx, setActiveImageIdx] = useState(0);
    const [activeVariantIdx, setActiveVariantIdx] = useState(0);

    useEffect(() => {
        if (!id || isNaN(id)) { setNotFound(true); setLoading(false); return; }
        Promise.all([getPublicProduct(id), getPublicSettings()])
            .then(([prod, cfg]) => {
                setProduct(prod);
                setSettings(cfg);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Memuat produk...</p>
                </div>
            </div>
        );
    }

    if (notFound || !product) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center px-6">
                    <div className="text-5xl mb-4">🔍</div>
                    <h1 className="text-xl font-semibold text-gray-800 mb-2">Produk tidak ditemukan</h1>
                    <p className="text-gray-500 text-sm">Link yang kamu akses mungkin sudah tidak aktif.</p>
                </div>
            </div>
        );
    }

    // Build image list: prefer imageUrls JSON array, fallback to imageUrl
    let images: string[] = [];
    if (product.imageUrls) {
        try { images = JSON.parse(product.imageUrls).map(resolveImageUrl).filter(Boolean); } catch { /* ignore */ }
    }
    if (images.length === 0 && product.imageUrl) {
        images = [resolveImageUrl(product.imageUrl)!];
    }

    const activeVariant = product.variants[activeVariantIdx] ?? null;
    const allImages = activeVariant?.variantImageUrl
        ? [resolveImageUrl(activeVariant.variantImageUrl)!, ...images]
        : images;

    const displayImages = allImages.length > 0 ? allImages : [];
    const currentImage = displayImages[activeImageIdx] ?? null;

    const isAreaBased = product.pricingMode === 'AREA_BASED';

    const waLink = settings?.storePhone
        ? `https://wa.me/${settings.storePhone.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo, saya tertarik dengan produk *${product.name}*`)}`
        : null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                {settings?.logoImageUrl ? (
                    <img src={resolveImageUrl(settings.logoImageUrl)!} alt="logo" className="h-8 w-8 object-contain rounded" />
                ) : (
                    <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{settings?.storeName?.charAt(0) ?? 'P'}</span>
                    </div>
                )}
                <span className="font-semibold text-gray-800 text-sm">{settings?.storeName ?? 'Toko'}</span>
            </header>

            <main className="flex-1 max-w-2xl mx-auto w-full px-0 sm:px-4 py-0 sm:py-6">
                <div className="bg-white sm:rounded-xl sm:shadow-sm overflow-hidden">
                    {/* Image Gallery */}
                    {displayImages.length > 0 ? (
                        <div className="relative bg-gray-100 aspect-square sm:aspect-[4/3] overflow-hidden">
                            <img
                                src={currentImage!}
                                alt={product.name}
                                className="w-full h-full object-contain"
                            />
                            {displayImages.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setActiveImageIdx(i => (i - 1 + displayImages.length) % displayImages.length)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setActiveImageIdx(i => (i + 1) % displayImages.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    {/* Dots */}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                        {displayImages.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setActiveImageIdx(i)}
                                                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeImageIdx ? 'bg-white' : 'bg-white/50'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="aspect-square sm:aspect-[4/3] bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-4xl">📦</span>
                        </div>
                    )}

                    <div className="p-4 sm:p-6">
                        {/* Category + Pricing mode badge */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {product.category && (
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                    <Tag className="w-3 h-3" />
                                    {product.category.name}
                                </span>
                            )}
                            {isAreaBased && (
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                    <Layers className="w-3 h-3" />
                                    Harga per m²
                                </span>
                            )}
                        </div>

                        {/* Product name */}
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{product.name}</h1>

                        {/* Unit */}
                        {product.unit && (
                            <p className="text-xs text-gray-400 mb-3">Satuan: {product.unit.name}</p>
                        )}

                        {/* Description */}
                        {product.description && (
                            <p className="text-sm text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{product.description}</p>
                        )}

                        {/* Variants */}
                        {product.variants.length > 0 && (
                            <div className="mb-4">
                                {/* Variant selector tabs if more than one */}
                                {product.variants.length > 1 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {product.variants.map((v, i) => (
                                            <button
                                                key={v.id}
                                                onClick={() => { setActiveVariantIdx(i); setActiveImageIdx(0); }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                    i === activeVariantIdx
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                                                }`}
                                            >
                                                {v.variantName ?? v.sku}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Active variant details */}
                                {activeVariant && (
                                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                        {/* Variant name + attributes */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {activeVariant.variantName && (
                                                <span className="text-sm font-semibold text-gray-800">{activeVariant.variantName}</span>
                                            )}
                                            {activeVariant.size && (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{activeVariant.size}</span>
                                            )}
                                            {activeVariant.color && (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{activeVariant.color}</span>
                                            )}
                                        </div>

                                        {/* SKU */}
                                        <p className="text-xs text-gray-400 mb-3">SKU: {activeVariant.sku}</p>

                                        {/* Price tiers or base price */}
                                        {activeVariant.priceTiers.length > 0 ? (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Harga Bertingkat</p>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                                                                <th className="pb-1.5 font-medium">Nama Tier</th>
                                                                <th className="pb-1.5 font-medium">Min. Qty</th>
                                                                <th className="pb-1.5 font-medium text-right">Harga</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {activeVariant.priceTiers.map((tier) => (
                                                                <tr key={tier.id} className="border-b border-gray-100 last:border-0">
                                                                    <td className="py-1.5 text-gray-700">{tier.tierName ?? '—'}</td>
                                                                    <td className="py-1.5 text-gray-600">≥ {tier.minQty}{tier.maxQty ? ` – ${tier.maxQty}` : '+'}</td>
                                                                    <td className="py-1.5 text-right font-semibold text-blue-700">
                                                                        {formatRupiah(Number(tier.price))}
                                                                        {isAreaBased && <span className="text-xs font-normal text-gray-400">/m²</span>}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold text-blue-700">{formatRupiah(Number(activeVariant.price))}</span>
                                                {isAreaBased && <span className="text-sm text-gray-400">/m²</span>}
                                                {product.unit && !isAreaBased && <span className="text-sm text-gray-400">/{product.unit.name}</span>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* WhatsApp CTA */}
                        {waLink && (
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Hubungi via WhatsApp
                            </a>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-4 text-xs text-gray-400">
                <p>{settings?.storeName ?? 'Toko'}</p>
                <p className="mt-1">© 2026 Muhammad Faisal</p>
            </footer>
        </div>
    );
}

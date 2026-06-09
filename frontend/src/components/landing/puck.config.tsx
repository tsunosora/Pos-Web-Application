import type { Config } from "@measured/puck";
import { ImageUploadField } from "./fields/ImageUploadField";
import { ProductGridRender } from "./blocks/ProductGridRender";
import { HeroSliderRender } from "./blocks/HeroSliderRender";
import { FeaturedSliderRender } from "./blocks/FeaturedSliderRender";
import { ArticleListRender } from "./blocks/ArticleListRender";
import { NavbarRender } from "./blocks/NavbarRender";
import { CategorySelectField } from "./fields/CategorySelectField";
import { ProductPickerField } from "./fields/ProductPickerField";

// Resolve URL gambar absolut untuk render (server & client). URL relatif (/uploads/..)
// di-prepend dengan API base.
const API = process.env.NEXT_PUBLIC_API_URL || "";
const imgSrc = (u?: string) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);

// Terima kode embed Google Maps penuh (<iframe src="...">) ATAU cuma URL src.
const mapSrc = (v?: string): string => {
    if (!v) return "";
    const t = v.trim();
    if (t.toLowerCase().includes("<iframe")) {
        const m = t.match(/src=["']([^"']+)["']/i);
        return m ? m[1] : "";
    }
    return t;
};

const imageField = {
    type: "custom" as const,
    label: "Gambar",
    render: ({ value, onChange }: any) => <ImageUploadField value={value} onChange={onChange} />,
};

const alignField = {
    type: "radio" as const,
    label: "Perataan",
    options: [
        { label: "Kiri", value: "left" },
        { label: "Tengah", value: "center" },
        { label: "Kanan", value: "right" },
    ],
};

const pad = (size: string) => (size === "none" ? "0px" : size === "sm" ? "24px" : size === "lg" ? "96px" : "56px");

export const config: Config = {
    root: {
        fields: {
            backgroundColor: { type: "text", label: "Warna Latar (hex)" },
        },
        defaultProps: { backgroundColor: "#ffffff" },
        render: ({ backgroundColor, children }: any) => (
            <div style={{ backgroundColor: backgroundColor || "#ffffff", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
                {children}
            </div>
        ),
    },
    components: {
        // ── Navbar (menu navigasi) ──────────────────────────────────────────
        Navbar: {
            label: "Navbar (Menu)",
            fields: {
                brandText: { type: "text", label: "Nama / Brand" },
                logoImage: imageField,
                links: {
                    type: "array",
                    label: "Menu",
                    arrayFields: {
                        label: { type: "text", label: "Teks" },
                        href: { type: "text", label: "Link (mis. #produk, /artikel)" },
                    },
                    defaultItemProps: { label: "Menu", href: "#" },
                    getItemSummary: (item: any) => item?.label || "Menu",
                },
                ctaLabel: { type: "text", label: "Teks tombol (opsional)" },
                ctaHref: { type: "text", label: "Link tombol" },
                sticky: { type: "radio", label: "Sticky (nempel atas)", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                bg: { type: "text", label: "Warna latar (hex)" },
                textColor: { type: "text", label: "Warna teks (hex)" },
                accent: { type: "text", label: "Warna aksen tombol (hex)" },
            },
            defaultProps: {
                brandText: "Toko Kamu",
                logoImage: "",
                links: [
                    { label: "Beranda", href: "#" },
                    { label: "Produk", href: "#produk" },
                    { label: "Artikel", href: "/artikel" },
                    { label: "Kontak", href: "#kontak" },
                ],
                ctaLabel: "Pesan Sekarang",
                ctaHref: "https://wa.me/62",
                sticky: "on",
                bg: "#ffffff",
                textColor: "#0f172a",
                accent: "#4f46e5",
            },
            render: ({ brandText, logoImage, links, ctaLabel, ctaHref, sticky, bg, textColor, accent }: any) => (
                <NavbarRender brandText={brandText} logoImage={logoImage} links={links} ctaLabel={ctaLabel} ctaHref={ctaHref} sticky={sticky} bg={bg} textColor={textColor} accent={accent} />
            ),
        },

        // ── Section / Kontainer (ruang layout — drop komponen ke dalamnya) ──
        Section: {
            label: "Section (Kontainer)",
            fields: {
                anchorId: { type: "text", label: "ID anchor (utk menu, mis. produk)" },
                columns: { type: "select", label: "Jumlah kolom", options: [
                    { label: "1 kolom", value: "1" }, { label: "2 kolom", value: "2" }, { label: "3 kolom", value: "3" }, { label: "4 kolom", value: "4" },
                ] },
                gap: { type: "number", label: "Jarak antar kolom (px)" },
                content: { type: "slot" },
                content2: { type: "slot" },
                content3: { type: "slot" },
                content4: { type: "slot" },
                bgImage: imageField,
                background: { type: "text", label: "Warna latar (hex)" },
                radius: { type: "select", label: "Sudut (membulat)", options: [
                    { label: "Lurus", value: "none" }, { label: "Kecil", value: "sm" }, { label: "Sedang", value: "md" }, { label: "Besar", value: "lg" }, { label: "Sangat besar", value: "xl" },
                ] },
                paddingY: { type: "select", label: "Padding atas-bawah", options: [
                    { label: "Tanpa", value: "none" }, { label: "Kecil", value: "sm" }, { label: "Sedang", value: "md" }, { label: "Besar", value: "lg" },
                ] },
                maxWidth: { type: "select", label: "Lebar", options: [
                    { label: "Terbatas (1100px)", value: "contained" }, { label: "Penuh", value: "full" },
                ] },
            },
            defaultProps: { anchorId: "", columns: "1", gap: 20, content: [], content2: [], content3: [], content4: [], bgImage: "", background: "", radius: "none", paddingY: "md", maxWidth: "contained" },
            // Sembunyikan slot kolom yang tidak dipakai sesuai jumlah kolom
            resolveFields: (data: any, { fields }: any) => {
                const cols = Number(data?.props?.columns) || 1;
                const f: any = { ...fields };
                if (cols < 4) delete f.content4;
                if (cols < 3) delete f.content3;
                if (cols < 2) delete f.content2;
                return f;
            },
            render: ({ anchorId, content: C1, content2: C2, content3: C3, content4: C4, columns, gap, bgImage, background, radius, paddingY, maxWidth }: any) => {
                const cols = Number(columns) || 1;
                const radiusMap: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 24, xl: 36 };
                const slots = [C1, C2, C3, C4].slice(0, cols);
                return (
                    <section id={anchorId || undefined} style={{ padding: "16px 24px", scrollMarginTop: 80 }}>
                        <div
                            style={{
                                maxWidth: maxWidth === "full" ? "100%" : 1100,
                                margin: "0 auto",
                                background: background || undefined,
                                backgroundImage: bgImage ? `url(${imgSrc(bgImage)})` : undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                borderRadius: radiusMap[radius] ?? 0,
                                overflow: (radiusMap[radius] ?? 0) > 0 ? "hidden" : undefined,
                                padding: `${pad(paddingY)} 24px`,
                            }}
                        >
                            <div style={{ display: cols > 1 ? "grid" : "block", gridTemplateColumns: cols > 1 ? `repeat(${cols}, 1fr)` : undefined, gap: gap ?? 20 }}>
                                {slots.map((Slot: any, i: number) => (
                                    <div key={i}><Slot /></div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            },
        },

        // ── Hero ───────────────────────────────────────────────────────────
        Hero: {
            label: "Hero",
            fields: {
                title: { type: "text", label: "Judul" },
                subtitle: { type: "textarea", label: "Subjudul" },
                image: imageField,
                align: alignField,
                ctaLabel: { type: "text", label: "Teks Tombol" },
                ctaHref: { type: "text", label: "Link Tombol" },
                minHeight: { type: "number", label: "Tinggi Min (px)" },
            },
            defaultProps: {
                title: "Selamat Datang di Toko Kami",
                subtitle: "Cetak berkualitas, harga bersahabat.",
                image: "",
                align: "center",
                ctaLabel: "Pesan via WhatsApp",
                ctaHref: "https://wa.me/62",
                minHeight: 420,
            },
            render: ({ title, subtitle, image, align, ctaLabel, ctaHref, minHeight }: any) => (
                <section
                    style={{
                        position: "relative",
                        minHeight: minHeight || 420,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
                        textAlign: align || "center",
                        padding: "48px 24px",
                        backgroundImage: image ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url(${imgSrc(image)})` : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        color: "#fff",
                    }}
                >
                    <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, maxWidth: 800, lineHeight: 1.1 }}>{title}</h1>
                    {subtitle && <p style={{ fontSize: 18, marginTop: 16, maxWidth: 640, opacity: 0.95 }}>{subtitle}</p>}
                    {ctaLabel && (
                        <a href={ctaHref || "#"} style={{ marginTop: 24, background: "#fff", color: "#4f46e5", padding: "12px 24px", borderRadius: 999, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
                            {ctaLabel}
                        </a>
                    )}
                </section>
            ),
        },

        // ── Hero Slider ─────────────────────────────────────────────────────
        HeroSlider: {
            label: "Hero Slider",
            fields: {
                slides: {
                    type: "array",
                    label: "Slide",
                    arrayFields: {
                        title: { type: "text", label: "Judul" },
                        subtitle: { type: "textarea", label: "Subjudul" },
                        image: imageField,
                        ctaLabel: { type: "text", label: "Teks Tombol" },
                        ctaHref: { type: "text", label: "Link Tombol" },
                        align: alignField,
                    },
                    defaultItemProps: { title: "Slide Baru", subtitle: "", image: "", ctaLabel: "", ctaHref: "", align: "center" },
                    getItemSummary: (item: any, i?: number) => item?.title || `Slide ${(i ?? 0) + 1}`,
                },
                autoplay: { type: "radio", label: "Putar otomatis", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                interval: { type: "number", label: "Interval (ms)" },
                minHeight: { type: "number", label: "Tinggi Min (px)" },
                showArrows: { type: "radio", label: "Tampilkan panah", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                showDots: { type: "radio", label: "Tampilkan titik", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                arrowStyle: { type: "select", label: "Gaya panah", options: [
                    { label: "Bulat gelap", value: "circleDark" }, { label: "Bulat terang", value: "circleLight" }, { label: "Minimal", value: "minimal" },
                ] },
            },
            defaultProps: {
                slides: [
                    { title: "Selamat Datang", subtitle: "Cetak berkualitas, harga bersahabat.", image: "", ctaLabel: "Pesan via WhatsApp", ctaHref: "https://wa.me/62", align: "center" },
                    { title: "Jersey & Konveksi", subtitle: "Desain bebas, hasil rapi.", image: "", ctaLabel: "", ctaHref: "", align: "center" },
                ],
                autoplay: "on",
                interval: 5000,
                minHeight: 440,
                showArrows: "on",
                showDots: "on",
                arrowStyle: "circleDark",
            },
            render: ({ slides, autoplay, interval, minHeight, showArrows, showDots, arrowStyle }: any) => (
                <HeroSliderRender slides={slides} autoplay={autoplay} interval={interval} minHeight={minHeight} showArrows={showArrows} showDots={showDots} arrowStyle={arrowStyle} />
            ),
        },

        // ── Heading ────────────────────────────────────────────────────────
        Heading: {
            label: "Judul",
            fields: {
                text: { type: "text", label: "Teks" },
                level: { type: "select", label: "Ukuran", options: [{ label: "Besar (H1)", value: "1" }, { label: "Sedang (H2)", value: "2" }, { label: "Kecil (H3)", value: "3" }] },
                align: alignField,
            },
            defaultProps: { text: "Judul Bagian", level: "2", align: "center" },
            render: ({ text, level, align }: any) => {
                const size = level === "1" ? 36 : level === "3" ? 20 : 28;
                return <h2 style={{ fontSize: size, fontWeight: 700, textAlign: align, margin: 0, padding: "32px 24px 8px" }}>{text}</h2>;
            },
        },

        // ── Text ───────────────────────────────────────────────────────────
        Text: {
            label: "Teks",
            fields: {
                text: { type: "textarea", label: "Isi" },
                align: alignField,
            },
            defaultProps: { text: "Tulis deskripsi di sini.", align: "left" },
            render: ({ text, align }: any) => (
                <p style={{ maxWidth: 800, margin: "0 auto", padding: "8px 24px", textAlign: align, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap" }}>{text}</p>
            ),
        },

        // ── Image ──────────────────────────────────────────────────────────
        Image: {
            label: "Gambar",
            fields: {
                image: imageField,
                alt: { type: "text", label: "Alt" },
                rounded: { type: "radio", label: "Sudut", options: [{ label: "Lurus", value: "0" }, { label: "Membulat", value: "16" }] },
            },
            defaultProps: { image: "", alt: "", rounded: "16" },
            render: ({ image, alt, rounded }: any) => (
                <div style={{ padding: "16px 24px", textAlign: "center" }}>
                    {image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={imgSrc(image)} alt={alt || ""} style={{ maxWidth: "100%", borderRadius: Number(rounded) || 0 }} />
                        : <div style={{ background: "#f1f5f9", color: "#94a3b8", padding: 40, borderRadius: 12 }}>Pilih gambar</div>}
                </div>
            ),
        },

        // ── Button ─────────────────────────────────────────────────────────
        Button: {
            label: "Tombol",
            fields: {
                label: { type: "text", label: "Teks" },
                href: { type: "text", label: "Link" },
                style: { type: "select", label: "Gaya", options: [{ label: "Solid", value: "solid" }, { label: "Outline", value: "outline" }] },
                align: alignField,
            },
            defaultProps: { label: "Klik di sini", href: "#", style: "solid", align: "center" },
            render: ({ label, href, style, align }: any) => (
                <div style={{ padding: "12px 24px", textAlign: align }}>
                    <a
                        href={href || "#"}
                        style={{
                            display: "inline-block", padding: "12px 24px", borderRadius: 999, fontWeight: 700, textDecoration: "none",
                            ...(style === "outline"
                                ? { border: "2px solid #4f46e5", color: "#4f46e5" }
                                : { background: "#4f46e5", color: "#fff" }),
                        }}
                    >
                        {label}
                    </a>
                </div>
            ),
        },

        // ── Spacer ─────────────────────────────────────────────────────────
        Spacer: {
            label: "Jarak",
            fields: { size: { type: "select", label: "Ukuran", options: [{ label: "Kecil", value: "sm" }, { label: "Sedang", value: "md" }, { label: "Besar", value: "lg" }] } },
            defaultProps: { size: "md" },
            render: ({ size }: any) => <div style={{ height: pad(size) }} />,
        },

        // ── Kolom (nested) ──────────────────────────────────────────────────
        TwoColumns: {
            label: "Dua Kolom",
            fields: {
                gap: { type: "number", label: "Jarak antar kolom (px)" },
                left: { type: "slot" },
                right: { type: "slot" },
            },
            defaultProps: { gap: 24, left: [], right: [] },
            render: ({ left: Left, right: Right, gap }: any) => (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: gap ?? 24, maxWidth: 1100, margin: "0 auto", padding: "8px 24px" }}>
                    <div><Left /></div>
                    <div><Right /></div>
                </div>
            ),
        },
        ThreeColumns: {
            label: "Tiga Kolom",
            fields: {
                gap: { type: "number", label: "Jarak antar kolom (px)" },
                col1: { type: "slot" },
                col2: { type: "slot" },
                col3: { type: "slot" },
            },
            defaultProps: { gap: 20, col1: [], col2: [], col3: [] },
            render: ({ col1: Col1, col2: Col2, col3: Col3, gap }: any) => (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: gap ?? 20, maxWidth: 1100, margin: "0 auto", padding: "8px 24px" }}>
                    <div><Col1 /></div>
                    <div><Col2 /></div>
                    <div><Col3 /></div>
                </div>
            ),
        },

        // ── Gallery ────────────────────────────────────────────────────────
        Gallery: {
            label: "Galeri",
            fields: {
                images: {
                    type: "array",
                    label: "Gambar",
                    arrayFields: { image: imageField },
                    defaultItemProps: { image: "" },
                },
                columns: { type: "select", label: "Kolom", options: [{ label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }] },
            },
            defaultProps: { images: [], columns: "3" },
            render: ({ images, columns }: any) => (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns || 3}, 1fr)`, gap: 12, padding: "16px 24px", maxWidth: 1100, margin: "0 auto" }}>
                    {(images || []).map((it: any, i: number) =>
                        it?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={imgSrc(it.image)} alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 10 }} />
                        ) : null,
                    )}
                </div>
            ),
        },

        // ── Daftar Artikel ──────────────────────────────────────────────────
        ArticleList: {
            label: "Daftar Artikel",
            fields: {
                heading: { type: "text", label: "Judul" },
                limit: { type: "number", label: "Jumlah artikel" },
                columns: { type: "select", label: "Kolom", options: [{ label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }] },
                showAllLink: { type: "radio", label: "Tautan 'Lihat semua'", options: [{ label: "Tampilkan", value: "on" }, { label: "Sembunyikan", value: "off" }] },
            },
            defaultProps: { heading: "Artikel Terbaru", limit: 3, columns: "3", showAllLink: "on" },
            render: ({ heading, limit, columns, showAllLink }: any) => (
                <ArticleListRender heading={heading} limit={limit} columns={columns} showAllLink={showAllLink} />
            ),
        },

        // ── Contact ────────────────────────────────────────────────────────
        Contact: {
            label: "Kontak & Peta",
            fields: {
                heading: { type: "text", label: "Judul" },
                address: { type: "textarea", label: "Alamat" },
                phone: { type: "text", label: "Telepon" },
                whatsapp: { type: "text", label: "Nomor WhatsApp (62...)" },
                mapsEmbedUrl: { type: "textarea", label: "Google Maps (paste kode <iframe> atau URL src)" },
            },
            defaultProps: { heading: "Hubungi Kami", address: "", phone: "", whatsapp: "62", mapsEmbedUrl: "" },
            render: ({ heading, address, phone, whatsapp, mapsEmbedUrl }: any) => {
                const map = mapSrc(mapsEmbedUrl);
                return (
                    <section style={{ padding: "40px 24px", maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: map ? "1fr 1fr" : "1fr", gap: 24, alignItems: "start" }}>
                        <div>
                            <h2 style={{ fontSize: 26, fontWeight: 700, marginTop: 0 }}>{heading}</h2>
                            {address && <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>📍 {address}</p>}
                            {phone && <p style={{ color: "#334155" }}>📞 {phone}</p>}
                            {whatsapp && (
                                <a href={`https://wa.me/${(whatsapp || "").replace(/\D/g, "")}`} style={{ display: "inline-block", marginTop: 8, background: "#25D366", color: "#fff", padding: "10px 18px", borderRadius: 999, fontWeight: 700, textDecoration: "none" }}>
                                    Chat WhatsApp
                                </a>
                            )}
                        </div>
                        {map && (
                            <iframe src={map} style={{ width: "100%", height: 260, border: 0, borderRadius: 12 }} loading="lazy" />
                        )}
                    </section>
                );
            },
        },

        // ── Produk Unggulan (Slider menonjol) ──────────────────────────────
        FeaturedSlider: {
            label: "Produk Unggulan (Slider)",
            fields: {
                eyebrow: { type: "text", label: "Label kecil" },
                mode: { type: "radio", label: "Sumber", options: [
                    { label: "Terlaris (paling banyak order)", value: "bestseller" },
                    { label: "Pilih manual", value: "manual" },
                ] },
                productIds: { type: "custom", label: "Pilih produk", render: ({ value, onChange }: any) => <ProductPickerField value={value} onChange={onChange} /> },
                limit: { type: "number", label: "Jumlah slide" },
                accent: { type: "text", label: "Warna aksen (hex)" },
                ctaLabel: { type: "text", label: "Teks tombol (opsional)" },
                ctaHref: { type: "text", label: "Link tombol" },
                autoplay: { type: "radio", label: "Putar otomatis", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                interval: { type: "number", label: "Interval (ms)" },
                showArrows: { type: "radio", label: "Tampilkan panah", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                showDots: { type: "radio", label: "Tampilkan titik", options: [{ label: "Ya", value: "on" }, { label: "Tidak", value: "off" }] },
                arrowStyle: { type: "select", label: "Gaya panah", options: [
                    { label: "Bulat terang", value: "circleLight" }, { label: "Bulat gelap", value: "circleDark" }, { label: "Minimal", value: "minimal" },
                ] },
            },
            defaultProps: { eyebrow: "Unggulan", mode: "bestseller", productIds: [], limit: 3, accent: "#4f46e5", ctaLabel: "Pesan Sekarang", ctaHref: "https://wa.me/62", autoplay: "on", interval: 5000, showArrows: "on", showDots: "on", arrowStyle: "circleLight" },
            resolveFields: (data: any, { fields }: any) => {
                const f: any = { ...fields };
                if (data?.props?.mode !== "manual") delete f.productIds;
                return f;
            },
            render: ({ eyebrow, mode, productIds, limit, accent, ctaLabel, ctaHref, autoplay, interval, showArrows, showDots, arrowStyle }: any) => (
                <FeaturedSliderRender eyebrow={eyebrow} mode={mode} productIds={productIds} limit={limit} accent={accent} ctaLabel={ctaLabel} ctaHref={ctaHref} autoplay={autoplay} interval={interval} showArrows={showArrows} showDots={showDots} arrowStyle={arrowStyle} />
            ),
        },

        // ── ProductGrid (parameter: mode/kategori/manual/urutan/kolom) ──────
        ProductGrid: {
            label: "Grid Produk",
            fields: {
                heading: { type: "text", label: "Judul" },
                mode: { type: "radio", label: "Sumber produk", options: [
                    { label: "Semua", value: "all" },
                    { label: "Per kategori", value: "category" },
                    { label: "Pilih manual (unggulan)", value: "manual" },
                ] },
                categoryId: { type: "custom", label: "Kategori", render: ({ value, onChange }: any) => <CategorySelectField value={value} onChange={onChange} /> },
                productIds: { type: "custom", label: "Produk unggulan", render: ({ value, onChange }: any) => <ProductPickerField value={value} onChange={onChange} /> },
                sort: { type: "select", label: "Urutkan", options: [
                    { label: "Terbaru", value: "newest" },
                    { label: "Nama (A-Z)", value: "name" },
                    { label: "Harga termurah", value: "priceAsc" },
                    { label: "Harga termahal", value: "priceDesc" },
                ] },
                limit: { type: "number", label: "Jumlah produk" },
                columns: { type: "select", label: "Kolom", options: [
                    { label: "Otomatis", value: "auto" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" },
                ] },
                accent: { type: "text", label: "Warna aksen (hex)" },
                cta: { type: "radio", label: "Tombol pesan (CTA)", options: [{ label: "Tampilkan", value: "on" }, { label: "Sembunyikan", value: "off" }] },
                ctaLabel: { type: "text", label: "Teks tombol CTA" },
                waNumber: { type: "text", label: "Nomor WhatsApp (kosong = pakai nomor toko)" },
                ctaLink: { type: "text", label: "Link custom (dipakai jika tak ada nomor WA)" },
            },
            defaultProps: { heading: "Produk Unggulan", mode: "all", categoryId: "", productIds: [], sort: "newest", limit: 6, columns: "auto", accent: "#4f46e5", cta: "on", ctaLabel: "Pesan via WhatsApp", waNumber: "", ctaLink: "" },
            // Tampilkan field kategori / pilih-produk hanya sesuai mode
            resolveFields: (data: any, { fields }: any) => {
                const m = data?.props?.mode;
                const f: any = { ...fields };
                if (m !== "category") delete f.categoryId;
                if (m !== "manual") delete f.productIds;
                return f;
            },
            render: ({ heading, mode, categoryId, productIds, sort, limit, columns, accent, cta, ctaLabel, waNumber, ctaLink }: any) => (
                <ProductGridRender heading={heading} mode={mode} categoryId={categoryId} productIds={productIds} sort={sort} limit={limit} columns={columns} accent={accent} cta={cta} ctaLabel={ctaLabel} waNumber={waNumber} ctaLink={ctaLink} />
            ),
        },
    },
};

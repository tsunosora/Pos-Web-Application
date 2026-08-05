import { useState } from 'react';
import { getDemoIcon } from '../components/demoIcons.js';
import { Store, ListChecks, Palette, Layout, Phone, Plus, Trash2, GripVertical, LayoutTemplate, Sparkles, Check, UtensilsCrossed } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import {
  RATIOS, LAYOUT_STYLES, BUSINESS_TYPES, DESIGN_THEMES,
  PALETTE_PRESETS, TYPOGRAPHY_STYLES, MOODS, PHOTO_STYLES, PAGE_COUNTS,
} from '../data/menuFBOptions.js';
import { MENU_FB_DEMOS } from '../data/menuFBDemos.js';
import { INITIAL_MENU_FB } from '../prompts/buildMenuFB.js';

export default function MenuFBMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });

  // ── Apply a template preset (full state replacement) ────────────────────
  const applyTemplate = (demo) => {
    dispatch({ type: 'RESET_TO', state: { ...INITIAL_MENU_FB, ...demo.preset, _templateId: demo.id } });
  };

  // ── Category mutations ──────────────────────────────────────────────────
  const updateCategories = (next) => dispatch({ type: 'SET_FIELD', field: 'categories', value: next });

  const addCategory = () => {
    updateCategories([
      ...(state.categories || []),
      { name: '', items: [{ name: '', desc: '', price: '' }] },
    ]);
  };

  const removeCategory = (idx) => {
    const next = [...(state.categories || [])];
    next.splice(idx, 1);
    updateCategories(next.length ? next : [{ name: '', items: [{ name: '', desc: '', price: '' }] }]);
  };

  const updateCategoryName = (idx, value) => {
    const next = [...(state.categories || [])];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], name: value };
    updateCategories(next);
  };

  const addItem = (catIdx) => {
    const next = [...(state.categories || [])];
    if (!next[catIdx]) return;
    next[catIdx] = {
      ...next[catIdx],
      items: [...(next[catIdx].items || []), { name: '', desc: '', price: '' }],
    };
    updateCategories(next);
  };

  const removeItem = (catIdx, itemIdx) => {
    const next = [...(state.categories || [])];
    if (!next[catIdx]) return;
    const items = [...(next[catIdx].items || [])];
    items.splice(itemIdx, 1);
    next[catIdx] = {
      ...next[catIdx],
      items: items.length ? items : [{ name: '', desc: '', price: '' }],
    };
    updateCategories(next);
  };

  const updateItem = (catIdx, itemIdx, field, value) => {
    const next = [...(state.categories || [])];
    if (!next[catIdx]) return;
    const items = [...(next[catIdx].items || [])];
    if (!items[itemIdx]) return;
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    next[catIdx] = { ...next[catIdx], items };
    updateCategories(next);
  };

  // ── Palette preset apply ────────────────────────────────────────────────
  const applyPalette = (presetValue) => {
    const preset = PALETTE_PRESETS.find((p) => p.value === presetValue);
    set('palettePreset')(presetValue);
    if (preset) {
      set('primaryColor')(preset.primary);
      set('secondaryColor')(preset.secondary);
    }
  };

  const totalItems = (state.categories || []).reduce(
    (acc, c) => acc + ((c && c.items) ? c.items.length : 0),
    0,
  );

  return (
    <div className="space-y-3">

      {/* TEMPLATE PICKER — pilih demo template dulu sebelum customize */}
      <TemplatePickerSection
        currentTemplateId={state._templateId}
        currentBrand={state.brand}
        onPick={applyTemplate}
      />

      {/* SECTION A — Brand Info */}
      <Section num="A" title="Informasi Brand & Bisnis" icon={Store}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Nama Brand / Resto" value={state.brand} onChange={set('brand')} required placeholder="Cherryelle Patisserie" />
          <SelectField label="Tipe Bisnis" value={state.businessType} onChange={set('businessType')} options={BUSINESS_TYPES} />
        </div>
        <div className="mt-3">
          <TextField label="Tagline / Slogan" value={state.tagline} onChange={set('tagline')} placeholder="pâtisserie artisanale · baked fresh daily" />
        </div>
        <div className="mt-3">
          <TextareaField label="Deskripsi Singkat (Opsional)" value={state.description} onChange={set('description')}
            placeholder="French-inspired patisserie serving handcrafted pastries..." rows={2} />
        </div>
      </Section>

      {/* SECTION B — Menu Items (DYNAMIC) */}
      <Section
        num="B"
        title="Menu Items"
        icon={ListChecks}
        headerExtra={
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">
            {(state.categories || []).length} kategori · {totalItems} item
          </span>
        }
      >
        <div className="space-y-3">
          {(state.categories || []).map((cat, catIdx) => (
            <CategoryCard
              key={catIdx}
              cat={cat}
              catIdx={catIdx}
              onUpdateName={(v) => updateCategoryName(catIdx, v)}
              onRemove={() => removeCategory(catIdx)}
              onAddItem={() => addItem(catIdx)}
              onRemoveItem={(i) => removeItem(catIdx, i)}
              onUpdateItem={(i, f, v) => updateItem(catIdx, i, f, v)}
            />
          ))}

          <button
            type="button"
            onClick={addCategory}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border hover:border-accent hover:text-accent text-text-mut text-xs font-medium transition"
          >
            <Plus className="w-4 h-4" /> Tambah Kategori
          </button>
        </div>
      </Section>

      {/* SECTION C — Layout & Format */}
      <Section num="C" title="Layout & Format" icon={Layout}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Layout Style" value={state.layoutStyle} onChange={set('layoutStyle')} options={LAYOUT_STYLES} />
          <SelectField label="Jumlah Halaman" value={state.pageCount ?? 1}
            onChange={(v) => set('pageCount')(+v)} options={PAGE_COUNTS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Rasio Aspek" value={state.ratio} onChange={set('ratio')} options={RATIOS} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text">Display Options</label>
            <div className="flex flex-col gap-1.5">
              <ToggleRow label="Tampilkan harga" checked={state.showPrices !== false} onChange={(v) => set('showPrices')(v)} />
              <ToggleRow label="Tampilkan foto item" checked={!!state.showPhotos} onChange={(v) => set('showPhotos')(v)} />
            </div>
          </div>
        </div>
      </Section>

      {/* SECTION D — Visual & Typography */}
      <Section num="D" title="Visual & Typography" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Design Theme" value={state.designTheme} onChange={set('designTheme')} options={DESIGN_THEMES} />
          <SelectField label="Mood / Atmosfir" value={state.mood} onChange={set('mood')} options={MOODS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Tipografi" value={state.typography} onChange={set('typography')} options={TYPOGRAPHY_STYLES} />
          <SelectField label="Gaya Fotografi" value={state.photoStyle} onChange={set('photoStyle')} options={PHOTO_STYLES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Palette Preset"
            value={state.palettePreset}
            onChange={applyPalette}
            options={PALETTE_PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
          <ColorSwatch
            label="Custom Warna (override preset)"
            primary={state.primaryColor}
            secondary={state.secondaryColor}
            onPrimary={set('primaryColor')}
            onSecondary={set('secondaryColor')}
          />
        </div>
      </Section>

      {/* SECTION E — Contact & CTA */}
      <Section num="E" title="Kontak & Call-to-Action" icon={Phone}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Call-to-Action" value={state.cta} onChange={set('cta')} placeholder="Order via WhatsApp · 0812-3456-7890" />
          <TextField label="Info Kontak / Social" value={state.contactInfo} onChange={set('contactInfo')} placeholder="@cherryelle.patisserie · cherryelle.id" />
        </div>
      </Section>

    </div>
  );
}

// ─── Category Card (dynamic editor) ──────────────────────────────────────
function CategoryCard({ cat, catIdx, onUpdateName, onRemove, onAddItem, onRemoveItem, onUpdateItem }) {
  const items = cat?.items || [];

  return (
    <div className="surface-elev p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-accent-sm flex items-center justify-center text-accent text-[10px] font-bold mono shrink-0">
          {catIdx + 1}
        </div>
        <input
          type="text"
          value={cat?.name || ''}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="Nama Kategori (CROISSANT / MAIN / SIDES)"
          className="input flex-1 !text-xs uppercase tracking-wider font-semibold"
        />
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-md border border-border hover:border-red-500 hover:text-red-500 text-text-mut flex items-center justify-center transition shrink-0"
          title="Hapus kategori"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1.5 bg-bg-deep/50 p-1.5 rounded border border-border">
            <div className="flex items-center text-text-dim pt-2 shrink-0">
              <GripVertical className="w-3 h-3" />
            </div>
            <div className="grid grid-cols-12 gap-1.5 flex-1 min-w-0">
              <input
                type="text"
                value={it?.name || ''}
                onChange={(e) => onUpdateItem(i, 'name', e.target.value)}
                placeholder="Nama menu"
                className="input col-span-5 !text-[11px]"
              />
              <input
                type="text"
                value={it?.desc || ''}
                onChange={(e) => onUpdateItem(i, 'desc', e.target.value)}
                placeholder="deskripsi singkat"
                className="input col-span-5 !text-[11px] !text-text-mut"
              />
              <input
                type="text"
                value={it?.price || ''}
                onChange={(e) => onUpdateItem(i, 'price', e.target.value)}
                placeholder="35K"
                className="input col-span-2 !text-[11px] mono text-right"
              />
            </div>
            <button
              type="button"
              onClick={() => onRemoveItem(i)}
              className="w-6 h-6 rounded border border-border hover:border-red-500 hover:text-red-500 text-text-dim flex items-center justify-center transition shrink-0 mt-0.5"
              title="Hapus item"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddItem}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-border hover:border-accent hover:text-accent text-text-dim text-[11px] mono uppercase tracking-widest transition"
        >
          <Plus className="w-3 h-3" /> Tambah Item
        </button>
      </div>
    </div>
  );
}

// ─── Template Picker (horizontal strip at top of form) ──────────────────
function TemplatePickerSection({ currentTemplateId, currentBrand, onPick }) {
  const [expanded, setExpanded] = useState(false);

  const activeDemo = MENU_FB_DEMOS.find((d) => d.id === currentTemplateId);
  const isEmpty = !currentBrand && !currentTemplateId;

  return (
    <Section
      num="0"
      title={activeDemo ? `Template: ${activeDemo.label}` : 'Pilih Template Demo'}
      icon={LayoutTemplate}
      headerExtra={
        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="chip-attention inline-flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              Mulai di sini
            </span>
          )}
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim hidden sm:inline">
            {MENU_FB_DEMOS.length} template
          </span>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] text-accent hover:text-accent-h uppercase tracking-wider mono font-bold whitespace-nowrap"
          >
            {expanded ? 'Tutup' : 'Lihat Semua'}
          </button>
        </div>
      }
    >
      {/* Helper text */}
      <div className="flex items-start gap-2 mb-3 px-2 py-2 rounded-md bg-accent-sm border border-accent/30">
        <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] text-text leading-relaxed">
          {activeDemo
            ? <>Template aktif: <strong>{activeDemo.label}</strong>. Form di bawah sudah terisi otomatis. Kamu bisa edit semua field, atau pilih template lain di bawah.</>
            : 'Pilih salah satu template di bawah untuk auto-fill form (brand, menu items, palette, layout, typography). Setelah itu kamu bisa customize sesuai kebutuhan.'}
        </p>
      </div>

      {/* Template grid — horizontal scroll kalau ga expanded, full grid kalau expanded */}
      <div className={expanded
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'
        : 'flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-1 px-1'
      }>
        {MENU_FB_DEMOS.map((demo) => (
          <TemplateCard
            key={demo.id}
            demo={demo}
            active={demo.id === currentTemplateId}
            compact={!expanded}
            onClick={() => onPick(demo)}
          />
        ))}
      </div>
    </Section>
  );
}

function TemplateCard({ demo, active, compact, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = getDemoIcon(demo.icon, UtensilsCrossed);
  const primary = demo.preset.primaryColor || '#7c1d2e';
  const secondary = demo.preset.secondaryColor || '#fdf2e9';
  const thumbnailSrc = `/landing/menu-fb/${demo.id}.jpg`;
  const catCount = (demo.preset.categories || []).length;
  const itemCount = (demo.preset.categories || []).reduce(
    (a, c) => a + ((c.items || []).length),
    0,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      title={`${demo.label} · ${demo.preset.brand}`}
      className={`
        relative flex flex-col gap-1.5 p-1.5 rounded-md text-left transition shrink-0
        ${compact ? 'w-[140px]' : 'w-full'}
        ${active
          ? 'border-2 border-accent bg-accent-sm'
          : 'border border-border bg-bg-deep hover:border-accent/60'}
      `}
    >
      {/* Thumbnail */}
      <div
        className="aspect-[4/5] w-full rounded overflow-hidden border border-border relative"
        style={{ background: secondary }}
      >
        {!imgFailed ? (
          <img
            src={thumbnailSrc}
            alt={demo.label}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{ background: `linear-gradient(135deg, ${secondary} 0%, ${primary}20 100%)` }}
          >
            <Icon className="w-7 h-7" style={{ color: primary, opacity: 0.6 }} />
            <span className="text-[8px] mono uppercase tracking-widest opacity-50" style={{ color: primary }}>
              No preview
            </span>
          </div>
        )}

        {/* Active checkmark overlay */}
        {active && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-md">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="px-0.5">
        <div className="text-[11px] font-semibold leading-tight truncate">{demo.label}</div>
        <div className="text-[9px] text-text-dim mono uppercase tracking-widest truncate">
          {catCount} kat · {itemCount} item
        </div>
      </div>
    </button>
  );
}

// ─── Toggle row ──────────────────────────────────────────────────────────
function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition relative ${checked ? 'bg-accent' : 'bg-bg-deep border border-border'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

import { useState, useReducer, useMemo, useDeferredValue } from 'react';
import { PlayCircle } from 'lucide-react';
import { CONFIG, brandParts } from './config.js';
import { getDemoIcon } from './components/demoIcons.js';
import Sidebar from './components/Sidebar.jsx';
import StatusBar from './components/StatusBar.jsx';
import MockupPreview from './components/MockupPreview.jsx';
import PromptPanel from './components/PromptPanel.jsx';
import DemoCategoryModal from './components/DemoCategoryModal.jsx';
import CarouselDemoModal from './components/CarouselDemoModal.jsx';
import MenuFBDemoModal from './components/MenuFBDemoModal.jsx';
import AffiliateDemoModal from './components/AffiliateDemoModal.jsx';
import TutorialModal from './components/TutorialModal.jsx';
import CopySuccessModal from './components/CopySuccessModal.jsx';
import AffiliateProgramModal from './components/AffiliateProgramModal.jsx';
import ResellerModal from './components/ResellerModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LoginPage from './components/LoginPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import BannerMode from './modes/BannerMode.jsx';
import CarouselMode from './modes/CarouselMode.jsx';
import CarouselOutput from './components/CarouselOutput.jsx';
import GridFeedMode from './modes/GridFeedMode.jsx';
import ThumbnailMode from './modes/ThumbnailMode.jsx';
import TypographyMode from './modes/TypographyMode.jsx';
import CopywritingMode from './modes/CopywritingMode.jsx';
import FaceCardMode from './modes/FaceCardMode.jsx';
import MenuFBMode from './modes/MenuFBMode.jsx';
import LogoAffiliateMode from './modes/LogoAffiliateMode.jsx';
import TryOnAffiliateMode from './modes/TryOnAffiliateMode.jsx';
import ReviewAffiliateMode from './modes/ReviewAffiliateMode.jsx';
import StoryboardAffiliateMode from './modes/StoryboardAffiliateMode.jsx';
import { buildBanner, INITIAL_BANNER } from './prompts/buildBanner.js';
import { generateCarouselPrompts, INITIAL_CAROUSEL } from './prompts/buildCarousel.js';
import { buildGridFeed, INITIAL_GRIDFEED } from './prompts/buildGridFeed.js';
import { buildThumbnail, INITIAL_THUMBNAIL } from './prompts/buildThumbnail.js';
import { buildTypography, INITIAL_TYPOGRAPHY } from './prompts/buildTypography.js';
import { buildCopywriting, INITIAL_COPYWRITING } from './prompts/buildCopywriting.js';
import { buildFaceCard, INITIAL_FACECARD } from './prompts/buildFaceCard.js';
import { buildMenuFB, INITIAL_MENU_FB } from './prompts/buildMenuFB.js';
import { buildLogoAffiliate, INITIAL_LOGO_AFFILIATE } from './prompts/buildLogoAffiliate.js';
import { buildTryOnAffiliate, INITIAL_TRYON_AFFILIATE } from './prompts/buildTryOnAffiliate.js';
import { buildReviewAffiliate, INITIAL_REVIEW_AFFILIATE } from './prompts/buildReviewAffiliate.js';
import { buildStoryboardAffiliate, INITIAL_STORYBOARD_AFFILIATE } from './prompts/buildStoryboardAffiliate.js';
import { SUB_TYPES as FACECARD_SUB_TYPES } from './data/faceCardOptions.js';
import { useHistory } from './context/HistoryContext.jsx';

function modeReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'LOAD_DEMO': return { ...state, ...action.preset };
    case 'RESET_TO':  return { ...action.state };
    default: return state;
  }
}

const TITLES = {
  banner:      { name: 'Design Feeds', desc: 'Isi detail produk untuk menghasilkan desain feed profesional siap pakai.' },
  carousel:    { name: 'Carousel Feeds', desc: 'Pilih tipe template carousel & jumlah slide — sistem menyusun story flow, objektif tiap slide, dan variasi layout jadi satu rangkaian konten.' },
  gridfeed:    { name: '9 Feed Konsisten', desc: 'Isi info produk → sistem susun konsep 9 feed konsisten satu campaign, tiap feed beda peran (hero, fitur, harga, testimoni, CTA, dll). Ikuti video tutorial untuk hasilkan visualnya.' },
  thumbnail:   { name: 'Youtube Thumbnail', desc: 'Isi detail video untuk menghasilkan thumbnail YouTube profesional siap pakai.' },
  typography:  { name: 'Ads Typography', desc: 'Arahkan AI Creative Director untuk Typography Ads premium.' },
  copywriting: { name: 'Copy Writing', desc: 'AI Creative Copy Engine untuk kebutuhan banner & iklan.' },
  facecard:    { name: 'Face Card Analysis', desc: 'Buat analisa wajah editorial: face features, spectacles, style, color, dan makeup. Ikuti video tutorial untuk memakai hasilnya.' },
  menufb:      { name: 'Menu F&B', desc: 'Buat menu poster F&B dinamis — patisserie, restaurant, healthy food, dessert. Wireframe live update sesuai input.' },
  logoaffiliate:       { name: 'Logo', desc: 'Buat identitas logo brand affiliate-ready: konsep brand + arahan visual lengkap. Ikuti video tutorial untuk hasilkan logonya.' },
  tryonaffiliate:      { name: 'Try-On Produk Affiliate', desc: 'Buat konsep try-on / wear-test produk. Pakai foto produk + ikuti video tutorial untuk hasilkan visual konversi tinggi.' },
  reviewaffiliate:     { name: 'Review Produk Affiliate', desc: 'Buat konsep BANNER review produk high-converting. Pakai foto produk — produk dijaga sama persis.' },
  storyboardaffiliate: { name: 'Storyboard Affiliate', desc: 'Buat konsep storyboard video: scene-by-scene + caption + shot list otomatis. Pakai foto produk + ikuti video tutorial.' },
};

const HAS_MOCKUP = {
  banner: true, carousel: true, gridfeed: false, thumbnail: true, typography: true,
  copywriting: false, facecard: false, menufb: false,
  logoaffiliate: false, tryonaffiliate: false, reviewaffiliate: true,
  storyboardaffiliate: false,
};

export default function StudioApp() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <AuthedApp />;
}

function AuthedApp() {
  const [mode, setMode] = useState('banner');
  const [demoOpen, setDemoOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [affiliateProgramOpen, setAffiliateProgramOpen] = useState(false);
  const [resellerOpen, setResellerOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(null);  // {label, icon} while applying demo
  const [restoreSignal, setRestoreSignal] = useState(0);
  // Mode yang baru saja di-restore dari history. Dipakai supaya panel output
  // (yang remount saat menyeberang batas carousel) langsung menampilkan prompt.
  // Di-reset null saat user navigasi via sidebar → tidak ada false-positive.
  const [restoredMode, setRestoredMode] = useState(null);
  const { add } = useHistory();

  const changeMode = (m) => { setRestoredMode(null); setMode(m); };

  const [banner, dispatchBanner]           = useReducer(modeReducer, INITIAL_BANNER);
  const [carousel, dispatchCarousel]       = useReducer(modeReducer, INITIAL_CAROUSEL);
  const [gridfeed, dispatchGridfeed]       = useReducer(modeReducer, INITIAL_GRIDFEED);
  const [thumbnail, dispatchThumbnail]     = useReducer(modeReducer, INITIAL_THUMBNAIL);
  const [typography, dispatchTypography]   = useReducer(modeReducer, INITIAL_TYPOGRAPHY);
  const [copywriting, dispatchCopywriting] = useReducer(modeReducer, INITIAL_COPYWRITING);
  const [facecard, dispatchFacecard]       = useReducer(modeReducer, INITIAL_FACECARD);
  const [menufb, dispatchMenufb]           = useReducer(modeReducer, INITIAL_MENU_FB);
  const [logoAff, dispatchLogoAff]                 = useReducer(modeReducer, INITIAL_LOGO_AFFILIATE);
  const [tryonAff, dispatchTryonAff]               = useReducer(modeReducer, INITIAL_TRYON_AFFILIATE);
  const [reviewAff, dispatchReviewAff]             = useReducer(modeReducer, INITIAL_REVIEW_AFFILIATE);
  const [storyboardAff, dispatchStoryboardAff]     = useReducer(modeReducer, INITIAL_STORYBOARD_AFFILIATE);

  const activeState =
    mode === 'banner'              ? banner :
    mode === 'carousel'            ? carousel :
    mode === 'gridfeed'            ? gridfeed :
    mode === 'thumbnail'           ? thumbnail :
    mode === 'typography'          ? typography :
    mode === 'facecard'            ? facecard :
    mode === 'menufb'              ? menufb :
    mode === 'logoaffiliate'       ? logoAff :
    mode === 'tryonaffiliate'      ? tryonAff :
    mode === 'reviewaffiliate'     ? reviewAff :
    mode === 'storyboardaffiliate' ? storyboardAff :
    copywriting;
  const deferredState = useDeferredValue(activeState);

  const prompt = useMemo(() => {
    if (mode === 'banner')              return buildBanner(deferredState);
    if (mode === 'carousel')            return generateCarouselPrompts(deferredState);
    if (mode === 'gridfeed')            return buildGridFeed(deferredState);
    if (mode === 'thumbnail')           return buildThumbnail(deferredState);
    if (mode === 'typography')          return buildTypography(deferredState);
    if (mode === 'copywriting')         return buildCopywriting(deferredState);
    if (mode === 'facecard')            return buildFaceCard(deferredState);
    if (mode === 'menufb')              return buildMenuFB(deferredState);
    if (mode === 'logoaffiliate')       return buildLogoAffiliate(deferredState);
    if (mode === 'tryonaffiliate')      return buildTryOnAffiliate(deferredState);
    if (mode === 'reviewaffiliate')     return buildReviewAffiliate(deferredState);
    if (mode === 'storyboardaffiliate') return buildStoryboardAffiliate(deferredState);
    return null;
  }, [mode, deferredState]);

  const promptLabel = (() => {
    if (mode === 'banner')      return activeState.brand || activeState.headline || 'Banner Prompt';
    if (mode === 'carousel') {
      if (activeState.templateType === 'news') {
        const twoWords = (activeState.newsContent || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
        return twoWords ? `📰 ${twoWords}` : 'News Carousel';
      }
      return activeState.productName || activeState.brandName || activeState.slide1Headline || 'Carousel Feeds';
    }
    if (mode === 'gridfeed')    return activeState.productName || activeState.brandName || activeState.headline || '9 Feed Konsisten';
    if (mode === 'thumbnail')   return activeState.title || activeState.channel || 'Thumbnail Prompt';
    if (mode === 'typography')  return activeState.hook || 'Typography Prompt';
    if (mode === 'copywriting') return (activeState.summary || 'Copy Writing').slice(0, 60);
    if (mode === 'facecard') {
      const sub = FACECARD_SUB_TYPES.find((t) => t.value === activeState.subType);
      return sub ? sub.title : 'Face Card Prompt';
    }
    if (mode === 'menufb')              return activeState.brand || 'Menu F&B Prompt';
    if (mode === 'logoaffiliate')       return activeState.brand_name || 'Logo Affiliate Prompt';
    if (mode === 'tryonaffiliate')      return activeState.product_name || 'Try-On Affiliate Prompt';
    if (mode === 'reviewaffiliate')     return activeState.product_name || 'Review Affiliate Prompt';
    if (mode === 'storyboardaffiliate') return activeState.product_name || 'Storyboard Affiliate Prompt';
    return 'Prompt';
  })();

  const handleDemoPick = (cat) => {
    setLoadingDemo({ label: cat.label, icon: cat.icon });
    setTimeout(() => {
      dispatchBanner({ type: 'LOAD_DEMO', preset: cat.presets.banner });
      dispatchThumbnail({ type: 'LOAD_DEMO', preset: cat.presets.thumbnail });
      dispatchTypography({ type: 'LOAD_DEMO', preset: cat.presets.typography });
      if (cat.presets.copywriting) {
        dispatchCopywriting({ type: 'LOAD_DEMO', preset: cat.presets.copywriting });
      }
      // Feed Grid 3x3 ikut demo 48 kategori — map dari preset banner + audience copy.
      const b = cat.presets.banner || {};
      dispatchGridfeed({ type: 'LOAD_DEMO', preset: {
        brandName: b.brand || '',
        productName: b.headline || b.brand || '',
        productDesc: b.description || '',
        headline: '',
        supportingText: b.tagline || b.description || '',
        mainBenefit: (Array.isArray(b.features) && b.features[0]) || b.tagline || '',
        ctaText: b.cta || '',
        targetAudience: (cat.presets.copywriting && cat.presets.copywriting.audience) || '',
        useCustomColor: !!b.primaryColor,
        colorPrimary: b.primaryColor || '#ec4899',
        colorSecondary: b.secondaryColor || '#ffffff',
      } });
      // Note: facecard & menufb tidak ikut LOAD_DEMO — punya demo modal sendiri.
      setLoadingDemo(null);
    }, 900);
  };

  const handleCarouselDemoPick = (demo) => {
    setLoadingDemo({ label: demo.label, icon: demo.icon });
    setTimeout(() => {
      dispatchCarousel({ type: 'RESET_TO', state: { ...INITIAL_CAROUSEL, ...demo.preset } });
      setLoadingDemo(null);
    }, 600);
  };

  const handleMenuFBDemoPick = (demo) => {
    setLoadingDemo({ label: demo.label, icon: demo.icon });
    setTimeout(() => {
      // RESET_TO so the new preset fully replaces state (not merged with old categories[])
      dispatchMenufb({ type: 'RESET_TO', state: { ...INITIAL_MENU_FB, ...demo.preset } });
      setLoadingDemo(null);
    }, 900);
  };

  const handleAffiliateDemoPick = (demo) => {
    setLoadingDemo({ label: demo.label, icon: 'Sparkles' });
    setTimeout(() => {
      const initialMap = {
        logoaffiliate:       INITIAL_LOGO_AFFILIATE,
        tryonaffiliate:      INITIAL_TRYON_AFFILIATE,
        reviewaffiliate:     INITIAL_REVIEW_AFFILIATE,
        storyboardaffiliate: INITIAL_STORYBOARD_AFFILIATE,
      };
      const dispatchMap = {
        logoaffiliate:       dispatchLogoAff,
        tryonaffiliate:      dispatchTryonAff,
        reviewaffiliate:     dispatchReviewAff,
        storyboardaffiliate: dispatchStoryboardAff,
      };
      const dispatch = dispatchMap[mode];
      const initial = initialMap[mode];
      if (dispatch && initial) {
        // Logo punya output_mode switch (logo/mockup) — pertahankan tab aktif
        // supaya load demo saat di Brand Mockup nggak melempar user balik ke Buat Logo.
        const extra = mode === 'logoaffiliate' ? { output_mode: logoAff.output_mode } : {};
        dispatch({ type: 'RESET_TO', state: { ...initial, ...demo.preset, ...extra } });
      }
      setLoadingDemo(null);
    }, 600);
  };

  const handleGenerate = () => {
    // All affiliate modes return string. Banner/typography/menufb/facecard return objects.
    const TEXT_MODES = ['gridfeed', 'thumbnail', 'copywriting', 'logoaffiliate', 'tryonaffiliate', 'reviewaffiliate', 'storyboardaffiliate'];
    const text = mode === 'carousel'
      ? (Array.isArray(prompt) ? prompt : []).map((s) => `=== ${s.slideTitle} | Layout: ${s.layout} ===\n${s.prompt}`).join('\n\n\n')
      : TEXT_MODES.includes(mode)
        ? prompt
        : (mode === 'typography' && prompt?.json)
          ? JSON.stringify(prompt.json, null, 2)
          : JSON.stringify(prompt, null, 2);
    add({
      mode,
      label: promptLabel,
      primaryColor: activeState.primaryColor || activeState.colorPrimary || '#ef4444',
      prompt: text,
      snapshot: activeState,
    });
  };

  const handleRestore = (entry) => {
    if (!entry || !entry.snapshot) return;
    // Cegah crash: hanya restore mode yang dikenal (import korup / versi lama bisa
    // bawa mode asing → TITLES[mode] undefined → t.name crash).
    if (!TITLES[entry.mode]) return;
    // Merge snapshot OVER initial state — ensures fields added in newer
    // versions have default values, preventing crashes on old history entries.
    const safe = (initial, snap) => ({ ...initial, ...(snap || {}) });
    if (entry.mode === 'banner')           dispatchBanner({ type: 'RESET_TO', state: safe(INITIAL_BANNER, entry.snapshot) });
    else if (entry.mode === 'carousel')    dispatchCarousel({ type: 'RESET_TO', state: safe(INITIAL_CAROUSEL, entry.snapshot) });
    else if (entry.mode === 'gridfeed')    dispatchGridfeed({ type: 'RESET_TO', state: safe(INITIAL_GRIDFEED, entry.snapshot) });
    else if (entry.mode === 'thumbnail')   dispatchThumbnail({ type: 'RESET_TO', state: safe(INITIAL_THUMBNAIL, entry.snapshot) });
    else if (entry.mode === 'typography')  dispatchTypography({ type: 'RESET_TO', state: safe(INITIAL_TYPOGRAPHY, entry.snapshot) });
    else if (entry.mode === 'copywriting') dispatchCopywriting({ type: 'RESET_TO', state: safe(INITIAL_COPYWRITING, entry.snapshot) });
    else if (entry.mode === 'facecard')    dispatchFacecard({ type: 'RESET_TO', state: safe(INITIAL_FACECARD, entry.snapshot) });
    else if (entry.mode === 'menufb')              dispatchMenufb({ type: 'RESET_TO', state: safe(INITIAL_MENU_FB, entry.snapshot) });
    else if (entry.mode === 'logoaffiliate')       dispatchLogoAff({ type: 'RESET_TO', state: safe(INITIAL_LOGO_AFFILIATE, entry.snapshot) });
    else if (entry.mode === 'tryonaffiliate')      dispatchTryonAff({ type: 'RESET_TO', state: safe(INITIAL_TRYON_AFFILIATE, entry.snapshot) });
    else if (entry.mode === 'reviewaffiliate')     dispatchReviewAff({ type: 'RESET_TO', state: safe(INITIAL_REVIEW_AFFILIATE, entry.snapshot) });
    else if (entry.mode === 'storyboardaffiliate') dispatchStoryboardAff({ type: 'RESET_TO', state: safe(INITIAL_STORYBOARD_AFFILIATE, entry.snapshot) });
    setRestoredMode(entry.mode);
    setMode(entry.mode);
    // Bump signal so PromptPanel auto-shows the restored prompt across mode switch
    setRestoreSignal((s) => s + 1);
  };

  const t = TITLES[mode] || { name: CONFIG.brandName, desc: '' };
  const showMockup = HAS_MOCKUP[mode];

  return (
    <div className="lg:h-screen lg:flex lg:flex-col lg:overflow-hidden">
      {/* Top bar */}
      <header className="h-14 px-4 sm:px-5 border-b border-border bg-bg-panel/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 lg:static">
        <div className="leading-tight min-w-0">
          <div className="text-base font-bold flex items-center gap-2">
            {brandParts().lead && <>{brandParts().lead} </>}<span className="text-accent">{brandParts().accent}</span>
            <span className="inline-flex text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent text-white mono font-bold">LIVE</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-text-dim mono uppercase tracking-widest">{CONFIG.tagline}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTutorialOpen(true)} className="btn-ghost text-xs !py-1.5 !px-3" title="Video tutorial">
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Tutorial</span>
          </button>
          <button onClick={() => setDemoOpen(true)} className="btn-primary text-xs !py-1.5 !px-3">
            <span className="hidden sm:inline">✨ Randomize</span><span className="sm:hidden">✨</span> Demo
          </button>
        </div>
      </header>

      {/* Main layout (sidebar always visible) */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          mode={mode}
          onChangeMode={changeMode}
          onOpenDemo={() => setDemoOpen(true)}
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAffiliateProgram={() => setAffiliateProgramOpen(true)}
          onOpenReseller={() => setResellerOpen(true)}
        />

        <div className="flex-1 flex flex-col lg:flex-row min-w-0 lg:overflow-hidden">

          {/* COLUMN 1 — Form */}
          <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-5 lg:max-w-[680px] xl:lg:max-w-[760px]">
            <div className="mb-4">
              <h1 className="text-xl font-bold">{t.name}</h1>
              <p className="text-xs text-text-mut mt-1">{t.desc}</p>
            </div>
            {mode === 'banner'              && <BannerMode              state={banner}        dispatch={dispatchBanner} />}
            {mode === 'carousel'            && <CarouselMode            state={carousel}      dispatch={dispatchCarousel} />}
            {mode === 'gridfeed'            && <GridFeedMode            state={gridfeed}      dispatch={dispatchGridfeed} />}
            {mode === 'thumbnail'           && <ThumbnailMode           state={thumbnail}     dispatch={dispatchThumbnail} />}
            {mode === 'typography'          && <TypographyMode          state={typography}    dispatch={dispatchTypography} />}
            {mode === 'copywriting'         && <CopywritingMode         state={copywriting}   dispatch={dispatchCopywriting} />}
            {mode === 'facecard'            && <FaceCardMode            state={facecard}      dispatch={dispatchFacecard} />}
            {mode === 'menufb'              && <MenuFBMode              state={menufb}        dispatch={dispatchMenufb} />}
            {mode === 'logoaffiliate'       && <LogoAffiliateMode       state={logoAff}       dispatch={dispatchLogoAff} />}
            {mode === 'tryonaffiliate'      && <TryOnAffiliateMode      state={tryonAff}      dispatch={dispatchTryonAff} />}
            {mode === 'reviewaffiliate'     && <ReviewAffiliateMode     state={reviewAff}     dispatch={dispatchReviewAff} />}
            {mode === 'storyboardaffiliate' && <StoryboardAffiliateMode state={storyboardAff} dispatch={dispatchStoryboardAff} />}

            {/* Mobile-only: mockup + prompt inline below form */}
            <div className="lg:hidden mt-4 space-y-4">
              {showMockup && <MockupPreview mode={mode} state={activeState} />}
              <div className="h-[70vh] min-h-[480px]">
                {mode === 'carousel' ? (
                  <CarouselOutput
                    slides={prompt}
                    onGenerate={handleGenerate}
                    onRestoreHistory={handleRestore}
                    onCopied={() => setCopyModalOpen(true)}
                    restoreSignal={restoreSignal}
                    autoShow={restoredMode === 'carousel'}
                  />
                ) : (
                  <PromptPanel
                    mode={mode}
                    promptText={prompt}
                    onGenerate={handleGenerate}
                    onRestoreHistory={handleRestore}
                    onCopied={() => setCopyModalOpen(true)}
                    restoreSignal={restoreSignal}
                    autoShow={restoredMode === mode}
                  />
                )}
              </div>
            </div>
          </main>

          {/* COLUMN 2 — Mockup + Prompt (DESKTOP only side panel).
              aside = overflow-y-auto + panel min-h: di layar pendek/scaling tinggi,
              mockup tidak lagi menghimpit panel sampai tombol Generate ke-clip —
              panel tetap penuh & footer (Generate) selalu terjangkau via scroll. */}
          <aside className="hidden lg:flex flex-col w-[480px] xl:w-[560px] border-l border-border bg-bg-deep/50 overflow-y-auto">
            {showMockup && (
              <div className="p-4 border-b border-border shrink-0">
                <MockupPreview mode={mode} state={activeState} />
              </div>
            )}
            <div className="flex-1 min-h-[340px] p-4 pt-3">
              {mode === 'carousel' ? (
                <CarouselOutput
                  slides={prompt}
                  onGenerate={handleGenerate}
                  onRestoreHistory={handleRestore}
                  onCopied={() => setCopyModalOpen(true)}
                  restoreSignal={restoreSignal}
                  autoShow={restoredMode === 'carousel'}
                />
              ) : (
                <PromptPanel
                  mode={mode}
                  promptText={prompt}
                  onGenerate={handleGenerate}
                  onRestoreHistory={handleRestore}
                  onCopied={() => setCopyModalOpen(true)}
                  restoreSignal={restoreSignal}
                  autoShow={restoredMode === mode}
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="hidden lg:block">
        <StatusBar mode={mode} />
      </div>

      {/* Modals — Affiliate modes pakai picker khusus dengan image grid */}
      {mode === 'carousel' ? (
        <CarouselDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} onPick={handleCarouselDemoPick} />
      ) : mode === 'menufb' ? (
        <MenuFBDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} onPick={handleMenuFBDemoPick} />
      ) : ['logoaffiliate','tryonaffiliate','reviewaffiliate','storyboardaffiliate'].includes(mode) ? (
        <AffiliateDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} mode={mode} onPick={handleAffiliateDemoPick} />
      ) : (
        <DemoCategoryModal open={demoOpen} onClose={() => setDemoOpen(false)} onPick={handleDemoPick} />
      )}
      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      <CopySuccessModal
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        kind={mode === 'carousel' ? 'carousel' : mode === 'copywriting' ? 'copy' : 'image'}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AffiliateProgramModal open={affiliateProgramOpen} onClose={() => setAffiliateProgramOpen(false)} />
      <ResellerModal open={resellerOpen} onClose={() => setResellerOpen(false)} />

      {/* Demo loading overlay */}
      {loadingDemo && <DemoLoadingOverlay item={loadingDemo} />}
    </div>
  );
}

function DemoLoadingOverlay({ item }) {
  const Icon = getDemoIcon(item.icon);
  return (
    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-md flex items-center justify-center px-6 animate-fade-in">
      <div className="surface px-8 py-8 max-w-sm w-full text-center shadow-panel">
        {/* Spinner ring around category icon */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-accent-sm" />
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent border-r-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full bg-accent-sm border border-accent/30 flex items-center justify-center">
            <Icon className="w-7 h-7 text-accent" />
          </div>
        </div>
        <div className="text-sm font-bold text-text">Menyiapkan template...</div>
        <div className="text-xs text-text-mut mt-1">{item.label}</div>

        {/* Steps animation */}
        <div className="mt-5 space-y-1.5 text-left">
          <StepLine delay={0}   label="Loading category preset"   />
          <StepLine delay={250} label="Inject ke 4 mode (Banner / YT / Ads / Copy)" />
          <StepLine delay={500} label="Compose color palette"     />
          <StepLine delay={700} label="Ready (Face Card mandiri)" final />
        </div>
      </div>
    </div>
  );
}

function StepLine({ delay, label, final }) {
  return (
    <div
      className="text-[10px] mono uppercase tracking-widest text-text-dim flex items-center gap-2 opacity-0"
      style={{ animation: `fade-in 0.3s ${delay}ms forwards` }}
    >
      <span className={final ? 'text-accent' : 'text-accent/60'}>{final ? '✓' : '›'}</span>
      <span className={final ? 'text-text' : ''}>{label}</span>
    </div>
  );
}

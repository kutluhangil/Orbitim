import { ArrowUpRight, BookOpen, CircleDot, Compass, Eye, Orbit, Telescope, X } from 'lucide-react';
import { lazy, Suspense, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ATLAS_ENTRIES,
  atlasText,
  type AtlasChapter,
  type AtlasEvidence
} from '../data/exploreAtlas';
import { useLanguage } from './i18n';

const ExoplanetCatalog = lazy(() => import('./ExoplanetCatalog').then(({ ExoplanetCatalog: Component }) => ({ default: Component })));
const NasaMediaLibrary = lazy(() => import('./NasaMediaLibrary').then(({ NasaMediaLibrary: Component }) => ({ default: Component })));
const NasaArchiveFinder = lazy(() => import('./NasaArchiveFinder').then(({ NasaArchiveFinder: Component }) => ({ default: Component })));
const DeepSkyGallery = lazy(() => import('./DeepSkyGallery').then(({ DeepSkyGallery: Component }) => ({ default: Component })));
const DeepSkyLookup = lazy(() => import('./DeepSkyLookup').then(({ DeepSkyLookup: Component }) => ({ default: Component })));
const SmallBodyExplorer = lazy(() => import('./SmallBodyExplorer').then(({ SmallBodyExplorer: Component }) => ({ default: Component })));

interface ExploreAtlasProps {
  onClose: () => void;
}

const CHAPTERS: readonly AtlasChapter[] = ['system', 'worlds', 'galaxies', 'evidence'];

const CHAPTER_COPY = {
  en: {
    all: 'All chapters',
    system: 'Our system',
    worlds: 'Other worlds',
    galaxies: 'Galaxies',
    evidence: 'How we know',
    eyebrow: 'Orbitim Explore Atlas',
    title: 'Distances are chapters.',
    body: 'A sourced field guide from the moving neighbourhood of the Sun to other worlds and deep sky. Every page declares what is observed, calculated or still being connected to a live archive.',
    close: 'Return to the live system',
    route: 'Suggested route',
    ruler: 'Scale changes here',
    source: 'Open primary source',
    select: 'Open atlas entry: {title}',
    facts: 'What this page keeps true',
    observed: 'Observed source',
    derived: 'Calculated / interpreted',
    planned: 'Live archive next',
    catalogued: 'Archive metadata',
    current: 'Atlas · live and credited sources',
    unknown: 'Unknown remains unknown.',
    routeLabels: ['Local geometry', 'Neighbouring stars', 'Deep sky']
  },
  tr: {
    all: 'Tüm bölümler',
    system: 'Sistemimiz',
    worlds: 'Başka dünyalar',
    galaxies: 'Galaksiler',
    evidence: 'Nasıl biliyoruz',
    eyebrow: 'Orbitim Keşfet Atlası',
    title: 'Uzaklıklar birer bölümdür.',
    body: 'Güneş’in hareket eden mahallesinden başka dünyalara ve derin uzaya uzanan kaynaklı bir alan rehberi. Her sayfa neyin gözlem, neyin hesaplama, neyin canlı arşive bağlanma aşamasında olduğunu açıkça söyler.',
    close: 'Canlı sisteme dön',
    route: 'Önerilen rota',
    ruler: 'Ölçek burada değişir',
    source: 'Birincil kaynağı aç',
    select: 'Atlas kaydını aç: {title}',
    facts: 'Bu sayfanın koruduğu gerçekler',
    observed: 'Gözlemlenmiş kaynak',
    derived: 'Hesaplanmış / yorumlanmış',
    planned: 'Canlı arşiv sırada',
    catalogued: 'Arşiv metadatası',
    current: 'Atlas · canlı ve kredili kaynaklar',
    unknown: 'Bilinmeyen, bilinmeyen kalır.',
    routeLabels: ['Yerel geometri', 'Komşu yıldızlar', 'Derin uzay']
  }
} as const;

const EVIDENCE_STYLE: Record<AtlasEvidence, { dot: string; chip: string }> = {
  observed: { dot: 'bg-emerald-300', chip: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' },
  derived: { dot: 'bg-sky-300', chip: 'border-sky-300/25 bg-sky-300/10 text-sky-100' },
  planned: { dot: 'bg-amber-300', chip: 'border-amber-300/25 bg-amber-300/10 text-amber-100' },
  catalogued: { dot: 'bg-teal-300', chip: 'border-teal-300/25 bg-teal-300/10 text-teal-100' }
};

const TURKISH_DISTANCES: Record<string, string> = {
  '8.3 light-min': '8,3 ışık dk.',
  Variable: 'Değişken',
  'Light-years': 'Işık yılları',
  '4.24 ly+': '4,24 ışık yılı+',
  'System-relative': 'Sisteme bağlı',
  'Thousands–billions ly': 'Binlerce–milyarlarca ışık yılı',
  'Local Universe': 'Yerel Evren',
  'Object search': 'Nesne araması',
  'Across missions': 'Görevler arasında',
  'Catalogue lookup': 'Katalog araması',
  'Every scale': 'Her ölçekte'
};

function interpolate(template: string, title: string): string {
  return template.replace('{title}', title);
}

function localizedDistance(distance: string, language: 'en' | 'tr'): string {
  return language === 'tr' ? (TURKISH_DISTANCES[distance] ?? distance) : distance;
}

function ChapterIcon({ chapter }: { chapter: AtlasChapter }) {
  if (chapter === 'system') return <Orbit className="h-4 w-4" aria-hidden />;
  if (chapter === 'worlds') return <CircleDot className="h-4 w-4" aria-hidden />;
  if (chapter === 'galaxies') return <Telescope className="h-4 w-4" aria-hidden />;
  return <Eye className="h-4 w-4" aria-hidden />;
}

/**
 * A reading layer, not a second solar-system renderer. It returns a visitor to
 * the exact simulation instant they left and never presents a static catalogue
 * as if it were a live astronomical database.
 */
export function ExploreAtlas({ onClose }: ExploreAtlasProps) {
  const language = useLanguage((state) => state.language);
  const copy = CHAPTER_COPY[language];
  const [chapter, setChapter] = useState<AtlasChapter | 'all'>('all');
  const [selectedId, setSelectedId] = useState(ATLAS_ENTRIES[0].id);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const pendingMobileGalleryReveal = useRef(false);
  const [galleryReady, setGalleryReady] = useState(false);

  const attachGalleryRef = useCallback((node: HTMLDivElement | null) => {
    galleryRef.current = node;
    setGalleryReady(node !== null);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const visibleEntries = useMemo(
    () => ATLAS_ENTRIES.filter((entry) => chapter === 'all' || entry.chapter === chapter),
    [chapter]
  );
  const selected = ATLAS_ENTRIES.find((entry) => entry.id === selectedId) ?? ATLAS_ENTRIES[0];
  const selectedText = atlasText(selected, language);
  const selectedHasGallery = selected.id === 'galaxy-kinds' || selected.id === 'nearby-galaxies';

  useEffect(() => {
    if (!pendingMobileGalleryReveal.current || !selectedHasGallery || !galleryReady || !galleryRef.current) return;
    pendingMobileGalleryReveal.current = false;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      galleryRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [galleryReady, selectedHasGallery, selectedId]);

  const selectChapter = (nextChapter: AtlasChapter | 'all') => {
    setChapter(nextChapter);
    const nextSelected = ATLAS_ENTRIES.find((entry) => nextChapter === 'all' || entry.chapter === nextChapter);
    if (nextSelected) setSelectedId(nextSelected.id);
  };

  const selectEntry = (entry: (typeof ATLAS_ENTRIES)[number]) => {
    if (entry.chapter === 'galaxies') {
      pendingMobileGalleryReveal.current = true;
      setChapter('galaxies');
    }
    setSelectedId(entry.id);
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={copy.eyebrow}
      ref={dialogRef}
      className="pointer-events-auto fixed inset-0 z-50 overflow-y-auto bg-[#030611] text-slate-100"
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 15%, rgba(125,211,252,0.12), transparent 28rem), radial-gradient(circle at 84% 12%, rgba(248,195,106,0.08), transparent 24rem), linear-gradient(115deg, transparent 0 38%, rgba(125,211,252,0.045) 38.2% 38.3%, transparent 38.5% 100%)'
        }}
      />
      <div className="pointer-events-none fixed inset-0 opacity-20 [background-image:radial-gradient(rgba(186,230,253,0.7)_0.75px,transparent_0.75px)] [background-size:20px_20px]" aria-hidden />

      <div className="relative mx-auto min-h-full max-w-7xl px-4 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-sky-100/10 pb-4">
          <span className="flex min-w-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-sky-100/80 sm:tracking-[0.34em]">
            <Compass className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{copy.eyebrow}</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.045] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-sky-300/45 hover:text-sky-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{copy.close}</span>
            <span className="sm:hidden">{language === 'tr' ? 'Dön' : 'Back'}</span>
          </button>
        </header>

        <main className="pt-10 sm:pt-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-sky-300/70">{copy.current}</p>
              <h1 id="explore-atlas-title" className="mt-4 max-w-3xl text-balance text-4xl font-extralight tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-300/70 sm:text-[17px]">{copy.body}</p>

              <section aria-labelledby="atlas-ruler" className="mt-10 border-y border-sky-100/10 py-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 id="atlas-ruler" className="font-mono text-[9px] uppercase tracking-[0.23em] text-slate-400">{copy.ruler}</h2>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-sky-200/65">{copy.unknown}</span>
                </div>
                <ol className="mt-5 grid grid-cols-3 gap-3" aria-label={copy.route}>
                  {copy.routeLabels.map((label, index) => (
                    <li key={label} className="relative pt-4">
                      {index < 2 && <span className="absolute left-3 right-0 top-0 h-px bg-gradient-to-r from-sky-200/70 to-sky-200/10" aria-hidden />}
                      <span className="absolute left-0 top-[-3px] h-1.5 w-1.5 rounded-full bg-sky-200" aria-hidden />
                      <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{index === 0 ? '0 AU' : index === 1 ? '4.24 LY' : '100K LY'}</span>
                      <span className="mt-1 block text-[12px] text-slate-200/80">{label}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <nav aria-label={copy.route} className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                <FilterButton active={chapter === 'all'} onClick={() => selectChapter('all')} label={copy.all} />
                {CHAPTERS.map((id) => (
                  <FilterButton key={id} active={chapter === id} onClick={() => selectChapter(id)} label={copy[id]} icon={<ChapterIcon chapter={id} />} />
                ))}
              </nav>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEntries.map((entry) => {
                  const text = atlasText(entry, language);
                  const active = selected.id === entry.id;
                  const style = EVIDENCE_STYLE[entry.evidence];
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => selectEntry(entry)}
                      aria-pressed={active}
                      aria-label={interpolate(copy.select, text.title)}
                      className={`group min-h-48 rounded-[1.4rem] border p-5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70 ${
                        active
                          ? 'border-sky-200/45 bg-sky-200/[0.075] shadow-[0_1rem_3rem_rgba(56,189,248,0.08)]'
                          : 'border-white/10 bg-white/[0.025] hover:border-white/25 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.15em] ${style.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
                          {copy[entry.evidence]}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{localizedDistance(entry.distance, language)}</span>
                      </span>
                      <span className="mt-7 block text-[10px] uppercase tracking-[0.2em] text-sky-200/65">{text.eyebrow}</span>
                      <span className="mt-2 block text-xl font-light tracking-tight text-white">{text.title}</span>
                      <span className="mt-2 block text-[12px] leading-5 text-slate-300/55">{text.summary}</span>
                    </button>
                  );
                })}
              </div>

              {(selected.id === 'confirmed-exoplanets' || selected.id === 'mission-eyes' || selected.id === 'archive-finder' || selectedHasGallery || selected.id === 'deep-sky-search' || selected.id === 'small-body-search') && (
                <Suspense fallback={<AtlasModuleLoading language={language} />}>
                  {selected.id === 'confirmed-exoplanets' && <ExoplanetCatalog />}
                  {selected.id === 'mission-eyes' && <NasaMediaLibrary />}
                  {selected.id === 'archive-finder' && <NasaArchiveFinder />}
                  {selectedHasGallery && <div ref={attachGalleryRef}><DeepSkyGallery /></div>}
                  {selected.id === 'deep-sky-search' && <DeepSkyLookup />}
                  {selected.id === 'small-body-search' && <SmallBodyExplorer />}
                </Suspense>
              )}
            </div>

            <aside className="h-fit rounded-[1.5rem] border border-white/12 bg-[#07101e]/85 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] ${EVIDENCE_STYLE[selected.evidence].chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${EVIDENCE_STYLE[selected.evidence].dot}`} aria-hidden />
                  {copy[selected.evidence]}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{localizedDistance(selected.distance, language)}</span>
              </div>
              <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.22em] text-sky-200/65">{selectedText.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-extralight tracking-[-0.03em] text-white">{selectedText.title}</h2>
              <p className="mt-4 text-[14px] leading-6 text-slate-300/70">{selectedText.detail}</p>

              <section className="mt-6 border-t border-white/10 pt-5" aria-labelledby="atlas-facts">
                <h3 id="atlas-facts" className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{copy.facts}</h3>
                <ul className="mt-3 space-y-2.5">
                  {selectedText.facts.map((fact) => (
                    <li key={fact} className="flex gap-2 text-[12px] leading-5 text-slate-200/75">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300/80" aria-hidden />
                      {fact}
                    </li>
                  ))}
                </ul>
              </section>

              <a
                href={selected.source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-7 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.055] px-3.5 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-300/50 hover:bg-sky-300/[0.1]"
              >
                <span className="min-w-0 truncate">{copy.source} · {selected.source.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            </aside>
          </div>

          <footer className="mt-12 flex items-center gap-3 border-t border-white/10 pt-5 text-[11px] leading-5 text-slate-400/70">
            <BookOpen className="h-4 w-4 shrink-0 text-sky-300/70" aria-hidden />
            <span>{copy.current} · {copy.unknown}</span>
          </footer>
        </main>
      </div>
    </section>
  );
}

function AtlasModuleLoading({ language }: { language: 'en' | 'tr' }) {
  return (
    <div role="status" className="mt-10 flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] px-5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
      {language === 'tr' ? 'Kaynak görünümü yükleniyor…' : 'Loading source view…'}
    </div>
  );
}

function FilterButton({ active, label, icon, onClick }: { active: boolean; label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-[10px] uppercase tracking-[0.14em] transition-colors ${
        active ? 'border-sky-200/35 bg-sky-200/12 text-sky-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25 hover:text-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

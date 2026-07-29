import { ArrowLeft, ArrowRight, ArrowUpRight, Image, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { searchNasaMedia, type NasaMediaItem, type NasaMediaPage } from '../services/nasaMedia';
import { useLanguage } from './i18n';

const DEFAULT_QUERY = 'James Webb Space Telescope';

const COPY = {
  en: {
    eyebrow: 'NASA primary media archive',
    title: 'How we saw it',
    body: 'Search NASA’s Image and Video Library without turning archive photography into a simulated surface. Every result retains its NASA ID, source centre, original record and publication metadata where supplied.',
    search: 'Search missions, instruments or targets',
    submit: 'Search archive',
    loading: 'Searching NASA Image and Video Library…',
    error: 'The NASA media archive could not be loaded.',
    noMatches: 'No image records match this query.',
    nasaId: 'NASA ID',
    sourceCenter: 'Source centre',
    created: 'Created',
    original: 'Open original NASA record',
    source: 'Search source',
    page: 'Page {page} of {pages}',
    previous: 'Previous page',
    next: 'Next page',
    omitted: '{count} malformed source items were omitted and are not represented here.',
    unknown: 'Not supplied'
  },
  tr: {
    eyebrow: 'NASA birincil medya arşivi',
    title: 'Onu nasıl gördük',
    body: 'Arşiv fotoğrafını simüle edilmiş bir yüzeye çevirmeden NASA Görsel ve Video Kütüphanesi’nde görev, araç veya hedef arayın. Her sonuç, sağlandığında NASA kimliği, kaynak merkezi, orijinal kayıt ve yayın metadatasını korur.',
    search: 'Görev, araç veya hedef ara',
    submit: 'Arşivde ara',
    loading: 'NASA Görsel ve Video Kütüphanesi aranıyor…',
    error: 'NASA medya arşivi yüklenemedi.',
    noMatches: 'Bu sorguyla eşleşen görüntü kaydı yok.',
    nasaId: 'NASA kimliği',
    sourceCenter: 'Kaynak merkezi',
    created: 'Oluşturulma',
    original: 'Orijinal NASA kaydını aç',
    source: 'Arama kaynağı',
    page: '{pages} sayfadan {page}. sayfa',
    previous: 'Önceki sayfa',
    next: 'Sonraki sayfa',
    omitted: '{count} bozuk kaynak kaydı dışarıda bırakıldı; burada temsil edilmiyor.',
    unknown: 'Sağlanmadı'
  }
} as const;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function formatDate(value: string | null, language: 'en' | 'tr'): string {
  if (value === null) return COPY[language].unknown;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`NASA Image Library returned an invalid date_created value: ${value}`);
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function NasaMediaLibrary() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<NasaMediaPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void searchNasaMedia({ q: query, page }, controller.signal)
      .then((next) => setResult(next))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draft.trim();
    if (nextQuery.length < 2) {
      setError('NASA Image Library search requires at least two characters.');
      return;
    }
    setPage(1);
    setQuery(nextQuery);
  };

  return (
    <section aria-labelledby="nasa-media-library-title" className="mt-10 border-t border-sky-100/10 pt-10">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-sky-200/80">{copy.eyebrow}</p>
        <h2 id="nasa-media-library-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
      </div>

      <form onSubmit={submit} className="mt-7 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{copy.search}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={copy.search}
            className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-300/55 focus:bg-sky-300/[0.045]"
          />
        </label>
        <button type="submit" className="h-12 shrink-0 rounded-xl border border-sky-300/25 bg-sky-300/[0.08] px-4 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-300/50 hover:bg-sky-300/[0.14]">{copy.submit}</button>
      </form>

      {loading && <div role="status" className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65"><Image className="mr-3 h-4 w-4 animate-pulse text-sky-200" aria-hidden />{copy.loading}</div>}
      {error && !loading && <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4"><p className="text-[13px] text-rose-100">{copy.error}</p><p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p></div>}

      {result && !loading && !error && (
        <>
          {result.items.length === 0 ? <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-[13px] text-slate-300/65">{copy.noMatches}</p> : <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.items.map((item) => <MediaCard key={item.nasaId} item={item} language={language} />)}</ul>}
          {result.omittedItems > 0 && <p className="mt-4 text-[11px] leading-5 text-amber-100/70">{interpolate(copy.omitted, { count: result.omittedItems })}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-sky-200/80 hover:text-sky-100">{copy.source}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
            {result.total > result.limit && <nav aria-label={interpolate(copy.page, { page: result.page, pages: totalPages })} className="flex items-center gap-3"><button type="button" disabled={result.page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label={copy.previous} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-sky-300/45 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden /></button><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{interpolate(copy.page, { page: result.page, pages: totalPages })}</span><button type="button" disabled={result.page >= totalPages} onClick={() => setPage((current) => current + 1)} aria-label={copy.next} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-sky-300/45 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowRight className="h-4 w-4" aria-hidden /></button></nav>}
          </div>
        </>
      )}
    </section>
  );
}

function MediaCard({ item, language }: { item: NasaMediaItem; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  return (
    <li className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition-colors hover:border-sky-200/25 hover:bg-sky-200/[0.035]">
      <a href={item.assetUrl} target="_blank" rel="noreferrer" className="block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
        <img src={item.thumbnailUrl} alt={item.title} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.02]" />
      </a>
      <div className="p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-sky-200/70">{copy.nasaId} · {item.nasaId}</p>
        <h3 className="mt-2 text-lg font-light leading-snug text-white">{item.title}</h3>
        {item.description && <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-400">{item.description}</p>}
        <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3 text-[10px]">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-slate-500">{copy.sourceCenter}</dt><dd className="text-right text-slate-300/75">{item.center ?? copy.unknown}</dd></div>
          <div className="flex items-baseline justify-between gap-3"><dt className="text-slate-500">{copy.created}</dt><dd className="text-right font-mono tabular-nums text-slate-300/75">{formatDate(item.dateCreated, language)}</dd></div>
        </dl>
        <a href={item.assetUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-sky-200/80 hover:text-sky-100">{copy.original}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
      </div>
    </li>
  );
}

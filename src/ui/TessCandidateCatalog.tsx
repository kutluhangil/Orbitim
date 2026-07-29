import { ArrowLeft, ArrowRight, ArrowUpRight, Database, Search, Telescope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchTessCandidates, type TessCandidatePage, type TessCandidateRecord } from '../services/tessCandidates';
import { useLanguage } from './i18n';

const PAGE_SIZE = 48;

const COPY = {
  en: {
    eyebrow: 'Live candidate catalogue',
    title: 'TESS planet candidates',
    body: 'This separate list contains only NASA Exoplanet Archive TOIs with the current TFOPWG PC disposition. A PC is not a confirmed planet, and these records are never drawn into the Solar System scene.',
    search: 'Search TOI or TIC identifier',
    loading: 'Requesting TESS candidate records…',
    error: 'The TESS candidate catalogue could not be loaded.',
    noMatches: 'No TESS planet-candidate records match this search.',
    records: '{count} PC records',
    candidate: 'Planet candidate · not confirmed',
    toi: 'TOI',
    tic: 'TIC',
    period: 'Period',
    duration: 'Transit duration',
    depth: 'Transit depth',
    radius: 'Radius',
    insolation: 'Insolation',
    temperature: 'Equilibrium temperature',
    distance: 'Distance',
    unknown: 'Not reported',
    days: 'days',
    hours: 'hours',
    ppm: 'ppm',
    earthRadii: 'Earth radii',
    earthInsolation: 'Earth flux',
    kelvin: 'K',
    parsecs: 'pc',
    source: 'Source snapshot',
    fetched: 'Fetched {time} UTC',
    archive: 'Open NASA TAP documentation',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page {page} of {pages}'
  },
  tr: {
    eyebrow: 'Canlı aday kataloğu',
    title: 'TESS gezegen adayları',
    body: 'Bu ayrı liste yalnızca NASA Exoplanet Archive’daki güncel TFOPWG PC konumuna sahip TOI kayıtlarını içerir. PC, doğrulanmış gezegen değildir; bu kayıtlar Güneş Sistemi sahnesine asla çizilmez.',
    search: 'TOI veya TIC kimliği ara',
    loading: 'TESS aday kayıtları isteniyor…',
    error: 'TESS aday kataloğu yüklenemedi.',
    noMatches: 'Bu aramayla eşleşen TESS gezegen-adayı kaydı yok.',
    records: '{count} PC kaydı',
    candidate: 'Gezegen adayı · doğrulanmadı',
    toi: 'TOI',
    tic: 'TIC',
    period: 'Dönem',
    duration: 'Geçiş süresi',
    depth: 'Geçiş derinliği',
    radius: 'Yarıçap',
    insolation: 'Işınım',
    temperature: 'Denge sıcaklığı',
    distance: 'Uzaklık',
    unknown: 'Bildirilmiyor',
    days: 'gün',
    hours: 'saat',
    ppm: 'ppm',
    earthRadii: 'Dünya yarıçapı',
    earthInsolation: 'Dünya akısı',
    kelvin: 'K',
    parsecs: 'pc',
    source: 'Kaynak anlık görüntüsü',
    fetched: '{time} UTC alındı',
    archive: 'NASA TAP dokümantasyonunu aç',
    previous: 'Önceki sayfa',
    next: 'Sonraki sayfa',
    page: '{pages} sayfadan {page}. sayfa'
  }
} as const;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function measurement(value: number | null, unit: string, language: 'en' | 'tr'): string {
  if (value === null) return COPY[language].unknown;
  return `${value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })} ${unit}`;
}

function fetchedAt(value: string, language: 'en' | 'tr'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`NASA Exoplanet Archive TESS candidate returned an invalid fetchedAt timestamp: ${value}`);
  const formatted = new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
  }).format(date);
  return interpolate(COPY[language].fetched, { time: formatted });
}

export function TessCandidateCatalog() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<TessCandidatePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void fetchTessCandidates({ q: search, page, limit: PAGE_SIZE }, controller.signal)
      .then((next) => setResult(next))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <section aria-labelledby="tess-candidate-catalog-title" className="mt-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-violet-200/80">{copy.eyebrow}</p>
          <h2 id="tess-candidate-catalog-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
          <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
        </div>
        {result && <div className="rounded-full border border-violet-300/20 bg-violet-300/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-100/85">{interpolate(copy.records, { count: result.total.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US') })}</div>}
      </div>

      <label className="relative mt-7 block">
        <span className="sr-only">{copy.search}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder={copy.search}
          aria-label={copy.search}
          className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-violet-300/55 focus:bg-violet-300/[0.045]"
        />
      </label>

      {loading && <div role="status" className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65"><Telescope className="mr-3 h-4 w-4 animate-pulse text-violet-200" aria-hidden />{copy.loading}</div>}
      {error && !loading && <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4"><p className="text-[13px] text-rose-100">{copy.error}</p><p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p></div>}

      {result && !loading && !error && (
        <>
          {result.records.length === 0 ? <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-[13px] text-slate-300/65">{copy.noMatches}</p> : <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={copy.records.replace('{count}', String(result.total))}>{result.records.map((record) => <CandidateCard key={record.toi} record={record} language={language} />)}</ul>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="flex items-center gap-2 text-[10px] text-slate-400/75"><Database className="h-3.5 w-3.5 shrink-0 text-violet-200/70" aria-hidden /><span>{copy.source}: {result.source} · {fetchedAt(result.fetchedAt, language)}</span></p>
            <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-violet-200/80 hover:text-violet-100">{copy.archive}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
          </div>
          {result.total > result.limit && <nav aria-label={copy.page.replace('{page}', String(result.page + 1)).replace('{pages}', String(totalPages))} className="mt-4 flex items-center justify-center gap-3"><button type="button" disabled={result.page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label={copy.previous} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden /></button><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{interpolate(copy.page, { page: result.page + 1, pages: totalPages })}</span><button type="button" disabled={result.page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)} aria-label={copy.next} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowRight className="h-4 w-4" aria-hidden /></button></nav>}
        </>
      )}
    </section>
  );
}

function CandidateCard({ record, language }: { record: TessCandidateRecord; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const rows = [
    [copy.toi, record.toi],
    [copy.tic, record.ticId === null ? copy.unknown : String(record.ticId)],
    [copy.period, measurement(record.periodDays, copy.days, language)],
    [copy.duration, measurement(record.durationHours, copy.hours, language)],
    [copy.depth, measurement(record.transitDepthPpm, copy.ppm, language)],
    [copy.radius, measurement(record.radiusEarth, copy.earthRadii, language)],
    [copy.insolation, measurement(record.insolationEarth, copy.earthInsolation, language)],
    [copy.temperature, measurement(record.equilibriumTemperatureK, copy.kelvin, language)],
    [copy.distance, measurement(record.distanceParsecs, copy.parsecs, language)]
  ];
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-violet-200/25 hover:bg-violet-200/[0.035]">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-violet-200/75">{copy.candidate}</p>
      <h3 className="mt-2 text-xl font-light tracking-tight text-white">TOI {record.toi}</h3>
      <p className="mt-1 text-[10px] text-slate-500">TFOPWG · {record.disposition}</p>
      <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
        {rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 text-[11px]"><dt className="shrink-0 text-slate-500">{label}</dt><dd className="text-right font-mono tabular-nums text-slate-200/80">{value}</dd></div>)}
      </dl>
    </li>
  );
}

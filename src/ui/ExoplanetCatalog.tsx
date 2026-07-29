import { ArrowLeft, ArrowRight, ArrowUpRight, Database, Search, Telescope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchExoplanets, type ExoplanetMethod, type ExoplanetPage, type ExoplanetRecord } from '../services/exoplanets';
import { useLanguage } from './i18n';

const COPY = {
  en: {
    eyebrow: 'Live archive connection',
    title: 'Confirmed exoplanets',
    body: 'Search the current NASA Exoplanet Archive composite-parameter catalogue. A missing measurement is kept blank instead of estimated for the atlas.',
    search: 'Search planet or host star',
    all: 'All methods',
    astrometry: 'Astrometry',
    'disk-kinematics': 'Disk kinematics',
    'eclipse-timing-variations': 'Eclipse timing variations',
    transit: 'Transit',
    'transit-timing-variations': 'Transit timing variations',
    'radial-velocity': 'Radial velocity',
    imaging: 'Imaging',
    microlensing: 'Microlensing',
    'orbital-brightness-modulation': 'Orbital brightness modulation',
    'pulsar-timing': 'Pulsar timing',
    'pulsation-timing-variations': 'Pulsation timing variations',
    loading: 'Requesting the NASA Exoplanet Archive…',
    error: 'The live catalogue could not be loaded.',
    noMatches: 'No confirmed archive records match these filters.',
    records: '{count} confirmed records',
    source: 'Source snapshot',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page {page} of {pages}',
    host: 'Host star',
    radius: 'Radius',
    mass: 'Mass',
    orbit: 'Orbit',
    distance: 'Distance',
    temperature: 'Equilibrium temperature',
    discovered: 'Discovery',
    method: 'Method',
    facility: 'Facility',
    unknown: 'Not reported',
    earthRadii: 'Earth radii',
    earthMasses: 'Earth masses',
    days: 'days',
    parsecs: 'pc',
    kelvin: 'K',
    fetched: 'Fetched {time} UTC',
    archive: 'Open NASA archive documentation'
  },
  tr: {
    eyebrow: 'Canlı arşiv bağlantısı',
    title: 'Doğrulanmış ötegezegenler',
    body: 'Güncel NASA Exoplanet Archive bileşik parametre kataloğunda arayın. Atlas, eksik bir ölçümü tahmin etmek yerine boş bırakır.',
    search: 'Gezegen veya ev sahibi yıldız ara',
    all: 'Tüm yöntemler',
    astrometry: 'Astrometri',
    'disk-kinematics': 'Disk kinematiği',
    'eclipse-timing-variations': 'Tutulma zamanlama değişimleri',
    transit: 'Geçiş',
    'transit-timing-variations': 'Geçiş zamanlama değişimleri',
    'radial-velocity': 'Radyal hız',
    imaging: 'Doğrudan görüntüleme',
    microlensing: 'Mikromercekleme',
    'orbital-brightness-modulation': 'Yörüngesel parlaklık modülasyonu',
    'pulsar-timing': 'Pulsar zamanlaması',
    'pulsation-timing-variations': 'Atım zamanlama değişimleri',
    loading: 'NASA Exoplanet Archive isteniyor…',
    error: 'Canlı katalog yüklenemedi.',
    noMatches: 'Bu filtrelerle eşleşen doğrulanmış arşiv kaydı yok.',
    records: '{count} doğrulanmış kayıt',
    source: 'Kaynak anlık görüntüsü',
    previous: 'Önceki sayfa',
    next: 'Sonraki sayfa',
    page: '{pages} sayfadan {page}. sayfa',
    host: 'Ev sahibi yıldız',
    radius: 'Yarıçap',
    mass: 'Kütle',
    orbit: 'Yörünge',
    distance: 'Uzaklık',
    temperature: 'Denge sıcaklığı',
    discovered: 'Keşif',
    method: 'Yöntem',
    facility: 'Tesis',
    unknown: 'Bildirilmiyor',
    earthRadii: 'Dünya yarıçapı',
    earthMasses: 'Dünya kütlesi',
    days: 'gün',
    parsecs: 'pc',
    kelvin: 'K',
    fetched: '{time} UTC alındı',
    archive: 'NASA arşiv belgelerini aç'
  }
} as const;

const METHODS: readonly ExoplanetMethod[] = [
  'all',
  'transit',
  'radial-velocity',
  'imaging',
  'microlensing',
  'astrometry',
  'disk-kinematics',
  'eclipse-timing-variations',
  'orbital-brightness-modulation',
  'pulsar-timing',
  'pulsation-timing-variations',
  'transit-timing-variations'
];
const PAGE_SIZE = 48;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function formatMeasurement(value: number | null, unit: string, language: 'en' | 'tr'): string {
  if (value === null) return COPY[language].unknown;
  return `${value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })} ${unit}`;
}

function formatFetchedAt(value: string, language: 'en' | 'tr'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`NASA Exoplanet Archive returned an invalid fetchedAt timestamp: ${value}`);
  const formatted = new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
  }).format(date);
  return interpolate(COPY[language].fetched, { time: formatted });
}

export function ExoplanetCatalog() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<ExoplanetMethod>('all');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ExoplanetPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);

    void fetchExoplanets({ q: search, method, page, limit: PAGE_SIZE }, controller.signal)
      .then((next) => setResult(next))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [method, page, search]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <section aria-labelledby="exoplanet-catalog-title" className="mt-10 border-t border-sky-100/10 pt-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/80">{copy.eyebrow}</p>
          <h2 id="exoplanet-catalog-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
          <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
        </div>
        {result && (
          <div className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-100/85">
            {interpolate(copy.records, { count: result.total.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US') })}
          </div>
        )}
      </div>

      <div className="mt-7 flex flex-col gap-3">
        <label className="relative block">
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
            className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-300/55 focus:bg-sky-300/[0.045]"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label={copy.method}>
          {METHODS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={method === id}
              onClick={() => {
                setMethod(id);
                setPage(0);
              }}
              className={`h-9 shrink-0 rounded-full border px-3 text-[9px] uppercase tracking-[0.14em] transition-colors ${
                method === id ? 'border-amber-300/35 bg-amber-300/[0.12] text-amber-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25 hover:text-slate-100'
              }`}
            >
              {copy[id]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div role="status" className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65">
          <Telescope className="mr-3 h-4 w-4 animate-pulse text-sky-200" aria-hidden />
          {copy.loading}
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4">
          <p className="text-[13px] text-rose-100">{copy.error}</p>
          <p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p>
        </div>
      )}

      {result && !loading && !error && (
        <>
          {result.records.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-[13px] text-slate-300/65">{copy.noMatches}</p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={copy.records.replace('{count}', String(result.total))}>
              {result.records.map((record) => <ExoplanetCard key={record.name} record={record} language={language} />)}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="flex items-center gap-2 text-[10px] text-slate-400/75">
              <Database className="h-3.5 w-3.5 shrink-0 text-sky-200/70" aria-hidden />
              <span>{copy.source}: {result.source} · {formatFetchedAt(result.fetchedAt, language)}</span>
            </p>
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-sky-200/80 hover:text-sky-100"
            >
              {copy.archive}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>

          {result.total > result.limit && (
            <nav aria-label={copy.page.replace('{page}', String(result.page + 1)).replace('{pages}', String(totalPages))} className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={result.page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                aria-label={copy.previous}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-sky-300/45 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{interpolate(copy.page, { page: result.page + 1, pages: totalPages })}</span>
              <button
                type="button"
                disabled={result.page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                aria-label={copy.next}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-sky-300/45 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function ExoplanetCard({ record, language }: { record: ExoplanetRecord; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const rows = [
    [copy.host, record.hostName],
    [copy.radius, formatMeasurement(record.radiusEarth, copy.earthRadii, language)],
    [copy.mass, formatMeasurement(record.massEarth, copy.earthMasses, language)],
    [copy.orbit, formatMeasurement(record.orbitDays, copy.days, language)],
    [copy.distance, formatMeasurement(record.distanceParsecs, copy.parsecs, language)],
    [copy.temperature, formatMeasurement(record.equilibriumTemperatureK, copy.kelvin, language)]
  ];
  const discovery = [record.discoveryMethod, record.discoveryYear, record.facility].filter((value): value is string | number => value !== null).join(' · ') || copy.unknown;

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-sky-200/25 hover:bg-sky-200/[0.035]">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200/75">{copy.discovered}</p>
      <h3 className="mt-2 text-xl font-light tracking-tight text-white">{record.name}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">{discovery}</p>
      <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-[11px]">
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className="text-right font-mono tabular-nums text-slate-200/80">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

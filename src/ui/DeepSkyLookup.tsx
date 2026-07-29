import { ArrowUpRight, Crosshair, Search, Telescope } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lookupDeepSkyObject, type DeepSkyLookup } from '../services/deepSky';
import { useLanguage } from './i18n';

const COPY = {
  en: {
    eyebrow: 'Live NED object resolver',
    title: 'Find a named deep-sky object',
    body: 'Resolve one known extragalactic object name at a time through the current NASA/IPAC NED API. This is a source lookup, not a generated star map or an all-sky download.',
    search: 'Object name, e.g. M31 or NGC 1300',
    submit: 'Resolve object',
    resolving: 'Resolving with NASA/IPAC NED…',
    examples: 'Try a known object',
    notFound: 'NED did not resolve this as a known extragalactic object.',
    ambiguous: 'NED found more than one possible name. Choose one to resolve it exactly.',
    error: 'The NED lookup could not be loaded.',
    name: 'NED preferred name',
    type: 'NED object type code',
    coordinates: 'J2000 coordinates',
    redshift: 'Redshift',
    reference: 'Redshift reference',
    unknown: 'Not reported',
    source: 'Open NED object record',
    docs: 'Open NED API documentation',
    fetched: 'Response fetched {time} UTC'
  },
  tr: {
    eyebrow: 'Canlı NED nesne çözücüsü',
    title: 'Adlandırılmış bir derin uzay nesnesi bulun',
    body: 'Güncel NASA/IPAC NED API üzerinden her seferinde bilinen tek bir galaksi dışı nesne adını çözümleyin. Bu, üretilmiş bir yıldız haritası veya tüm gökyüzü indirmesi değildir.',
    search: 'Nesne adı; ör. M31 veya NGC 1300',
    submit: 'Nesneyi çözümle',
    resolving: 'NASA/IPAC NED ile çözümleniyor…',
    examples: 'Bilinen bir nesne deneyin',
    notFound: 'NED bunu bilinen bir galaksi dışı nesne olarak çözümlemedi.',
    ambiguous: 'NED birden fazla olası ad buldu. Tam olarak çözümlemek için birini seçin.',
    error: 'NED sorgusu yüklenemedi.',
    name: 'NED tercih edilen ad',
    type: 'NED nesne türü kodu',
    coordinates: 'J2000 koordinatları',
    redshift: 'Kırmızıya kayma',
    reference: 'Kırmızıya kayma referansı',
    unknown: 'Bildirilmiyor',
    source: 'NED nesne kaydını aç',
    docs: 'NED API belgelerini aç',
    fetched: 'Yanıt {time} UTC alındı'
  }
} as const;

const EXAMPLES = ['M31', 'NGC 1300', 'M87', 'Arp 220'] as const;

function interpolate(template: string, value: string): string {
  return template.replace('{time}', value);
}

function formatNumber(value: number | null, language: 'en' | 'tr', maximumFractionDigits = 6): string {
  if (value === null) return COPY[language].unknown;
  return value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits });
}

function formatCoordinates(result: DeepSkyLookup, language: 'en' | 'tr'): string {
  if (!result.record || result.record.rightAscensionDeg === null || result.record.declinationDeg === null) return COPY[language].unknown;
  return `RA ${formatNumber(result.record.rightAscensionDeg, language, 6)}° · Dec ${formatNumber(result.record.declinationDeg, language, 6)}°`;
}

function formatFetchedAt(value: string, language: 'en' | 'tr'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`NASA/IPAC NED returned an invalid fetchedAt timestamp: ${value}`);
  return interpolate(COPY[language].fetched, new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date));
}

export function DeepSkyLookup() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [query, setQuery] = useState('M31');
  const [result, setResult] = useState<DeepSkyLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const resolve = async (nextQuery: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const nextResult = await lookupDeepSkyObject(nextQuery, controller.signal);
      if (activeRequest.current === controller) setResult(nextResult);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (activeRequest.current === controller) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (activeRequest.current === controller) setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void resolve(query);
  };

  return (
    <section aria-labelledby="deep-sky-lookup-title" className="mt-10 border-t border-sky-100/10 pt-10">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/80">{copy.eyebrow}</p>
        <h2 id="deep-sky-lookup-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{copy.search}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={copy.search} placeholder={copy.search} required maxLength={80} className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-300/55 focus:bg-sky-300/[0.045]" />
        </label>
        <button type="submit" disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200/30 bg-sky-200/[0.09] px-5 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-100/60 hover:bg-sky-200/[0.15] disabled:cursor-not-allowed disabled:opacity-55">
          <Crosshair className="h-3.5 w-3.5" aria-hidden />
          {copy.submit}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={copy.examples}>
        <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{copy.examples}</span>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" onClick={() => { setQuery(example); void resolve(example); }} className="min-h-9 rounded-full border border-white/10 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-sky-200/40 hover:text-sky-100">{example}</button>
        ))}
      </div>

      {loading && <div role="status" className="mt-6 flex min-h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65"><Telescope className="mr-3 h-4 w-4 animate-pulse text-sky-200" aria-hidden />{copy.resolving}</div>}

      {error && !loading && <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4"><p className="text-[13px] text-rose-100">{copy.error}</p><p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p></div>}

      {result && !loading && !error && (
        <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.025] p-5 sm:p-6">
          {result.kind === 'not-found' && <p className="text-[13px] leading-6 text-slate-300/70">{copy.notFound}</p>}
          {result.kind === 'ambiguous' && (
            <>
              <p className="text-[13px] leading-6 text-slate-300/70">{copy.ambiguous}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.aliases.map((alias) => <button key={alias} type="button" onClick={() => { setQuery(alias); void resolve(alias); }} className="min-h-10 rounded-full border border-amber-200/25 px-3 text-[10px] uppercase tracking-[0.12em] text-amber-100 transition-colors hover:border-amber-100/55">{alias}</button>)}
              </div>
            </>
          )}
          {result.kind === 'resolved' && result.record && (
            <>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200/80">{copy.name}</p>
              <h3 className="mt-2 text-2xl font-light tracking-tight text-white">{result.record.name}</h3>
              <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
                <LookupFact label={copy.type} value={result.record.objectTypeCode ?? copy.unknown} />
                <LookupFact label={copy.coordinates} value={formatCoordinates(result, language)} />
                <LookupFact label={copy.redshift} value={formatNumber(result.record.redshift, language, 8)} />
                <LookupFact label={copy.reference} value={result.record.redshiftReference ?? copy.unknown} />
              </dl>
              <a href={result.record.detailUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200/25 px-4 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-100/60 hover:bg-sky-200/[0.08]">
                {copy.source}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] text-slate-500">
            <span>{formatFetchedAt(result.fetchedAt, language)}</span>
            <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 uppercase tracking-[0.12em] text-sky-200/75 hover:text-sky-100">{copy.docs}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
          </div>
        </div>
      )}
    </section>
  );
}

function LookupFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-mono text-slate-200/85">{value}</dd></div>;
}

import { AlertTriangle, ArrowUpRight, Crosshair, Orbit, Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lookupSmallBody, type SmallBodyLookup, type SmallBodyRecord } from '../services/smallBody';
import { useLanguage } from './i18n';

const COPY = {
  en: {
    eyebrow: 'Live JPL Small-Body Database', title: 'Read a small body before drawing it.',
    body: 'Resolve one asteroid or comet through JPL SBDB. The result reports the published orbit solution and physical fields without pretending that every object belongs in the WebGL scene.',
    search: 'Asteroid or comet; e.g. Apophis or 1P/Halley', submit: 'Resolve body', resolving: 'Reading JPL SBDB…', examples: 'Try a known object',
    notFound: 'JPL SBDB did not resolve this as a known small body.', ambiguous: 'More than one designation matched. Choose one to resolve the published object record.',
    error: 'The JPL small-body lookup could not be loaded.', source: 'Open SBDB record', docs: 'Open SBDB documentation', fetched: 'Response fetched {time} UTC',
    orbit: 'Orbit solution', physical: 'Physical fields', encounters: 'Earth approach records', noEncounters: 'No Earth approach records were included in this response.',
    unknown: 'Not reported', diameter: 'Diameter', magnitude: 'Absolute magnitude H', albedo: 'Albedo', rotation: 'Rotation period',
    class: 'Orbit class', moid: 'Earth MOID', eccentricity: 'Eccentricity', inclination: 'Inclination', lastObserved: 'Last observation',
    neo: 'Near-Earth object', pha: 'Potentially hazardous', noPha: 'Not marked PHA', recordBoundary: 'Approach records are nominal orbit calculations supplied by SBDB; they are not a local visibility forecast or an impact prediction.'
  },
  tr: {
    eyebrow: 'Canlı JPL Küçük Cisim Veritabanı', title: 'Çizmeden önce küçük cismi okuyun.',
    body: 'JPL SBDB üzerinden tek bir asteroit veya kuyrukluyıldızı çözümleyin. Sonuç, yayımlanmış yörünge çözümünü ve fiziksel alanları, her cismin WebGL sahnesinde yer alması gerekiyormuş gibi davranmadan verir.',
    search: 'Asteroit veya kuyrukluyıldız; ör. Apophis veya 1P/Halley', submit: 'Cismi çözümle', resolving: 'JPL SBDB okunuyor…', examples: 'Bilinen bir cisim deneyin',
    notFound: 'JPL SBDB bunu bilinen bir küçük cisim olarak çözümlemedi.', ambiguous: 'Birden fazla atama eşleşti. Yayımlanmış nesne kaydını çözmek için birini seçin.',
    error: 'JPL küçük cisim sorgusu yüklenemedi.', source: 'SBDB kaydını aç', docs: 'SBDB belgelerini aç', fetched: 'Yanıt {time} UTC alındı',
    orbit: 'Yörünge çözümü', physical: 'Fiziksel alanlar', encounters: 'Dünya yaklaşım kayıtları', noEncounters: 'Bu yanıta Dünya yaklaşım kaydı eklenmemiş.',
    unknown: 'Bildirilmiyor', diameter: 'Çap', magnitude: 'Mutlak kadir H', albedo: 'Albedo', rotation: 'Dönüş süresi',
    class: 'Yörünge sınıfı', moid: 'Dünya MOID', eccentricity: 'Dışmerkezlik', inclination: 'Eğiklik', lastObserved: 'Son gözlem',
    neo: 'Dünya’ya yakın cisim', pha: 'Potansiyel tehlikeli', noPha: 'PHA olarak işaretli değil', recordBoundary: 'Yaklaşım kayıtları SBDB’nin sağladığı nominal yörünge hesaplarıdır; yerel görünürlük tahmini veya çarpışma öngörüsü değildir.'
  }
} as const;

const EXAMPLES = ['Apophis', '433 Eros', 'Bennu', '1P/Halley'] as const;

function interpolate(template: string, value: string): string { return template.replace('{time}', value); }
function formatNumber(value: number | null, language: 'en' | 'tr', suffix = '', digits = 3): string {
  if (value === null) return COPY[language].unknown;
  return `${value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: digits })}${suffix}`;
}
function formatFetchedAt(value: string, language: 'en' | 'tr'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`JPL SBDB response has an invalid fetchedAt timestamp: ${value}`);
  return interpolate(COPY[language].fetched, new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date));
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-mono text-slate-200/85">{value}</dd></div>;
}

function ResolvedBody({ record, language }: { record: SmallBodyRecord; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200/80">{record.designation}</p>
          <h3 className="mt-2 text-2xl font-light tracking-tight text-white">{record.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {record.neo === true && <span className="rounded-full border border-amber-200/25 bg-amber-200/[0.08] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-amber-100">{copy.neo}</span>}
            <span className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] ${record.pha ? 'border-rose-200/30 bg-rose-200/[0.08] text-rose-100' : 'border-white/10 text-white/55'}`}>{record.pha ? copy.pha : copy.noPha}</span>
          </div>
        </div>
        <a href={record.detailUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200/25 px-4 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-100/60 hover:bg-sky-200/[0.08]">{copy.source}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
      </div>

      <section className="mt-5 border-t border-white/10 pt-4">
        <h4 className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">{copy.physical}</h4>
        <dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
          <Fact label={copy.diameter} value={formatNumber(record.diameterKm, language, ' km')} />
          <Fact label={copy.magnitude} value={formatNumber(record.absoluteMagnitude, language)} />
          <Fact label={copy.albedo} value={formatNumber(record.albedo, language)} />
          <Fact label={copy.rotation} value={formatNumber(record.rotationHours, language, ' h')} />
        </dl>
      </section>

      <section className="mt-5 border-t border-white/10 pt-4">
        <h4 className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">{copy.orbit}</h4>
        <dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
          <Fact label={copy.class} value={record.orbitClass ?? copy.unknown} />
          <Fact label={copy.moid} value={formatNumber(record.earthMoidAu, language, ' AU', 6)} />
          <Fact label={copy.eccentricity} value={formatNumber(record.eccentricity, language, '', 6)} />
          <Fact label={copy.inclination} value={formatNumber(record.inclinationDeg, language, '°', 4)} />
          <Fact label={copy.lastObserved} value={record.lastObserved ?? copy.unknown} />
          <Fact label="q" value={formatNumber(record.perihelionAu, language, ' AU', 6)} />
          <Fact label="Q" value={formatNumber(record.aphelionAu, language, ' AU', 6)} />
          <Fact label="a" value={formatNumber(record.semiMajorAu, language, ' AU', 6)} />
        </dl>
      </section>

      <section className="mt-5 border-t border-white/10 pt-4">
        <h4 className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">{copy.encounters}</h4>
        {record.earthApproaches.length === 0 ? <p className="mt-3 text-[12px] text-slate-300/60">{copy.noEncounters}</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {record.earthApproaches.map((approach) => <li key={`${approach.at}-${approach.distanceAu ?? 'unknown'}`} className="rounded-xl border border-white/8 bg-black/20 p-3 text-[10px]"><p className="font-mono text-sky-100/80">{approach.at} TDB</p><p className="mt-1 text-white/65">{formatNumber(approach.distanceAu, language, ' AU', 6)} · {formatNumber(approach.velocityKmS, language, ' km/s', 3)}</p>{approach.uncertainty && <p className="mt-1 text-white/35">± {approach.uncertainty}</p>}</li>)}
          </ul>
        )}
        <p className="mt-3 flex gap-2 text-[10px] leading-relaxed text-amber-50/65"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200/70" aria-hidden />{copy.recordBoundary}</p>
      </section>
    </>
  );
}

export function SmallBodyExplorer() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [query, setQuery] = useState('Apophis');
  const [result, setResult] = useState<SmallBodyLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);
  const resolve = async (nextQuery: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true); setError(null); setResult(null);
    try {
      const nextResult = await lookupSmallBody(nextQuery, controller.signal);
      if (activeRequest.current === controller) setResult(nextResult);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (activeRequest.current === controller) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (activeRequest.current === controller) setLoading(false);
    }
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void resolve(query); };

  return (
    <section aria-labelledby="small-body-title" className="mt-10 border-t border-sky-100/10 pt-10">
      <div className="max-w-2xl"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/80">{copy.eyebrow}</p><h2 id="small-body-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2><p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p></div>
      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row"><label className="relative block min-w-0 flex-1"><span className="sr-only">{copy.search}</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={copy.search} placeholder={copy.search} required maxLength={80} className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-300/55 focus:bg-sky-300/[0.045]" /></label><button type="submit" disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200/30 bg-sky-200/[0.09] px-5 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-100/60 hover:bg-sky-200/[0.15] disabled:cursor-not-allowed disabled:opacity-55"><Crosshair className="h-3.5 w-3.5" aria-hidden />{copy.submit}</button></form>
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={copy.examples}><span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{copy.examples}</span>{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => { setQuery(example); void resolve(example); }} className="min-h-9 rounded-full border border-white/10 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-sky-200/40 hover:text-sky-100">{example}</button>)}</div>
      {loading && <div role="status" className="mt-6 flex min-h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65"><Orbit className="mr-3 h-4 w-4 animate-pulse text-sky-200" aria-hidden />{copy.resolving}</div>}
      {error && !loading && <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4"><p className="text-[13px] text-rose-100">{copy.error}</p><p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p></div>}
      {result && !loading && !error && <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.025] p-5 sm:p-6">{result.kind === 'not-found' && <p className="text-[13px] leading-6 text-slate-300/70">{copy.notFound}</p>}{result.kind === 'ambiguous' && <><p className="text-[13px] leading-6 text-slate-300/70">{copy.ambiguous}</p><div className="mt-4 flex flex-wrap gap-2">{result.matches.map((match) => <button key={match.designation} type="button" onClick={() => { setQuery(match.designation); void resolve(match.designation); }} className="min-h-10 rounded-full border border-amber-200/25 px-3 text-[10px] uppercase tracking-[0.12em] text-amber-100 transition-colors hover:border-amber-100/55">{match.name}</button>)}</div></>}{result.kind === 'resolved' && result.record && <ResolvedBody record={result.record} language={language} />}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] text-slate-500"><span>{formatFetchedAt(result.fetchedAt, language)}</span><a href={result.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 uppercase tracking-[0.12em] text-sky-200/75 hover:text-sky-100">{copy.docs}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a></div></div>}
    </section>
  );
}

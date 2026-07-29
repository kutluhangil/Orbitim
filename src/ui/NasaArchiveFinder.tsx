import { ArrowLeft, ArrowRight, ArrowUpRight, Database, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { searchEarthdataCollections, type EarthdataCollection, type EarthdataCollectionPage } from '../services/earthdataCollections';
import { lookupPdsTarget, type PdsTargetRecord, type PdsTargetSnapshot } from '../services/pdsTargets';
import { useLanguage } from './i18n';

const COPY = {
  en: {
    eyebrow: 'NASA archive metadata',
    title: 'Find NASA datasets',
    body: 'Search two primary NASA archive catalogues without confusing a collection record with imagery, a rendered surface or a local observation. Results stay as metadata and open their original records.',
    earthdataTab: 'Earthdata collections',
    pdsTab: 'PDS target context',
    earthdataLabel: 'Search Earthdata collection metadata',
    earthdataPlaceholder: 'e.g. ice, aerosol or ocean colour',
    pdsLabel: 'Look up a Solar System target context',
    pdsPlaceholder: 'e.g. Europa, Mars or Moon',
    search: 'Search archive',
    lookup: 'Look up target',
    earthdataLoading: 'Searching NASA Earthdata CMR…',
    pdsLoading: 'Looking up the NASA PDS target context…',
    earthdataError: 'NASA Earthdata CMR could not be loaded.',
    pdsError: 'NASA PDS target context could not be loaded.',
    earthdataScope: 'Collection metadata only. A keyword match is not a physical-target resolver, image, map or pixel-level observation.',
    earthdataAccess: 'Individual records set their own access rules; a protected product may require Earthdata Login.',
    pdsScope: 'Target-context metadata only. PDS searchable coverage is partial; this is not a claim that every mission product is indexed here.',
    records: '{count} matching collections',
    pdsRecords: '{count} target-context records',
    noCollections: 'No collection metadata matches this query.',
    noTargets: 'No PDS target-context metadata matches this target.',
    shortName: 'Short name',
    archiveCenter: 'Archive centre',
    time: 'Temporal coverage',
    browse: 'Browse imagery',
    online: 'Online access',
    yes: 'Available',
    no: 'Not listed',
    metadata: 'Open CMR metadata',
    pdsLabelRecord: 'Open PDS label',
    productType: 'Product type',
    version: 'Version',
    updated: 'Updated',
    source: 'Open source documentation',
    fetched: 'Fetched {time} UTC',
    page: 'Page {page} of {pages}',
    previous: 'Previous page',
    next: 'Next page',
    unknown: 'Not supplied'
  },
  tr: {
    eyebrow: 'NASA arşiv metadatası',
    title: 'NASA veri kümelerini bulun',
    body: 'Bir koleksiyon kaydını görüntü, render edilmiş yüzey veya yerel gözlem sanmadan iki birincil NASA arşiv kataloğunu arayın. Sonuçlar metadata olarak kalır ve orijinal kayıtlarına açılır.',
    earthdataTab: 'Earthdata koleksiyonları',
    pdsTab: 'PDS hedef bağlamı',
    earthdataLabel: 'Earthdata koleksiyon metadatasında ara',
    earthdataPlaceholder: 'ör. buz, aerosol veya okyanus rengi',
    pdsLabel: 'Güneş Sistemi hedef bağlamını bul',
    pdsPlaceholder: 'ör. Europa, Mars veya Ay',
    search: 'Arşivde ara',
    lookup: 'Hedefi bul',
    earthdataLoading: 'NASA Earthdata CMR aranıyor…',
    pdsLoading: 'NASA PDS hedef bağlamı aranıyor…',
    earthdataError: 'NASA Earthdata CMR yüklenemedi.',
    pdsError: 'NASA PDS hedef bağlamı yüklenemedi.',
    earthdataScope: 'Yalnızca koleksiyon metadatası. Anahtar kelime eşleşmesi fiziksel hedef çözücüsü, görüntü, harita veya piksel düzeyinde gözlem değildir.',
    earthdataAccess: 'Her kaydın erişim kuralı kendine aittir; korumalı bir ürün Earthdata Login gerektirebilir.',
    pdsScope: 'Yalnızca hedef-bağlam metadatası. PDS’in aranabilir kapsamı kısmi; bu görünüm her görev ürününün burada dizinlendiği iddiası değildir.',
    records: '{count} eşleşen koleksiyon',
    pdsRecords: '{count} hedef-bağlam kaydı',
    noCollections: 'Bu sorguyla eşleşen koleksiyon metadatası yok.',
    noTargets: 'Bu hedefle eşleşen PDS hedef-bağlam metadatası yok.',
    shortName: 'Kısa ad',
    archiveCenter: 'Arşiv merkezi',
    time: 'Zamansal kapsama',
    browse: 'Tarama görüntüsü',
    online: 'Çevrimiçi erişim',
    yes: 'Mevcut',
    no: 'Listelenmedi',
    metadata: 'CMR metadatasını aç',
    pdsLabelRecord: 'PDS etiketini aç',
    productType: 'Ürün türü',
    version: 'Sürüm',
    updated: 'Güncelleme',
    source: 'Kaynak belgelerini aç',
    fetched: '{time} UTC alındı',
    page: '{pages} sayfadan {page}. sayfa',
    previous: 'Önceki sayfa',
    next: 'Sonraki sayfa',
    unknown: 'Sağlanmadı'
  }
} as const;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function formatDate(value: string | null, language: 'en' | 'tr'): string {
  if (value === null) return COPY[language].unknown;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`NASA archive returned an invalid date value: ${value}`);
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function formatFetchedAt(value: Date, language: 'en' | 'tr'): string {
  const formatted = new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(value);
  return interpolate(COPY[language].fetched, { time: formatted });
}

export function NasaArchiveFinder() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [catalogue, setCatalogue] = useState<'earthdata' | 'pds'>('earthdata');

  return (
    <section className="mt-10 border-t border-sky-100/10 pt-8" aria-labelledby="nasa-archive-finder-title">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-teal-200/80">{copy.eyebrow}</p>
        <h2 id="nasa-archive-finder-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
      </div>

      <nav role="tablist" aria-label={copy.title} className="mt-7 flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={catalogue === 'earthdata'}
          onClick={() => setCatalogue('earthdata')}
          className={`h-9 rounded-full border px-3 text-[9px] uppercase tracking-[0.14em] transition-colors ${catalogue === 'earthdata' ? 'border-teal-300/35 bg-teal-300/[0.12] text-teal-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25 hover:text-slate-100'}`}
        >
          {copy.earthdataTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogue === 'pds'}
          onClick={() => setCatalogue('pds')}
          className={`h-9 rounded-full border px-3 text-[9px] uppercase tracking-[0.14em] transition-colors ${catalogue === 'pds' ? 'border-teal-300/35 bg-teal-300/[0.12] text-teal-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25 hover:text-slate-100'}`}
        >
          {copy.pdsTab}
        </button>
      </nav>

      {catalogue === 'earthdata' ? <EarthdataCollections language={language} /> : <PdsTargetContext language={language} />}
    </section>
  );
}

function EarthdataCollections({ language }: { language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const [draft, setDraft] = useState('ice');
  const [query, setQuery] = useState('ice');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<EarthdataCollectionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void searchEarthdataCollections({ q: query, page }, controller.signal)
      .then(setResult)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draft.trim();
    if (nextQuery.length < 2) {
      setError('NASA Earthdata collection search requires at least two characters.');
      return;
    }
    setPage(1);
    setQuery(nextQuery);
  };
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <section className="mt-6" aria-label={copy.earthdataTab}>
      <p className="max-w-3xl text-[12px] leading-5 text-teal-100/75">{copy.earthdataScope}</p>
      <p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-400">{copy.earthdataAccess}</p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{copy.earthdataLabel}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={copy.earthdataLabel} placeholder={copy.earthdataPlaceholder} className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-300/55 focus:bg-teal-300/[0.045]" />
        </label>
        <button type="submit" className="h-12 shrink-0 rounded-xl border border-teal-300/25 bg-teal-300/[0.08] px-4 text-[10px] uppercase tracking-[0.14em] text-teal-100 transition-colors hover:border-teal-300/50 hover:bg-teal-300/[0.14]">{copy.search}</button>
      </form>

      <ArchiveState loading={loading} error={error} loadingCopy={copy.earthdataLoading} errorCopy={copy.earthdataError} />
      {result && !loading && !error && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border border-teal-300/20 bg-teal-300/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-teal-100/85">{interpolate(copy.records, { count: result.total.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US') })}</span><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">{formatFetchedAt(result.fetchedAt, language)}</span></div>
          {result.records.length === 0 ? <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-[13px] text-slate-300/65">{copy.noCollections}</p> : <ul className="mt-5 grid gap-4 lg:grid-cols-2">{result.records.map((record) => <EarthdataCard key={record.id} record={record} language={language} />)}</ul>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><a href={result.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-teal-200/80 hover:text-teal-100">{copy.source}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>{result.total > result.limit && <Pagination page={result.page} pages={totalPages} onPrevious={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => current + 1)} language={language} />}</div>
        </>
      )}
    </section>
  );
}

function PdsTargetContext({ language }: { language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const [draft, setDraft] = useState('Europa');
  const [target, setTarget] = useState('Europa');
  const [result, setResult] = useState<PdsTargetSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void lookupPdsTarget(target, controller.signal)
      .then(setResult)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [target]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTarget = draft.trim();
    if (nextTarget.length < 2) {
      setError('NASA PDS target lookup requires at least two characters.');
      return;
    }
    setTarget(nextTarget);
  };

  return (
    <section className="mt-6" aria-label={copy.pdsTab}>
      <p className="max-w-3xl text-[12px] leading-5 text-teal-100/75">{copy.pdsScope}</p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{copy.pdsLabel}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={copy.pdsLabel} placeholder={copy.pdsPlaceholder} className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.035] pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-300/55 focus:bg-teal-300/[0.045]" />
        </label>
        <button type="submit" className="h-12 shrink-0 rounded-xl border border-teal-300/25 bg-teal-300/[0.08] px-4 text-[10px] uppercase tracking-[0.14em] text-teal-100 transition-colors hover:border-teal-300/50 hover:bg-teal-300/[0.14]">{copy.lookup}</button>
      </form>

      <ArchiveState loading={loading} error={error} loadingCopy={copy.pdsLoading} errorCopy={copy.pdsError} />
      {result && !loading && !error && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border border-teal-300/20 bg-teal-300/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-teal-100/85">{interpolate(copy.pdsRecords, { count: result.total.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US') })}</span><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">{formatFetchedAt(result.fetchedAt, language)}</span></div>
          {result.records.length === 0 ? <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-[13px] text-slate-300/65">{copy.noTargets}</p> : <ul className="mt-5 grid gap-4 lg:grid-cols-2">{result.records.map((record) => <PdsCard key={record.id} record={record} language={language} />)}</ul>}
          <div className="mt-6 border-t border-white/10 pt-5"><a href={result.sourceUrl} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-teal-200/80 hover:text-teal-100">{copy.source}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a></div>
        </>
      )}
    </section>
  );
}

function ArchiveState({ loading, error, loadingCopy, errorCopy }: { loading: boolean; error: string | null; loadingCopy: string; errorCopy: string }) {
  if (loading) return <div role="status" className="mt-6 flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] text-slate-300/65"><Database className="mr-3 h-4 w-4 animate-pulse text-teal-200" aria-hidden />{loadingCopy}</div>;
  if (error) return <div role="alert" className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-4"><p className="text-[13px] text-rose-100">{errorCopy}</p><p className="mt-2 break-words font-mono text-[11px] leading-5 text-rose-100/70">{error}</p></div>;
  return null;
}

function EarthdataCard({ record, language }: { record: EarthdataCollection; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const temporalCoverage = record.timeStart || record.timeEnd ? `${formatDate(record.timeStart, language)} — ${formatDate(record.timeEnd, language)}` : copy.unknown;
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-teal-200/25 hover:bg-teal-200/[0.035]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-teal-200/70">{record.shortName ?? copy.unknown}{record.versionId ? ` · v${record.versionId}` : ''}</p>
      <h3 className="mt-2 text-lg font-light leading-snug text-white">{record.title}</h3>
      {record.summary && <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-400">{record.summary}</p>}
      <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3 text-[10px]">
        <InfoRow label={copy.archiveCenter} value={record.archiveCenter ?? copy.unknown} />
        <InfoRow label={copy.time} value={temporalCoverage} />
        <InfoRow label={copy.browse} value={record.browseAvailable ? copy.yes : copy.no} />
        <InfoRow label={copy.online} value={record.onlineAccess ? copy.yes : copy.no} />
      </dl>
      <a href={record.metadataUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-teal-200/80 hover:text-teal-100">{copy.metadata}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
    </li>
  );
}

function PdsCard({ record, language }: { record: PdsTargetRecord; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-teal-200/25 hover:bg-teal-200/[0.035]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-teal-200/70">{record.id}</p>
      <h3 className="mt-2 text-lg font-light leading-snug text-white">{record.title}</h3>
      <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3 text-[10px]">
        <InfoRow label={copy.productType} value={record.type} />
        <InfoRow label={copy.version} value={record.version} />
        <InfoRow label={copy.updated} value={formatDate(record.updatedAt, language)} />
      </dl>
      <a href={record.labelUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-teal-200/80 hover:text-teal-100">{copy.pdsLabelRecord}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-300/75">{value}</dd></div>;
}

function Pagination({ page, pages, onPrevious, onNext, language }: { page: number; pages: number; onPrevious: () => void; onNext: () => void; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  return <nav aria-label={interpolate(copy.page, { page, pages })} className="flex items-center gap-3"><button type="button" disabled={page === 1} onClick={onPrevious} aria-label={copy.previous} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-teal-300/45 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden /></button><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{interpolate(copy.page, { page, pages })}</span><button type="button" disabled={page >= pages} onClick={onNext} aria-label={copy.next} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-teal-300/45 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowRight className="h-4 w-4" aria-hidden /></button></nav>;
}

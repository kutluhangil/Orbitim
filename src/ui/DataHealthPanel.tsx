import { ArrowUpRight, CheckCircle2, CircleGauge, Database, Eye, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { SOURCE_REGISTRY, type EvidenceClass, type SourceRecord } from '../data/sourceRegistry';
import { useLanguage } from './i18n';

interface DataHealthPanelProps {
  onClose: () => void;
}

const EVIDENCE_STYLE: Record<EvidenceClass, { icon: typeof Eye; tone: string }> = {
  observed: { icon: Eye, tone: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' },
  calculated: { icon: CircleGauge, tone: 'border-sky-300/25 bg-sky-300/10 text-sky-100' },
  operational: { icon: Database, tone: 'border-amber-300/25 bg-amber-300/10 text-amber-100' },
  reference: { icon: CheckCircle2, tone: 'border-violet-300/25 bg-violet-300/10 text-violet-100' }
};

const COPY = {
  en: {
    title: 'Evidence map',
    eyebrow: 'Orbitim data health',
    body: 'Every visual and reading layer carries a different kind of evidence. This map makes the distinction visible instead of calling the entire scene live NASA imagery.',
    close: 'Return to simulation',
    source: 'Open source',
    update: 'Update model',
    scope: 'What it supports',
    limitation: 'Precision boundary',
    observed: 'Observed / archived',
    calculated: 'Calculated',
    operational: 'Operational tracking',
    reference: 'Reference constants',
    note: 'A source link opens the primary provider or the project attribution record. No personal location or private API key is included here.'
  },
  tr: {
    title: 'Kanıt haritası',
    eyebrow: 'Orbitim veri sağlığı',
    body: 'Her görsel ve okuma katmanı farklı türde kanıta dayanır. Bu harita, tüm sahneyi canlı NASA görüntüsü diye adlandırmak yerine ayrımı görünür kılar.',
    close: 'Simülasyona dön',
    source: 'Kaynağı aç',
    update: 'Güncelleme modeli',
    scope: 'Desteklediği alan',
    limitation: 'Hassasiyet sınırı',
    observed: 'Gözlem / arşiv',
    calculated: 'Hesaplanmış',
    operational: 'Operasyonel takip',
    reference: 'Referans sabitleri',
    note: 'Kaynak bağlantısı birincil sağlayıcıyı veya proje atıf kaydını açar. Kişisel konum ya da özel API anahtarı burada yer almaz.'
  }
} as const;

function SourceCard({ source, language }: { source: SourceRecord; language: 'en' | 'tr' }) {
  const copy = COPY[language];
  const style = EVIDENCE_STYLE[source.evidence];
  const Icon = style.icon;
  const label = copy[source.evidence];

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] uppercase tracking-[0.16em] ${style.tone}`}>
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </div>
          <h3 className="mt-3 text-[14px] font-normal tracking-tight text-white">{source.title}</h3>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-sky-100/65">{source.provider}</p>
        </div>
        <a
          href={source.sourceUrl}
          target={source.sourceUrl.startsWith('http') ? '_blank' : undefined}
          rel={source.sourceUrl.startsWith('http') ? 'noreferrer' : undefined}
          aria-label={`${copy.source}: ${source.provider}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/45 transition-colors hover:border-sky-300/45 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
      <dl className="mt-4 space-y-3 border-t border-white/8 pt-3 text-[11px] leading-relaxed">
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/38">{copy.update}</dt>
          <dd className="mt-0.5 text-white/73">{source.updateModel[language]}</dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/38">{copy.scope}</dt>
          <dd className="mt-0.5 text-white/73">{source.scope[language]}</dd>
        </div>
        {source.limitation && (
          <div>
            <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-amber-100/55">{copy.limitation}</dt>
            <dd className="mt-0.5 text-amber-50/80">{source.limitation[language]}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

/** A readable evidence ledger beside the simulation, never a hidden marketing claim. */
export function DataHealthPanel({ onClose }: DataHealthPanelProps) {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const closeRef = useRef<HTMLButtonElement>(null);
  const groups = useMemo(() => {
    const order: EvidenceClass[] = ['observed', 'calculated', 'operational', 'reference'];
    return order.map((kind) => ({ kind, items: SOURCE_REGISTRY.filter((source) => source.evidence === kind) }));
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="pointer-events-auto fixed inset-0 z-[70] overflow-y-auto bg-black/88 px-3 py-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-6xl rounded-[1.8rem] border border-white/12 bg-[#07090d]/95 p-5 shadow-2xl shadow-black/70 sm:p-8">
        <header className="flex items-start justify-between gap-6 border-b border-white/10 pb-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-sky-200/65">{copy.eyebrow}</p>
            <h2 className="mt-2 text-balance text-[clamp(1.7rem,4vw,3rem)] font-extralight tracking-[-0.035em] text-white">{copy.title}</h2>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/58">{copy.body}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/12 px-3.5 text-[9px] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-sky-300/45 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {copy.close}
          </button>
        </header>

        <div className="mt-6 space-y-8">
          {groups.map(({ kind, items }) => (
            <section key={kind} aria-label={copy[kind]}>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/46">{copy[kind]}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((source) => <SourceCard key={source.id} source={source} language={language} />)}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-7 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-white/40">{copy.note}</p>
      </div>
    </section>
  );
}

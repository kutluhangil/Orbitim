import { ArrowUpRight, Clock3, Route, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { TIME_JOURNEYS, type TimeJourney } from '../data/timeJourneys';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { useViewSettings } from '../scene/viewSettings';
import { useSpacecraftSelection } from '../scene/spacecraftSelection';
import { localizedBodyName, useLanguage } from './i18n';
import { getBodyRecord } from '../lib/ephemeris/bodies';
import { BodyDisc } from './BodyDisc';

interface TimeJourneysProps {
  onClose: () => void;
}

const COPY = {
  en: {
    eyebrow: 'Orbitim time journeys',
    title: 'Revisit a measured moment.',
    body: 'Each route sets the solar-system clock to a cited UTC instant and flies continuously to the relevant world. It says precisely what is calculated and what is not reconstructed.',
    start: 'Begin journey',
    close: 'Return to simulation',
    source: 'Open source',
    target: 'Destination',
    precision: 'Evidence boundary',
    note: 'Starting a journey pauses time at its cited instant and switches the scene to Scientific mode. Use Now to return to the live clock.'
  },
  tr: {
    eyebrow: 'Orbitim zaman yolculukları',
    title: 'Ölçülmüş bir ana dön.',
    body: 'Her rota Güneş Sistemi saatini kaynak gösterilen bir UTC anına ayarlar ve ilgili dünyaya kesintisiz uçar. Nelerin hesaplandığını ve nelerin yeniden kurulmadığını açıkça söyler.',
    start: 'Yolculuğu başlat',
    close: 'Simülasyona dön',
    source: 'Kaynağı aç',
    target: 'Hedef',
    precision: 'Kanıt sınırı',
    note: 'Bir yolculuk başlatmak zamanı kaynak gösterilen anda durdurur ve sahneyi Bilimsel moda geçirir. Canlı saate dönmek için Şimdi’yi kullan.'
  }
} as const;

function formatUtc(value: string, language: 'en' | 'tr'): string {
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC'
  }).format(new Date(value)) + ' UTC';
}

function JourneyCard({ journey, language, onStart }: { journey: TimeJourney; language: 'en' | 'tr'; onStart: (journey: TimeJourney) => void }) {
  const copy = COPY[language];
  const text = journey.copy[language];
  const target = getBodyRecord(journey.target);
  const targetName = localizedBodyName(language, journey.target, target.name);
  return (
    <article className="flex min-h-full flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-sm shadow-black/20">
      <header className="flex items-start gap-3">
        <BodyDisc id={journey.target} className="mt-0.5 h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-sky-200/65">{text.eyebrow}</p>
          <h3 className="mt-1 text-[15px] font-normal tracking-tight text-white">{text.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-white/44"><Clock3 className="h-3 w-3" aria-hidden />{formatUtc(journey.date, language)}</p>
        </div>
      </header>
      <p className="mt-4 text-[12px] leading-relaxed text-white/68">{text.summary}</p>
      <dl className="mt-4 space-y-3 border-y border-white/8 py-3 text-[10px] leading-relaxed">
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/38">{copy.target}</dt>
          <dd className="mt-0.5 text-sky-100/85">{targetName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-amber-100/55">{copy.precision}</dt>
          <dd className="mt-0.5 text-amber-50/80">{text.precision}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3">
        <a
          href={journey.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-white/10 px-3 text-[9px] uppercase tracking-[0.12em] text-white/60 transition-colors hover:border-sky-300/45 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <span className="sr-only sm:not-sr-only">{copy.source}</span><ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => onStart(journey)}
          aria-label={`${copy.start}: ${text.title}`}
          className="min-h-10 rounded-full border border-sky-300/30 bg-sky-300/[0.08] px-3.5 text-[9px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-300/60 hover:bg-sky-300/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {copy.start}
        </button>
      </div>
    </article>
  );
}

/** Source-backed histories that reuse the live scene instead of faking a second mission simulator. */
export function TimeJourneys({ onClose }: TimeJourneysProps) {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const closeRef = useRef<HTMLButtonElement>(null);

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

  const start = (journey: TimeJourney) => {
    const date = new Date(journey.date);
    if (Number.isNaN(date.getTime())) throw new Error(`Time journey ${journey.id} has an invalid UTC timestamp: ${journey.date}`);
    const clock = useSimTime.getState();
    clock.setDate(date);
    clock.setMultiplier(1);
    clock.setPlaying(false);
    useViewSettings.getState().setMode('scientific');
    useSpacecraftSelection.getState().clear();
    useFlight.getState().flyTo(journey.target);
    onClose();
  };

  return (
    <section role="dialog" aria-modal="true" aria-label={copy.title} className="pointer-events-auto fixed inset-0 z-[70] overflow-y-auto bg-black/88 px-3 py-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl rounded-[1.8rem] border border-white/12 bg-[#07090d]/95 p-5 shadow-2xl shadow-black/70 sm:p-8">
        <header className="flex items-start justify-between gap-6 border-b border-white/10 pb-6">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.26em] text-sky-200/65"><Route className="h-3.5 w-3.5" aria-hidden />{copy.eyebrow}</p>
            <h2 className="mt-2 text-balance text-[clamp(1.7rem,4vw,3rem)] font-extralight tracking-[-0.035em] text-white">{copy.title}</h2>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/58">{copy.body}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/12 px-3.5 text-[9px] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-sky-300/45 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
            <X className="h-3.5 w-3.5" aria-hidden />{copy.close}
          </button>
        </header>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TIME_JOURNEYS.map((journey) => <JourneyCard key={journey.id} journey={journey} language={language} onStart={start} />)}
        </div>
        <p className="mt-7 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-white/40">{copy.note}</p>
      </div>
    </section>
  );
}

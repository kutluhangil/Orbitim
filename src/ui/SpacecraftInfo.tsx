import { ArrowUpRight, CalendarDays, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SPACECRAFT } from '../data/spacecraft';
import { useLanguage, useTranslation } from './i18n';

interface SpacecraftInfoProps {
  craftId: string;
  onClose: () => void;
}

function formatLaunchDate(value: string, language: 'en' | 'tr'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Spacecraft dossier has an invalid launch date: ${value}`);
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(date);
}

/**
 * A compact, source-linked mission dossier. It deliberately replaces the
 * close-range scene label: a vehicle's name and purpose are easier to read in
 * one fixed panel than as giant world-space text next to an AU-scale model.
 */
export function SpacecraftInfo({ craftId, onClose }: SpacecraftInfoProps) {
  const craft = SPACECRAFT.find((candidate) => candidate.id === craftId);
  if (!craft) throw new Error(`No spacecraft dossier exists for selected craft: ${craftId}`);

  const language = useLanguage((state) => state.language);
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogLabel = `${craft.name} ${t('missionDossier')}`;

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
      aria-label={dialogLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="pointer-events-auto fixed inset-0 z-[80] flex items-end bg-black/78 p-3 backdrop-blur-md sm:items-center sm:justify-center sm:p-6"
    >
      <article className="w-full max-w-lg rounded-[1.5rem] border border-white/12 bg-[#07090d]/95 p-5 shadow-2xl shadow-black/80 sm:p-6">
        <header className="flex items-start gap-4 border-b border-white/10 pb-5">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_1rem_currentColor]"
            style={{ color: craft.color, backgroundColor: craft.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-sky-200/62">{t('missionDossier')}</p>
            <h2 className="mt-1.5 text-[clamp(1.35rem,5vw,1.85rem)] font-light tracking-[-0.03em] text-white">{craft.name}</h2>
            <p className="mt-1 text-[12px] text-white/48">{craft.agency}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('closeMissionDossier')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/65 transition-colors hover:border-sky-300/45 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <dl className="divide-y divide-white/8">
          <div className="py-4">
            <dt className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.18em] text-sky-200/58">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t('launchDate')}
            </dt>
            <dd className="mt-1.5 text-[14px] text-white/88">{formatLaunchDate(craft.dossier.launchDate, language)}</dd>
          </div>
          <div className="py-4">
            <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-sky-200/58">{t('missionPurpose')}</dt>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-white/72">{craft.dossier.purpose[language]}</dd>
          </div>
          <div className="py-4">
            <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-amber-100/60">{t('missionMilestone')}</dt>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-amber-50/76">{craft.dossier.milestone[language]}</dd>
          </div>
        </dl>

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <a
            href={craft.dossier.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t('openMissionSource')}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-300/25 px-3.5 text-[9px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-300/55 hover:bg-sky-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {t('missionSource')} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
          <p className="max-w-[12rem] text-right text-[9px] leading-relaxed text-white/34">{t('spacecraftPositionNote')}</p>
        </div>
      </article>
    </section>
  );
}

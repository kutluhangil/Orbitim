import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchNaturalEvents, type NaturalEvent, type NaturalEventsSnapshot } from '../services/eonet';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { type AppLanguage, useTranslation } from './i18n';

const DISPLAY_LIMIT = 6;

function formatUtc(date: Date, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date);
}

function formatCoordinates(event: NaturalEvent, language: AppLanguage): string | null {
  if (!event.position) return null;
  const format = new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
  const latitude = `${format.format(Math.abs(event.position.latitude))}° ${event.position.latitude >= 0 ? 'N' : 'S'}`;
  const longitude = `${format.format(Math.abs(event.position.longitude))}° ${event.position.longitude >= 0 ? 'E' : 'W'}`;
  return `${latitude}, ${longitude}`;
}

function formatMagnitude(event: NaturalEvent): string | null {
  if (event.magnitudeValue === null || event.magnitudeUnit === null) return null;
  return `${event.magnitudeValue.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${event.magnitudeUnit}`;
}

/**
 * EONET is a catalogue of active natural-event records. It remains alongside
 * the Earth dossier instead of being painted onto the rendered globe, because
 * a catalogue geometry is neither a satellite image nor a verified incident
 * boundary.
 */
export function EarthEventsCard() {
  const [snapshot, setSnapshot] = useState<NaturalEventsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { language, t } = useTranslation();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchNaturalEvents(signal);
      if (!signal?.aborted) setSnapshot(next);
    } catch (cause) {
      if (signal?.aborted) return;
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const events = useMemo(() => snapshot?.events.slice(0, DISPLAY_LIMIT) ?? [], [snapshot]);

  return (
    <section className="mb-5 border-y border-teal-300/15 py-4" aria-busy={loading} aria-label={t('openNaturalEvents')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-teal-200/80">{t('openNaturalEvents')}</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-white/40">{t('naturalEventsScopeNote')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DataProvenanceBadge kind={error ? 'unavailable' : 'catalogued'}>{error ? t('unavailable') : t('catalogued')}</DataProvenanceBadge>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label={t('refreshNaturalEvents')}
            title={t('refreshNaturalEvents')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:border-teal-300/45 hover:text-teal-100 disabled:cursor-wait"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[11px] leading-relaxed text-rose-200/90">{t('naturalEventsUnavailable', { error })}</p>
      ) : snapshot ? (
        <>
          <p className="mt-3 text-[10px] tabular-nums text-white/45">{t('openEventsShown', { shown: events.length, total: snapshot.events.length })}</p>
          <ol className="mt-3 space-y-3">
            {events.map((event) => {
              const coordinates = formatCoordinates(event, language);
              const magnitude = formatMagnitude(event);
              return (
                <li key={event.id} className="border-l border-teal-300/25 pl-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[11px] leading-snug text-white/80">{event.title}</p>
                    {event.sourceUrl && (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-teal-200/75 transition-colors hover:text-teal-100"
                        aria-label={t('openNaturalEventSource', { event: event.title })}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-teal-100/75">{event.categories.join(' · ')}</p>
                  <p className="mt-1 text-[10px] tabular-nums text-white/45">{formatUtc(event.observedAt, language)}</p>
                  {(coordinates || magnitude) && (
                    <p className="mt-1 text-[10px] tabular-nums text-white/40">
                      {[coordinates, magnitude].filter((value): value is string => value !== null).join(' · ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <a
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-[10px] uppercase tracking-[0.14em] text-teal-200/75 transition-colors hover:text-teal-100"
          >
            {t('openEonetDocumentation')}
          </a>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-white/45">{t('loadingNaturalEvents')}</p>
      )}
    </section>
  );
}

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useFlight } from '../flight/useFlight';
import {
  fetchSpaceWeather,
  type SolarImpactEvidence,
  type SolarImpactStream,
  type SpaceWeatherSnapshot
} from '../services/nasaDonki';
import { useSolarActivity } from '../scene/solarActivity';
import { useViewSettings } from '../scene/viewSettings';
import { type AppLanguage, useTranslation } from './i18n';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function formatTime(date: Date, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date);
}

function details(
  snapshot: SpaceWeatherSnapshot,
  language: AppLanguage,
  t: ReturnType<typeof useTranslation>['t']
): Array<{ label: string; value: string; detail: string }> {
  const flare = snapshot.latestFlare;
  const cme = snapshot.latestCme;
  const storm = snapshot.latestGeomagneticActivity;

  return [
    {
      label: t('latestFlare'),
      value: flare ? flare.classType : t('noReport'),
      detail: flare
        ? `${formatTime(flare.peakTime, language)}${flare.sourceLocation ? ` · ${flare.sourceLocation}` : ''}`
        : t('noFlareLast14Days')
    },
    {
      label: t('latestCme'),
      value: cme ? (cme.speedKmPerSecond === null ? t('speedPending') : `${Math.round(cme.speedKmPerSecond)} km/s`) : t('noReport'),
      detail: cme ? formatTime(cme.startTime, language) : t('noCmeLast14Days')
    },
    {
      label: t('geomagneticKp'),
      value: storm ? (storm.peakKp === null ? t('readingPending') : storm.peakKp.toFixed(1)) : t('noReport'),
      detail: storm ? formatTime(storm.observedTime ?? storm.startTime, language) : t('noStormLast14Days')
    }
  ];
}

function impactStreamLabel(stream: SolarImpactStream, t: ReturnType<typeof useTranslation>['t']): string {
  const labels = {
    energeticParticles: 'energeticParticles',
    interplanetaryShocks: 'interplanetaryShocks',
    highSpeedStreams: 'highSpeedStreams',
    radiationBelts: 'radiationBelts',
    magnetopauseCrossings: 'magnetopauseCrossings',
    notifications: 'spaceWeatherNotices',
    enlilSimulations: 'enlilSimulations'
  } as const;
  return t(labels[stream.id]);
}

function evidenceLabel(evidence: SolarImpactEvidence, t: ReturnType<typeof useTranslation>['t']): string {
  if (evidence === 'observed') return t('observedReport');
  if (evidence === 'reported') return t('reportedNotice');
  return t('modelOutput');
}

function evidenceClass(evidence: SolarImpactEvidence, light: boolean): string {
  if (evidence === 'modelled') return light ? 'text-violet-700' : 'text-violet-200';
  if (evidence === 'reported') return light ? 'text-amber-700' : 'text-amber-200';
  return light ? 'text-emerald-700' : 'text-emerald-200';
}

/** A small observed-data instrument, kept in the overview's free upper-right column. */
export function SpaceWeatherPanel() {
  const target = useFlight((state) => state.target);
  const light = useViewSettings((state) => state.theme === 'light');
  const [snapshot, setSnapshot] = useState<SpaceWeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { language, t } = useTranslation();

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSpaceWeather(signal);
      if (!signal?.aborted) {
        setSnapshot(next);
        useSolarActivity.getState().setSnapshot(next);
      }
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setSnapshot(null);
      useSolarActivity.getState().setSnapshot(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (target !== null) return null;

  const surface = light
    ? 'border-slate-300/60 bg-white/70 text-slate-700'
    : 'border-white/10 bg-black/70 text-white';
  const muted = light ? 'text-slate-500' : 'text-white/45';

  return (
    <aside
      aria-label={t('solarWeather')}
      className={`pointer-events-auto fixed right-[22rem] top-6 z-10 hidden w-72 rounded-2xl border p-5 backdrop-blur-xl lg:block ${surface}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-[10px] uppercase tracking-[0.28em] ${light ? 'text-sky-600/80' : 'text-sky-300/70'}`}>
            {t('solarWeather')}
          </h2>
          <p className={`mt-1 text-[10px] ${muted}`}>{t('nasaReports')}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={t('refreshSolarWeather')}
          title={t('refreshSolarWeather')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-wait ${
            light
              ? 'border-slate-300 text-slate-500 hover:border-sky-400 hover:text-sky-700'
              : 'border-white/10 text-white/50 hover:border-sky-300/50 hover:text-sky-100'
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {error ? (
        <p className="mt-4 text-[11px] leading-relaxed text-red-300/90">{t('nasaTelemetryUnavailable', { error })}</p>
      ) : snapshot ? (
        <ul className="mt-4 space-y-3">
          {details(snapshot, language, t).map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>{item.label}</span>
                <span className={`text-[12px] font-medium tabular-nums ${light ? 'text-sky-700' : 'text-sky-100'}`}>{item.value}</span>
              </div>
              <p className={`mt-0.5 text-[10px] tabular-nums ${muted}`}>{item.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-4 text-[11px] ${muted}`}>{t('loadingNasaReports')}</p>
      )}

      {snapshot && (
        <section className={`mt-4 border-t pt-4 ${light ? 'border-slate-200' : 'border-white/10'}`} aria-label={t('solarImpactLedger')}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={`text-[10px] uppercase tracking-[0.18em] ${light ? 'text-sky-700' : 'text-sky-200'}`}>{t('solarImpactLedger')}</h3>
            <span className={`text-[9px] uppercase tracking-[0.12em] ${muted}`}>{t('last14Days')}</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {snapshot.impactStreams.map((stream) => (
              <li key={stream.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5">
                <span className={`min-w-0 truncate text-[10px] ${muted}`} title={stream.sourceError ?? `${stream.endpoint} · NASA DONKI`}>
                  {impactStreamLabel(stream, t)}
                </span>
                <span className={`text-[10px] font-medium tabular-nums ${stream.sourceError ? 'text-red-300' : light ? 'text-slate-700' : 'text-white/85'}`}>
                  {stream.sourceError ? t('unavailable') : t('reportCount', { count: stream.reportCount })}
                </span>
                <span className={`col-span-2 text-[9px] uppercase tracking-[0.12em] ${stream.sourceError ? 'text-red-300/90' : evidenceClass(stream.evidence, light)}`}>
                  {stream.sourceError ? t('sourceUnavailable') : evidenceLabel(stream.evidence, t)}
                </span>
              </li>
            ))}
          </ul>
          <p className={`mt-3 text-[10px] leading-relaxed ${muted}`}>{t('solarImpactScopeNote')}</p>
        </section>
      )}

      {snapshot && <p className={`mt-4 text-[10px] tabular-nums ${muted}`}>{t('updated')} {formatTime(snapshot.fetchedAt, language)}</p>}
      {snapshot && <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>{t('solarVisualsNote')}</p>}
      <a
        href="https://eyes.nasa.gov/apps/dsn-now/"
        target="_blank"
        rel="noreferrer"
        className={`mt-4 inline-flex text-[10px] uppercase tracking-[0.16em] transition-colors ${light ? 'text-sky-700 hover:text-sky-900' : 'text-sky-200/75 hover:text-sky-100'}`}
      >
        {t('openNasaEyes')}
      </a>
      <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>{t('dsnStatusNote')}</p>
    </aside>
  );
}

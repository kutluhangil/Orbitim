import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useFlight } from '../flight/useFlight';
import { fetchSpaceWeather, type SpaceWeatherSnapshot } from '../services/nasaDonki';
import { useSolarActivity } from '../scene/solarActivity';
import { useViewSettings } from '../scene/viewSettings';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date);
}

function details(snapshot: SpaceWeatherSnapshot): Array<{ label: string; value: string; detail: string }> {
  const flare = snapshot.latestFlare;
  const cme = snapshot.latestCme;
  const storm = snapshot.latestGeomagneticActivity;

  return [
    {
      label: 'Latest flare',
      value: flare ? flare.classType : 'No report',
      detail: flare
        ? `${formatTime(flare.peakTime)}${flare.sourceLocation ? ` · ${flare.sourceLocation}` : ''}`
        : 'No flare report in the last 14 days'
    },
    {
      label: 'Latest CME',
      value: cme ? (cme.speedKmPerSecond === null ? 'Speed pending' : `${Math.round(cme.speedKmPerSecond)} km/s`) : 'No report',
      detail: cme ? formatTime(cme.startTime) : 'No CME report in the last 14 days'
    },
    {
      label: 'Geomagnetic Kp',
      value: storm ? (storm.peakKp === null ? 'Reading pending' : storm.peakKp.toFixed(1)) : 'No report',
      detail: storm ? formatTime(storm.observedTime ?? storm.startTime) : 'No storm report in the last 14 days'
    }
  ];
}

/** A small observed-data instrument, kept in the overview's free upper-right column. */
export function SpaceWeatherPanel() {
  const target = useFlight((state) => state.target);
  const light = useViewSettings((state) => state.theme === 'light');
  const [snapshot, setSnapshot] = useState<SpaceWeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      aria-label="NASA space weather"
      className={`pointer-events-auto fixed right-[22rem] top-6 z-10 hidden w-64 rounded-2xl border p-5 backdrop-blur-xl lg:block ${surface}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-[10px] uppercase tracking-[0.28em] ${light ? 'text-sky-600/80' : 'text-sky-300/70'}`}>
            Solar weather
          </h2>
          <p className={`mt-1 text-[10px] ${muted}`}>NASA DONKI · server-cached reports</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh NASA solar weather"
          title="Refresh NASA solar weather"
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
        <p className="mt-4 text-[11px] leading-relaxed text-red-300/90">NASA telemetry unavailable: {error}</p>
      ) : snapshot ? (
        <ul className="mt-4 space-y-3">
          {details(snapshot).map((item) => (
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
        <p className={`mt-4 text-[11px] ${muted}`}>Loading NASA reports…</p>
      )}

      {snapshot && <p className={`mt-4 text-[10px] tabular-nums ${muted}`}>Updated {formatTime(snapshot.fetchedAt)}</p>}
      {snapshot && <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>Solar visuals respond to these observed reports.</p>}
      <a
        href="https://eyes.nasa.gov/apps/dsn-now/"
        target="_blank"
        rel="noreferrer"
        className={`mt-4 inline-flex text-[10px] uppercase tracking-[0.16em] transition-colors ${light ? 'text-sky-700 hover:text-sky-900' : 'text-sky-200/75 hover:text-sky-100'}`}
      >
        Open NASA Eyes · DSN Now ↗
      </a>
      <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>Live station status remains in NASA’s dedicated interface; Orbitim does not infer DSN links.</p>
    </aside>
  );
}

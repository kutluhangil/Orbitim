import { useEffect, useMemo, useState } from 'react';
import { eventNarrative, moonPhaseNow, upcomingEvents, type SkyEvent } from '../lib/ephemeris/events';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { useViewSettings } from '../scene/viewSettings';
import { fetchNearApproaches, type NearApproach } from '../services/nearApproaches';
import { useSpacecraftState } from '../scene/spacecraftState';
import { sonifySkyEvent } from '../lib/audio/sonification';

/**
 * The sky's calendar, shown in the overview where the right-hand column is free.
 * The current lunar phase reads live; the event list — eclipses, transits, the
 * next planetary conjunction — is recomputed as the clock crosses each hour, so
 * scrubbing the date rolls the whole calendar forward with it.
 */

function formatWhen(date: Date, now: Date): { rel: string; abs: string } {
  const days = Math.round((date.getTime() - now.getTime()) / 86400000);
  let rel: string;
  if (days <= 0) rel = 'imminent';
  else if (days === 1) rel = 'tomorrow';
  else if (days < 45) rel = `in ${days} days`;
  else if (days < 730) rel = `in ${Math.max(1, Math.round(days / 30.44))} months`;
  else rel = `in ${(days / 365.25).toFixed(1)} years`;
  const abs = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { rel, abs };
}

export function EventsPanel() {
  const target = useFlight((s) => s.target);
  const light = useViewSettings((s) => s.theme === 'light');
  const [, setTick] = useState(0);
  const [approachState, setApproachState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [approaches, setApproaches] = useState<NearApproach[]>([]);
  const [approachSource, setApproachSource] = useState<string | null>(null);
  const [approachError, setApproachError] = useState<string | null>(null);
  const [sonifying, setSonifying] = useState<string | null>(null);
  const [sonificationError, setSonificationError] = useState<string | null>(null);
  const horizonsStatus = useSpacecraftState((state) => state.status);
  const horizonsUpdatedAt = useSpacecraftState((state) => state.updatedAt);
  const horizonsError = useSpacecraftState((state) => state.error);
  const refreshHorizons = useSpacecraftState((state) => state.refresh);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const now = useSimTime.getState().date;
  const moon = moonPhaseNow(now);
  // The event searches are the expensive part; recompute only as the simulated
  // hour changes rather than every second.
  const hourBucket = Math.floor(now.getTime() / 3600000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => upcomingEvents(now), [hourBucket]);

  // Only in the overview: a selected body shows the InfoPanel in this column.
  if (target !== null) return null;

  const surface = light
    ? 'border-slate-300/60 bg-white/70 text-slate-700'
    : 'border-white/10 bg-black/70 text-white';
  const muted = light ? 'text-slate-500' : 'text-white/45';

  const loadApproaches = async () => {
    setApproachState('loading');
    setApproachError(null);
    try {
      const result = await fetchNearApproaches();
      setApproaches(result.approaches);
      setApproachSource(`${result.source}${result.version ? ` · v${result.version}` : ''}`);
      setApproachState('ready');
    } catch (cause) {
      setApproachState('error');
      setApproachError(`Near-approach data unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const refreshLiveVectors = () => {
    void refreshHorizons(useSimTime.getState().date).catch((cause) => {
      console.error('JPL Horizons manual refresh failed.', cause);
    });
  };

  const visitEvent = (event: SkyEvent) => {
    const time = useSimTime.getState();
    time.setDate(event.date);
    if (time.playing) time.togglePlaying();
    useFlight.getState().flyTo(event.focusBody);
  };

  const playEvent = async (event: SkyEvent) => {
    setSonifying(event.id);
    setSonificationError(null);
    try {
      await sonifySkyEvent(event, now);
    } catch (cause) {
      setSonificationError(`Event sonification unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setSonifying(null);
    }
  };

  return (
    <aside
      className={`pointer-events-auto fixed inset-x-0 bottom-[var(--system-dock)] z-10 hidden max-h-[46dvh] overflow-y-auto rounded-t-2xl border-t px-4 pb-5 pt-4 backdrop-blur-xl [@media(min-height:560px)]:block md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:max-h-[80vh] md:w-[20rem] md:-translate-y-1/2 md:rounded-2xl md:border md:p-6 ${surface}`}
    >
      <h2 className={`text-[10px] uppercase tracking-[0.28em] ${light ? 'text-sky-600/80' : 'text-sky-300/70'}`}>
        The sky right now
      </h2>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden>{moon.glyph}</span>
        <div>
          <div className="text-[15px] font-light tracking-tight">{moon.name}</div>
          <div className={`text-[11px] ${muted}`}>
            {(moon.illum * 100).toFixed(0)}% lit · {moon.waxing ? 'waxing' : 'waning'}
          </div>
        </div>
      </div>

      <h3 className={`mb-1 mt-6 text-[10px] uppercase tracking-[0.22em] ${light ? 'text-slate-400' : 'text-white/30'}`}>
        Coming up
      </h3>
      <ul className="space-y-3">
        {events.map((event) => {
          const when = formatWhen(event.date, now);
          return (
            <li key={event.id} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] tracking-tight">{event.label}</div>
                <div className={`truncate text-[11px] leading-snug ${muted}`}>{event.detail}</div>
                <p className={`mt-1 text-[10px] leading-snug ${muted}`}>{eventNarrative(event)}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => visitEvent(event)} className={`text-[9px] uppercase tracking-[0.16em] ${light ? 'text-sky-700' : 'text-sky-200/80'}`}>Visit event</button>
                  <button type="button" onClick={() => void playEvent(event)} disabled={sonifying !== null} className={`text-[9px] uppercase tracking-[0.16em] disabled:cursor-wait ${light ? 'text-slate-500' : 'text-white/45'}`}>{sonifying === event.id ? 'Playing…' : 'Hear data'}</button>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-[11px] tabular-nums ${light ? 'text-sky-600' : 'text-sky-200/80'}`}>{when.rel}</div>
                <div className={`text-[10px] tabular-nums ${muted}`}>{when.abs}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {sonificationError && <p className="mt-3 text-[10px] leading-relaxed text-red-300/90">{sonificationError}</p>}
      <p className={`mt-3 text-[10px] leading-relaxed ${muted}`}>Hear data maps days until the event to pitch and event class to pulse count. It is not an astronomical audio recording.</p>

      <div className={`mt-6 border-t pt-4 ${light ? 'border-slate-200' : 'border-white/8'}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-[10px] uppercase tracking-[0.22em] ${light ? 'text-slate-400' : 'text-white/30'}`}>JPL trajectories</h3>
          <button type="button" onClick={refreshLiveVectors} disabled={horizonsStatus === 'loading'} className={`rounded-md border px-2 py-1 text-[9px] uppercase tracking-[0.16em] disabled:cursor-wait ${light ? 'border-slate-300 text-sky-700' : 'border-sky-300/25 text-sky-200/80'}`}>
            {horizonsStatus === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {horizonsStatus === 'ready' && horizonsUpdatedAt && <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>5 heliocentric state vectors · JPL Horizons · fetched {horizonsUpdatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</p>}
        {horizonsStatus === 'idle' && <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>Requesting exact, heliocentric state vectors from JPL Horizons.</p>}
        {horizonsError && <p className="mt-2 text-[10px] leading-relaxed text-red-300/90">{horizonsError}</p>}
        <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>A vector is used only at its stated instant; scrubbed times retain the clearly labelled reference trajectory.</p>
      </div>

      <div className={`mt-5 border-t pt-4 ${light ? 'border-slate-200' : 'border-white/8'}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-[10px] uppercase tracking-[0.22em] ${light ? 'text-slate-400' : 'text-white/30'}`}>Near-Earth approaches</h3>
          <button type="button" onClick={() => void loadApproaches()} disabled={approachState === 'loading'} className={`rounded-md border px-2 py-1 text-[9px] uppercase tracking-[0.16em] disabled:cursor-wait ${light ? 'border-slate-300 text-sky-700' : 'border-sky-300/25 text-sky-200/80'}`}>
            {approachState === 'loading' ? 'Loading…' : approachState === 'ready' ? 'Refresh' : 'Load'}
          </button>
        </div>
        {approachState === 'idle' && <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>The next six NEO approaches within 0.05 AU, requested only when opened.</p>}
        {approachError && <p className="mt-2 text-[10px] leading-relaxed text-red-300/90">{approachError}</p>}
        {approachState === 'ready' && (
          <>
            <ul className="mt-2 space-y-1.5">
              {approaches.map((approach) => (
                <li key={`${approach.name}-${approach.at}`} className="flex items-baseline justify-between gap-2 text-[10px]">
                  <span className="min-w-0 truncate text-white/70">{approach.name}</span>
                  <span className={`shrink-0 tabular-nums ${light ? 'text-sky-700' : 'text-sky-100/85'}`}>{approach.distanceAu.toFixed(3)} AU · {approach.velocityKmS.toFixed(1)} km/s</span>
                </li>
              ))}
            </ul>
            {approaches.length === 0 && <p className={`mt-2 text-[10px] ${muted}`}>No matching approaches in the requested window.</p>}
            {approachSource && <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>{approachSource} · times are TDB.</p>}
          </>
        )}
      </div>

      <p className={`mt-6 text-[10px] leading-relaxed ${light ? 'text-slate-400' : 'text-white/25'}`}>
        Eclipses, transits and phases from astronomy-engine, for the instant on the clock.
      </p>
    </aside>
  );
}

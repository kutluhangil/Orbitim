import { useEffect, useMemo, useState } from 'react';
import { upcomingEvents, type SkyEvent } from '../lib/ephemeris/events';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { type AppLanguage, useTranslation } from './i18n';

const HORIZON_MS = 45 * 86_400_000;

function shortDate(date: Date, language: AppLanguage): string {
  return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function visit(event: SkyEvent) {
  const time = useSimTime.getState();
  time.setDate(event.date);
  time.setPlaying(false);
  useFlight.getState().flyTo(event.focusBody);
}

/**
 * A calculated event rail attached to the simulation clock. It deliberately
 * gives only upcoming geometry a place in time; the panel retains the full
 * explanation and any external observation links.
 */
export function EventTimeline() {
  const target = useFlight((state) => state.target);
  const [, setTick] = useState(0);
  const { language, t } = useTranslation();

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const now = useSimTime.getState().date;
  const hourBucket = Math.floor(now.getTime() / 3_600_000);
  const searchInstant = useMemo(() => new Date(hourBucket * 3_600_000), [hourBucket]);
  // The astronomy search is intentionally tied to the simulated hour rather
  // than the frame loop; moving the clock changes the rail deterministically.
  const events = useMemo(() => upcomingEvents(searchInstant)
    .filter((event) => event.date.getTime() - searchInstant.getTime() <= HORIZON_MS)
    .slice(0, 5), [searchInstant]);

  if (target !== null || events.length === 0) return null;

  return (
    <section
      aria-label={t('calculatedEvents')}
      className="pointer-events-auto fixed bottom-[calc(var(--time-bar)+5.4rem)] left-1/2 z-20 hidden h-14 w-[min(40rem,calc(100vw-8rem))] -translate-x-1/2 rounded-2xl border border-violet-300/15 bg-black/58 px-5 py-2.5 shadow-lg shadow-black/25 backdrop-blur-xl md:block md:bottom-[10.5rem]"
    >
      <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-violet-200/55">
        <span>{t('calculatedEvents')}</span>
        <span>{t('eventHorizon')}</span>
      </div>
      <div className="relative mt-2 h-4 border-t border-violet-200/20">
        {events.map((event, index) => {
          const offset = Math.max(0, Math.min(100, ((event.date.getTime() - now.getTime()) / HORIZON_MS) * 100));
          const above = index % 2 === 0;
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => visit(event)}
              aria-label={t('visitEvent', { event: event.label, time: event.date.toISOString() })}
              title={`${event.label} · ${shortDate(event.date, language)} UTC`}
              className={`group absolute -translate-x-1/2 ${above ? '-top-[0.42rem]' : '-top-[0.1rem]'}`}
              style={{ left: `${offset}%` }}
            >
              <span className={`mx-auto block h-2.5 w-2.5 rounded-full border border-violet-100/70 bg-violet-300/70 shadow-[0_0_10px_rgba(196,181,253,0.75)] transition-transform group-hover:scale-125 ${above ? '' : 'mt-4'}`} />
              <span className={`pointer-events-none absolute left-1/2 whitespace-nowrap rounded-full border border-violet-200/20 bg-black/90 px-2 py-1 text-[8px] text-violet-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${above ? 'bottom-5 -translate-x-1/2' : 'top-7 -translate-x-1/2'}`}>
                {event.label} · {shortDate(event.date, language)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

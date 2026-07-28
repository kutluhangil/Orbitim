import { Orbit } from 'lucide-react';
import { ALL_BODIES, getBodyRecord } from '../lib/ephemeris/bodies';
import { useFlight } from '../flight/useFlight';
import { useViewSettings } from '../scene/viewSettings';
import { BodyDisc } from './BodyDisc';
import { localizedBodyName, useTranslation } from './i18n';

const ORDER = ['sun', 'mercury', 'venus', 'earth', 'mars', 'ceres', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;

/**
 * Compact world selector, parked immediately above the simulation clock.
 *
 * The real surface plates act as the symbols rather than a second list of
 * labels. Names appear on hover or keyboard focus; touch and screen-reader
 * users retain the explicit accessible label. Moons remain in their parent's
 * dossier so the system dock does not turn into a catalogue.
 */
export function BodyRail() {
  const target = useFlight((s) => s.target);
  const flyTo = useFlight((s) => s.flyTo);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const light = useViewSettings((s) => s.theme === 'light');
  const { language, t } = useTranslation();

  const surface = light
    ? 'border-slate-300/70 bg-white/78 shadow-slate-500/10'
    : 'border-white/12 bg-black/68 shadow-black/45';
  const idle = light
    ? 'text-slate-500 hover:bg-slate-900/6 hover:text-slate-900'
    : 'text-white/48 hover:bg-white/8 hover:text-white';
  const active = light
    ? 'bg-sky-500/12 text-sky-700 ring-sky-500/30'
    : 'bg-sky-300/12 text-sky-100 ring-sky-200/25';
  const tooltip = light
    ? 'border-slate-300/70 bg-white/92 text-slate-700 shadow-slate-500/20'
    : 'border-white/12 bg-black/88 text-white/80 shadow-black/50';

  return (
    <nav
      aria-label={t('solarSystem')}
      className={`pointer-events-auto fixed bottom-[calc(var(--time-bar)+0.5rem)] left-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-[43rem] -translate-x-1/2 rounded-[1.35rem] border shadow-2xl backdrop-blur-xl md:bottom-[5.5rem] md:rounded-full ${surface}`}
    >
      <ul className="flex snap-x snap-mandatory items-center gap-1 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] md:justify-center md:overflow-visible">
        <li className="snap-start">
          <button
            type="button"
            onClick={returnToOverview}
            aria-label={t('visitSystem')}
            aria-current={target === null ? 'page' : undefined}
            className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-transparent transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${
              target === null ? active : idle
            }`}
          >
            <Orbit className="h-5 w-5" strokeWidth={1.35} aria-hidden />
            <span className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100 ${tooltip}`}>
              {t('solarSystem')}
            </span>
          </button>
        </li>

        {ORDER.map((id) => {
          const record = getBodyRecord(id);
          const name = localizedBodyName(language, id, record.name);
          const isActive = target === id;
          return (
            <li key={id} className="snap-start">
              <button
                type="button"
                onClick={() => flyTo(id)}
                aria-label={t('visitBody', { body: name })}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-transparent transition-[background-color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${
                  isActive ? active : idle
                }`}
              >
                <BodyDisc
                  id={id}
                  className={`h-7 w-7 transition-[filter,transform] duration-200 group-hover:scale-110 ${
                    isActive ? 'brightness-110 saturate-110' : 'brightness-75 saturate-75 group-hover:brightness-100 group-hover:saturate-100'
                  }`}
                />
                <span className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100 ${tooltip}`}>
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <span className="sr-only">
        {t('liveEphemeris', { count: ALL_BODIES.length })}
      </span>
    </nav>
  );
}

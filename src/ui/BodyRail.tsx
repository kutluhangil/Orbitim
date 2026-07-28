import { type FocusEvent, type KeyboardEvent, useState } from 'react';
import { Orbit } from 'lucide-react';
import { ALL_BODIES, getBodyRecord, getMoonsOf, type BodyId } from '../lib/ephemeris/bodies';
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
 * users retain explicit accessible labels. A compact child dock opens only
 * for a world's rendered moons, keeping the primary rail focused on planets.
 */
export function BodyRail() {
  const target = useFlight((s) => s.target);
  const flyTo = useFlight((s) => s.flyTo);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const light = useViewSettings((s) => s.theme === 'light');
  const { language, t } = useTranslation();
  const [moonDockFor, setMoonDockFor] = useState<BodyId | null>(null);

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
  const moonDock = light
    ? 'border-slate-300/75 bg-white/94 text-slate-700 shadow-slate-500/25'
    : 'border-white/15 bg-black/92 text-white shadow-black/60';

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setMoonDockFor(null);
  };

  const closeMoonDock = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setMoonDockFor(null);
    }
  };

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
          const moons = getMoonsOf(id);
          const moonDockOpen = moonDockFor === id;
          return (
            <li
              key={id}
              className="relative snap-start"
              onMouseEnter={() => moons.length > 0 && setMoonDockFor(id)}
              onMouseLeave={() => setMoonDockFor(null)}
              onFocusCapture={() => moons.length > 0 && setMoonDockFor(id)}
              onBlur={closeWhenFocusLeaves}
            >
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

              {moons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMoonDockFor(id)}
                  aria-label={t('showMoons', { body: name })}
                  aria-expanded={moonDockOpen}
                  className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-0.5 font-mono text-[7px] leading-none transition-colors ${
                    moonDockOpen
                      ? 'border-sky-200/60 bg-sky-300/25 text-sky-50'
                      : light
                        ? 'border-slate-300 bg-white text-slate-500 hover:border-sky-400 hover:text-sky-700'
                        : 'border-white/25 bg-black/85 text-white/55 hover:border-sky-300/50 hover:text-sky-100'
                  }`}
                >
                  {moons.length}
                </button>
              )}

              {moons.length > 0 && moonDockOpen && (
                <div
                  role="group"
                  aria-label={t('moonsOf', { body: name })}
                  onKeyDown={closeMoonDock}
                  className={`pointer-events-auto absolute bottom-[calc(100%+0.85rem)] left-1/2 z-50 -translate-x-1/2 rounded-[1.15rem] border p-1.5 shadow-2xl backdrop-blur-xl ${moonDock}`}
                >
                  <span className={`absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r ${light ? 'border-slate-300 bg-white' : 'border-white/15 bg-black'}`} aria-hidden />
                  <span className={`mb-1 block px-2 pt-0.5 text-center text-[7px] uppercase tracking-[0.2em] ${light ? 'text-slate-400' : 'text-white/38'}`}>
                    {t('moonsOf', { body: name })}
                  </span>
                  <ul className="relative flex items-end gap-1">
                    {moons.map((moon) => {
                      const moonName = localizedBodyName(language, moon.id, moon.name);
                      const moonActive = target === moon.id;
                      return (
                        <li key={moon.id}>
                          <button
                            type="button"
                            onClick={() => {
                              flyTo(moon.id);
                              setMoonDockFor(null);
                            }}
                            aria-label={t('visitMoon', { moon: moonName })}
                            aria-current={moonActive ? 'page' : undefined}
                            className={`group/moon relative flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-[background-color,transform] duration-200 hover:-translate-y-1 hover:scale-110 focus-visible:-translate-y-1 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 ${
                              moonActive
                                ? light
                                  ? 'bg-sky-500/12 ring-sky-500/35'
                                  : 'bg-sky-300/15 ring-sky-200/35'
                                : 'ring-transparent'
                            }`}
                          >
                            <BodyDisc
                              id={moon.id}
                              className={`h-7 w-7 transition-[filter,transform] duration-200 group-hover/moon:brightness-110 group-hover/moon:saturate-110 ${
                                moonActive ? 'brightness-110 saturate-110' : 'brightness-80 saturate-75'
                              }`}
                            />
                            <span className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-1 text-[8px] uppercase tracking-[0.16em] opacity-0 shadow-lg transition-opacity group-hover/moon:opacity-100 group-focus-visible/moon:opacity-100 ${tooltip}`}>
                              {moonName}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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

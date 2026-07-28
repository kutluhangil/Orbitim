import { useEffect, useMemo, useState } from 'react';
import { ALL_BODIES } from '../lib/ephemeris/bodies';
import { auToKm, auToLightMinutes, getBodyState, getHeliocentric } from '../lib/ephemeris/positions';
import { translate, useLanguage, useTranslation, type AppLanguage } from './i18n';

interface LandingProps {
  onEnter: () => void;
}

/** Whether the visitor has asked the OS to keep motion to a minimum. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The brand mark: a hairline orbit tilted out of the plane with a dot riding it.
 * The dot follows the ellipse itself, so the mark is the product in miniature.
 * With reduced motion the dot simply rests on the orbit.
 */
function OrbitMark({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6 shrink-0" aria-hidden>
      <g transform="rotate(-23 50 50)">
        <ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.8" />
        {animate ? (
          <circle r="5" fill="#bae6fd">
            <animateMotion dur="6.5s" repeatCount="indefinite" path="M 10,50 a 40,15 0 1,1 80,0 a 40,15 0 1,1 -80,0" />
          </circle>
        ) : (
          <circle cx="12" cy="55" r="5" fill="#bae6fd" />
        )}
      </g>
    </svg>
  );
}

interface Reading {
  label: string;
  value: string;
  unit: string;
}

const AU_KM = 149597870.7;

/**
 * Orbital speed of a body right now, km/s, from a central difference of its
 * own ephemeris. Nothing here is tabulated: change the clock and the number
 * changes with it.
 */
function orbitalSpeedKmS(date: Date): number {
  const step = 60000;
  const before = getHeliocentric('earth', new Date(date.getTime() - step));
  const after = getHeliocentric('earth', new Date(date.getTime() + step));
  const distance = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) * AU_KM;
  return distance / ((2 * step) / 1000);
}

function readings(date: Date, language: AppLanguage): Reading[] {
  const mars = getBodyState('mars', date);
  const moon = getBodyState('moon', date);
  const sunLagMinutes = auToLightMinutes(getBodyState('sun', date).distanceFromEarthAU);

  return [
    {
      label: translate(language, 'universalTime'),
      value: date.toISOString().slice(11, 19),
      unit: 'UTC'
    },
    {
      label: translate(language, 'earthOrbitalSpeed'),
      value: orbitalSpeedKmS(date).toFixed(2),
      unit: 'km/s'
    },
    {
      label: translate(language, 'rangeToMars'),
      value: Math.round(auToKm(mars.distanceFromEarthAU) / 1e6).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US'),
      unit: translate(language, 'millionKm')
    },
    {
      label: translate(language, 'rangeToMoon'),
      value: Math.round(auToKm(moon.distanceFromEarthAU)).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US'),
      unit: 'km'
    },
    {
      label: translate(language, 'sunlightTransit'),
      value: sunLagMinutes.toFixed(1),
      unit: translate(language, 'minutesOld')
    }
  ];
}

function capabilities(language: AppLanguage) {
  return [
    { label: translate(language, 'ephemeris'), title: translate(language, 'positionsNotAnimations'), body: translate(language, 'ephemerisBody') },
    { label: translate(language, 'propagation'), title: translate(language, 'satellitesLive'), body: translate(language, 'propagationBody') },
    { label: translate(language, 'surfaces'), title: translate(language, 'surfaceTitle'), body: translate(language, 'surfaceBody') }
  ];
}

/**
 * Opening screen. It sits over the live scene rather than in front of a still
 * image, so the first thing a visitor sees is the thing itself. The scrim is
 * anchored to the left edge and thins out to the right: the readout stays
 * legible while the system keeps turning in plain view beside it.
 */
export function Landing({ onEnter }: LandingProps) {
  const [leaving, setLeaving] = useState(false);
  const [instant, setInstant] = useState(() => new Date());
  const reduced = usePrefersReducedMotion();
  const { language, t } = useTranslation();
  const setLanguage = useLanguage((state) => state.setLanguage);

  useEffect(() => {
    const timer = window.setInterval(() => setInstant(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const telemetry = useMemo(() => readings(instant, language), [instant, language]);
  const capabilitiesList = useMemo(() => capabilities(language), [language]);

  const leave = () => {
    setLeaving(true);
    window.setTimeout(onEnter, 700);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target === document.body) leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`pointer-events-auto fixed inset-0 z-30 overflow-y-auto transition-opacity duration-700 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Scrim. On a phone the type runs the full width, so the wash is vertical
          and the scene shows through the middle; from `md` it is anchored to the
          left edge and thins out to the right, past where the column ends. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black/95 md:bg-gradient-to-r md:from-black md:via-black/55 md:to-transparent"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden />

      {/* A faint scan behind the type, breaking the banding a flat black gradient
          leaves and reading as an instrument surface rather than a flat wash. */}
      <div
        className="scan-drift pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-soft-light"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)'
        }}
        aria-hidden
      />

      {/* Instrument registration marks at the corners, drawn in on entry. */}
      <div className="pointer-events-none absolute inset-4 hidden md:block" aria-hidden>
        <span className="hud-corner absolute left-0 top-0 h-5 w-5 border-l border-t border-sky-200/25" style={{ animationDelay: '500ms' }} />
        <span className="hud-corner absolute right-0 top-0 h-5 w-5 border-r border-t border-sky-200/25" style={{ animationDelay: '600ms' }} />
        <span className="hud-corner absolute bottom-0 left-0 h-5 w-5 border-b border-l border-sky-200/25" style={{ animationDelay: '700ms' }} />
        <span className="hud-corner absolute bottom-0 right-0 h-5 w-5 border-b border-r border-sky-200/25" style={{ animationDelay: '800ms' }} />
      </div>

      <div className="relative flex min-h-full flex-col gap-10 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] md:gap-12 md:px-14 md:py-12">
        <header className="rise flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="flex items-center gap-3">
            <OrbitMark animate={!reduced} />
            <span className="font-mono text-[12px] uppercase tracking-[0.5em] text-white">Orbitim</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden />
              {t('liveBodies', { count: ALL_BODIES.length })}
            </span>
            <div role="group" aria-label={t('changeLanguage')} className="flex rounded-full border border-white/10 bg-black/30 p-0.5">
              {(['en', 'tr'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLanguage(option)}
                  aria-pressed={language === option}
                  className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${
                    language === option ? 'bg-sky-300/15 text-sky-100' : 'text-white/35 hover:text-white/75'
                  }`}
                >
                  {option === 'en' ? 'EN' : 'TR'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex max-w-3xl flex-1 flex-col justify-center py-4 md:py-10">
          <p className="rise font-mono text-[10px] uppercase tracking-[0.34em] text-sky-300/70" style={{ animationDelay: '80ms' }}>
            {t('solarSystemObserved')}
          </p>

          <h1
            className="rise mt-4 text-balance text-[clamp(2rem,8.5vw,4.8rem)] font-extralight leading-[1.02] tracking-[-0.03em] text-white md:mt-5 md:leading-[0.98] md:tracking-[-0.035em]"
            style={{ animationDelay: '160ms' }}
          >
            {t('landingTitleLineOne')}
            <br />
            <span className="text-sky-200/90">{t('landingTitleLineTwo')}</span>
          </h1>

          <p
            className="rise mt-5 max-w-lg text-[14px] leading-relaxed text-white/55 md:mt-7 md:text-[15px]"
            style={{ animationDelay: '240ms' }}
          >
            {t('landingBody')}
          </p>

          <div
            className="rise mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 md:mt-10"
            style={{ animationDelay: '320ms' }}
          >
            <button
              type="button"
              onClick={leave}
              className="sweep relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full border border-sky-200/30 px-9 font-mono text-[11px] uppercase tracking-[0.3em] text-sky-100 transition-colors hover:border-sky-200/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 sm:h-auto sm:w-auto sm:py-3.5"
            >
              {t('enterSystem')}
            </button>
            {/* A keyboard hint is noise on a device without one. */}
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/25 sm:inline">
              {t('pressEnter')}
            </span>
          </div>
        </main>

        {/* Signature: a live instrument strip. Every figure is computed from the
            ephemeris on the second it is shown, including the ones that never
            appear in a fact sheet — the Earth's own speed around the Sun, and
            how old the sunlight reaching you is. */}
        <section aria-label={t('liveReadings')} className="rise" style={{ animationDelay: '400ms' }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-6 sm:pt-6 lg:grid-cols-5">
            {telemetry.map((reading) => (
              <div key={reading.label}>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/30">{reading.label}</div>
                <div className="mt-1.5 font-mono text-[18px] font-light tabular-nums text-white/90">
                  <span key={reading.value} className="value-flash inline-block">
                    {reading.value}
                  </span>
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-sky-300/50">{reading.unit}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 border-t border-white/8 pt-6 md:mt-8 md:grid-cols-3 md:gap-12 md:pt-7">
            {capabilitiesList.map((capability) => (
              <article key={capability.label}>
                <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-white/30">{capability.label}</span>
                <h2 className="mt-2 text-[15px] font-normal text-white/90">{capability.title}</h2>
                <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-white/40">{capability.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getBodyRecord, getMoonsOf } from '../lib/ephemeris/bodies';
import { auToKm, auToLightMinutes, getBodyState } from '../lib/ephemeris/positions';
import { BODY_FACTS } from '../data/bodyFacts';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { useIsCompact } from './useMediaQuery';
import { Row } from './Row';

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

/**
 * Body dossier. Static constants come from the fact sheet; the live block is
 * recomputed from the ephemeris once a second, and states plainly when a value
 * is undefined for the body rather than substituting a placeholder.
 *
 * On a phone it is a bottom sheet resting on the clock bar, collapsed to its
 * header by a tap: a dossier that covers half the screen is no use while flying
 * around the body it describes. From `md` up it is the fixed right-hand panel.
 */
export function InfoPanel() {
  const target = useFlight((s) => s.target);
  const phase = useFlight((s) => s.phase);
  const flyTo = useFlight((s) => s.flyTo);
  const compact = useIsCompact();
  const [open, setOpen] = useState(!compact);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Arriving somewhere shows the panel on a desktop, where it costs a column
  // nothing else wants, and only the header on a phone: the point of flying to
  // a world is seeing it, not reading half a screen of numbers over it.
  useEffect(() => setOpen(!compact), [target, compact]);

  if (!target || phase !== 'orbiting') return null;

  const record = getBodyRecord(target);
  const facts = BODY_FACTS[target];
  const state = getBodyState(target, useSimTime.getState().date);
  const moons = getMoonsOf(target);

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-[var(--time-bar)] z-20 rounded-t-2xl border-t border-white/10 bg-black/75 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:max-h-[80vh] md:w-[22rem] md:-translate-y-1/2 md:overflow-y-auto md:rounded-2xl md:border">
      {/* Sheet handle. Doubles as the collapsed state's only visible content, so
          the body's name is always on screen even when the panel is shut. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="relative flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left md:hidden"
      >
        <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/20" aria-hidden />
        <span className="flex-1">
          <span className="block text-[10px] uppercase tracking-[0.24em] text-sky-300/70">{record.kind}</span>
          <span className="block text-lg font-light tracking-tight text-white">{record.name}</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{open ? 'Hide' : 'Details'}</span>
      </button>

      <div
        className={`overscroll-contain px-4 pb-5 md:block md:max-h-none md:overflow-visible md:p-6 ${
          open ? 'max-h-[44dvh] overflow-y-auto [@media(max-height:480px)]:max-h-[52dvh]' : 'hidden'
        }`}
      >
        <header className="mb-5 hidden md:block">
          <span className="text-[10px] uppercase tracking-[0.28em] text-sky-300/70">{record.kind}</span>
          <h2 className="mt-1 text-2xl font-light tracking-tight text-white">{record.name}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">{facts.tagline}</p>
        </header>

        <p className="mb-4 text-[13px] leading-relaxed text-white/50 md:hidden">{facts.tagline}</p>

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Right now</h3>
          <dl>
            {target !== 'earth' && (
              <>
                <Row label="Distance from Earth" value={formatKm(auToKm(state.distanceFromEarthAU))} />
                <Row label="Light travel time" value={`${auToLightMinutes(state.distanceFromEarthAU).toFixed(1)} min`} />
              </>
            )}
            <Row label="Distance from Sun" value={formatKm(auToKm(state.distanceFromSunAU))} />
            <Row
              label="Apparent magnitude"
              value={state.magnitude === null ? 'not defined' : state.magnitude.toFixed(2)}
            />
            <Row
              label="Illuminated"
              value={state.phaseFraction === null ? 'not defined' : `${(state.phaseFraction * 100).toFixed(1)} %`}
            />
          </dl>
        </section>

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Fact sheet</h3>
          <dl>
            <Row label="Mean radius" value={formatKm(record.radiusKm)} />
            <Row label="Mass" value={facts.massKg} />
            <Row label="Surface gravity" value={facts.gravity} />
            <Row label="Mean temperature" value={facts.meanTemp} />
            <Row label="Axial tilt" value={`${record.axialTiltDeg}°`} />
            <Row label="Day length" value={facts.dayLength} />
            {facts.yearLength && <Row label="Orbital period" value={facts.yearLength} />}
            {facts.moons !== null && <Row label="Known moons" value={String(facts.moons)} />}
            <Row label="Atmosphere" value={facts.atmosphere} />
          </dl>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">Active missions</h3>
          <ul className="flex flex-wrap gap-1.5">
            {facts.activeMissions.map((mission) => (
              <li
                key={mission}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60"
              >
                {mission}
              </li>
            ))}
          </ul>
        </section>

        {moons.length > 0 && (
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">Moons in view</h3>
            <ul className="flex flex-wrap gap-2">
              {moons.map((moon) => (
                <li key={moon.id}>
                  <button
                    type="button"
                    onClick={() => flyTo(moon.id)}
                    className="flex h-10 items-center rounded-full border border-sky-300/20 px-3.5 text-[11px] text-sky-200/80 transition-colors hover:border-sky-300/50 hover:text-sky-100 md:h-auto md:px-2.5 md:py-1"
                  >
                    {moon.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-[10px] leading-relaxed text-white/25">
          Positions from VSOP87 via astronomy-engine. Constants from the NASA Planetary Fact Sheet.
        </p>
      </div>
    </aside>
  );
}

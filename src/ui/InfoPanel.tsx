import { useEffect, useState } from 'react';
import { getBodyRecord, getMoonsOf } from '../lib/ephemeris/bodies';
import { auToKm, auToLightMinutes, getBodyState } from '../lib/ephemeris/positions';
import { BODY_FACTS } from '../data/bodyFacts';
import { getExploration, type SiteKind, type SurfaceSite } from '../data/missions';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { useSiteSelection } from '../scene/siteSelection';
import { useIsCompact } from './useMediaQuery';
import { BodyDisc } from './BodyDisc';
import { Row } from './Row';

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatLightTravelTime(minutes: number): string {
  if (minutes < 1) return `${(minutes * 60).toFixed(1)} s`;
  return `${minutes.toFixed(1)} min`;
}

const SITE_KIND_LABELS: Record<SiteKind, string> = {
  crewed: 'Crewed landing',
  landing: 'Landing',
  rover: 'Rover',
  'sample-return': 'Sample return',
  impact: 'Impact',
  launch: 'Launch site'
};

/** The date the site was reached, read in UTC so it never shifts a day locally. */
function formatSiteDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/** Signed latitude and longitude in the hemisphere form a map is labelled in. */
function formatCoordinates(site: SurfaceSite): string {
  const lat = `${Math.abs(site.lat).toFixed(2)}° ${site.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(site.lon).toFixed(2)}° ${site.lon >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
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
  const selectedSiteId = useSiteSelection((s) => s.selected);
  const selectSite = useSiteSelection((s) => s.select);
  const clearSite = useSiteSelection((s) => s.clear);
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

  // Tapping a marker on the globe is a request to read about it, so the sheet
  // it is read in has to come up with it on a phone.
  useEffect(() => {
    if (selectedSiteId) setOpen(true);
  }, [selectedSiteId]);

  if (!target || phase !== 'orbiting') return null;

  const record = getBodyRecord(target);
  const facts = BODY_FACTS[target];
  const state = getBodyState(target, useSimTime.getState().date);
  const moons = getMoonsOf(target);
  const exploration = getExploration(target);
  const selectedSite = exploration?.sites.find((site) => site.id === selectedSiteId) ?? null;

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-[var(--system-dock)] z-20 rounded-t-2xl border-t border-white/10 bg-black/75 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:max-h-[80vh] md:w-[22rem] md:-translate-y-1/2 md:overflow-y-auto md:rounded-2xl md:border">
      {/* Sheet handle. Doubles as the collapsed state's only visible content, so
          the body's name is always on screen even when the panel is shut. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="relative flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left md:hidden"
      >
        <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/20" aria-hidden />
        <BodyDisc id={target} className="h-9 w-9" />
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
          <div className="flex items-center gap-4">
            <BodyDisc id={target} className="h-14 w-14" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-[0.28em] text-sky-300/70">{record.kind}</span>
              <h2 className="mt-1 text-2xl font-light tracking-tight text-white">{record.name}</h2>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">{facts.tagline}</p>
        </header>

        <p className="mb-4 text-[13px] leading-relaxed text-white/50 md:hidden">{facts.tagline}</p>

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Right now</h3>
          <dl>
            {target !== 'earth' && (
              <>
                <Row label="Distance from Earth" value={formatKm(auToKm(state.distanceFromEarthAU))} />
                <Row label="Light travel time" value={formatLightTravelTime(auToLightMinutes(state.distanceFromEarthAU))} />
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
            <Row label="Equatorial radius" value={formatKm(record.radiusKm)} />
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

        {exploration && (
          <section className="mb-5">
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">Exploration</h3>

            {selectedSite && (
              <article className="mb-3 rounded-xl border border-white/15 bg-white/[0.05] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-[13px] text-white">{selectedSite.name}</h4>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-sky-300/70">
                      {SITE_KIND_LABELS[selectedSite.kind]} · {selectedSite.agency}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSite}
                    className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-sky-200"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-white/60">{selectedSite.summary}</p>
                <dl className="mt-2">
                  <Row label="Date" value={formatSiteDate(selectedSite.date)} />
                  <Row label="Coordinates" value={formatCoordinates(selectedSite)} />
                </dl>
              </article>
            )}

            {exploration.sites.length > 0 && (
              /* The globe carries the same markers, but half of them are round
                 the far side at any moment; this reaches those too. */
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {exploration.sites.map((site) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => selectSite(site)}
                      aria-pressed={selectedSiteId === site.id}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        selectedSiteId === site.id
                          ? 'border-sky-300/50 text-sky-100'
                          : 'border-white/10 text-white/55 hover:border-white/30 hover:text-white/85'
                      }`}
                    >
                      {site.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <ol className="space-y-2.5">
              {exploration.milestones.map((milestone) => (
                <li key={`${milestone.year}-${milestone.name}`} className="flex gap-3">
                  <span className="w-8 shrink-0 pt-px font-mono text-[11px] tabular-nums text-white/30">
                    {milestone.year}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-white/80">
                      {milestone.name}
                      <span className="text-white/30"> · {milestone.agency}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">
                      {milestone.summary}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

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

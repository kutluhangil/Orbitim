import { useEffect, useState } from 'react';
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, type SatRec } from 'satellite.js';
import { useFlight } from '../flight/useFlight';
import { getSatelliteGroup } from '../scene/satelliteGroups';
import { useSatelliteSelection } from '../scene/satelliteSelection';
import { SGP4_EARTH_RADIUS_KM } from '../scene/satelliteFrame';
import { useSimTime } from '../scene/useSimTime';
import { useIsCompact } from './useMediaQuery';
import { Row } from './Row';

/** Julian date of the Unix epoch, for reading an element set's own timestamp. */
const JD_UNIX_EPOCH = 2440587.5;

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatLatitude(degrees: number): string {
  return `${Math.abs(degrees).toFixed(2)}° ${degrees >= 0 ? 'N' : 'S'}`;
}

function formatLongitude(degrees: number): string {
  return `${Math.abs(degrees).toFixed(2)}° ${degrees >= 0 ? 'E' : 'W'}`;
}

interface LiveState {
  altitudeKm: number;
  speedKmS: number;
  latitudeDeg: number;
  longitudeDeg: number;
}

/**
 * Propagates the element set for the instant being shown. Done here rather than
 * read from the scene, so the figures always belong to the satellite the panel
 * is naming — never to the one selected before it.
 */
function propagateFor(satrec: SatRec, date: Date): LiveState | null {
  const state = propagate(satrec, date);
  if (!state) return null;

  const geodetic = eciToGeodetic(state.position, gstime(date));
  return {
    altitudeKm: geodetic.height,
    speedKmS: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
    latitudeDeg: degreesLat(geodetic.latitude),
    longitudeDeg: degreesLong(geodetic.longitude)
  };
}

/**
 * Dossier for a single satellite. Every figure is propagated from the element
 * set on screen — nothing here is stored, interpolated or filled in — so the
 * panel also carries the age of that element set: a week-old TLE is a week-old
 * position, and saying so is part of the reading.
 *
 * It takes the same slot as the body dossier rather than sitting beside it: two
 * panels describing two things at once is how a phone screen disappears.
 */
export function SatelliteInfo() {
  const selected = useSatelliteSelection((s) => s.selected);
  const following = useSatelliteSelection((s) => s.following);
  const setFollowing = useSatelliteSelection((s) => s.setFollowing);
  const clear = useSatelliteSelection((s) => s.clear);
  const refocus = useFlight((s) => s.refocus);
  const compact = useIsCompact();
  const [open, setOpen] = useState(!compact);
  const [, setTick] = useState(0);

  // The propagated block moves every frame; a second is as often as a reader can
  // take a figure in, and re-rendering the panel at frame rate would cost more
  // than the scene it sits over.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => setOpen(!compact), [selected, compact]);

  if (!selected) return null;

  const { satrec, name } = selected.data;
  const group = getSatelliteGroup(selected.groupId);
  const date = useSimTime.getState().date;
  const live = propagateFor(satrec, date);
  const periodMinutes = (2 * Math.PI) / satrec.no;
  const epochMs = (satrec.jdsatepoch - JD_UNIX_EPOCH) * 86400000;
  const epochAgeDays = (date.getTime() - epochMs) / 86400000;

  const release = () => {
    clear();
    // The camera is a thousand kilometres off the planet's surface at this
    // point; leaving it there after the dossier closes would strand the view.
    if (following) refocus();
  };

  const toggleFollow = () => {
    setFollowing(!following);
    refocus();
  };

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-[var(--time-bar)] z-20 rounded-t-2xl border-t border-white/10 bg-black/75 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:max-h-[80vh] md:w-[22rem] md:-translate-y-1/2 md:overflow-y-auto md:rounded-2xl md:border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="relative flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left md:hidden"
      >
        <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/20" aria-hidden />
        <span className="flex-1">
          <span className="block text-[10px] uppercase tracking-[0.24em]" style={{ color: group.color }}>
            {group.name}
          </span>
          <span className="block truncate text-lg font-light tracking-tight text-white">{name}</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{open ? 'Hide' : 'Details'}</span>
      </button>

      <div
        className={`overscroll-contain px-4 pb-5 md:block md:max-h-none md:overflow-visible md:p-6 ${
          open ? 'max-h-[44dvh] overflow-y-auto [@media(max-height:480px)]:max-h-[52dvh]' : 'hidden'
        }`}
      >
        <header className="mb-5 hidden md:block">
          <span className="text-[10px] uppercase tracking-[0.28em]" style={{ color: group.color }}>
            {group.name}
          </span>
          <h2 className="mt-1 text-2xl font-light tracking-tight text-white">{name}</h2>
          <p className="mt-2 text-[13px] text-white/50">NORAD {satrec.satnum}</p>
        </header>

        {live ? (
          <section className="mb-5">
            <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Right now</h3>
            <dl>
              <Row label="Altitude" value={formatKm(live.altitudeKm)} />
              <Row label="Speed" value={`${live.speedKmS.toFixed(2)} km/s`} />
              <Row label="Latitude" value={formatLatitude(live.latitudeDeg)} />
              <Row label="Longitude" value={formatLongitude(live.longitudeDeg)} />
            </dl>
          </section>
        ) : (
          <p className="mb-5 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] leading-relaxed text-red-200/85">
            SGP4 returned error {satrec.error} for this element set at the instant on the clock — no position can be
            computed for it. The orbit below is what the element set itself states.
          </p>
        )}

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Orbit</h3>
          <dl>
            <Row label="Period" value={`${periodMinutes.toFixed(1)} min`} />
            <Row label="Inclination" value={`${((satrec.inclo * 180) / Math.PI).toFixed(2)}°`} />
            <Row label="Eccentricity" value={satrec.ecco.toFixed(5)} />
            <Row label="Apogee" value={formatKm(satrec.alta * SGP4_EARTH_RADIUS_KM)} />
            <Row label="Perigee" value={formatKm(satrec.altp * SGP4_EARTH_RADIUS_KM)} />
          </dl>
        </section>

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">Element set</h3>
          <dl>
            <Row label="NORAD id" value={satrec.satnum} />
            <Row label="Epoch" value={new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ')} />
            <Row label="Age at sim time" value={`${epochAgeDays.toFixed(2)} days`} />
          </dl>
        </section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleFollow}
            aria-pressed={following}
            className={`flex h-11 flex-1 items-center justify-center rounded-full border text-[11px] uppercase tracking-[0.2em] transition-colors md:h-10 ${
              following
                ? 'border-sky-300/60 bg-sky-300/10 text-sky-100'
                : 'border-sky-300/25 text-sky-200/80 hover:border-sky-300/50 hover:text-sky-100'
            }`}
          >
            {following ? 'Release' : 'Ride along'}
          </button>
          <button
            type="button"
            onClick={release}
            className="flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-[11px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:border-white/25 hover:text-white/80 md:h-10"
          >
            Close
          </button>
        </div>

        <p className="mt-6 text-[10px] leading-relaxed text-white/25">
          Position and velocity propagated with SGP4 from the CelesTrak element set above. Accuracy degrades with
          the age of that set.
        </p>
      </div>
    </aside>
  );
}

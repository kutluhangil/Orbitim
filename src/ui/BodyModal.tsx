import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getBodyRecord, getMoonsOf } from '../lib/ephemeris/bodies';
import { auToKm, auToLightMinutes, getBodyState } from '../lib/ephemeris/positions';
import { getTextureSet } from '../lib/textures/registry';
import { BODY_FACTS } from '../data/bodyFacts';
import { ATMOSPHERES } from '../scene/Atmosphere';
import { useSimTime } from '../scene/useSimTime';
import { useFlight } from '../flight/useFlight';
import { useBodyModal } from './bodyModalState';
import { Row } from './Row';

/**
 * Counts a figure up from zero when the card opens, so an arrival reads as a
 * readout settling rather than a page of static numbers. Snaps straight to the
 * value under a reduced-motion preference.
 */
function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / duration, 1);
      // Same ease as the card's own entrance, so the numbers land with it.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

/** Angular diameter of a body of the given radius seen from a distance, both km. */
function apparentDiameter(radiusKm: number, distanceKm: number): string {
  const arcsec = 2 * Math.atan(radiusKm / distanceKm) * (180 / Math.PI) * 3600;
  if (arcsec >= 60) return `${(arcsec / 60).toFixed(1)}′`;
  return `${arcsec.toFixed(1)}″`;
}

/**
 * The arrival dossier. A hero card raised over the scene the moment the camera
 * settles on a body: the body drawn as a lit disc, its live geometry counted up
 * from zero, then the full fact sheet. Closing it — the backdrop, the cross, or
 * Escape — drops it and leaves the live side panel behind, which is where the
 * numbers keep ticking from here on.
 */
export function BodyModal() {
  const bodyId = useBodyModal((s) => s.bodyId);
  const close = useBodyModal((s) => s.close);

  useEffect(() => {
    if (!bodyId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bodyId, close]);

  if (!bodyId) return null;
  return <Card key={bodyId} />;
}

function Card() {
  const bodyId = useBodyModal((s) => s.bodyId)!;
  const close = useBodyModal((s) => s.close);
  const flyTo = useFlight((s) => s.flyTo);

  const record = getBodyRecord(bodyId);
  const facts = BODY_FACTS[bodyId];
  const moons = getMoonsOf(bodyId);
  const atmosphere = ATMOSPHERES[bodyId];
  const textureUrl = getTextureSet(bodyId)?.map.far ?? null;

  // A single snapshot taken as the card opens: the panel behind it owns the live
  // ticking, so the hero can settle on the instant the camera arrived at.
  const snapshot = useRef(getBodyState(bodyId, useSimTime.getState().date)).current;
  const distanceEarthKm = auToKm(snapshot.distanceFromEarthAU);
  const distanceSunKm = auToKm(snapshot.distanceFromSunAU);

  const earthKm = useCountUp(distanceEarthKm);
  const lightMin = useCountUp(auToLightMinutes(snapshot.distanceFromEarthAU));
  const sunKm = useCountUp(distanceSunKm);

  const isEarth = bodyId === 'earth';
  const glow = atmosphere?.color ?? record.color;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dossier"
        onClick={close}
        className="modal-scrim-in absolute inset-0 cursor-default bg-black/70 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${record.name} dossier`}
        className="modal-in relative z-10 max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/12 bg-[#0a0d16]/92 shadow-2xl shadow-black/60 backdrop-blur-2xl [scrollbar-width:thin]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60 transition-colors hover:border-white/25 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="flex items-center gap-5 px-6 pb-5 pt-7 md:px-8">
          {/* The body as a lit disc: its albedo cropped to a circle, a shading
              overlay for the terminator, and a soft envelope in its own
              atmosphere colour. A body with no published map falls back to its
              registry colour rather than an empty hole. */}
          <div
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full md:h-24 md:w-24"
            style={{ boxShadow: `0 0 44px -6px ${glow}`, backgroundColor: record.color }}
          >
            {textureUrl && (
              <span
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${textureUrl})` }}
                aria-hidden
              />
            )}
            {/* Fake sphere: a highlight upper-left falling to a shadowed limb. */}
            <span
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 42%), radial-gradient(circle at 70% 74%, rgba(0,0,0,0.72), rgba(0,0,0,0) 60%)'
              }}
              aria-hidden
            />
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" aria-hidden />
          </div>

          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sky-300/70">{record.kind}</span>
            <h2 className="mt-1 truncate text-3xl font-extralight tracking-tight text-white md:text-4xl">
              {record.name}
            </h2>
          </div>
        </header>

        <div className="px-6 pb-7 md:px-8">
          <p className="mb-6 text-[13px] leading-relaxed text-white/55">{facts.tagline}</p>

          <section className="mb-6 grid grid-cols-3 gap-3">
            {!isEarth && (
              <Stat label="From Earth" value={formatKm(earthKm)} />
            )}
            {!isEarth && (
              <Stat label="Light time" value={`${lightMin.toFixed(1)} min`} />
            )}
            <Stat label="From Sun" value={formatKm(sunKm)} />
            {!isEarth && (
              <Stat label="Apparent size" value={apparentDiameter(record.radiusKm, distanceEarthKm)} />
            )}
          </section>

          <section className="mb-6">
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

          {facts.activeMissions.length > 0 && (
            <section className="mb-6">
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
          )}

          {moons.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">Moons</h3>
              <ul className="flex flex-wrap gap-2">
                {moons.map((moon) => (
                  <li key={moon.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        flyTo(moon.id);
                      }}
                      className="rounded-full border border-sky-300/20 px-3 py-1 text-[11px] text-sky-200/80 transition-colors hover:border-sky-300/50 hover:text-sky-100"
                    >
                      {moon.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="button"
            onClick={close}
            className="flex h-11 w-full items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 text-[12px] uppercase tracking-[0.22em] text-sky-100 transition-colors hover:border-sky-300/60 hover:bg-sky-300/15"
          >
            Explore
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-1 font-mono text-[13px] tabular-nums text-white/90">{value}</div>
    </div>
  );
}

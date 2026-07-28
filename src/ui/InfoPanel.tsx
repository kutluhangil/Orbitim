import { useEffect, useState } from 'react';
import { getBodyRecord, getMoonsOf } from '../lib/ephemeris/bodies';
import { getSolarIllumination } from '../lib/ephemeris/illumination';
import { auToKm, auToLightMinutes, getBodyState } from '../lib/ephemeris/positions';
import { BODY_FACTS } from '../data/bodyFacts';
import { getExploration } from '../data/missions';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from '../scene/useSimTime';
import { useViewSettings } from '../scene/viewSettings';
import { useSiteSelection } from '../scene/siteSelection';
import { useIsCompact } from './useMediaQuery';
import { BodyDisc } from './BodyDisc';
import { ObservationCard } from './ObservationCard';
import { Row } from './Row';
import { localizedBodyKind, localizedBodyName, useTranslation } from './i18n';

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatLightTravelTime(minutes: number): string {
  if (minutes < 1) return `${(minutes * 60).toFixed(1)} s`;
  return `${minutes.toFixed(1)} min`;
}

function formatSolarFlux(flux: number | null, notDefined: string, earth: string): string {
  if (flux === null) return notDefined;
  if (flux >= 0.1) return `${flux.toFixed(2)}× ${earth}`;
  return `${(flux * 100).toFixed(1)}% ${earth}`;
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
  const scientific = useViewSettings((s) => s.mode === 'scientific');
  const nowMode = useViewSettings((s) => s.mode === 'now');
  const [open, setOpen] = useState(!compact);
  const [, setTick] = useState(0);
  const { language, t } = useTranslation();

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
  const date = useSimTime.getState().date;
  const state = getBodyState(target, date);
  const illumination = getSolarIllumination(target, date);
  const moons = getMoonsOf(target);
  const exploration = getExploration(target);
  const name = localizedBodyName(language, target, record.name);
  const kind = localizedBodyKind(language, record.kind);

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
          <span className="block text-[10px] uppercase tracking-[0.24em] text-sky-300/70">{kind}</span>
          <span className="block text-lg font-light tracking-tight text-white">{name}</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{open ? t('hide') : t('details')}</span>
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
              <span className="text-[10px] uppercase tracking-[0.28em] text-sky-300/70">{kind}</span>
              <h2 className="mt-1 text-2xl font-light tracking-tight text-white">{name}</h2>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">{facts.tagline}</p>
        </header>

        <p className="mb-4 text-[13px] leading-relaxed text-white/50 md:hidden">{facts.tagline}</p>

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">{t('rightNow')}</h3>
          <dl>
            {target !== 'earth' && (
              <>
                <Row label={t('distanceFromEarth')} value={formatKm(auToKm(state.distanceFromEarthAU))} />
                <Row label={t('lightTravelTime')} value={formatLightTravelTime(auToLightMinutes(state.distanceFromEarthAU))} />
              </>
            )}
            <Row label={t('distanceFromSun')} value={formatKm(auToKm(state.distanceFromSunAU))} />
            <Row
              label={t('apparentMagnitude')}
              value={state.magnitude === null ? t('notDefined') : state.magnitude.toFixed(2)}
            />
            <Row
              label={t('illuminated')}
              value={state.phaseFraction === null ? t('notDefined') : `${(state.phaseFraction * 100).toFixed(1)} %`}
            />
          </dl>
        </section>

        {scientific && target !== 'sun' && (
          <section className="mb-5 border-y border-sky-300/10 py-4">
            <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-sky-200/60">{t('illumination')}</h3>
            <dl>
              <Row label={t('solarFlux')} value={formatSolarFlux(illumination.irradianceAtEarths, t('notDefined'), t('earthFlux'))} />
              <Row label={t('geometry')} value="CALCULATED · J2000" />
              <Row label={t('computedAt')} value={date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'} />
              <Row label={t('scale')} value={t('compressedDistances')} />
            </dl>
          </section>
        )}

        {scientific && target === 'mars' && (
          <section className="mb-5 border-y border-sky-300/10 py-4">
            <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-sky-200/60">{t('surfaceRelief')}</h3>
            <dl>
              <Row label={t('elevation')} value="MOLA · PDS" />
              <Row label={t('coverage')} value="Global · 16 px/degree" />
              <Row label={t('measurements')} value="MGS · 1999–2001" />
              <Row label={t('reliefScale')} value={t('physicalElevation')} />
            </dl>
          </section>
        )}

        {nowMode && (target === 'earth' || target === 'sun') && <ObservationCard target={target} />}

        <section className="mb-5">
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/30">{t('factSheet')}</h3>
          <dl>
            <Row label={t('equatorialRadius')} value={formatKm(record.radiusKm)} />
            <Row label={t('mass')} value={facts.massKg} />
            <Row label={t('surfaceGravity')} value={facts.gravity} />
            <Row label={t('meanTemperature')} value={facts.meanTemp} />
            <Row label={t('axialTilt')} value={`${record.axialTiltDeg}°`} />
            <Row label={t('dayLength')} value={facts.dayLength} />
            {facts.yearLength && <Row label={t('orbitalPeriod')} value={facts.yearLength} />}
            {facts.moons !== null && <Row label={t('knownMoons')} value={String(facts.moons)} />}
            <Row label={t('atmosphere')} value={facts.atmosphere} />
          </dl>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">{t('activeMissions')}</h3>
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
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">{t('exploration')}</h3>

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
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">{t('moonsInView')}</h3>
            <ul className="flex flex-wrap gap-2">
              {moons.map((moon) => (
                <li key={moon.id}>
                  <button
                    type="button"
                    onClick={() => flyTo(moon.id)}
                    className="flex h-10 items-center rounded-full border border-sky-300/20 px-3.5 text-[11px] text-sky-200/80 transition-colors hover:border-sky-300/50 hover:text-sky-100 md:h-auto md:px-2.5 md:py-1"
                  >
                    {localizedBodyName(language, moon.id, moon.name)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-[10px] leading-relaxed text-white/25">
          {t('sourceFootnote')}
        </p>
      </div>
    </aside>
  );
}

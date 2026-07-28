import { Fragment, useState } from 'react';
import { useFlight } from '../flight/useFlight';
import { ISS_NORAD_ID, SATELLITE_GROUPS, useSatelliteGroups } from '../scene/satelliteGroups';
import { useSatelliteSelection } from '../scene/satelliteSelection';
import { useIsCompact } from './useMediaQuery';
import { tleHealthLabel } from '../lib/dataHealth';
import { useTranslation } from './i18n';

/**
 * Constellation switchboard. Only meaningful while the camera is at Earth, so
 * it appears with the satellite layer itself and never competes with the system
 * view for space.
 *
 * The bottom of a phone screen already carries the dossier and the clock, so
 * here the switchboard collapses to a single chip below the body rail and opens
 * as a sheet over the dossier. On `md` and up it is the standing panel in the
 * bottom-left corner.
 */
export function SatellitePanel() {
  const target = useFlight((s) => s.target);
  const phase = useFlight((s) => s.phase);
  const enabled = useSatelliteGroups((s) => s.enabled);
  const sets = useSatelliteGroups((s) => s.sets);
  const health = useSatelliteGroups((s) => s.health);
  const toggle = useSatelliteGroups((s) => s.toggle);
  const compact = useIsCompact();
  // Shut until asked for, on both layouts: fourteen constellations is a taller
  // list than the corner it sits in, and open by default it lands on the body
  // rail on a desktop and on the dossier on a phone.
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useTranslation();
  const numberLocale = language === 'tr' ? 'tr-TR' : 'en-US';

  /**
   * Puts the camera on the station itself. The stations set is loaded on demand
   * rather than assumed present: the switchboard can be reached with the group
   * turned off, and the button has to work from there too.
   */
  const rideTheStation = async () => {
    const groups = useSatelliteGroups.getState();
    if (!groups.enabled.includes('stations')) groups.toggle('stations');

    try {
      const stations = await groups.load('stations');
      const iss = stations.find((item) => Number(item.satrec.satnum) === ISS_NORAD_ID);
      if (!iss) {
        setError(t('issMissing', { norad: ISS_NORAD_ID }));
        return;
      }

      setError(null);
      setOpen(false);
      const selection = useSatelliteSelection.getState();
      selection.select({ groupId: 'stations', data: iss });
      selection.setFollowing(true);
      useFlight.getState().refocus();
    } catch (cause) {
      setError(t('stationsLoadFailed', { error: cause instanceof Error ? cause.message : String(cause) }));
    }
  };

  if (target !== 'earth' || phase === 'overview') return null;

  const total = enabled.reduce((sum, id) => sum + (sets[id]?.length ?? 0), 0);
  const activeHealth = enabled.map((id) => health[id]).filter((value) => value !== undefined);
  const oldestActive = activeHealth.sort((a, b) => a.fetchedAt - b.fetchedAt)[0];
  const list = (
    <ul className="grid grid-cols-2 gap-x-2 px-2 pb-3 md:block md:max-h-[46vh] md:overflow-y-auto md:pb-2">
      {SATELLITE_GROUPS.map((group, index) => {
        const active = enabled.includes(group.id);
        const startsDebris = group.debris && !SATELLITE_GROUPS[index - 1]?.debris;
        return (
          <Fragment key={group.id}>
            {startsDebris && (
              <li className="col-span-2 mt-2 border-t border-white/8 px-2 pb-1 pt-2 text-[9px] uppercase tracking-[0.24em] text-white/25">
                {t('debrisClouds')}
              </li>
            )}
            <li>
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-pressed={active}
              className={`flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[11px] tracking-wide transition-colors md:h-auto md:py-1.5 ${
                active ? 'text-white/90' : 'text-white/35 hover:text-white/70'
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity"
                style={{ backgroundColor: group.color, opacity: active ? 1 : 0.25 }}
                aria-hidden
              />
              <span className="flex-1 truncate">{group.name}</span>
              {active && sets[group.id] !== undefined && (
                <span className="tabular-nums text-[10px] text-white/30">{sets[group.id].length}</span>
              )}
            </button>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );

  /* One named destination among fourteen anonymous swarms. It sits above the
     list because it is the thing most visitors came here for. */
  const station = (
    <div className="px-2 pb-3 pt-1 md:px-3">
      <button
        type="button"
        onClick={rideTheStation}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-sky-300/25 text-[11px] uppercase tracking-[0.2em] text-sky-200/80 transition-colors hover:border-sky-300/50 hover:text-sky-100 md:h-9"
      >
        {t('rideIss')}
      </button>
      {error && <p className="mt-2 text-[11px] leading-relaxed text-red-300/80">{error}</p>}
    </div>
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="satellite-sheet"
          className="pointer-events-auto fixed right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] z-30 flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 text-[10px] uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
          {t('satellites')}
          <span className="tabular-nums text-white/40">{total.toLocaleString(numberLocale)}</span>
        </button>

        {open && (
          <section
            id="satellite-sheet"
            aria-label={t('satellites')}
            className="pointer-events-auto fixed inset-x-0 bottom-[var(--system-dock)] z-40 max-h-[58dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/10 bg-black/85 backdrop-blur-xl"
          >
            <header className="sticky top-0 flex items-center justify-between border-b border-white/8 bg-black/60 px-4 py-3 backdrop-blur-xl">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                {t('satellites')} <span className="tabular-nums text-white/35">{total.toLocaleString(numberLocale)}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[10px] uppercase tracking-[0.2em] text-sky-200/80"
              >
                {t('close')}
              </button>
            </header>
            {station}
            {list}
          </section>
        )}
      </>
    );
  }

  return (
    <section
      aria-label={t('satellites')}
      /* Bottom left on desktop: the info panel owns the right column and the
         body rail ends above this, so the three never overlap. */
      className="pointer-events-auto fixed bottom-24 left-6 z-20 w-56 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-sky-200"
      >
        <span>{t('satellites')}</span>
        <span className="tabular-nums text-white/35">{total.toLocaleString(numberLocale)}</span>
      </button>

      {oldestActive && (
        <p className="px-4 pb-2 text-[9px] leading-relaxed text-white/30">{tleHealthLabel(oldestActive)}</p>
      )}

      {open && (
        <>
          {station}
          {list}
        </>
      )}
    </section>
  );
}

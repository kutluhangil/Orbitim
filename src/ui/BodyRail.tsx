import { ALL_BODIES, getBodyRecord } from '../lib/ephemeris/bodies';
import { useFlight } from '../flight/useFlight';
import { useViewSettings } from '../scene/viewSettings';

const ORDER = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;

/**
 * The only always-visible control.
 *
 * On a phone it is a scrollable strip across the top, on its own dimmed bar so
 * the names stay readable over whatever the scene puts behind them; each chip
 * snaps and is a full touch target. From `md` up it becomes the vertical rail
 * the desktop layout is built around. Moons are reached from their planet's
 * info panel rather than crowding either form.
 */
export function BodyRail() {
  const target = useFlight((s) => s.target);
  const flyTo = useFlight((s) => s.flyTo);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const light = useViewSettings((s) => s.theme === 'light');

  // On a phone the rail keeps its dark strip whatever the theme, so its text
  // stays light there; only from `md` up, where the rail is bare text over the
  // scene, does the light theme need dark text to be legible on the light field.
  const idle = light
    ? 'text-white/50 hover:text-white/85 md:text-slate-500 md:hover:text-slate-900'
    : 'text-white/50 hover:text-white/85';
  const active = light ? 'text-sky-200 md:text-sky-600' : 'text-sky-200';

  return (
    <nav
      aria-label="Solar system bodies"
      className="pointer-events-auto fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-gradient-to-b from-black/80 to-black/30 pt-[env(safe-area-inset-top)] backdrop-blur-md md:inset-x-auto md:left-6 md:top-1/2 md:border-0 md:bg-none md:pt-0 md:backdrop-blur-none md:-translate-y-1/2"
    >
      <ul className="flex snap-x snap-mandatory flex-row gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] md:snap-none md:flex-col md:overflow-visible md:px-0 md:py-0">
        <li className="snap-start">
          <button
            type="button"
            onClick={returnToOverview}
            className={`group flex h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-full px-3 text-left transition-colors md:h-auto md:gap-3 md:py-2 ${
              target === null ? active : idle
            }`}
          >
            <span className="h-px w-5 bg-current opacity-60 md:w-6" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] md:tracking-[0.22em]">Solar System</span>
          </button>
        </li>

        {ORDER.map((id) => {
          const record = getBodyRecord(id);
          const isActive = target === id;
          return (
            <li key={id} className="snap-start">
              <button
                type="button"
                onClick={() => flyTo(id)}
                aria-current={isActive ? 'true' : undefined}
                className={`group flex h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-full px-3 text-left transition-colors md:h-auto md:gap-3 md:py-2 ${
                  isActive ? `bg-white/8 md:bg-transparent ${active}` : idle
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform group-hover:scale-150"
                  style={{ backgroundColor: record.color }}
                  aria-hidden
                />
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] md:tracking-[0.22em]">
                  {record.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p
        className={`mt-4 hidden px-3 text-[10px] uppercase tracking-[0.18em] md:block ${
          light ? 'text-slate-400' : 'text-white/25'
        }`}
      >
        {ALL_BODIES.length} bodies · live ephemeris
      </p>
    </nav>
  );
}

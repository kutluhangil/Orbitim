import { Moon, Orbit, Sun, Waypoints } from 'lucide-react';
import { useViewSettings } from '../scene/viewSettings';
import { ShareLink } from './ShareLink';

/**
 * The top-right control cluster. Two view switches sit alongside the share
 * button: one drops the traced orbit lines when the field is too busy to read,
 * the other swaps the deep-space backdrop for a plain light one to see the
 * bodies against. The pills stay dark in both themes — they are instrument
 * chrome, legible over either backdrop.
 */
export function ViewControls() {
  const orbitsVisible = useViewSettings((s) => s.orbitsVisible);
  const toggleOrbits = useViewSettings((s) => s.toggleOrbits);
  const figuresVisible = useViewSettings((s) => s.figuresVisible);
  const toggleFigures = useViewSettings((s) => s.toggleFigures);
  const theme = useViewSettings((s) => s.theme);
  const toggleTheme = useViewSettings((s) => s.toggleTheme);

  const iconButton =
    'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border bg-black/70 backdrop-blur-xl transition-colors';

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex items-center gap-2 md:right-6 md:top-6">
      <button
        type="button"
        onClick={toggleOrbits}
        aria-pressed={orbitsVisible}
        title={orbitsVisible ? 'Hide orbit lines' : 'Show orbit lines'}
        aria-label={orbitsVisible ? 'Hide orbit lines' : 'Show orbit lines'}
        className={`${iconButton} ${
          orbitsVisible
            ? 'border-sky-300/40 text-sky-100'
            : 'border-white/10 text-white/45 hover:border-white/25 hover:text-white/80'
        }`}
      >
        <Orbit className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={toggleFigures}
        aria-pressed={figuresVisible}
        title={figuresVisible ? 'Hide constellations' : 'Show constellations'}
        aria-label={figuresVisible ? 'Hide constellations' : 'Show constellations'}
        className={`${iconButton} ${
          figuresVisible
            ? 'border-sky-300/40 text-sky-100'
            : 'border-white/10 text-white/45 hover:border-white/25 hover:text-white/80'
        }`}
      >
        <Waypoints className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className={`${iconButton} border-white/10 text-white/70 hover:border-sky-300/50 hover:text-sky-100`}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <ShareLink />
    </div>
  );
}

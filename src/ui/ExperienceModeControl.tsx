import { useViewSettings, type ExperienceMode } from '../scene/viewSettings';
import { useSimTime } from '../scene/useSimTime';

const MODES: readonly { id: ExperienceMode; label: string; description: string }[] = [
  { id: 'explore', label: 'Explore', description: 'Calm navigation view' },
  { id: 'scientific', label: 'Scientific', description: 'Calculated lighting and event evidence' },
  { id: 'now', label: 'Now', description: 'Return the simulation clock to current UTC' }
];

/**
 * The mode control changes the density of proof around the same scene, rather
 * than introducing a second dashboard. Scientific mode gives the terminator
 * room to read; Now is reserved for time-stamped observation layers.
 */
export function ExperienceModeControl() {
  const mode = useViewSettings((state) => state.mode);
  const setMode = useViewSettings((state) => state.setMode);

  const select = (next: ExperienceMode) => {
    setMode(next);
    if (next === 'now') useSimTime.getState().resetToNow();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Experience mode"
      className="pointer-events-auto fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex -translate-x-1/2 rounded-full border border-white/10 bg-black/70 p-1 shadow-lg shadow-black/30 backdrop-blur-xl md:top-6"
    >
      {MODES.map((item) => {
        const selected = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={item.description}
            onClick={() => select(item.id)}
            className={`min-h-9 rounded-full px-3 text-[9px] uppercase tracking-[0.16em] transition-colors sm:px-3.5 ${
              selected
                ? 'bg-sky-300/15 text-sky-100'
                : 'text-white/45 hover:text-white/80'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

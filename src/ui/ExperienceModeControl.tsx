import { useViewSettings, type ExperienceMode } from '../scene/viewSettings';
import { useSimTime } from '../scene/useSimTime';
import { useTranslation } from './i18n';

/**
 * The mode control changes the density of proof around the same scene, rather
 * than introducing a second dashboard. Scientific mode gives the terminator
 * room to read; Now is reserved for time-stamped observation layers.
 */
export function ExperienceModeControl() {
  const mode = useViewSettings((state) => state.mode);
  const setMode = useViewSettings((state) => state.setMode);
  const { t } = useTranslation();
  const modes: readonly { id: ExperienceMode; label: string; description: string }[] = [
    { id: 'explore', label: t('explore'), description: t('exploreDescription') },
    { id: 'scientific', label: t('scientific'), description: t('scientificDescription') },
    { id: 'now', label: t('now'), description: t('nowDescription') }
  ];

  const select = (next: ExperienceMode) => {
    setMode(next);
    if (next === 'now') {
      const time = useSimTime.getState();
      time.setMultiplier(1);
      time.setPlaying(true);
      time.resetToNow();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('experienceMode')}
      className="pointer-events-auto fixed left-[calc(50%+0.75rem)] top-[4.75rem] z-30 hidden -translate-x-1/2 rounded-full border border-white/10 bg-black/70 p-1 shadow-lg shadow-black/30 backdrop-blur-xl md:flex xl:left-1/2"
    >
      {modes.map((item) => {
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

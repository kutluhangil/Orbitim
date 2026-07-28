import { Moon, Orbit, Sun, Waypoints } from 'lucide-react';
import { useViewSettings } from '../scene/viewSettings';
import { ShareLink } from './ShareLink';
import { useLanguage, useTranslation } from './i18n';

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
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const { t } = useTranslation();

  const iconButton =
    'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border bg-black/70 backdrop-blur-xl transition-colors';

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex items-center gap-2 md:right-6 md:top-6">
      <button
        type="button"
        onClick={toggleOrbits}
        aria-pressed={orbitsVisible}
        title={orbitsVisible ? t('hideOrbits') : t('showOrbits')}
        aria-label={orbitsVisible ? t('hideOrbits') : t('showOrbits')}
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
        title={figuresVisible ? t('hideConstellations') : t('showConstellations')}
        aria-label={figuresVisible ? t('hideConstellations') : t('showConstellations')}
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
        title={theme === 'dark' ? t('switchLight') : t('switchDark')}
        aria-label={theme === 'dark' ? t('switchLight') : t('switchDark')}
        className={`${iconButton} border-white/10 text-white/70 hover:border-sky-300/50 hover:text-sky-100`}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div
        role="group"
        aria-label={t('changeLanguage')}
        className="pointer-events-auto flex h-10 items-center rounded-full border border-white/10 bg-black/70 p-1 backdrop-blur-xl"
      >
        {(['en', 'tr'] as const).map((option) => {
          const active = language === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setLanguage(option)}
              aria-pressed={active}
              title={option === 'en' ? t('english') : t('turkish')}
              className={`h-8 rounded-full px-2 text-[9px] uppercase tracking-[0.14em] transition-colors ${
                active ? 'bg-sky-300/16 text-sky-100' : 'text-white/42 hover:text-white/80'
              }`}
            >
              {option === 'en' ? 'EN' : 'TR'}
            </button>
          );
        })}
      </div>

      <ShareLink />
    </div>
  );
}

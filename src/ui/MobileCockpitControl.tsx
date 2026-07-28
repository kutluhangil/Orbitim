import { Languages, Moon, Orbit, PanelTopClose, SlidersHorizontal, Sun, Waypoints } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { type ExperienceMode, useViewSettings } from '../scene/viewSettings';
import { useSimTime } from '../scene/useSimTime';
import { ShareLink } from './ShareLink';
import { useLanguage, useTranslation } from './i18n';

/**
 * Mobile has one point of entry for scene controls so browser-safe-area chrome
 * cannot collide with the experience selector, share action or language switch.
 */
export function MobileCockpitControl() {
  const [open, setOpen] = useState(false);
  const mode = useViewSettings((state) => state.mode);
  const setMode = useViewSettings((state) => state.setMode);
  const orbitsVisible = useViewSettings((state) => state.orbitsVisible);
  const toggleOrbits = useViewSettings((state) => state.toggleOrbits);
  const figuresVisible = useViewSettings((state) => state.figuresVisible);
  const toggleFigures = useViewSettings((state) => state.toggleFigures);
  const theme = useViewSettings((state) => state.theme);
  const toggleTheme = useViewSettings((state) => state.toggleTheme);
  const language = useLanguage((state) => state.language);
  const setLanguage = useLanguage((state) => state.setLanguage);
  const { t } = useTranslation();

  const selectMode = (next: ExperienceMode) => {
    setMode(next);
    if (next === 'now') {
      const time = useSimTime.getState();
      time.setMultiplier(1);
      time.setPlaying(true);
      time.resetToNow();
    }
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') setOpen(false);
  };

  const actionClass =
    'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] text-white/55 transition-colors hover:border-sky-300/35 hover:text-sky-100';

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t('closeCockpit') : t('openCockpit')}
        aria-expanded={open}
        aria-controls="mobile-cockpit"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/75 text-sky-100 shadow-lg shadow-black/35 backdrop-blur-xl transition-colors hover:border-sky-300/45"
      >
        {open ? <PanelTopClose className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
      </button>

      {open && (
        <div
          id="mobile-cockpit"
          role="group"
          aria-label={t('cockpit')}
          onKeyDown={closeOnEscape}
          className="pointer-events-auto absolute right-0 top-14 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-white/12 bg-black/85 p-2.5 shadow-2xl shadow-black/55 backdrop-blur-2xl"
        >
          <div role="radiogroup" aria-label={t('experienceMode')} className="grid grid-cols-3 gap-1.5">
            {(['explore', 'scientific', 'now'] as const).map((id) => {
              const selected = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectMode(id)}
                  className={`min-h-11 rounded-xl px-1 text-[9px] uppercase tracking-[0.12em] transition-colors ${
                    selected
                      ? 'bg-sky-300/18 text-sky-100'
                      : 'border border-white/10 bg-white/[0.035] text-white/52 hover:text-white/85'
                  }`}
                >
                  {t(id)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={toggleOrbits}
              aria-pressed={orbitsVisible}
              aria-label={orbitsVisible ? t('hideOrbits') : t('showOrbits')}
              className={`${actionClass} ${orbitsVisible ? 'border-sky-300/35 text-sky-100' : ''}`}
            >
              <Orbit className="h-4 w-4" />
              <span className="text-[8px] uppercase tracking-[0.12em]">{t('orbits')}</span>
            </button>
            <button
              type="button"
              onClick={toggleFigures}
              aria-pressed={figuresVisible}
              aria-label={figuresVisible ? t('hideConstellations') : t('showConstellations')}
              className={`${actionClass} ${figuresVisible ? 'border-sky-300/35 text-sky-100' : ''}`}
            >
              <Waypoints className="h-4 w-4" />
              <span className="text-[8px] uppercase tracking-[0.12em]">{t('constellations')}</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('switchLight') : t('switchDark')}
              className={actionClass}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-[8px] uppercase tracking-[0.12em]">{t('appearance')}</span>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <div
              role="group"
              aria-label={t('changeLanguage')}
              className="flex h-10 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1"
            >
              <Languages className="ml-1 h-3.5 w-3.5 text-white/40" />
              {(['en', 'tr'] as const).map((option) => {
                const active = language === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLanguage(option)}
                    aria-pressed={active}
                    className={`h-8 rounded-lg px-2.5 text-[9px] uppercase tracking-[0.14em] transition-colors ${
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

          <p className="mt-2 px-1 text-[10px] leading-4 text-white/38">{t('cockpitHint')}</p>
        </div>
      )}
    </div>
  );
}

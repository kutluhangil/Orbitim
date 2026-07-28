import { useEffect, useState } from 'react';
import { useSimTime } from '../scene/useSimTime';
import { useViewSettings } from '../scene/viewSettings';

/**
 * Simulated seconds per real second. The low end is where rotation reads
 * correctly; the high end is where orbital motion does.
 */
const SPEEDS = [
  { label: 'Real', value: 1 },
  { label: '1 min/s', value: 60 },
  { label: '5 min/s', value: 300 },
  { label: '1 h/s', value: 3600 },
  { label: '1 d/s', value: 86400 },
  { label: '1 mo/s', value: 2592000 }
];

/**
 * Simulated clock. The scene is time-driven end to end, so scrubbing the
 * multiplier moves every body along its real orbit rather than animating a
 * decorative loop.
 *
 * On a phone this is a fixed bar at the foot of the screen — two rows, so the
 * timestamp never fights the speed buttons for width, and every target is a
 * comfortable thumb size. From `md` up it collapses into the floating pill the
 * desktop layout is built around.
 */
export function TimeControls() {
  const playing = useSimTime((s) => s.playing);
  const multiplier = useSimTime((s) => s.multiplier);
  const togglePlaying = useSimTime((s) => s.togglePlaying);
  const setMultiplier = useSimTime((s) => s.setMultiplier);
  const setPlaying = useSimTime((s) => s.setPlaying);
  const resetToNow = useSimTime((s) => s.resetToNow);
  const mode = useViewSettings((s) => s.mode);
  const setMode = useViewSettings((s) => s.setMode);
  const [stamp, setStamp] = useState('');

  useEffect(() => {
    const render = () => setStamp(useSimTime.getState().date.toISOString().replace('T', ' ').slice(0, 19));
    render();
    const timer = window.setInterval(render, 200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:inset-x-auto md:bottom-6 md:left-1/2 md:w-auto md:max-w-[calc(100vw-3rem)] md:-translate-x-1/2 md:rounded-full md:border md:px-5 md:py-2.5"
    >
      <div className="flex items-center justify-between gap-3 md:justify-start md:gap-4">
        <button
          type="button"
          onClick={() => {
            togglePlaying();
            if (mode === 'now') setMode('scientific');
          }}
          aria-label={playing ? 'Pause simulated time' : 'Resume simulated time'}
          className="-ml-1 flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[11px] uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-sky-200 md:ml-0 md:h-auto md:min-w-0 md:px-0 md:text-white/60"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <span className="flex-1 truncate text-center font-mono text-[12px] tabular-nums tracking-wide text-white/80 md:flex-none md:text-left">
          {stamp} UTC
        </span>

        {/* The speed row moves onto its own line below `md`, so it keeps the
            timestamp readable instead of pushing it off the edge. */}
        <div className="hidden shrink-0 items-center gap-1 overflow-x-auto [@media(max-height:480px)]:flex md:flex">
          <Speeds multiplier={multiplier} setMultiplier={setMultiplier} onChangeMode={() => mode === 'now' && setMode('scientific')} />
        </div>

        <button
          type="button"
          onClick={() => {
            setMultiplier(1);
            setPlaying(true);
            resetToNow();
            setMode('now');
          }}
          className="flex h-11 items-center rounded-full px-3 text-[10px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-sky-200 md:h-auto md:px-0 md:text-white/40"
        >
          Now
        </button>
      </div>

      <div className="mt-1 flex items-center gap-1 overflow-x-auto pb-0.5 [@media(max-height:480px)]:hidden md:hidden [scrollbar-width:none]">
        <Speeds multiplier={multiplier} setMultiplier={setMultiplier} onChangeMode={() => mode === 'now' && setMode('scientific')} />
      </div>
    </div>
  );
}

interface SpeedsProps {
  multiplier: number;
  setMultiplier: (value: number) => void;
  onChangeMode: () => void;
}

function Speeds({ multiplier, setMultiplier, onChangeMode }: SpeedsProps) {
  return (
    <>
      {SPEEDS.map((speed) => (
        <button
          key={speed.value}
          type="button"
          onClick={() => {
            setMultiplier(speed.value);
            if (speed.value !== 1) onChangeMode();
          }}
          aria-pressed={multiplier === speed.value}
          className={`shrink-0 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors md:px-2 md:py-1 ${
            multiplier === speed.value ? 'bg-sky-300/15 text-sky-200' : 'text-white/45 hover:text-white/80'
          }`}
        >
          {speed.label}
        </button>
      ))}
    </>
  );
}

import { create } from 'zustand';

interface SimTimeState {
  /** Simulated instant, advanced every frame while playing. */
  date: Date;
  playing: boolean;
  /** Simulated seconds per real second. */
  multiplier: number;
  advance: (realSeconds: number) => void;
  setDate: (date: Date) => void;
  setMultiplier: (multiplier: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  resetToNow: () => void;
}

export const useSimTime = create<SimTimeState>((set, get) => ({
  date: new Date(),
  playing: true,
  // The scene opens on the sky as it actually is, running at the rate it
  // actually runs: what a visitor sees first is the real system at this
  // instant, not a sped-up model of it. Every faster rate is one tap away.
  multiplier: 1,
  advance: (realSeconds) => {
    const { playing, multiplier, date } = get();
    if (!playing) return;
    set({ date: new Date(date.getTime() + realSeconds * multiplier * 1000) });
  },
  setDate: (date) => set({ date }),
  setMultiplier: (multiplier) => set({ multiplier }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  resetToNow: () => set({ date: new Date() })
}));

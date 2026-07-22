import { create } from 'zustand';

/**
 * Two view-level switches that change how the whole scene is drawn rather than
 * what it contains: whether the traced orbit lines are shown, and whether the
 * scene sits in space (dark) or on a plain light field for reading the bodies
 * against.
 */
export type Theme = 'dark' | 'light';

interface ViewSettingsState {
  /** Whether the planet, comet and minor-body orbit traces are drawn. */
  orbitsVisible: boolean;
  /** Whether the classical constellation figures joining the named stars are drawn. */
  figuresVisible: boolean;
  theme: Theme;
  toggleOrbits: () => void;
  toggleFigures: () => void;
  toggleTheme: () => void;
}

export const useViewSettings = create<ViewSettingsState>((set) => ({
  orbitsVisible: true,
  figuresVisible: true,
  theme: 'dark',
  toggleOrbits: () => set((s) => ({ orbitsVisible: !s.orbitsVisible })),
  toggleFigures: () => set((s) => ({ figuresVisible: !s.figuresVisible })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }))
}));

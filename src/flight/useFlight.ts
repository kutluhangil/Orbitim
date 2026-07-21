import { create } from 'zustand';
import type { BodyId } from '../lib/ephemeris/bodies';

export type FlightPhase = 'overview' | 'flying' | 'orbiting';

interface FlightState {
  phase: FlightPhase;
  /** Body the camera is heading to or already orbiting. */
  target: BodyId | null;
  /** Body the camera departed from, kept so the return leg reverses cleanly. */
  origin: BodyId | null;
  /** 0..1 along the current flight. */
  progress: number;
  flyTo: (id: BodyId) => void;
  refocus: () => void;
  returnToOverview: () => void;
  setProgress: (value: number) => void;
  arrive: () => void;
}

export const useFlight = create<FlightState>((set, get) => ({
  phase: 'overview',
  target: null,
  origin: null,
  progress: 0,
  flyTo: (id) => {
    if (get().target === id && get().phase !== 'overview') return;
    set({ phase: 'flying', target: id, origin: get().target, progress: 0 });
  },
  // Flies the current target again without changing it. The camera can be taken
  // off a body — to ride a satellite — and needs a way back to the body's own
  // framing that glides rather than cuts.
  refocus: () => {
    if (!get().target) return;
    set({ phase: 'flying', progress: 0 });
  },
  returnToOverview: () => set({ phase: 'flying', origin: get().target, target: null, progress: 0 }),
  setProgress: (value) => set({ progress: value }),
  arrive: () => set((s) => ({ phase: s.target ? 'orbiting' : 'overview', progress: 1 }))
}));

/** Level of detail a body should carry given the current flight state. */
export function lodFor(id: BodyId, phase: FlightPhase, target: BodyId | null): 'far' | 'near' {
  if (target !== id) return 'far';
  return phase === 'overview' ? 'far' : 'near';
}

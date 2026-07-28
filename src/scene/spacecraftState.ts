import { create } from 'zustand';
import { fetchHorizonsState } from '../services/horizons';
import type { SpacecraftLiveState } from '../data/spacecraft';

interface SpacecraftState {
  states: Record<string, SpacecraftLiveState>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  updatedAt: Date | null;
  error: string | null;
  refresh: (at: Date) => Promise<void>;
}

const TARGETS = ['voyager1', 'voyager2', 'newhorizons', 'parker', 'jwst'] as const;

export const useSpacecraftState = create<SpacecraftState>((set) => ({
  states: {},
  status: 'idle',
  updatedAt: null,
  error: null,
  refresh: async (at) => {
    set({ status: 'loading', error: null });
    try {
      const records = await Promise.all(TARGETS.map((target) => fetchHorizonsState(target, at)));
      set({
        states: Object.fromEntries(records.map((record) => [record.target, { epochMs: record.at.getTime(), position: record.position, source: record.source }])),
        status: 'ready', updatedAt: new Date(), error: null
      });
    } catch (cause) {
      set({ status: 'error', error: `JPL Horizons live states unavailable: ${cause instanceof Error ? cause.message : String(cause)}` });
      throw cause;
    }
  }
}));

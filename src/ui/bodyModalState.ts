import { create } from 'zustand';
import type { BodyId } from '../lib/ephemeris/bodies';

/**
 * The arrival dossier: a hero card that comes up once the camera settles on a
 * body, read before the live side panel behind it. Kept apart from the flight
 * store so closing the card leaves the flight untouched — the camera stays where
 * it arrived and the side panel carries on.
 */
interface BodyModalState {
  /** Body the card is showing, or null when nothing is open. */
  bodyId: BodyId | null;
  open: (id: BodyId) => void;
  close: () => void;
}

export const useBodyModal = create<BodyModalState>((set) => ({
  bodyId: null,
  open: (id) => set({ bodyId: id }),
  close: () => set({ bodyId: null })
}));

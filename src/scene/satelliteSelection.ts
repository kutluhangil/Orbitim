import * as THREE from 'three';
import { create } from 'zustand';
import type { SatelliteData } from '../services/tle';

export interface SelectedSatellite {
  /** Group the element set was loaded from, for the panel's colour and label. */
  groupId: string;
  data: SatelliteData;
}

interface SatelliteSelectionState {
  selected: SelectedSatellite | null;
  /** Camera rides with the selection instead of orbiting the planet. */
  following: boolean;
  select: (selection: SelectedSatellite) => void;
  clear: () => void;
  setFollowing: (value: boolean) => void;
}

export const useSatelliteSelection = create<SatelliteSelectionState>((set) => ({
  selected: null,
  following: false,
  // A new selection drops the camera back to the planet: following something
  // else while the panel describes this one reads as a bug.
  select: (selection) => set({ selected: selection, following: false }),
  clear: () => set({ selected: null, following: false }),
  setFollowing: (value) => set({ following: value })
}));

/**
 * Where the selected satellite is right now, written once per frame by the scene
 * and read by the camera rig. Deliberately outside the store: it changes every
 * frame and nothing should re-render on it.
 *
 * It carries a position and nothing else. Figures a reader looks at are derived
 * where they are shown, from the element set and the clock, so a panel can never
 * be caught displaying the last satellite's altitude next to this one's name.
 */
export interface SatelliteFocus {
  /** World position. Meaningless until `tracked` is true. */
  position: THREE.Vector3;
  /** Unit world-space direction of travel, for placing a chase camera behind it. */
  forward: THREE.Vector3;
  /** True once the current selection has been propagated at least once. */
  tracked: boolean;
}

export const satelliteFocus: SatelliteFocus = {
  position: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  tracked: false
};

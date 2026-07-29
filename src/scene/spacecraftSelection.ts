import * as THREE from 'three';
import { create } from 'zustand';

interface SpacecraftSelectionState {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
}

/**
 * Deep-space positions are written by their marker once per render frame and
 * read by the camera rig. Keeping the vectors here avoids a React update at
 * orbital-animation frequency while preserving the exact same position the
 * visible model occupies.
 */
const positions = new Map<string, THREE.Vector3>();

export function writeSpacecraftPosition(id: string, position: THREE.Vector3): void {
  const tracked = positions.get(id) ?? new THREE.Vector3();
  tracked.copy(position);
  positions.set(id, tracked);
}

export function readSpacecraftPosition(id: string): THREE.Vector3 | null {
  return positions.get(id) ?? null;
}

export const useSpacecraftSelection = create<SpacecraftSelectionState>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  clear: () => set({ selectedId: null })
}));

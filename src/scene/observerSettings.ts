import { create } from 'zustand';

export interface ObserverLocation {
  label: string;
  latitude: number;
  longitude: number;
  /** Elevation above mean sea level, metres. */
  elevationM: number;
}

export const OBSERVER_PRESETS: readonly ObserverLocation[] = [
  { label: 'Istanbul', latitude: 41.0082, longitude: 28.9784, elevationM: 39 },
  { label: 'London', latitude: 51.5072, longitude: -0.1276, elevationM: 35 },
  { label: 'New York', latitude: 40.7128, longitude: -74.006, elevationM: 10 },
  { label: 'Tokyo', latitude: 35.6762, longitude: 139.6503, elevationM: 40 },
  { label: 'Sydney', latitude: -33.8688, longitude: 151.2093, elevationM: 58 }
];

interface ObserverSettingsState {
  location: ObserverLocation;
  setLocation: (location: ObserverLocation) => void;
}

/**
 * A local observing site is deliberately separate from the solar-system camera:
 * it changes topocentric predictions, never the physical scene or shared link.
 */
export const useObserverSettings = create<ObserverSettingsState>((set) => ({
  location: OBSERVER_PRESETS[0],
  setLocation: (location) => set({ location })
}));

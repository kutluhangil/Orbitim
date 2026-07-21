import { create } from 'zustand';
import { fetchSatellitesByGroup, type SatelliteData } from '../services/tle';

/** NORAD catalogue number of the International Space Station. */
export const ISS_NORAD_ID = 25544;

export interface SatelliteGroup {
  /** CelesTrak group id, passed straight to the TLE service. */
  id: string;
  name: string;
  color: string;
  /** Loaded on the first approach to Earth without being asked for. */
  defaultOn: boolean;
}

/**
 * Constellations and object classes that can be drawn around Earth. Each entry
 * maps to one CelesTrak element set; nothing here is synthetic.
 */
export const SATELLITE_GROUPS: readonly SatelliteGroup[] = [
  { id: 'stations', name: 'Space stations', color: '#fbbf24', defaultOn: true },
  { id: 'starlink', name: 'Starlink', color: '#7dd3fc', defaultOn: true },
  { id: 'oneweb', name: 'OneWeb', color: '#c4b5fd', defaultOn: false },
  { id: 'gps', name: 'GPS', color: '#4ade80', defaultOn: true },
  { id: 'glonass', name: 'GLONASS', color: '#f87171', defaultOn: false },
  { id: 'galileo', name: 'Galileo', color: '#60a5fa', defaultOn: false },
  { id: 'beidou', name: 'BeiDou', color: '#fb923c', defaultOn: false },
  { id: 'iridium-NEXT', name: 'Iridium NEXT', color: '#a3e635', defaultOn: false },
  { id: 'geo', name: 'Geostationary', color: '#f0abfc', defaultOn: false },
  { id: 'weather', name: 'Weather', color: '#5eead4', defaultOn: false },
  { id: 'science', name: 'Science', color: '#e879f9', defaultOn: false },
  { id: 'resource', name: 'Earth observation', color: '#facc15', defaultOn: false },
  { id: 'brightest', name: 'Brightest', color: '#ffffff', defaultOn: false },
  { id: 'debris_iridium', name: 'Iridium 33 debris', color: '#94a3b8', defaultOn: false }
];

interface SatelliteState {
  /** Group ids currently drawn. */
  enabled: string[];
  /**
   * Element sets per loaded group. Shared rather than held by the drawing
   * component, so the UI can look a satellite up — the ISS, say — without the
   * layer being on screen.
   */
  sets: Record<string, SatelliteData[]>;
  toggle: (id: string) => void;
  load: (id: string) => Promise<SatelliteData[]>;
}

/** Requests in flight, so a group is never fetched twice concurrently. */
const pending = new Map<string, Promise<SatelliteData[]>>();

export const useSatelliteGroups = create<SatelliteState>((set, get) => ({
  enabled: SATELLITE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id),
  sets: {},
  toggle: (id) =>
    set((s) => ({
      enabled: s.enabled.includes(id) ? s.enabled.filter((g) => g !== id) : [...s.enabled, id]
    })),
  load: (id) => {
    const loaded = get().sets[id];
    if (loaded) return Promise.resolve(loaded);

    const inFlight = pending.get(id);
    if (inFlight) return inFlight;

    const request = fetchSatellitesByGroup(id).then(
      (result) => {
        pending.delete(id);
        set((s) => ({ sets: { ...s.sets, [id]: result.satellites } }));
        return result.satellites;
      },
      (error) => {
        pending.delete(id);
        throw error;
      }
    );
    pending.set(id, request);
    return request;
  }
}));

export function getSatelliteGroup(id: string): SatelliteGroup {
  const group = SATELLITE_GROUPS.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown satellite group: ${id}`);
  return group;
}

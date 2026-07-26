import { create } from 'zustand';
import { fetchSatellitesByGroup, type SatelliteData } from '../services/tle';
import type { TleHealth } from '../lib/dataHealth';

/** NORAD catalogue number of the International Space Station. */
export const ISS_NORAD_ID = 25544;

export interface SatelliteGroup {
  /** CelesTrak group id, passed straight to the TLE service. */
  id: string;
  name: string;
  color: string;
  /** Loaded on the first approach to Earth without being asked for. */
  defaultOn: boolean;
  /**
   * White silhouette sprite drawn in place of a bare point, from
   * `public/sprites/sat-<glyph>.webp`. Eight hardware classes cover fourteen
   * groups: the readable silhouette count at point size, not one per group.
   */
  glyph: string;
  /**
   * Representative hardware illustration for the dossier, from
   * `public/craft/<craft>.webp`. Not imagery of the selected object — one
   * drawing per class, labelled as such where it is shown.
   */
  craft: string;
  /** Whether this class is orbital debris rather than a working spacecraft. */
  debris?: boolean;
}

/**
 * Constellations and object classes that can be drawn around Earth. Each entry
 * maps to one CelesTrak element set; nothing here is synthetic. `glyph` and
 * `craft` name the shared illustration for the class, never a photo of the
 * individual object.
 */
export const SATELLITE_GROUPS: readonly SatelliteGroup[] = [
  { id: 'stations', name: 'Space stations', color: '#fbbf24', defaultOn: true, glyph: 'station', craft: 'iss' },
  { id: 'starlink', name: 'Starlink', color: '#7dd3fc', defaultOn: true, glyph: 'flatpack', craft: 'starlink' },
  { id: 'oneweb', name: 'OneWeb', color: '#c4b5fd', defaultOn: false, glyph: 'flatpack', craft: 'oneweb' },
  { id: 'gps', name: 'GPS', color: '#4ade80', defaultOn: true, glyph: 'gnss', craft: 'gps-iii' },
  { id: 'glonass', name: 'GLONASS', color: '#f87171', defaultOn: false, glyph: 'gnss', craft: 'gps-iii' },
  { id: 'galileo', name: 'Galileo', color: '#60a5fa', defaultOn: false, glyph: 'gnss', craft: 'gps-iii' },
  { id: 'beidou', name: 'BeiDou', color: '#fb923c', defaultOn: false, glyph: 'gnss', craft: 'gps-iii' },
  { id: 'iridium-NEXT', name: 'Iridium NEXT', color: '#a3e635', defaultOn: false, glyph: 'crosslink', craft: 'iridium-next' },
  { id: 'geo', name: 'Geostationary', color: '#f0abfc', defaultOn: false, glyph: 'geo', craft: 'geo-comsat' },
  { id: 'weather', name: 'Weather', color: '#5eead4', defaultOn: false, glyph: 'polar', craft: 'goes' },
  { id: 'science', name: 'Science', color: '#e879f9', defaultOn: false, glyph: 'observatory', craft: 'hubble' },
  { id: 'resource', name: 'Earth observation', color: '#facc15', defaultOn: false, glyph: 'polar', craft: 'sentinel' },
  { id: 'brightest', name: 'Brightest', color: '#ffffff', defaultOn: false, glyph: 'observatory', craft: 'upper-stage' },
  { id: 'debris_iridium', name: 'Iridium 33 debris', color: '#94a3b8', defaultOn: false, glyph: 'debris', craft: 'debris', debris: true },
  { id: 'debris_cosmos', name: 'Cosmos 2251 debris', color: '#cbd5e1', defaultOn: false, glyph: 'debris', craft: 'debris', debris: true },
  { id: 'debris_fengyun', name: 'Fengyun 1C debris', color: '#78716c', defaultOn: false, glyph: 'debris', craft: 'debris', debris: true },
  { id: 'debris_cosmos1408', name: 'Cosmos 1408 debris', color: '#64748b', defaultOn: false, glyph: 'debris', craft: 'debris', debris: true }
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
  /** Provenance retained alongside each set so prediction panels never imply live data. */
  health: Record<string, TleHealth>;
  toggle: (id: string) => void;
  load: (id: string) => Promise<SatelliteData[]>;
}

/** Requests in flight, so a group is never fetched twice concurrently. */
const pending = new Map<string, Promise<SatelliteData[]>>();

export const useSatelliteGroups = create<SatelliteState>((set, get) => ({
  enabled: SATELLITE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id),
  sets: {},
  health: {},
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
        const { satellites, ...health } = result;
        set((s) => ({
          sets: { ...s.sets, [id]: satellites },
          health: { ...s.health, [id]: health }
        }));
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

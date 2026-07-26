import { create } from 'zustand';
import type { SpaceWeatherSnapshot } from '../services/nasaDonki';

interface SolarActivityState {
  /** 0 is the quiet baseline; 1 is a bounded, high observed-activity response. */
  level: number;
  updatedAt: Date | null;
  /** Latest NOAA active-region notation, for the Sun's visible prominence. */
  sourceLocation: string | null;
  setSnapshot: (snapshot: SpaceWeatherSnapshot | null) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function flareStrength(classType: string | undefined): number {
  if (!classType) return 0;
  const match = /^([ABCMX])\s*(\d+(?:\.\d+)?)$/i.exec(classType.trim());
  if (!match) return 0;

  const base: Record<string, number> = { A: 0.02, B: 0.08, C: 0.22, M: 0.62, X: 0.9 };
  const magnitude = Number(match[2]);
  return clamp((base[match[1].toUpperCase()] ?? 0) + (magnitude / 10) * 0.1, 0, 1);
}

/**
 * Translates the latest observed NOAA/NASA event fields into a restrained
 * visual response. It is deliberately bounded: a solar flare does not make
 * the rest of the Solar System visibly brighter at this scale.
 */
export function solarActivityLevel(snapshot: SpaceWeatherSnapshot | null): number {
  if (!snapshot) return 0;

  const flare = flareStrength(snapshot.latestFlare?.classType);
  const cmeSpeed = snapshot.latestCme?.speedKmPerSecond;
  const cme = cmeSpeed === null || cmeSpeed === undefined ? 0 : clamp((cmeSpeed - 250) / 1750, 0, 1);
  const kp = snapshot.latestGeomagneticActivity?.peakKp;
  const geomagnetic = kp === null || kp === undefined ? 0 : clamp(kp / 9, 0, 1);

  return clamp(flare * 0.65 + cme * 0.25 + geomagnetic * 0.1, 0, 1);
}

export const useSolarActivity = create<SolarActivityState>((set) => ({
  level: 0,
  updatedAt: null,
  sourceLocation: null,
  setSnapshot: (snapshot) =>
    set({
      level: solarActivityLevel(snapshot),
      updatedAt: snapshot?.fetchedAt ?? null,
      sourceLocation: snapshot?.latestFlare?.sourceLocation ?? null
    })
}));

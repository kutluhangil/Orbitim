import { getBodyRecord, getMoonsOf, type BodyId } from './bodies';
import { getHeliocentric, type EquatorialVec } from './positions';

/** IAU 2012 exact astronomical unit in kilometres. */
export const AU_KM = 149597870.7;

/** Mean solar radius used by the angular-disc eclipse calculation. */
export const SUN_RADIUS_KM = 695700;

/** The renderer supports this many independent occulting discs per surface. */
export const MAX_SOLAR_OCCLUDERS = 4;

export interface SolarOccluder {
  id: BodyId;
  /** Heliocentric J2000 mean-equator coordinate, AU. */
  heliocentric: EquatorialVec;
  /** Measured mean radius in AU. */
  radiusAU: number;
}

export interface SolarIllumination {
  body: EquatorialVec;
  /** Physical distance from the body's centre to the Sun, AU. */
  distanceAU: number;
  /** Solar irradiance relative to the value received at Earth (1 AU). */
  irradianceAtEarths: number | null;
  /** Actual angular-disc candidates, not screen-space proxies. */
  occluders: SolarOccluder[];
}

/**
 * Bodies that can pass between a surface and the Sun. A moon can be eclipsed
 * by its parent; a planet can be eclipsed by its largest apparent moons.
 *
 * The ordering is deterministic and based on actual radius/orbit distance, so
 * fixed-size GPU arrays preserve the visually largest real shadow casters.
 */
export function solarOccludersFor(id: BodyId, limit = MAX_SOLAR_OCCLUDERS): BodyId[] {
  const record = getBodyRecord(id);
  if (record.kind === 'star') return [];
  if (record.kind === 'moon') return record.parent ? [record.parent] : [];

  return [...getMoonsOf(id)]
    .sort((a, b) => b.radiusKm / b.orbitRadiusKm! - a.radiusKm / a.orbitRadiusKm!)
    .slice(0, limit)
    .map((moon) => moon.id);
}

/**
 * Produces the physical-space illumination input for a body at one simulated
 * instant. Scene coordinates deliberately never enter this calculation: Orbitim
 * compresses them for navigation, while sunlight and eclipse geometry must
 * retain their real angular ratios.
 */
export function getSolarIllumination(id: BodyId, date: Date, limit = MAX_SOLAR_OCCLUDERS): SolarIllumination {
  const body = getHeliocentric(id, date);
  const distanceAU = Math.hypot(body.x, body.y, body.z);
  const occluders = solarOccludersFor(id, limit).map((occluderId) => {
    const record = getBodyRecord(occluderId);
    return {
      id: occluderId,
      heliocentric: getHeliocentric(occluderId, date),
      radiusAU: record.radiusKm / AU_KM
    };
  });

  return {
    body,
    distanceAU,
    irradianceAtEarths: distanceAU > 0 ? 1 / (distanceAU * distanceAU) : null,
    occluders
  };
}

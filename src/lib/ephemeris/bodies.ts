import { Body } from 'astronomy-engine';
import { elementsAtEpoch, type OrbitalElements } from './cometOrbit';

export type BodyId =
  | 'sun' | 'mercury' | 'venus' | 'earth' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
  | 'ceres' | 'pluto'
  | 'moon' | 'io' | 'europa' | 'ganymede' | 'callisto'
  | 'titan' | 'phobos' | 'deimos' | 'triton' | 'charon'
  | 'mimas' | 'enceladus' | 'rhea' | 'iapetus'
  | 'titania' | 'oberon' | 'miranda';

/** A dwarf planet renders as a full world but is not one of the eight planets. */
export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon';

export interface BodyRecord {
  id: BodyId;
  name: string;
  kind: BodyKind;
  /** astronomy-engine body, null for satellites handled by parent-relative models */
  engineBody: Body | null;
  /** parent body for moons */
  parent?: BodyId;
  /** equatorial radius, km */
  radiusKm: number;
  /** Polar radius in km where rotational flattening is visually significant. */
  polarRadiusKm?: number;
  /** Full long, intermediate and short axes in km for an appreciably irregular body. */
  shapeAxesKm?: readonly [number, number, number];
  /** obliquity of the rotation axis to its orbital plane, degrees */
  axialTiltDeg: number;
  /** sidereal rotation period, hours. Negative means retrograde. */
  rotationHours: number;
  /** mean orbital radius around the parent, km (moons only) */
  orbitRadiusKm?: number;
  /** sidereal orbital period around the parent, days (moons only) */
  orbitDays?: number;
  /** orbital inclination to the parent equator, degrees (moons only) */
  orbitInclinationDeg?: number;
  /** ring system inner/outer radius in body radii */
  rings?: { innerRadii: number; outerRadii: number };
  /**
   * Osculating heliocentric elements for element-propagated worlds — those with
   * no astronomy-engine theory and no parent (e.g. Ceres). Ignored when
   * {@link engineBody} is set.
   */
  elements?: OrbitalElements;
  /** UI accent colour */
  color: string;
}

const RECORDS: BodyRecord[] = [
  { id: 'sun', name: 'Sun', kind: 'star', engineBody: Body.Sun, radiusKm: 695700, axialTiltDeg: 7.25, rotationHours: 609.12, color: '#ffd27a' },
  { id: 'mercury', name: 'Mercury', kind: 'planet', engineBody: Body.Mercury, radiusKm: 2439.7, axialTiltDeg: 0.034, rotationHours: 1407.6, color: '#a8a29e' },
  { id: 'venus', name: 'Venus', kind: 'planet', engineBody: Body.Venus, radiusKm: 6051.8, axialTiltDeg: 177.36, rotationHours: -5832.5, color: '#e7c68a' },
  { id: 'earth', name: 'Earth', kind: 'planet', engineBody: Body.Earth, radiusKm: 6378.1, polarRadiusKm: 6356.8, axialTiltDeg: 23.44, rotationHours: 23.9345, color: '#6fb3e0' },
  { id: 'mars', name: 'Mars', kind: 'planet', engineBody: Body.Mars, radiusKm: 3396.2, polarRadiusKm: 3376.2, axialTiltDeg: 25.19, rotationHours: 24.6229, color: '#d1603d' },

  // Ceres orbits within the asteroid belt; a dwarf planet carried by its real
  // heliocentric elements rather than a shipped theory.
  { id: 'ceres', name: 'Ceres', kind: 'dwarf', engineBody: null, radiusKm: 469.7, axialTiltDeg: 4, rotationHours: 9.074, elements: elementsAtEpoch({ semiMajorAU: 2.7658, eccentricity: 0.0785, inclinationDeg: 10.593, ascendingNodeDeg: 80.393, argPerihelionDeg: 73.597, meanAnomalyDeg: 287.42 }), color: '#9a9086' },

  // Juno radio occultations published in 2026 narrowed Jupiter's equatorial
  // radius by 4 km from the previous adopted figure. The polar figure retains
  // the same reference level until the full revised ellipsoid is standardized.
  { id: 'jupiter', name: 'Jupiter', kind: 'planet', engineBody: Body.Jupiter, radiusKm: 71488, polarRadiusKm: 66854, axialTiltDeg: 3.13, rotationHours: 9.925, color: '#d9a066' },
  { id: 'saturn', name: 'Saturn', kind: 'planet', engineBody: Body.Saturn, radiusKm: 60268, polarRadiusKm: 54364, axialTiltDeg: 26.73, rotationHours: 10.656, rings: { innerRadii: 1.24, outerRadii: 2.27 }, color: '#e3d1a0' },
  // NASA's named system runs from the diffuse Zeta ring to the faint outer Mu
  // ring. The renderer resolves each named structure rather than filling the
  // whole span with a solid disc.
  { id: 'uranus', name: 'Uranus', kind: 'planet', engineBody: Body.Uranus, radiusKm: 25559, polarRadiusKm: 24973, axialTiltDeg: 97.77, rotationHours: -17.24, rings: { innerRadii: 1.40, outerRadii: 3.98 }, color: '#9fd8e0' },
  { id: 'neptune', name: 'Neptune', kind: 'planet', engineBody: Body.Neptune, radiusKm: 24764, polarRadiusKm: 24341, axialTiltDeg: 28.32, rotationHours: 16.11, color: '#5b7fe0' },

  // Pluto has an astronomy-engine theory; its moon Charon follows in the moon
  // block below (parent must precede child for the position update).
  { id: 'pluto', name: 'Pluto', kind: 'dwarf', engineBody: Body.Pluto, radiusKm: 1188.3, axialTiltDeg: 122.53, rotationHours: -153.2928, color: '#c8a884' },

  { id: 'moon', name: 'Moon', kind: 'moon', engineBody: Body.Moon, parent: 'earth', radiusKm: 1737.4, axialTiltDeg: 6.68, rotationHours: 655.72, orbitRadiusKm: 384400, orbitDays: 27.3217, orbitInclinationDeg: 5.145, color: '#cfcfcf' },

  { id: 'io', name: 'Io', kind: 'moon', engineBody: null, parent: 'jupiter', radiusKm: 1821.6, axialTiltDeg: 0, rotationHours: 42.46, orbitRadiusKm: 421700, orbitDays: 1.769, orbitInclinationDeg: 0.05, color: '#e8d16a' },
  { id: 'europa', name: 'Europa', kind: 'moon', engineBody: null, parent: 'jupiter', radiusKm: 1560.8, axialTiltDeg: 0, rotationHours: 85.22, orbitRadiusKm: 671100, orbitDays: 3.551, orbitInclinationDeg: 0.47, color: '#d8cbb0' },
  { id: 'ganymede', name: 'Ganymede', kind: 'moon', engineBody: null, parent: 'jupiter', radiusKm: 2634.1, axialTiltDeg: 0, rotationHours: 171.7, orbitRadiusKm: 1070400, orbitDays: 7.155, orbitInclinationDeg: 0.2, color: '#a89f92' },
  { id: 'callisto', name: 'Callisto', kind: 'moon', engineBody: null, parent: 'jupiter', radiusKm: 2410.3, axialTiltDeg: 0, rotationHours: 400.5, orbitRadiusKm: 1882700, orbitDays: 16.689, orbitInclinationDeg: 0.19, color: '#7a6f63' },
  { id: 'titan', name: 'Titan', kind: 'moon', engineBody: null, parent: 'saturn', radiusKm: 2574.7, axialTiltDeg: 0, rotationHours: 382.7, orbitRadiusKm: 1221870, orbitDays: 15.945, orbitInclinationDeg: 0.33, color: '#e0a95c' },
  // NASA's measured full axes make the Martian moons visibly lumpy; a sphere
  // would overstate both their symmetry and their apparent eclipse silhouettes.
  { id: 'phobos', name: 'Phobos', kind: 'moon', engineBody: null, parent: 'mars', radiusKm: 11.27, shapeAxesKm: [27, 22, 18], axialTiltDeg: 0, rotationHours: 7.65, orbitRadiusKm: 9376, orbitDays: 0.3189, orbitInclinationDeg: 1.08, color: '#8a7f74' },
  { id: 'deimos', name: 'Deimos', kind: 'moon', engineBody: null, parent: 'mars', radiusKm: 6.2, shapeAxesKm: [15, 12, 11], axialTiltDeg: 0, rotationHours: 30.31, orbitRadiusKm: 23463, orbitDays: 1.2624, orbitInclinationDeg: 1.79, color: '#9a8f84' },
  { id: 'triton', name: 'Triton', kind: 'moon', engineBody: null, parent: 'neptune', radiusKm: 1353.4, axialTiltDeg: 0, rotationHours: -141.0, orbitRadiusKm: 354759, orbitDays: -5.877, orbitInclinationDeg: 156.9, color: '#c9d6d6' },
  { id: 'charon', name: 'Charon', kind: 'moon', engineBody: null, parent: 'pluto', radiusKm: 606, axialTiltDeg: 0, rotationHours: -153.2928, orbitRadiusKm: 19596, orbitDays: 6.3872, orbitInclinationDeg: 0.08, color: '#b7afa4' },

  { id: 'mimas', name: 'Mimas', kind: 'moon', engineBody: null, parent: 'saturn', radiusKm: 198.2, axialTiltDeg: 0, rotationHours: 22.618, orbitRadiusKm: 185540, orbitDays: 0.9424, orbitInclinationDeg: 1.57, color: '#c8c8cc' },
  { id: 'enceladus', name: 'Enceladus', kind: 'moon', engineBody: null, parent: 'saturn', radiusKm: 252.1, axialTiltDeg: 0, rotationHours: 32.885, orbitRadiusKm: 238040, orbitDays: 1.3702, orbitInclinationDeg: 0.01, color: '#eef4f5' },
  { id: 'rhea', name: 'Rhea', kind: 'moon', engineBody: null, parent: 'saturn', radiusKm: 763.8, axialTiltDeg: 0, rotationHours: 108.437, orbitRadiusKm: 527110, orbitDays: 4.5182, orbitInclinationDeg: 0.32, color: '#c4c2be' },
  { id: 'iapetus', name: 'Iapetus', kind: 'moon', engineBody: null, parent: 'saturn', radiusKm: 734.5, axialTiltDeg: 0, rotationHours: 1903.7, orbitRadiusKm: 3560840, orbitDays: 79.3215, orbitInclinationDeg: 15.47, color: '#9a8a72' },

  { id: 'titania', name: 'Titania', kind: 'moon', engineBody: null, parent: 'uranus', radiusKm: 788.4, axialTiltDeg: 0, rotationHours: 208.941, orbitRadiusKm: 436300, orbitDays: 8.7059, orbitInclinationDeg: 0.34, color: '#a9a29a' },
  { id: 'oberon', name: 'Oberon', kind: 'moon', engineBody: null, parent: 'uranus', radiusKm: 761.4, axialTiltDeg: 0, rotationHours: 323.118, orbitRadiusKm: 583500, orbitDays: 13.4632, orbitInclinationDeg: 0.1, color: '#9c948c' },
  { id: 'miranda', name: 'Miranda', kind: 'moon', engineBody: null, parent: 'uranus', radiusKm: 235.8, axialTiltDeg: 0, rotationHours: 33.923, orbitRadiusKm: 129900, orbitDays: 1.4135, orbitInclinationDeg: 4.34, color: '#a8a8ac' }
];

const BY_ID = new Map<BodyId, BodyRecord>(RECORDS.map((r) => [r.id, r]));

export const ALL_BODIES: readonly BodyRecord[] = RECORDS;
export const PLANETS: readonly BodyRecord[] = RECORDS.filter((r) => r.kind === 'planet');

export function getBodyRecord(id: BodyId): BodyRecord {
  const record = BY_ID.get(id);
  if (!record) throw new Error(`Unknown body id: ${id}`);
  return record;
}

export function getMoonsOf(id: BodyId): readonly BodyRecord[] {
  return RECORDS.filter((r) => r.parent === id);
}

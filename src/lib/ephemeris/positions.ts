import { HelioVector, GeoVector, JupiterMoons, Illumination, MakeTime, Body } from 'astronomy-engine';
import { getBodyRecord, type BodyId } from './bodies';
import { laplaceMoonDirection, laplaceMoonVectorKm } from './moonElements';
import { propagateElements } from './cometOrbit';

/** Right-handed J2000 mean-equator (EQJ) vector, astronomical units. */
export interface EquatorialVec {
  x: number;
  y: number;
  z: number;
}

export interface BodyState {
  id: BodyId;
  /** Position relative to the Sun, in the EQJ frame, AU. */
  heliocentric: EquatorialVec;
  /** Position relative to Earth, AU. Zero-length for Earth itself. */
  geocentric: EquatorialVec;
  /** Distance from Earth, AU. */
  distanceFromEarthAU: number;
  /** Distance from the Sun, AU. */
  distanceFromSunAU: number;
  /** Apparent visual magnitude as seen from Earth, or null when undefined for the body. */
  magnitude: number | null;
  /** Illuminated fraction of the disc, 0..1, or null when undefined. */
  phaseFraction: number | null;
}

const AU_KM = 149597870.7;
const LIGHT_SECONDS_PER_AU = 499.004784;

function length(v: EquatorialVec): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * Heliocentric position of a moon, derived from its parent plus a circular
 * parent-relative model. astronomy-engine only ships full theories for the Moon
 * and the Galilean satellites; the remaining moons use their mean orbital
 * elements, which is accurate enough at the scene scales used here.
 */
function moonHeliocentric(id: BodyId, date: Date): EquatorialVec {
  const record = getBodyRecord(id);
  if (!record.parent) throw new Error(`Body ${id} declared as moon without a parent`);
  const parent = getHeliocentric(getBodyRecord(record.parent).id, date);

  if (record.id === 'moon') {
    const geo = GeoVector(Body.Moon, MakeTime(date), true);
    return { x: parent.x + geo.x, y: parent.y + geo.y, z: parent.z + geo.z };
  }

  if (record.parent === 'jupiter' && (id === 'io' || id === 'europa' || id === 'ganymede' || id === 'callisto')) {
    const moon = JupiterMoons(MakeTime(date))[id];
    return { x: parent.x + moon.x, y: parent.y + moon.y, z: parent.z + moon.z };
  }

  const laplace = laplaceMoonVectorKm(id, date);
  if (laplace) {
    return {
      x: parent.x + laplace.x / AU_KM,
      y: parent.y + laplace.y / AU_KM,
      z: parent.z + laplace.z / AU_KM
    };
  }

  const orbitDays = record.orbitDays!;
  const radiusAU = record.orbitRadiusKm! / AU_KM;
  const inclination = (record.orbitInclinationDeg! * Math.PI) / 180;
  const angle = (date.getTime() / 86400000 / orbitDays) * 2 * Math.PI;

  const x = radiusAU * Math.cos(angle);
  const yFlat = radiusAU * Math.sin(angle);
  return {
    x: parent.x + x,
    y: parent.y + yFlat * Math.cos(inclination),
    z: parent.z + yFlat * Math.sin(inclination)
  };
}

function heliocentricOf(id: BodyId, date: Date): EquatorialVec {
  const record = getBodyRecord(id);
  if (record.id === 'sun') return { x: 0, y: 0, z: 0 };
  if (record.kind === 'moon') return moonHeliocentric(id, date);
  if (record.engineBody) {
    const v = HelioVector(record.engineBody, MakeTime(date));
    return { x: v.x, y: v.y, z: v.z };
  }
  // A world with no shipped theory (e.g. Ceres) is propagated from its own
  // osculating elements, in the same EQJ frame HelioVector returns.
  if (record.elements) return propagateElements(record.elements, date);
  throw new Error(`Body ${id} has no ephemeris source`);
}

/**
 * Single-instant memo. The scene asks for the same instant many times per frame
 * — once per body, plus once more per moon for its parent — and a VSOP87
 * evaluation is far too expensive to repeat for an answer already computed.
 */
const positionCache = new Map<BodyId, { ms: number; value: EquatorialVec }>();

/**
 * Heliocentric position only, without the illumination and geometry work
 * {@link getBodyState} does. This is the per-frame path: the scene needs
 * every body's position every frame and none of the derived readouts.
 */
export function getHeliocentric(id: BodyId, date: Date): EquatorialVec {
  const ms = date.getTime();
  const cached = positionCache.get(id);
  if (cached && cached.ms === ms) return cached.value;
  const value = heliocentricOf(id, date);
  positionCache.set(id, { ms, value });
  return value;
}

/** Sole astronomy entry point for the scene. Never returns three.js types. */
export function getBodyState(id: BodyId, date: Date): BodyState {
  const heliocentric = getHeliocentric(id, date);
  const earth = getHeliocentric('earth', date);
  const geocentric = {
    x: heliocentric.x - earth.x,
    y: heliocentric.y - earth.y,
    z: heliocentric.z - earth.z
  };

  let magnitude: number | null = null;
  let phaseFraction: number | null = null;
  const record = getBodyRecord(id);
  if (record.engineBody && record.id !== 'earth') {
    try {
      const info = Illumination(record.engineBody, MakeTime(date));
      magnitude = info.mag;
      phaseFraction = info.phase_fraction;
    } catch {
      // Illumination is undefined for some bodies; leave the fields null rather
      // than inventing a value.
      magnitude = null;
      phaseFraction = null;
    }
  }

  return {
    id,
    heliocentric,
    geocentric,
    distanceFromEarthAU: length(geocentric),
    distanceFromSunAU: length(heliocentric),
    magnitude,
    phaseFraction
  };
}

/**
 * Real parent-relative direction to a moon, as a unit vector in the same
 * equatorial-of-J2000 frame the body positions live in. astronomy-engine ships
 * a full theory for Earth's Moon and the four Galileans, so those return their
 * true instantaneous bearing — the moon genuinely swaps sides of its planet as
 * it does through a telescope. The remaining major moons come from JPL mean
 * elements (see {@link laplaceMoonDirection}); both paths share the EQJ frame.
 * Moons with neither source return null and the caller falls back to a mean
 * circular model.
 */
export function moonDirection(id: BodyId, date: Date): EquatorialVec | null {
  const record = getBodyRecord(id);
  if (record.id === 'moon') {
    const g = GeoVector(Body.Moon, MakeTime(date), true);
    return unit({ x: g.x, y: g.y, z: g.z });
  }
  if (record.parent === 'jupiter' && (id === 'io' || id === 'europa' || id === 'ganymede' || id === 'callisto')) {
    const s = JupiterMoons(MakeTime(date))[id];
    return unit({ x: s.x, y: s.y, z: s.z });
  }
  return laplaceMoonDirection(id, date);
}

function unit(v: EquatorialVec): EquatorialVec {
  const len = length(v);
  if (len === 0) throw new Error('Cannot normalise a zero-length direction vector');
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function auToKm(au: number): number {
  return au * AU_KM;
}

export function auToLightMinutes(au: number): number {
  return (au * LIGHT_SECONDS_PER_AU) / 60;
}

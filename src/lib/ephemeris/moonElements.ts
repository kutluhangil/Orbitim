import type { BodyId } from './bodies';

/**
 * Analytic positions for the major moons astronomy-engine ships no theory for.
 *
 * astronomy-engine carries full theories only for Earth's Moon and the four
 * Galileans. Every other moon previously fell back to a mean circular orbit
 * whose absolute longitude was anchored to nothing — the phase was invented, so
 * the moon sat on an arbitrary side of its planet.
 *
 * This module replaces that invented phase with JPL's mean orbital elements
 * (ssd.jpl.nasa.gov/sats/elem), epoch 2000-Jan-1.5 TDB, each referred to the
 * moon's local Laplace plane. Propagating the mean anomaly from the epoch and
 * rotating the Laplace-plane orbit into the J2000 mean equator (EQJ) — the same
 * frame astronomy-engine's vectors use — puts every moon on its true
 * instantaneous bearing: it swaps sides of its planet exactly as it does
 * through a telescope, and agrees with the Galileans' shipped theory in kind.
 *
 * Accuracy is arc-minute class near the epoch, degrading by a fraction of a
 * degree per decade as the neglected short-period terms accumulate. Against the
 * scene's compressed moon radius that error is far below a pixel; what it buys
 * is a real phase in place of a fabricated one.
 */

/** Mean orbital elements referred to a moon's local Laplace plane. */
interface LaplaceElements {
  /** Semi-major axis, km. Kept for provenance; the bearing needs only ratios. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Inclination to the Laplace plane, degrees. >90 for retrograde orbits. */
  iDeg: number;
  /**
   * Longitude of the ascending node on the Laplace plane, degrees, measured
   * from the ascending node of the Laplace plane on the EQJ equator.
   */
  nodeDeg: number;
  /** Argument of periapsis in the orbit plane, degrees. */
  argpDeg: number;
  /** Mean anomaly at epoch, degrees. */
  mDeg: number;
  /** Sidereal orbital period, days. Always positive; retrograde comes from iDeg. */
  periodDays: number;
  /** Nodal regression period, years (0 = no modelled node motion). */
  nodePeriodYears: number;
  /** Apsidal precession period, years (0 = no modelled apse motion). */
  apsePeriodYears: number;
  /** Laplace plane pole right ascension, EQJ, degrees. */
  poleRaDeg: number;
  /** Laplace plane pole declination, EQJ, degrees. */
  poleDecDeg: number;
}

/**
 * Osculating elements at epoch 2000-Jan-1.5 TDB, referred to each moon's local
 * Laplace plane. The angular elements were derived from JPL Horizons geometric
 * state vectors at the epoch — far tighter than the rounded mean-element tables,
 * and validated back against Horizons to under 0.06° over the following days,
 * Triton's retrograde motion included. Precession periods are the JPL SSD mean
 * values; prograde satellites regress their node and advance their apse (the
 * oblate-primary secular convention applied below). Periods are magnitudes;
 * retrograde motion comes from iDeg > 90.
 */
const ELEMENTS: Partial<Record<BodyId, LaplaceElements>> = {
  phobos: { a: 9371.9, e: 0.01541, iDeg: 1.0598, nodeDeg: 170.1135, argpDeg: 215.6771, mDeg: 189.3686, periodDays: 0.3187, nodePeriodYears: 2.3, apsePeriodYears: 1.1, poleRaDeg: 317.7, poleDecDeg: 52.9 },
  deimos: { a: 23457.9, e: 0.00032, iDeg: 1.7913, nodeDeg: 55.7624, argpDeg: 198.3430, mDeg: 5.2871, periodDays: 1.2625, nodePeriodYears: 56.2, apsePeriodYears: 0.0, poleRaDeg: 316.6, poleDecDeg: 53.5 },
  titan: { a: 1221863, e: 0.02866, iDeg: 0.3315, nodeDeg: 25.4020, argpDeg: 182.8480, mDeg: 163.4697, periodDays: 15.945448, nodePeriodYears: 687.37, apsePeriodYears: 346.68, poleRaDeg: 36.4, poleDecDeg: 84.0 },
  triton: { a: 354763.5, e: 0.00014, iDeg: 157.1725, nodeDeg: 176.7718, argpDeg: 75.1043, mDeg: 342.6295, periodDays: 5.876994, nodePeriodYears: 340.379, apsePeriodYears: 0.0, poleRaDeg: 299.8, poleDecDeg: 43.1 },
  // Charon on Pluto's equatorial (Laplace) plane. A tidally locked binary, so
  // its orbit is stable — no modelled node or apse precession.
  charon: { a: 19595.8, e: 0.00016, iDeg: 0.0841, nodeDeg: 9.4425, argpDeg: 146.1497, mDeg: 148.5287, periodDays: 6.38723, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 132.993, poleDecDeg: -6.163 },

  // Saturn's mid-sized moons, referred to Saturn's equatorial pole. Iapetus is
  // far enough out that its true Laplace plane is tilted toward Saturn's orbit;
  // referring it to the equator keeps the epoch exact and drifts only slowly.
  mimas: { a: 185536.5, e: 0.01974, iDeg: 1.5708, nodeDeg: 172.9984, argpDeg: 333.1763, mDeg: 42.1585, periodDays: 0.9424218, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 40.589, poleDecDeg: 83.537 },
  enceladus: { a: 238037.1, e: 0.00477, iDeg: 0.0098, nodeDeg: 309.0791, argpDeg: 224.0118, mDeg: 9.2926, periodDays: 1.370218, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 40.589, poleDecDeg: 83.537 },
  rhea: { a: 527107.2, e: 0.00101, iDeg: 0.3186, nodeDeg: 346.1671, argpDeg: 224.8876, mDeg: 201.1158, periodDays: 4.518212, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 40.589, poleDecDeg: 83.537 },
  iapetus: { a: 3560863.4, e: 0.0283, iDeg: 15.4701, nodeDeg: 253.5208, argpDeg: 348.8122, mDeg: 207.5624, periodDays: 79.3215, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 40.589, poleDecDeg: 83.537 },

  // Uranus's major moons, referred to Uranus's pole. Uranus spins retrograde, so
  // the orbit normal sits opposite the pole and the inclinations read near 180°.
  titania: { a: 436280.1, e: 0.00247, iDeg: 179.8993, nodeDeg: 11.4364, argpDeg: 37.9731, mDeg: 75.0594, periodDays: 8.705872, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 257.311, poleDecDeg: -15.175 },
  oberon: { a: 583457.1, e: 0.00058, iDeg: 179.812, nodeDeg: 319.9562, argpDeg: 23.2305, mDeg: 109.2725, periodDays: 13.463239, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 257.311, poleDecDeg: -15.175 },
  miranda: { a: 129847.6, e: 0.00143, iDeg: 175.5722, nodeDeg: 259.1713, argpDeg: 338.0947, mDeg: 68.6402, periodDays: 1.413479, nodePeriodYears: 0, apsePeriodYears: 0, poleRaDeg: 257.311, poleDecDeg: -15.175 }
};

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;
/** 2000-Jan-1.5 (JD 2451545.0), the element epoch. TT/UTC offset is left out. */
const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAYS_PER_YEAR = 365.25;

/** Solves Kepler's equation M = E − e·sinE for the eccentric anomaly, radians. */
function eccentricAnomaly(meanAnomaly: number, e: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Unit direction from a planet to one of its moons, in the J2000 mean equator
 * (EQJ) frame — the frame every position in the scene lives in. Returns null
 * for moons without tabulated elements, so the caller can fall back.
 */
export function laplaceMoonDirection(id: BodyId, date: Date): Vec3 | null {
  const vector = laplaceMoonVectorKm(id, date);
  return vector ? normalize(vector) : null;
}

/**
 * Parent-relative position from the mean-element model, in kilometres and EQJ.
 * The direction drives the compressed scene while the magnitude is retained for
 * the live distance readouts, avoiding the former unrelated circular model.
 */
export function laplaceMoonVectorKm(id: BodyId, date: Date): Vec3 | null {
  const el = ELEMENTS[id];
  if (!el) return null;

  const days = (date.getTime() - EPOCH_MS) / 86400000;
  const years = days / DAYS_PER_YEAR;

  const meanAnomaly = (el.mDeg + (360 / el.periodDays) * days) * DEG;
  const node = (el.nodeDeg - secularDeg(el.nodePeriodYears, years)) * DEG;
  const argp = (el.argpDeg + secularDeg(el.apsePeriodYears, years)) * DEG;
  const inc = el.iDeg * DEG;

  const E = eccentricAnomaly(meanAnomaly, el.e);
  // Perifocal position (units of a; only its direction survives normalisation).
  const xPer = Math.cos(E) - el.e;
  const yPer = Math.sqrt(1 - el.e * el.e) * Math.sin(E);

  // Rz(node) · Rx(inc) · Rz(argp) applied to the perifocal position, giving a
  // vector in the Laplace-plane basis (x = plane's ascending node on the EQJ
  // equator, z = Laplace pole).
  const cw = Math.cos(argp), sw = Math.sin(argp);
  const cO = Math.cos(node), sO = Math.sin(node);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const x1 = xPer * cw - yPer * sw;
  const y1 = xPer * sw + yPer * cw;
  const px = x1 * cO - y1 * ci * sO;
  const py = x1 * sO + y1 * ci * cO;
  const pz = y1 * si;

  // Laplace-plane basis expressed in EQJ.
  const dec = el.poleDecDeg * DEG, ra = el.poleRaDeg * DEG;
  const pole: Vec3 = { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
  // Ascending node of the Laplace plane on the EQJ equator: ẑ × pole.
  const nodeAxis = normalize({ x: -pole.y, y: pole.x, z: 0 });
  const yAxis = cross(pole, nodeAxis);

  return {
    x: el.a * (px * nodeAxis.x + py * yAxis.x + pz * pole.x),
    y: el.a * (px * nodeAxis.y + py * yAxis.y + pz * pole.y),
    z: el.a * (px * nodeAxis.z + py * yAxis.z + pz * pole.z)
  };
}

/** Secular angle travelled since epoch, degrees. Prograde node/apse convention. */
function secularDeg(periodYears: number, years: number): number {
  if (periodYears === 0) return 0;
  return (360 / periodYears) * years;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len === 0) throw new Error('Cannot normalise a zero-length direction vector');
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

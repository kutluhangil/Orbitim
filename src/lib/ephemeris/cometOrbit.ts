import type { EquatorialVec } from './positions';

/**
 * Two-body Kepler propagation for small bodies given by their osculating
 * orbital elements, for objects astronomy-engine ships no theory for.
 *
 * The elements are the classical set referenced to the J2000 ecliptic, the form
 * the JPL Small-Body Database and the Minor Planet Center publish. The result is
 * rotated into the same J2000 mean-equator frame astronomy-engine's HelioVector
 * returns, so a comet and a planet computed on the same instant share one frame
 * and their conjunctions stay truthful.
 *
 * This is an unperturbed two-body model: it ignores planetary perturbations and
 * non-gravitational outgassing forces, so it drifts from a comet's true path
 * over many revolutions. At the scene's log-compressed scale that error is far
 * below a pixel for the span a visitor scrubs across.
 */

/** Obliquity of the J2000 ecliptic, radians. */
const OBLIQUITY = (23.439291 * Math.PI) / 180;
const COS_OBLIQUITY = Math.cos(OBLIQUITY);
const SIN_OBLIQUITY = Math.sin(OBLIQUITY);

/** Days in a Julian year — the Gaussian year used with a in AU. */
const YEAR_DAYS = 365.25;
const DEG = Math.PI / 180;
const DAY_MS = 86400000;

export interface OrbitalElements {
  /** Perihelion distance q, AU. */
  perihelionAU: number;
  /** Eccentricity. Elliptical only (< 1). */
  eccentricity: number;
  /** Inclination to the ecliptic, degrees. */
  inclinationDeg: number;
  /** Longitude of the ascending node Ω, degrees. */
  ascendingNodeDeg: number;
  /** Argument of perihelion ω, degrees. */
  argPerihelionDeg: number;
  /** Time of perihelion passage, epoch milliseconds. */
  perihelionEpochMs: number;
}

/** Semi-major axis from perihelion distance and eccentricity, AU. */
export function semiMajorAxisAU(el: OrbitalElements): number {
  return el.perihelionAU / (1 - el.eccentricity);
}

/** Sidereal period from the semi-major axis, days (Kepler's third law). */
export function orbitalPeriodDays(el: OrbitalElements): number {
  return YEAR_DAYS * Math.pow(semiMajorAxisAU(el), 1.5);
}

/** Noon TT, 1 January 2000 — the J2000 epoch, epoch milliseconds. */
export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/**
 * Builds the propagator's element form from the mean-anomaly-at-epoch set the
 * minor-planet catalogues publish (a, e, i, Ω, ω, M at an epoch), by solving for
 * the time of perihelion passage the propagator wants. Defaults to the J2000
 * epoch, which is what the standard osculating element sets are referenced to.
 */
export function elementsAtEpoch(input: {
  semiMajorAU: number;
  eccentricity: number;
  inclinationDeg: number;
  ascendingNodeDeg: number;
  argPerihelionDeg: number;
  meanAnomalyDeg: number;
  epochMs?: number;
}): OrbitalElements {
  const epoch = input.epochMs ?? J2000_EPOCH_MS;
  const base: OrbitalElements = {
    perihelionAU: input.semiMajorAU * (1 - input.eccentricity),
    eccentricity: input.eccentricity,
    inclinationDeg: input.inclinationDeg,
    ascendingNodeDeg: input.ascendingNodeDeg,
    argPerihelionDeg: input.argPerihelionDeg,
    perihelionEpochMs: 0
  };
  const n = (2 * Math.PI) / orbitalPeriodDays(base);
  base.perihelionEpochMs = epoch - ((input.meanAnomalyDeg * DEG) / n) * DAY_MS;
  return base;
}

/** Solve Kepler's equation E − e·sinE = M for the eccentric anomaly. */
function eccentricAnomaly(meanAnomaly: number, e: number): number {
  // Wrap into (−π, π] so a highly eccentric orbit starts Newton near the root.
  let m = meanAnomaly % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;

  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let i = 0; i < 60; i++) {
    const delta = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return E;
}

/**
 * Perifocal-plane coordinates into the J2000 mean-equator frame the scene's
 * planet positions already live in, so a comet shares one frame with them.
 */
function perifocalToEquatorial(xOrb: number, yOrb: number, el: OrbitalElements): EquatorialVec {
  const i = el.inclinationDeg * DEG;
  const node = el.ascendingNodeDeg * DEG;
  const argp = el.argPerihelionDeg * DEG;
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosArg = Math.cos(argp);
  const sinArg = Math.sin(argp);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  // Perifocal → J2000 ecliptic (the standard 3-1-3 rotation Ω, i, ω).
  const xEc =
    (cosNode * cosArg - sinNode * sinArg * cosI) * xOrb +
    (-cosNode * sinArg - sinNode * cosArg * cosI) * yOrb;
  const yEc =
    (sinNode * cosArg + cosNode * sinArg * cosI) * xOrb +
    (-sinNode * sinArg + cosNode * cosArg * cosI) * yOrb;
  const zEc = sinArg * sinI * xOrb + cosArg * sinI * yOrb;

  // Ecliptic → J2000 mean equator (+obliquity about x).
  return {
    x: xEc,
    y: yEc * COS_OBLIQUITY - zEc * SIN_OBLIQUITY,
    z: yEc * SIN_OBLIQUITY + zEc * COS_OBLIQUITY
  };
}

/**
 * Heliocentric position for an instant, in the J2000 mean-equator frame
 * (matching astronomy-engine's HelioVector), astronomical units.
 */
export function propagateElements(el: OrbitalElements, date: Date): EquatorialVec {
  const a = semiMajorAxisAU(el);
  const e = el.eccentricity;
  const n = (2 * Math.PI) / orbitalPeriodDays(el);
  const meanAnomaly = n * ((date.getTime() - el.perihelionEpochMs) / DAY_MS);

  const E = eccentricAnomaly(meanAnomaly, e);
  // Position in the perifocal (orbital) plane: x toward perihelion.
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return perifocalToEquatorial(xOrb, yOrb, el);
}

/**
 * The full ellipse as a heliocentric polyline, sampled uniformly in eccentric
 * anomaly and time-independent — the trace a comet always sits on. Returns the
 * same frame as {@link propagateElements}.
 */
export function orbitSample(el: OrbitalElements, samples: number): EquatorialVec[] {
  const a = semiMajorAxisAU(el);
  const e = el.eccentricity;
  const b = a * Math.sqrt(1 - e * e);
  const points: EquatorialVec[] = [];
  for (let k = 0; k <= samples; k++) {
    const E = (k / samples) * 2 * Math.PI;
    points.push(perifocalToEquatorial(a * (Math.cos(E) - e), b * Math.sin(E), el));
  }
  return points;
}

/**
 * Logarithmic hybrid scale — the single source of truth for every distance in
 * the scene.
 *
 * Real scale is unusable: at Neptune's true distance the Earth is far below one
 * pixel. Instead orbital radii are log-compressed so the whole system reads on
 * one screen, while body radii keep their true ratios (Jupiter still dwarfs
 * Mercury) with a constant exaggeration so planets remain visible against their
 * orbits.
 */

/** Scene units per astronomical unit at 1 AU, before log compression. */
const ORBIT_BASE = 60;
/** Strength of the log compression. 0 = linear, 1 = fully logarithmic. */
const ORBIT_COMPRESSION = 0.62;
/** Scene radius of an Earth-sized body. */
const EARTH_SCENE_RADIUS = 2.2;
/** Earth's equatorial radius, km — the reference for body scaling. */
const EARTH_RADIUS_KM = 6378.1;
/**
 * Radii are compressed too, or the Sun (109 Earth radii) would swallow
 * Mercury's compressed orbit. The exponent keeps the ordering and a legible
 * sense of relative size: Jupiter still reads as three times Earth.
 */
const RADIUS_EXPONENT = 0.45;

/** Orbital distance in AU to a radial distance in scene units. */
export function auToScene(au: number): number {
  if (au <= 0) return 0;
  return ORBIT_BASE * Math.pow(au, 1 - ORBIT_COMPRESSION) * (1 + ORBIT_COMPRESSION * Math.log10(1 + au));
}

/** Inverse of {@link auToScene}, solved numerically. */
export function sceneToAu(units: number): number {
  if (units <= 0) return 0;
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (auToScene(mid) < units) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Body radius in kilometres to a radius in scene units. */
export function kmToSceneRadius(km: number): number {
  return EARTH_SCENE_RADIUS * Math.pow(km / EARTH_RADIUS_KM, RADIUS_EXPONENT);
}

/** Inverse of {@link kmToSceneRadius}. */
export function sceneRadiusToKm(units: number): number {
  return EARTH_RADIUS_KM * Math.pow(units / EARTH_SCENE_RADIUS, 1 / RADIUS_EXPONENT);
}

/**
 * Moon orbital radius in kilometres to scene units. Moons are positioned
 * relative to their parent, not to the Sun, so they use their own compression:
 * true distances would bury Phobos inside Mars at the exaggerated body radii.
 *
 * The distance is a log compression of the orbit expressed in parent radii,
 * anchored to a floor that clears the exaggerated parent disc. A previous
 * `max(raw, floor)` clamp collapsed every inner moon of a planet onto the floor
 * — all four Galileans landed on one circle and interpenetrated whenever their
 * longitudes met. Because ln(orbit/parentRadius) is strictly increasing and
 * positive for any real moon, siblings now keep their order and a visible gap.
 */
export function moonOrbitToScene(km: number, parentSceneRadius: number, parentRadiusKm: number): number {
  const floor = parentSceneRadius * 1.8;
  return floor * (1 + 0.275 * Math.log(km / parentRadiusKm));
}

/**
 * Position of a body in scene space. The heliocentric EQJ vector keeps its
 * direction; only its magnitude is compressed, so alignments and conjunctions
 * stay geometrically truthful.
 */
export function heliocentricToScene(v: { x: number; y: number; z: number }): [number, number, number] {
  const distance = Math.hypot(v.x, v.y, v.z);
  if (distance === 0) return [0, 0, 0];
  const scaled = auToScene(distance) / distance;
  // EQJ z becomes scene y, preserving the full three-dimensional bearing.
  return [v.x * scaled, v.z * scaled, -v.y * scaled];
}

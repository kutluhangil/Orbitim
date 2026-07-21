import * as THREE from 'three';
import { getBodyRecord } from '../lib/ephemeris/bodies';
import { kmToSceneRadius } from '../lib/scale';

/** Scene units per kilometre in Earth's neighbourhood. */
export const KM_TO_SCENE = kmToSceneRadius(getBodyRecord('earth').radiusKm) / getBodyRecord('earth').radiusKm;

/** Earth's rendered radius, the surface the ground track is drawn on. */
export const EARTH_SCENE_RADIUS = kmToSceneRadius(getBodyRecord('earth').radiusKm);

/**
 * Equatorial radius SGP4 works in, km. Element set fields expressed in Earth
 * radii — apogee and perigee among them — are only correct against this value,
 * not against the fact-sheet radius the scene is scaled from.
 */
export const SGP4_EARTH_RADIUS_KM = 6378.135;

/**
 * Earth-centred kilometres into the axes of the satellite layer. The layer is a
 * child of a group carrying Earth's axial tilt, so the equatorial frame maps
 * straight across: the spin axis (z) becomes scene y.
 *
 * The same mapping serves both the inertial and the Earth-fixed frame, because a
 * rotation about the spin axis is a rotation about scene y in either. An
 * Earth-fixed child therefore only needs its group turned by the sidereal angle
 * to land in the inertial frame the satellites are propagated in.
 */
export function equatorialToScene(
  v: { x: number; y: number; z: number },
  out: THREE.Vector3
): THREE.Vector3 {
  return out.set(v.x * KM_TO_SCENE, v.z * KM_TO_SCENE, -v.y * KM_TO_SCENE);
}

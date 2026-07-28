import { MakeTime, RotationAxis } from 'astronomy-engine';
import { gstime } from 'satellite.js';
import { getBodyRecord, type BodyId } from './bodies';

/** J2000.0 epoch, the reference instant for all spin angles. */
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const EARTH_CLOUD_DRIFT_DAYS = 12.5;

export interface EquatorialDirection {
  x: number;
  y: number;
  z: number;
}

/**
 * Spin angle of a body about its own axis at the given instant, radians.
 * Retrograde rotators carry a negative rotation period and therefore a
 * decreasing angle.
 */
export function getSpinAngle(id: BodyId, date: Date): number {
  // Earth spins by Greenwich Mean Sidereal Time so that its surface stays in
  // register with satellite positions, which are propagated in the same
  // Earth-centred inertial frame.
  if (id === 'earth') return gstime(date);

  const { rotationHours } = getBodyRecord(id);
  const elapsedHours = (date.getTime() - J2000_MS) / 3600000;
  const turns = elapsedHours / rotationHours;
  return turns * 2 * Math.PI;
}

/**
 * Earth cloud-shell orientation at the given instant.
 *
 * Weather is not a rigid layer and no single rotation rate can represent every
 * latitude. The shell follows sidereal Earth rotation plus a slow eastward
 * advection that completes one extra turn in 12.5 days, a restrained global
 * proxy for the moving systems visible in satellite mosaics.
 */
export function getEarthCloudAngle(date: Date): number {
  const elapsedDays = (date.getTime() - J2000_MS) / 86_400_000;
  return getSpinAngle('earth', date) + (elapsedDays / EARTH_CLOUD_DRIFT_DAYS) * 2 * Math.PI;
}

/**
 * Direction of a body's north pole in the J2000 mean-equator frame (EQJ).
 *
 * The scene's ephemerides and satellite coordinates are EQJ vectors, so an
 * axial tilt measured from a body's own orbital plane is not enough to orient
 * its surface in the shared world frame. astronomy-engine supplies the IAU
 * rotational-axis model for the Sun, planets, Moon and Pluto. Bodies outside
 * that catalogue retain the existing axial-tilt approximation.
 */
export function getSpinAxis(id: BodyId, date: Date): EquatorialDirection {
  const record = getBodyRecord(id);
  if (record.engineBody) {
    const north = RotationAxis(record.engineBody, MakeTime(date)).north;
    return { x: north.x, y: north.y, z: north.z };
  }

  const tilt = getAxialTilt(id);
  return { x: 0, y: Math.cos(tilt), z: Math.sin(tilt) };
}

/** Obliquity of the body's rotation axis, radians. */
export function getAxialTilt(id: BodyId): number {
  return (getBodyRecord(id).axialTiltDeg * Math.PI) / 180;
}

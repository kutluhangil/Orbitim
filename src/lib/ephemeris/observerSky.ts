import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import * as satellite from 'satellite.js';
import type { SatelliteData } from '../../services/tle';
import type { ObserverLocation } from '../../scene/observerSettings';

export interface HorizonObject {
  name: string;
  altitude: number;
  azimuth: number;
  visible: boolean;
}

export interface SatellitePass {
  rise: Date;
  peak: Date;
  set: Date;
  peakAltitude: number;
}

const HORIZON_BODIES: readonly { body: Body; name: string }[] = [
  { body: Body.Sun, name: 'Sun' },
  { body: Body.Moon, name: 'Moon' },
  { body: Body.Venus, name: 'Venus' },
  { body: Body.Mars, name: 'Mars' },
  { body: Body.Jupiter, name: 'Jupiter' },
  { body: Body.Saturn, name: 'Saturn' }
];

function astronomyObserver(location: ObserverLocation): Observer {
  return new Observer(location.latitude, location.longitude, location.elevationM);
}

/** Apparent, refraction-corrected alt/az for the observer's real horizon. */
export function horizonObjects(location: ObserverLocation, date: Date): HorizonObject[] {
  const observer = astronomyObserver(location);
  return HORIZON_BODIES.map(({ body, name }) => {
    const equator = Equator(body, date, observer, true, true);
    const horizontal = Horizon(date, observer, equator.ra, equator.dec, 'normal');
    return {
      name,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
      visible: horizontal.altitude > 0
    };
  });
}

function satelliteAltitude(satelliteData: SatelliteData, location: ObserverLocation, date: Date): number | null {
  const propagated = satellite.propagate(satelliteData.satrec, date);
  const position = propagated?.position;
  if (!position) return null;

  const observer = {
    latitude: satellite.degreesToRadians(location.latitude),
    longitude: satellite.degreesToRadians(location.longitude),
    height: location.elevationM / 1000
  };
  const ecf = satellite.eciToEcf(position, satellite.gstime(date));
  return satellite.radiansToDegrees(satellite.ecfToLookAngles(observer, ecf).elevation);
}

/**
 * The next visible pass from a TLE, sampled at one-minute cadence and refined
 * as the first/last above-horizon sample. The panel labels this precision rather
 * than pretending it is a mission-control contact prediction.
 */
export function nextSatellitePass(
  satelliteData: SatelliteData,
  location: ObserverLocation,
  start: Date,
  horizonHours = 24,
  minimumAltitude = 10
): SatellitePass | null {
  const stepMs = 60_000;
  const endMs = start.getTime() + horizonHours * 3_600_000;
  let previousAltitude = satelliteAltitude(satelliteData, location, start);
  let rise: Date | null = previousAltitude !== null && previousAltitude > minimumAltitude ? start : null;
  let peak = rise;
  let peakAltitude = previousAltitude ?? -90;

  for (let ms = start.getTime() + stepMs; ms <= endMs; ms += stepMs) {
    const date = new Date(ms);
    const altitude = satelliteAltitude(satelliteData, location, date);
    if (altitude === null) {
      previousAltitude = null;
      continue;
    }

    if (rise === null && (previousAltitude === null || previousAltitude <= minimumAltitude) && altitude > minimumAltitude) {
      rise = date;
      peak = date;
      peakAltitude = altitude;
    }

    if (rise !== null) {
      if (altitude > peakAltitude) {
        peakAltitude = altitude;
        peak = date;
      }
      if (previousAltitude !== null && previousAltitude > minimumAltitude && altitude <= minimumAltitude) {
        return { rise, peak: peak ?? rise, set: date, peakAltitude };
      }
    }
    previousAltitude = altitude;
  }

  return null;
}

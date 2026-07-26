import type { SatelliteData } from '../../services/tle';
import type { ObserverLocation } from '../../scene/observerSettings';

export interface StarlinkRise {
  name: string;
  noradId: string;
  rise: Date;
  altitudeAtSample: number;
}

interface WorkerResult {
  name: string;
  noradId: string;
  riseMs: number;
  altitude: number;
}

/**
 * Runs the all-constellation scan in a short-lived module worker. The main
 * render thread only serialises the two TLE lines and remains free for WebGL.
 */
export function findNextStarlinkRises(
  satellites: readonly SatelliteData[],
  location: ObserverLocation,
  start: Date
): Promise<StarlinkRise[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/starlinkPass.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<WorkerResult[]>) => {
      worker.terminate();
      resolve(data.map((item) => ({
        name: item.name,
        noradId: item.noradId,
        rise: new Date(item.riseMs),
        altitudeAtSample: item.altitude
      })));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(`Starlink pass worker failed: ${event.message}`));
    };
    worker.postMessage({
      observer: location,
      satellites: satellites.map((item) => ({
        name: item.name,
        tleLine1: item.tleLine1,
        tleLine2: item.tleLine2
      })),
      startMs: start.getTime(),
      minimumAltitude: 10
    });
  });
}

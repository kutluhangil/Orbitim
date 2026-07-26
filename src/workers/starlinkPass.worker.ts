import * as satellite from 'satellite.js';

interface ObserverInput {
  latitude: number;
  longitude: number;
  elevationM: number;
}

interface SatelliteInput {
  name: string;
  tleLine1: string;
  tleLine2: string;
}

interface PassResult {
  name: string;
  noradId: string;
  riseMs: number;
  altitude: number;
}

interface PassRequest {
  observer: ObserverInput;
  satellites: SatelliteInput[];
  startMs: number;
  minimumAltitude: number;
}

function altitude(
  satrec: satellite.SatRec,
  observer: ReturnType<typeof observerGeodetic>,
  date: Date
): number | null {
  const position = satellite.propagate(satrec, date)?.position;
  if (!position) return null;
  const ecf = satellite.eciToEcf(position, satellite.gstime(date));
  return satellite.radiansToDegrees(satellite.ecfToLookAngles(observer, ecf).elevation);
}

function observerGeodetic(observer: ObserverInput) {
  return {
    latitude: satellite.degreesToRadians(observer.latitude),
    longitude: satellite.degreesToRadians(observer.longitude),
    height: observer.elevationM / 1000
  };
}

self.onmessage = ({ data }: MessageEvent<PassRequest>) => {
  const observer = observerGeodetic(data.observer);
  const stepMs = 120_000;
  const limitMs = data.startMs + 12 * 3_600_000;
  const records = data.satellites.map((item) => ({
    name: item.name,
    satrec: satellite.twoline2satrec(item.tleLine1, item.tleLine2),
    previous: null as number | null
  }));
  const matches: PassResult[] = [];

  for (let ms = data.startMs - stepMs; ms <= limitMs; ms += stepMs) {
    const date = new Date(ms);
    for (const record of records) {
      const current = altitude(record.satrec, observer, date);
      if (
        current !== null &&
        record.previous !== null &&
        record.previous <= data.minimumAltitude &&
        current > data.minimumAltitude &&
        ms >= data.startMs
      ) {
        matches.push({
          name: record.name,
          noradId: record.satrec.satnum,
          riseMs: ms,
          altitude: current
        });
      }
      record.previous = current;
    }

    // Chronological scanning means any three rises found at this instant are
    // necessarily earlier than every future candidate. The worker can return
    // immediately instead of needlessly propagating a 12-hour catalogue.
    if (matches.length >= 3) break;
  }

  matches.sort((a, b) => a.riseMs - b.riseMs || b.altitude - a.altitude);
  self.postMessage(matches.slice(0, 3));
};

interface NasaFlare {
  flrID?: string;
  peakTime?: string;
  classType?: string;
  sourceLocation?: string;
}

interface NasaCmeAnalysis {
  isMostAccurate?: boolean;
  speed?: number;
}

interface NasaCme {
  activityID?: string;
  startTime?: string;
  cmeAnalyses?: NasaCmeAnalysis[];
}

interface NasaGeomagneticReading {
  kpIndex?: number;
  observedTime?: string;
}

interface NasaGeomagneticStorm {
  gstID?: string;
  startTime?: string;
  allKpIndex?: NasaGeomagneticReading[];
}

export interface SolarFlare {
  id: string;
  peakTime: Date;
  classType: string;
  sourceLocation: string | null;
}

export interface CoronalMassEjection {
  id: string;
  startTime: Date;
  speedKmPerSecond: number | null;
}

export interface GeomagneticActivity {
  id: string;
  startTime: Date;
  peakKp: number | null;
  observedTime: Date | null;
}

export interface SpaceWeatherSnapshot {
  fetchedAt: Date;
  latestFlare: SolarFlare | null;
  latestCme: CoronalMassEjection | null;
  latestGeomagneticActivity: GeomagneticActivity | null;
}

function parseNasaDate(value: string | undefined, field: string): Date {
  if (!value) throw new Error(`NASA DONKI response is missing ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`NASA DONKI returned an invalid ${field}: ${value}`);
  }
  return date;
}

function latestByDate<T>(items: T[], getDate: (item: T) => Date): T | null {
  return items.reduce<T | null>((latest, item) => {
    if (!latest || getDate(item).getTime() > getDate(latest).getTime()) return item;
    return latest;
  }, null);
}

interface DonkiPayload {
  flares?: unknown;
  cmes?: unknown;
  storms?: unknown;
  fetchedAt?: unknown;
  source?: unknown;
  error?: unknown;
  detail?: unknown;
}

function toSolarFlare(record: NasaFlare): SolarFlare {
  return {
    id: record.flrID ?? 'unidentified flare',
    peakTime: parseNasaDate(record.peakTime, 'FLR peakTime'),
    classType: record.classType ?? 'Unclassified',
    sourceLocation: record.sourceLocation ?? null
  };
}

function toCme(record: NasaCme): CoronalMassEjection {
  const analysis = record.cmeAnalyses?.find((item) => item.isMostAccurate) ?? record.cmeAnalyses?.[0];
  return {
    id: record.activityID ?? 'unidentified CME',
    startTime: parseNasaDate(record.startTime, 'CME startTime'),
    speedKmPerSecond: typeof analysis?.speed === 'number' ? analysis.speed : null
  };
}

function toGeomagneticActivity(record: NasaGeomagneticStorm): GeomagneticActivity {
  const readings = record.allKpIndex ?? [];
  const peak = readings.reduce<NasaGeomagneticReading | null>((highest, reading) => {
    if (typeof reading.kpIndex !== 'number') return highest;
    if (!highest || typeof highest.kpIndex !== 'number' || reading.kpIndex > highest.kpIndex) return reading;
    return highest;
  }, null);

  return {
    id: record.gstID ?? 'unidentified geomagnetic event',
    startTime: parseNasaDate(record.startTime, 'GST startTime'),
    peakKp: peak?.kpIndex ?? null,
    observedTime: peak?.observedTime ? parseNasaDate(peak.observedTime, 'GST observedTime') : null
  };
}

/** Fetches server-cached observed NASA DONKI reports without exposing the API key. */
export async function fetchSpaceWeather(signal?: AbortSignal): Promise<SpaceWeatherSnapshot> {
  const response = await fetch('/api/space-weather', { signal });
  const payload = await response.json() as DonkiPayload;
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA solar weather request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.flares) || !Array.isArray(payload.cmes) || !Array.isArray(payload.storms) || typeof payload.fetchedAt !== 'string' || typeof payload.source !== 'string') {
    throw new Error('NASA solar weather response did not have the expected shape.');
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime())) throw new Error('NASA solar weather response did not contain a valid fetch time.');

  const flares = payload.flares as NasaFlare[];
  const cmes = payload.cmes as NasaCme[];
  const storms = payload.storms as NasaGeomagneticStorm[];

  const parsedFlares = flares.map(toSolarFlare);
  const parsedCmes = cmes.map(toCme);
  const parsedStorms = storms.map(toGeomagneticActivity);

  return {
    fetchedAt,
    latestFlare: latestByDate(parsedFlares, (flare) => flare.peakTime),
    latestCme: latestByDate(parsedCmes, (cme) => cme.startTime),
    latestGeomagneticActivity: latestByDate(parsedStorms, (storm) => storm.startTime)
  };
}

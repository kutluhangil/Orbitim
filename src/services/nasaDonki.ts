const NASA_DONKI_BASE_URL = 'https://api.nasa.gov/DONKI';

// NASA documents DEMO_KEY as its public, rate-limited key. Deployments can use
// their own key without exposing it in source by setting VITE_NASA_API_KEY.
const NASA_API_KEY = import.meta.env.VITE_NASA_API_KEY ?? 'DEMO_KEY';

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

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

async function fetchDonkiArray<T>(endpoint: string, startDate: string, endDate: string, signal?: AbortSignal): Promise<T[]> {
  const url = new URL(`${NASA_DONKI_BASE_URL}/${endpoint}`);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('api_key', NASA_API_KEY);

  const response = await fetch(url, { signal });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`NASA DONKI ${endpoint} request failed with HTTP ${response.status}: ${body}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throw new Error(
      `NASA DONKI ${endpoint} returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`NASA DONKI ${endpoint} returned an unexpected payload: ${body}`);
  }
  return parsed as T[];
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

/** Fetches the last two weeks of observed NASA DONKI flare, CME and Kp reports. */
export async function fetchSpaceWeather(now = new Date(), signal?: AbortSignal): Promise<SpaceWeatherSnapshot> {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  const startDate = formatUtcDate(start);
  const endDate = formatUtcDate(now);

  const [flares, cmes, storms] = await Promise.all([
    fetchDonkiArray<NasaFlare>('FLR', startDate, endDate, signal),
    fetchDonkiArray<NasaCme>('CME', startDate, endDate, signal),
    fetchDonkiArray<NasaGeomagneticStorm>('GST', startDate, endDate, signal)
  ]);

  const parsedFlares = flares.map(toSolarFlare);
  const parsedCmes = cmes.map(toCme);
  const parsedStorms = storms.map(toGeomagneticActivity);

  return {
    fetchedAt: now,
    latestFlare: latestByDate(parsedFlares, (flare) => flare.peakTime),
    latestCme: latestByDate(parsedCmes, (cme) => cme.startTime),
    latestGeomagneticActivity: latestByDate(parsedStorms, (storm) => storm.startTime)
  };
}

import { readApiJson } from './readApiJson';

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

export const SOLAR_IMPACT_STREAM_IDS = [
  'energeticParticles',
  'interplanetaryShocks',
  'highSpeedStreams',
  'radiationBelts',
  'magnetopauseCrossings',
  'notifications',
  'enlilSimulations'
] as const;

export type SolarImpactStreamId = (typeof SOLAR_IMPACT_STREAM_IDS)[number];
export type SolarImpactEvidence = 'observed' | 'reported' | 'modelled';

export interface SolarImpactStream {
  id: SolarImpactStreamId;
  endpoint: string;
  evidence: SolarImpactEvidence;
  reportCount: number;
  sourceError: string | null;
}

export interface SpaceWeatherSnapshot {
  fetchedAt: Date;
  latestFlare: SolarFlare | null;
  latestCme: CoronalMassEjection | null;
  latestGeomagneticActivity: GeomagneticActivity | null;
  impactStreams: SolarImpactStream[];
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
  impactStreams?: unknown;
  fetchedAt?: unknown;
  source?: unknown;
  error?: unknown;
  detail?: unknown;
}

interface DonkiImpactStreamPayload {
  id?: unknown;
  endpoint?: unknown;
  evidence?: unknown;
  reports?: unknown;
  error?: unknown;
}

function isImpactStreamId(value: unknown): value is SolarImpactStreamId {
  return typeof value === 'string' && (SOLAR_IMPACT_STREAM_IDS as readonly string[]).includes(value);
}

function isImpactEvidence(value: unknown): value is SolarImpactEvidence {
  return value === 'observed' || value === 'reported' || value === 'modelled';
}

function parseImpactStreams(value: unknown): SolarImpactStream[] {
  if (!Array.isArray(value)) throw new Error('NASA solar weather response is missing impactStreams.');

  const parsed = value.map((raw) => {
    const stream = raw as DonkiImpactStreamPayload;
    if (!stream || typeof stream !== 'object' || !isImpactStreamId(stream.id) || typeof stream.endpoint !== 'string' || !isImpactEvidence(stream.evidence) || !Array.isArray(stream.reports)) {
      throw new Error('NASA solar weather response contains an invalid impact stream.');
    }
    if (stream.error !== null && typeof stream.error !== 'string') {
      throw new Error(`NASA solar weather response contains an invalid ${stream.id} error state.`);
    }
    return {
      id: stream.id,
      endpoint: stream.endpoint,
      evidence: stream.evidence,
      reportCount: stream.reports.length,
      sourceError: stream.error
    };
  });

  const ids = new Set(parsed.map((stream) => stream.id));
  if (parsed.length !== SOLAR_IMPACT_STREAM_IDS.length || SOLAR_IMPACT_STREAM_IDS.some((id) => !ids.has(id))) {
    throw new Error('NASA solar weather response does not contain the complete impact-stream catalogue.');
  }
  return parsed;
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
  const payload = await readApiJson<DonkiPayload>(response, 'NASA solar-weather endpoint');
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
  const impactStreams = parseImpactStreams(payload.impactStreams);

  return {
    fetchedAt,
    latestFlare: latestByDate(parsedFlares, (flare) => flare.peakTime),
    latestCme: latestByDate(parsedCmes, (cme) => cme.startTime),
    latestGeomagneticActivity: latestByDate(parsedStorms, (storm) => storm.startTime),
    impactStreams
  };
}

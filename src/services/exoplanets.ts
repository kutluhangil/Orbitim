import { readApiJson } from './readApiJson';

export type ExoplanetMethod =
  | 'all'
  | 'astrometry'
  | 'disk-kinematics'
  | 'eclipse-timing-variations'
  | 'imaging'
  | 'microlensing'
  | 'orbital-brightness-modulation'
  | 'pulsar-timing'
  | 'pulsation-timing-variations'
  | 'radial-velocity'
  | 'transit'
  | 'transit-timing-variations';

export interface ExoplanetRecord {
  name: string;
  hostName: string;
  discoveryMethod: string | null;
  discoveryYear: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
  orbitDays: number | null;
  equilibriumTemperatureK: number | null;
  distanceParsecs: number | null;
  starTemperatureK: number | null;
  rightAscensionDeg: number | null;
  declinationDeg: number | null;
  facility: string | null;
  semiMajorAxisAu: number | null;
  eccentricity: number | null;
}

export interface ExoplanetPage {
  records: ExoplanetRecord[];
  total: number;
  page: number;
  limit: number;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

interface ExoplanetPayload {
  records?: unknown;
  total?: unknown;
  page?: unknown;
  limit?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  fetchedAt?: unknown;
  error?: unknown;
  detail?: unknown;
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isExoplanetRecord(value: unknown): value is ExoplanetRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' && typeof record.hostName === 'string'
    && nullableString(record.discoveryMethod) && nullableNumber(record.discoveryYear)
    && nullableNumber(record.radiusEarth) && nullableNumber(record.massEarth)
    && nullableNumber(record.orbitDays) && nullableNumber(record.equilibriumTemperatureK)
    && nullableNumber(record.distanceParsecs) && nullableNumber(record.starTemperatureK)
    && nullableNumber(record.rightAscensionDeg) && nullableNumber(record.declinationDeg)
    && nullableString(record.facility) && nullableNumber(record.semiMajorAxisAu)
    && nullableNumber(record.eccentricity);
}

export async function fetchExoplanets(
  { q = '', method = 'all', page = 0, limit = 48 }: { q?: string; method?: ExoplanetMethod; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<ExoplanetPage> {
  const query = new URLSearchParams({ q, method, page: String(page), limit: String(limit) });
  const response = await fetch(`/api/exoplanets?${query}`, { signal });
  const payload = await readApiJson<ExoplanetPayload>(response, 'NASA Exoplanet Archive endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA Exoplanet Archive request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.records) || !payload.records.every(isExoplanetRecord) || typeof payload.total !== 'number' || !Number.isSafeInteger(payload.total)
    || typeof payload.page !== 'number' || !Number.isSafeInteger(payload.page) || typeof payload.limit !== 'number' || !Number.isSafeInteger(payload.limit)
    || typeof payload.source !== 'string' || typeof payload.sourceUrl !== 'string' || typeof payload.fetchedAt !== 'string') {
    throw new Error('NASA Exoplanet Archive response did not have the expected shape.');
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime()) || fetchedAt.toISOString() !== payload.fetchedAt) {
    throw new Error(`NASA Exoplanet Archive response has an invalid fetchedAt timestamp: ${payload.fetchedAt}`);
  }
  return {
    records: payload.records,
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    fetchedAt: payload.fetchedAt
  };
}

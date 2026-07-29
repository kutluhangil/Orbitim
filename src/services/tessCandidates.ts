import { readApiJson } from './readApiJson';

export interface TessCandidateRecord {
  toi: string;
  ticId: number | null;
  disposition: 'PC';
  periodDays: number | null;
  durationHours: number | null;
  transitDepthPpm: number | null;
  radiusEarth: number | null;
  insolationEarth: number | null;
  equilibriumTemperatureK: number | null;
  distanceParsecs: number | null;
  starTemperatureK: number | null;
  rightAscensionDeg: number | null;
  declinationDeg: number | null;
  createdAt: string | null;
  releaseDate: string | null;
  sectors: string | null;
}

export interface TessCandidatePage {
  records: TessCandidateRecord[];
  total: number;
  page: number;
  limit: number;
  source: 'NASA Exoplanet Archive · TESS TOI · PC';
  sourceUrl: string;
  fetchedAt: string;
}

interface CandidatePayload {
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

function isCandidateRecord(value: unknown): value is TessCandidateRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.toi === 'string' && nullableNumber(record.ticId) && record.disposition === 'PC'
    && nullableNumber(record.periodDays) && nullableNumber(record.durationHours) && nullableNumber(record.transitDepthPpm)
    && nullableNumber(record.radiusEarth) && nullableNumber(record.insolationEarth) && nullableNumber(record.equilibriumTemperatureK)
    && nullableNumber(record.distanceParsecs) && nullableNumber(record.starTemperatureK) && nullableNumber(record.rightAscensionDeg)
    && nullableNumber(record.declinationDeg) && nullableString(record.createdAt) && nullableString(record.releaseDate) && nullableString(record.sectors);
}

/** Fetches only current TESS TOIs with the archive's PC disposition; these are not confirmed planets. */
export async function fetchTessCandidates(
  { q = '', page = 0, limit = 48 }: { q?: string; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<TessCandidatePage> {
  const query = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  const response = await fetch(`/api/tess-candidates?${query}`, { signal });
  const payload = await readApiJson<CandidatePayload>(response, 'NASA Exoplanet Archive TESS candidate endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA Exoplanet Archive TESS candidate request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.records) || !payload.records.every(isCandidateRecord) || typeof payload.total !== 'number' || !Number.isSafeInteger(payload.total)
    || typeof payload.page !== 'number' || !Number.isSafeInteger(payload.page) || typeof payload.limit !== 'number' || !Number.isSafeInteger(payload.limit)
    || payload.source !== 'NASA Exoplanet Archive · TESS TOI · PC' || typeof payload.sourceUrl !== 'string' || typeof payload.fetchedAt !== 'string') {
    throw new Error('NASA Exoplanet Archive TESS candidate response did not have the expected shape.');
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime()) || fetchedAt.toISOString() !== payload.fetchedAt) {
    throw new Error(`NASA Exoplanet Archive TESS candidate response has an invalid fetchedAt timestamp: ${payload.fetchedAt}`);
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

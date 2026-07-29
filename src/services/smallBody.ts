import { readApiJson } from './readApiJson';

export interface SmallBodyMatch {
  designation: string;
  name: string;
}

export interface EarthApproach {
  at: string;
  distanceAu: number | null;
  velocityKmS: number | null;
  uncertainty: string | null;
}

export interface SmallBodyRecord {
  name: string;
  designation: string;
  kind: string | null;
  orbitClass: string | null;
  neo: boolean | null;
  pha: boolean | null;
  diameterKm: number | null;
  absoluteMagnitude: number | null;
  albedo: number | null;
  rotationHours: number | null;
  perihelionAu: number | null;
  aphelionAu: number | null;
  semiMajorAu: number | null;
  eccentricity: number | null;
  inclinationDeg: number | null;
  earthMoidAu: number | null;
  conditionCode: string | null;
  lastObserved: string | null;
  earthApproaches: EarthApproach[];
  detailUrl: string;
}

export interface SmallBodyLookup {
  kind: 'resolved' | 'ambiguous' | 'not-found';
  query: string;
  matches: SmallBodyMatch[];
  record: SmallBodyRecord | null;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

interface SmallBodyPayload {
  kind?: unknown;
  query?: unknown;
  matches?: unknown;
  record?: unknown;
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

function isMatch(value: unknown): value is SmallBodyMatch {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).designation === 'string' && typeof (value as Record<string, unknown>).name === 'string';
}

function isApproach(value: unknown): value is EarthApproach {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.at === 'string' && nullableNumber(record.distanceAu) && nullableNumber(record.velocityKmS) && nullableString(record.uncertainty);
}

function isRecord(value: unknown): value is SmallBodyRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' && typeof record.designation === 'string'
    && nullableString(record.kind) && nullableString(record.orbitClass)
    && (record.neo === null || typeof record.neo === 'boolean') && (record.pha === null || typeof record.pha === 'boolean')
    && nullableNumber(record.diameterKm) && nullableNumber(record.absoluteMagnitude) && nullableNumber(record.albedo) && nullableNumber(record.rotationHours)
    && nullableNumber(record.perihelionAu) && nullableNumber(record.aphelionAu) && nullableNumber(record.semiMajorAu) && nullableNumber(record.eccentricity)
    && nullableNumber(record.inclinationDeg) && nullableNumber(record.earthMoidAu) && nullableString(record.conditionCode) && nullableString(record.lastObserved)
    && Array.isArray(record.earthApproaches) && record.earthApproaches.every(isApproach) && typeof record.detailUrl === 'string';
}

export async function lookupSmallBody(query: string, signal?: AbortSignal): Promise<SmallBodyLookup> {
  const response = await fetch(`/api/small-body?q=${encodeURIComponent(query)}`, { signal });
  const payload = await readApiJson<SmallBodyPayload>(response, 'JPL SBDB object lookup endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'JPL SBDB object lookup failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if ((payload.kind !== 'resolved' && payload.kind !== 'ambiguous' && payload.kind !== 'not-found') || typeof payload.query !== 'string'
    || !Array.isArray(payload.matches) || !payload.matches.every(isMatch) || (payload.record !== null && !isRecord(payload.record))
    || typeof payload.source !== 'string' || typeof payload.sourceUrl !== 'string' || typeof payload.fetchedAt !== 'string') {
    throw new Error('JPL SBDB response did not have the expected shape.');
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime()) || fetchedAt.toISOString() !== payload.fetchedAt) {
    throw new Error(`JPL SBDB response has an invalid fetchedAt timestamp: ${payload.fetchedAt}`);
  }
  if (payload.kind === 'resolved' && payload.record === null) throw new Error('JPL SBDB marked this object as resolved without a record.');
  if (payload.kind !== 'resolved' && payload.record !== null) throw new Error('JPL SBDB returned a record for a non-resolved lookup.');
  return payload as SmallBodyLookup;
}

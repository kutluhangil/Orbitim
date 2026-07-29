import { readApiJson } from './readApiJson';

export interface DeepSkyRecord {
  name: string;
  objectTypeCode: string | null;
  rightAscensionDeg: number | null;
  declinationDeg: number | null;
  redshift: number | null;
  redshiftUncertainty: number | null;
  redshiftReference: string | null;
  detailUrl: string;
}

export interface DeepSkyLookup {
  kind: 'resolved' | 'ambiguous' | 'not-found';
  query: string;
  aliases: string[];
  record: DeepSkyRecord | null;
  sourceUrl: string;
  fetchedAt: string;
}

interface DeepSkyPayload {
  kind?: unknown;
  query?: unknown;
  aliases?: unknown;
  record?: unknown;
  sourceUrl?: unknown;
  fetchedAt?: unknown;
  error?: unknown;
  detail?: unknown;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isRecord(value: unknown): value is DeepSkyRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' && nullableString(record.objectTypeCode)
    && nullableNumber(record.rightAscensionDeg) && nullableNumber(record.declinationDeg)
    && nullableNumber(record.redshift) && nullableNumber(record.redshiftUncertainty)
    && nullableString(record.redshiftReference) && typeof record.detailUrl === 'string';
}

export async function lookupDeepSkyObject(query: string, signal?: AbortSignal): Promise<DeepSkyLookup> {
  const response = await fetch(`/api/deep-sky?q=${encodeURIComponent(query)}`, { signal });
  const payload = await readApiJson<DeepSkyPayload>(response, 'NASA/IPAC NED object lookup endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA/IPAC NED object lookup failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if ((payload.kind !== 'resolved' && payload.kind !== 'ambiguous' && payload.kind !== 'not-found')
    || typeof payload.query !== 'string' || !Array.isArray(payload.aliases) || !payload.aliases.every((value) => typeof value === 'string')
    || (payload.record !== null && !isRecord(payload.record)) || typeof payload.sourceUrl !== 'string' || typeof payload.fetchedAt !== 'string') {
    throw new Error('NASA/IPAC NED object lookup response did not have the expected shape.');
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime()) || fetchedAt.toISOString() !== payload.fetchedAt) {
    throw new Error(`NASA/IPAC NED object lookup returned an invalid fetchedAt timestamp: ${payload.fetchedAt}`);
  }
  if (payload.kind === 'resolved' && payload.record === null) throw new Error('NASA/IPAC NED marked this object as resolved without an object record.');
  if (payload.kind !== 'resolved' && payload.record !== null) throw new Error('NASA/IPAC NED returned an object record for a non-resolved query.');
  return payload as DeepSkyLookup;
}

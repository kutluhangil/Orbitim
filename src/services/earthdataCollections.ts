import { readApiJson } from './readApiJson';

export interface EarthdataCollection {
  id: string;
  title: string;
  shortName: string | null;
  versionId: string | null;
  archiveCenter: string | null;
  summary: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  browseAvailable: boolean;
  onlineAccess: boolean;
  metadataUrl: string;
}

export interface EarthdataCollectionPage {
  records: EarthdataCollection[];
  total: number;
  page: number;
  limit: number;
  source: 'NASA Earthdata CMR · collection metadata';
  sourceUrl: string;
  fetchedAt: Date;
}

interface CollectionPayload {
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

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA CMR response is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA CMR response contains an invalid ${field}: ${value}`);
  }
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new Error(`NASA CMR response is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA CMR response contains an invalid ${field}: ${value}`);
  return parsed;
}

function isCollection(value: unknown): value is EarthdataCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const collection = value as Record<string, unknown>;
  return typeof collection.id === 'string' && typeof collection.title === 'string'
    && nullableString(collection.shortName) && nullableString(collection.versionId)
    && nullableString(collection.archiveCenter) && nullableString(collection.summary)
    && nullableString(collection.timeStart) && nullableString(collection.timeEnd)
    && typeof collection.browseAvailable === 'boolean' && typeof collection.onlineAccess === 'boolean'
    && typeof collection.metadataUrl === 'string';
}

/** Fetches a bounded CMR collection-metadata search; it never claims a keyword is a physical target resolver. */
export async function searchEarthdataCollections(
  { q, page = 1 }: { q: string; page?: number },
  signal?: AbortSignal
): Promise<EarthdataCollectionPage> {
  const query = new URLSearchParams({ q, page: String(page) });
  const response = await fetch(`/api/earthdata-collections?${query}`, { signal });
  const payload = await readApiJson<CollectionPayload>(response, 'NASA Earthdata CMR endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA CMR collection search failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.records) || !payload.records.every(isCollection) || typeof payload.total !== 'number' || !Number.isSafeInteger(payload.total)
    || typeof payload.page !== 'number' || !Number.isSafeInteger(payload.page) || typeof payload.limit !== 'number' || !Number.isSafeInteger(payload.limit)
    || payload.source !== 'NASA Earthdata CMR · collection metadata') {
    throw new Error('NASA CMR response did not have the expected shape.');
  }

  return {
    records: payload.records.map((record) => ({ ...record, metadataUrl: parseUrl(record.metadataUrl, `${record.id} metadataUrl`) })),
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt')
  };
}

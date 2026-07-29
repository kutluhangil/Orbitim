import { readApiJson } from './readApiJson';

export interface PdsTargetRecord {
  id: string;
  type: string;
  title: string;
  version: string;
  updatedAt: string;
  labelUrl: string;
}

export interface PdsTargetSnapshot {
  records: PdsTargetRecord[];
  total: number;
  target: string;
  limit: number;
  source: 'NASA PDS API · target context metadata';
  sourceUrl: string;
  fetchedAt: Date;
  coverage: 'partial';
}

interface PdsPayload {
  records?: unknown;
  total?: unknown;
  target?: unknown;
  limit?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  fetchedAt?: unknown;
  coverage?: unknown;
  error?: unknown;
  detail?: unknown;
}

function parseUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA PDS response is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA PDS response contains an invalid ${field}: ${value}`);
  }
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new Error(`NASA PDS response is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA PDS response contains an invalid ${field}: ${value}`);
  return parsed;
}

function isRecord(value: unknown): value is PdsTargetRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.type === 'string' && typeof record.title === 'string'
    && typeof record.version === 'string' && typeof record.updatedAt === 'string' && typeof record.labelUrl === 'string';
}

/** Looks up a PDS target context record; PDS product coverage is explicitly partial. */
export async function lookupPdsTarget(target: string, signal?: AbortSignal): Promise<PdsTargetSnapshot> {
  const query = new URLSearchParams({ target });
  const response = await fetch(`/api/pds-targets?${query}`, { signal });
  const payload = await readApiJson<PdsPayload>(response, 'NASA PDS target endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA PDS target lookup failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.records) || !payload.records.every(isRecord) || typeof payload.total !== 'number' || !Number.isSafeInteger(payload.total)
    || typeof payload.target !== 'string' || typeof payload.limit !== 'number' || !Number.isSafeInteger(payload.limit)
    || payload.source !== 'NASA PDS API · target context metadata' || payload.coverage !== 'partial') {
    throw new Error('NASA PDS response did not have the expected shape.');
  }

  return {
    records: payload.records.map((record) => ({ ...record, labelUrl: parseUrl(record.labelUrl, `${record.id} labelUrl`) })),
    total: payload.total,
    target: payload.target,
    limit: payload.limit,
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt'),
    coverage: payload.coverage
  };
}

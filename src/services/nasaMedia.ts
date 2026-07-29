import { readApiJson } from './readApiJson';

export interface NasaMediaItem {
  nasaId: string;
  title: string;
  description: string | null;
  center: string | null;
  dateCreated: string | null;
  thumbnailUrl: string;
  assetUrl: string;
}

export interface NasaMediaPage {
  items: NasaMediaItem[];
  total: number;
  page: number;
  limit: number;
  omittedItems: number;
  source: 'NASA Image and Video Library';
  sourceUrl: string;
  fetchedAt: Date;
}

interface MediaPayload {
  items?: unknown;
  total?: unknown;
  page?: unknown;
  limit?: unknown;
  omittedItems?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  fetchedAt?: unknown;
  error?: unknown;
  detail?: unknown;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isItem(value: unknown): value is NasaMediaItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.nasaId === 'string' && typeof item.title === 'string' && nullableString(item.description)
    && nullableString(item.center) && nullableString(item.dateCreated) && typeof item.thumbnailUrl === 'string' && typeof item.assetUrl === 'string';
}

function parseUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA Image Library response is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA Image Library response contains an invalid ${field}: ${value}`);
  }
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new Error(`NASA Image Library response is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA Image Library response contains an invalid ${field}: ${value}`);
  return parsed;
}

/** Fetches a bounded set of NASA library search results; the displayed thumbnail always links to its original record. */
export async function searchNasaMedia({ q, page = 1 }: { q: string; page?: number }, signal?: AbortSignal): Promise<NasaMediaPage> {
  const query = new URLSearchParams({ q, page: String(page) });
  const response = await fetch(`/api/nasa-media?${query}`, { signal });
  const payload = await readApiJson<MediaPayload>(response, 'NASA Image Library endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA Image Library request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.items) || !payload.items.every(isItem) || typeof payload.total !== 'number' || !Number.isSafeInteger(payload.total)
    || typeof payload.page !== 'number' || !Number.isSafeInteger(payload.page) || typeof payload.limit !== 'number' || !Number.isSafeInteger(payload.limit)
    || typeof payload.omittedItems !== 'number' || !Number.isSafeInteger(payload.omittedItems) || payload.source !== 'NASA Image and Video Library') {
    throw new Error('NASA Image Library response did not have the expected shape.');
  }
  return {
    items: payload.items.map((item) => ({ ...item, thumbnailUrl: parseUrl(item.thumbnailUrl, `${item.nasaId} thumbnailUrl`), assetUrl: parseUrl(item.assetUrl, `${item.nasaId} assetUrl`) })),
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    omittedItems: payload.omittedItems,
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt')
  };
}

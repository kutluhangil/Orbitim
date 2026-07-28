export interface EarthObservation {
  source: 'NASA EPIC · NOAA DSCOVR';
  sourceUrl: string;
  observedAt: Date;
  imageUrl: string;
  caption: string | null;
  fetchedAt: Date;
}

export interface SolarObservation {
  source: 'NASA SDO · AIA 171 Å';
  sourceUrl: string;
  imageUrl: string;
  publishedAt: Date;
  fetchedAt: Date;
  timestampNote: string;
}

interface ObservationPayload {
  source?: unknown;
  sourceUrl?: unknown;
  observedAt?: unknown;
  imageUrl?: unknown;
  caption?: unknown;
  publishedAt?: unknown;
  fetchedAt?: unknown;
  timestampNote?: unknown;
  error?: unknown;
  detail?: unknown;
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new Error(`NASA observation response is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA observation response contains an invalid ${field}: ${value}`);
  return parsed;
}

function parseUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA observation response is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA observation response contains an invalid ${field}: ${value}`);
  }
}

async function request(path: string, signal?: AbortSignal): Promise<ObservationPayload> {
  const response = await fetch(path, { signal });
  const body = await response.text();
  let payload: ObservationPayload;
  try {
    payload = JSON.parse(body) as ObservationPayload;
  } catch (cause) {
    throw new Error(`${path} returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!response.ok) {
    throw new Error(`${String(payload.error ?? 'NASA observation request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  }
  return payload;
}

/** Fetches a real full-disc Earth observation rather than projecting it onto the simulated globe. */
export async function fetchEarthObservation(signal?: AbortSignal): Promise<EarthObservation> {
  const payload = await request('/api/earth-observation', signal);
  if (payload.source !== 'NASA EPIC · NOAA DSCOVR') throw new Error('NASA EPIC response has an unexpected source label.');
  return {
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    observedAt: parseDate(payload.observedAt, 'observedAt'),
    imageUrl: parseUrl(payload.imageUrl, 'imageUrl'),
    caption: typeof payload.caption === 'string' ? payload.caption : null,
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt')
  };
}

/** Fetches the SDO latest AIA 171 asset and preserves its publisher timestamp semantics. */
export async function fetchSolarObservation(signal?: AbortSignal): Promise<SolarObservation> {
  const payload = await request('/api/solar-observation', signal);
  if (payload.source !== 'NASA SDO · AIA 171 Å') throw new Error('NASA SDO response has an unexpected source label.');
  if (typeof payload.timestampNote !== 'string') throw new Error('NASA SDO response is missing timestampNote.');
  return {
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    imageUrl: parseUrl(payload.imageUrl, 'imageUrl'),
    publishedAt: parseDate(payload.publishedAt, 'publishedAt'),
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt'),
    timestampNote: payload.timestampNote
  };
}

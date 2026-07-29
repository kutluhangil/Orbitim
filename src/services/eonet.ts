import { readApiJson } from './readApiJson';

export interface NaturalEvent {
  id: string;
  title: string;
  categories: string[];
  observedAt: Date;
  geometryType: string;
  position: { longitude: number; latitude: number } | null;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  sourceUrl: string | null;
}

export interface NaturalEventsSnapshot {
  source: 'NASA EONET · open natural events';
  sourceUrl: string;
  events: NaturalEvent[];
  fetchedAt: Date;
}

interface EventPayload {
  id?: unknown;
  title?: unknown;
  categories?: unknown;
  observedAt?: unknown;
  geometryType?: unknown;
  position?: unknown;
  magnitudeValue?: unknown;
  magnitudeUnit?: unknown;
  sourceUrl?: unknown;
}

interface EonetPayload {
  source?: unknown;
  sourceUrl?: unknown;
  events?: unknown;
  fetchedAt?: unknown;
  error?: unknown;
  detail?: unknown;
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new Error(`NASA EONET response is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA EONET response contains an invalid ${field}: ${value}`);
  return parsed;
}

function parseUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA EONET response is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA EONET response contains an invalid ${field}: ${value}`);
  }
}

function parsePosition(value: unknown, eventId: string): NaturalEvent['position'] {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`NASA EONET event ${eventId} has an invalid point position.`);
  }
  const position = value as { longitude?: unknown; latitude?: unknown };
  if (typeof position.longitude !== 'number' || typeof position.latitude !== 'number') {
    throw new Error(`NASA EONET event ${eventId} is missing point longitude or latitude.`);
  }
  return { longitude: position.longitude, latitude: position.latitude };
}

function parseEvent(value: unknown): NaturalEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NASA EONET response contains an invalid event.');
  const event = value as EventPayload;
  if (typeof event.id !== 'string' || event.id.length === 0) throw new Error('NASA EONET response contains an event without id.');
  if (typeof event.title !== 'string' || event.title.length === 0) throw new Error(`NASA EONET event ${event.id} is missing title.`);
  if (!Array.isArray(event.categories) || event.categories.some((category) => typeof category !== 'string' || category.length === 0)) {
    throw new Error(`NASA EONET event ${event.id} contains invalid categories.`);
  }
  if (typeof event.geometryType !== 'string' || event.geometryType.length === 0) throw new Error(`NASA EONET event ${event.id} is missing geometry type.`);
  if (event.magnitudeValue !== null && typeof event.magnitudeValue !== 'number') {
    throw new Error(`NASA EONET event ${event.id} contains an invalid magnitude value.`);
  }
  if (event.magnitudeUnit !== null && typeof event.magnitudeUnit !== 'string') {
    throw new Error(`NASA EONET event ${event.id} contains an invalid magnitude unit.`);
  }
  if (event.sourceUrl !== null && typeof event.sourceUrl !== 'string') {
    throw new Error(`NASA EONET event ${event.id} contains an invalid source URL.`);
  }

  return {
    id: event.id,
    title: event.title,
    categories: event.categories,
    observedAt: parseDate(event.observedAt, `${event.id} observedAt`),
    geometryType: event.geometryType,
    position: parsePosition(event.position, event.id),
    magnitudeValue: event.magnitudeValue ?? null,
    magnitudeUnit: event.magnitudeUnit ?? null,
    sourceUrl: event.sourceUrl === null ? null : parseUrl(event.sourceUrl, `${event.id} sourceUrl`)
  };
}

/** Fetches EONET's bounded open-event catalogue; its geometries are not satellite imagery or incident boundaries. */
export async function fetchNaturalEvents(signal?: AbortSignal): Promise<NaturalEventsSnapshot> {
  const response = await fetch('/api/earth-events', { signal });
  const payload = await readApiJson<EonetPayload>(response, 'NASA EONET endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'NASA EONET request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (payload.source !== 'NASA EONET · open natural events') throw new Error('NASA EONET response has an unexpected source label.');
  if (!Array.isArray(payload.events)) throw new Error('NASA EONET response is missing events.');

  return {
    source: payload.source,
    sourceUrl: parseUrl(payload.sourceUrl, 'sourceUrl'),
    events: payload.events.map(parseEvent),
    fetchedAt: parseDate(payload.fetchedAt, 'fetchedAt')
  };
}

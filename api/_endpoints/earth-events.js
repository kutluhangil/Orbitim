const EONET_EVENTS_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100';
const EONET_DOCUMENTATION_URL = 'https://eonet.gsfc.nasa.gov/docs/v3';

function parseDate(value, field) {
  if (typeof value !== 'string') throw new Error(`NASA EONET event is missing ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA EONET event has an invalid ${field}: ${value}`);
  return parsed;
}

function requireRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`NASA EONET response has an invalid ${field} record.`);
  }
  return value;
}

function pointPosition(geometry) {
  if (geometry.type !== 'Point') return null;
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
    throw new Error('NASA EONET Point geometry is missing longitude and latitude.');
  }
  const [longitude, latitude] = geometry.coordinates;
  if (typeof longitude !== 'number' || typeof latitude !== 'number' || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('NASA EONET Point geometry has invalid longitude or latitude.');
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(`NASA EONET Point geometry is outside geographic bounds: ${longitude}, ${latitude}`);
  }
  return { longitude, latitude };
}

function latestGeometry(rawGeometries) {
  if (!Array.isArray(rawGeometries) || rawGeometries.length === 0) {
    throw new Error('NASA EONET event has no geometry records.');
  }

  return rawGeometries
    .map((raw) => {
      const geometry = requireRecord(raw, 'geometry');
      if (typeof geometry.type !== 'string' || geometry.type.length === 0) {
        throw new Error('NASA EONET geometry is missing type.');
      }
      const observedAt = parseDate(geometry.date, 'geometry date');
      return {
        observedAt,
        geometryType: geometry.type,
        position: pointPosition(geometry),
        magnitudeValue: typeof geometry.magnitudeValue === 'number' && Number.isFinite(geometry.magnitudeValue)
          ? geometry.magnitudeValue
          : null,
        magnitudeUnit: typeof geometry.magnitudeUnit === 'string' && geometry.magnitudeUnit.length > 0
          ? geometry.magnitudeUnit
          : null
      };
    })
    .reduce((latest, candidate) => candidate.observedAt > latest.observedAt ? candidate : latest);
}

function sourceUrl(rawSources) {
  if (!Array.isArray(rawSources)) return null;
  const source = rawSources.find((raw) => {
    const candidate = requireRecord(raw, 'source');
    return typeof candidate.url === 'string' && candidate.url.length > 0;
  });
  if (!source) return null;
  try {
    return new URL(source.url).toString();
  } catch {
    throw new Error(`NASA EONET event contains an invalid source URL: ${source.url}`);
  }
}

function compactEvent(raw) {
  const event = requireRecord(raw, 'event');
  if (typeof event.id !== 'string' || event.id.length === 0) throw new Error('NASA EONET event is missing id.');
  if (typeof event.title !== 'string' || event.title.length === 0) throw new Error(`NASA EONET event ${event.id} is missing title.`);
  if (!Array.isArray(event.categories) || event.categories.length === 0) throw new Error(`NASA EONET event ${event.id} has no categories.`);

  const categories = event.categories.map((rawCategory) => {
    const category = requireRecord(rawCategory, 'category');
    if (typeof category.title !== 'string' || category.title.length === 0) {
      throw new Error(`NASA EONET event ${event.id} has an invalid category title.`);
    }
    return category.title;
  });
  const latest = latestGeometry(event.geometry);

  return {
    id: event.id,
    title: event.title,
    categories,
    observedAt: latest.observedAt.toISOString(),
    geometryType: latest.geometryType,
    position: latest.position,
    magnitudeValue: latest.magnitudeValue,
    magnitudeUnit: latest.magnitudeUnit,
    sourceUrl: sourceUrl(event.sources)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  try {
    const upstream = await fetch(EONET_EVENTS_URL);
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`NASA EONET request failed with HTTP ${upstream.status}: ${body}`);

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (cause) {
      throw new Error(`NASA EONET returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.events)) {
      throw new Error('NASA EONET response is missing its events array.');
    }

    const events = payload.events.map(compactEvent).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({
      source: 'NASA EONET · open natural events',
      sourceUrl: EONET_DOCUMENTATION_URL,
      events,
      fetchedAt: new Date().toISOString()
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA EONET request failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

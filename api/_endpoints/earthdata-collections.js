const CMR_COLLECTIONS_URL = 'https://cmr.earthdata.nasa.gov/search/collections.json';
const CMR_DOCUMENTATION_URL = 'https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html';
const PAGE_SIZE = 12;

function requireRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`NASA CMR response has an invalid ${field} record.`);
  }
  return value;
}

function readQuery(value) {
  if (typeof value !== 'string') throw new Error('q is required.');
  const query = value.trim();
  if (query.length < 2 || query.length > 80) throw new Error('q must contain between 2 and 80 characters.');
  return query;
}

function readPage(value) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('page must be a positive integer.');
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('page must be between 1 and 100.');
  return page;
}

function nullableString(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`NASA CMR collection has an invalid ${field}.`);
  return value;
}

function nullableDate(value, field) {
  const date = nullableString(value, field);
  if (date === null) return null;
  if (Number.isNaN(Date.parse(date))) throw new Error(`NASA CMR collection has an invalid ${field}: ${date}`);
  return date;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA CMR collection is missing ${field}.`);
  return value;
}

function boolean(value, field) {
  if (typeof value !== 'boolean') throw new Error(`NASA CMR collection has an invalid ${field}.`);
  return value;
}

function metadataUrl(conceptId) {
  return `https://cmr.earthdata.nasa.gov/search/concepts/${encodeURIComponent(conceptId)}.umm_json`;
}

function compactCollection(raw) {
  const collection = requireRecord(raw, 'collection');
  const id = requiredString(collection.id, 'id');
  return {
    id,
    title: requiredString(collection.title, `${id} title`),
    shortName: nullableString(collection.short_name, `${id} short_name`),
    versionId: nullableString(collection.version_id, `${id} version_id`),
    archiveCenter: nullableString(collection.archive_center, `${id} archive_center`),
    summary: nullableString(collection.summary, `${id} summary`),
    timeStart: nullableDate(collection.time_start, `${id} time_start`),
    timeEnd: nullableDate(collection.time_end, `${id} time_end`),
    browseAvailable: boolean(collection.browse_flag, `${id} browse_flag`),
    onlineAccess: boolean(collection.online_access_flag, `${id} online_access_flag`),
    metadataUrl: metadataUrl(id)
  };
}

function parseHits(value) {
  if (value === null || !/^\d+$/.test(value)) throw new Error('NASA CMR response is missing a valid CMR-Hits header.');
  const hits = Number(value);
  if (!Number.isSafeInteger(hits) || hits < 0) throw new Error(`NASA CMR response has an invalid CMR-Hits header: ${value}`);
  return hits;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let query;
  let page;
  try {
    query = readQuery(req.query.q);
    page = readPage(req.query.page);
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid NASA CMR collection search query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const upstreamUrl = new URL(CMR_COLLECTIONS_URL);
    upstreamUrl.searchParams.set('keyword', query);
    upstreamUrl.searchParams.set('page_size', String(PAGE_SIZE));
    upstreamUrl.searchParams.set('page_num', String(page));
    const upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`NASA CMR request failed with HTTP ${upstream.status}: ${body}`);

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (cause) {
      throw new Error(`NASA CMR returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    const feed = requireRecord(payload?.feed, 'feed');
    if (!Array.isArray(feed.entry)) throw new Error('NASA CMR response is missing feed.entry.');

    const records = feed.entry.map(compactCollection);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({
      records,
      total: parseHits(upstream.headers.get('cmr-hits')),
      page,
      limit: PAGE_SIZE,
      source: 'NASA Earthdata CMR · collection metadata',
      sourceUrl: CMR_DOCUMENTATION_URL,
      fetchedAt: new Date().toISOString()
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA CMR collection search failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

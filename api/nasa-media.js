const NASA_IMAGES_URL = 'https://images-api.nasa.gov/search';
const PAGE_SIZE = 20;

function readQuery(value) {
  if (typeof value !== 'string') throw new Error('q is required.');
  const query = value.trim();
  if (query.length < 2 || query.length > 100) throw new Error('q must contain between 2 and 100 characters.');
  return query;
}

function readPage(value) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('page must be a positive integer.');
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('page must be between 1 and 100.');
  return page;
}

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`NASA Image Library response has an invalid ${field} record.`);
  return value;
}

function url(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA Image Library item is missing ${field}.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`NASA Image Library item has an invalid ${field}: ${value}`);
  }
}

function nullableDate(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`NASA Image Library item has an invalid ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA Image Library item has an invalid ${field}: ${value}`);
  return value;
}

function normalizeItem(raw) {
  const item = record(raw, 'item');
  if (!Array.isArray(item.data) || item.data.length === 0) throw new Error('NASA Image Library item has no metadata.');
  const data = record(item.data[0], 'metadata');
  if (data.media_type !== 'image') throw new Error('NASA Image Library returned a non-image item for an image-only request.');
  if (typeof data.nasa_id !== 'string' || data.nasa_id.length === 0) throw new Error('NASA Image Library item is missing nasa_id.');
  if (typeof data.title !== 'string' || data.title.length === 0) throw new Error(`NASA Image Library item ${data.nasa_id} is missing title.`);
  if (!Array.isArray(item.links)) throw new Error(`NASA Image Library item ${data.nasa_id} has no image links.`);
  const preview = item.links.find((link) => {
    const candidate = record(link, 'link');
    return candidate.render === 'image' && typeof candidate.href === 'string' && candidate.href.length > 0;
  });
  if (!preview) throw new Error(`NASA Image Library item ${data.nasa_id} has no image preview.`);

  return {
    nasaId: data.nasa_id,
    title: data.title,
    description: typeof data.description === 'string' ? data.description : null,
    center: typeof data.center === 'string' ? data.center : null,
    dateCreated: nullableDate(data.date_created, `${data.nasa_id} date_created`),
    thumbnailUrl: url(preview.href, `${data.nasa_id} thumbnail URL`),
    assetUrl: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let query;
  let page;
  try {
    query = readQuery(req.query.q);
    page = readPage(req.query.page);
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid NASA media search query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const upstreamUrl = new URL(NASA_IMAGES_URL);
    upstreamUrl.searchParams.set('q', query);
    upstreamUrl.searchParams.set('media_type', 'image');
    upstreamUrl.searchParams.set('page', String(page));
    const upstream = await fetch(upstreamUrl);
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`NASA Image Library request failed with HTTP ${upstream.status}: ${body}`);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (cause) {
      throw new Error(`NASA Image Library returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (!payload || typeof payload !== 'object' || !payload.collection || typeof payload.collection !== 'object' || !Array.isArray(payload.collection.items)) {
      throw new Error('NASA Image Library response is missing collection.items.');
    }

    const items = [];
    let omittedItems = 0;
    for (const raw of payload.collection.items) {
      try {
        items.push(normalizeItem(raw));
      } catch {
        omittedItems += 1;
      }
    }
    if (payload.collection.items.length > 0 && items.length === 0) {
      throw new Error('NASA Image Library returned no usable image records.');
    }
    const total = Number(payload.collection.metadata?.total_hits);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error('NASA Image Library response has an invalid metadata.total_hits value.');

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({
      items: items.slice(0, PAGE_SIZE),
      total,
      page,
      limit: PAGE_SIZE,
      omittedItems,
      source: 'NASA Image and Video Library',
      sourceUrl: `https://images.nasa.gov/search-results?q=${encodeURIComponent(query)}`,
      fetchedAt: new Date().toISOString()
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA Image Library request failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

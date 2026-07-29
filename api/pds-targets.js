const PDS_PRODUCTS_URL = 'https://pds.nasa.gov/api/search/1/products';
const PDS_DOCUMENTATION_URL = 'https://nasa-pds.github.io/pds-api/guides/search.html';
const PAGE_SIZE = 12;

function requireRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`NASA PDS response has an invalid ${field} record.`);
  }
  return value;
}

function readTarget(value) {
  if (typeof value !== 'string') throw new Error('target is required.');
  const target = value.trim();
  if (target.length < 2 || target.length > 80) throw new Error('target must contain between 2 and 80 characters.');
  if (!/^[A-Za-z0-9 .-]+$/.test(target)) throw new Error('target may contain only letters, numbers, spaces, periods and hyphens.');
  return target;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`NASA PDS product is missing ${field}.`);
  return value;
}

function date(value, field) {
  const raw = requiredString(value, field);
  if (Number.isNaN(Date.parse(raw))) throw new Error(`NASA PDS product has an invalid ${field}: ${raw}`);
  return raw;
}

function url(value, field) {
  const raw = requiredString(value, field);
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`NASA PDS product has an invalid ${field}: ${raw}`);
  }
}

function compactProduct(raw) {
  const product = requireRecord(raw, 'product');
  const id = requiredString(product.id, 'id');
  const metadata = requireRecord(product.metadata, `${id} metadata`);
  return {
    id,
    type: requiredString(product.type, `${id} type`),
    title: requiredString(product.title, `${id} title`),
    version: requiredString(metadata.version, `${id} metadata version`),
    updatedAt: date(metadata.update_date_time, `${id} metadata update_date_time`),
    labelUrl: url(metadata.label_url, `${id} metadata label_url`)
  };
}

function parseHits(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('NASA PDS response has an invalid summary.hits value.');
  }
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let target;
  try {
    target = readTarget(req.query.target);
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid NASA PDS target query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const upstreamUrl = new URL(PDS_PRODUCTS_URL);
    upstreamUrl.searchParams.set('q', `(pds:Target.pds:name eq "${target}")`);
    upstreamUrl.searchParams.set('limit', String(PAGE_SIZE));
    const upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`NASA PDS request failed with HTTP ${upstream.status}: ${body}`);

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (cause) {
      throw new Error(`NASA PDS returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    const response = requireRecord(payload, 'response');
    if (!Array.isArray(response.data)) throw new Error('NASA PDS response is missing data.');
    const summary = requireRecord(response.summary, 'summary');

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=900');
    return res.status(200).json({
      records: response.data.map(compactProduct),
      total: parseHits(summary.hits),
      target,
      limit: PAGE_SIZE,
      source: 'NASA PDS API · target context metadata',
      sourceUrl: PDS_DOCUMENTATION_URL,
      fetchedAt: new Date().toISOString(),
      coverage: 'partial'
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA PDS target lookup failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

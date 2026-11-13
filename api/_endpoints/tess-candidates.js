const FIELDS = [
  'toi', 'tid', 'tfopwg_disp', 'pl_orbper', 'pl_trandurh', 'pl_trandep', 'pl_rade', 'pl_insol',
  'pl_eqt', 'st_dist', 'st_teff', 'ra', 'dec', 'toi_created', 'release_date', 'sectors'
];
const MAX_ROWS = 12000;
const SNAPSHOT_TTL_MS = 60 * 60 * 1000;

let candidateSnapshot = null;
let candidateSnapshotRequest = null;

function readPage(value) {
  if (value === undefined) return 0;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('page must be a non-negative integer.');
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page > 200) throw new Error('page must be between 0 and 200.');
  return page;
}

function readLimit(value) {
  if (value === undefined) return 48;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('limit must be an integer.');
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 12 || limit > 72) throw new Error('limit must be between 12 and 72.');
  return limit;
}

function readQuery(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 80 || !/^[A-Za-z0-9 .+-]+$/.test(value)) {
    throw new Error('q may contain only letters, digits, spaces, periods, plus and hyphen.');
  }
  return value.trim().toUpperCase();
}

function nullableNumber(value, field, record) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`NASA Exoplanet Archive TOI ${record.toi ?? '(unnamed)'} has an invalid ${field} value.`);
  }
  return value;
}

function nullableString(value, field, record) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`NASA Exoplanet Archive TOI ${record.toi ?? '(unnamed)'} has an invalid ${field} value.`);
  }
  return value;
}

function normalizeRecord(record) {
  if (typeof record !== 'object' || record === null || typeof record.toi !== 'string' || !record.toi || typeof record.tfopwg_disp !== 'string') {
    throw new Error('NASA Exoplanet Archive returned a TOI record without an identifier or disposition.');
  }
  if (record.tfopwg_disp !== 'PC') {
    throw new Error(`NASA Exoplanet Archive TOI ${record.toi} was not returned with the requested PC disposition.`);
  }
  return {
    toi: record.toi,
    ticId: nullableNumber(record.tid, 'tid', record),
    disposition: record.tfopwg_disp,
    periodDays: nullableNumber(record.pl_orbper, 'pl_orbper', record),
    durationHours: nullableNumber(record.pl_trandurh, 'pl_trandurh', record),
    transitDepthPpm: nullableNumber(record.pl_trandep, 'pl_trandep', record),
    radiusEarth: nullableNumber(record.pl_rade, 'pl_rade', record),
    insolationEarth: nullableNumber(record.pl_insol, 'pl_insol', record),
    equilibriumTemperatureK: nullableNumber(record.pl_eqt, 'pl_eqt', record),
    distanceParsecs: nullableNumber(record.st_dist, 'st_dist', record),
    starTemperatureK: nullableNumber(record.st_teff, 'st_teff', record),
    rightAscensionDeg: nullableNumber(record.ra, 'ra', record),
    declinationDeg: nullableNumber(record.dec, 'dec', record),
    createdAt: nullableString(record.toi_created, 'toi_created', record),
    releaseDate: nullableString(record.release_date, 'release_date', record),
    sectors: nullableString(record.sectors, 'sectors', record)
  };
}

function tapQuery() {
  return `select top ${MAX_ROWS} ${FIELDS.join(',')} from toi where tfopwg_disp = 'PC' order by toi`;
}

function filterCandidates(catalogue, query) {
  if (!query) return catalogue;
  return catalogue.filter((record) => record.toi.toUpperCase().includes(query) || String(record.ticId ?? '').includes(query));
}

async function requestCandidateSnapshot() {
  const url = new URL('https://exoplanetarchive.ipac.caltech.edu/TAP/sync');
  url.searchParams.set('query', tapQuery());
  url.searchParams.set('format', 'json');

  let upstream;
  let payload;
  try {
    upstream = await fetch(url);
    const body = await upstream.text();
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(`NASA Exoplanet Archive TOI request returned invalid JSON (${upstream.status}): ${body.slice(0, 280) || '(empty response)'}`);
    }
  } catch (cause) {
    throw new Error(`NASA Exoplanet Archive TOI request could not be completed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!upstream.ok || !Array.isArray(payload)) {
    throw new Error(`NASA Exoplanet Archive TOI request failed (${upstream.status}): ${payload?.error ?? '(no API error supplied)'}`);
  }
  try {
    return { catalogue: payload.map(normalizeRecord), fetchedAt: new Date().toISOString() };
  } catch (cause) {
    throw new Error(`NASA Exoplanet Archive TOI response could not be parsed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function loadCandidateSnapshot() {
  if (candidateSnapshot && Date.now() - Date.parse(candidateSnapshot.fetchedAt) < SNAPSHOT_TTL_MS) return candidateSnapshot;
  if (candidateSnapshotRequest) return candidateSnapshotRequest;
  candidateSnapshotRequest = requestCandidateSnapshot()
    .then((nextSnapshot) => {
      candidateSnapshot = nextSnapshot;
      return nextSnapshot;
    })
    .finally(() => {
      candidateSnapshotRequest = null;
    });
  return candidateSnapshotRequest;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let filters;
  try {
    filters = { q: readQuery(req.query.q), page: readPage(req.query.page), limit: readLimit(req.query.limit) };
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid TESS candidate catalogue query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const snapshot = await loadCandidateSnapshot();
    const catalogue = filterCandidates(snapshot.catalogue, filters.q);
    const start = filters.page * filters.limit;
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({
      records: catalogue.slice(start, start + filters.limit),
      total: catalogue.length,
      page: filters.page,
      limit: filters.limit,
      source: 'NASA Exoplanet Archive · TESS TOI · PC',
      sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html',
      fetchedAt: snapshot.fetchedAt
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA Exoplanet Archive TESS candidate catalogue could not be loaded.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

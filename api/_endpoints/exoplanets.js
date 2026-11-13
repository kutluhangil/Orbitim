const FIELDS = [
  'pl_name', 'hostname', 'discoverymethod', 'disc_year', 'pl_rade', 'pl_bmasse', 'pl_orbper', 'pl_eqt',
  'sy_dist', 'st_teff', 'ra', 'dec', 'disc_facility', 'pl_orbsmax', 'pl_orbeccen'
];
const METHOD_FILTERS = {
  all: null,
  astrometry: 'Astrometry',
  'disk-kinematics': 'Disk Kinematics',
  'eclipse-timing-variations': 'Eclipse Timing Variations',
  'orbital-brightness-modulation': 'Orbital Brightness Modulation',
  'pulsar-timing': 'Pulsar Timing',
  'pulsation-timing-variations': 'Pulsation Timing Variations',
  transit: 'Transit',
  'transit-timing-variations': 'Transit Timing Variations',
  'radial-velocity': 'Radial Velocity',
  imaging: 'Imaging',
  microlensing: 'Microlensing'
};
const MAX_ROWS = 12000;
const SNAPSHOT_TTL_MS = 60 * 60 * 1000;

let archiveSnapshot = null;
let archiveSnapshotRequest = null;

function readPage(value) {
  if (value === undefined) return 0;
  if (typeof value !== 'string') throw new Error('page must be supplied once as a string.');
  if (!/^\d+$/.test(value)) throw new Error('page must be a non-negative integer.');
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page > 200) throw new Error('page must be between 0 and 200.');
  return page;
}

function readLimit(value) {
  if (value === undefined) return 48;
  if (typeof value !== 'string') throw new Error('limit must be supplied once as a string.');
  if (!/^\d+$/.test(value)) throw new Error('limit must be an integer.');
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 12 || limit > 72) throw new Error('limit must be between 12 and 72.');
  return limit;
}

function readQuery(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') throw new Error('q must be supplied once as a string.');
  if (value.length > 80 || !/^[A-Za-z0-9 .+-]+$/.test(value)) {
    throw new Error('q may contain only letters, digits, spaces, periods, plus and hyphen.');
  }
  return value.trim().toUpperCase();
}

function readMethod(value) {
  if (value === undefined || value === '') return 'all';
  if (typeof value !== 'string') throw new Error('method must be supplied once as a string.');
  if (!Object.hasOwn(METHOD_FILTERS, value)) throw new Error('method is not a supported discovery-method filter.');
  return value;
}

function tapQuery() {
  return `select top ${MAX_ROWS} ${FIELDS.join(',')} from pscomppars order by pl_name`;
}

function nullableNumber(value, field, record) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`NASA Exoplanet Archive record ${record.pl_name ?? '(unnamed)'} has an invalid ${field} value.`);
  }
  return value;
}

function nullableString(value, field, record) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`NASA Exoplanet Archive record ${record.pl_name ?? '(unnamed)'} has an invalid ${field} value.`);
  }
  return value;
}

function normalizeRecord(record) {
  if (typeof record !== 'object' || record === null || typeof record.pl_name !== 'string' || !record.pl_name || typeof record.hostname !== 'string' || !record.hostname) {
    throw new Error('NASA Exoplanet Archive returned a record without a planet name and host star.');
  }
  return {
    name: record.pl_name,
    hostName: record.hostname,
    discoveryMethod: nullableString(record.discoverymethod, 'discoverymethod', record),
    discoveryYear: nullableNumber(record.disc_year, 'disc_year', record),
    radiusEarth: nullableNumber(record.pl_rade, 'pl_rade', record),
    massEarth: nullableNumber(record.pl_bmasse, 'pl_bmasse', record),
    orbitDays: nullableNumber(record.pl_orbper, 'pl_orbper', record),
    equilibriumTemperatureK: nullableNumber(record.pl_eqt, 'pl_eqt', record),
    distanceParsecs: nullableNumber(record.sy_dist, 'sy_dist', record),
    starTemperatureK: nullableNumber(record.st_teff, 'st_teff', record),
    rightAscensionDeg: nullableNumber(record.ra, 'ra', record),
    declinationDeg: nullableNumber(record.dec, 'dec', record),
    facility: nullableString(record.disc_facility, 'disc_facility', record),
    semiMajorAxisAu: nullableNumber(record.pl_orbsmax, 'pl_orbsmax', record),
    eccentricity: nullableNumber(record.pl_orbeccen, 'pl_orbeccen', record)
  };
}

function filterCatalogue(catalogue, { q, method }) {
  const discoveryMethod = METHOD_FILTERS[method];
  return catalogue.filter((record) => {
    if (q && !record.name.toUpperCase().includes(q) && !record.hostName.toUpperCase().includes(q)) return false;
    return discoveryMethod === null || record.discoveryMethod === discoveryMethod;
  });
}

async function requestArchiveSnapshot() {
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
      throw new Error(`NASA Exoplanet Archive request returned invalid JSON (${upstream.status}): ${body.slice(0, 280) || '(empty response)'}`);
    }
  } catch (cause) {
    throw new Error(`NASA Exoplanet Archive request could not be completed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  if (!upstream.ok || !Array.isArray(payload)) {
    throw new Error(`NASA Exoplanet Archive request failed (${upstream.status}): ${payload?.error ?? '(no API error supplied)'}`);
  }

  try {
    return { catalogue: payload.map(normalizeRecord), fetchedAt: new Date().toISOString() };
  } catch (cause) {
    throw new Error(`NASA Exoplanet Archive response could not be parsed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function loadArchiveSnapshot() {
  if (archiveSnapshot && Date.now() - Date.parse(archiveSnapshot.fetchedAt) < SNAPSHOT_TTL_MS) return archiveSnapshot;
  if (archiveSnapshotRequest) return archiveSnapshotRequest;

  archiveSnapshotRequest = requestArchiveSnapshot()
    .then((nextSnapshot) => {
      archiveSnapshot = nextSnapshot;
      return nextSnapshot;
    })
    .finally(() => {
      archiveSnapshotRequest = null;
    });
  return archiveSnapshotRequest;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let filters;
  try {
    filters = {
      q: readQuery(req.query.q),
      method: readMethod(req.query.method),
      page: readPage(req.query.page),
      limit: readLimit(req.query.limit)
    };
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid exoplanet catalogue query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const snapshot = await loadArchiveSnapshot();
    const catalogue = filterCatalogue(snapshot.catalogue, filters);
    const start = filters.page * filters.limit;
    const records = catalogue.slice(start, start + filters.limit);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({
      records,
      total: catalogue.length,
      page: filters.page,
      limit: filters.limit,
      source: 'NASA Exoplanet Archive · PSCompPars',
      sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/API_resources.html',
      fetchedAt: snapshot.fetchedAt
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA Exoplanet Archive catalogue could not be loaded.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

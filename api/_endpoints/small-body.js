const CACHE_TTL_MS = 10 * 60 * 1000;
const RESPONSE_TTL = 's-maxage=600, stale-while-revalidate=300';
const SBDB_API_URL = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
const SBDB_DOCS_URL = 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html';

const cache = new Map();

function readQuery(value) {
  if (typeof value !== 'string') throw new Error('q must be supplied once as a string.');
  const query = value.trim();
  if (query.length < 1 || query.length > 80 || !/^[A-Za-z0-9 .+()/_'-]+$/.test(query)) {
    throw new Error('q must be 1–80 characters and contain only letters, digits, spaces, periods, plus, apostrophes, parentheses, slash, underscore or hyphen.');
  }
  return query;
}

function nullableNumber(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`JPL SBDB response has an invalid ${field} value.`);
  return number;
}

function nullableString(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`JPL SBDB response has an invalid ${field} value.`);
  return value;
}

function field(records, name, context) {
  if (!Array.isArray(records)) return null;
  const record = records.find((item) => item && item.name === name);
  return record ? nullableNumber(record.value, `${context}.${name}`) : null;
}

function physical(records, name) {
  if (!Array.isArray(records)) return null;
  const record = records.find((item) => item && item.name === name);
  if (!record) return null;
  const value = nullableNumber(record.value, `phys_par.${name}`);
  if (value === null) return null;
  if (name === 'diameter' && record.units === 'm') return value / 1000;
  if (name === 'rot_per' && record.units === 'd') return value * 24;
  return value;
}

function normalizeApproaches(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((record) => {
    if (!record || typeof record !== 'object') throw new Error('JPL SBDB close-approach record is invalid.');
    const at = nullableString(record.cd, 'ca_data.cd');
    if (!at) throw new Error('JPL SBDB close-approach record is missing cd.');
    return {
      at,
      distanceAu: nullableNumber(record.dist, 'ca_data.dist'),
      velocityKmS: nullableNumber(record.v_rel, 'ca_data.v_rel'),
      uncertainty: nullableString(record.sigma_tf, 'ca_data.sigma_tf')
    };
  });
}

export function normalizeSbdbPayload(payload, query, fetchedAt = new Date().toISOString()) {
  if (!payload || typeof payload !== 'object' || typeof payload.signature?.source !== 'string' || typeof payload.signature?.version !== 'string') {
    throw new Error('JPL SBDB response is missing its API signature.');
  }

  const base = {
    query,
    source: payload.signature.source,
    sourceUrl: SBDB_DOCS_URL,
    fetchedAt
  };

  if (payload.code === '300' || payload.code === 300 || Array.isArray(payload.list)) {
    if (!Array.isArray(payload.list)) throw new Error('JPL SBDB marked the query ambiguous without a match list.');
    const matches = payload.list.slice(0, 12).map((item) => {
      const designation = nullableString(item?.pdes, 'list.pdes');
      const name = nullableString(item?.name, 'list.name');
      if (!designation || !name) throw new Error('JPL SBDB match list contains an incomplete object.');
      return { designation, name };
    });
    return { kind: 'ambiguous', matches, record: null, ...base };
  }

  if (!payload.object) {
    if (typeof payload.message === 'string' && /not found|no object|no match/i.test(payload.message)) {
      return { kind: 'not-found', matches: [], record: null, ...base };
    }
    throw new Error(`JPL SBDB response has no object section${payload.message ? `: ${payload.message}` : '.'}`);
  }

  const object = payload.object;
  const designation = nullableString(object.des, 'object.des');
  const name = nullableString(object.fullname, 'object.fullname') ?? nullableString(object.shortname, 'object.shortname') ?? designation;
  if (!designation || !name) throw new Error('JPL SBDB object is missing a designation or display name.');
  const orbit = payload.orbit;
  if (!orbit || typeof orbit !== 'object') throw new Error('JPL SBDB response is missing the default orbit section.');

  const record = {
    name,
    designation,
    kind: nullableString(object.kind, 'object.kind'),
    orbitClass: nullableString(object.orbit_class?.name, 'object.orbit_class.name'),
    neo: typeof object.neo === 'boolean' ? object.neo : null,
    pha: typeof object.pha === 'boolean' ? object.pha : null,
    diameterKm: physical(payload.phys_par, 'diameter'),
    absoluteMagnitude: physical(payload.phys_par, 'H'),
    albedo: physical(payload.phys_par, 'albedo'),
    rotationHours: physical(payload.phys_par, 'rot_per'),
    perihelionAu: field(orbit.elements, 'q', 'orbit.elements'),
    aphelionAu: field(orbit.elements, 'ad', 'orbit.elements'),
    semiMajorAu: field(orbit.elements, 'a', 'orbit.elements'),
    eccentricity: field(orbit.elements, 'e', 'orbit.elements'),
    inclinationDeg: field(orbit.elements, 'i', 'orbit.elements'),
    earthMoidAu: nullableNumber(orbit.moid, 'orbit.moid'),
    conditionCode: nullableString(orbit.condition_code, 'orbit.condition_code'),
    lastObserved: nullableString(orbit.last_obs, 'orbit.last_obs'),
    earthApproaches: normalizeApproaches(payload.ca_data),
    detailUrl: `${SBDB_API_URL}?sstr=${encodeURIComponent(designation)}&phys-par=1&ca-data=1&ca-body=Earth&ca-time=cd`
  };
  return { kind: 'resolved', matches: [], record, ...base };
}

async function load(query) {
  const key = query.toUpperCase();
  const cached = cache.get(key);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS) return cached;

  const url = new URL(SBDB_API_URL);
  for (const [keyName, value] of Object.entries({
    sstr: query, 'phys-par': '1', 'ca-data': '1', 'ca-body': 'Earth', 'ca-time': 'cd', 'ca-tunc': 'fmt'
  })) url.searchParams.set(keyName, value);

  let upstream;
  let payload;
  try {
    upstream = await fetch(url);
    const body = await upstream.text();
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(`JPL SBDB request returned invalid JSON (${upstream.status}): ${body.slice(0, 280) || '(empty response)'}`);
    }
  } catch (cause) {
    throw new Error(`JPL SBDB request could not be completed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!upstream.ok && upstream.status !== 300) throw new Error(`JPL SBDB request failed (${upstream.status}): ${payload?.message ?? payload?.error ?? '(no detail)'}`);

  const result = normalizeSbdbPayload(payload, query);
  cache.set(key, result);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let query;
  try {
    query = readQuery(req.query.q);
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid small-body query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const result = await load(query);
    res.setHeader('Cache-Control', RESPONSE_TTL);
    return res.status(200).json(result);
  } catch (cause) {
    return res.status(502).json({ error: 'JPL SBDB object lookup could not be loaded.', detail: cause instanceof Error ? cause.message : String(cause) });
  }
}

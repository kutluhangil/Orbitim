const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RESPONSE_TTL = 's-maxage=900, stale-while-revalidate=300';
const NED_API_DOCS_URL = 'https://ned.ipac.caltech.edu/Docs::API/';
const NED_OVERVIEW_URL = 'https://ned.ipac.caltech.edu/NED::API/OverviewOfObject';

const lookupCache = new Map();

function readQuery(value) {
  if (typeof value !== 'string') throw new Error('q must be supplied once as a string.');
  const query = value.trim();
  if (query.length < 1 || query.length > 80 || !/^[A-Za-z0-9 .+()/_'-]+$/.test(query)) {
    throw new Error('q must be 1–80 characters and contain only letters, digits, spaces, periods, plus, apostrophes, parentheses, slash, underscore or hyphen.');
  }
  return query;
}

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

function readAttributes(source) {
  const attributes = {};
  const matcher = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let match = matcher.exec(source); match; match = matcher.exec(source)) attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? '');
  return attributes;
}

function readParamValue(xml, name) {
  const matcher = /<PARAM\b([^>]*)>/gi;
  for (let match = matcher.exec(xml); match; match = matcher.exec(xml)) {
    const attributes = readAttributes(match[1]);
    if (attributes.name === name) return attributes.value ?? null;
  }
  return null;
}

function readFieldIds(xml) {
  const fields = [];
  const matcher = /<FIELD\b([^>]*)>/gi;
  for (let match = matcher.exec(xml); match; match = matcher.exec(xml)) {
    const id = readAttributes(match[1]).ID;
    if (!id) throw new Error('NED VOTable returned a field without an ID.');
    fields.push(id);
  }
  return fields;
}

function readFirstTableRow(xml) {
  const rowMatch = xml.match(/<TR\b[^>]*>([\s\S]*?)<\/TR>/i);
  if (!rowMatch) return null;
  const cells = [];
  const matcher = /<TD\s*\/\s*>|<TD\b[^>]*>([\s\S]*?)<\/TD>/gi;
  for (let match = matcher.exec(rowMatch[1]); match; match = matcher.exec(rowMatch[1])) cells.push(decodeXml(match[1] ?? ''));
  return cells;
}

function nullableNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`NED VOTable has an invalid ${field} value.`);
  return number;
}

function nullableString(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`NED VOTable has an invalid ${field} value.`);
  return value;
}

function selectDisplayName(crossIds, query) {
  const aliases = crossIds.split(';').map((alias) => alias.trim()).filter(Boolean);
  if (aliases.length === 0) return query;
  return aliases.find((alias) => /^(Messier|M\s|NGC|IC|UGC|Arp|ESO|3C|PKS)\b/i.test(alias)) ?? aliases[0];
}

export function normalizeOverviewVotable(xml, query) {
  if (typeof xml !== 'string' || !/^\s*<\?xml[\s\S]*<VOTABLE\b/i.test(xml)) throw new Error('NED API did not return a VOTable document.');

  const status = readParamValue(xml, 'QUERY_STATUS');
  if (status !== 'OK') {
    const isUnresolvedName = status === 'ERROR' && /Failed to resolve input object name/i.test(xml);
    if (isUnresolvedName) return { kind: 'not-found', query, aliases: [], record: null, sourceUrl: NED_API_DOCS_URL, fetchedAt: new Date().toISOString() };
    throw new Error(`NED API reported query status ${status ?? '(missing)'}.`);
  }

  const fields = readFieldIds(xml);
  const cells = readFirstTableRow(xml);
  if (!cells) throw new Error('NED API marked the query successful but returned no object row.');
  if (cells.length !== fields.length) throw new Error(`NED VOTable column count did not match its field metadata (${cells.length} cells, ${fields.length} fields).`);
  const row = Object.fromEntries(fields.map((field, index) => [field, cells[index]]));
  const crossIds = nullableString(row.CrossID_list, 'cross-identifications');

  return {
    kind: 'resolved',
    query,
    aliases: [],
    record: {
      name: selectDisplayName(crossIds ?? '', query),
      objectTypeCode: nullableString(row.ptype, 'physical type'),
      rightAscensionDeg: nullableNumber(row.equ_j2000_lon, 'right ascension'),
      declinationDeg: nullableNumber(row.equ_j2000_lat, 'declination'),
      redshift: nullableNumber(row.z, 'redshift'),
      redshiftUncertainty: nullableNumber(row.unc_z, 'redshift uncertainty'),
      redshiftReference: nullableString(row.z_refcode, 'redshift reference'),
      detailUrl: `${NED_OVERVIEW_URL}?TARGET=${encodeURIComponent(query)}`
    },
    sourceUrl: NED_API_DOCS_URL,
    fetchedAt: new Date().toISOString()
  };
}

async function requestLookup(query) {
  const url = new URL(NED_OVERVIEW_URL);
  url.searchParams.set('TARGET', query);

  let response;
  let body;
  try {
    response = await fetch(url, { headers: { Accept: 'application/x-votable+xml, text/xml;q=0.9' } });
    body = await response.text();
  } catch (cause) {
    throw new Error(`NED API request could not be completed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  if (!response.ok) throw new Error(`NED API request failed (${response.status}): ${body.slice(0, 280) || '(empty response)'}`);
  return normalizeOverviewVotable(body, query);
}

async function loadLookup(query) {
  const key = query.toUpperCase();
  const cached = lookupCache.get(key);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS) return cached;
  const result = await requestLookup(query);
  lookupCache.set(key, result);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  let query;
  try {
    query = readQuery(req.query.q);
  } catch (cause) {
    return res.status(400).json({ error: 'Invalid deep-sky object query.', detail: cause instanceof Error ? cause.message : String(cause) });
  }

  try {
    const result = await loadLookup(query);
    res.setHeader('Cache-Control', RESPONSE_TTL);
    return res.status(200).json(result);
  } catch (cause) {
    return res.status(502).json({ error: 'NASA/IPAC NED object lookup could not be loaded.', detail: cause instanceof Error ? cause.message : String(cause) });
  }
}

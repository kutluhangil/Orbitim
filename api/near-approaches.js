function fieldIndex(fields, field) {
  const index = fields.indexOf(field);
  if (index === -1) throw new Error(`JPL CAD response is missing the ${field} field.`);
  return index;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  const url = new URL('https://ssd-api.jpl.nasa.gov/cad.api');
  for (const [key, value] of Object.entries({
    'date-min': 'now', 'date-max': '+365', 'dist-max': '0.05', sort: 'date', limit: '6', diameter: 'true', fullname: 'true'
  })) url.searchParams.set(key, value);

  const upstream = await fetch(url);
  const payload = await upstream.json();
  if (!upstream.ok || !Array.isArray(payload.fields) || !Array.isArray(payload.data) || typeof payload.signature?.source !== 'string' || typeof payload.signature?.version !== 'string') {
    return res.status(502).json({ error: `JPL close-approach request failed (${upstream.status}).`, detail: payload.error ?? null });
  }

  try {
    const fields = payload.fields;
    const indices = Object.fromEntries(['cd', 'dist', 'v_rel', 'diameter', 'fullname'].map((field) => [field, fieldIndex(fields, field)]));
    const approaches = payload.data.map((row) => ({
      at: row[indices.cd], distanceAu: Number(row[indices.dist]), velocityKmS: Number(row[indices.v_rel]),
      diameterKm: row[indices.diameter] === null ? null : Number(row[indices.diameter]), name: String(row[indices.fullname]).trim()
    }));
    if (approaches.some((approach) => typeof approach.at !== 'string' || !approach.name || !Number.isFinite(approach.distanceAu) || !Number.isFinite(approach.velocityKmS) || (approach.diameterKm !== null && !Number.isFinite(approach.diameterKm)))) {
      throw new Error('JPL CAD response contains an invalid close-approach record.');
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ approaches, count: payload.count, source: payload.signature.source, version: payload.signature.version });
  } catch (cause) {
    return res.status(502).json({ error: 'JPL close-approach response could not be parsed.', detail: cause instanceof Error ? cause.message : String(cause) });
  }
}

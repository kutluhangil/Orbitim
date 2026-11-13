const EPIC_NATURAL_URL = 'https://epic.gsfc.nasa.gov/api/natural';

function parseObservationTime(value) {
  if (typeof value !== 'string') throw new Error('NASA EPIC metadata is missing the observation date.');
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA EPIC returned an invalid observation date: ${value}`);
  return parsed;
}

function imageUrl(record, observedAt) {
  if (typeof record.image !== 'string' || record.image.length === 0) {
    throw new Error('NASA EPIC metadata is missing the image identifier.');
  }
  const year = String(observedAt.getUTCFullYear());
  const month = String(observedAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(observedAt.getUTCDate()).padStart(2, '0');
  return `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/png/${encodeURIComponent(record.image)}.png`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  try {
    const upstream = await fetch(EPIC_NATURAL_URL);
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`NASA EPIC request failed with HTTP ${upstream.status}: ${body}`);

    let records;
    try {
      records = JSON.parse(body);
    } catch (cause) {
      throw new Error(`NASA EPIC returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (!Array.isArray(records) || records.length === 0) throw new Error('NASA EPIC returned no natural-color observations.');

    const latest = records
      .map((record) => ({ record, observedAt: parseObservationTime(record.date) }))
      .reduce((newest, candidate) => (candidate.observedAt > newest.observedAt ? candidate : newest));

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({
      source: 'NASA EPIC · NOAA DSCOVR',
      sourceUrl: 'https://epic.gsfc.nasa.gov/',
      observedAt: latest.observedAt.toISOString(),
      imageUrl: imageUrl(latest.record, latest.observedAt),
      caption: typeof latest.record.caption === 'string' ? latest.record.caption : null,
      fetchedAt: new Date().toISOString()
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA EPIC observation request failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

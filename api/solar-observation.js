const SDO_AIA_171_URL = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg';

function parsePublishedAt(value) {
  if (!value) throw new Error('NASA SDO did not provide a Last-Modified timestamp for the latest image.');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NASA SDO returned an invalid Last-Modified timestamp: ${value}`);
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  try {
    const upstream = await fetch(SDO_AIA_171_URL, { method: 'HEAD' });
    if (!upstream.ok) throw new Error(`NASA SDO image request failed with HTTP ${upstream.status}.`);
    const publishedAt = parsePublishedAt(upstream.headers.get('last-modified'));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    return res.status(200).json({
      source: 'NASA SDO · AIA 171 Å',
      sourceUrl: 'https://sdo.gsfc.nasa.gov/data/aiahmi/',
      imageUrl: SDO_AIA_171_URL,
      publishedAt: publishedAt.toISOString(),
      fetchedAt: new Date().toISOString(),
      timestampNote: 'NASA SDO publishes this latest-image asset timestamp; it is not presented as the exposure time.'
    });
  } catch (cause) {
    return res.status(502).json({
      error: 'NASA SDO observation request failed.',
      detail: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

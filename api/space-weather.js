const DONKI_BASE_URL = 'https://api.nasa.gov/DONKI';

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

async function requestDonki(endpoint, startDate, endDate, apiKey) {
  const url = new URL(`${DONKI_BASE_URL}/${endpoint}`);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('api_key', apiKey);
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) throw new Error(`NASA DONKI ${endpoint} request failed with HTTP ${response.status}: ${body}`);
  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed)) throw new Error(`NASA DONKI ${endpoint} response is not an array.`);
    return parsed;
  } catch (cause) {
    throw new Error(`NASA DONKI ${endpoint} returned invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'NASA solar weather is not configured. Set NASA_API_KEY in the Vercel project environment.' });

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  const startDate = formatUtcDate(start);
  const endDate = formatUtcDate(now);

  try {
    const [flares, cmes, storms] = await Promise.all([
      requestDonki('FLR', startDate, endDate, apiKey),
      requestDonki('CME', startDate, endDate, apiKey),
      requestDonki('GST', startDate, endDate, apiKey)
    ]);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({ flares, cmes, storms, fetchedAt: now.toISOString(), source: 'NASA DONKI' });
  } catch (cause) {
    return res.status(502).json({ error: 'NASA solar weather request failed.', detail: cause instanceof Error ? cause.message : String(cause) });
  }
}

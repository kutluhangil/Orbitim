const TARGETS = {
  voyager1: '-31',
  voyager2: '-32',
  newhorizons: '-98',
  parker: '-96',
  jwst: '-170'
};

function parsePosition(result) {
  const block = result.match(/\$\$SOE\s*([\s\S]*?)\$\$EOE/);
  if (!block) throw new Error('Horizons response has no vector table.');
  const x = block[1].match(/\bX\s*=\s*([+-]?\d+(?:\.\d+)?E[+-]\d+)/);
  const y = block[1].match(/\bY\s*=\s*([+-]?\d+(?:\.\d+)?E[+-]\d+)/);
  const z = block[1].match(/\bZ\s*=\s*([+-]?\d+(?:\.\d+)?E[+-]\d+)/);
  if (!x || !y || !z) throw new Error('Horizons vector table is missing a position component.');
  return [Number(x[1]), Number(y[1]), Number(z[1])];
}

function asUtcMinute(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is supported.' });

  const target = typeof req.query.target === 'string' ? req.query.target : '';
  const command = TARGETS[target];
  if (!command) return res.status(400).json({ error: 'Unknown Horizons target.' });

  const at = typeof req.query.at === 'string' ? new Date(req.query.at) : new Date();
  if (Number.isNaN(at.getTime()) || at.getUTCFullYear() < 1970 || at.getUTCFullYear() > 2040) {
    return res.status(400).json({ error: 'The requested instant must be between 1970 and 2040 UTC.' });
  }

  const stop = new Date(at.getTime() + 60_000);
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  for (const [key, value] of Object.entries({
    format: 'json', COMMAND: `'${command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS', CENTER: "'@sun'", START_TIME: `'${asUtcMinute(at)}'`,
    STOP_TIME: `'${asUtcMinute(stop)}'`, STEP_SIZE: "'1m'", OUT_UNITS: "'AU-D'", VEC_TABLE: "'2'"
  })) url.searchParams.set(key, value);

  const upstream = await fetch(url);
  const payload = await upstream.json();
  if (!upstream.ok || typeof payload.result !== 'string') {
    return res.status(502).json({ error: `Horizons request failed (${upstream.status}).`, detail: payload.error ?? null });
  }

  try {
    const position = parsePosition(payload.result);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ target, at: at.toISOString(), position, source: 'JPL Horizons API' });
  } catch (cause) {
    return res.status(502).json({ error: 'Horizons response could not be parsed.', detail: cause instanceof Error ? cause.message : String(cause) });
  }
}

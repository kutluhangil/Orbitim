import type { EclipticVec } from '../lib/ephemeris/positions';

export interface HorizonsState {
  target: string;
  at: Date;
  position: EclipticVec;
  source: string;
}

interface HorizonsPayload {
  target?: unknown;
  at?: unknown;
  position?: unknown;
  source?: unknown;
  error?: unknown;
  detail?: unknown;
}

export async function fetchHorizonsState(target: string, at: Date): Promise<HorizonsState> {
  const response = await fetch(`/api/horizons?target=${encodeURIComponent(target)}&at=${encodeURIComponent(at.toISOString())}`);
  const payload = await response.json() as HorizonsPayload;
  if (!response.ok) throw new Error(`${String(payload.error ?? 'Horizons request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (typeof payload.target !== 'string' || typeof payload.at !== 'string' || !Array.isArray(payload.position) || payload.position.length !== 3 || !payload.position.every((value) => typeof value === 'number' && Number.isFinite(value)) || typeof payload.source !== 'string') {
    throw new Error('Horizons response did not contain a valid heliocentric state vector.');
  }
  const epoch = new Date(payload.at);
  if (Number.isNaN(epoch.getTime())) throw new Error('Horizons response did not contain a valid epoch.');
  return { target: payload.target, at: epoch, position: { x: payload.position[0], y: payload.position[1], z: payload.position[2] }, source: payload.source };
}

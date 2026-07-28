import { readApiJson } from './readApiJson';

export interface NearApproach {
  at: string;
  distanceAu: number;
  velocityKmS: number;
  diameterKm: number | null;
  name: string;
}

interface NearApproachesPayload {
  approaches?: unknown;
  source?: unknown;
  version?: unknown;
  error?: unknown;
  detail?: unknown;
}

function isNearApproach(value: unknown): value is NearApproach {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.at === 'string' && typeof item.name === 'string' && typeof item.distanceAu === 'number' && Number.isFinite(item.distanceAu)
    && typeof item.velocityKmS === 'number' && Number.isFinite(item.velocityKmS)
    && (item.diameterKm === null || (typeof item.diameterKm === 'number' && Number.isFinite(item.diameterKm)));
}

export async function fetchNearApproaches(): Promise<{ approaches: NearApproach[]; source: string; version: string | null }> {
  const response = await fetch('/api/near-approaches');
  const payload = await readApiJson<NearApproachesPayload>(response, 'JPL close-approach endpoint');
  if (!response.ok) throw new Error(`${String(payload.error ?? 'JPL close-approach request failed.')}${payload.detail ? ` ${String(payload.detail)}` : ''}`);
  if (!Array.isArray(payload.approaches) || !payload.approaches.every(isNearApproach) || typeof payload.source !== 'string' || (payload.version !== null && typeof payload.version !== 'string')) {
    throw new Error('JPL close-approach response did not have the expected shape.');
  }
  return { approaches: payload.approaches, source: payload.source, version: payload.version as string | null };
}

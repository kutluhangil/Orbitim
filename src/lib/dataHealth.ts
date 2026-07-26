import type { TleResult } from '../services/tle';

export type TleHealth = Omit<TleResult, 'satellites'>;

export function tleSourceLabel(source: TleHealth['source']): string {
  if (source === 'live') return 'Live TLE';
  if (source === 'cache') return 'Cached TLE';
  if (source === 'local_fallback') return 'Mirror fallback';
  return 'Emergency TLE';
}

export function conciseAge(ageMs: number): string {
  const minutes = Math.max(0, Math.floor(ageMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** A terse, truthful health line for the element set currently on screen. */
export function tleHealthLabel(health: TleHealth, now = Date.now()): string {
  const fetchAge = conciseAge(now - health.fetchedAt);
  const epochAge = health.oldestEpochMs === null ? 'epoch unknown' : `epoch ${conciseAge(now - health.oldestEpochMs)}`;
  return `${tleSourceLabel(health.source)} · fetched ${fetchAge} · ${epochAge}`;
}

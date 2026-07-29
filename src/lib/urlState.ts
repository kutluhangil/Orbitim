/**
 * The shareable part of the scene's state, carried in the URL hash so a link is
 * a specific moment: this instant, at this rate, with these constellations and
 * this chosen body/mode.
 * Positions are never stored — they are always recomputed from the instant — so
 * a link stays true however the ephemeris behind it is refined.
 */
import { ALL_BODIES, type BodyId } from '../lib/ephemeris/bodies';
import type { ExperienceMode } from '../scene/viewSettings';

const BODY_IDS = new Set<BodyId>(ALL_BODIES.map((body) => body.id));
const EXPERIENCE_MODES = new Set<ExperienceMode>(['explore', 'scientific', 'now']);

export interface ShareState {
  date: Date;
  multiplier: number;
  playing: boolean;
  groups: string[] | null;
  body: BodyId | null;
  mode: ExperienceMode;
}

/**
 * Reads the hash into a partial state. Every field is optional and validated:
 * a hand-edited or stale link falls back to the live defaults rather than
 * throwing.
 */
export function readShareState(): Partial<ShareState> & { present: boolean } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { present: false };
  const params = new URLSearchParams(hash);

  const result: Partial<ShareState> & { present: boolean } = { present: true };

  const t = params.get('t');
  if (t) {
    const parsed = new Date(t);
    if (!Number.isNaN(parsed.getTime())) result.date = parsed;
  }

  const r = params.get('r');
  if (r) {
    const value = Number(r);
    if (Number.isFinite(value) && value > 0) result.multiplier = value;
  }

  const p = params.get('p');
  if (p === '0' || p === '1') result.playing = p === '1';

  const g = params.get('g');
  if (g) result.groups = g.split(',').filter(Boolean);

  const b = params.get('b');
  if (b && BODY_IDS.has(b as BodyId)) result.body = b as BodyId;

  const m = params.get('m');
  if (m && EXPERIENCE_MODES.has(m as ExperienceMode)) result.mode = m as ExperienceMode;

  return result;
}

/** Serialises the state into a hash string (without the leading #). */
export function serializeShareState(state: ShareState): string {
  const params = new URLSearchParams();
  // Whole-second precision: a shared instant does not need milliseconds, and the
  // shorter string is friendlier to paste.
  params.set('t', state.date.toISOString().replace(/\.\d+Z$/, 'Z'));
  if (state.multiplier !== 1) params.set('r', String(state.multiplier));
  if (!state.playing) params.set('p', '0');
  if (state.groups) params.set('g', state.groups.join(','));
  if (state.body) params.set('b', state.body);
  if (state.mode !== 'explore') params.set('m', state.mode);
  return params.toString();
}

/** The full URL for the current state, for copying to the clipboard. */
export function shareUrl(state: ShareState): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${serializeShareState(state)}`;
}

/** Writes the hash without adding a history entry, so Back is not polluted. */
export function replaceShareState(state: ShareState): void {
  const hash = serializeShareState(state);
  window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
}

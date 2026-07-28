import {
  MoonPhase, SearchMoonPhase, SearchGlobalSolarEclipse, SearchLunarEclipse,
  SearchTransit, Illumination, Ecliptic, GeoVector, MakeTime, Body
} from 'astronomy-engine';
import type { BodyId } from './bodies';

/**
 * Upcoming sky events, all computed from astronomy-engine for the current
 * instant — the same ephemeris the scene runs on, so the list moves with the
 * clock. Eclipses, transits and lunar phases come straight from the library's
 * search functions; conjunctions are found by scanning for the moment two naked-
 * eye planets cross in ecliptic longitude.
 */

export interface SkyEvent {
  id: string;
  label: string;
  /** When it happens. */
  date: Date;
  /** A short qualifier — the eclipse type, the planets involved, and so on. */
  detail: string;
  /** The scientifically relevant body to frame when the event is visited. */
  focusBody: BodyId;
}

export interface MoonPhaseNow {
  /** Phase angle, 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  angle: number;
  /** Illuminated fraction of the disc, 0..1. */
  illum: number;
  name: string;
  /** A moon-phase glyph for the current phase. */
  glyph: string;
  waxing: boolean;
}

const PHASES: readonly { name: string; glyph: string }[] = [
  { name: 'New Moon', glyph: '🌑' },
  { name: 'Waxing Crescent', glyph: '🌒' },
  { name: 'First Quarter', glyph: '🌓' },
  { name: 'Waxing Gibbous', glyph: '🌔' },
  { name: 'Full Moon', glyph: '🌕' },
  { name: 'Waning Gibbous', glyph: '🌖' },
  { name: 'Last Quarter', glyph: '🌗' },
  { name: 'Waning Crescent', glyph: '🌘' }
];

/** Current lunar phase and illumination. */
export function moonPhaseNow(date: Date): MoonPhaseNow {
  const angle = MoonPhase(date);
  const illum = Illumination(Body.Moon, MakeTime(date)).phase_fraction;
  // Eight 45°-wide bins centred on the named phases.
  const index = Math.floor(((angle + 22.5) % 360) / 45);
  return { angle, illum, name: PHASES[index].name, glyph: PHASES[index].glyph, waxing: angle < 180 };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Geocentric ecliptic longitude of a body, degrees. */
function eclipticLongitude(body: Body, date: Date): number {
  return Ecliptic(GeoVector(body, MakeTime(date), true)).elon;
}

/** Smallest signed difference of two angles, degrees, in (−180, 180]. */
function wrap180(delta: number): number {
  let d = ((delta + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

const CONJUNCTION_BODIES: readonly { body: Body; id: BodyId; name: string }[] = [
  { body: Body.Mercury, id: 'mercury', name: 'Mercury' },
  { body: Body.Venus, id: 'venus', name: 'Venus' },
  { body: Body.Mars, id: 'mars', name: 'Mars' },
  { body: Body.Jupiter, id: 'jupiter', name: 'Jupiter' },
  { body: Body.Saturn, id: 'saturn', name: 'Saturn' }
];

/**
 * The next conjunction of two naked-eye planets: a daily scan for the day a pair
 * crosses in ecliptic longitude. Returns the first crossing found, so scanning
 * forward hands back the soonest one and stops early.
 */
function nextConjunction(start: Date): SkyEvent | null {
  const dayMs = 86400000;
  let previous = CONJUNCTION_BODIES.map((b) => eclipticLongitude(b.body, start));

  for (let day = 1; day <= 900; day++) {
    const date = new Date(start.getTime() + day * dayMs);
    const current = CONJUNCTION_BODIES.map((b) => eclipticLongitude(b.body, date));

    for (let i = 0; i < CONJUNCTION_BODIES.length; i++) {
      for (let j = i + 1; j < CONJUNCTION_BODIES.length; j++) {
        const before = wrap180(previous[i] - previous[j]);
        const after = wrap180(current[i] - current[j]);
        // A sign change across ±0, not a wrap past ±180, is a longitude crossing.
        if (before !== 0 && Math.sign(before) !== Math.sign(after) && Math.abs(before) < 90) {
          const separation = angularSeparation(CONJUNCTION_BODIES[i].body, CONJUNCTION_BODIES[j].body, date);
          return {
            id: 'conjunction',
            label: `${CONJUNCTION_BODIES[i].name} & ${CONJUNCTION_BODIES[j].name}`,
            date,
            detail: `in conjunction, ${separation.toFixed(1)}° apart`,
            focusBody: CONJUNCTION_BODIES[i].id
          };
        }
      }
    }
    previous = current;
  }
  return null;
}

/** Angle between two bodies as seen from Earth, degrees. */
function angularSeparation(a: Body, b: Body, date: Date): number {
  const time = MakeTime(date);
  const va = GeoVector(a, time, true);
  const vb = GeoVector(b, time, true);
  const dot = va.x * vb.x + va.y * vb.y + va.z * vb.z;
  const cos = dot / (Math.hypot(va.x, va.y, va.z) * Math.hypot(vb.x, vb.y, vb.z));
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/** The soonest of each kind of event, sorted by date. */
export function upcomingEvents(date: Date): SkyEvent[] {
  const events: SkyEvent[] = [];

  const fullMoon = SearchMoonPhase(180, date, 40);
  if (fullMoon) events.push({ id: 'full', label: 'Full Moon', date: fullMoon.date, detail: 'the Moon fully lit', focusBody: 'moon' });
  const newMoon = SearchMoonPhase(0, date, 40);
  if (newMoon) events.push({ id: 'new', label: 'New Moon', date: newMoon.date, detail: 'the Moon between us and the Sun', focusBody: 'moon' });

  const solar = SearchGlobalSolarEclipse(date);
  events.push({ id: 'solar', label: 'Solar eclipse', date: solar.peak.date, detail: `${capitalise(solar.kind)}, somewhere on Earth`, focusBody: 'earth' });

  const lunar = SearchLunarEclipse(date);
  events.push({ id: 'lunar', label: 'Lunar eclipse', date: lunar.peak.date, detail: `${capitalise(lunar.kind)}`, focusBody: 'moon' });

  const mercuryTransit = SearchTransit(Body.Mercury, date);
  const venusTransit = SearchTransit(Body.Venus, date);
  const transit = mercuryTransit.peak.date <= venusTransit.peak.date
    ? { info: mercuryTransit, name: 'Mercury' }
    : { info: venusTransit, name: 'Venus' };
  events.push({ id: 'transit', label: `Transit of ${transit.name}`, date: transit.info.peak.date, detail: 'across the face of the Sun', focusBody: 'sun' });

  const conjunction = nextConjunction(date);
  if (conjunction) events.push(conjunction);

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** A concise physical explanation paired with the event-navigation action. */
export function eventNarrative(event: SkyEvent): string {
  switch (event.id) {
    case 'full': return 'Earth is between the Sun and Moon; the lunar near side faces sunlight.';
    case 'new': return 'The Moon is near the Sun’s direction, so its illuminated hemisphere faces away from Earth.';
    case 'solar': return 'At peak, the Moon’s shadow geometry aligns with Earth. Visibility remains location-dependent.';
    case 'lunar': return 'The Moon passes through Earth’s shadow; the precise appearance depends on the umbra crossing.';
    case 'transit': return 'The planet crosses the Sun’s apparent disc. Safe solar filtration is required for any observation.';
    case 'conjunction': return 'The bodies share nearly the same ecliptic longitude as viewed from Earth; they remain far apart in space.';
    default: return event.detail;
  }
}

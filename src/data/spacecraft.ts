import { getHeliocentric, type EquatorialVec } from '../lib/ephemeris/positions';
import { elementsAtEpoch, propagateElements, orbitSample, type OrbitalElements } from '../lib/ephemeris/cometOrbit';

/**
 * Active deep-space craft, placed live from real trajectory data — the same
 * clock that moves the planets moves them.
 *
 * Three motion models, each chosen to be honest for the "now" the app opens on:
 *
 * - `coast`: a real JPL Horizons state vector plus straight-line drift. The
 *   Voyagers and New Horizons are ballistic and so far from the Sun that its
 *   pull is negligible, so a constant-velocity coast from a recent epoch tracks
 *   them to well under a scene pixel across any span a visitor scrubs.
 * - `orbit`: a heliocentric ellipse from real osculating elements. Parker's
 *   orbit is reshaped by Venus flybys, so this is its post-final-flyby orbit —
 *   correct for the present, and the trace it will keep repeating.
 * - `lagrange`: JWST holds station at the Sun–Earth L2 point, 1.5 million km
 *   beyond the Earth along the Sun–Earth line. It rides the real Earth position,
 *   so it is always where it should be; the small halo orbit is below scene
 *   scale and left out.
 *
 * Every position is in the J2000 mean-equator (EQJ) frame, matching the planets.
 */

const AU_KM = 149597870.7;
/** Epoch of the coast state vectors: 2024-Jan-01 12:00 TDB (JD 2460311.0). */
const COAST_EPOCH_MS = Date.UTC(2024, 0, 1, 12, 0, 0);

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface LocalizedText {
  en: string;
  tr: string;
}

interface MissionDossier {
  /** UTC launch instant, kept as data so the displayed date can follow the UI language. */
  launchDate: string;
  purpose: LocalizedText;
  milestone: LocalizedText;
  sourceUrl: string;
}

type SpacecraftModel =
  /** EQJ heliocentric state vector (km, km/s) drifted at constant velocity. */
  | { kind: 'coast'; posKm: Vec3; velKmS: Vec3 }
  /** Heliocentric ellipse from osculating elements. */
  | { kind: 'orbit'; elements: OrbitalElements }
  /** Fixed distance beyond Earth along the Sun–Earth line (a Lagrange point). */
  | { kind: 'lagrange'; offsetAU: number };

export interface Spacecraft {
  id: string;
  name: string;
  agency: string;
  /** Launch year. */
  launched: number;
  note: string;
  /** NASA-source-backed facts shown in the inspection dossier. */
  dossier: MissionDossier;
  /** UI accent colour. */
  color: string;
  model: SpacecraftModel;
}

/** A single heliocentric vector returned by JPL Horizons for an exact epoch. */
export interface SpacecraftLiveState {
  epochMs: number;
  position: EquatorialVec;
  source: string;
}

export const SPACECRAFT: readonly Spacecraft[] = [
  {
    id: 'voyager1', name: 'Voyager 1', agency: 'NASA', launched: 1977, color: '#f0cf6a',
    note: 'The farthest human-made object; crossed into interstellar space in 2012.',
    dossier: {
      launchDate: '1977-09-05T12:56:00Z',
      purpose: {
        en: 'Survey Jupiter, Saturn and their moons, then extend observation beyond the outer planets.',
        tr: 'Jüpiter, Satürn ve uydularını incelemek; ardından gözlemleri dış gezegenlerin ötesine taşımak.'
      },
      milestone: {
        en: 'Became the most distant human-made object and began the Voyager Interstellar Mission in 1990.',
        tr: 'İnsan yapımı en uzak nesne oldu ve 1990’da Voyager Yıldızlararası Görevi başladı.'
      },
      sourceUrl: 'https://science.nasa.gov/mission/voyager/mission-overview/'
    },
    model: {
      kind: 'coast',
      posKm: { x: -4.631799230306935e9, y: -2.324857027363158e10, z: 5.13234065157972e9 },
      velKmS: { x: -2.07159840493828, y: -16.40150864039787, z: 3.616524180084292 }
    }
  },
  {
    id: 'voyager2', name: 'Voyager 2', agency: 'NASA', launched: 1977, color: '#d6ae52',
    note: 'The only craft to visit all four giant planets; interstellar since 2018.',
    dossier: {
      launchDate: '1977-08-20T14:29:44Z',
      purpose: {
        en: 'Survey the outer planets and their moons, using the rare giant-planet alignment.',
        tr: 'Nadir dev gezegen hizalanmasından yararlanarak dış gezegenleri ve uydularını incelemek.'
      },
      milestone: {
        en: 'Remains the only spacecraft to have visited Uranus and Neptune.',
        tr: 'Uranüs ve Neptün’ü ziyaret etmiş tek uzay aracı olarak kalıyor.'
      },
      sourceUrl: 'https://science.nasa.gov/mission/voyager/mission-overview/'
    },
    model: {
      kind: 'coast',
      posKm: { x: 5.602831338260554e9, y: -8.784856820372715e9, z: -1.736487168105077e10 },
      velKmS: { x: 4.212946105205712, y: -4.064231212147768, z: -14.1144323725803 }
    }
  },
  {
    id: 'newhorizons', name: 'New Horizons', agency: 'NASA', launched: 2006, color: '#8fb8e0',
    note: 'Flew past Pluto in 2015 and Arrokoth in 2019; now deep in the Kuiper Belt.',
    dossier: {
      launchDate: '2006-01-19T19:00:00Z',
      purpose: {
        en: 'Study Pluto, its moons and other objects in the Kuiper Belt.',
        tr: 'Plüton’u, uydularını ve Kuiper Kuşağı’ndaki diğer cisimleri incelemek.'
      },
      milestone: {
        en: 'Made the first close exploration of Pluto in 2015 and Arrokoth in 2019.',
        tr: '2015’te Plüton’un, 2019’da ise Arrokoth’un ilk yakın incelemesini gerçekleştirdi.'
      },
      sourceUrl: 'https://science.nasa.gov/mission/new-horizons/'
    },
    model: {
      kind: 'coast',
      posKm: { x: 2.656826580884252e9, y: -7.669092004818518e9, z: -2.998142360366777e9 },
      velKmS: { x: 5.352098535881597, y: -11.75899429076954, z: -4.557443480319527 }
    }
  },
  {
    id: 'parker', name: 'Parker Solar Probe', agency: 'NASA', launched: 2018, color: '#ff8a5c',
    note: 'Dives through the Sun’s corona — the fastest object ever built.',
    dossier: {
      launchDate: '2018-08-12T07:31:00Z',
      purpose: {
        en: 'Sample the solar corona and investigate the solar wind, magnetic fields and energetic particles.',
        tr: 'Güneş koronası örneklemek; güneş rüzgârını, manyetik alanları ve enerjik parçacıkları incelemek.'
      },
      milestone: {
        en: 'Became the first spacecraft to fly through the Sun’s corona in 2021.',
        tr: '2021’de Güneş’in koronasından geçen ilk uzay aracı oldu.'
      },
      sourceUrl: 'https://science.nasa.gov/mission/parker-solar-probe/'
    },
    model: {
      kind: 'orbit',
      elements: elementsAtEpoch({
        semiMajorAU: 0.388495, eccentricity: 0.881928, inclinationDeg: 3.3954,
        ascendingNodeDeg: 76.6492, argPerihelionDeg: 68.4561, meanAnomalyDeg: 285.1824,
        epochMs: Date.UTC(2025, 5, 1, 0, 0, 0)
      })
    }
  },
  {
    id: 'jwst', name: 'James Webb', agency: 'NASA · ESA · CSA', launched: 2021, color: '#ffd27a',
    note: 'Infrared observatory holding station at the Sun–Earth L2 point.',
    dossier: {
      launchDate: '2021-12-25T12:20:00Z',
      purpose: {
        en: 'Observe the universe in infrared, from the first galaxies to exoplanets and our own solar system.',
        tr: 'İlk galaksilerden ötegezegenlere ve kendi Güneş Sistemimize kadar evreni kızılötesinde gözlemek.'
      },
      milestone: {
        en: 'Operates from a halo orbit around the Sun–Earth L2 point, about 1.5 million kilometres beyond Earth.',
        tr: 'Dünya’nın yaklaşık 1,5 milyon kilometre ötesindeki Güneş–Dünya L2 noktası çevresinde halo yörüngesinde çalışır.'
      },
      sourceUrl: 'https://science.nasa.gov/mission/webb/'
    },
    model: { kind: 'lagrange', offsetAU: 0.01003 }
  }
];

/** Live heliocentric position (EQJ, AU) of a craft at an instant. */
export function spacecraftPosition(craft: Spacecraft, date: Date, live?: SpacecraftLiveState): EquatorialVec {
  // A vector is exact only for its supplied epoch. Do not extrapolate it or imply
  // it remains live after the simulation clock moves away from that instant.
  if (live && Math.abs(live.epochMs - date.getTime()) <= 60_000) return live.position;
  const m = craft.model;
  if (m.kind === 'coast') {
    const days = (date.getTime() - COAST_EPOCH_MS) / 86400000;
    const kmToAuPerDay = 86400 / AU_KM;
    return {
      x: m.posKm.x / AU_KM + m.velKmS.x * kmToAuPerDay * days,
      y: m.posKm.y / AU_KM + m.velKmS.y * kmToAuPerDay * days,
      z: m.posKm.z / AU_KM + m.velKmS.z * kmToAuPerDay * days
    };
  }
  if (m.kind === 'orbit') return propagateElements(m.elements, date);

  // Lagrange L2: same direction as Earth from the Sun, a fixed distance beyond.
  const earth = getHeliocentric('earth', date);
  const r = Math.hypot(earth.x, earth.y, earth.z);
  const scale = (r + m.offsetAU) / r;
  return { x: earth.x * scale, y: earth.y * scale, z: earth.z * scale };
}

/** The closed heliocentric ellipse for an orbiting craft, or null for the rest. */
export function spacecraftOrbit(craft: Spacecraft): EquatorialVec[] | null {
  return craft.model.kind === 'orbit' ? orbitSample(craft.model.elements, 360) : null;
}

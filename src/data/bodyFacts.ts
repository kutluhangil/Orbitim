import type { BodyId } from '../lib/ephemeris/bodies';

/**
 * Static fact sheet. Every value is from the NASA Planetary Fact Sheet
 * (https://nssdc.gsfc.nasa.gov/planetary/factsheet/) or the NASA mission pages.
 * Live values — distance, phase, magnitude — are never stored here; they are
 * computed from the ephemeris at render time.
 */
export interface BodyFacts {
  tagline: string;
  massKg: string;
  gravity: string;
  meanTemp: string;
  dayLength: string;
  yearLength: string | null;
  moons: number | null;
  atmosphere: string;
  /** Missions currently operating at or around the body. */
  activeMissions: string[];
}

export const BODY_FACTS: Record<BodyId, BodyFacts> = {
  sun: {
    tagline: 'The G-type main-sequence star holding the system together.',
    massKg: '1.989 × 10^30 kg',
    gravity: '274 m/s²',
    meanTemp: '5 500 °C surface, 15 000 000 °C core',
    dayLength: '25.4 days at the equator',
    yearLength: null,
    moons: null,
    atmosphere: 'Hydrogen 73%, helium 25%',
    activeMissions: ['Parker Solar Probe', 'Solar Orbiter', 'SOHO', 'Aditya-L1', 'STEREO-A']
  },
  mercury: {
    tagline: 'Smallest planet, and the fastest — one year every 88 days.',
    massKg: '3.301 × 10^23 kg',
    gravity: '3.7 m/s²',
    meanTemp: '167 °C mean, −180 °C to 430 °C',
    dayLength: '4 222.6 hours',
    yearLength: '88.0 days',
    moons: 0,
    atmosphere: 'Trace exosphere: oxygen, sodium, hydrogen',
    activeMissions: ['BepiColombo (arrival phase; orbit insertion Nov 2026)']
  },
  venus: {
    tagline: 'Runaway greenhouse, hot enough to melt lead, spinning backwards.',
    massKg: '4.867 × 10^24 kg',
    gravity: '8.9 m/s²',
    meanTemp: '464 °C',
    dayLength: '2 802 hours, retrograde',
    yearLength: '224.7 days',
    moons: 0,
    atmosphere: 'Carbon dioxide 96%, nitrogen 3.5%, sulphuric acid cloud',
    activeMissions: ['None. Akatsuki operations ended in September 2025']
  },
  earth: {
    tagline: 'The only place where life is known to exist.',
    massKg: '5.972 × 10^24 kg',
    gravity: '9.8 m/s²',
    meanTemp: '15 °C',
    dayLength: '23.93 hours',
    yearLength: '365.26 days',
    moons: 1,
    atmosphere: 'Nitrogen 78%, oxygen 21%',
    activeMissions: ['International Space Station', 'Tiangong', 'Starlink', 'Landsat 9']
  },
  mars: {
    tagline: 'Cold desert world, the most visited planet after our own.',
    massKg: '6.417 × 10^23 kg',
    gravity: '3.7 m/s²',
    meanTemp: '−65 °C',
    dayLength: '24.62 hours',
    yearLength: '687 days',
    moons: 2,
    atmosphere: 'Carbon dioxide 95%, nitrogen 2.8%',
    activeMissions: ['Perseverance', 'Curiosity', 'Mars Reconnaissance Orbiter']
  },
  jupiter: {
    tagline: 'A gas giant with more mass than every other planet combined.',
    massKg: '1.898 × 10^27 kg',
    gravity: '23.1 m/s²',
    meanTemp: '−110 °C',
    dayLength: '9.93 hours',
    yearLength: '11.86 years',
    moons: 101,
    atmosphere: 'Hydrogen 90%, helium 10%',
    activeMissions: ['Juno', 'JUICE (cruise)', 'Europa Clipper (cruise)']
  },
  saturn: {
    tagline: 'Rings of water ice spanning 280 000 km, barely 10 m thick.',
    massKg: '5.683 × 10^26 kg',
    gravity: '9.0 m/s²',
    meanTemp: '−140 °C',
    dayLength: '10.66 hours',
    yearLength: '29.46 years',
    moons: 274,
    atmosphere: 'Hydrogen 96%, helium 3%',
    activeMissions: ['None in orbit since Cassini ended in 2017']
  },
  uranus: {
    tagline: 'An ice giant tipped on its side, orbiting the Sun rolling.',
    massKg: '8.681 × 10^25 kg',
    gravity: '8.7 m/s²',
    meanTemp: '−195 °C',
    dayLength: '17.24 hours, retrograde',
    yearLength: '84.01 years',
    moons: 28,
    atmosphere: 'Hydrogen 83%, helium 15%, methane 2%',
    activeMissions: ['None. Visited once, by Voyager 2 in 1986']
  },
  neptune: {
    tagline: 'Fastest winds in the solar system, over 2 000 km/h.',
    massKg: '1.024 × 10^26 kg',
    gravity: '11.0 m/s²',
    meanTemp: '−200 °C',
    dayLength: '16.11 hours',
    yearLength: '164.8 years',
    moons: 16,
    atmosphere: 'Hydrogen 80%, helium 19%, methane 1.5%',
    activeMissions: ['None. Visited once, by Voyager 2 in 1989']
  },
  moon: {
    tagline: 'Earth’s only natural satellite, tidally locked to us.',
    massKg: '7.346 × 10^22 kg',
    gravity: '1.6 m/s²',
    meanTemp: '−20 °C mean, −173 °C to 127 °C',
    dayLength: '708.7 hours',
    yearLength: '27.32 days around Earth',
    moons: null,
    atmosphere: 'Effectively none',
    activeMissions: ['Lunar Reconnaissance Orbiter', 'Danuri', 'Chandrayaan-2 Orbiter', 'Queqiao-2']
  },
  io: {
    tagline: 'The most volcanically active body known, over 400 volcanoes.',
    massKg: '8.932 × 10^22 kg',
    gravity: '1.8 m/s²',
    meanTemp: '−143 °C',
    dayLength: '42.5 hours, tidally locked',
    yearLength: '1.77 days around Jupiter',
    moons: null,
    atmosphere: 'Thin sulphur dioxide',
    activeMissions: ['Juno flybys']
  },
  europa: {
    tagline: 'A salt-water ocean under ice, twice the water of all Earth’s seas.',
    massKg: '4.800 × 10^22 kg',
    gravity: '1.3 m/s²',
    meanTemp: '−170 °C',
    dayLength: '85.2 hours, tidally locked',
    yearLength: '3.55 days around Jupiter',
    moons: null,
    atmosphere: 'Tenuous oxygen',
    activeMissions: ['Europa Clipper (arrival 2030)']
  },
  ganymede: {
    tagline: 'Largest moon in the solar system, and the only one with a magnetic field.',
    massKg: '1.482 × 10^23 kg',
    gravity: '1.4 m/s²',
    meanTemp: '−163 °C',
    dayLength: '171.7 hours, tidally locked',
    yearLength: '7.15 days around Jupiter',
    moons: null,
    atmosphere: 'Thin oxygen',
    activeMissions: ['JUICE (orbit insertion 2034)']
  },
  callisto: {
    tagline: 'The most heavily cratered surface in the solar system.',
    massKg: '1.076 × 10^23 kg',
    gravity: '1.2 m/s²',
    meanTemp: '−139 °C',
    dayLength: '400.5 hours, tidally locked',
    yearLength: '16.69 days around Jupiter',
    moons: null,
    atmosphere: 'Thin carbon dioxide',
    activeMissions: ['JUICE flybys']
  },
  titan: {
    tagline: 'Thick nitrogen atmosphere, lakes and rivers of liquid methane.',
    massKg: '1.345 × 10^23 kg',
    gravity: '1.4 m/s²',
    meanTemp: '−179 °C',
    dayLength: '382.7 hours, tidally locked',
    yearLength: '15.95 days around Saturn',
    moons: null,
    atmosphere: 'Nitrogen 95%, methane 5%',
    activeMissions: ['Dragonfly (launch 2028)']
  },
  phobos: {
    tagline: 'Spiralling inward; it will strike Mars or shatter within 50 million years.',
    massKg: '1.066 × 10^16 kg',
    gravity: '0.0057 m/s²',
    meanTemp: '−40 °C',
    dayLength: '7.65 hours, tidally locked',
    yearLength: '0.32 days around Mars',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['MMX (launch 2026)']
  },
  deimos: {
    tagline: 'Smaller of the two Martian moons, barely 12 km across.',
    massKg: '1.476 × 10^15 kg',
    gravity: '0.003 m/s²',
    meanTemp: '−40 °C',
    dayLength: '30.3 hours, tidally locked',
    yearLength: '1.26 days around Mars',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None']
  },
  triton: {
    tagline: 'Orbits backwards — a captured Kuiper Belt object with nitrogen geysers.',
    massKg: '2.139 × 10^22 kg',
    gravity: '0.8 m/s²',
    meanTemp: '−235 °C',
    dayLength: '141 hours, tidally locked',
    yearLength: '5.88 days around Neptune, retrograde',
    moons: null,
    atmosphere: 'Thin nitrogen',
    activeMissions: ['None. Visited once, by Voyager 2 in 1989']
  },
  ceres: {
    tagline: 'The largest asteroid and the only dwarf planet inside Neptune.',
    massKg: '9.38 × 10^20 kg',
    gravity: '0.28 m/s²',
    meanTemp: '−105 °C',
    dayLength: '9.07 hours',
    yearLength: '4.6 years',
    moons: 0,
    atmosphere: 'Trace water vapour',
    activeMissions: ['None. Orbited by Dawn 2015–2018']
  },
  pluto: {
    tagline: 'The largest Kuiper Belt world; New Horizons flew past in 2015.',
    massKg: '1.303 × 10^22 kg',
    gravity: '0.62 m/s²',
    meanTemp: '−229 °C',
    dayLength: '153.3 hours, retrograde',
    yearLength: '248.0 years',
    moons: 5,
    atmosphere: 'Thin nitrogen with methane and carbon monoxide',
    activeMissions: ['None. Visited once, by New Horizons in 2015']
  },
  charon: {
    tagline: 'Half Pluto’s size — the two orbit a point in the space between them.',
    massKg: '1.586 × 10^21 kg',
    gravity: '0.29 m/s²',
    meanTemp: '−220 °C',
    dayLength: '6.39 days, tidally locked',
    yearLength: '6.39 days around Pluto',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None. Visited once, by New Horizons in 2015']
  },
  mimas: {
    tagline: 'The “Death Star” moon — one crater, Herschel, a third of its width.',
    massKg: '3.75 × 10^19 kg',
    gravity: '0.064 m/s²',
    meanTemp: '−200 °C',
    dayLength: '22.6 hours, tidally locked',
    yearLength: '0.94 days around Saturn',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None. Studied by Cassini 2004–2017']
  },
  enceladus: {
    tagline: 'Hides a global ocean under ice; geysers erupt from its south pole.',
    massKg: '1.08 × 10^20 kg',
    gravity: '0.113 m/s²',
    meanTemp: '−201 °C',
    dayLength: '32.9 hours, tidally locked',
    yearLength: '1.37 days around Saturn',
    moons: null,
    atmosphere: 'Tenuous water vapour from the plumes',
    activeMissions: ['None. Studied by Cassini 2004–2017']
  },
  rhea: {
    tagline: 'Saturn’s second-largest moon, an ancient cratered ball of ice.',
    massKg: '2.31 × 10^21 kg',
    gravity: '0.264 m/s²',
    meanTemp: '−174 °C',
    dayLength: '4.52 days, tidally locked',
    yearLength: '4.52 days around Saturn',
    moons: null,
    atmosphere: 'Trace oxygen and carbon dioxide',
    activeMissions: ['None. Studied by Cassini 2004–2017']
  },
  iapetus: {
    tagline: 'Two-faced — one hemisphere pitch black, the other bright ice.',
    massKg: '1.81 × 10^21 kg',
    gravity: '0.223 m/s²',
    meanTemp: '−143 °C',
    dayLength: '79.3 days, tidally locked',
    yearLength: '79.3 days around Saturn',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None. Studied by Cassini 2004–2017']
  },
  titania: {
    tagline: 'The largest moon of Uranus, cut by great canyons of ice.',
    massKg: '3.40 × 10^21 kg',
    gravity: '0.379 m/s²',
    meanTemp: '−203 °C',
    dayLength: '8.71 days, tidally locked',
    yearLength: '8.71 days around Uranus',
    moons: null,
    atmosphere: 'Possible trace carbon dioxide',
    activeMissions: ['None. Seen once, by Voyager 2 in 1986']
  },
  oberon: {
    tagline: 'The outermost large moon of Uranus, dark and heavily cratered.',
    massKg: '3.08 × 10^21 kg',
    gravity: '0.346 m/s²',
    meanTemp: '−203 °C',
    dayLength: '13.46 days, tidally locked',
    yearLength: '13.46 days around Uranus',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None. Seen once, by Voyager 2 in 1986']
  },
  miranda: {
    tagline: 'A patchwork of cliffs and terraces — the strangest surface known.',
    massKg: '6.6 × 10^19 kg',
    gravity: '0.079 m/s²',
    meanTemp: '−187 °C',
    dayLength: '1.41 days, tidally locked',
    yearLength: '1.41 days around Uranus',
    moons: null,
    atmosphere: 'None',
    activeMissions: ['None. Seen once, by Voyager 2 in 1986']
  }
};

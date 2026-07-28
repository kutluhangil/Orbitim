import type { BodyId } from '../ephemeris/bodies';
import { graphicsTier } from '../device';

/**
 * Level of detail for surface textures. `far` is loaded for every visible body
 * up front; `near` is fetched only while flying to a body and is discarded when
 * the camera leaves it.
 */
export type Lod = 'far' | 'near';

export interface BodyTextureSet {
  /** Albedo map, always present. */
  map: Record<Lod, string>;
  /** City lights, Earth only. */
  emissiveMap?: Record<Lod, string>;
  /** Ocean/land roughness, low over sea for the sun-glint. Earth only. */
  roughnessMap?: string;
  /** Linear elevation data, loaded only for a close surface visit. */
  heightMap?: string;
  /** Separate cloud shell, Earth only. */
  cloudMap?: string;
  /** Ring alpha strip, sampled radially. */
  ringMap?: string;
}

const T = '/textures';

/**
 * Bodies without a published surface map fall back to a solid shaded sphere
 * tinted by their registry colour rather than to a wrong texture.
 */
export const TEXTURES: Partial<Record<BodyId, BodyTextureSet>> = {
  sun: { map: { far: `${T}/2k_sun.jpg`, near: `${T}/8k_sun.jpg` } },
  mercury: { map: { far: `${T}/2k_mercury.jpg`, near: `${T}/8k_mercury.jpg` } },
  // The cloud deck, not the radar-mapped ground under it: from space Venus is a
  // featureless sulphuric-yellow ball, and the surface is never seen through it.
  // The cloud tops carry almost no detail, so the 2K plate is the whole picture.
  venus: { map: { far: `${T}/2k_venus_atmosphere.webp`, near: `${T}/2k_venus_atmosphere.webp` } },
  earth: {
    map: { far: `${T}/2k_earth_daymap.jpg`, near: `${T}/8k_earth_daymap.jpg` },
    emissiveMap: { far: `${T}/8k_earth_nightmap.jpg`, near: `${T}/8k_earth_nightmap.jpg` },
    roughnessMap: `${T}/earth_roughness.webp`,
    cloudMap: `${T}/8k_earth_clouds.jpg`
  },
  mars: {
    map: { far: `${T}/2k_mars.jpg`, near: `${T}/8k_mars.jpg` },
    heightMap: `${T}/mars_mola_topography.png`
  },
  jupiter: { map: { far: `${T}/2k_jupiter.jpg`, near: `${T}/8k_jupiter.jpg` } },
  saturn: {
    map: { far: `${T}/2k_saturn.jpg`, near: `${T}/8k_saturn.jpg` },
    ringMap: `${T}/8k_saturn_ring_alpha.png`
  },
  uranus: { map: { far: `${T}/2k_uranus.jpg`, near: `${T}/2k_uranus.jpg` } },
  neptune: { map: { far: `${T}/2k_neptune.jpg`, near: `${T}/2k_neptune.jpg` } },
  moon: { map: { far: `${T}/2k_moon.jpg`, near: `${T}/8k_moon.jpg` } },
  // NASA 3D Resources equirectangular maps, built from Galileo/Voyager imaging.
  // These are the published global mosaics; partial-coverage products are not
  // used as if they were complete worlds. See public/textures/ATTRIBUTION.md.
  io: { map: { far: `${T}/nasa_io.jpg`, near: `${T}/nasa_io.jpg` } },
  europa: { map: { far: `${T}/nasa_europa.jpg`, near: `${T}/nasa_europa.jpg` } },
  ganymede: { map: { far: `${T}/nasa_ganymede.jpg`, near: `${T}/nasa_ganymede.jpg` } },
  callisto: { map: { far: `${T}/nasa_callisto.jpg`, near: `${T}/nasa_callisto.jpg` } },
  // Real global mosaics: New Horizons for Pluto and Charon, Dawn for Ceres.
  // Pluto uses NASA's MVIC colour mosaic; its unobserved south is explicitly
  // completed with a featureless mean-albedo fill, never invented terrain.
  // See public/textures/ATTRIBUTION.md.
  ceres: { map: { far: `${T}/ceres.jpg`, near: `${T}/ceres.jpg` } },
  pluto: { map: { far: `${T}/pluto.jpg`, near: `${T}/pluto.jpg` } },
  charon: { map: { far: `${T}/charon.jpg`, near: `${T}/charon.jpg` } },
  // Cassini/Voyager mosaics for the mid-sized Saturnian moons. Mimas and the
  // Uranian moons have no clean global map, so they keep their flat shaded tint.
  enceladus: { map: { far: `${T}/enceladus.jpg`, near: `${T}/enceladus.jpg` } },
  rhea: { map: { far: `${T}/rhea.jpg`, near: `${T}/rhea.jpg` } },
  iapetus: { map: { far: `${T}/iapetus.jpg`, near: `${T}/iapetus.jpg` } }
};

/**
 * The sky plate. The full 8K Milky Way is worth its weight on a machine that can
 * hold it — the band resolves into real star clouds rather than a blur — but a
 * phone keeps the 2K, which is all the background asks for at that size.
 */
export const STARFIELD_TEXTURE =
  graphicsTier === 'high' ? `${T}/8k_stars_milky_way.webp` : `${T}/2k_stars_milky_way.jpg`;

export function getTextureSet(id: BodyId): BodyTextureSet | undefined {
  return TEXTURES[id];
}

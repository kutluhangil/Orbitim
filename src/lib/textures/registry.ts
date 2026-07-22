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
  venus: { map: { far: `${T}/2k_venus_surface.jpg`, near: `${T}/8k_venus_surface.jpg` } },
  earth: {
    map: { far: `${T}/2k_earth_daymap.jpg`, near: `${T}/8k_earth_daymap.jpg` },
    emissiveMap: { far: `${T}/8k_earth_nightmap.jpg`, near: `${T}/8k_earth_nightmap.jpg` },
    roughnessMap: `${T}/earth_roughness.webp`,
    cloudMap: `${T}/8k_earth_clouds.jpg`
  },
  mars: { map: { far: `${T}/2k_mars.jpg`, near: `${T}/8k_mars.jpg` } },
  jupiter: { map: { far: `${T}/2k_jupiter.jpg`, near: `${T}/8k_jupiter.jpg` } },
  saturn: {
    map: { far: `${T}/2k_saturn.jpg`, near: `${T}/8k_saturn.jpg` },
    ringMap: `${T}/8k_saturn_ring_alpha.png`
  },
  uranus: { map: { far: `${T}/2k_uranus.jpg`, near: `${T}/2k_uranus.jpg` } },
  neptune: { map: { far: `${T}/2k_neptune.jpg`, near: `${T}/2k_neptune.jpg` } },
  moon: { map: { far: `${T}/2k_moon.jpg`, near: `${T}/8k_moon.jpg` } }
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

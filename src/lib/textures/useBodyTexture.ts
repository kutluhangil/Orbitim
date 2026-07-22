import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { getTextureSet } from './registry';
import { graphicsTier } from '../device';
import type { BodyId } from '../ephemeris/bodies';
import type { BodyTextureSet, Lod } from './registry';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function load(url: string, colorSpace: THREE.ColorSpace): Promise<THREE.Texture> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = colorSpace;
        texture.anisotropy = 8;
        cache.set(url, texture);
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`Texture failed to load: ${url}`))
    );
  });
}

function release(url: string | undefined): void {
  if (!url) return;
  const texture = cache.get(url);
  if (!texture) return;
  texture.dispose();
  cache.delete(url);
}

function releaseNearTextures(set: BodyTextureSet): void {
  // The far level stays cached: it is what the body falls back to, and it is
  // small enough that keeping every one costs little.
  if (set.map.near !== set.map.far) release(set.map.near);
  if (set.emissiveMap && set.emissiveMap.near !== set.emissiveMap.far) release(set.emissiveMap.near);
  release(set.roughnessMap);
  release(set.cloudMap);
}

export interface BodyTextures {
  map: THREE.Texture | null;
  emissiveMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  cloudMap: THREE.Texture | null;
  ringMap: THREE.Texture | null;
  /** Highest level of detail currently resident. */
  resolvedLod: Lod | null;
}

const EMPTY: BodyTextures = {
  map: null,
  emissiveMap: null,
  roughnessMap: null,
  cloudMap: null,
  ringMap: null,
  resolvedLod: null
};

/**
 * Loads a body's textures at the requested level of detail. The far level is
 * resolved first so a body is never blank, then the near level replaces it once
 * it arrives. Loads for an unmounted body resolve into nothing.
 */
export function useBodyTexture(id: BodyId, requestedLod: Lod): BodyTextures {
  const [textures, setTextures] = useState<BodyTextures>(EMPTY);
  // A phone cannot hold the 8K set, and the night-lights and cloud shells are
  // 8K-only. On the low tier the far maps are the whole story.
  const lod: Lod = graphicsTier === 'low' ? 'far' : requestedLod;

  useEffect(() => {
    const set = getTextureSet(id);
    if (!set) {
      setTextures(EMPTY);
      return;
    }
    let cancelled = false;

    const apply = (level: Lod) =>
      Promise.all([
        load(set.map[level], THREE.SRGBColorSpace),
        set.emissiveMap && graphicsTier === 'high'
          ? load(set.emissiveMap[level], THREE.SRGBColorSpace)
          : Promise.resolve(null),
        set.cloudMap && level === 'near' ? load(set.cloudMap, THREE.SRGBColorSpace) : Promise.resolve(null),
        set.ringMap ? load(set.ringMap, THREE.SRGBColorSpace) : Promise.resolve(null),
        // A roughness mask is data, not colour, so it loads in linear space. Held
        // to the near level like the cloud shell — the glint is only legible from
        // close, and phones stay on the far maps.
        set.roughnessMap && level === 'near'
          ? load(set.roughnessMap, THREE.NoColorSpace)
          : Promise.resolve(null)
      ]).then(([map, emissiveMap, cloudMap, ringMap, roughnessMap]) => {
        if (cancelled) return;
        setTextures((prev) => ({
          map,
          emissiveMap,
          roughnessMap: roughnessMap ?? prev.roughnessMap,
          cloudMap: cloudMap ?? prev.cloudMap,
          ringMap,
          resolvedLod: level
        }));
      });

    apply('far')
      .then(() => (lod === 'near' && !cancelled ? apply('near') : undefined))
      .catch((error) => {
        if (!cancelled) console.error(error);
      });

    return () => {
      cancelled = true;
      // Release this body's near-level maps as the camera leaves it. Without
      // this every visited body keeps its 8K set resident and the driver
      // eventually refuses to bind new textures, leaving bodies untextured.
      if (lod === 'near') releaseNearTextures(set);
    };
  }, [id, lod]);

  return textures;
}

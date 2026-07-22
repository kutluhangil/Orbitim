import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getBodyRecord, getMoonsOf, type BodyId } from '../lib/ephemeris/bodies';
import { J2000_MS } from '../lib/ephemeris/rotation';
import { getTextureSet } from '../lib/textures/registry';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import { useSimTime } from './useSimTime';

/**
 * Surface shading that the stock materials cannot express: eclipse shadows cast
 * by one body onto another, city lights that only burn on the night side, and
 * the zonal jets of the gas giants.
 *
 * All of it is injected into `meshStandardMaterial` and `meshBasicMaterial`
 * rather than replacing them, so the bodies keep three's own lighting, tone
 * mapping and texture handling.
 *
 * The eclipse geometry is exact for the scene as drawn, not for the sky: the
 * scale layer exaggerates every body against its orbit, so a moon covers far
 * more of the Sun here than it does in reality. Eclipses are therefore larger
 * and more frequent than the real ones — the shape, softness and timing are
 * honest to the scene, the rarity is not.
 */

/** The most occluders any one body has: Jupiter, with the four Galilean moons. */
const MAX_OCCLUDERS = 4;

/**
 * Equatorial jet speed relative to the body's bulk rotation, expressed as the
 * fraction of a full turn the jet gains per simulated hour. The gas giants have
 * no solid surface to rotate with, so their cloud bands genuinely slide past
 * one another; the drift is small at real time and obvious at a day a second.
 */
const ZONAL_DRIFT: Partial<Record<BodyId, number>> = {
  jupiter: 0.0008,
  saturn: 0.0032,
  neptune: 0.0042
};

/**
 * Bodies that can pass between this body and the Sun. A planet is eclipsed by
 * its own moons, a moon by its planet. Sibling moons are left out: their mutual
 * eclipses are real but far too brief to catch at any playback rate offered.
 */
function occludersOf(id: BodyId): BodyId[] {
  const record = getBodyRecord(id);
  const casters = record.kind === 'moon' ? [record.parent!] : getMoonsOf(id).map((moon) => moon.id);
  if (casters.length > MAX_OCCLUDERS) {
    throw new Error(
      `${id} has ${casters.length} shadow casters, above the shader limit of ${MAX_OCCLUDERS}`
    );
  }
  return casters;
}

const VARYINGS = /* glsl */ `
  varying vec3 vOrbitimWorld;
  varying vec3 vOrbitimNormal;
`;

/**
 * World position and world normal, carried by hand because three only emits
 * them for materials that use an environment map or a shadow map, and neither
 * is in play here.
 */
const VERTEX_ASSIGN = /* glsl */ `
  vOrbitimWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
  vOrbitimNormal = mat3( modelMatrix ) * normal;
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
  ${VARYINGS}

  // xyz: occluder centre in world space, w: its radius.
  uniform vec4 uOccluders[ ${MAX_OCCLUDERS} ];
  uniform int uOccluderCount;
  uniform float uSunRadius;

  /** Cosine of the local sun angle: 1 at the subsolar point, -1 at midnight. */
  float orbitimDaylight() {
    return dot( normalize( vOrbitimNormal ), normalize( -vOrbitimWorld ) );
  }

  /**
   * Fraction of the Sun still visible from this fragment, 0 in full umbra.
   *
   * The Sun is not a point, so an eclipse is a question of how much of its disc
   * an occluder covers. Both are reduced to angular radii as seen from the
   * fragment and the discs are overlapped: a smooth ramp from first to last
   * contact, capped at the area ratio. That cap is what gives an annular
   * eclipse — a moon too small or too distant to cover the disc never takes the
   * ground fully dark, however exactly it lines up.
   */
  float orbitimSunlight() {
    float sunDistance = length( vOrbitimWorld );
    if ( sunDistance <= 0.0 ) return 1.0;

    vec3 toSun = -vOrbitimWorld / sunDistance;
    float sunAngle = asin( clamp( uSunRadius / sunDistance, 0.0, 1.0 ) );
    if ( sunAngle <= 0.0 ) return 1.0;

    float light = 1.0;

    for ( int i = 0; i < ${MAX_OCCLUDERS}; i++ ) {
      if ( i >= uOccluderCount ) break;

      vec3 toOccluder = uOccluders[ i ].xyz - vOrbitimWorld;
      float occluderDistance = length( toOccluder );
      if ( occluderDistance <= 0.0 ) continue;

      vec3 occluderDirection = toOccluder / occluderDistance;
      float alignment = dot( occluderDirection, toSun );
      // The occluder is behind this fragment, so it shadows the far side.
      if ( alignment <= 0.0 ) continue;

      float occluderAngle = asin( clamp( uOccluders[ i ].w / occluderDistance, 0.0, 1.0 ) );
      if ( occluderAngle <= 0.0 ) continue;

      float separation = acos( clamp( alignment, -1.0, 1.0 ) );
      float contact = 1.0 - smoothstep(
        abs( sunAngle - occluderAngle ),
        sunAngle + occluderAngle,
        separation
      );
      float deepest = min( 1.0, ( occluderAngle * occluderAngle ) / ( sunAngle * sunAngle ) );
      light *= 1.0 - contact * deepest;
    }

    return light;
  }
`;

const DRIFT_DECLARATIONS = /* glsl */ `
  uniform float uDriftHours;
  uniform float uZonalRate;
`;

/**
 * Sampling the albedo map with a latitude-dependent longitude offset, in place
 * of three's straight lookup.
 */
const DRIFT_MAP_FRAGMENT = /* glsl */ `
  #ifdef USE_MAP
    // The jet is fastest at the equator and dies away at the poles.
    float latitude = vMapUv.y * 2.0 - 1.0;
    float zonal = ( 1.0 - latitude * latitude ) * uZonalRate * uDriftHours;
    vec4 sampledDiffuseColor = texture2D( map, vec2( fract( vMapUv.x + zonal ), vMapUv.y ) );
    diffuseColor *= sampledDiffuseColor;
  #endif
`;

/**
 * Light still reaching a fully eclipsed surface. Not zero: an umbra is lit by
 * the ring of atmosphere around the occluder and by the rest of the sky, and a
 * black disc on a planet reads as a hole rather than a shadow.
 */
const UMBRA_FLOOR = 0.06;

/**
 * How far the surface is hazed toward its own atmosphere colour at the limb,
 * where the line of sight grazes the most air. Aerial perspective: the ground
 * near the horizon is seen through kilometres of lit atmosphere and washes out
 * into it. Confined to the daylit side, since it is scattered sunlight.
 */
const AERIAL_STRENGTH = 0.55;

/** How dark a fragment gets under the thickest cloud directly up-sun of it. */
const CLOUD_SHADOW_STRENGTH = 0.6;

/**
 * Bound to the cloud-shadow sampler before the cloud map has loaded — a single
 * black texel reads as no cloud, so the surface stays unshadowed rather than
 * sampling a stale or undefined texture.
 */
const NO_CLOUD = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
NO_CLOUD.needsUpdate = true;

export interface MaterialPatch {
  onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
  customProgramCacheKey: () => string;
}

/**
 * Runs several patches over one material. Each is written to leave the chunks
 * the others hook into intact, so they compose by being applied in order.
 */
export function mergePatches(patches: MaterialPatch[]): MaterialPatch {
  return {
    onBeforeCompile: (shader) => {
      for (const patch of patches) patch.onBeforeCompile(shader);
    },
    customProgramCacheKey: () => patches.map((patch) => patch.customProgramCacheKey()).join('+')
  };
}

export interface BodyShading {
  /** Patch for the body's own surface material. */
  surface: MaterialPatch;
  /** Patch for the separate cloud shell, where a body has one. */
  clouds: MaterialPatch;
}

/**
 * Builds the material patches for one body and keeps their uniforms current.
 * Owns its own frame callback, so a caller only has to hand the patches to the
 * materials.
 *
 * A body with an atmosphere hazes its own surface toward the given colour at the
 * limb (aerial perspective); bodies without one pass `null` and keep a hard
 * edge.
 */
export function useBodyShading(
  id: BodyId,
  registry: PositionRegistry,
  atmosphereColor?: string | null,
  cloudShadowMap?: THREE.Texture | null
): BodyShading {
  const casters = useMemo(() => occludersOf(id), [id]);
  const casterRadii = useMemo(() => casters.map(sceneRadiusOf), [casters]);
  const drifts = ZONAL_DRIFT[id] !== undefined;
  const hasAerial = !!atmosphereColor;
  // Compiled in for any body the registry gives a cloud shell, whether or not
  // its map has loaded yet — the sampler binds the black fallback until it does,
  // so the program never has to recompile when the texture arrives.
  const hasCloudShadow = !!getTextureSet(id)?.cloudMap;

  const uniforms = useMemo(
    () => ({
      uOccluders: { value: Array.from({ length: MAX_OCCLUDERS }, () => new THREE.Vector4()) },
      uOccluderCount: { value: casters.length },
      uSunRadius: { value: sceneRadiusOf('sun') },
      uDriftHours: { value: 0 },
      uZonalRate: { value: ZONAL_DRIFT[id] ?? 0 },
      uAerialColor: { value: new THREE.Color(atmosphereColor ?? '#000000') },
      uCloudShadow: { value: NO_CLOUD as THREE.Texture },
      // Cloud shell altitude in scene units: the horizontal throw of a shadow is
      // this times the tangent of the sun's zenith angle.
      uCloudReach: { value: sceneRadiusOf(id) * 0.006 }
    }),
    [id, casters, atmosphereColor]
  );

  // The cloud map is shared with the shell and only resident at the near level,
  // so the sampler follows it in and out rather than being fixed at compile.
  uniforms.uCloudShadow.value = cloudShadowMap ?? NO_CLOUD;

  useFrame(() => {
    for (let i = 0; i < casters.length; i++) {
      const centre = registry.get(casters[i])!;
      uniforms.uOccluders.value[i].set(centre.x, centre.y, centre.z, casterRadii[i]);
    }
    uniforms.uDriftHours.value = (useSimTime.getState().date.getTime() - J2000_MS) / 3600000;
  });

  return useMemo(() => {
    const patchVertex = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${VARYINGS}\nvoid main() {`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_ASSIGN}`);
    };

    // Aerial perspective: a grazing line of sight near the limb crosses far more
    // lit air than one looking straight down, so the ground there fades into the
    // atmosphere's own colour. `cameraPosition` is a built-in three uniform.
    const AERIAL_DECLARATIONS = /* glsl */ `uniform vec3 uAerialColor;`;
    const AERIAL_FRAGMENT = /* glsl */ `
      vec3 orbitimView = normalize( cameraPosition - vOrbitimWorld );
      float orbitimRim = 1.0 - abs( dot( orbitimView, normalize( vOrbitimNormal ) ) );
      float orbitimLit = smoothstep( -0.05, 0.35, orbitimDaylight() );
      diffuseColor.rgb = mix(
        diffuseColor.rgb,
        uAerialColor,
        clamp( pow( orbitimRim, 3.2 ) * orbitimLit * ${AERIAL_STRENGTH.toFixed(2)}, 0.0, 1.0 )
      );
    `;

    // Cloud shadows. The cloud shell floats above the surface, so the cloud that
    // shadows a point is the one up-sun of it — sampled by stepping the map's UV
    // toward the Sun. The step is built without a tangent basis on the mesh: the
    // screen-space derivatives of the world position and the map UV give the
    // world-to-UV mapping at this pixel, and the sun-ward world tangent is
    // resolved through it. The throw lengthens as the Sun sinks, which is why the
    // shadows only read near the terminator, as they do from orbit.
    const CLOUD_DECLARATIONS = /* glsl */ `
      uniform sampler2D uCloudShadow;
      uniform float uCloudReach;
    `;
    const CLOUD_FRAGMENT = /* glsl */ `
      #ifdef USE_MAP
      {
        vec3 cloudN = normalize( vOrbitimNormal );
        vec3 cloudSun = normalize( -vOrbitimWorld );
        float cloudElev = dot( cloudSun, cloudN );
        if ( cloudElev > 0.02 ) {
          vec3 cloudTangent = normalize( cloudSun - cloudElev * cloudN );
          vec3 dpx = dFdx( vOrbitimWorld );
          vec3 dpy = dFdy( vOrbitimWorld );
          vec2 duvx = dFdx( vMapUv );
          vec2 duvy = dFdy( vMapUv );
          float a11 = dot( dpx, dpx );
          float a12 = dot( dpx, dpy );
          float a22 = dot( dpy, dpy );
          float det = a11 * a22 - a12 * a12;
          if ( abs( det ) > 1e-12 ) {
            float bx = dot( dpx, cloudTangent );
            float by = dot( dpy, cloudTangent );
            float ca = ( a22 * bx - a12 * by ) / det;
            float cb = ( a11 * by - a12 * bx ) / det;
            vec2 cloudStep = ca * duvx + cb * duvy;
            // altitude * tan(zenith): the horizontal distance the shadow is cast.
            float throwDist = uCloudReach * sqrt( 1.0 - cloudElev * cloudElev ) / max( cloudElev, 0.15 );
            float cloud = texture2D( uCloudShadow, vMapUv + cloudStep * throwDist ).r;
            float cloudDay = smoothstep( 0.02, 0.32, cloudElev );
            diffuseColor.rgb *= 1.0 - cloud * ${CLOUD_SHADOW_STRENGTH.toFixed(2)} * cloudDay;
          }
        }
      }
      #endif
    `;

    return {
      surface: {
        onBeforeCompile: (shader) => {
          patchVertex(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'void main() {',
              `${FRAGMENT_DECLARATIONS}\n${drifts ? DRIFT_DECLARATIONS : ''}\n${
                hasAerial ? AERIAL_DECLARATIONS : ''
              }\n${hasCloudShadow ? CLOUD_DECLARATIONS : ''}\nvoid main() {`
            )
            .replace('#include <map_fragment>', drifts ? DRIFT_MAP_FRAGMENT : '#include <map_fragment>')
            // Eclipse shadows scale the albedo rather than the light itself:
            // the Sun is the one light in the scene and the ambient term is a
            // twentieth of it, so the difference is below the noise floor and
            // this hooks into stock three without rewriting its light loop.
            // Cloud shadows fall on the raw ground next; the aerial haze then
            // hazes that shadowed albedo toward the sky colour rather than the
            // raw one.
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               diffuseColor.rgb *= mix( ${UMBRA_FLOOR.toFixed(2)}, 1.0, orbitimSunlight() );
               ${hasCloudShadow ? CLOUD_FRAGMENT : ''}
               ${hasAerial ? AERIAL_FRAGMENT : ''}`
            )
            // City lights belong to the night side. Left unmasked they burn
            // through the daylit hemisphere, which is the single most common
            // giveaway of a textured Earth.
            .replace(
              '#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
               totalEmissiveRadiance *= smoothstep( 0.12, -0.22, orbitimDaylight() );`
            );
        },
        /* three caches compiled programs by material parameters alone, so a
           patched and an unpatched material with otherwise identical settings
           would share one program. The key keeps the variants apart. */
        customProgramCacheKey: () =>
          `orbitim-surface${drifts ? '-drift' : ''}${hasAerial ? '-aerial' : ''}${
            hasCloudShadow ? '-cloudshadow' : ''
          }`
      },

      clouds: {
        onBeforeCompile: (shader) => {
          patchVertex(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', `${FRAGMENT_DECLARATIONS}\nvoid main() {`)
            // The cloud shell is added on top of the surface, so without a sun
            // term it lights the night side as brightly as noon. Clouds are lit
            // by the Sun like everything else, and go out at the terminator.
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               float orbitimDay = smoothstep( -0.14, 0.30, orbitimDaylight() );
               diffuseColor.rgb *= orbitimDay * mix( ${UMBRA_FLOOR.toFixed(2)}, 1.0, orbitimSunlight() );`
            );
        },
        customProgramCacheKey: () => 'orbitim-clouds'
      }
    };
  }, [uniforms, drifts, hasAerial, hasCloudShadow]);
}

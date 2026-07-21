import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getBodyRecord, getMoonsOf, type BodyId } from '../lib/ephemeris/bodies';
import { J2000_MS } from '../lib/ephemeris/rotation';
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

export interface MaterialPatch {
  onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
  customProgramCacheKey: () => string;
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
 */
export function useBodyShading(id: BodyId, registry: PositionRegistry): BodyShading {
  const casters = useMemo(() => occludersOf(id), [id]);
  const casterRadii = useMemo(() => casters.map(sceneRadiusOf), [casters]);
  const drifts = ZONAL_DRIFT[id] !== undefined;

  const uniforms = useMemo(
    () => ({
      uOccluders: { value: Array.from({ length: MAX_OCCLUDERS }, () => new THREE.Vector4()) },
      uOccluderCount: { value: casters.length },
      uSunRadius: { value: sceneRadiusOf('sun') },
      uDriftHours: { value: 0 },
      uZonalRate: { value: ZONAL_DRIFT[id] ?? 0 }
    }),
    [id, casters]
  );

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

    return {
      surface: {
        onBeforeCompile: (shader) => {
          patchVertex(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'void main() {',
              `${FRAGMENT_DECLARATIONS}\n${drifts ? DRIFT_DECLARATIONS : ''}\nvoid main() {`
            )
            .replace('#include <map_fragment>', drifts ? DRIFT_MAP_FRAGMENT : '#include <map_fragment>')
            // Eclipse shadows scale the albedo rather than the light itself:
            // the Sun is the one light in the scene and the ambient term is a
            // twentieth of it, so the difference is below the noise floor and
            // this hooks into stock three without rewriting its light loop.
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               diffuseColor.rgb *= mix( ${UMBRA_FLOOR.toFixed(2)}, 1.0, orbitimSunlight() );`
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
        customProgramCacheKey: () => (drifts ? 'orbitim-surface-drift' : 'orbitim-surface')
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
  }, [uniforms, drifts]);
}

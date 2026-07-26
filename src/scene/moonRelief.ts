import { useMemo } from 'react';
import * as THREE from 'three';
import type { BodyId } from '../lib/ephemeris/bodies';
import { getTextureSet } from '../lib/textures/registry';
import type { MaterialPatch } from './surfaceShading';

/**
 * Procedural surfaces for the moons no published map covers.
 *
 * A flat-shaded sphere in the registry's accent colour is honest but lifeless,
 * and at the distance the camera parks it fills the frame. What is generated
 * here is not an invented photograph: each profile is the terrain the body is
 * actually known for — Callisto saturated with craters, Io resurfaced by its
 * volcanoes and holding almost none, Europa's ice cracked by linea, Phobos
 * scored by its grooves — so the relief carries real information about the
 * world rather than decorating it.
 */

interface ReliefProfile {
  /** Albedo of the low ground and of the high ground, read through the terrain. */
  low: string;
  high: string;
  /** Broad colour variation across the surface, and how strongly it shows. */
  mottle: string;
  mottleWeight: number;
  /** Fraction of the surface bearing craters, 0 for a resurfaced world. */
  craters: number;
  /** Amplitude of the fractal terrain under the craters. */
  roughness: number;
  /** How much the terrain bends the surface normal, i.e. how deep it reads. */
  relief: number;
  /** Weight of the directional fracturing: linea, grooves, cantaloupe terrain. */
  fractures: number;
  /** Spatial frequency of the base fractal, in cycles across the body. */
  frequency: number;
}

const PROFILES: Partial<Record<BodyId, ReliefProfile>> = {
  // Resurfaced by its own volcanism faster than craters can accumulate: sulphur
  // yellows and whites over red-brown flows, and essentially no impact record.
  io: {
    low: '#8a5a1e', high: '#f2e07a', mottle: '#d4542a', mottleWeight: 0.55,
    craters: 0.02, roughness: 0.55, relief: 0.5, fractures: 0.0, frequency: 5
  },
  // Young ice, close to the smoothest surface in the solar system, cut across
  // by the reddish linea where the shell has fractured over the ocean.
  europa: {
    low: '#b9a68d', high: '#f2ece2', mottle: '#8a6a4e', mottleWeight: 0.32,
    craters: 0.05, roughness: 0.22, relief: 0.3, fractures: 0.95, frequency: 4
  },
  // Two terrains at once: dark ancient cratered ground and the bright grooved
  // bands of the tectonic resurfacing that broke it up.
  ganymede: {
    low: '#5f5648', high: '#c3b9a8', mottle: '#7d7161', mottleWeight: 0.42,
    craters: 0.4, roughness: 0.45, relief: 0.75, fractures: 0.5, frequency: 4
  },
  // The most heavily cratered surface known — old, dark and saturated, every
  // new impact landing on top of an older one.
  callisto: {
    low: '#3a332b', high: '#a99881', mottle: '#4a4238', mottleWeight: 0.35,
    craters: 0.95, roughness: 0.4, relief: 1.0, fractures: 0.0, frequency: 5
  },
  // The only moon whose ground is not what is seen: an orange photochemical
  // haze flattens the contrast of everything under it.
  titan: {
    low: '#a86a22', high: '#e8b46a', mottle: '#c98b3a', mottleWeight: 0.6,
    craters: 0.0, roughness: 0.3, relief: 0.12, fractures: 0.12, frequency: 3
  },
  // Dark carbonaceous regolith, one huge crater and the long parallel grooves
  // that run away from it.
  phobos: {
    low: '#4a423a', high: '#8f8175', mottle: '#5a5148', mottleWeight: 0.4,
    craters: 0.85, roughness: 0.6, relief: 1.15, fractures: 0.45, frequency: 6
  },
  // The same material as Phobos, but with its craters half filled in by loose
  // regolith, which leaves it visibly the smoother of the two.
  deimos: {
    low: '#544a41', high: '#9a8b7d', mottle: '#615549', mottleWeight: 0.35,
    craters: 0.5, roughness: 0.45, relief: 0.7, fractures: 0.0, frequency: 6
  },
  // Nitrogen and methane frost, pink where the ice is irradiated, dimpled all
  // over by the cantaloupe terrain that is unique to it.
  triton: {
    low: '#c0b0ad', high: '#f4eae6', mottle: '#d9c4bd', mottleWeight: 0.42,
    craters: 0.08, roughness: 0.35, relief: 0.45, fractures: 0.7, frequency: 5
  },
  // Voyager 2 saw an ancient cratered ice-rock surface, cut by long fault
  // valleys whose sun-facing walls carry fresh, reflective frost.
  titania: {
    low: '#5e5a56', high: '#d8d4cf', mottle: '#8d8881', mottleWeight: 0.24,
    craters: 0.58, roughness: 0.32, relief: 0.64, fractures: 0.76, frequency: 3
  },
  // Old, heavily cratered Oberon preserves bright-rayed impacts, dark crater
  // floors and a large mountain rather than the smoother terrain of Titania.
  oberon: {
    low: '#403d3a', high: '#d0cbc3', mottle: '#766f68', mottleWeight: 0.34,
    craters: 0.88, roughness: 0.5, relief: 0.9, fractures: 0.08, frequency: 4
  },
  // Miranda's coronae are young, sharp patches of ridges and valleys bounded
  // against older cratered ground; the high fracture weight preserves that
  // extraordinary contrast without pretending Voyager imaged the far side.
  miranda: {
    low: '#6f6f70', high: '#e2e1dc', mottle: '#a8a6a1', mottleWeight: 0.48,
    craters: 0.24, roughness: 0.68, relief: 1.05, fractures: 0.98, frequency: 3
  }
};

const VERTEX_DECLARATIONS = /* glsl */ `
  varying vec3 vMrObject;
`;

const VERTEX_ASSIGN = /* glsl */ `
  vMrObject = normalize( position );
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
  varying vec3 vMrObject;

  uniform vec3 uMrLow;
  uniform vec3 uMrHigh;
  uniform vec3 uMrMottle;
  uniform float uMrMottleWeight;
  uniform float uMrCraters;
  uniform float uMrRoughness;
  uniform float uMrRelief;
  uniform float uMrFractures;
  uniform float uMrFrequency;

  float mrHash( vec3 p ) {
    p = fract( p * 0.3183099 + vec3( 0.71, 0.113, 0.419 ) );
    p *= 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }

  float mrNoise( vec3 x ) {
    vec3 i = floor( x );
    vec3 f = fract( x );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( mix( mrHash( i ), mrHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
           mix( mrHash( i + vec3( 0.0, 1.0, 0.0 ) ), mrHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
      mix( mix( mrHash( i + vec3( 0.0, 0.0, 1.0 ) ), mrHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
           mix( mrHash( i + vec3( 0.0, 1.0, 1.0 ) ), mrHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ),
      f.z );
  }

  float mrFbm( vec3 p ) {
    float sum = 0.0;
    float amplitude = 0.5;
    for ( int i = 0; i < 5; i++ ) {
      sum += amplitude * mrNoise( p );
      p *= 2.07;
      amplitude *= 0.5;
    }
    return sum;
  }

  /**
   * One scale of impact craters: a bowl with a raised rim, one per cell of a
   * jittered lattice. Each crater is kept inside its own cell, which trades the
   * overlapping rims of a true distribution for a lookup that costs one cell
   * instead of twenty-seven.
   */
  float mrCraterLayer( vec3 p, float density, float coverage ) {
    vec3 scaled = p * density;
    vec3 cell = floor( scaled );
    if ( mrHash( cell + 11.7 ) > coverage ) return 0.0;

    float radius = 0.16 + 0.22 * mrHash( cell + 3.1 );
    vec3 jitter = ( vec3( mrHash( cell + 1.3 ), mrHash( cell + 5.9 ), mrHash( cell + 7.7 ) ) - 0.5 )
      * ( 0.5 - radius ) * 1.6;
    float d = length( fract( scaled ) - 0.5 - jitter ) / radius;
    if ( d > 1.35 ) return 0.0;

    float floorDepth = - ( 1.0 - smoothstep( 0.0, 0.86, d ) );
    float rim = smoothstep( 0.72, 0.98, d ) * ( 1.0 - smoothstep( 0.98, 1.32, d ) );
    return floorDepth * 0.85 + rim * 0.65;
  }

  /** Ridged noise: the sharp-crested fractal that reads as fracture and groove. */
  float mrRidged( vec3 p ) {
    float sum = 0.0;
    float amplitude = 0.5;
    for ( int i = 0; i < 3; i++ ) {
      sum += amplitude * ( 1.0 - abs( mrNoise( p ) * 2.0 - 1.0 ) );
      p *= 2.31;
      amplitude *= 0.5;
    }
    return sum;
  }

  /** Signed elevation of the surface at a point on the unit sphere. */
  float mrTerrain( vec3 direction ) {
    float height = ( mrFbm( direction * uMrFrequency ) - 0.5 ) * uMrRoughness;

    if ( uMrCraters > 0.0 ) {
      height += mrCraterLayer( direction, 7.0, uMrCraters ) * 0.9;
      height += mrCraterLayer( direction, 17.0, uMrCraters * 0.9 ) * 0.5;
      height += mrCraterLayer( direction, 39.0, uMrCraters * 0.8 ) * 0.25;
    }

    if ( uMrFractures > 0.0 ) {
      float ridges = pow( mrRidged( direction * uMrFrequency * 2.4 ), 3.0 );
      height -= ridges * uMrFractures * 0.6;
    }

    return height;
  }

  /**
   * Bends the shading normal by the gradient of a height field that the surface
   * has no texture coordinates for. The screen-space derivatives of the view
   * position give a basis at this pixel, so the relief needs one evaluation of
   * the terrain rather than the three a finite-difference gradient would take.
   */
  vec3 mrPerturbNormal( vec3 surfaceNormal, vec3 positionView, float height ) {
    vec3 dpx = dFdx( positionView );
    vec3 dpy = dFdy( positionView );
    vec3 r1 = cross( dpy, surfaceNormal );
    vec3 r2 = cross( surfaceNormal, dpx );
    float determinant = dot( dpx, r1 );
    if ( abs( determinant ) < 1e-8 ) return surfaceNormal;
    vec3 gradient = ( r1 * dFdx( height ) + r2 * dFdy( height ) ) / determinant;
    return normalize( surfaceNormal - gradient );
  }
`;

/**
 * Albedo. High ground reads as exposed or fresh material and low ground as the
 * darker floor it has been stripped down to, with a slow mottling across the
 * whole body so no two regions look alike.
 */
const ALBEDO_FRAGMENT = /* glsl */ `
  vec3 mrDirection = normalize( vMrObject );
  float mrHeight = mrTerrain( mrDirection );
  float mrBlend = clamp( mrHeight * 1.6 + 0.5, 0.0, 1.0 );
  vec3 mrColor = mix( uMrLow, uMrHigh, mrBlend );
  float mrPatch = mrFbm( mrDirection * uMrFrequency * 0.4 + 21.7 );
  mrColor = mix( mrColor, uMrMottle, smoothstep( 0.35, 0.75, mrPatch ) * uMrMottleWeight );
  diffuseColor.rgb *= mrColor;
`;

const NORMAL_FRAGMENT = /* glsl */ `
  normal = mrPerturbNormal( normal, - vViewPosition, mrHeight * uMrRelief );
`;

/**
 * Relief patch for a body, or null where a published map already covers it and
 * an invented surface would be a worse answer than the real one.
 */
export function useMoonRelief(id: BodyId): MaterialPatch | null {
  const profile = getTextureSet(id) ? undefined : PROFILES[id];

  const uniforms = useMemo(() => {
    if (!profile) return null;
    return {
      uMrLow: { value: new THREE.Color(profile.low) },
      uMrHigh: { value: new THREE.Color(profile.high) },
      uMrMottle: { value: new THREE.Color(profile.mottle) },
      uMrMottleWeight: { value: profile.mottleWeight },
      uMrCraters: { value: profile.craters },
      uMrRoughness: { value: profile.roughness },
      uMrRelief: { value: profile.relief },
      uMrFractures: { value: profile.fractures },
      uMrFrequency: { value: profile.frequency }
    };
  }, [profile]);

  return useMemo(() => {
    if (!uniforms) return null;
    return {
      onBeforeCompile: (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', `${VERTEX_DECLARATIONS}\nvoid main() {`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_ASSIGN}`);
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `${FRAGMENT_DECLARATIONS}\nvoid main() {`)
          // The albedo has to be resolved before the normal, which reuses the
          // terrain height it evaluated.
          .replace('#include <map_fragment>', `#include <map_fragment>\n${ALBEDO_FRAGMENT}`)
          .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\n${NORMAL_FRAGMENT}`);
      },
      // Every profile compiles the same program with different uniforms, so one
      // key covers them all — but it has to differ from the unpatched material.
      customProgramCacheKey: () => 'orbitim-moon-relief'
    };
  }, [uniforms]);
}

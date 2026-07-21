import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { J2000_MS } from '../lib/ephemeris/rotation';
import { auToScene } from '../lib/scale';
import { graphicsTier } from '../lib/device';
import { useSimTime } from './useSimTime';

/**
 * The main asteroid belt, between Mars and Jupiter.
 *
 * It is drawn as one instanced mesh whose bodies each follow their own circular
 * orbit at the Keplerian rate for their semi-major axis, so the belt shears as
 * it turns — the inner edge laps the outer one — instead of rotating rigidly
 * like a texture on a ring.
 */

/**
 * Enough bodies to read as a belt rather than a scattering of rocks. The belt
 * is drawn with many small bodies rather than few large ones on purpose: from
 * Earth not one of these is visible to the naked eye, so anything big enough to
 * resolve from a neighbouring planet is already a lie.
 */
const COUNT = graphicsTier === 'low' ? 1800 : 8000;

const INNER_AU = 2.05;
const OUTER_AU = 3.4;

/**
 * Kirkwood gaps: semi-major axes in mean-motion resonance with Jupiter, which
 * Jupiter has swept nearly empty over the age of the system. They are the
 * belt's defining structure, and a belt drawn without them reads as a uniform
 * band of noise.
 */
const KIRKWOOD_GAPS: { au: number; width: number }[] = [
  { au: 2.065, width: 0.02 }, // 4:1
  { au: 2.502, width: 0.04 }, // 3:1
  { au: 2.825, width: 0.03 }, // 5:2
  { au: 2.958, width: 0.02 }, // 7:3
  { au: 3.279, width: 0.045 } // 2:1
];

/** Days in a sidereal year, for the period-from-distance relation. */
const YEAR_DAYS = 365.25;

/** Reused by the frame loop so reading the drawing buffer allocates nothing. */
const SCRATCH_SIZE = new THREE.Vector2();

/** Reproducible hash in place of Math.random, so the belt is the same on every load. */
function hash(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Fraction of the belt population surviving at a given semi-major axis: a broad
 * hump centred near 2.7 AU, punched through by the resonance gaps.
 */
function density(au: number): number {
  const centred = (au - 2.68) / 0.62;
  let value = Math.exp(-centred * centred);
  for (const gap of KIRKWOOD_GAPS) {
    const offset = (au - gap.au) / gap.width;
    value *= 1 - 0.94 * Math.exp(-offset * offset);
  }
  return value;
}

interface BeltOrbits {
  /** Orbital radius in scene units. */
  radius: Float32Array;
  /** Mean angular rate, radians per day. */
  rate: Float32Array;
  /** Angle at J2000, radians. */
  phase: Float32Array;
  /** Sine of the orbital inclination. */
  tilt: Float32Array;
  /** Longitude of the ascending node, radians. */
  node: Float32Array;
  size: Float32Array;
}

function createOrbits(): BeltOrbits {
  const orbits: BeltOrbits = {
    radius: new Float32Array(COUNT),
    rate: new Float32Array(COUNT),
    phase: new Float32Array(COUNT),
    tilt: new Float32Array(COUNT),
    node: new Float32Array(COUNT),
    size: new Float32Array(COUNT)
  };

  let placed = 0;
  // Rejection sampling against the density curve. The attempt counter is a
  // separate stream so a rejected draw does not shift the accepted ones.
  for (let attempt = 0; placed < COUNT; attempt++) {
    const au = INNER_AU + hash(attempt, 1) * (OUTER_AU - INNER_AU);
    if (hash(attempt, 2) > density(au)) continue;

    orbits.radius[placed] = auToScene(au);
    // Kepler's third law: the period grows as the three-halves power of the
    // semi-major axis, which is what makes the belt shear.
    orbits.rate[placed] = (2 * Math.PI) / (YEAR_DAYS * Math.pow(au, 1.5));
    orbits.phase[placed] = hash(placed, 3) * Math.PI * 2;
    // Inclinations run to about twenty degrees, most of the population well
    // under ten, so the belt is a thick torus rather than a flat annulus.
    orbits.tilt[placed] = Math.sin(Math.pow(hash(placed, 4), 2) * 0.35);
    orbits.node[placed] = hash(placed, 5) * Math.PI * 2;
    // A steep size curve, as the real population is: three or four bodies that
    // resolve into a shape, and thousands that never will. The largest here is
    // about the scene size of Ceres.
    orbits.size[placed] = 0.012 + Math.pow(hash(placed, 6), 7) * 0.55;
    placed++;
  }

  return orbits;
}

/**
 * Smallest radius, in pixels, an asteroid is drawn at. At true size almost the
 * whole belt is far below one pixel from anywhere in the scene, which is honest
 * and also invisible: a raster display cannot draw a tenth of a pixel, it can
 * only drop it. Holding the floor at rather less than a pixel keeps the belt on
 * screen without inflating the bodies that are genuinely large enough to see.
 */
const MIN_PIXEL_RADIUS = 0.6;

/**
 * Replacement for three's `project_vertex`, enforcing the pixel floor. The
 * instance is scaled about its own centre, so its position and its lighting are
 * untouched — only its silhouette grows, and only when it would otherwise
 * vanish.
 */
const PROJECT_VERTEX = /* glsl */ `
  vec4 orbitimCentreView = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  vec4 orbitimPointView = modelViewMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vec3 orbitimOffset = orbitimPointView.xyz - orbitimCentreView.xyz;

  float orbitimRadius = length( orbitimOffset );
  float orbitimFloor = -orbitimCentreView.z * uPixelScale;
  if ( orbitimRadius > 0.0 && orbitimRadius < orbitimFloor ) {
    orbitimOffset *= orbitimFloor / orbitimRadius;
  }

  vec4 mvPosition = vec4( orbitimCentreView.xyz + orbitimOffset, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
`;

export function AsteroidBelt() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const orbits = useMemo(createOrbits, []);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const pixelScale = useMemo(() => ({ value: 0 }), []);

  const material = useMemo(() => {
    const created = new THREE.MeshStandardMaterial({
      color: '#8b8175',
      roughness: 1,
      metalness: 0,
      flatShading: true
    });
    created.onBeforeCompile = (shader) => {
      shader.uniforms.uPixelScale = pixelScale;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'uniform float uPixelScale;\nvoid main() {')
        .replace('#include <project_vertex>', PROJECT_VERTEX);
    };
    created.customProgramCacheKey = () => 'orbitim-asteroid';
    return created;
  }, [pixelScale]);

  // World units per pixel at unit depth, times the floor. Depends on the
  // camera's field of view and on the drawing buffer, both of which change when
  // the window is resized, so it is refreshed every frame rather than cached.
  useFrame(({ camera, gl }) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const height = gl.getDrawingBufferSize(SCRATCH_SIZE).y;
    const perPixel = (2 * Math.tan((perspective.fov * Math.PI) / 360)) / height;
    pixelScale.value = perPixel * MIN_PIXEL_RADIUS;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // The rotation and scale of each body never change, so they are written into
  // the upper 3x3 of the instance matrix once and the frame loop then touches
  // nothing but the three translation components.
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const basis = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const origin = new THREE.Vector3();

    for (let i = 0; i < COUNT; i++) {
      euler.set(hash(i, 7) * Math.PI * 2, hash(i, 8) * Math.PI * 2, hash(i, 9) * Math.PI * 2);
      rotation.setFromEuler(euler);
      // Asteroids are not spheres. Unequal axes on an already irregular solid
      // give each one a distinct silhouette.
      const size = orbits.size[i];
      scale.set(size, size * (0.55 + hash(i, 10) * 0.55), size * (0.55 + hash(i, 11) * 0.55));
      basis.compose(origin, rotation, scale);
      mesh.current.setMatrixAt(i, basis);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [orbits]);

  useFrame(() => {
    if (!mesh.current) return;
    const days = (useSimTime.getState().date.getTime() - J2000_MS) / 86400000;
    const matrices = mesh.current.instanceMatrix.array;

    for (let i = 0; i < COUNT; i++) {
      const angle = orbits.phase[i] + orbits.rate[i] * days;
      const radius = orbits.radius[i];
      const offset = i * 16;
      matrices[offset + 12] = radius * Math.cos(angle);
      matrices[offset + 13] = radius * orbits.tilt[i] * Math.sin(angle + orbits.node[i]);
      matrices[offset + 14] = radius * Math.sin(angle);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      /* The belt spans the middle of the scene and is almost never wholly out
         of frame, so the bounding sphere three would have to keep recomputing
         from moving instances buys nothing. */
      frustumCulled={false}
    />
  );
}

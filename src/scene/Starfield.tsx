import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { STARFIELD_TEXTURE } from '../lib/textures/registry';
import { graphicsTier } from '../lib/device';
import { BRIGHT_STARS, CONSTELLATIONS, NORTH_GALACTIC_POLE } from '../data/constellations';
import type { MaterialPatch } from './surfaceShading';
import { useViewSettings } from './viewSettings';

/** Radius of the sky shell, just inside the camera's far plane. */
const SKY_RADIUS = 40000;
/** Radius the resolved stars are placed at, in front of the sky map. */
const STAR_RADIUS = SKY_RADIUS * 0.92;
/** Stars drawn in front of the sky map. */
const STAR_COUNT = graphicsTier === 'high' ? 14000 : 7000;
/**
 * Obliquity of the ecliptic, J2000. The scene's own frame is the ecliptic — the
 * planets orbit in its plane — while every catalogue position is equatorial, so
 * the whole sky is carried across by this one rotation.
 */
const OBLIQUITY = (23.4392911 * Math.PI) / 180;
/**
 * Angular thickness of the galactic disc as seen from inside it, in radians of
 * galactic latitude. Stars crowd towards the plane; a sky seeded uniformly is
 * the one thing that gives a procedural star field away at a glance.
 */
const GALACTIC_THICKNESS = 0.22;

const DEG = Math.PI / 180;

/**
 * Colour temperatures across the main sequence, from cool red dwarfs to hot
 * blue giants. Sampling these instead of painting every star white is most of
 * what separates a night sky from a noise texture.
 */
const STAR_COLORS = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffcc6f'];

/**
 * Unit vector for a catalogue position, in the frame the sky group holds before
 * it is rotated onto the ecliptic. Right ascension runs the way it does on the
 * sky: eastward, which is anticlockwise seen from the north celestial pole.
 */
function equatorialDirection(raHours: number, decDeg: number, target: THREE.Vector3): THREE.Vector3 {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);
  return target.set(cosDec * Math.cos(ra), Math.sin(dec), -cosDec * Math.sin(ra));
}

/**
 * Soft round point sprite. Without it every star is a hard square, which is the
 * single most artificial-looking thing about an untextured point cloud.
 */
function createStarSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable for the star sprite');

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

interface StarBuffers {
  positions: Float32Array;
  colors: Float32Array;
  /** Per-star size multiplier on the material's base size. */
  scales: Float32Array;
  /** Offset into the twinkle cycle, so no two stars pulse together. */
  phases: Float32Array;
  /** Depth of that star's own scintillation, 0 for a steady one. */
  twinkles: Float32Array;
}

function allocate(count: number): StarBuffers {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    scales: new Float32Array(count),
    phases: new Float32Array(count),
    twinkles: new Float32Array(count)
  };
}

/** Cheap reproducible hash in place of Math.random: the same sky every load. */
function rand(i: number, salt: number): number {
  const value = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The unresolved field: thousands of stars too faint to name, seeded thickly
 * along the galactic plane and thinly away from it.
 */
function createStars(): StarBuffers {
  const buffers = allocate(STAR_COUNT);
  const color = new THREE.Color();
  const pole = equatorialDirection(NORTH_GALACTIC_POLE.ra, NORTH_GALACTIC_POLE.dec, new THREE.Vector3());
  const direction = new THREE.Vector3();

  for (let i = 0; i < STAR_COUNT; i++) {
    // Rejection sampling against the disc profile. Every candidate is uniform on
    // the sphere — cosine-distributed polar angle, which avoids the pole
    // clustering a naive angle pair produces — and is then kept in proportion to
    // how many stars that part of the sky actually holds.
    for (let attempt = 0; attempt < 8; attempt++) {
      const salt = attempt * 4;
      const theta = rand(i, salt + 1) * Math.PI * 2;
      const cosPhi = rand(i, salt + 2) * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      direction.set(sinPhi * Math.cos(theta), cosPhi, sinPhi * Math.sin(theta));

      const fromPlane = Math.abs(direction.dot(pole)) / GALACTIC_THICKNESS;
      const density = 0.28 + 0.72 * Math.exp(-fromPlane * fromPlane);
      if (rand(i, salt + 3) < density) break;
    }

    buffers.positions[i * 3] = direction.x * STAR_RADIUS;
    buffers.positions[i * 3 + 1] = direction.y * STAR_RADIUS;
    buffers.positions[i * 3 + 2] = direction.z * STAR_RADIUS;

    color.set(STAR_COLORS[Math.floor(rand(i, 33) * STAR_COLORS.length)]);
    // A steep brightness curve: a handful of bright stars, a great many faint.
    const brightness = 0.35 + Math.pow(rand(i, 34), 3) * 0.65;
    buffers.colors[i * 3] = color.r * brightness;
    buffers.colors[i * 3 + 1] = color.g * brightness;
    buffers.colors[i * 3 + 2] = color.b * brightness;

    buffers.scales[i] = 0.55 + brightness * 0.9;
    buffers.phases[i] = rand(i, 35);
    // Most of the field is steady; a scattered few pulse hard enough to notice,
    // which is what the eye picks up as a living sky rather than a still.
    buffers.twinkles[i] = rand(i, 36) > 0.82 ? 0.35 + rand(i, 37) * 0.45 : rand(i, 38) * 0.1;
  }

  return buffers;
}

/** The named stars, at their catalogue positions, sized by their real brightness. */
function createBrightStars(): StarBuffers {
  const buffers = allocate(BRIGHT_STARS.length);
  const color = new THREE.Color();
  const direction = new THREE.Vector3();

  BRIGHT_STARS.forEach((star, i) => {
    equatorialDirection(star.ra, star.dec, direction).multiplyScalar(STAR_RADIUS);
    buffers.positions[i * 3] = direction.x;
    buffers.positions[i * 3 + 1] = direction.y;
    buffers.positions[i * 3 + 2] = direction.z;

    color.set(star.color);
    buffers.colors[i * 3] = color.r;
    buffers.colors[i * 3 + 1] = color.g;
    buffers.colors[i * 3 + 2] = color.b;

    // Magnitude is a logarithmic scale running backwards, so the brightest star
    // in the sky carries the largest disc and a third-magnitude one barely more
    // than the unresolved field behind it.
    buffers.scales[i] = 1.1 + (3.4 - star.magnitude) * 0.42;
    buffers.phases[i] = rand(i, 51);
    buffers.twinkles[i] = 0.12 + rand(i, 52) * 0.18;
  });

  return buffers;
}

/** Endpoint pairs of every constellation figure, as one line-segment buffer. */
function createFigures(): Float32Array {
  const byId = new Map(BRIGHT_STARS.map((star) => [star.id, star]));
  const direction = new THREE.Vector3();
  const segments = CONSTELLATIONS.flatMap((constellation) => constellation.lines);
  const positions = new Float32Array(segments.length * 6);

  segments.forEach(([fromId, toId], i) => {
    for (const [offset, id] of [
      [0, fromId],
      [3, toId]
    ] as const) {
      const star = byId.get(id);
      if (!star) throw new Error(`Constellation figure references unknown star: ${id}`);
      // Just inside the stars themselves, so a figure never draws over the point
      // it is joining.
      equatorialDirection(star.ra, star.dec, direction).multiplyScalar(STAR_RADIUS * 0.998);
      positions[i * 6 + offset] = direction.x;
      positions[i * 6 + offset + 1] = direction.y;
      positions[i * 6 + offset + 2] = direction.z;
    }
  });

  return positions;
}

const TWINKLE_VERTEX_DECLARATIONS = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute float aTwinkle;
  uniform float uTime;
  varying float vTwinkle;
`;

/**
 * Scintillation is an atmospheric effect and strictly there is none in vacuum,
 * so this is the one deliberate untruth in the sky: without it a field of
 * fixed points reads as a printed backdrop rather than as stars. Each star
 * carries its own rate and phase, so the field shimmers unevenly the way a real
 * one does instead of pulsing as a single mass.
 */
const TWINKLE_SIZE = /* glsl */ `
  float orbitimPulse = sin( uTime * ( 0.7 + aPhase * 2.6 ) + aPhase * 6.2831853 );
  vTwinkle = 1.0 + aTwinkle * orbitimPulse;
  gl_PointSize = size * aScale * mix( 1.0, vTwinkle, 0.45 );
`;

const TWINKLE_COLOR = /* glsl */ `
  #include <color_fragment>
  diffuseColor.rgb *= clamp( vTwinkle, 0.0, 2.0 );
`;

/** Point material patch driving the per-star size and brightness pulse. */
function twinklePatch(uniforms: { uTime: { value: number } }): MaterialPatch {
  return {
    onBeforeCompile: (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${TWINKLE_VERTEX_DECLARATIONS}\nvoid main() {`)
        .replace('gl_PointSize = size;', TWINKLE_SIZE);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vTwinkle;\nvoid main() {')
        .replace('#include <color_fragment>', TWINKLE_COLOR);
    },
    customProgramCacheKey: () => 'orbitim-twinkle'
  };
}

interface StarLayerProps {
  buffers: StarBuffers;
  sprite: THREE.Texture;
  patch: MaterialPatch;
  /** Base point size the per-star scale multiplies. */
  size: number;
  opacity: number;
}

function StarLayer({ buffers, sprite, patch, size, opacity }: StarLayerProps) {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[buffers.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[buffers.phases, 1]} />
        <bufferAttribute attach="attributes-aTwinkle" args={[buffers.twinkles, 1]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        alphaMap={sprite}
        vertexColors
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
        onBeforeCompile={patch.onBeforeCompile}
        customProgramCacheKey={patch.customProgramCacheKey}
      />
    </points>
  );
}

/**
 * Deep sky.
 *
 * Four layers, in front of one another: a Milky Way plate carrying the galactic
 * band and its dust lanes; the unresolved star field, seeded thickly along that
 * band; the named stars at their real catalogue positions and relative
 * brightnesses; and the classical constellation figures joining them, faint
 * enough to be found rather than read.
 *
 * All of it hangs in one group rotated by the obliquity of the ecliptic, so the
 * sky sits at the correct angle to the plane the planets orbit in: the Milky Way
 * crosses it steeply, as it does overhead.
 */
export function Starfield() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const stars = useMemo(createStars, []);
  const brightStars = useMemo(createBrightStars, []);
  const figures = useMemo(createFigures, []);
  const sprite = useMemo(createStarSprite, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const patch = useMemo(() => twinklePatch(uniforms), [uniforms]);
  const figuresVisible = useViewSettings((s) => s.figuresVisible);

  useEffect(() => {
    let cancelled = false;
    new THREE.TextureLoader().load(STARFIELD_TEXTURE, (loaded) => {
      if (cancelled) return;
      loaded.colorSpace = THREE.SRGBColorSpace;
      setTexture(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group rotation={[-OBLIQUITY, 0, 0]}>
      {texture && (
        <mesh>
          <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
          {/* Tinted well below white: the plate is context, the point stars and
              the planets are the subject. */}
          <meshBasicMaterial map={texture} color="#414d75" side={THREE.BackSide} toneMapped={false} depthWrite={false} />
        </mesh>
      )}

      {figuresVisible && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[figures, 3]} />
          </bufferGeometry>
          {/* Barely there. A figure that competes with its own stars stops being a
              constellation and becomes a diagram. */}
          <lineBasicMaterial color="#8fb4ff" transparent opacity={0.11} depthWrite={false} toneMapped={false} />
        </lineSegments>
      )}

      <StarLayer buffers={stars} sprite={sprite} patch={patch} size={220} opacity={0.9} />
      <StarLayer buffers={brightStars} sprite={sprite} patch={patch} size={340} opacity={1} />
    </group>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BodyRecord } from '../lib/ephemeris/bodies';
import { J2000_MS } from '../lib/ephemeris/rotation';
import { useSimTime } from './useSimTime';

interface RingsProps {
  record: BodyRecord;
  radius: number;
  map: THREE.Texture | null;
  /** World position of the parent body, used to find the sun direction. */
  worldPosition: THREE.Vector3;
}

const VERTEX = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  void main() {
    vLocalPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    // The ring geometry lies in its own XY plane, so its face normal is +Z
    // whatever the planet's tilt has done to the frame it sits in.
    vViewNormal = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * Ring material.
 *
 * The published strip is a single radial slice of opacity and colour. What
 * makes a ring plane read as a swarm of ice rather than a printed disc is
 * everything that slice cannot carry: it thickens as it is seen closer to
 * edge-on, because the sight line then crosses far more of the layer; it flips
 * from reflecting to transmitting as the Sun crosses to the far side, at which
 * point the dense bands go dark and the gaps between them light up; it takes
 * the planet's shadow across it; and it resolves into ringlets finer than any
 * texture, which have to be faded out as soon as they are smaller than a pixel
 * or they boil.
 */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform bool uHasMap;
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uPlanetRadius;
  uniform vec3 uSunDirection;
  uniform float uSimDays;
  uniform bool uIsUranus;

  varying vec3 vLocalPosition;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  float hash(float x) {
    return fract(sin(x * 127.1) * 43758.5453123);
  }

  float narrowBand(float radiusRatio, float centre, float halfWidth) {
    return 1.0 - smoothstep(halfWidth * 0.45, halfWidth, abs(radiusRatio - centre));
  }

  void main() {
    float r = length(vLocalPosition.xy);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

    vec4 sampled = uHasMap ? texture2D(uMap, vec2(t, 0.5)) : vec4(uColor, 0.55);
    vec3 color = uHasMap ? sampled.rgb : uColor;
    float opacity = uHasMap ? sampled.a : 0.45;
    float radiusRatio = max(r / uPlanetRadius, 1.0);

    if (uIsUranus) {
      // The 13 observed Uranian rings are mostly narrow and dark, not a broad
      // bright sheet. Ratios are ring radii divided by Uranus's equatorial
      // radius; the broad Nu and Mu dust rings remain deliberately faint.
      float zeta = narrowBand(radiusRatio, 1.49, 0.055) * 0.003;
      float six = narrowBand(radiusRatio, 1.637, 0.004) * 0.11;
      float five = narrowBand(radiusRatio, 1.652, 0.003) * 0.075;
      float four = narrowBand(radiusRatio, 1.666, 0.003) * 0.08;
      float alphaRing = narrowBand(radiusRatio, 1.750, 0.006) * 0.12;
      float beta = narrowBand(radiusRatio, 1.787, 0.007) * 0.11;
      float eta = narrowBand(radiusRatio, 1.846, 0.004) * 0.055;
      float gamma = narrowBand(radiusRatio, 1.863, 0.004) * 0.10;
      float delta = narrowBand(radiusRatio, 1.889, 0.005) * 0.095;
      float lambda = narrowBand(radiusRatio, 1.957, 0.003) * 0.045;
      float epsilon = narrowBand(radiusRatio, 2.001, 0.011) * 0.20;
      float nu = narrowBand(radiusRatio, 2.63, 0.065) * 0.0015;
      float muRing = narrowBand(radiusRatio, 3.82, 0.09) * 0.0012;

      opacity =
        zeta + six + five + four + alphaRing + beta + eta + gamma + delta +
        lambda + epsilon + nu + muRing;
      vec3 darkGrey = vec3(0.13, 0.15, 0.16);
      vec3 dustyRed = vec3(0.20, 0.10, 0.08);
      vec3 dustyBlue = vec3(0.10, 0.17, 0.23);
      float innerOpacity = max(opacity - nu - muRing, 0.0);
      color = darkGrey;
      color = mix(color, dustyRed, clamp(nu / max(opacity, 0.0001), 0.0, 1.0));
      color = mix(color, dustyBlue, clamp(muRing / max(opacity, 0.0001), 0.0, 1.0));
      color += vec3(0.05) * clamp(innerOpacity * 2.0, 0.0, 1.0);
    } else {
      // Ringlets, faded out as they approach the size of a pixel: fine radial
      // structure that is detail up close and nothing but aliasing at distance.
      float resolved = 1.0 - smoothstep(0.0, 1.0, fwidth(r) * 420.0);
      float ringlets = mix(1.0, hash(floor(r * 900.0)) * 0.35 + 0.65, resolved);
      // Ring particles orbit differentially rather than as a solid record. A
      // Keplerian period grows with radius; sparse azimuthal density structure
      // therefore shears around the planet, with inner ringlets moving faster.
      float orbitDays = 0.24 * pow(radiusRatio, 1.5);
      float orbitPhase = uSimDays * 6.28318530718 / orbitDays;
      float azimuth = atan(vLocalPosition.y, vLocalPosition.x);
      float densityWave = 0.965 + 0.035 * sin(azimuth * 7.0 + orbitPhase + r * 18.0);
      float wave = mix(1.0, densityWave, resolved);
      opacity *= ringlets * wave;
    }

    // How obliquely this pixel's sight line crosses the layer. Signed, because
    // which face is being looked at decides whether the Sun is on this side.
    float signedMu = dot(normalize(vViewNormal), normalize(-vViewPosition));
    float mu = clamp(abs(signedMu), 0.07, 1.0);
    // Beer-Lambert through a slab: the same particles block more light along a
    // grazing path, so the plane closes up as it turns edge-on.
    float alpha = 1.0 - pow(clamp(1.0 - opacity, 0.0, 1.0), 1.0 / mu);

    // Saturn's own shadow. The ray from this point towards the Sun is blocked
    // when it passes within the planet's radius of the centre.
    vec3 point = vec3(vLocalPosition.xy, 0.0);
    float along = -dot(point, uSunDirection);
    float shadow = 1.0;
    if (along > 0.0) {
      float miss = length(point + uSunDirection * along);
      shadow = smoothstep(uPlanetRadius * 0.96, uPlanetRadius * 1.06, miss);
    }

    // Elevation of the Sun above the ring plane. Near zero the light rakes
    // along the layer and the whole plane dims; high up, every grain is lit.
    float sunElevation = uSunDirection.z;
    float lit = mix(0.8, 1.45, clamp(abs(sunElevation), 0.0, 1.0));

    if (signedMu * sunElevation < 0.0) {
      // Sun behind the plane: what reaches the eye is light that came through.
      // The dense bands go dark and the gaps between them glow, which is why
      // the Cassini division is the brightest thing in a backlit ring.
      if (uIsUranus) {
        // Voyager's dark Uranian ring particles do not form Saturn's luminous
        // backlit veil; retain the named ring opacity and dim their reflected
        // face instead of lighting every empty gap in the geometric plane.
        color *= 0.45;
        alpha *= 0.85;
      } else {
        float transmitted = pow(clamp(1.0 - opacity, 0.0, 1.0), 0.6);
        color = mix(color * 0.3, color * 1.5 + vec3(0.16, 0.14, 0.10), transmitted);
        alpha = mix(alpha, alpha * 0.8 + 0.18 * transmitted, 0.75);
      }
    } else {
      // Sun on this side: straight reflection, plus the opposition surge that
      // brightens a particle swarm looked at from alongside its own light.
      float opposition = pow(clamp(signedMu * sunElevation, 0.0, 1.0), 6.0);
      color *= lit * (1.0 + 0.35 * opposition);
    }

    color *= mix(0.16, 1.0, shadow);
    // Ice, not dust: a touch of cold in the highlights keeps the plane from
    // reading as the same tan as the planet behind it.
    color *= vec3(1.0, 0.99, 0.97);

    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Ring plane for Saturn and Uranus. The published ring texture is a radial
 * strip, so it is sampled by radius in the shader rather than by the mesh UVs.
 */
export function Rings({ record, radius, map, worldPosition }: RingsProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const inner = radius * record.rings!.innerRadii;
  const outer = radius * record.rings!.outerRadii;

  // Radial structure is the shader's job, so the mesh only needs enough segments
  // around that the rim never reads as a polygon at the closest approach.
  const geometry = useMemo(() => new THREE.RingGeometry(inner, outer, 512, 1), [inner, outer]);
  // The geometry is created here rather than declaratively, so releasing it is
  // this component's job too.
  useEffect(() => () => geometry.dispose(), [geometry]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uHasMap: { value: map !== null },
      uColor: { value: new THREE.Color(record.color) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uPlanetRadius: { value: radius },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uSimDays: { value: 0 },
      uIsUranus: { value: record.id === 'uranus' }
    }),
    [map, record.color, record.id, inner, outer, radius]
  );

  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!material.current || !mesh.current) return;
    material.current.uniforms.uSimDays.value =
      (useSimTime.getState().date.getTime() - J2000_MS) / 86_400_000;
    // The Sun is at the world origin; carry the direction to it into the ring's
    // own frame, which is tilted with the planet.
    mesh.current.getWorldQuaternion(rotation).invert();
    scratch.copy(worldPosition).negate().normalize().applyQuaternion(rotation);
    material.current.uniforms.uSunDirection.value.copy(scratch);
  });

  return (
    <mesh ref={mesh} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial
        ref={material}
        key={map?.uuid ?? 'flat'}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

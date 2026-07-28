import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSolarActivity } from './solarActivity';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vPositionView;

  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vPositionView = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * The photosphere is convection, not a still image: granulation cells turn over
 * in minutes and the supergranular pattern drifts. The published map supplies
 * the large-scale structure; the shader warps it with drifting noise and adds a
 * finer, faster cell pattern on top, so the surface boils instead of sitting.
 */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCool;
  uniform float uActivity;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vPositionView;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  // Noise is evaluated on the sphere itself. Both sides of the texture seam
  // become the same 3D point, and longitude naturally converges at each pole
  // instead of stretching granules into meridian streaks.
  vec3 spherePoint(vec2 uv) {
    float longitude = uv.x * 6.28318530718;
    float latitude = (uv.y - 0.5) * 3.14159265359;
    float cosLatitude = cos(latitude);
    return vec3(
      cosLatitude * cos(longitude),
      sin(latitude),
      cosLatitude * sin(longitude)
    );
  }

  void main() {
    // Domain warp: the map is sampled through a slowly turning noise field, so
    // features stretch and shear the way plasma does rather than sliding.
    float convectionRate = mix(1.0, 1.3, uActivity);
    vec3 surfacePoint = spherePoint(vUv);
    vec2 warp = vec2(
      fbm(surfacePoint * 3.2 + vec3(uTime * 0.02, uTime * 0.014, -uTime * 0.009) * convectionRate),
      fbm(surfacePoint * 3.2 + vec3(4.7 - uTime * 0.017, 1.3 + uTime * 0.011, 2.4) * convectionRate)
    );
    vec2 uv = vec2(
      fract(vUv.x + (warp.x - 0.5) * 0.026),
      clamp(vUv.y + (warp.y - 0.5) * 0.03, 0.001, 0.999)
    );

    vec3 base = texture2D(uMap, uv).rgb;
    // The observational plate's first and last columns are not identical.
    // Blend their neighbourhoods across a narrow interval so the published
    // edge cannot reappear as a dark hairline after the periodic warp.
    float edgeDistance = min(uv.x, 1.0 - uv.x);
    float edgeBlend = 1.0 - smoothstep(0.0, 0.035, edgeDistance);
    vec3 oppositeEdge = texture2D(uMap, vec2(1.0 - uv.x, uv.y)).rgb;
    base = mix(base, (base + oppositeEdge) * 0.5, edgeBlend);

    // Granulation, an order of magnitude finer and faster than the warp.
    float cells = fbm(
      surfacePoint * 52.0 +
      vec3(uTime * 0.35, -uTime * 0.22, uTime * 0.16) * convectionRate
    );
    float flare = pow(
      fbm(
        surfacePoint * 12.0 -
        vec3(uTime * 0.06, uTime * 0.04, -uTime * 0.025) * convectionRate
      ),
      3.0
    );

    float brightness = dot(base, vec3(0.299, 0.587, 0.114));
    float geometryEdgeDistance = min(vUv.x, 1.0 - vUv.x);
    float geometryEdgeBlend = 1.0 - smoothstep(0.0, 0.055, geometryEdgeDistance);
    brightness = mix(brightness, 0.45 + cells * 0.28, geometryEdgeBlend);
    float poleCompression = smoothstep(0.78, 0.98, abs(vUv.y * 2.0 - 1.0));
    brightness = mix(brightness, 0.45 + cells * 0.28, poleCompression * 0.82);
    float heat = clamp(brightness * 1.5 + cells * 0.5 - 0.62, 0.0, 1.0);
    vec3 color = mix(uCool, uHot, heat);
    // Active granules approach warm white without losing their internal
    // structure to hard clipping; the corona carries the broader glare.
    color += vec3(1.0, 0.88, 0.66) * pow(max(heat - 0.55, 0.0), 1.5) * 1.15;
    color *= 1.0 + cells * 0.34;
    color += uHot * flare * mix(0.22, 0.52, uActivity);

    // Limb darkening, then a thin rim of chromosphere brighter than the disc.
    vec3 normal = normalize(vNormalView);
    vec3 viewDirection = normalize(-vPositionView);
    float mu = clamp(dot(normal, viewDirection), 0.0, 1.0);
    color *= mix(0.42, 1.08, pow(mu, 0.55));
    color += vec3(1.0, 0.72, 0.35) * pow(1.0 - mu, 5.0) * mix(0.55, 0.82, uActivity);
    color *= 1.08;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Animated photosphere material. The corona and post-process bloom carry its
 * glare; the photosphere stays tone-mapped so active regions remain structured
 * instead of clipping into isolated white patches.
 */
export function SunSurface({ map }: { map: THREE.Texture | null }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const activity = useSolarActivity((state) => state.level);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uTime: { value: 0 },
      uHot: { value: new THREE.Color('#ffd06a') },
      uCool: { value: new THREE.Color('#ad2607') },
      uActivity: { value: 0 }
    }),
    // The map arrives after the first render; rebuilding the uniform block is
    // how the new texture reaches the shader.
    [map]
  );

  useEffect(() => {
    if (!map) return;
    // Domain-warped samples cross the published map's longitude seam. Repeat
    // wrapping blends those neighbours instead of clamping to a bright/dark
    // vertical edge.
    map.wrapS = THREE.RepeatWrapping;
    map.needsUpdate = true;
  }, [map]);

  useFrame((_, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value += delta;
      material.current.uniforms.uActivity.value = THREE.MathUtils.damp(
        material.current.uniforms.uActivity.value,
        activity,
        1.25,
        delta
      );
    }
  });

  if (!map) return <meshBasicMaterial color="#ffb347" toneMapped={false} />;

  return (
    <shaderMaterial
      ref={material}
      key={map.uuid}
      uniforms={uniforms}
      vertexShader={VERTEX}
      fragmentShader={FRAGMENT}
      toneMapped
    />
  );
}

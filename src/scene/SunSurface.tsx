import { useMemo, useRef } from 'react';
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Domain warp: the map is sampled through a slowly turning noise field, so
    // features stretch and shear the way plasma does rather than sliding.
    float convectionRate = mix(1.0, 1.3, uActivity);
    vec2 warp = vec2(
      fbm(vUv * 6.0 + vec2(uTime * 0.02, uTime * 0.014) * convectionRate),
      fbm(vUv * 6.0 + vec2(4.7 - uTime * 0.017, 1.3 + uTime * 0.011) * convectionRate)
    );
    vec2 uv = vUv + (warp - 0.5) * 0.035;

    vec3 base = texture2D(uMap, uv).rgb;

    // Granulation, an order of magnitude finer and faster than the warp.
    float cells = fbm(vUv * vec2(120.0, 60.0) + vec2(uTime * 0.35, -uTime * 0.22) * convectionRate);
    float flare = pow(fbm(vUv * vec2(24.0, 12.0) - vec2(uTime * 0.06, uTime * 0.04) * convectionRate), 3.0);

    float brightness = dot(base, vec3(0.299, 0.587, 0.114));
    float heat = clamp(brightness * 1.5 + cells * 0.5 - 0.62, 0.0, 1.0);
    vec3 color = mix(uCool, uHot, heat);
    // The hottest granule cores run past the yellow end into white.
    color += vec3(1.0, 0.88, 0.66) * pow(max(heat - 0.55, 0.0), 1.5) * 4.5;
    color *= 0.95 + cells * 0.55;
    color += uHot * flare * mix(0.7, 1.45, uActivity);

    // Limb darkening, then a thin rim of chromosphere brighter than the disc.
    vec3 normal = normalize(vNormalView);
    vec3 viewDirection = normalize(-vPositionView);
    float mu = clamp(dot(normal, viewDirection), 0.0, 1.0);
    color *= mix(0.42, 1.08, pow(mu, 0.55));
    color += vec3(1.0, 0.72, 0.35) * pow(1.0 - mu, 5.0) * mix(0.9, 1.2, uActivity);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Animated photosphere material. Output runs above 1.0 on purpose: the Sun is
 * the one surface in the scene that should clip the bloom threshold.
 */
export function SunSurface({ map }: { map: THREE.Texture | null }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const activity = useSolarActivity((state) => state.level);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uTime: { value: 0 },
      uHot: { value: new THREE.Color('#ffb43c') },
      uCool: { value: new THREE.Color('#a81f05') },
      uActivity: { value: 0 }
    }),
    // The map arrives after the first render; rebuilding the uniform block is
    // how the new texture reaches the shader.
    [map]
  );

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
      toneMapped={false}
    />
  );
}

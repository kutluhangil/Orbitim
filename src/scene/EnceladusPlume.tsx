import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface EnceladusPlumeProps {
  radius: number;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  varying float vAlpha;

  void main() {
    float phase = fract( aSeed * 19.19 + uTime * 0.035 );
    float flicker = 0.78 + 0.22 * sin( uTime * 2.2 + aSeed * 31.0 );
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = mix( 1.0, 3.0, phase ) * flicker;
    vAlpha = ( 1.0 - phase ) * flicker;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;

  void main() {
    float r = length( gl_PointCoord - 0.5 );
    float disc = 1.0 - smoothstep( 0.22, 0.5, r );
    gl_FragColor = vec4( 0.84, 0.94, 1.0, disc * vAlpha * 0.54 );
  }
`;

function plumeGeometry(radius: number): THREE.BufferGeometry {
  const sourceCount = 8;
  const particlesPerSource = 34;
  const positions = new Float32Array(sourceCount * particlesPerSource * 3);
  const seeds = new Float32Array(sourceCount * particlesPerSource);
  const rootRadius = radius * 0.992;

  for (let source = 0; source < sourceCount; source += 1) {
    const azimuth = (source / sourceCount) * Math.PI * 2 + 0.18;
    const polarRadius = 0.19 + (source % 3) * 0.018;
    const root = new THREE.Vector3(
      Math.cos(azimuth) * polarRadius,
      -Math.sqrt(1 - polarRadius * polarRadius),
      Math.sin(azimuth) * polarRadius
    ).normalize();
    const tangent = new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
    const bitangent = new THREE.Vector3().crossVectors(root, tangent).normalize();

    for (let particle = 0; particle < particlesPerSource; particle += 1) {
      const index = source * particlesPerSource + particle;
      const seed = (index * 0.61803398875) % 1;
      const height = radius * (0.025 + seed * 0.31);
      const spread = height * (0.018 + ((index * 0.41421356237) % 1) * 0.075);
      const lateralAngle = (index * 2.39996322973) % (Math.PI * 2);
      const lateral = tangent.clone().multiplyScalar(Math.cos(lateralAngle) * spread)
        .add(bitangent.clone().multiplyScalar(Math.sin(lateralAngle) * spread));
      const point = root.clone().multiplyScalar(rootRadius + height).add(lateral);

      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
      seeds[index] = seed;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

/**
 * Cassini observed water-vapour and ice-particle jets along Enceladus's south
 * polar fractures. This is a restrained, animated particle view of those
 * persistent observed plumes, not a claim of real-time vent-rate telemetry.
 */
export function EnceladusPlume({ radius }: EnceladusPlumeProps) {
  const geometry = useMemo(() => plumeGeometry(radius), [radius]);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }),
    []
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points geometry={geometry} material={material} />;
}

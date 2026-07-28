import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSolarActivity } from './solarActivity';

/**
 * Radial falloff sprite for the Sun's corona. A camera-facing gradient reads as
 * light spilling past the limb from every angle, where the previous shell of
 * geometry read as a hard-edged ring around the disc.
 */
function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable for the Sun glow texture');

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,248,220,0.92)');
  gradient.addColorStop(0.14, 'rgba(255,218,138,0.68)');
  gradient.addColorStop(0.3, 'rgba(255,166,61,0.22)');
  gradient.addColorStop(0.58, 'rgba(255,116,35,0.045)');
  gradient.addColorStop(1, 'rgba(255,110,30,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A separate, hollow corona avoids painting a flat white disc over the
 * photosphere. Its energy begins just beyond the limb and remains readable
 * even when the camera is close enough to fill the frame with the Sun.
 */
function createCoronaTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable for the Sun corona texture');

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,210,128,0)');
  gradient.addColorStop(0.16, 'rgba(255,210,128,0)');
  gradient.addColorStop(0.25, 'rgba(255,222,152,0.03)');
  gradient.addColorStop(0.36, 'rgba(255,188,87,0.18)');
  gradient.addColorStop(0.52, 'rgba(255,142,48,0.075)');
  gradient.addColorStop(0.77, 'rgba(255,121,37,0.012)');
  gradient.addColorStop(1, 'rgba(255,110,30,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Two stacked sprites: a tight photosphere bloom and a wide corona. */
export function SunGlow({ radius }: { radius: number }) {
  const glowTexture = useMemo(createGlowTexture, []);
  const coronaTexture = useMemo(createCoronaTexture, []);
  const activity = useSolarActivity((state) => state.level);
  const corona = useRef<THREE.Sprite>(null);
  const inner = useRef<THREE.SpriteMaterial>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const response = useRef(0);

  // The corona is not static: it swells and settles with activity. Two
  // incommensurate periods keep the beat from reading as a loop.
  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    response.current = THREE.MathUtils.damp(response.current, activity, 1.25, delta);
    const pulseAmplitude = 0.025 + response.current * 0.055;
    const pulse = 1 + Math.sin(t * 0.21) * pulseAmplitude + Math.sin(t * 0.07 + 1.7) * pulseAmplitude * 0.65;
    if (corona.current) {
      corona.current.scale.set(radius * 11.5 * pulse, radius * 11.5 * pulse, 1);
      // The hollow corona is restrained at overview scale, but never removed
      // entirely on approach: the solar limb still emits past the frame edge.
      const distance = camera.position.distanceTo(corona.current.getWorldPosition(scratch));
      const material = corona.current.material as THREE.SpriteMaterial;
      const farField = THREE.MathUtils.smoothstep(distance / radius, 2.2, 8.5);
      material.opacity = (0.28 + response.current * 0.18) * (0.42 + farField * 0.58);
    }
    if (inner.current) inner.current.opacity = 1.04 + response.current * 0.16 + Math.sin(t * 0.33) * pulseAmplitude;
  });

  return (
    <>
      <sprite scale={[radius * 4.2, radius * 4.2, 1]}>
        <spriteMaterial
          ref={inner}
          map={glowTexture}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={1.04}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={corona} scale={[radius * 11.5, radius * 11.5, 1]}>
        <spriteMaterial
          map={coronaTexture}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </>
  );
}

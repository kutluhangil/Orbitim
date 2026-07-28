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
  gradient.addColorStop(0, 'rgba(255,241,204,1)');
  gradient.addColorStop(0.16, 'rgba(255,205,112,0.72)');
  gradient.addColorStop(0.34, 'rgba(255,151,49,0.2)');
  gradient.addColorStop(0.6, 'rgba(255,116,35,0.035)');
  gradient.addColorStop(1, 'rgba(255,110,30,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Two stacked sprites: a tight photosphere bloom and a wide corona. */
export function SunGlow({ radius }: { radius: number }) {
  const texture = useMemo(createGlowTexture, []);
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
      corona.current.scale.set(radius * 9 * pulse, radius * 9 * pulse, 1);
      // Close in, the corona sprite would fill the frame and wash the scene
      // out; it fades as the camera enters the region it is meant to suggest.
      const distance = camera.position.distanceTo(corona.current.getWorldPosition(scratch));
      const material = corona.current.material as THREE.SpriteMaterial;
      material.opacity = (0.2 + response.current * 0.14) * THREE.MathUtils.smoothstep(distance / radius, 3.5, 9.0);
    }
    if (inner.current) inner.current.opacity = 0.98 + response.current * 0.1 + Math.sin(t * 0.33) * pulseAmplitude;
  });

  return (
    <>
      <sprite scale={[radius * 5, radius * 5, 1]}>
        <spriteMaterial
          ref={inner}
          map={texture}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.98}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={corona} scale={[radius * 9, radius * 9, 1]}>
        <spriteMaterial
          map={texture}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </>
  );
}

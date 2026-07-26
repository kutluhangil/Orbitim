import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSolarActivity } from './solarActivity';

const SOURCE_LOCATION = /^([NS])(\d+(?:\.\d+)?)([EW])(\d+(?:\.\d+)?)$/i;

function sourceNormal(sourceLocation: string | null): THREE.Vector3 {
  const match = sourceLocation ? SOURCE_LOCATION.exec(sourceLocation.replaceAll(' ', '')) : null;
  if (!match) return new THREE.Vector3(0.16, 0.32, 0.93).normalize();

  const latitude = Number(match[2]) * (Math.PI / 180) * (match[1].toUpperCase() === 'S' ? -1 : 1);
  const longitude = Number(match[4]) * (Math.PI / 180) * (match[3].toUpperCase() === 'W' ? -1 : 1);
  const cosLatitude = Math.cos(latitude);
  return new THREE.Vector3(
    cosLatitude * Math.sin(longitude),
    Math.sin(latitude),
    cosLatitude * Math.cos(longitude)
  );
}

interface Prominence {
  geometry: THREE.TubeGeometry;
  phase: number;
}

/**
 * Magnetic loops rising from NASA DONKI's latest reported flare region. They
 * are restrained at quiet activity levels: this is corona plasma, not flames.
 */
export function SolarProminences({ radius }: { radius: number }) {
  const activity = useSolarActivity((state) => state.level);
  const sourceLocation = useSolarActivity((state) => state.sourceLocation);
  const materials = useRef<THREE.MeshBasicMaterial[]>([]);

  const prominences = useMemo<Prominence[]>(() => {
    const normal = sourceNormal(sourceLocation);
    const tangent = new THREE.Vector3(0, 1, 0).cross(normal);
    if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0).cross(normal);
    tangent.normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    return [0, 1, 2].map((index) => {
      const angle = (index - 1) * 0.52;
      const direction = tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(bitangent, Math.sin(angle)).normalize();
      const span = radius * (0.075 + index * 0.018);
      const height = radius * (0.075 + index * 0.022);
      const surface = normal.clone().multiplyScalar(radius * 1.003);
      const curve = new THREE.CatmullRomCurve3([
        surface.clone().addScaledVector(direction, -span),
        surface.clone().addScaledVector(normal, height),
        surface.clone().addScaledVector(direction, span)
      ]);
      return {
        geometry: new THREE.TubeGeometry(curve, 28, radius * (0.0022 + index * 0.0005), 6, false),
        phase: index * 1.73
      };
    });
  }, [radius, sourceLocation]);

  useFrame(({ clock }) => {
    const intensity = THREE.MathUtils.smoothstep(activity, 0.035, 0.85);
    for (let index = 0; index < materials.current.length; index++) {
      const material = materials.current[index];
      if (!material) continue;
      const flicker = 0.8 + Math.sin(clock.elapsedTime * (2.1 + index * 0.37) + prominences[index].phase) * 0.2;
      material.opacity = (0.05 + intensity * 0.72) * flicker;
    }
  });

  return (
    <group>
      {prominences.map((prominence, index) => (
        <mesh key={`${sourceLocation ?? 'quiet'}-${index}`} geometry={prominence.geometry} renderOrder={4}>
          <meshBasicMaterial
            ref={(material) => {
              if (material) materials.current[index] = material;
            }}
            color={index === 1 ? '#fff2b4' : '#ff6a28'}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getBodyRecord, type BodyId } from '../lib/ephemeris/bodies';
import { getAxialTilt, getSpinAngle } from '../lib/ephemeris/rotation';
import { useBodyTexture } from '../lib/textures/useBodyTexture';
import { lodFor, useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import { useBodyShading } from './surfaceShading';
import { Rings } from './Rings';
import { SunGlow } from './SunGlow';
import { SunSurface } from './SunSurface';
import { Atmosphere, ATMOSPHERES } from './Atmosphere';

interface BodyProps {
  id: BodyId;
  registry: PositionRegistry;
  onSelect: (id: BodyId) => void;
}

/** Segment count scales with level of detail so far bodies stay cheap. */
const SEGMENTS = { far: 48, near: 192 } as const;

export function Body({ id, registry, onSelect }: BodyProps) {
  const record = getBodyRecord(id);
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);

  const phase = useFlight((s) => s.phase);
  const target = useFlight((s) => s.target);
  const lod = lodFor(id, phase, target);
  const textures = useBodyTexture(id, lod);
  const shading = useBodyShading(id, registry);

  const radius = sceneRadiusOf(id);
  const isStar = record.kind === 'star';
  const atmosphere = ATMOSPHERES[id];
  const worldPosition = registry.get(id)!;

  useFrame(() => {
    const position = registry.get(id);
    if (position && group.current) group.current.position.copy(position);

    const date = useSimTime.getState().date;
    const spin = getSpinAngle(id, date);
    if (surface.current) surface.current.rotation.y = spin;
    // Clouds drift slightly faster than the surface, as they do in reality.
    if (clouds.current) clouds.current.rotation.y = spin * 1.08;
  });

  return (
    <group ref={group} rotation={[getAxialTilt(id), 0, 0]}>
      <mesh
        ref={surface}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(id);
        }}
      >
        <sphereGeometry args={[radius, SEGMENTS[lod], SEGMENTS[lod] / 2]} />
        {isStar ? (
          <SunSurface map={textures.map} />
        ) : (
          <meshStandardMaterial
            key={`${textures.map?.uuid ?? 'flat'}-${textures.emissiveMap?.uuid ?? 'none'}`}
            map={textures.map ?? undefined}
            color={textures.map ? '#ffffff' : record.color}
            emissiveMap={textures.emissiveMap ?? undefined}
            emissive={textures.emissiveMap ? new THREE.Color('#ffcf87') : new THREE.Color('#000000')}
            /* Confined to the night side by the shading patch, the lights can
               carry their real brightness instead of the dim average that kept
               them from washing out the daylit hemisphere. */
            emissiveIntensity={textures.emissiveMap ? 1.25 : 0}
            roughness={0.92}
            metalness={0}
            onBeforeCompile={shading.surface.onBeforeCompile}
            customProgramCacheKey={shading.surface.customProgramCacheKey}
          />
        )}
      </mesh>

      {textures.cloudMap && (
        <mesh ref={clouds}>
          <sphereGeometry args={[radius * 1.006, SEGMENTS[lod], SEGMENTS[lod] / 2]} />
          {/* The published cloud map is white cloud on a black sky. Added on
              top of the surface, black contributes nothing and the clouds sit
              over the terrain without an alpha channel to rely on. */}
          <meshBasicMaterial
            key={textures.cloudMap.uuid}
            map={textures.cloudMap}
            blending={THREE.AdditiveBlending}
            transparent
            opacity={0.5}
            depthWrite={false}
            onBeforeCompile={shading.clouds.onBeforeCompile}
            customProgramCacheKey={shading.clouds.customProgramCacheKey}
          />
        </mesh>
      )}

      {atmosphere && <Atmosphere profile={atmosphere} radius={radius} worldPosition={worldPosition} />}

      {record.rings && (
        <Rings record={record} radius={radius} map={textures.ringMap} worldPosition={worldPosition} />
      )}

      {isStar && <SunGlow radius={radius} />}
    </group>
  );
}

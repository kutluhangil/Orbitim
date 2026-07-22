import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getBodyRecord, type BodyId } from '../lib/ephemeris/bodies';
import { getAxialTilt, getSpinAngle } from '../lib/ephemeris/rotation';
import { useBodyTexture } from '../lib/textures/useBodyTexture';
import { lodFor, useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import { mergePatches, useBodyShading } from './surfaceShading';
import { useMoonRelief } from './moonRelief';
import { Rings } from './Rings';
import { SunGlow } from './SunGlow';
import { SunSurface } from './SunSurface';
import { Atmosphere, ATMOSPHERES } from './Atmosphere';
import { SurfaceSites } from './SurfaceSites';
import { getExploration } from '../data/missions';

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

  // A pointer crossing a body flushes its name in for a couple of seconds. The
  // reveal removes itself when its own animation ends, so this is a single burst
  // per hover rather than a label that has to be dismissed.
  const [revealed, setRevealed] = useState(false);

  const phase = useFlight((s) => s.phase);
  const target = useFlight((s) => s.target);
  const lod = lodFor(id, phase, target);
  const textures = useBodyTexture(id, lod);
  const shading = useBodyShading(id, registry, ATMOSPHERES[id]?.color ?? null);
  const relief = useMoonRelief(id);
  const surfaceMaterial = useMemo(
    () => (relief ? mergePatches([shading.surface, relief]) : shading.surface),
    [shading.surface, relief]
  );

  const radius = sceneRadiusOf(id);
  const isStar = record.kind === 'star';
  const atmosphere = ATMOSPHERES[id];
  const worldPosition = registry.get(id)!;
  const sites = getExploration(id)?.sites ?? [];

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
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!revealed) setRevealed(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[radius, SEGMENTS[lod], SEGMENTS[lod] / 2]} />
        {isStar ? (
          <SunSurface map={textures.map} />
        ) : (
          <meshStandardMaterial
            key={`${textures.map?.uuid ?? 'flat'}-${textures.emissiveMap?.uuid ?? 'none'}-${textures.roughnessMap?.uuid ?? 'rough'}`}
            map={textures.map ?? undefined}
            /* The registry colour is the fallback for a body with neither a
               published map nor a generated surface; anything that supplies its
               own albedo must not be tinted by it a second time. */
            color={textures.map || relief ? '#ffffff' : record.color}
            emissiveMap={textures.emissiveMap ?? undefined}
            emissive={textures.emissiveMap ? new THREE.Color('#ffcf87') : new THREE.Color('#000000')}
            /* Confined to the night side by the shading patch, the lights can
               carry their real brightness instead of the dim average that kept
               them from washing out the daylit hemisphere. */
            emissiveIntensity={textures.emissiveMap ? 1.25 : 0}
            /* Where a roughness map is supplied it carries the absolute value —
               low over ocean for the sun-glint, matte over land — so the scalar
               passes it through untouched. Everything else keeps the flat matte. */
            roughnessMap={textures.roughnessMap ?? undefined}
            roughness={textures.roughnessMap ? 1 : 0.92}
            metalness={0}
            onBeforeCompile={surfaceMaterial.onBeforeCompile}
            customProgramCacheKey={surfaceMaterial.customProgramCacheKey}
          />
        )}

        {/* Children of the surface, so the sites turn with the ground they are
            on. Only drawn for the body the camera has arrived at: from the
            system view they would be a scatter of dots on a two-pixel disc. */}
        {sites.length > 0 && phase === 'orbiting' && target === id && (
          <SurfaceSites sites={sites} radius={radius} />
        )}
      </mesh>

      {revealed && (
        <Html center zIndexRange={[15, 5]} style={{ pointerEvents: 'none' }}>
          {/* Chrome pill, dark in both themes so the burst reads over a bright
              planet as clearly as over space. Lifted above the anchor so the
              name sits off the body rather than across its centre. */}
          <div
            onAnimationEnd={() => setRevealed(false)}
            className="body-name-reveal -translate-y-10 whitespace-nowrap rounded-full border border-sky-300/30 bg-black/60 px-3.5 py-1.5 text-[13px] font-light uppercase tracking-[0.28em] text-white shadow-lg shadow-black/40 backdrop-blur-md"
          >
            {record.name}
          </div>
        </Html>
      )}

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

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getBodyRecord, type BodyId } from '../lib/ephemeris/bodies';
import { getEarthCloudAngle, getSpinAxis, getVisibleSurfaceAngle } from '../lib/ephemeris/rotation';
import { useBodyTexture } from '../lib/textures/useBodyTexture';
import { lodFor, useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import {
  EARTH_CLOUD_BASE_ALTITUDE_RATIO,
  EARTH_CLOUD_RELIEF_RATIO,
  mergePatches,
  useBodyShading
} from './surfaceShading';
import { useMoonRelief } from './moonRelief';
import { Rings } from './Rings';
import { SunGlow } from './SunGlow';
import { SunSurface } from './SunSurface';
import { SolarProminences } from './SolarProminences';
import { EnceladusPlume } from './EnceladusPlume';
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

/**
 * Specular response by surface class. Regolith stays almost fully diffuse,
 * while deep cloud decks retain the broad, soft highlight seen in spacecraft
 * imagery. Earth supplies its own ocean/land roughness map.
 */
const SURFACE_ROUGHNESS: Partial<Record<BodyId, number>> = {
  mercury: 0.98,
  venus: 0.84,
  mars: 0.96,
  moon: 0.98,
  jupiter: 0.82,
  saturn: 0.84,
  uranus: 0.8,
  neptune: 0.78
};

export function Body({ id, registry, onSelect }: BodyProps) {
  const record = getBodyRecord(id);
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const pole = useMemo(() => new THREE.Vector3(), []);
  const north = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // A pointer crossing a body flushes its name in for a couple of seconds. The
  // reveal removes itself when its own animation ends, so this is a single burst
  // per hover rather than a label that has to be dismissed.
  const [revealed, setRevealed] = useState(false);

  const phase = useFlight((s) => s.phase);
  const target = useFlight((s) => s.target);
  const lod = lodFor(id, phase, target);
  const textures = useBodyTexture(id, lod);

  // A ringed planet takes its own ring's shadow across it. The ring lies in the
  // equatorial plane, so its world normal is the IAU north-pole direction in
  // the shared EQJ frame, mapped into scene axes. Radii are carried in scene
  // units for the shadow trace.
  const ringShadow = useMemo(() => {
    if (!record.rings) return null;
    const scale = sceneRadiusOf(id);
    const axis = getSpinAxis(id, useSimTime.getState().date);
    return {
      normal: new THREE.Vector3(axis.x, axis.z, -axis.y).normalize(),
      inner: scale * record.rings.innerRadii,
      outer: scale * record.rings.outerRadii,
      map: textures.ringMap
    };
  }, [id, record.rings, textures.ringMap]);

  const shading = useBodyShading(
    id,
    registry,
    ATMOSPHERES[id]?.color ?? null,
    textures.cloudMap,
    ringShadow
  );
  const relief = useMoonRelief(id);
  const surfaceMaterial = useMemo(
    () => (relief ? mergePatches([shading.surface, relief]) : shading.surface),
    [shading.surface, relief]
  );

  const radius = sceneRadiusOf(id);
  // Irregular moons keep all three measured axes. Rapidly rotating planets keep
  // their equatorial bulge rather than being forced into a perfect sphere.
  const shapeScale = record.shapeAxesKm
    ? ([
        record.shapeAxesKm[0] / (2 * record.radiusKm),
        record.shapeAxesKm[1] / (2 * record.radiusKm),
        record.shapeAxesKm[2] / (2 * record.radiusKm)
      ] as const)
    : record.polarRadiusKm
      ? ([1, record.polarRadiusKm / record.radiusKm, 1] as const)
      : undefined;
  const isStar = record.kind === 'star';
  const atmosphere = ATMOSPHERES[id];
  const worldPosition = registry.get(id)!;
  const sites = getExploration(id)?.sites ?? [];

  useFrame(() => {
    const position = registry.get(id);
    if (position && group.current) group.current.position.copy(position);

    const date = useSimTime.getState().date;
    const axis = getSpinAxis(id, date);
    // EQJ x/y/z becomes scene x/z/-y. Align the sphere's local north (+Y)
    // with the physical pole before applying the prime-meridian spin below.
    pole.set(axis.x, axis.z, -axis.y).normalize();
    if (group.current) group.current.quaternion.setFromUnitVectors(north, pole);
    const spin = getVisibleSurfaceAngle(id, date);
    if (surface.current) surface.current.rotation.y = spin;
    if (clouds.current) clouds.current.rotation.y = getEarthCloudAngle(date);
  });

  return (
    <group ref={group}>
      <mesh
        ref={surface}
        scale={shapeScale}
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
            roughness={textures.roughnessMap ? 1 : (SURFACE_ROUGHNESS[id] ?? 0.92)}
            metalness={0}
            onBeforeCompile={surfaceMaterial.onBeforeCompile}
            customProgramCacheKey={surfaceMaterial.customProgramCacheKey}
          />
        )}

        {isStar && <SolarProminences radius={radius} />}
        {id === 'enceladus' && <EnceladusPlume radius={radius} />}

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
        <mesh ref={clouds} scale={shapeScale}>
          <sphereGeometry
            args={[
              radius * (1 + EARTH_CLOUD_BASE_ALTITUDE_RATIO),
              SEGMENTS[lod],
              SEGMENTS[lod] / 2
            ]}
          />
          {/* The grayscale plate is density, not colour. Feeding it to both the
              albedo and alpha slots attenuates thin clouds twice, so it only
              drives transparency and elevation while sunlight shades a clean
              white water-ice albedo. */}
          <meshStandardMaterial
            key={textures.cloudMap.uuid}
            alphaMap={textures.cloudMap}
            alphaTest={0.02}
            transparent
            opacity={0.96}
            color="#ffffff"
            roughness={1}
            metalness={0}
            displacementMap={textures.cloudMap}
            displacementScale={radius * EARTH_CLOUD_RELIEF_RATIO}
            depthWrite={false}
            onBeforeCompile={shading.clouds.onBeforeCompile}
            customProgramCacheKey={shading.clouds.customProgramCacheKey}
          />
        </mesh>
      )}

      {atmosphere && (
        <Atmosphere
          profile={atmosphere}
          radius={radius}
          polarRatio={record.polarRadiusKm ? record.polarRadiusKm / record.radiusKm : 1}
          worldPosition={worldPosition}
        />
      )}

      {record.rings && (
        <Rings record={record} radius={radius} map={textures.ringMap} worldPosition={worldPosition} />
      )}

      {isStar && <SunGlow radius={radius} />}
    </group>
  );
}

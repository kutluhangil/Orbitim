import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { propagate } from 'satellite.js';
import type { SatelliteData } from '../services/tle';
import { getSpinAxis } from '../lib/ephemeris/rotation';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { getSatelliteGroup, useSatelliteGroups } from './satelliteGroups';
import { useSatelliteSelection } from './satelliteSelection';
import { useSiteSelection } from './siteSelection';
import { SatelliteFocus } from './SatelliteFocus';
import { EARTH_SCENE_RADIUS, KM_TO_SCENE, SGP4_EARTH_RADIUS_KM } from './satelliteFrame';
import { graphicsTier, isTouchPrimary } from '../lib/device';
import type { PositionRegistry } from './bodyPositions';

/**
 * Frames a full pass over the loaded element sets is spread across. A phone CPU
 * gets twice the slack: at low orbital speed a satellite still moves well under
 * a pixel between its turns.
 */
const PROPAGATION_SLICES = graphicsTier === 'low' ? 8 : 4;

/**
 * Pick radius as a fraction of the camera's height above the surface. A thumb
 * covers far more screen than a cursor, so it gets a wider net; both shrink as
 * the camera closes in, or picking near a satellite would grab its neighbours.
 */
const PICK_FRACTION = isTouchPrimary ? 0.016 : 0.007;

const SATELLITE_VERTEX_DECLARATIONS = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  varying float vPulse;
`;

const SATELLITE_POINT_SIZE = /* glsl */ `
  vPulse = 0.72 + sin( uTime * ( 1.4 + aPhase * 0.9 ) + aPhase * 6.2831853 ) * 0.28;
  gl_PointSize = size * vPulse;
`;

const SATELLITE_POINT_COLOR = /* glsl */ `
  #include <color_fragment>
  diffuseColor.rgb *= 0.7 + vPulse * 0.6;
`;

function satelliteGlowPatch(uniforms: { uTime: { value: number } }) {
  return {
    onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${SATELLITE_VERTEX_DECLARATIONS}\nvoid main() {`)
        .replace('gl_PointSize = size;', SATELLITE_POINT_SIZE);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vPulse;\nvoid main() {')
        .replace('#include <color_fragment>', SATELLITE_POINT_COLOR);
    },
    customProgramCacheKey: () => 'orbitim-satellite-points'
  };
}

interface SatelliteLayerProps {
  registry: PositionRegistry;
}

/**
 * Real satellites around Earth. Positions come from SGP4 propagation of
 * CelesTrak TLEs in the Earth-centred inertial frame, which is the same frame
 * Earth's own spin is rendered in, so a satellite over Istanbul is drawn over
 * Istanbul. The layer only exists while Earth is the flight target.
 */
export function SatelliteLayer({ registry }: SatelliteLayerProps) {
  const target = useFlight((s) => s.target);
  const phase = useFlight((s) => s.phase);
  const engaged = target === 'earth' && phase !== 'overview';
  const enabled = useSatelliteGroups((s) => s.enabled);
  const group = useRef<THREE.Group>(null);
  const pole = useMemo(() => new THREE.Vector3(), []);
  const north = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const { camera, raycaster } = useThree();

  // Leaving Earth takes the satellite panel and the followed object with it,
  // rather than leaving a dossier on screen for something no longer drawn.
  useEffect(() => {
    if (!engaged) useSatelliteSelection.getState().clear();
  }, [engaged]);

  useFrame(() => {
    if (!engaged || !group.current) return;
    const earth = registry.get('earth')!;
    group.current.position.copy(earth);
    const axis = getSpinAxis('earth', useSimTime.getState().date);
    // SGP4 positions are equatorial. Give the satellite frame the same real
    // Earth pole as the globe instead of the former ecliptic 23.44° tilt.
    pole.set(axis.x, axis.z, -axis.y).normalize();
    group.current.quaternion.setFromUnitVectors(north, pole);

    // Points are picked by proximity to the ray, not by any surface, so the
    // threshold is what makes a satellite tappable at all. It is set from the
    // camera's height above the surface rather than its distance to the centre,
    // so riding alongside one object does not put its whole neighbourhood
    // inside the net.
    const height = Math.max(0.02, camera.position.distanceTo(earth) - EARTH_SCENE_RADIUS);
    raycaster.params.Points.threshold = height * PICK_FRACTION;
  });

  if (!engaged) return null;

  return (
    <group ref={group}>
      {enabled.map((id) => (
        <SatelliteGroupPoints key={id} groupId={id} />
      ))}

      <SatelliteFocus />
    </group>
  );
}

/**
 * One constellation. Element sets are fetched once per group and propagated
 * every frame into a single points buffer, so adding a group costs one draw
 * call regardless of how many objects it carries.
 */
function SatelliteGroupPoints({ groupId }: { groupId: string }) {
  const definition = getSatelliteGroup(groupId);
  const load = useSatelliteGroups((s) => s.load);
  const satellites = useSatelliteGroups((s) => s.sets[groupId]) as SatelliteData[] | undefined;
  const points = useRef<THREE.Points>(null);
  const select = useSatelliteSelection((s) => s.select);

  useEffect(() => {
    load(groupId);
  }, [groupId, load]);

  const count = satellites?.length ?? 0;
  const positions = useMemo(() => new Float32Array(Math.max(count, 1) * 3), [count]);
  const phases = useMemo(
    () => Float32Array.from({ length: Math.max(count, 1) }, (_, index) => (Math.sin(index * 19.31 + 0.7) + 1) / 2),
    [count]
  );
  const cursor = useRef(0);
  const glowUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const glowPatch = useMemo(() => satelliteGlowPatch(glowUniforms), [glowUniforms]);

  // Points are raycast against the geometry's bounding sphere first, and the
  // position buffer is written straight into the GPU attribute without three
  // ever recomputing one. The sphere is derived from the element sets instead:
  // the highest apogee in the group bounds every position it can produce.
  useEffect(() => {
    const geometry = points.current?.geometry;
    if (!geometry || !satellites || satellites.length === 0) return;

    let apogeeKm = 0;
    for (const item of satellites) {
      apogeeKm = Math.max(apogeeKm, (item.satrec.alta + 1) * SGP4_EARTH_RADIUS_KM);
    }
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), apogeeKm * KM_TO_SCENE);
  }, [satellites]);

  useFrame(({ clock }) => {
    if (!satellites || satellites.length === 0 || !points.current) return;
    glowUniforms.uTime.value = clock.elapsedTime;

    const date = useSimTime.getState().date;
    const attribute = points.current.geometry.getAttribute('position') as THREE.BufferAttribute;

    // SGP4 for eleven thousand objects every frame is the single most expensive
    // thing in the scene. The set is propagated in slices instead: a satellite
    // in low orbit moves under a kilometre in the few frames before its turn
    // comes round again, which is far below one pixel at this scale.
    const slice = Math.ceil(satellites.length / PROPAGATION_SLICES);
    const start = cursor.current;
    const end = Math.min(start + slice, satellites.length);
    cursor.current = end >= satellites.length ? 0 : end;

    for (let i = start; i < end; i++) {
      const eci = propagate(satellites[i].satrec, date)?.position;
      if (!eci) {
        // A decayed or unpropagatable element set is parked at the origin of the
        // layer, which sits inside the planet and is therefore never drawn.
        attribute.setXYZ(i, 0, 0, 0);
        continue;
      }
      // Equatorial frame (z along the spin axis) into scene axes (y up).
      attribute.setXYZ(i, eci.x * KM_TO_SCENE, eci.z * KM_TO_SCENE, -eci.y * KM_TO_SCENE);
    }
    attribute.needsUpdate = true;
  });

  if (!satellites || satellites.length === 0) return null;

  const onPick = (event: ThreeEvent<MouseEvent>) => {
    if (event.index === undefined) return;
    const data = satellites[event.index];
    if (!data) return;
    // The parked placeholders all sit at the origin, where they would otherwise
    // answer for every tap aimed at the middle of the planet.
    if (!propagate(data.satrec, useSimTime.getState().date)) return;

    event.stopPropagation();
    // One dossier at a time: a satellite and a landing site are read in the same
    // panel, so picking one has to let go of the other.
    useSiteSelection.getState().clear();
    select({ groupId, data });
  };

  return (
    <points ref={points} onClick={onPick}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color={definition.color}
        // The distant trackables are photons in a telescope, not spacecraft
        // icons: each real TLE becomes one small, colour-coded luminous point.
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        onBeforeCompile={glowPatch.onBeforeCompile}
        customProgramCacheKey={glowPatch.customProgramCacheKey}
      />
    </points>
  );
}

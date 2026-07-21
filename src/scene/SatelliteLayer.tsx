import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { propagate } from 'satellite.js';
import type { SatelliteData } from '../services/tle';
import { getAxialTilt } from '../lib/ephemeris/rotation';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { getSatelliteGroup, useSatelliteGroups } from './satelliteGroups';
import { useSatelliteSelection } from './satelliteSelection';
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
    <group ref={group} rotation={[getAxialTilt('earth'), 0, 0]}>
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
  const cursor = useRef(0);

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

  useFrame(() => {
    if (!satellites || satellites.length === 0 || !points.current) return;

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
    select({ groupId, data });
  };

  return (
    <points ref={points} onClick={onPick}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={definition.color}
        size={0.014}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Line2 } from 'three-stdlib';
import { eciToEcf, gstime, propagate, type SatRec } from 'satellite.js';
import { getSatelliteGroup } from './satelliteGroups';
import { satelliteFocus, useSatelliteSelection } from './satelliteSelection';
import { EARTH_SCENE_RADIUS, equatorialToScene } from './satelliteFrame';
import { useSimTime } from './useSimTime';

/** Points along one orbital period, shared by the orbit line and the track. */
const SAMPLES = 256;
/**
 * How far the simulated clock may drift from the sampled arc before it is
 * resampled. An eighth of a period keeps the drawn orbit within the precession
 * SGP4 itself models, without resampling every frame.
 */
const RESAMPLE_FRACTION = 1 / 8;
/** Ground track altitude above the surface, in Earth radii — enough to clear z-fighting. */
const TRACK_LIFT = 1.004;
/** Marker radius as a fraction of its distance to the camera, so it holds its size on screen. */
const MARKER_ANGULAR_SIZE = 0.026;

/** Mounts the tracking rig for whichever satellite is selected, and nothing otherwise. */
export function SatelliteFocus() {
  const selected = useSatelliteSelection((s) => s.selected);
  if (!selected) return null;

  return (
    <TrackedSatellite
      // A new selection is a new set of samples; remounting is cheaper to reason
      // about than invalidating every buffer in place.
      key={selected.data.satrec.satnum}
      satrec={selected.data.satrec}
      color={getSatelliteGroup(selected.groupId).color}
    />
  );
}

interface TrackedSatelliteProps {
  satrec: SatRec;
  color: string;
}

/**
 * The selected satellite, drawn three ways: a billboard marker at the object
 * itself, its orbit as an inertial ellipse, and the ground track as the path the
 * sub-satellite point sweeps over the turning surface.
 *
 * The orbit lives in the inertial frame the layer already renders in. The ground
 * track lives in the Earth-fixed frame, in a child group turned by the sidereal
 * angle, which is the same angle the planet's own surface is turned by — so the
 * track stays pinned to the map underneath while the orbit does not.
 */
function TrackedSatellite({ satrec, color }: TrackedSatelliteProps) {
  const { camera } = useThree();
  const marker = useRef<THREE.Group>(null);
  const ground = useRef<THREE.Group>(null);
  const orbitLine = useRef<Line2>(null);
  const trackLine = useRef<Line2>(null);

  /** Sidereal period from the mean motion carried by the element set, minutes. */
  const periodMinutes = (2 * Math.PI) / satrec.no;

  const orbitPositions = useMemo(() => new Float32Array(SAMPLES * 3), []);
  const trackPositions = useMemo(() => new Float32Array(SAMPLES * 3), []);
  const seed = useMemo(() => Array.from({ length: SAMPLES }, () => new THREE.Vector3()), []);

  const sampledAtMs = useRef(Number.NaN);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const parentRotation = useMemo(() => new THREE.Quaternion(), []);

  /**
   * Walks one full period centred on the given instant, writing the inertial
   * orbit and the Earth-fixed ground track in a single pass. If SGP4 refuses any
   * sample both lines are hidden: an element set that cannot be carried around
   * its own orbit has no path worth drawing.
   */
  const resample = useCallback(
    (centreMs: number): void => {
      const orbit = orbitLine.current;
      const track = trackLine.current;
      // Called once from the mount effect and then from the frame loop, so a
      // pass before the lines exist simply waits for the next frame.
      if (!orbit || !track) return;

      const spanMs = periodMinutes * 60000;

      for (let i = 0; i < SAMPLES; i++) {
        const at = new Date(centreMs + (i / (SAMPLES - 1) - 0.5) * spanMs);
        const eci = propagate(satrec, at)?.position;
        if (!eci) {
          orbit.visible = false;
          track.visible = false;
          // Stamped anyway, so a hopeless element set is retried once per drift
          // window rather than every frame.
          sampledAtMs.current = centreMs;
          return;
        }

        equatorialToScene(eci, scratch);
        orbitPositions[i * 3] = scratch.x;
        orbitPositions[i * 3 + 1] = scratch.y;
        orbitPositions[i * 3 + 2] = scratch.z;

        // The sub-satellite point is the position seen from the turning Earth,
        // dropped onto the surface. Taken in the Earth-fixed frame it is a fixed
        // place on the map, which is what keeps the track over its terrain.
        equatorialToScene(eciToEcf(eci, gstime(at)), scratch);
        scratch.setLength(EARTH_SCENE_RADIUS * TRACK_LIFT);
        trackPositions[i * 3] = scratch.x;
        trackPositions[i * 3 + 1] = scratch.y;
        trackPositions[i * 3 + 2] = scratch.z;
      }

      orbit.geometry.setPositions(orbitPositions);
      track.geometry.setPositions(trackPositions);
      orbit.visible = true;
      track.visible = true;
      sampledAtMs.current = centreMs;
    },
    [satrec, periodMinutes, orbitPositions, trackPositions, scratch]
  );

  useLayoutEffect(() => {
    satelliteFocus.tracked = false;
    sampledAtMs.current = Number.NaN;
    resample(useSimTime.getState().date.getTime());
  }, [resample]);

  useFrame(() => {
    const date = useSimTime.getState().date;
    const state = propagate(satrec, date);
    const eci = state?.position;

    if (!eci) {
      // Keep the last good position, so a camera riding the object is not thrown
      // back at the planet by a single unpropagatable instant. The panel reads
      // the same refusal from SGP4 and says so.
      if (marker.current) marker.current.visible = false;
      return;
    }

    if (marker.current) {
      marker.current.visible = true;
      equatorialToScene(eci, marker.current.position);
      marker.current.getWorldPosition(satelliteFocus.position);
      marker.current.parent!.getWorldQuaternion(parentRotation);

      // Direction of travel, for the camera that rides behind the object.
      equatorialToScene(state.velocity, satelliteFocus.forward).normalize().applyQuaternion(parentRotation);
      satelliteFocus.tracked = true;

      // Hold a constant angular size, and face the camera through the tilt and
      // spin its parents carry.
      const distance = camera.position.distanceTo(satelliteFocus.position);
      marker.current.scale.setScalar(distance * MARKER_ANGULAR_SIZE);
      marker.current.quaternion.copy(parentRotation.invert()).multiply(camera.quaternion);
    }

    if (ground.current) ground.current.rotation.y = gstime(date);

    const drift = Math.abs(date.getTime() - sampledAtMs.current);
    if (Number.isNaN(sampledAtMs.current) || drift > periodMinutes * 60000 * RESAMPLE_FRACTION) {
      resample(date.getTime());
    }
  });

  return (
    <>
      <group ref={marker}>
        <mesh>
          <ringGeometry args={[0.78, 1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <Line
        ref={orbitLine}
        points={seed}
        color={color}
        lineWidth={1.1}
        transparent
        opacity={0.45}
        depthWrite={false}
        frustumCulled={false}
      />

      <group ref={ground}>
        <Line
          ref={trackLine}
          points={seed}
          color={color}
          lineWidth={1.6}
          transparent
          opacity={0.75}
          depthWrite={false}
          frustumCulled={false}
        />
      </group>
    </>
  );
}

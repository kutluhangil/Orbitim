import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFlight } from '../flight/useFlight';
import { isTouchPrimary } from '../lib/device';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import { satelliteFocus, useSatelliteSelection } from './satelliteSelection';
import { KM_TO_SCENE } from './satelliteFrame';

/** Seconds a flight leg takes, regardless of distance travelled. */
const FLIGHT_SECONDS = 2.5;
/** Camera distance when parked at a body, in body radii. */
const ORBIT_RADII = 3.2;
/**
 * Camera distance when riding a satellite, km, and where it sits relative to the
 * object's own motion: mostly behind, partly above. Straight out from the planet
 * would put the camera's own horizon outside the frame at any distance close
 * enough to feel like riding, and the surface would read as flat texture. Looking
 * forward along the track instead brings the limb into shot.
 */
const SATELLITE_STANDOFF = 1600 * KM_TO_SCENE;
const CHASE_BEHIND = 0.8;
const CHASE_ABOVE = 0.6;
/** Camera position and look-at point of the whole-system view. */
const OVERVIEW_POSITION = new THREE.Vector3(0, 340, 720);
/** Vertical field of view the scene was framed at, and the aspect it assumes. */
const BASE_FOV = 45;
const BASE_ASPECT = 16 / 9;
/** A phone held upright would otherwise crop the system at the edges. */
const MAX_FOV = 72;
/** How far the overview may be pulled back to recover a portrait screen's width. */
const MAX_OVERVIEW_PULLBACK = 2.6;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraRigProps {
  registry: PositionRegistry;
}

/**
 * Single-scene camera. A flight interpolates both the eye point and the look-at
 * point along an arc that lifts out of the ecliptic, so the system sweeps past
 * underneath instead of the camera sliding on a straight line.
 */
export function CameraRig({ registry }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();

  /** The overview eye point for the current window shape. */
  const overviewEye = useRef(new THREE.Vector3().copy(OVERVIEW_POSITION));

  // three's field of view is the vertical one, so a portrait window narrows the
  // horizontal view until the outer planets fall off both sides. Two things
  // recover the width a phone loses: a wider vertical fov, up to the point the
  // perspective starts to stretch, and then pulling the overview back until the
  // horizontal extent matches the one the scene was composed for.
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;

    const targetHorizontal = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2) * BASE_ASPECT);
    const vertical = 2 * Math.atan(Math.tan(targetHorizontal / 2) / aspect);
    const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vertical), BASE_FOV, MAX_FOV);
    perspective.fov = fov;
    perspective.updateProjectionMatrix();

    const actualHorizontal = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
    const pullback = THREE.MathUtils.clamp(
      Math.tan(targetHorizontal / 2) / Math.tan(actualHorizontal / 2),
      1,
      MAX_OVERVIEW_PULLBACK
    );
    overviewEye.current.copy(OVERVIEW_POSITION).multiplyScalar(pullback);

    // A rotation of the device changes the framing under a camera that is
    // already parked on the overview, so move it rather than wait for a flight.
    if (useFlight.getState().target === null && controls.current) {
      camera.position.copy(overviewEye.current);
      controls.current.target.set(0, 0, 0);
    }
  }, [camera, size.width, size.height]);

  const elapsed = useRef(0);
  const startEye = useRef(new THREE.Vector3());
  const startLook = useRef(new THREE.Vector3());
  /** Point the camera was framing last frame, whatever kind of thing it was. */
  const focus = useRef(new THREE.Vector3());
  const lastFocus = useRef(new THREE.Vector3());
  const arcLift = useRef(new THREE.Vector3());
  const previousPhase = useRef<string>('overview');
  const posed = useRef(false);

  const scratchEye = new THREE.Vector3();
  const scratchLook = new THREE.Vector3();
  const scratchShift = new THREE.Vector3();
  const origin = new THREE.Vector3();

  useFrame((_, delta) => {
    const { phase, target, setProgress, arrive } = useFlight.getState();
    const orbitControls = controls.current;
    if (!orbitControls) return;

    if (!posed.current) {
      // Claim the overview pose once the controls exist, so the scene always
      // opens on the whole system regardless of the camera the canvas started
      // with.
      camera.position.copy(overviewEye.current);
      orbitControls.target.set(0, 0, 0);
      posed.current = true;
    }

    // A followed satellite outranks the body it orbits: the camera rides the
    // object, and the planet becomes what it is seen against.
    const riding = useSatelliteSelection.getState().following && satelliteFocus.tracked;
    const anchor = target ? registry.get(target)! : origin;

    const destinationLook = focus.current;
    if (riding) destinationLook.copy(satelliteFocus.position);
    else destinationLook.copy(anchor);

    const destinationDistance = riding
      ? SATELLITE_STANDOFF
      : target
        ? sceneRadiusOf(target) * ORBIT_RADII
        : overviewEye.current.length();

    if (phase === 'flying') {
      if (previousPhase.current !== 'flying') {
        elapsed.current = 0;
        startEye.current.copy(camera.position);
        startLook.current.copy(orbitControls.target);
        // Lift out of the ecliptic proportionally to the distance travelled, so
        // the system sweeps past underneath instead of the camera sliding
        // straight through the orbital planes.
        arcLift.current.set(0, startEye.current.distanceTo(destinationLook) * 0.18, 0);
      }

      elapsed.current += delta;
      const t = Math.min(1, elapsed.current / FLIGHT_SECONDS);
      const eased = easeInOutCubic(t);
      setProgress(eased);

      let destinationEye: THREE.Vector3;
      if (riding) {
        // Trail the object: behind it along its own track and above it along the
        // planet's radius, so the shot looks forward over the ground it is about
        // to cross rather than straight down at the ground it is over.
        const above = scratchShift.copy(destinationLook).sub(anchor).normalize();
        destinationEye = scratchEye
          .copy(satelliteFocus.forward)
          .multiplyScalar(-CHASE_BEHIND)
          .addScaledVector(above, CHASE_ABOVE)
          .normalize()
          .multiplyScalar(destinationDistance)
          .add(destinationLook);
      } else if (target) {
        // Arrive on the sunlit side: the approach vector points from the body
        // back towards the Sun, lifted slightly so the terminator stays in frame.
        const approach = destinationLook.lengthSq() > 0 ? destinationLook : new THREE.Vector3(-1, 0, -1);
        destinationEye = scratchEye
          .copy(approach)
          .negate()
          .normalize()
          .setY(0.35)
          .normalize()
          .multiplyScalar(destinationDistance)
          .add(destinationLook);
      } else {
        destinationEye = scratchEye.copy(overviewEye.current);
      }

      camera.position.lerpVectors(startEye.current, destinationEye, eased);
      // Quadratic bezier lift, zero at both ends.
      camera.position.addScaledVector(arcLift.current, 4 * eased * (1 - eased));

      scratchLook.lerpVectors(startLook.current, destinationLook, eased);
      orbitControls.target.copy(scratchLook);

      if (t >= 1) arrive();
    } else if (phase === 'orbiting' && target) {
      // Follow the focus without fighting the user's orbit input: translate the
      // camera by exactly the motion of whatever it is framing this frame.
      const shift = scratchShift.copy(destinationLook).sub(lastFocus.current);
      camera.position.add(shift);
      orbitControls.target.copy(destinationLook);
    }

    if (target) lastFocus.current.copy(destinationLook);

    // Keep depth precision usable across eight orders of magnitude of distance.
    const perspective = camera as THREE.PerspectiveCamera;
    const distance = camera.position.distanceTo(orbitControls.target);
    perspective.near = Math.max(0.001, distance * 0.002);
    perspective.far = 80000;
    perspective.updateProjectionMatrix();

    previousPhase.current = phase;
    orbitControls.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      /* A thumb sweeps far further than a mouse drag; at desktop speed a phone
         spins the system past the body it was aimed at. */
      rotateSpeed={isTouchPrimary ? 0.55 : 1}
      zoomSpeed={isTouchPrimary ? 0.7 : 1}
      minDistance={0.02}
      maxDistance={4000}
      makeDefault
    />
  );
}

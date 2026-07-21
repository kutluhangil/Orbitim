import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ALL_BODIES, PLANETS, type BodyId } from '../lib/ephemeris/bodies';
import { useFlight } from '../flight/useFlight';
import { AsteroidBelt } from './AsteroidBelt';
import { Body } from './Body';
import { BodyLabels } from './BodyLabels';
import { OrbitPath } from './OrbitPath';
import { Starfield } from './Starfield';
import { CameraRig } from './CameraRig';
import { SatelliteLayer } from './SatelliteLayer';
import { createPositionRegistry, updatePositions } from './bodyPositions';
import { useSimTime } from './useSimTime';

/**
 * Scene root. Owns the per-frame clock and the position registry; every other
 * scene component reads from them instead of touching the ephemeris directly.
 */
export function SolarSystem() {
  const registry = useMemo(() => createPositionRegistry(), []);
  const epoch = useRef(new Date());
  const target = useFlight((s) => s.target);
  const flyTo = useFlight((s) => s.flyTo);

  useFrame((_, delta) => {
    useSimTime.getState().advance(delta);
    updatePositions(registry, useSimTime.getState().date);
  });

  return (
    <>
      <Starfield />

      {/* The Sun is the only light source. Its falloff is deliberately not the
          physical inverse square: orbital radius is already log-compressed by
          the scale layer, so a true square law on top of a compressed distance
          would put Saturn a hundred times darker than Earth on screen instead
          of the nine times it actually is. The exponent below preserves the
          ordering — inner worlds are brighter, outer ones dimmer — at a
          contrast the eye can still read. */}
      <pointLight position={[0, 0, 0]} intensity={13} decay={0.55} color="#fff4e0" />
      <ambientLight intensity={0.08} />

      {PLANETS.map((planet) => (
        <OrbitPath key={planet.id} id={planet.id} date={epoch.current} highlighted={target === planet.id} />
      ))}

      <AsteroidBelt />

      {ALL_BODIES.map((body) => (
        <Body key={body.id} id={body.id} registry={registry} onSelect={(id: BodyId) => flyTo(id)} />
      ))}

      <BodyLabels registry={registry} onSelect={(id: BodyId) => flyTo(id)} />

      <SatelliteLayer registry={registry} />

      <CameraRig registry={registry} />
    </>
  );
}

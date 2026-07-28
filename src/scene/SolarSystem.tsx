import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ALL_BODIES, type BodyId } from '../lib/ephemeris/bodies';
import { useFlight } from '../flight/useFlight';
import { AsteroidBelt } from './AsteroidBelt';
import { Comets } from './Comets';
import { MinorBodies } from './MinorBodies';
import { Spacecraft } from './Spacecraft';
import { Body } from './Body';
import { BodyLabels } from './BodyLabels';
import { OrbitPath } from './OrbitPath';
import { Starfield } from './Starfield';
import { CameraRig } from './CameraRig';
import { SatelliteLayer } from './SatelliteLayer';
import { LaplaceResonance } from './LaplaceResonance';
import { createPositionRegistry, updatePositions } from './bodyPositions';
import { useSimTime } from './useSimTime';
import { useViewSettings } from './viewSettings';

/** Bodies with a heliocentric orbit worth tracing: the eight planets and the
 *  element-carried dwarf planets (Ceres, Pluto). Moons trace around their host. */
const ORBIT_WORLDS = ALL_BODIES.filter((b) => b.kind === 'planet' || b.kind === 'dwarf');

/**
 * Scene root. Owns the per-frame clock and the position registry; every other
 * scene component reads from them instead of touching the ephemeris directly.
 */
export function SolarSystem() {
  const registry = useMemo(() => createPositionRegistry(), []);
  const epoch = useRef(new Date());
  const target = useFlight((s) => s.target);
  const flyTo = useFlight((s) => s.flyTo);
  const orbitsVisible = useViewSettings((s) => s.orbitsVisible);
  const light = useViewSettings((s) => s.theme === 'light');
  const scientific = useViewSettings((s) => s.mode === 'scientific');

  useFrame((_, delta) => {
    useSimTime.getState().advance(delta);
    updatePositions(registry, useSimTime.getState().date);
  });

  return (
    <>
      {/* The star field is the space the scene sits in; the light theme replaces
          it with a plain field, so it is dropped rather than drawn over. */}
      {!light && <Starfield />}

      {/* The Sun is the only light source. Its falloff is deliberately not the
          physical inverse square: orbital radius is already log-compressed by
          the scale layer, so a true square law on top of a compressed distance
          would put Saturn a hundred times darker than Earth on screen instead
          of the nine times it actually is. The exponent below preserves the
          ordering — inner worlds are brighter, outer ones dimmer — at a
          contrast the eye can still read. */}
      <pointLight position={[0, 0, 0]} intensity={scientific ? 14 : 13} decay={0.55} color="#fff4e0" />
      {/* On the light field there is no star glow to lift the night sides, so a
          body lit by the Sun alone reads as a black disc against white. A raised
          fill turns the far side to shaded grey instead — enough to see the body
          by, without flattening the terminator the point light draws. */}
      <ambientLight intensity={light ? 0.55 : scientific ? 0.018 : 0.08} />

      {orbitsVisible &&
        ORBIT_WORLDS.map((world) => (
          <OrbitPath key={world.id} id={world.id} date={epoch.current} highlighted={target === world.id} />
        ))}

      <AsteroidBelt />

      <MinorBodies />

      <Spacecraft />

      <Comets />

      {ALL_BODIES.map((body) => (
        <Body key={body.id} id={body.id} registry={registry} onSelect={(id: BodyId) => flyTo(id)} />
      ))}

      <BodyLabels registry={registry} onSelect={(id: BodyId) => flyTo(id)} />

      <SatelliteLayer registry={registry} />

      <LaplaceResonance registry={registry} />

      <CameraRig registry={registry} />
    </>
  );
}

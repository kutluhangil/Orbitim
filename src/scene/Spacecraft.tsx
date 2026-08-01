import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { SPACECRAFT, spacecraftOrbit, spacecraftPosition, type Spacecraft as Craft } from '../data/spacecraft';
import { heliocentricToScene } from '../lib/scale';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { useViewSettings } from './viewSettings';
import { useSpacecraftState } from './spacecraftState';
import { DeepSpaceCraftModel } from './SpacecraftModels';
import { useSpacecraftSelection, writeSpacecraftPosition } from './spacecraftSelection';
import { useTranslation } from '../ui/i18n';

/** Fixed screen offsets keep the five overview labels from sitting on one another. */
const LABEL_OFFSETS: Record<string, readonly [number, number]> = {
  voyager1: [-34, -18],
  voyager2: [32, 18],
  newhorizons: [-38, 16],
  parker: [36, -20],
  jwst: [0, -42]
};

/**
 * Live deep-space craft — the Voyagers, New Horizons, Parker and JWST — placed
 * from real trajectory data (see data/spacecraft.ts). Every craft carries a
 * model: their vehicle geometry is deliberately display-scaled because
 * kilometre-scale craft cannot be physically visible alongside AU-scale
 * orbits. Each label carries its live distance from the Sun, updated directly
 * on the DOM node so the readout never forces a React re-render. Inspection
 * models remain the only spacecraft geometry in close views, without a
 * decorative marker competing with the vehicle itself.
 */

export function Spacecraft() {
  const refresh = useSpacecraftState((state) => state.refresh);

  useEffect(() => {
    void refresh(useSimTime.getState().date).catch((cause) => {
      console.error('JPL Horizons live-state refresh failed.', cause);
    });
  }, [refresh]);

  return (
    <group>
      {SPACECRAFT.map((craft) => (
        <CraftMarker key={craft.id} craft={craft} />
      ))}
    </group>
  );
}

function CraftMarker({ craft }: { craft: Craft }) {
  const group = useRef<THREE.Group>(null);
  const distance = useRef<HTMLSpanElement>(null);
  const orbitsVisible = useViewSettings((s) => s.orbitsVisible);
  const light = useViewSettings((s) => s.theme === 'light');
  const phase = useFlight((s) => s.phase);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const live = useSpacecraftState((state) => state.states[craft.id]);
  const selectedId = useSpacecraftSelection((state) => state.selectedId);
  const select = useSpacecraftSelection((state) => state.select);
  const { t } = useTranslation();
  const [labelOffsetX, labelOffsetY] = LABEL_OFFSETS[craft.id] ?? [0, -18];

  const inspect = () => {
    select(craft.id);
    returnToOverview();
  };

  const orbitPoints = useMemo(() => {
    const sample = spacecraftOrbit(craft);
    if (!sample) return null;
    return sample.map((v) => {
      const [x, y, z] = heliocentricToScene(v);
      return new THREE.Vector3(x, y, z);
    });
  }, [craft]);

  const labelContent = (
    <>
      <span
        className="whitespace-nowrap text-[8px] uppercase tracking-[0.13em]"
        style={{ color: light ? '#475569' : craft.color }}
      >
        {craft.name}
      </span>
      <span ref={distance} className="text-[7px] tabular-nums text-white/45" />
    </>
  );

  useFrame(() => {
    if (!group.current) return;
    const position = spacecraftPosition(craft, useSimTime.getState().date, live);
    const [x, y, z] = heliocentricToScene(position);
    group.current.position.set(x, y, z);
    writeSpacecraftPosition(craft.id, group.current.position);
    if (distance.current) {
      const au = Math.hypot(position.x, position.y, position.z);
      distance.current.textContent = `${au.toFixed(au < 10 ? 2 : 1)} AU`;
    }
  });

  return (
    <group>
      {orbitPoints && orbitsVisible && (
        <Line points={orbitPoints} color={craft.color} transparent opacity={0.2} lineWidth={0.8} depthWrite={false} />
      )}

      <group
        ref={group}
        onClick={(event) => {
          event.stopPropagation();
          inspect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <mesh>
          <sphereGeometry args={[3.2, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Suspense fallback={null}>
          <DeepSpaceCraftModel
            id={craft.id}
            displayRadius={craft.id === 'jwst' ? 1.35 : craft.id.startsWith('voyager') ? 1.28 : 1.15}
          />
        </Suspense>

        {phase === 'overview' && selectedId !== craft.id && (
          <Html position={[0, 1.6, 0]} center zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={inspect}
              aria-label={t('inspectSpacecraft', { craft: craft.name })}
              style={{ transform: `translate(${labelOffsetX}px, ${labelOffsetY}px)` }}
              className="flex cursor-pointer flex-col items-center rounded-md px-1.5 py-1 leading-tight transition-colors hover:bg-black/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-200/70"
            >
              {labelContent}
            </button>
          </Html>
        )}

      </group>
    </group>
  );
}

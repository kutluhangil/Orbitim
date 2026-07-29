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

/**
 * Live deep-space craft — the Voyagers, New Horizons, Parker and JWST — placed
 * from real trajectory data (see data/spacecraft.ts). A ring marker sets them
 * apart from the dwarf-planet dots. Every craft carries a model: their vehicle
 * geometry is deliberately display-scaled because kilometre-scale craft cannot
 * be physically visible alongside AU-scale orbits. Each label carries its live
 * distance from the Sun, updated directly on the DOM node so the readout never
 * forces a React re-render.
 */

/** A hollow ring, drawn once and shared, so a craft reads as a marker not a world. */
let ringTexture: THREE.Texture | null = null;
function getRingTexture(): THREE.Texture {
  if (ringTexture) return ringTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ringTexture = new THREE.CanvasTexture(canvas);
  ringTexture.colorSpace = THREE.SRGBColorSpace;
  return ringTexture;
}

export function Spacecraft() {
  const ring = useMemo(getRingTexture, []);
  const refresh = useSpacecraftState((state) => state.refresh);

  useEffect(() => {
    void refresh(useSimTime.getState().date).catch((cause) => {
      console.error('JPL Horizons live-state refresh failed.', cause);
    });
  }, [refresh]);

  return (
    <group>
      {SPACECRAFT.map((craft) => (
        <CraftMarker key={craft.id} craft={craft} ring={ring} />
      ))}
    </group>
  );
}

function CraftMarker({ craft, ring }: { craft: Craft; ring: THREE.Texture }) {
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
        className="whitespace-nowrap text-[9px] uppercase tracking-[0.16em]"
        style={{ color: light ? '#475569' : craft.color }}
      >
        {craft.name}
      </span>
      <span ref={distance} className="text-[8px] tabular-nums text-white/45" />
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
        <sprite scale={[1.85, 1.85, 1.85]}>
          <spriteMaterial map={ring} color={craft.color} transparent depthWrite={false} />
        </sprite>

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
          <Html position={[0, 1.6, 0]} center distanceFactor={48} zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={inspect}
              aria-label={t('inspectSpacecraft', { craft: craft.name })}
              className="flex cursor-pointer flex-col items-center rounded-md px-1.5 py-1 leading-tight transition-colors hover:bg-black/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-200/70"
            >
              {labelContent}
            </button>
          </Html>
        )}

        {selectedId === craft.id && (
          <Html position={[0, -2.1, 0]} center distanceFactor={48} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
            <div className="rounded-full border border-sky-200/30 bg-black/75 px-3 py-1.5 text-center text-[9px] uppercase tracking-[0.18em] text-sky-100 shadow-lg shadow-black/40 backdrop-blur-md">
              {craft.name}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

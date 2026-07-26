import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { SPACECRAFT, spacecraftOrbit, spacecraftPosition, type Spacecraft as Craft } from '../data/spacecraft';
import { heliocentricToScene } from '../lib/scale';
import { useFlight } from '../flight/useFlight';
import { useSimTime } from './useSimTime';
import { useViewSettings } from './viewSettings';

/**
 * Live deep-space craft — the Voyagers, New Horizons, Parker and JWST — placed
 * from real trajectory data (see data/spacecraft.ts). A ring marker sets them
 * apart from the dwarf-planet dots, and each carries its live distance from the
 * Sun, updated every frame straight on the DOM node so the readout never forces
 * a React re-render.
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

  const orbitPoints = useMemo(() => {
    const sample = spacecraftOrbit(craft);
    if (!sample) return null;
    return sample.map((v) => {
      const [x, y, z] = heliocentricToScene(v);
      return new THREE.Vector3(x, y, z);
    });
  }, [craft]);

  useFrame(() => {
    if (!group.current) return;
    const position = spacecraftPosition(craft, useSimTime.getState().date);
    const [x, y, z] = heliocentricToScene(position);
    group.current.position.set(x, y, z);
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

      <group ref={group}>
        <sprite scale={[1.5, 1.5, 1.5]}>
          <spriteMaterial map={ring} color={craft.color} transparent depthWrite={false} />
        </sprite>

        {phase === 'overview' && (
          <Html position={[0, 1.6, 0]} center distanceFactor={48} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className="flex flex-col items-center leading-tight">
              <span
                className="whitespace-nowrap text-[9px] uppercase tracking-[0.16em]"
                style={{ color: light ? '#475569' : craft.color }}
              >
                {craft.name}
              </span>
              <span ref={distance} className="text-[8px] tabular-nums text-white/45" />
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

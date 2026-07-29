import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface DeepSpaceCraftModelProps {
  id: string;
  /**
   * Deep-space vehicles are much too small to retain their physical scale in
   * the logarithmically compressed solar-system view. This is their legible
   * display radius; their position always remains the ephemeris position.
   */
  displayRadius: number;
}

/**
 * The official NASA VTAD Parker model is centred and scaled from its own
 * bounds, so a changed authoring unit in a later source file cannot make it
 * vanish or overwhelm the scene.
 */
function ParkerSolarProbeModel({ displayRadius }: { displayRadius: number }) {
  const { scene } = useGLTF('/models/parker-solar-probe.glb');

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(clone);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (sphere.radius <= 0) throw new Error('NASA Parker Solar Probe model has no measurable bounds.');

    const scale = displayRadius / sphere.radius;
    clone.scale.setScalar(scale);
    clone.position.copy(sphere.center).multiplyScalar(-scale);
    clone.rotation.set(0.18, -0.42, 0.08);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [displayRadius, scene]);

  return <primitive object={model} />;
}

/**
 * A compact Webb renderer built from its public observatory architecture:
 * eighteen hexagonal primary-mirror segments, the five-layer sunshield,
 * spacecraft bus, deployed solar array and secondary-mirror support. It is a
 * visual interpretation, not an engineering/flight model, which keeps the
 * interactive scene light enough to load beside the live ephemeris.
 */
function JamesWebbModel({ displayRadius }: { displayRadius: number }) {
  const mirrorPositions = useMemo(
    () => [
      [-1.2, 1.55], [0, 1.55], [1.2, 1.55],
      [-1.8, 0.78], [-0.6, 0.78], [0.6, 0.78], [1.8, 0.78],
      [-1.8, 0], [-0.6, 0], [0.6, 0], [1.8, 0],
      [-1.8, -0.78], [-0.6, -0.78], [0.6, -0.78], [1.8, -0.78],
      [-1.2, -1.55], [0, -1.55], [1.2, -1.55]
    ] as const,
    []
  );

  const shieldLayers = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);
  const modelScale = displayRadius / 2.75;

  return (
    <group scale={modelScale} rotation={[0.28, -0.58, -0.1]}>
      <group position={[0, 0.48, 0]}>
        {mirrorPositions.map(([x, z], index) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.055, 6]} />
            <meshPhysicalMaterial
              color={index % 2 === 0 ? '#e7ba54' : '#f1ca68'}
              metalness={0.88}
              roughness={0.18}
              clearcoat={0.35}
              clearcoatRoughness={0.12}
            />
          </mesh>
        ))}

        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.11, 32]} />
          <meshStandardMaterial color="#242a31" metalness={0.75} roughness={0.42} />
        </mesh>
      </group>

      <group position={[0, -0.06, 0]}>
        {shieldLayers.map((layer) => {
          const inset = layer * 0.16;
          return (
            <mesh
              key={layer}
              position={[0, -layer * 0.1, layer * 0.035]}
              rotation={[-Math.PI / 2 + 0.045, 0, 0]}
              castShadow
              receiveShadow
            >
              <planeGeometry args={[4.75 - inset, 3.2 - inset * 0.58]} />
              <meshPhysicalMaterial
                color={layer % 2 === 0 ? '#d1c6a5' : '#cab15e'}
                metalness={0.72}
                roughness={0.31}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>

      <mesh position={[0, -0.86, 0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.46, 0.92]} />
        <meshStandardMaterial color="#25303a" metalness={0.78} roughness={0.38} />
      </mesh>

      <mesh position={[-3.15, -0.53, 0.1]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[1.2, 2.1]} />
        <meshStandardMaterial color="#16385e" metalness={0.28} roughness={0.52} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 1.28, 0.12]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 24]} />
        <meshStandardMaterial color="#c6d0d9" metalness={0.88} roughness={0.24} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.68, 0.89, 0.1]} rotation={[0, 0, side * 0.63]} castShadow receiveShadow>
          <cylinderGeometry args={[0.035, 0.035, 1.34, 8]} />
          <meshStandardMaterial color="#89949f" metalness={0.82} roughness={0.34} />
        </mesh>
      ))}
    </group>
  );
}

/** The source-backed Parker asset and Webb's documented deployed structure. */
export function DeepSpaceCraftModel({ id, displayRadius }: DeepSpaceCraftModelProps) {
  if (id === 'parker') return <ParkerSolarProbeModel displayRadius={displayRadius} />;
  if (id === 'jwst') return <JamesWebbModel displayRadius={displayRadius} />;
  return null;
}

useGLTF.preload('/models/parker-solar-probe.glb');

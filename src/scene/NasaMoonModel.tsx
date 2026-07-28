import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface NasaMoonModelProps {
  url: string;
  radius: number;
}

/**
 * Draws a NASA 3D Resources moon at the scene's physical radius. The source
 * files use their own authoring units, so the model is centred and normalised
 * from its measured bounds rather than being assigned a hand-tuned scale.
 */
export function NasaMoonModel({ url, radius }: NasaMoonModelProps) {
  const { scene } = useGLTF(url);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);

    const sphere = new THREE.Box3().setFromObject(clone).getBoundingSphere(new THREE.Sphere());
    if (sphere.radius <= 0) throw new Error(`NASA moon model has no measurable bounds: ${url}`);

    const scale = radius / sphere.radius;
    clone.scale.setScalar(scale);
    clone.position.copy(sphere.center).multiplyScalar(-scale);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [radius, scene, url]);

  return <primitive object={model} />;
}

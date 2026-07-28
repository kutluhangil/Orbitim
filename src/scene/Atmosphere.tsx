import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BodyId } from '../lib/ephemeris/bodies';

export interface AtmosphereProfile {
  /** Scattering colour at the limb. */
  color: string;
  /**
   * Height at which the air thins to 1/e of its density at the surface, as a
   * fraction of the body radius. This is what sets how far the glow reaches and
   * how gently it dies away — the one number that separates a soft envelope
   * from a drawn-on ring.
   */
  scaleHeight: number;
  /** Opacity where the shell meets the surface. */
  strength: number;
}

/**
 * Atmospheres, or the lack of them, are a real property of each world: Venus
 * carries an opaque sulphuric haze, Mars a thin dusty one, the gas giants a
 * deep hydrogen envelope, and Mercury and the moons essentially nothing — so
 * they get no shell at all rather than a decorative one.
 */
export const ATMOSPHERES: Partial<Record<BodyId, AtmosphereProfile>> = {
  venus: { color: '#f6dfa6', scaleHeight: 0.018, strength: 0.7 },
  earth: { color: '#5fa8ff', scaleHeight: 0.013, strength: 0.62 },
  mars: { color: '#e2a273', scaleHeight: 0.011, strength: 0.26 },
  jupiter: { color: '#ffcf9b', scaleHeight: 0.012, strength: 0.32 },
  saturn: { color: '#f6e5b4', scaleHeight: 0.012, strength: 0.28 },
  uranus: { color: '#9ff0f5', scaleHeight: 0.015, strength: 0.34 },
  neptune: { color: '#7aa6ff', scaleHeight: 0.015, strength: 0.34 },
  titan: { color: '#f0b45f', scaleHeight: 0.026, strength: 0.45 }
};

/**
 * Shell extent in scale heights. Past this the density is below a hundredth of
 * its surface value and the geometry would only cost fill rate.
 */
const SHELL_EXTENT = 5;

const VERTEX = /* glsl */ `
  varying vec3 vPositionView;
  varying vec3 vPolarAxisView;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vPositionView = viewPosition.xyz;
    vPolarAxisView = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * Limb glow, integrated the way the real one is seen rather than painted onto
 * the silhouette.
 *
 * Back faces are the only ones drawn, so the planet's own depth clips this to
 * the annulus outside its disc. For each pixel of that annulus the view ray is
 * traced past the body and its closest approach gives the altitude the line of
 * sight grazes at; the air's density falls off exponentially with that
 * altitude, exactly as an atmosphere's does. The result thins outward into
 * nothing on its own, so there is no shell edge to see — where a Fresnel term
 * on a fixed-radius shell would leave a hard-edged band of colour ringing the
 * planet.
 */
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uPlanetRadius;
  uniform float uPolarRatio;
  uniform float uScaleHeight;
  uniform vec3 uCenterView;
  uniform vec3 uSunDirectionView;

  varying vec3 vPositionView;
  varying vec3 vPolarAxisView;

  void main() {
    // The camera is the origin in view space, so the ray to this fragment is
    // just its direction.
    vec3 ray = normalize(vPositionView);
    float along = dot(uCenterView, ray);
    vec3 closest = ray * along;
    vec3 radial = closest - uCenterView;
    vec3 radialDirection = normalize(radial);
    float polar = dot(radialDirection, normalize(vPolarAxisView));
    float polarWeight = polar * polar;
    // Radius of an oblate spheroid in this direction. It reduces to the
    // spherical radius when uPolarRatio is 1.
    float surfaceRadius = uPlanetRadius / sqrt(
      max(1.0 - polarWeight + polarWeight / (uPolarRatio * uPolarRatio), 1e-6)
    );
    float altitude = max(length(radial) - surfaceRadius, 0.0);
    float density = exp(-altitude / uScaleHeight);

    // Lit at the altitude the sight line grazes, not at the shell's own surface:
    // the terminator then cuts the glow where it cuts the ground beneath it.
    vec3 limbNormal = normalize(closest - uCenterView);
    float daylight = smoothstep(-0.32, 0.30, dot(limbNormal, uSunDirectionView));

    float alpha = density * uStrength * mix(0.04, 1.0, daylight);
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface AtmosphereProps {
  profile: AtmosphereProfile;
  radius: number;
  /** Polar radius divided by equatorial radius. */
  polarRatio?: number;
  /** World position of the body, used to derive the sun direction. */
  worldPosition: THREE.Vector3;
}

export function Atmosphere({ profile, radius, polarRatio = 1, worldPosition }: AtmosphereProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const sunDirection = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const scaleHeight = radius * profile.scaleHeight;
  const shellRadius = radius + scaleHeight * SHELL_EXTENT;
  // Preserve the same atmospheric height in kilometres above equator and pole
  // while fitting the shell to the body's measured ellipsoid.
  const shellPolarRatio = (radius * polarRatio + scaleHeight * SHELL_EXTENT) / shellRadius;

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(profile.color) },
      uStrength: { value: profile.strength },
      uPlanetRadius: { value: radius },
      uPolarRatio: { value: polarRatio },
      uScaleHeight: { value: scaleHeight },
      uCenterView: { value: new THREE.Vector3() },
      uSunDirectionView: { value: new THREE.Vector3(0, 0, 1) }
    }),
    [profile, radius, polarRatio, scaleHeight]
  );

  useFrame(({ camera }) => {
    if (!material.current) return;
    // The Sun sits at the world origin, so the direction to it is simply the
    // body's own position negated. Both it and the body's centre are carried
    // into view space, which is the frame the shader traces its rays in.
    sunDirection.copy(worldPosition).negate().normalize().transformDirection(camera.matrixWorldInverse);
    material.current.uniforms.uSunDirectionView.value.copy(sunDirection);
    center.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
    material.current.uniforms.uCenterView.value.copy(center);
  });

  return (
    <mesh scale={[1, shellPolarRatio, 1]}>
      <sphereGeometry args={[shellRadius, 64, 32]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

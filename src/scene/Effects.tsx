import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing';
import { graphicsTier } from '../lib/device';
import { useViewSettings } from './viewSettings';

/**
 * Cinematic grade. Bloom carries the Sun and the city lights, SMAA cleans the
 * limbs and the orbit lines that hardware antialiasing is turned off for, and
 * the vignette pulls focus to the centre. Deliberately restrained — the scene
 * is the subject, the grade is not.
 *
 * On the low tier SMAA is dropped: it is a full-screen pass on a device that is
 * already fill-rate bound, and at phone pixel density the aliasing it removes
 * is close to invisible.
 */
export function Effects() {
  const light = useViewSettings((s) => s.theme === 'light');
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom intensity={0.68} luminanceThreshold={0.8} luminanceSmoothing={0.32} mipmapBlur />
      {/* The vignette pulls focus on the dark field; over the light theme the
          same darkening only greys the corners, so it is dropped there. */}
      {light ? <></> : <Vignette eskil={false} offset={0.26} darkness={0.7} />}
      {graphicsTier === 'high' ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

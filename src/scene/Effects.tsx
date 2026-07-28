import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing';
import { graphicsTier } from '../lib/device';
import { useFlight } from '../flight/useFlight';
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
  const scientific = useViewSettings((s) => s.mode === 'scientific');
  const focusedSun = useFlight((s) => s.target === 'sun');
  const bloomIntensity = focusedSun ? (scientific ? 1.22 : 1.38) : scientific ? 0.66 : 0.9;
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom intensity={bloomIntensity} luminanceThreshold={focusedSun ? 0.55 : 0.72} luminanceSmoothing={0.34} mipmapBlur />
      {/* The vignette pulls focus on the dark field; over the light theme the
          same darkening only greys the corners, so it is dropped there. */}
      {light ? <></> : <Vignette eskil={false} offset={0.26} darkness={0.7} />}
      {graphicsTier === 'high' ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

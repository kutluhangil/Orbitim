import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { SolarSystem } from './SolarSystem';
import { Effects } from './Effects';
import { maxPixelRatio } from '../lib/device';
import { useViewSettings } from './viewSettings';
import { SceneErrorBoundary } from './SceneErrorBoundary';

/**
 * Scene clear colour per theme. The light value is kept off pure white on
 * purpose: after the ACES tone map it lands as a clean, bright field the bodies
 * read against, and stays below the bloom threshold so the whole frame does not
 * flare.
 */
const BACKGROUND: Record<'dark' | 'light', string> = {
  dark: '#000000',
  light: '#e7ebf1'
};

type SceneStatus = 'booting' | 'ready' | 'recovering';

function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** Lowers only canvas pixel density after sustained poor frame time; assets and astronomical state stay unchanged. */
function AdaptivePixelRatio({ onReduced }: { onReduced: (dpr: number) => void }) {
  const setDpr = useThree((state) => state.setDpr);
  const current = useRef(maxPixelRatio);
  const samples = useRef<number[]>([]);
  const lastChange = useRef(0);

  useFrame((_, delta) => {
    if (document.visibilityState === 'hidden') return;
    samples.current.push(delta);
    if (samples.current.length < 120) return;

    const average = samples.current.reduce((sum, sample) => sum + sample, 0) / samples.current.length;
    samples.current = [];
    const now = performance.now();
    if (now - lastChange.current < 8_000) return;

    // Sustained <42fps is a responsiveness issue, not a momentary camera or
    // network hitch. A quarter DPR step cuts fill cost without replacing assets.
    if (average > 1 / 42 && current.current > 1) {
      current.current = Math.max(1, Number((current.current - 0.25).toFixed(2)));
      setDpr(current.current);
      lastChange.current = now;
      onReduced(current.current);
      return;
    }

    // Recover gradually only after a long stable window; this avoids a DPR
    // oscillation when a system sits near the budget edge.
    if (average < 1 / 57 && current.current < maxPixelRatio) {
      current.current = Math.min(maxPixelRatio, Number((current.current + 0.25).toFixed(2)));
      setDpr(current.current);
      lastChange.current = now;
    }
  });

  return null;
}

function ContextMonitor({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', lost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
    };
  }, [gl, onLost, onRestored]);

  return null;
}

function SceneStatusNotice({ status, reducedDpr }: { status: SceneStatus; reducedDpr: number | null }) {
  if (status === 'ready' && reducedDpr === null) return null;
  const text = status === 'booting'
    ? 'Initializing observatory renderer…'
    : status === 'recovering'
      ? 'Restoring WebGL scene…'
      : `Rendering adjusted to ${reducedDpr}× pixel density to stay responsive.`;
  return (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full border border-sky-300/20 bg-black/70 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-sky-100/80 shadow-lg shadow-black/30 backdrop-blur-xl"
    >
      {text}
    </p>
  );
}

/**
 * WebGL host. Nothing above this component knows about three.js; nothing below
 * it touches the DOM.
 */
export function SceneRoot() {
  const theme = useViewSettings((s) => s.theme);
  const visible = usePageVisibility();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SceneStatus>('booting');
  const [reducedDpr, setReducedDpr] = useState<number | null>(null);

  const retry = () => {
    setStatus('booting');
    setReducedDpr(null);
    setAttempt((value) => value + 1);
  };

  return (
    <SceneErrorBoundary key={attempt} onRetry={retry}>
      <Canvas
        key={attempt}
        camera={{ position: [0, 340, 720], fov: 45, near: 0.01, far: 80000 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, maxPixelRatio]}
        frameloop={visible ? 'always' : 'never'}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
          setStatus('ready');
        }}
      >
        <ContextMonitor onLost={() => setStatus('recovering')} onRestored={() => setStatus('ready')} />
        <AdaptivePixelRatio onReduced={setReducedDpr} />
        <color attach="background" args={[BACKGROUND[theme]]} />
        <Suspense fallback={null}>
          <SolarSystem />
          <Effects />
        </Suspense>
      </Canvas>
      <SceneStatusNotice status={status} reducedDpr={reducedDpr} />
    </SceneErrorBoundary>
  );
}

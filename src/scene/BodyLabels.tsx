import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PLANETS, type BodyId } from '../lib/ephemeris/bodies';
import { useFlight } from '../flight/useFlight';
import { sceneRadiusOf, type PositionRegistry } from './bodyPositions';
import { useViewSettings } from './viewSettings';
import { localizedBodyName, useTranslation } from '../ui/i18n';

interface BodyLabelsProps {
  registry: PositionRegistry;
  onSelect: (id: BodyId) => void;
}

/** Below this apparent radius in pixels a body needs a label to be findable. */
const MIN_PIXEL_RADIUS = 9;
/** Footprint a label occupies on screen, used by the collision resolver. */
const LABEL_WIDTH = 96;
const LABEL_HEIGHT = 20;
/**
 * Horizontal gap between the body and the left edge of its label. Small: when
 * nothing has displaced a label, its own marker dot should read as sitting on
 * the planet it names rather than beside it.
 */
const LEAD_OUT = 4;
/**
 * Vertical slots a displaced label may be moved into, nearest first and
 * alternating side. A label that only ever steps downwards walks a long way
 * from its planet in a crowded view; alternating keeps the whole cluster
 * within a couple of rows of where it belongs.
 */
const SLOTS = [0, -1, 1, -2, 2, -3, 3, -4, 4];
/** Displacement past which a label is no longer self-evidently its planet's. */
const LEADER_THRESHOLD = 4;

/**
 * Screen-space labels for the planets, laid out in a single pass so they never
 * overlap. The inner planets project into a few dozen pixels in the system
 * view, which is exactly where independent per-body labels used to stack; here
 * the nearest body keeps its anchor, the ones behind it take the nearest free
 * slot above or below, and anything that had to move is tied back to its own
 * planet by a leader line — a displaced label with nothing joining it to a dot
 * in a crowd of dots names no planet in particular.
 */
export function BodyLabels({ registry, onSelect }: BodyLabelsProps) {
  const { camera, size } = useThree();
  const light = useViewSettings((s) => s.theme === 'light');
  const { language } = useTranslation();
  const nodes = useRef(new Map<BodyId, HTMLButtonElement | null>());
  const leaders = useRef(new Map<BodyId, SVGLineElement | null>());
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const flight = useFlight.getState();
    const perspective = camera as THREE.PerspectiveCamera;
    const tangent = 2 * Math.tan((perspective.fov * Math.PI) / 360);

    // The body the camera has flown to fills the frame, and the other planets
    // are behind it. Their labels are drawn on a flat overlay that knows nothing
    // about depth, so anything whose line of sight passes through that body has
    // to be dropped by hand — otherwise Neptune is named across the Pacific.
    let occluder: { x: number; y: number; radius: number; distance: number } | null = null;
    if (flight.target && flight.phase !== 'overview') {
      const position = registry.get(flight.target)!;
      const distance = camera.position.distanceTo(position);
      projected.copy(position).project(camera);
      occluder = {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        radius: sceneRadiusOf(flight.target) / ((tangent * distance) / size.height),
        distance
      };
    }

    const candidates = PLANETS.map((planet) => {
      const position = registry.get(planet.id)!;
      const distance = camera.position.distanceTo(position);
      const worldPerPixel = (tangent * distance) / size.height;
      projected.copy(position).project(camera);
      return {
        id: planet.id,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        behindCamera: projected.z > 1,
        pixelRadius: sceneRadiusOf(planet.id) / worldPerPixel,
        distance
      };
    }).sort((a, b) => a.distance - b.distance);

    const placed: { x: number; y: number }[] = [];

    for (const candidate of candidates) {
      const node = nodes.current.get(candidate.id);
      const leader = leaders.current.get(candidate.id);
      if (!node || !leader) continue;

      const engaged = flight.target === candidate.id && flight.phase !== 'overview';
      const hidden =
        occluder !== null &&
        candidate.distance > occluder.distance &&
        Math.hypot(candidate.x - occluder.x, candidate.y - occluder.y) < occluder.radius;
      const visible =
        !candidate.behindCamera &&
        candidate.pixelRadius < MIN_PIXEL_RADIUS &&
        flight.phase !== 'flying' &&
        !engaged &&
        !hidden;

      if (!visible) {
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
        leader.style.opacity = '0';
        continue;
      }

      // Nearest body wins its anchor; anything colliding with an already placed
      // label takes the closest free slot, above or below.
      const anchorX = candidate.x + LEAD_OUT;
      let y = candidate.y;
      for (const slot of SLOTS) {
        y = candidate.y + slot * LABEL_HEIGHT;
        const collides = placed.some(
          (other) => Math.abs(other.x - anchorX) < LABEL_WIDTH && Math.abs(other.y - y) < LABEL_HEIGHT
        );
        if (!collides) break;
      }
      placed.push({ x: anchorX, y });

      node.style.opacity = '1';
      node.style.pointerEvents = 'auto';
      node.style.transform = `translate(${anchorX}px, ${y - LABEL_HEIGHT / 2}px)`;

      // The leader is only drawn once the label has actually left its planet;
      // a line under every label would be noise in the uncrowded views.
      const displaced = Math.abs(y - candidate.y) > LEADER_THRESHOLD;
      leader.style.opacity = displaced ? '1' : '0';
      if (displaced) {
        leader.setAttribute('x1', String(candidate.x));
        leader.setAttribute('y1', String(candidate.y));
        leader.setAttribute('x2', String(anchorX));
        leader.setAttribute('y2', String(y));
      }
    }
  });

  return (
    <Html
      fullscreen
      zIndexRange={[10, 0]}
      // The overlay is screen space, not object space: pinning it to the
      // viewport origin stops drei from offsetting it by this group's
      // projected position, which every label coordinate already accounts for.
      calculatePosition={() => [0, 0]}
      style={{ pointerEvents: 'none' }}
    >
      {/* drei centres the fullscreen layer on its anchor; shifting it back by
          half its size puts the origin at the top-left of the viewport, which
          is the frame the label coordinates are computed in. */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: 'translate(50%, 50%)' }}>
        {/* Leaders sit under the labels, in the same pixel frame: no viewBox, so
            one SVG user unit is one CSS pixel. */}
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {PLANETS.map((planet) => (
            <line
              key={planet.id}
              ref={(node) => {
                leaders.current.set(planet.id, node);
              }}
              stroke={planet.color}
              strokeWidth={1}
              strokeOpacity={0.35}
              style={{ opacity: 0, transition: 'opacity 300ms' }}
            />
          ))}
        </svg>

        {PLANETS.map((planet) => (
          <button
            key={planet.id}
            ref={(node) => {
              nodes.current.set(planet.id, node);
            }}
            type="button"
            onClick={() => onSelect(planet.id)}
            style={{ opacity: 0 }}
            className={`absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] transition-[opacity,color] duration-300 ${
              light ? 'text-slate-600 hover:text-sky-600' : 'text-white/55 hover:text-sky-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ring-2 ${light ? 'ring-black/10' : 'ring-white/10'}`}
              style={{ backgroundColor: planet.color }}
              aria-hidden
            />
            {localizedBodyName(language, planet.id, planet.name)}
          </button>
        ))}
      </div>
    </Html>
  );
}

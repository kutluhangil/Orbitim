import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { SiteKind, SurfaceSite } from '../data/missions';
import { useSiteSelection } from './siteSelection';

interface SurfaceSitesProps {
  sites: readonly SurfaceSite[];
  /** Scene radius of the body the sites are on. */
  radius: number;
}

/** Marker colour by what happened there. */
const KIND_COLORS: Record<SiteKind, string> = {
  crewed: '#ffd27a',
  landing: '#7ec8ff',
  rover: '#8affc1',
  'sample-return': '#d7a8ff',
  impact: '#ff9b7a',
  launch: '#ffc46b'
};

/** Marker size and label offsets, as fractions of the body radius or in pixels. */
const MARKER_RADII = 0.011;
const LABEL_OFFSET_X = 13;
const LABEL_HEIGHT = 18;
const LABEL_WIDTH = 118;
const CARD_GAP = 18;
const CARD_VIEWPORT_MARGIN = 16;
const DESKTOP_PANEL_WIDTH = 384;
const COMPACT_DOCK_CLEARANCE = 168;
/** Slots a crowded label may be moved into, nearest first and alternating side. */
const SLOTS = [0, -1, 1, -2, 2, -3, 3];
/**
 * How far round the limb a site is still worth labelling. A marker exactly on
 * the edge projects onto the silhouette, where its label has nothing to point at.
 */
const MIN_FACING = 0.12;

const DEG = Math.PI / 180;

/**
 * Position of a latitude and longitude on the body's own sphere.
 *
 * The mapping has to be the one three's sphere geometry uses for its texture
 * coordinates, or every marker would sit at the right angle from the pole and
 * the wrong place on the map: the seam of an equirectangular surface map falls
 * at longitude 180, which is half a turn round from where the geometry starts
 * its sweep.
 */
function siteToLocal(site: SurfaceSite, radius: number): THREE.Vector3 {
  const polar = (90 - site.lat) * DEG;
  const azimuth = (site.lon + 180) * DEG;
  return new THREE.Vector3(
    -radius * Math.cos(azimuth) * Math.sin(polar),
    radius * Math.cos(polar),
    radius * Math.sin(azimuth) * Math.sin(polar)
  );
}

const SITE_KIND_LABELS: Record<SiteKind, string> = {
  crewed: 'Crewed landing',
  landing: 'Landing',
  rover: 'Rover',
  'sample-return': 'Sample return',
  impact: 'Impact',
  launch: 'Launch site'
};

/** The date the site was reached, read in UTC so it never shifts locally. */
function formatSiteDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/** Signed latitude and longitude in the hemisphere form used on mission maps. */
function formatCoordinates(site: SurfaceSite): string {
  const lat = `${Math.abs(site.lat).toFixed(2)}° ${site.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(site.lon).toFixed(2)}° ${site.lon >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

/**
 * Where spacecraft have actually come down, marked on the ground they came down
 * on.
 *
 * The markers are children of the body's own surface, so they turn with it: a
 * site on the far side rotates out of view and back again on the body's real
 * rotation period rather than being pinned to the screen. Their labels are
 * screen-space, laid out in one pass so they cannot stack, and each is tied to
 * its marker by a leader — on a globe covered in dots, a floating name belongs
 * to no particular one of them.
 */
export function SurfaceSites({ sites, radius }: SurfaceSitesProps) {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement | null>());
  const leaders = useRef(new Map<string, SVGLineElement | null>());
  const detail = useRef<HTMLDivElement>(null);
  const { camera, size } = useThree();

  const selected = useSiteSelection((s) => s.selected);
  const select = useSiteSelection((s) => s.select);
  const clear = useSiteSelection((s) => s.clear);

  const positions = useMemo(
    () => new Map(sites.map((site) => [site.id, siteToLocal(site, radius)])),
    [sites, radius]
  );
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selected) ?? null,
    [sites, selected]
  );

  // Leaving the body takes its sites with it; a dossier for a landing site on a
  // world the camera is no longer at describes nothing on screen.
  useEffect(() => clear, [clear]);

  const scratch = useMemo(
    () => ({
      world: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      toCamera: new THREE.Vector3(),
      projected: new THREE.Vector3()
    }),
    []
  );

  useFrame(() => {
    const root = group.current;
    if (!root) return;
    root.updateWorldMatrix(true, false);

    const candidates = sites
      .map((site) => {
        const local = positions.get(site.id)!;
        scratch.world.copy(local).applyMatrix4(root.matrixWorld);
        scratch.normal.copy(local).normalize().transformDirection(root.matrixWorld);
        scratch.toCamera.copy(camera.position).sub(scratch.world);
        const distance = scratch.toCamera.length();
        const facing = scratch.normal.dot(scratch.toCamera.divideScalar(distance));

        scratch.projected.copy(scratch.world).project(camera);
        return {
          id: site.id,
          x: (scratch.projected.x * 0.5 + 0.5) * size.width,
          y: (-scratch.projected.y * 0.5 + 0.5) * size.height,
          visible: facing > MIN_FACING && scratch.projected.z < 1,
          distance
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const placed: { x: number; y: number }[] = [];

    for (const candidate of candidates) {
      const node = nodes.current.get(candidate.id);
      const leader = leaders.current.get(candidate.id);
      if (!node || !leader) continue;

      if (!candidate.visible) {
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
        leader.style.opacity = '0';
        continue;
      }

      const anchorX = candidate.x + LABEL_OFFSET_X;
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

      leader.style.opacity = '1';
      leader.setAttribute('x1', String(candidate.x));
      leader.setAttribute('y1', String(candidate.y));
      leader.setAttribute('x2', String(anchorX));
      leader.setAttribute('y2', String(y));
    }

    const card = detail.current;
    if (!card) return;
    const selectedCandidate = candidates.find((candidate) => candidate.id === selected);
    if (!selectedCandidate?.visible) {
      card.style.opacity = '0';
      card.style.pointerEvents = 'none';
      return;
    }

    const cardWidth = card.offsetWidth || 288;
    const cardHeight = card.offsetHeight || 224;
    const isDesktop = size.width >= 768;
    const rightLimit =
      size.width -
      CARD_VIEWPORT_MARGIN -
      (isDesktop ? DESKTOP_PANEL_WIDTH : 0) -
      cardWidth;
    const preferredRight =
      selectedCandidate.x + LABEL_OFFSET_X + LABEL_WIDTH + CARD_GAP;
    const preferredLeft = selectedCandidate.x - cardWidth - CARD_GAP;
    const cardX =
      preferredRight <= rightLimit
        ? preferredRight
        : THREE.MathUtils.clamp(
            preferredLeft,
            CARD_VIEWPORT_MARGIN,
            Math.max(CARD_VIEWPORT_MARGIN, rightLimit)
          );
    const bottomClearance = isDesktop ? CARD_VIEWPORT_MARGIN : COMPACT_DOCK_CLEARANCE;
    const cardY = THREE.MathUtils.clamp(
      selectedCandidate.y - cardHeight / 2,
      CARD_VIEWPORT_MARGIN,
      Math.max(CARD_VIEWPORT_MARGIN, size.height - bottomClearance - cardHeight)
    );

    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
    card.style.transform = `translate(${cardX}px, ${cardY}px)`;
  });

  return (
    <group ref={group}>
      {sites.map((site) => {
        const active = selected === site.id;
        return (
          <mesh
            key={site.id}
            position={positions.get(site.id)!}
            onClick={(event) => {
              event.stopPropagation();
              select(site);
            }}
          >
            <sphereGeometry args={[radius * MARKER_RADII * (active ? 1.7 : 1), 10, 8]} />
            <meshBasicMaterial color={KIND_COLORS[site.kind]} toneMapped={false} />
          </mesh>
        );
      })}

      <Html
        fullscreen
        zIndexRange={[12, 0]}
        calculatePosition={() => [0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ transform: 'translate(50%, 50%)' }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {sites.map((site) => (
              <line
                key={site.id}
                ref={(node) => {
                  leaders.current.set(site.id, node);
                }}
                stroke={KIND_COLORS[site.kind]}
                strokeWidth={1}
                strokeOpacity={0.4}
                style={{ opacity: 0 }}
              />
            ))}
          </svg>

          {sites.map((site) => (
            <button
              key={site.id}
              ref={(node) => {
                nodes.current.set(site.id, node);
              }}
              type="button"
              onClick={() => select(site)}
              style={{ opacity: 0 }}
              className={`absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] tracking-[0.06em] backdrop-blur-sm transition-[opacity,color,border-color] duration-200 ${
                selected === site.id
                  ? 'border-white/40 bg-black/70 text-white'
                  : 'border-white/10 bg-black/45 text-white/70 hover:border-white/30 hover:text-white'
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: KIND_COLORS[site.kind] }}
                aria-hidden
              />
              {site.name}
            </button>
          ))}

          {selectedSite && (
            <div
              ref={detail}
              role="dialog"
              aria-modal="false"
              aria-label={`${selectedSite.name} exploration details`}
              style={{ opacity: 0, borderColor: `${KIND_COLORS[selectedSite.kind]}55` }}
              className="pointer-events-none absolute left-0 top-0 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border bg-black/85 p-4 text-left text-white shadow-2xl shadow-black/60 backdrop-blur-xl transition-opacity duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-white/35">
                    Exploration
                  </p>
                  <h3 className="mt-1 truncate text-[17px] font-light tracking-tight">
                    {selectedSite.name}
                  </h3>
                  <p
                    className="mt-1 text-[9px] uppercase tracking-[0.18em]"
                    style={{ color: KIND_COLORS[selectedSite.kind] }}
                  >
                    {SITE_KIND_LABELS[selectedSite.kind]} · {selectedSite.agency}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clear}
                  aria-label={`Close ${selectedSite.name} details`}
                  className="-mr-1 -mt-1 shrink-0 rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-white/45 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-300"
                >
                  Close
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-white/65">
                {selectedSite.summary}
              </p>

              <dl className="mt-3 border-t border-white/10 pt-2">
                <div className="flex items-start justify-between gap-4 py-1">
                  <dt className="text-[9px] uppercase tracking-[0.18em] text-white/30">Date</dt>
                  <dd className="text-right text-[10px] text-white/65">
                    {formatSiteDate(selectedSite.date)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <dt className="text-[9px] uppercase tracking-[0.18em] text-white/30">
                    Coordinates
                  </dt>
                  <dd className="text-right font-mono text-[10px] tabular-nums text-white/65">
                    {formatCoordinates(selectedSite)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

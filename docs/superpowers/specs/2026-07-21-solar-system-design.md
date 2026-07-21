# Orbitim — Solar System Engine Design

Date: 2026-07-21
Scope order: **B** (solar system + flight) → **C** (satellite layer migration) → **A** (landing page)

## Decisions

| Topic | Decision |
|---|---|
| Scale | Logarithmic hybrid: real diameter ratios ×3 exaggeration, log-compressed orbital radii |
| Ephemeris | `astronomy-engine` (VSOP87), replaces hand-written sun/moon approximations |
| Textures | 8K Earth / 4K others, lazy-loaded, KTX2/Basis compressed, NASA + Solar System Scope (CC-BY) |
| Flight | Continuous cinematic flight, single scene, ~2.5s bezier ease, LOD upgrade en route |
| Data | Static fact-sheet JSON + live values computed from ephemeris. No API keys, no backend |
| Bodies | 8 planets + Sun + Moon + Saturn/Uranus rings + Io, Europa, Ganymede, Callisto, Titan, Phobos, Deimos, Triton |
| Art direction | Cinematic dark, minimal UI, single ice-blue accent, bloom + grain + subtle chromatic aberration |
| Renderer | React Three Fiber + drei + @react-three/postprocessing |

## Module boundaries

One-way flow: **ephemeris → scale → scene**. Astronomy code never returns three.js types.

- `src/lib/ephemeris/bodies.ts` — body registry (radius, axial tilt, rotation period, engine id)
- `src/lib/ephemeris/positions.ts` — `getBodyState(id, date)`; sole astronomy entry point
- `src/lib/ephemeris/rotation.ts` — real spin angle for a given date
- `src/lib/scale.ts` — `auToScene`, `kmToSceneRadius` and inverses; single source of truth for distance
- `src/lib/textures/` — KTX2 loader + LOD policy, caching and cancellation
- `src/scene/` — R3F components: `SolarSystem`, `Body`, `Rings`, `OrbitPath`, `Starfield`, `SunLight`, `Effects`, `CameraRig`
- `src/flight/` — camera state machine `overview | flying | orbiting`; scene reads, never writes
- `src/ui/` — HUD, body info panel, time controls; DOM only
- `src/data/bodies/*.json` — fact sheet + active missions, one file per body

## Replaced legacy

- `getSunPosition` / `getMoonPosition` approximations — deleted, replaced by ephemeris
- `LUNAR_SATELLITES` / `SOLAR_PROBES` fabricated orbits — removed or explicitly labelled schematic
- Third-party CDN textures (`Shriisoot/Planets-texture`, `vasturiano.github.io`) — replaced by in-repo licensed assets
- Hardcoded group counts — derived from actually loaded TLE sets

## Real data guarantees

Every number shown is either a cited constant (NASA Planetary Fact Sheet) or computed from ephemeris/SGP4.
No fabricated telemetry, no simulated warnings.

```text
 ██████╗ ██████╗ ██████╗ ██╗████████╗██╗███╗   ███╗
██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██║████╗ ████║
██║   ██║██████╔╝██████╔╝██║   ██║   ██║██╔████╔██║
██║   ██║██╔══██╗██╔══██╗██║   ██║   ██║██║╚██╔╝██║
╚██████╔╝██║  ██║██████╔╝██║   ██║   ██║██║ ╚═╝ ██║
 ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚═╝╚═╝     ╚═╝
```

### **The solar system where it actually is right now.**
### Real ephemeris, live orbital elements, NASA imagery — in a browser tab, with nothing behind it.

</div>

---

## ✦ What is Orbitim?

**Orbitim** is a real-time 3D solar system with thirty rendered bodies: the Sun, eight
planets, Ceres and Pluto, plus nineteen natural satellites. They are placed by orbital
mechanics rather than by hand, for the exact instant on the clock. Fly to any of them,
scrub the clock forward a decade, and the geometry you see is the geometry the sky will
hold.

Beyond the planets, the system is filled in with the objects that actually share it: five
comets riding their real orbits with a tail that only unfurls near the Sun, the named
dwarf planets and the largest asteroids, and the main belt between Mars and Jupiter with
its Kirkwood gaps.

Around Earth, up to seventeen constellations of tracked objects are propagated from real
orbital elements at frame rate: space stations, Starlink, GPS, GLONASS, Galileo, BeiDou,
OneWeb, Iridium NEXT, geostationary, weather, science, Earth observation, the brightest
objects, and the four great orbital-debris clouds — Iridium 33, Cosmos 2251, Fengyun 1C
and Cosmos 1408.

**No accounts and no browser-exposed keys.** The scene, ephemeris and satellite propagation
run in the browser. Small Vercel routes proxy JPL Horizons/CNEOS requests and NASA DONKI
reports; the optional `NASA_API_KEY` is stored only in the Vercel project environment.
Any view is a link: the Share button copies the exact instant, rate and constellations so
someone else opens on the same sky.

> **Nothing on screen is simulated telemetry.** Where a value is undefined for a body,
> the panel says so instead of inventing one.

---

## ⚡ Features

| Feature | Description |
|---------|-------------|
| 🪐 **Real positions** | VSOP87 and the lunar theory via `astronomy-engine`; moons of Jupiter, Saturn, Mars and Neptune from parent-relative elements |
| 🛰️ **Live satellites** | CelesTrak element sets, SGP4-propagated in the browser each frame, 17 switchable groups with live object counts, including four real debris clouds |
| ☄️ **Comets & minor planets** | Halley, Encke, 67P, Hale–Bopp and NEOWISE on their JPL orbits; the named dwarf planets and largest asteroids on theirs |
| 🕰️ **Scrubbable clock** | Pause, run at rate, or jump to any instant — every position, distance and phase angle follows |
| 🔗 **Shareable moments** | The Share button copies a link to the exact instant, rate and constellations on screen |
| 🚀 **Cinematic flight** | Camera state machine: overview → flying → orbiting, with `Escape` as the way back out |
| 🏷️ **Collision-free labels** | Screen-space planet labels laid out in one pass, so the inner planets never stack into an unreadable pile |
| ☀️ **Living photosphere** | The Sun's surface is a GLSL shader: drifting granulation over the published map, plus a camera-facing corona sprite |
| 💍 **Physical rings** | Saturn's shadow cast across its own ring plane, sub-texture ringlet structure, and forward scattering when the Sun sits behind |
| 🌫️ **Atmospheres** | Limb shells only where a world actually has one — Venus opaque, Mars thin, the ice giants deep; Mercury and the moons get none |
| ✨ **Deep sky** | A dimmed Milky Way plate behind 9,000 deterministic point stars, coloured across the main sequence |
| 📊 **Live dossier** | Distance, light travel time, apparent magnitude, illuminated fraction — all computed at render time from the same ephemeris |
| 🖼️ **8K on approach** | 2K maps for everything visible, an 8K map only for the body you are flying to, released when you leave |
| 🌗 **Source-backed moon visits** | Published NASA 3D Resources models for selected moons mount only during close inspection; moon docks keep the system rail legible |
| 🌍 **Independent cloud shell** | Earth carries a raised, separately advecting cloud layer instead of a cloud texture painted into the surface |
| 🇹🇷 **English / Türkçe** | UI controls, live science panels, observer readouts and satellite dossiers switch language instantly without changing the shared sky |
| 📐 **Honest geometry** | Distances are log-compressed to fit one screen; directions are never distorted, so conjunctions stay truthful |

---

## 🔭 What is real

| Shown | Source |
|-------|--------|
| Planet, moon and Sun positions | VSOP87 and the lunar theory, via [`astronomy-engine`](https://github.com/cosinekitty/astronomy) |
| Distances, light travel time, apparent magnitude, illuminated fraction | Computed from the same ephemeris at render time |
| Satellite and debris positions | CelesTrak TLEs, SGP4-propagated in the browser each frame |
| Comet, dwarf-planet and asteroid orbits | JPL Small-Body Database osculating elements, two-body propagated (checked against astronomy-engine's Pluto) |
| Body constants (mass, gravity, day length, atmosphere) | [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) |
| Surface imagery and close moon models | Solar System Scope CC BY 4.0 maps plus NASA/USGS/JPL public-domain products; individual provenance is in `public/textures/ATTRIBUTION.md` |
| JPL live vectors and NEO approaches | Vercel proxy routes to [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) and [JPL CNEOS CAD](https://ssd-api.jpl.nasa.gov/cad.api), with explicit upstream-error diagnostics |
| Solar-weather reports | NASA DONKI via a Vercel route; requires `NASA_API_KEY` only in the Vercel environment |

---

## 📏 Scale

True scale is unusable — at Neptune's real distance the Earth is far below one pixel.
Orbital radii are logarithmically compressed and body radii follow a gentler compression,
so Jupiter still dwarfs Mercury and the whole system reads on one screen. Directions are
never distorted: conjunctions and alignments are geometrically truthful.

```
auToScene(au)   →  ORBIT_BASE · au^(1-0.62) · (1 + 0.62·log₁₀(1+au))
radiusOf(km)    →  EARTH_SCENE_RADIUS · (km / R⊕)^0.45
```

All of it lives in one file: `src/lib/scale.ts`.

---

## 🛠️ Tech Stack

```
Language        →  TypeScript (strict) · GLSL
Rendering       →  three.js · React Three Fiber · @react-three/drei · @react-three/postprocessing
UI              →  React 19 · Tailwind CSS 4
State           →  zustand (flight state machine, satellite groups)
Astronomy       →  astronomy-engine (VSOP87, lunar theory, magnitudes, phase)
Orbits          →  satellite.js (SGP4/SDP4 from TLE)
Build           →  Vite 8 · oxlint
Data            →  CelesTrak element sets · NASA/JPL/USGS imagery · NASA Planetary Fact Sheet · JPL Horizons/CNEOS · NASA DONKI
Server routes   →  Vercel Functions for JPL and NASA requests; NASA key remains server-side
```

---

## 🏗️ Architecture

Flow is one-way: **ephemeris → scale → scene**. Astronomy code never returns three.js
types, so it can be verified without rendering anything.

```
┌──────────────────────────────────────────────────────────────────┐
│                   ORBITIM (browser-rendered scene)                │
│                                                                   │
│  ┌────────────────────┐   ┌────────────────┐   ┌───────────────┐  │
│  │ src/lib/ephemeris/ │   │ src/lib/scale  │   │ src/data/     │  │
│  │ bodies · positions │──▶│ log compression│   │ fact sheet    │  │
│  │ rotation           │   │ (single truth) │   │ per body      │  │
│  └────────────────────┘   └───────┬────────┘   └───────┬───────┘  │
│         no three.js, no React     │                    │          │
│                            ┌──────▼────────────────────▼───────┐  │
│                            │ src/scene/  React Three Fiber      │  │
│                            │ Body · Rings · Atmosphere · Sun    │  │
│                            │ Starfield · SatelliteLayer · Labels│  │
│                            └──────┬─────────────────────┬───────┘  │
│  ┌──────────────────┐      ┌──────▼──────┐       ┌──────▼───────┐ │
│  │ src/lib/textures │─────▶│ src/flight/ │◀─────▶│ src/ui/ DOM  │ │
│  │ 2K/8K LOD + free │      │ overview →  │       │ rail·dossier │ │
│  └──────────────────┘      │ flying →    │       │ clock·sats   │ │
│                            │ orbiting    │       └──────────────┘ │
│                            └─────────────┘                        │
└───────────────────────────────┬───────────────────────────────────┘
                                │ fetch, cached 2h in localStorage
                    ┌───────────▼────────────┐
                    │ CelesTrak element sets  │
                    │ (CDN mirror → direct)   │
                    └────────────────────────┘
                                │ optional server-side observed data
                    ┌───────────▼────────────┐
                    │ Vercel API routes       │
                    │ JPL Horizons · CNEOS    │
                    │ NASA DONKI              │
                    └────────────────────────┘
```

---

## 🌐 Orbital element pipeline

Element sets are fetched per constellation, not all at once, and each step degrades to the
next with the reason recorded on the result:

| Step | Source | Notes |
|------|--------|-------|
| 1 | `localStorage` cache | Reused for 2 hours, so a reload costs no network |
| 2 | Satvisor CDN mirror of CelesTrak | Primary path; avoids CelesTrak rate limits |
| 3 | CelesTrak `gp.php` directly | Used when the mirror is unavailable; 403 is surfaced, not hidden |
| 4 | Embedded fallback set | ISS, Tiangong, HST, a GPS bird — so the layer is never empty |

Each result carries its own `source` (`live` · `cache` · `local_fallback` · `hardcoded_fallback`),
so the UI can always say where a position came from.

---

## 🚀 Running

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview
npm run lint      # oxlint
npm run test:e2e  # Playwright mobile regression suite
```

For the core scene, no environment variable is needed. To enable live NASA DONKI reports
in a Vercel deployment, set `NASA_API_KEY` in the Vercel project environment; never place
it in a `VITE_` variable or commit it to the repository. Local Vite does not run files in
`api/`; use `vercel dev` when exercising JPL or NASA API routes locally.

---

## ⚙️ Performance

| Concern | Approach |
|---------|----------|
| **Texture memory** | 2K everywhere, 8K only for the flight target, disposed on departure |
| **Moon geometry** | NASA GLB moon assets mount only for the current close target; the overview keeps lightweight physical markers |
| **Bundle** | `three`, `astronomy-engine` and `satellite.js` split into their own vendor chunks — app rebuilds don't invalidate ~1.3 MB of cached script |
| **Star field** | One `Points` draw call for 9,000 stars, deterministic hash instead of `Math.random`, no per-frame allocation |
| **Satellites** | One points buffer per group, written in place each frame — a whole constellation is a single draw call; groups are opt-in and counted |
| **Frame loop** | Scratch vectors and quaternions allocated once per component, reused every frame |

---

## 📄 License

Code is [MIT](LICENSE). Surface imagery is CC BY 4.0 from Solar System Scope,
not covered by the MIT grant — see `public/textures/ATTRIBUTION.md`.

---

<div align="center">

Built with three.js · React Three Fiber · astronomy-engine · satellite.js

*Real positions, real elements and explicit data provenance. If Orbitim shows you
something you didn't expect to be true, drop the repo a ⭐*

</div>

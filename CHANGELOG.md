# Changelog

## Unreleased

- Added explicit NASA EPIC Earth and SDO AIA 171 observation cards to Now mode, preserving the difference between EPIC capture time and an SDO asset publication timestamp.
- Added physical-space Solar Illumination inputs, scientific contrast mode, and an on-scene Explore/Scientific/Now mode selector so visual scale compression no longer dictates eclipse geometry.
- Strengthened Earth's independently advecting cloud shell by treating the NASA-derived grayscale plate as linear density instead of double-attenuated colour, and removed the Sun's meridian seam with periodic spherical noise, wrapped sampling and a brighter structured corona.
- Moved landing and rover exploration details out of the fixed body dossier into a viewport-safe, accessible card anchored beside the selected surface marker.
- Replaced Pluto's broken half-black plate with NASA's New Horizons MVIC colour mosaic plus an explicitly featureless fill for unobserved southern coverage, and rebuilt Uranus's ring plane as 13 narrow, faint, body-specific rings with ring-aware camera framing.
- Rebuilt Earth's clouds as an oblate, physically separated shell with density-driven height, alpha-cut clear sky, sunlight and independent simulation-time advection; clarified that the unchanged planet pipeline preserves full EQJ/J2000 3D bearings.
- Replaced the desktop body list with a texture-backed, keyboard-accessible solar-system dock above the simulation clock, including hover labels and direct world visits.
- Added measured polar flattening and matching ellipsoidal atmospheres for Earth, Mars and the giant planets, updated Jupiter's equatorial radius from 2026 Juno results, and made Venus's visible cloud deck super-rotate on its observed four-day period.
- Prioritized and deduplicated near-surface texture streaming, raised anisotropic filtering, and removed false normals derived from baked image brightness so 8K Moon and rocky-world maps stay clean at close range.
- Realigned the desktop body rail, added simulation-driven Earth cloud advection and differential ring motion, and rebalanced the Sun into a bright structured photosphere with a warmer corona.
- Moved NASA DONKI requests behind a cached Vercel route so a private server key is never exposed and quota failures are explicit.
- Added event visits and an explicitly data-mapped Web Audio sonification for the astronomical calendar.
- Added a compact mobile observer sheet for local sky, ISS and on-demand Starlink predictions.
- Added JPL Horizons-backed spacecraft vectors and a JPL CNEOS close-approach feed through constrained Vercel API routes.
- Added an on-demand Web Worker that finds the next geometry-based Starlink rises above a 10° local horizon without blocking the WebGL scene.
- Added explicit TLE provenance, fetch age and element-epoch age to satellite and observer predictions.
- Added a local-sky observer mode with topocentric Sun, Moon and planet alt/az plus an explicit-location ISS pass prediction.
- Added Voyager-informed physically lit terrain profiles for Titania, Oberon and Miranda rather than presenting incomplete imagery as full global maps.
- Rendered Phobos and Deimos with their measured tri-axial proportions and added a restrained animated Enceladus south-polar ice-plume layer based on Cassini observations.
- Added NASA/USGS global Galileo and Voyager surface mosaics for Io, Europa, Ganymede and Callisto; excluded partial-coverage maps from being presented as complete globes.
- Added NASA DONKI active-region solar prominences, luminous live-TLE satellite points, and an explicitly independent Earth cloud layer.
- Linked the Sun’s convection and corona response to the latest observed NASA DONKI flare, CME and geomagnetic reports.
- Added live NASA DONKI solar-weather telemetry with explicit unavailable-state reporting, and removed ended/non-NASA Mars missions from the NASA mission list.
- Corrected planetary rotation-axis alignment, satellite frame orientation, moon distance calculations, current mission/moon-count data, focused-view spacecraft label clutter, sub-minute light-time formatting, and radius terminology.

# Texture attribution

All planetary, lunar, solar and star map textures in this directory are by
**Solar System Scope** (https://www.solarsystemscope.com/textures/), released under
**CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).

They are based on NASA elevation and imagery data.

Files are re-encoded at a lower JPEG quality to keep download sizes practical.
No other modification was made.

## Mars elevation

`mars_mola_topography.png` is a linear, grayscale elevation map generated from
the NASA PDS MGS MOLA MEGDR product
[`MEGT90N000EB.IMG`](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img).
It is the global median-topography grid collected by Mars Global Surveyor’s Mars
Orbiter Laser Altimeter during 1999–2001 (16 pixels per degree; elevations in
meters relative to the MOLA areoid). The signed 16-bit source values are linearly
mapped from the product bounds −8,206 m to 21,181 m and resampled to 4096×2048
for browser delivery. The renderer restores those physical elevation bounds; it
does not derive relief from the coloured Mars albedo or exaggerate the height.

## Galilean moon surfaces

`nasa_io.jpg`, `nasa_europa.jpg`, `nasa_ganymede.jpg` and
`nasa_callisto.jpg` are NASA 3D Resources global equirectangular texture maps
(published June 2, 2025), credited to **USGS, JPL and Caltech**. They are based
on Galileo and Voyager observations and JPL/Caltech generated planetary maps.

- **Io** uses the Galileo-colour global mosaic.
- **Europa**, **Ganymede** and **Callisto** use published USGS Voyager mosaics.

The files are kept at NASA's supplied 1440×720 resolution; no colour or missing
surface detail was fabricated. Partial-coverage maps for other moons are not
used as full globes.

## Dwarf-planet surfaces

`pluto.jpg`, `charon.jpg` and `ceres.jpg` are based on real global mosaics,
public domain:

- **Pluto** — NASA / JHUAPL / SwRI **New Horizons** Ralph/MVIC global colour
  mosaic. Pixels outside the observed southern coverage use a smooth,
  longitude-neutral mean-albedo fill so unknown terrain is not fabricated.
- **Charon** — NASA / JHUAPL / SwRI **New Horizons** LORRI–MVIC global mosaic
  (300 m/px), via USGS Astrogeology.
- **Ceres** — NASA / JPL-Caltech / **DLR** **Dawn** Framing Camera global mosaic,
  via USGS Astrogeology.

Downsampled to equirectangular JPEG. Charon and Ceres remain monochrome; no
colour was invented.

## Saturnian moon surfaces

`enceladus.jpg`, `rhea.jpg` and `iapetus.jpg` are real global mosaics, public
domain: NASA / JPL / SSI **Cassini** ISS imagery (Iapetus and Rhea filled in
with **Voyager**), via USGS Astrogeology. Mimas and the Uranian moons use the
published NASA 3D resources documented below rather than an invented procedural
surface.

## NASA 3D moon models

`../models/mimas.glb`, `../models/titan.glb`, `../models/tethys.glb` and
`../models/dione.glb` are NASA 3D Resources glTF models credited to **NASA
Visualization Technology Applications and Development (VTAD)**. Tethys, Dione
and Mimas are Cassini-image mosaics projected onto the published models; Titan
uses NASA's supplied moon model. Their render scale is calculated from the
model bounds against the JPL Horizons mean radii used by the ephemeris.

`../models/phobos.glb` and `../models/deimos.glb` are the NASA/JPL-Caltech
Mars-moon models. They replace the former stretched spheres, preserving the
observed non-spherical topography in close view.

`../models/triton.glb`, `../models/titania.glb`, `../models/oberon.glb` and
`../models/miranda.glb` are the published NASA VTAD models. Triton uses the
Voyager-era NASA resource; the Uranian satellite models retain their published
Voyager image coverage instead of synthesising missing global detail.

Original NASA resource pages: [Mimas](https://science.nasa.gov/resource/mimas-3d-model/),
[Titan](https://science.nasa.gov/resource/titan-3d-model/),
[Tethys](https://science.nasa.gov/resource/tethys-3d-model/),
[Dione](https://science.nasa.gov/resource/dione-3d-model/),
[Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/),
[Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/),
[Triton](https://science.nasa.gov/resource/triton-3d-model/),
[Titania](https://science.nasa.gov/resource/titania-3d-model/),
[Oberon](https://science.nasa.gov/resource/oberon-3d-model/) and
[Miranda](https://science.nasa.gov/resource/miranda-3d-model/).

Tethys and Dione begin from Saturn-centred J2000 state vectors exported from
[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (sat441l); their scene
phase is propagated from that measurement, never from a hand-picked longitude.

## Deep-space spacecraft models

`../models/parker-solar-probe.glb` is NASA Visualization Technology Applications
and Development (VTAD)'s published [Parker Solar Probe glTF
model](https://science.nasa.gov/resource/parker-solar-probe-3d-model/). The
scene centres and normalises the source mesh from its measured bounds; its
position comes independently from the spacecraft ephemeris.

`../models/voyager.glb` is the NASA VTAD published [Voyager glTF
model](https://science.nasa.gov/resource/voyager-3d-model/), used for both
Voyager 1 and Voyager 2 because the missions' spacecraft are twins.
`../models/new-horizons.glb` is NASA VTAD's published [New Horizons glTF
model](https://science.nasa.gov/resource/new-horizons-3d-model/). The three
source models use their measured scene bounds for their display scale; their
live locations continue to come from JPL Horizons state vectors.

James Webb Space Telescope is rendered as a lightweight scene-native visual
model of the deployed observatory, rather than as a substituted third-party
asset. Its eighteen hexagonal primary-mirror segments, five-layer sunshield,
spacecraft bus, solar array and secondary-mirror support follow NASA's
[Webb 3D reference](https://science.nasa.gov/mission/webb/webb-3d/) and
[published model parts](https://science.nasa.gov/mission/webb/build-a-model-of-webb/).
It is not represented as an engineering model; as with Parker, its geometry is
display-scaled while its location remains the live ephemeris location.

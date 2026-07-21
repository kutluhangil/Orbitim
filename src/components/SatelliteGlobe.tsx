import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { fetchSatellitesByGroup, type SatelliteData } from '../services/tle';
import { Search, Info, Radio, Compass, X, Cpu, Layers, Play, Pause, Zap, Clock, ShieldAlert, Globe as GlobeIcon } from 'lucide-react';
import starlinkImg from '../assets/starlink.png';
import logoImg from '../assets/logo.png';

const EARTH_RADIUS_KM = 6371;

const GROUPS = [
  { id: 'stations', name: 'Space Stations', count: 14, color: '#fbbf24' },
  { id: 'gps', name: 'GPS', count: 40, color: '#22c55e' },
  { id: 'glonass', name: 'GLONASS', count: 28, color: '#84cc16' },
  { id: 'galileo', name: 'Galileo', count: 49, color: '#06b6d4' },
  { id: 'weather', name: 'Weather', count: 38, color: '#ec4899' },
  { id: 'oneweb', name: 'OneWeb', count: 651, color: '#a855f7' },
  { id: 'starlink', name: 'Starlink', count: 10785, color: '#ffffff' },
  { id: 'brightest', name: 'Brightest', count: 157, color: '#ffffff' },
  { id: 'debris_cosmos', name: 'Debris · Cosmos-2251', count: 593, color: '#f43f5e' },
  { id: 'debris_iridium', name: 'Debris · Iridium-33', count: 110, color: '#fb923c' },
  { id: 'debris_fengyun', name: 'Debris · Fengyun-1C', count: 1919, color: '#ef4444' },
  { id: 'geo', name: 'Other Active', count: 4425, color: '#64748b' }
];

const LUNAR_SATELLITES = [
  { name: 'Lunar Reconnaissance Orbiter (LRO)', id: 35315, altitude: 50, inclination: 90, color: '#38bdf8', period: 7200, group: 'moon_sats' },
  { name: 'Chandrayaan-2 Orbiter', id: 44431, altitude: 100, inclination: 90, color: '#fbbf24', period: 7140, group: 'moon_sats' },
  { name: 'Danuri (KPLO)', id: 53368, altitude: 100, inclination: 90, color: '#22c55e', period: 7200, group: 'moon_sats' },
  { name: 'Chang\'e 4 Relay (Queqiao)', id: 43470, altitude: 2000, inclination: 45, color: '#a855f7', period: 18000, group: 'moon_sats' },
  { name: 'Queqiao-2 (Chang\'e 6 Relay)', id: 59196, altitude: 8600, inclination: 55, color: '#f43f5e', period: 30960, group: 'moon_sats' },
  { name: 'Apollo 11 Command Module', id: 4400, altitude: 110, inclination: 10, color: '#818cf8', period: 7700, group: 'moon_sats' }
];

const SOLAR_PROBES = [
  { name: 'Parker Solar Probe', id: 43615, altitude: 45, inclination: 3.4, color: '#fbbf24', period: 36000, group: 'solar_probes' },
  { name: 'SOHO (Solar & Heliospheric Obs.)', id: 23741, altitude: 85, inclination: 7.2, color: '#f43f5e', period: 72000, group: 'solar_probes' },
  { name: 'Solar Orbiter (ESA/NASA)', id: 45184, altitude: 60, inclination: 24.0, color: '#22c55e', period: 48000, group: 'solar_probes' },
  { name: 'STEREO-A', id: 29499, altitude: 95, inclination: 0.1, color: '#38bdf8', period: 96000, group: 'solar_probes' },
  { name: 'Aditya-L1 (ISRO)', id: 57771, altitude: 75, inclination: 12.5, color: '#a855f7', period: 54000, group: 'solar_probes' }
];





// Create a canvas texture for the satellite glow sprite (sharp circular dot)
const satCanvas = document.createElement('canvas');
satCanvas.width = 16;
satCanvas.height = 16;
const satCtx = satCanvas.getContext('2d')!;
const satGrad = satCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
satGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
satGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
satGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.95)');
satGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.4)');
satGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
satCtx.fillStyle = satGrad;
satCtx.fillRect(0, 0, 16, 16);
const satTexture = new THREE.CanvasTexture(satCanvas);

// Shared sprite material cache to avoid creating duplicate sprite materials
const spriteMaterialCache: Record<string, THREE.SpriteMaterial> = {};

function getSharedSpriteMaterial(color: string, opacity: number): THREE.SpriteMaterial {
  const key = `${color}_${opacity}`;
  if (!spriteMaterialCache[key]) {
    spriteMaterialCache[key] = new THREE.SpriteMaterial({
      map: satTexture,
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }
  return spriteMaterialCache[key];
}

// Format TLE epoch yr and day fraction into UTC date string
function getTleEpochDate(satrec: any): string {
  if (!satrec) return '';
  try {
    const year = satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr;
    const date = new Date(Date.UTC(year, 0, 1));
    date.setUTCDate(date.getUTCDate() + Math.floor(satrec.epochdays - 1));
    const fracDay = satrec.epochdays % 1;
    const ms = fracDay * 24 * 60 * 60 * 1000;
    const epochDate = new Date(date.getTime() + ms);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = epochDate.getUTCFullYear();
    const mm = pad(epochDate.getUTCMonth() + 1);
    const dd = pad(epochDate.getUTCDate());
    const hh = pad(epochDate.getUTCHours());
    const min = pad(epochDate.getUTCMinutes());
    const sec = pad(epochDate.getUTCSeconds());
    
    return `TLE ${yyyy}-${mm}-${dd} ${hh}:${pad(Number(min))}:${sec} UTC`;
  } catch (e) {
    return 'TLE DATE UNKNOWN';
  }
}

// Convert spherical coordinates to Cartesian for Sun and Moon positioning
function sphericalToCartesian(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (90 - lng) * (Math.PI / 180);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
}

// Approximate Sun geocentric coordinates (declination and longitude) based on Date
function getSunPosition(date: Date) {
  const time = date.getTime();
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = time - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Declination (latitude)
  const declination = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
  
  // Longitude based on UTC time fraction
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const utcSeconds = date.getUTCSeconds();
  const timeFraction = (utcHours * 3600 + utcMinutes * 60 + utcSeconds) / 86400;
  const longitude = -180 + (1 - timeFraction) * 360; 

  return { lat: declination, lng: longitude };
}

// Approximate Moon geocentric coordinates based on Date
function getMoonPosition(date: Date) {
  const time = date.getTime();
  const sunPos = getSunPosition(date);
  
  // Astronomical period approximations
  const siderealMs = 27.32 * 24 * 60 * 60 * 1000; 
  const synodicMs = 29.53 * 24 * 60 * 60 * 1000;  
  
  const orbitAngle = (time % siderealMs) / siderealMs * 360;
  const phaseAngle = (time % synodicMs) / synodicMs * 360;
  
  const longitude = (sunPos.lng + phaseAngle) % 360;
  const latitude = 28.5 * Math.sin(orbitAngle * (Math.PI / 180));
  
  return { lat: latitude, lng: longitude };
}

export default function SatelliteGlobe() {
  const globeRef = useRef<any>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    starlink: true,
    stations: true,
    gps: false,
    glonass: false,
    galileo: false,
    weather: false,
    oneweb: false,
    brightest: false,
    debris_cosmos: false,
    debris_iridium: false,
    debris_fengyun: false,
    geo: false
  });
  const [loadedSatellites, setLoadedSatellites] = useState<Record<string, SatelliteData[]>>({});
  const [observationTarget, setObservationTarget] = useState<'earth' | 'moon' | 'sun'>('earth');
  const [loadingGroups, setLoadingGroups] = useState<Record<string, boolean>>({});
  const [positions, setPositions] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(new Date().toISOString().substring(11, 19));
  const [selectedSat, setSelectedSat] = useState<SatelliteData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataSource, setDataSource] = useState<string>('unknown');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [showLaserLinks, setShowLaserLinks] = useState(false);
  const sunVectorRef = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0));
  const [mobileShowLayers, setMobileShowLayers] = useState(false);
  const [mobileShowSearch, setMobileShowSearch] = useState(false);
  const [showSelectedOrbit, setShowSelectedOrbit] = useState(true);
  const [showSelectedFootprint, setShowSelectedFootprint] = useState(true);
  const [followSelected, setFollowSelected] = useState(true);
  const [labels, setLabels] = useState<any[]>([]);

  const [isRotating, setIsRotating] = useState(true);
  const [isTimeFlowing, setIsTimeFlowing] = useState(true);
  const frozenTimeRef = useRef<Date | null>(null);
  const [timeMultiplier, setTimeMultiplier] = useState<number>(1);
  const [simTime, setSimTime] = useState<Date>(new Date());
  const simTimeRef = useRef<Date>(new Date());
  const currentGmstRef = useRef<number>(satellite.gstime(new Date()));
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);

  // Keep simTimeRef synced for the ThreeJS high-performance render loop
  useEffect(() => {
    simTimeRef.current = simTime;
  }, [simTime]);

  useEffect(() => {
    if (isTimeFlowing) {
      frozenTimeRef.current = null;
    } else {
      frozenTimeRef.current = new Date();
    }
  }, [isTimeFlowing]);

  // Memoize all currently enabled satellites
  const satellites = useMemo(() => {
    if (observationTarget === 'moon') {
      return loadedSatellites.moon_sats || [];
    }
    if (observationTarget === 'sun') {
      return loadedSatellites.solar_probes || [];
    }
    let combined: SatelliteData[] = [];
    for (const groupId of Object.keys(visibleLayers)) {
      if (visibleLayers[groupId] && loadedSatellites[groupId]) {
        combined = combined.concat(loadedSatellites[groupId]);
      }
    }
    return combined;
  }, [visibleLayers, loadedSatellites, observationTarget]);

  // States for Globe.gl layers
  const [paths, setPaths] = useState<any[]>([]);
  const [rings, setRings] = useState<any[]>([]);
  const [globeMaterial, setGlobeMaterial] = useState<THREE.Material | null>(null);
  const [moonMaterial, setMoonMaterial] = useState<THREE.Material | null>(null);
  const [sunMaterial, setSunMaterial] = useState<THREE.Material | null>(null);

  // Enable auto-rotation globally so that the Earth spins realistically on its axis
  useEffect(() => {
    if (globeRef.current && texturesLoaded) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = isRotating && !selectedSat;
        controls.autoRotateSpeed = 0.12; // slow, realistic rotation
        controls.minDistance = 110; // Prevent zooming inside Earth/Moon surface
        controls.maxDistance = 1600; // Allow zooming out much further to see Moon/Sun orbits in perspective
      }
      const camera = globeRef.current.camera();
      if (camera && (camera as any).isPerspectiveCamera) {
        (camera as any).far = 15000; // Prevent clipping of distant stars and orbiting bodies at wide zoom
        (camera as any).updateProjectionMatrix();
      }
    }
  }, [texturesLoaded, selectedSat, isRotating]);

  // Load default active layers on mount or target change
  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      setLoading(true);
      setError(null);
      setErrorDetails('');
      setSelectedSat(null);
      setSelectedSatLive(null);
      setPaths([]);
      setRings([]);
      
      if (observationTarget === 'moon') {
        // Load lunar satellites locally using their real catalog IDs
        const mockData = LUNAR_SATELLITES.map(s => {
          return {
            name: s.name,
            group: 'moon_sats',
            satrec: {
              satnum: s.id,
            },
            lat: 0,
            lng: 0,
            alt: s.altitude / 1737, // Moon radius is 1737km
            speed: Math.sqrt(4902.8 / (1737 + s.altitude)), // Moon orbital velocity
            lunarOrbit: s // store original specs for custom Keplerian propagation
          } as any;
        });

        if (active) {
          setLoadedSatellites({ moon_sats: mockData });
          setLoading(false);
        }
        return;
      }

      if (observationTarget === 'sun') {
        // Load solar probes locally using Keplerian propagation
        const mockData = SOLAR_PROBES.map(s => {
          return {
            name: s.name,
            group: 'solar_probes',
            satrec: {
              satnum: s.id,
            },
            lat: 0,
            lng: 0,
            alt: s.altitude / 100, // normalized size for solar orbit view
            speed: 45.8, // Solar escape/orbital speed scale
            lunarOrbit: s // reuse Keplerian specs
          } as any;
        });

        if (active) {
          setLoadedSatellites({ solar_probes: mockData });
          setLoading(false);
        }
        return;
      }
      
      try {
        const defaults = ['starlink', 'stations'];
        const loaded: Record<string, SatelliteData[]> = {};
        
        for (const dep of defaults) {
          const res = await fetchSatellitesByGroup(dep);
          if (!active) return;
          loaded[dep] = res.satellites;
          setDataSource(res.source);
          if (res.errorDetails) {
            setErrorDetails(res.errorDetails);
          }
        }
        
        setLoadedSatellites(loaded);
      } catch (e: any) {
        if (active) {
          setError(e.message || 'Could not establish satellite connection.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    
    initLoad().then(() => {
      if (active && globeRef.current) {
        globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
      }
    });
    return () => { active = false; };
  }, [observationTarget]);

  // Callback to toggle layer visibility and lazy-load data
  const toggleLayer = useCallback(async (groupId: string) => {
    const nextVal = !visibleLayers[groupId];
    
    // Clear selection if the selected satellite is in the group being hidden
    if (!nextVal && selectedSat && selectedSat.group === groupId) {
      setSelectedSat(null);
      setPaths([]);
      setRings([]);
    }

    setVisibleLayers(prev => ({ ...prev, [groupId]: nextVal }));
    
    if (nextVal && !loadedSatellites[groupId]) {
      setLoadingGroups(prev => ({ ...prev, [groupId]: true }));
      try {
        const res = await fetchSatellitesByGroup(groupId);
        setLoadedSatellites(prev => ({ ...prev, [groupId]: res.satellites }));
        setDataSource(res.source);
        if (res.errorDetails) {
          setErrorDetails(res.errorDetails);
        }
      } catch (e: any) {
        console.error(`Failed to load group ${groupId}:`, e);
      } finally {
        setLoadingGroups(prev => ({ ...prev, [groupId]: false }));
      }
    }
  }, [visibleLayers, loadedSatellites, selectedSat]);

  // Load 8K high-resolution Day and Night textures
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();
    console.log("Loading 8K planetary textures...");
    Promise.all([
      textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/Shriisoot/Planets-texture/8k_earth_daymap.jpg'),
      textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/Shriisoot/Planets-texture/8k_earth_nightmap.jpg'),
      textureLoader.loadAsync('https://vasturiano.github.io/react-globe.gl/example/moon-landing-sites/lunar_surface.jpg')
    ]).then(([dayTexture, nightTexture, moonTexture]) => {
      console.log("Planetary textures successfully loaded.");
      const mat = new THREE.MeshStandardMaterial({
        map: dayTexture,
        color: new THREE.Color('#1c2a38'), // Deep navy/slate desaturation to make it dark and atmospheric
        emissiveMap: nightTexture,
        emissive: new THREE.Color('#fcd34d'), // Warm golden city lights
        emissiveIntensity: 1.5, // Elegant city lights intensity
        roughness: 0.7,
        metalness: 0.1
      });
      setGlobeMaterial(mat);

      const moonMat = new THREE.MeshStandardMaterial({
        map: moonTexture,
        bumpMap: moonTexture,
        bumpScale: 0.15,
        roughness: 0.9,
        metalness: 0.05
      });
      setMoonMaterial(moonMat);

      // Procedurally generate highly detailed 3D Sun material
      const sunCanvas = document.createElement('canvas');
      sunCanvas.width = 256;
      sunCanvas.height = 128;
      const sCtx = sunCanvas.getContext('2d')!;
      sCtx.fillStyle = '#e65c00'; // Sun base orange
      sCtx.fillRect(0, 0, 256, 128);
      
      // Generate solar plasma turbulence
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 128;
        const r = 8 + Math.random() * 24;
        const grad = sCtx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255, 230, 0, 0.95)'); // Yellow hot spot
        grad.addColorStop(0.3, 'rgba(255, 110, 0, 0.7)');  // Orange plasma
        grad.addColorStop(0.6, 'rgba(230, 30, 0, 0.4)');   // Darker red filaments
        grad.addColorStop(1, 'rgba(230, 92, 0, 0)');
        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(x, y, r, 0, Math.PI * 2);
        sCtx.fill();
      }
      
      // Draw prominence arches
      sCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      sCtx.lineWidth = 1.5;
      for (let i = 0; i < 15; i++) {
        sCtx.beginPath();
        const x = Math.random() * 256;
        const y = Math.random() * 128;
        sCtx.arc(x, y, 10 + Math.random() * 15, 0, Math.PI * (0.5 + Math.random() * 1.5));
        sCtx.stroke();
      }
      
      const sunTex = new THREE.CanvasTexture(sunCanvas);
      const sunMat = new THREE.MeshBasicMaterial({ 
        map: sunTex,
        toneMapped: false
      });
      setSunMaterial(sunMat);
      setTexturesLoaded(true);
    }).catch(err => {
      console.error("Failed to load textures, using fallback material:", err);
      setTexturesLoaded(true);
    });
  }, []);



  // Setup custom scene lights, visual celestial bodies, and 3D starfield
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const scene = globe.scene();
    
    // Disable default lights
    scene.traverse((obj: any) => {
      if (obj.isLight && obj.name !== 'custom-sun' && obj.name !== 'custom-moon' && obj.name !== 'custom-ambient') {
        obj.intensity = 0;
      }
    });

    // Add ambient glow to dark side
    const ambientLight = new THREE.AmbientLight('#0f172a', 0.8);
    ambientLight.name = 'custom-ambient';
    scene.add(ambientLight);

    // Sun directional light (Space-accurate bright white light)
    const sunLight = new THREE.DirectionalLight('#ffffff', 4.0);
    sunLight.name = 'custom-sun';
    scene.add(sunLight);

    // Moon directional light
    const moonLight = new THREE.DirectionalLight('#c5d4eb', 0.4);
    moonLight.name = 'custom-moon';
    scene.add(moonLight);

    // Sun visual sphere (Detailed 3D Globe with procedural plasma texture and corona glow)
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 256;
    sunCanvas.height = 128;
    const sCtx = sunCanvas.getContext('2d')!;
    sCtx.fillStyle = '#e65c00'; // Sun base orange
    sCtx.fillRect(0, 0, 256, 128);
    
    // Generate solar plasma turbulence
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 128;
      const r = 8 + Math.random() * 24;
      const grad = sCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255, 230, 0, 0.95)'); // Yellow hot spot
      grad.addColorStop(0.3, 'rgba(255, 110, 0, 0.7)');  // Orange plasma
      grad.addColorStop(0.6, 'rgba(230, 30, 0, 0.4)');   // Darker red filaments
      grad.addColorStop(1, 'rgba(230, 92, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(x, y, r, 0, Math.PI * 2);
      sCtx.fill();
    }
    
    // Draw prominence arches
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    sCtx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      sCtx.beginPath();
      const x = Math.random() * 256;
      const y = Math.random() * 128;
      sCtx.arc(x, y, 10 + Math.random() * 15, 0, Math.PI * (0.5 + Math.random() * 1.5));
      sCtx.stroke();
    }
    
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    const sunMeshGeo = new THREE.SphereGeometry(22, 32, 32);
    const sunMeshMat = new THREE.MeshBasicMaterial({ 
      map: sunTex,
      toneMapped: false
    });
    const sunMesh = new THREE.Mesh(sunMeshGeo, sunMeshMat);
    sunMesh.name = 'sun-visual';
    
    // Create a radial gradient for the solar corona glow sprite
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = 64;
    coronaCanvas.height = 64;
    const cCtx = coronaCanvas.getContext('2d')!;
    const cGrad = cCtx.createRadialGradient(32, 32, 8, 32, 32, 32);
    cGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');  // Intense white core
    cGrad.addColorStop(0.2, 'rgba(255, 195, 0, 0.85)'); // Golden inner corona
    cGrad.addColorStop(0.6, 'rgba(255, 70, 0, 0.3)');   // Orange outer corona
    cGrad.addColorStop(1, 'rgba(255, 70, 0, 0)');
    cCtx.fillStyle = cGrad;
    cCtx.fillRect(0, 0, 64, 64);
    
    const coronaTex = new THREE.CanvasTexture(coronaCanvas);
    const coronaMat = new THREE.SpriteMaterial({
      map: coronaTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const coronaSprite = new THREE.Sprite(coronaMat);
    coronaSprite.scale.set(80, 80, 1.0); // extend glow beyond the 22 radius sphere
    coronaSprite.name = 'sun-corona';
    sunMesh.add(coronaSprite);
    
    scene.add(sunMesh);

    // Realistic Moon visual sphere using dynamic crater CanvasTexture
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 128;
    moonCanvas.height = 64;
    const mCtx = moonCanvas.getContext('2d')!;
    mCtx.fillStyle = '#7e838c'; // Base Lunar Grey
    mCtx.fillRect(0, 0, 128, 64);
    // Draw procedurally generated crater shadows for realistic lunar texture
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 64;
      const r = 2 + Math.random() * 6;
      const grad = mCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(40, 42, 46, 0.95)'); // Dark crater core
      grad.addColorStop(0.5, 'rgba(70, 74, 80, 0.7)');
      grad.addColorStop(0.8, 'rgba(180, 185, 195, 0.5)'); // Bright crater rim
      grad.addColorStop(1, 'rgba(126, 131, 140, 0)');
      mCtx.fillStyle = grad;
      mCtx.beginPath();
      mCtx.arc(x, y, r, 0, Math.PI * 2);
      mCtx.fill();
    }
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    const moonMeshGeo = new THREE.SphereGeometry(6, 24, 24);
    const moonMeshMat = new THREE.MeshStandardMaterial({ 
      map: moonTex,
      roughness: 0.9,
      metalness: 0.05
    });
    const moonMesh = new THREE.Mesh(moonMeshGeo, moonMeshMat);
    moonMesh.name = 'moon-visual';
    scene.add(moonMesh);

    // Add sharp 3D Starfield particles + Milky Way Galaxy Band
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 10000;
    const starsPositions = new Float32Array(starsCount * 3);
    const starsColors = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      const r = 800 + Math.random() * 2200; // Spaced from 800 to 3000 units to fully enclose the zoom space
      
      // Determine if this star belongs to the Milky Way central band
      const isMilkyWay = Math.random() < 0.45;
      let theta = Math.random() * Math.PI * 2;
      let phi = Math.acos(2 * Math.random() - 1);
      
      if (isMilkyWay) {
        // Constrain phi close to the equatorial galactic disk plane
        const galacticPlaneDev = (Math.random() - 0.5) * 0.12; 
        phi = Math.PI / 2 + galacticPlaneDev;
        // Introduce small noise in theta to keep it continuous
        theta = theta + (Math.random() - 0.5) * 0.05;
      }
      
      starsPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starsPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPositions[i + 2] = r * Math.cos(phi);
      
      // Add glowing space colors: Milky Way is purple/violet/deep blue, ambient stars are white/cyan
      if (isMilkyWay) {
        starsColors[i] = 0.65 + Math.random() * 0.35; // Red
        starsColors[i + 1] = 0.45 + Math.random() * 0.3; // Green
        starsColors[i + 2] = 0.95; // Blue
      } else {
        starsColors[i] = 0.9;
        starsColors[i + 1] = 0.95;
        starsColors[i + 2] = 1.0;
      }
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));
    
    // Smooth radial gradient circle for round stars
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(224, 231, 255, 0.9)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const starTex = new THREE.CanvasTexture(canvas);
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 3.5, // Increased size for rich visibility at distant zoom
      sizeAttenuation: true,
      map: starTex,
      vertexColors: true, // Enable custom colors for the galaxy band
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // Add central Sun corona sprite (only visible when observationTarget is 'sun')
    const centralCoronaCanvas = document.createElement('canvas');
    centralCoronaCanvas.width = 128;
    centralCoronaCanvas.height = 128;
    const ccCtx = centralCoronaCanvas.getContext('2d')!;
    const ccGrad = ccCtx.createRadialGradient(64, 64, 45, 64, 64, 64);
    ccGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');  // Bright center
    ccGrad.addColorStop(0.15, 'rgba(255, 210, 0, 0.9)'); // Golden corona
    ccGrad.addColorStop(0.4, 'rgba(255, 80, 0, 0.45)');  // Flare red
    ccGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ccCtx.fillStyle = ccGrad;
    ccCtx.fillRect(0, 0, 128, 128);
    
    const centralCoronaTex = new THREE.CanvasTexture(centralCoronaCanvas);
    const centralCoronaMat = new THREE.SpriteMaterial({
      map: centralCoronaTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const centralCoronaSprite = new THREE.Sprite(centralCoronaMat);
    centralCoronaSprite.scale.set(320, 320, 1.0); // Globe radius is 100, so diameter is 200. Corona is 320 to extend outside!
    centralCoronaSprite.name = 'central-sun-corona';
    centralCoronaSprite.visible = false;
    scene.add(centralCoronaSprite);

    // Save references to update on tick
    (globe as any)._customSunLight = sunLight;
    (globe as any)._customMoonLight = moonLight;
    (globe as any)._customSunMesh = sunMesh;
    (globe as any)._customMoonMesh = moonMesh;

    return () => {
      scene.remove(ambientLight);
      scene.remove(sunLight);
      scene.remove(moonLight);
      scene.remove(sunMesh);
      scene.remove(moonMesh);
      scene.remove(starField);
      scene.remove(centralCoronaSprite);
    };
  }, [texturesLoaded]);

  // Load clouds texture and create clouds mesh
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const scene = globe.scene();

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('https://unpkg.com/three-globe/example/img/earth-clouds.png', (cloudsTexture) => {
      // Create clouds sphere geometry slightly larger than the Earth (Earth radius in three-globe is 100)
      const cloudsGeo = new THREE.SphereGeometry(100.8, 64, 64);
      const cloudsMat = new THREE.MeshStandardMaterial({
        alphaMap: cloudsTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: '#ffffff',
        opacity: 0.35
      });
      const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      cloudsMesh.name = 'custom-clouds';
      scene.add(cloudsMesh);

      // Save ref to rotate in animation loop
      (globe as any)._customClouds = cloudsMesh;
    });

    return () => {
      const clouds = scene.getObjectByName('custom-clouds');
      if (clouds) scene.remove(clouds);
    };
  }, [texturesLoaded]);

  const isTimeFlowingRef = useRef(isTimeFlowing);
  const timeMultiplierRef = useRef(timeMultiplier);
  const observationTargetRef = useRef(observationTarget);

  useEffect(() => {
    isTimeFlowingRef.current = isTimeFlowing;
  }, [isTimeFlowing]);

  useEffect(() => {
    timeMultiplierRef.current = timeMultiplier;
  }, [timeMultiplier]);

  useEffect(() => {
    observationTargetRef.current = observationTarget;
  }, [observationTarget]);

  // Animation loop for clouds rotation and smooth simulated time updates
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let tickCount = 0;
    
    const animate = () => {
      const globe = globeRef.current;
      const nowMs = performance.now();
      const deltaSec = (nowMs - lastTime) / 1000;
      lastTime = nowMs;
      
      if (isTimeFlowingRef.current) {
        // Advance simulated time ref smoothly at 60 FPS
        simTimeRef.current = new Date(simTimeRef.current.getTime() + deltaSec * 1000 * timeMultiplierRef.current);
      }
      
      if (globe) {
        // Rotate and toggle clouds visibility based on target
        if (globe._customClouds) {
          const isEarth = observationTargetRef.current === 'earth';
          globe._customClouds.visible = isEarth;
          if (isEarth) {
            globe._customClouds.rotation.y += 0.00018;
            globe._customClouds.rotation.x += 0.00005;
          }
        }
        // Rotate the Sun visual sphere on its Y axis for plasma turbulence animation
        if (globe._customSunMesh) {
          globe._customSunMesh.rotation.y += 0.0008;
        }
      }

      // Throttle React state updates to 2 times per second to keep UI rendering low-cost
      tickCount++;
      if (tickCount % 30 === 0) {
        setSimTime(new Date(simTimeRef.current.getTime()));
      }
      
      animId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animId);
  }, [texturesLoaded]);

  const [selectedSatLive, setSelectedSatLive] = useState<SatelliteData | null>(null);

  // Update clock, Sun, Moon, and selected satellite telemetry based on simTime
  useEffect(() => {
    const now = isTimeFlowing ? simTime : (frozenTimeRef.current || new Date());
    setTime(now.toISOString().substring(11, 19));

    // Calculate and cache GMST once per frame/time update
    currentGmstRef.current = satellite.gstime(now);

    // Calculate and update Sun/Moon coordinates
    const sunCoord = getSunPosition(now);
    const moonCoord = getMoonPosition(now);
    const sunPos = sphericalToCartesian(sunCoord.lat, sunCoord.lng, 450);
    const moonPos = sphericalToCartesian(moonCoord.lat, moonCoord.lng, 400);

    // Store normalized Sun vector for shading calculations
    sunVectorRef.current.set(sunPos.x, sunPos.y, sunPos.z).normalize();

    const globe = globeRef.current;
    if (globe) {
      if (globe._customSunLight) globe._customSunLight.position.copy(sunPos);
      if (globe._customSunMesh) globe._customSunMesh.position.copy(sunPos);
      
      if (globe._customMoonLight) globe._customMoonLight.position.copy(moonPos);
      if (globe._customMoonMesh) globe._customMoonMesh.position.copy(moonPos);
    }

    // Propagate selected satellite for telemetry & paths
    if (selectedSat) {
      if ((observationTarget === 'moon' || observationTarget === 'sun') && (selectedSat as any).lunarOrbit) {
        const orbit = (selectedSat as any).lunarOrbit;
        const t = now.getTime() / 1000;
        const angle = (2 * Math.PI * t) / orbit.period + ((selectedSat as any).phase || 0);
        
        // In degrees:
        const lat = orbit.inclination * Math.sin(angle);
        const lng = ((angle * 180) / Math.PI) % 360;
        const alt = orbit.altitude;
        
        const scaleRadius = observationTarget === 'moon' ? 1737 : 100;
        const speedVal = observationTarget === 'moon' ? Math.sqrt(4902.8 / (1737 + alt)) : 45.8;

        setSelectedSatLive({
          ...selectedSat,
          lat,
          lng,
          alt: alt / scaleRadius,
          speed: speedVal
        });
      } else if (selectedSat.satrec) {
        const gmst = satellite.gstime(now);
        const posVel = satellite.propagate(selectedSat.satrec, now);
        if (posVel && posVel.position && typeof posVel.position !== 'boolean') {
          const gd = satellite.eciToGeodetic(posVel.position, gmst);
          const lat = satellite.degreesLat(gd.latitude);
          const lng = satellite.degreesLong(gd.longitude);
          const alt = gd.height / EARTH_RADIUS_KM;

          let speed = 0;
          if (posVel && posVel.velocity && typeof posVel.velocity !== 'boolean') {
            speed = Math.sqrt(
              posVel.velocity.x * posVel.velocity.x +
              posVel.velocity.y * posVel.velocity.y +
              posVel.velocity.z * posVel.velocity.z
            );
          }

          setSelectedSatLive({
            ...selectedSat,
            lat,
            lng,
            alt,
            speed
          });
        }
      }
    } else {
      setSelectedSatLive(null);
    }
  }, [simTime, selectedSat, isTimeFlowing, observationTarget]);

  // Setup initial positions and paths when satellites are loaded or toggled
  useEffect(() => {
    if (!satellites.length) {
      setPositions([]);
      setPaths([]);
      setRings([]);
      setLabels([]);
      return;
    }

    const now = frozenTimeRef.current || new Date();
    const gmst = satellite.gstime(now);
    const initialPos: SatelliteData[] = [];

    for (let i = 0; i < satellites.length; i++) {
      const s = satellites[i];
      if (!s.satrec) continue;
      const posVel = satellite.propagate(s.satrec, now);
      if (posVel && posVel.position && typeof posVel.position !== 'boolean') {
        const gd = satellite.eciToGeodetic(posVel.position, gmst);
        initialPos.push({
          ...s,
          lat: satellite.degreesLat(gd.latitude),
          lng: satellite.degreesLong(gd.longitude),
          alt: gd.height / EARTH_RADIUS_KM
        });
      }
    }

    setPositions(initialPos);

    // Compute static/initial Laser links if Starlink is visible
    const newPaths: any[] = [];
    if (showLaserLinks && visibleLayers.starlink && initialPos.length > 30) {
      const starlinks = initialPos.filter(s => s.group === 'starlink');
      const sorted = [...starlinks].sort((a, b) => (a.lng || 0) - (b.lng || 0));
      let laserCount = 0;
      
      for (let i = 0; i < sorted.length; i++) {
        const s1 = sorted[i];
        if (s1.lat === undefined || s1.lng === undefined) continue;
        for (let j = i + 1; j < Math.min(i + 8, sorted.length); j++) {
          const s2 = sorted[j];
          if (s2.lat === undefined || s2.lng === undefined) continue;
          
          const latDiff = Math.abs(s1.lat - s2.lat);
          const lngDiff = Math.abs(s1.lng - s2.lng);
          const actualLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
          
          if (latDiff < 5.5 && actualLngDiff < 5.5) {
            newPaths.push({
              coords: [
                [s1.lat, s1.lng, s1.alt || 0.1],
                [s2.lat, s2.lng, s2.alt || 0.1]
              ],
              isNadir: false,
              isLaser: true
            });
            laserCount++;
            if (laserCount >= 300) break; // Limit to 300 links to keep rendering fast
          }
        }
        if (laserCount >= 300) break;
      }
    }

    setPaths(newPaths);
    setRings([]);
    setLabels([]);
  }, [satellites, showLaserLinks, visibleLayers]);

  // Update paths (orbits, nadir beams, labels) when selected satellite or its live position changes
  useEffect(() => {
    const newPaths: any[] = [];
    const newRings: any[] = [];
    const newLabels: any[] = [];

    // Keep the laser links if computed
    const laserPaths = paths.filter(p => p.isLaser);
    newPaths.push(...laserPaths);

    if (selectedSatLive) {
      // Label
      newLabels.push({
        lat: selectedSatLive.lat,
        lng: selectedSatLive.lng,
        text: selectedSatLive.name
      });

      // Orbit Path
      if (showSelectedOrbit) {
        if ((observationTarget === 'moon' || observationTarget === 'sun') && (selectedSatLive as any).lunarOrbit) {
          const orbit = (selectedSatLive as any).lunarOrbit;
          const pathPoints: [number, number, number][] = [];
          const scaleRadius = observationTarget === 'moon' ? 1737 : 100;
          
          for (let j = 0; j <= 360; j += 4) {
            const angle = (j * Math.PI) / 180;
            const lat = orbit.inclination * Math.sin(angle);
            const lng = j;
            const alt = orbit.altitude / scaleRadius;
            pathPoints.push([lat, lng, alt]);
          }

          newPaths.push({
            coords: pathPoints,
            isNadir: false,
            isLaser: false,
            isFutureOrbit: true
          });
        } else if (selectedSatLive.satrec) {
          const now = frozenTimeRef.current || new Date();
          const pathPointsPast: [number, number, number][] = [];
          const pathPointsFuture: [number, number, number][] = [];
          
          // Calculate orbit (past 45m and future 45m)
          for (let i = -45; i <= 45; i += 1.5) {
            const futureDate = new Date(now.getTime() + i * 60000);
            const futureGmst = satellite.gstime(futureDate);
            const posVel = satellite.propagate(selectedSatLive.satrec, futureDate);
            
            if (posVel && posVel.position && typeof posVel.position !== 'boolean') {
              const posGd = satellite.eciToGeodetic(posVel.position, futureGmst);
              const pt: [number, number, number] = [
                satellite.degreesLat(posGd.latitude),
                satellite.degreesLong(posGd.longitude),
                posGd.height / EARTH_RADIUS_KM
              ];
              if (i <= 0) {
                pathPointsPast.push(pt);
              } else {
                pathPointsFuture.push(pt);
              }
            }
          }

          if (pathPointsPast.length > 0) {
            newPaths.push({
              coords: pathPointsPast,
              isNadir: false,
              isLaser: false,
              isPastOrbit: true
            });
          }
          if (pathPointsFuture.length > 0) {
            newPaths.push({
              coords: pathPointsFuture,
              isNadir: false,
              isLaser: false,
              isFutureOrbit: true
            });
          }
        }
      }

      // Nadir Beam
      newPaths.push({
        coords: [
          [selectedSatLive.lat, selectedSatLive.lng, selectedSatLive.alt || 0.1],
          [selectedSatLive.lat, selectedSatLive.lng, 0.005]
        ],
        isNadir: true,
        isLaser: false
      });

      // Footprint Ring
      if (showSelectedFootprint) {
        newRings.push({
          lat: selectedSatLive.lat,
          lng: selectedSatLive.lng,
          maxR: 15,
          propagationSpeed: 0,
          repeatPeriod: 0
        });
      }
    }

    setPaths(newPaths);
    setRings(newRings);
    setLabels(newLabels);
  }, [selectedSatLive, showSelectedOrbit, showSelectedFootprint]);

  // Adjust camera to focus on selected satellite when clicked
  useEffect(() => {
    if (selectedSat && selectedSat.lat !== undefined && globeRef.current) {
      const currentAltitude = globeRef.current.pointOfView().altitude;
      globeRef.current.pointOfView({
        lat: selectedSat.lat,
        lng: selectedSat.lng,
        altitude: currentAltitude > 2.5 ? 2.0 : currentAltitude
      }, 1000);
    }
  }, [selectedSat]);

  // Swap the orbiting celestial body's texture between Earth and Moon based on observationTarget
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const scene = globe.scene();
    if (!scene) return;

    // Toggle central sun corona visibility
    const centralCorona = scene.getObjectByName('central-sun-corona');
    if (centralCorona) {
      centralCorona.visible = observationTarget === 'sun';
    }

    // Toggle orbiting sun visual visibility (cannot orbit itself)
    const sunVisual = scene.getObjectByName('sun-visual');
    if (sunVisual) {
      sunVisual.visible = observationTarget !== 'sun';
    }

    const bodyMesh = scene.getObjectByName('moon-visual') as THREE.Mesh;
    if (bodyMesh) {
      const loader = new THREE.TextureLoader();
      if (observationTarget === 'moon' || observationTarget === 'sun') {
        // The orbiting body is now the Earth! Load Earth texture and scale up.
        bodyMesh.scale.set(3.6, 3.6, 3.6);
        loader.load('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg', (tex) => {
          bodyMesh.material = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.4,
            metalness: 0.1
          });
        });
      } else {
        // The orbiting body is now the Moon! Restore procedural Moon texture and normal scale.
        bodyMesh.scale.set(1.0, 1.0, 1.0);
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width = 128;
        moonCanvas.height = 64;
        const mCtx = moonCanvas.getContext('2d')!;
        mCtx.fillStyle = '#7e838c';
        mCtx.fillRect(0, 0, 128, 64);
        for (let i = 0; i < 40; i++) {
          const x = Math.random() * 128;
          const y = Math.random() * 64;
          const r = 2 + Math.random() * 6;
          const grad = mCtx.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, 'rgba(40, 42, 46, 0.95)');
          grad.addColorStop(0.5, 'rgba(70, 74, 80, 0.7)');
          grad.addColorStop(0.8, 'rgba(180, 185, 195, 0.5)');
          grad.addColorStop(1, 'rgba(126, 131, 140, 0)');
          mCtx.fillStyle = grad;
          mCtx.beginPath();
          mCtx.arc(x, y, r, 0, Math.PI * 2);
          mCtx.fill();
        }
        const moonTex = new THREE.CanvasTexture(moonCanvas);
        bodyMesh.material = new THREE.MeshStandardMaterial({
          map: moonTex,
          roughness: 0.9,
          metalness: 0.05
        });
      }
    }
  }, [observationTarget, texturesLoaded]);

  // Click handler to switch target when clicking on the orbiting celestial body directly in the sky
  useEffect(() => {
    const handleCanvasClick = (e: MouseEvent) => {
      const globe = globeRef.current;
      if (!globe) return;
      
      const container = document.querySelector('.scene-container');
      if (!container) return;
      
      // Calculate normalized mouse coordinates
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      const camera = globe.camera();
      const scene = globe.scene();
      
      if (camera && scene) {
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const bodyMesh = scene.getObjectByName('moon-visual');
        if (bodyMesh) {
          const intersects = raycaster.intersectObject(bodyMesh);
          if (intersects.length > 0) {
            // Clicked the orbiting body! Swap targets!
            setObservationTarget(prev => prev === 'earth' ? 'moon' : 'earth');
          }
        }
      }
    };

    window.addEventListener('click', handleCanvasClick);
    return () => window.removeEventListener('click', handleCanvasClick);
  }, []);

  // Dynamically update camera focus to follow selected satellite along its orbit path
  useEffect(() => {
    if (selectedSatLive && followSelected && globeRef.current) {
      if (selectedSatLive.lat !== undefined) {
        const currentPOV = globeRef.current.pointOfView();
        globeRef.current.pointOfView({
          lat: selectedSatLive.lat,
          lng: selectedSatLive.lng,
          altitude: currentPOV.altitude
        }, 800);
      }
    }
  }, [selectedSatLive, followSelected]);

  // Real-time space debris collision check for ISS (Space Station)
  useEffect(() => {
    const getKMDistance = (s1: any, s2: any) => {
      if (s1.lat === undefined || s2.lat === undefined) return Infinity;
      const phi1 = (s1.lat * Math.PI) / 180;
      const theta1 = (s1.lng * Math.PI) / 180;
      const r1 = EARTH_RADIUS_KM + (s1.alt || 0.1) * EARTH_RADIUS_KM;

      const phi2 = (s2.lat * Math.PI) / 180;
      const theta2 = (s2.lng * Math.PI) / 180;
      const r2 = EARTH_RADIUS_KM + (s2.alt || 0.1) * EARTH_RADIUS_KM;

      const x1 = r1 * Math.cos(phi1) * Math.sin(theta1);
      const y1 = r1 * Math.sin(phi1);
      const z1 = r1 * Math.cos(phi1) * Math.cos(theta1);

      const x2 = r2 * Math.cos(phi2) * Math.sin(theta2);
      const y2 = r2 * Math.sin(phi2);
      const z2 = r2 * Math.cos(phi2) * Math.cos(theta2);

      return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);
    };

    const checkCollision = () => {
      const iss = positions.find(s => s.name.toUpperCase().includes('ISS'));
      if (!iss) {
        setCollisionWarning(null);
        return;
      }
      
      const debris = positions.filter(s => s.group && s.group.startsWith('debris'));
      if (!debris.length) {
        setCollisionWarning(null);
        return;
      }
      
      let closestDebris = null;
      let minDist = Infinity;
      
      for (const d of debris) {
        const dist = getKMDistance(iss, d);
        if (dist < minDist) {
          minDist = dist;
          closestDebris = d;
        }
      }

      // Show real close-approach alerts based on propagated orbits
      if (minDist < 500 && closestDebris) {
        setCollisionWarning(
          `⚠️ CRITICAL COLLISION RISK: ISS vs ${closestDebris.name} | Close Approach: ${minDist.toFixed(1)} km`
        );
      } else if (minDist < 2000 && closestDebris) {
        setCollisionWarning(
          `🚨 CLOSE APPROACH MONITORING: ISS vs ${closestDebris.name} | Distance: ${minDist.toFixed(1)} km`
        );
      } else {
        setCollisionWarning(null); // No close approach, hide the banner to keep data 100% genuine
      }
    };

    checkCollision();
    const interval = setInterval(checkCollision, 5000);
    return () => clearInterval(interval);
  }, [positions]);

  // Filter based on search query
  const filteredSatellites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return positions;
    return positions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.satrec && s.satrec.satnum !== undefined && String(s.satrec.satnum).includes(query))
    );
  }, [positions, searchQuery]);

  // Return a custom ThreeJS Mesh based on satellite classification (glowing models)
  const getSatObject = useCallback((d: any) => {
    const isSelected = selectedSat && d.name === selectedSat.name;
    const isSearched = searchQuery ? d.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    
    // Vibrant colors matching the reference image and group layers
    const groupColorMap: Record<string, string> = {
      stations: '#fbbf24',
      gps: '#22c55e',
      glonass: '#84cc16',
      galileo: '#06b6d4',
      weather: '#ec4899',
      oneweb: '#a855f7',
      starlink: '#ffffff', // White Starlink
      brightest: '#ffffff',
      debris_cosmos: '#f43f5e',
      debris_iridium: '#fb923c',
      debris_fengyun: '#ef4444',
      geo: '#64748b'
    };
    
    let color = (d.group && groupColorMap[d.group]) || '#ffffff'; // Default to white
    const opacity = isSearched ? 1.0 : 0.12;
    
    const group = new THREE.Group();
    group.name = 'satellite-mesh';
    group.userData = { 
      phase: Math.random() * 100,
      isSelected,
      satrec: d.satrec
    };

    // 1. Visual dot (represented as a self-luminous glowing sprite)
    const visualColor = isSelected ? '#ffffff' : color;
    const spriteMat = getSharedSpriteMaterial(visualColor, opacity);
    const sprite = new THREE.Sprite(spriteMat);
    // Scale the sprite size to make it look like a sharp, distinct glowing dot
    const size = isSelected ? 4.5 : 2.0;
    sprite.scale.set(size, size, 1.0);
    group.add(sprite);

    // Dynamic scaling (Selected dot is larger and pulses more strongly)
    const baseScale = isSelected ? 0.35 : 0.16;
    group.scale.set(baseScale, baseScale, baseScale);    // We update staggered based on dynamic frame interval
    // We use a random offset so that satellites are distributed evenly across frames
    const frameOffset = Math.floor(Math.random() * 180);
    let frameCount = frameOffset;

    group.onBeforeRender = () => {
      frameCount++;
      
      // Determine update rate dynamically based on time multiplier to keep motion smooth
      const mult = timeMultiplierRef.current;
      let updateInterval = 120; // 2 seconds between updates in real time
      if (mult > 60) updateInterval = 10;
      else if (mult > 10) updateInterval = 40;
      
      if (observationTargetRef.current === 'moon') {
        updateInterval = 4; // Lunar updates
      }

      if (isSelected) {
        updateInterval = 1; // Selected satellite moves smoothly at 60 FPS
      }

      // Update position once every updateInterval frames
      if (frameCount % updateInterval === 0 && isTimeFlowingRef.current) {
        if (observationTargetRef.current === 'moon' && d.lunarOrbit) {
          // Keplerian lunar propagation
          const orbit = d.lunarOrbit;
          const now = simTimeRef.current;
          const t = now.getTime() / 1000; // time in seconds
          
          // Calculate angle based on period
          const angle = (2 * Math.PI * t) / orbit.period + group.userData.phase;
          const phi = (orbit.inclination * Math.PI) / 180;
          const r = 100 * (1 + orbit.altitude / 1737); // Globe radius is 100
          
          // Polar coordinates rotation
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle) * Math.cos(phi);
          const z = r * Math.sin(angle) * Math.sin(phi);
          
          group.position.set(x, y, z);
        } else if (group.userData.satrec) {
          // Earth TLE propagation
          const now = simTimeRef.current;
          const gmst = currentGmstRef.current; // Use cached GMST to avoid redundant calculations
          const posVel = satellite.propagate(group.userData.satrec, now);
          
          if (posVel && posVel.position && typeof posVel.position !== 'boolean') {
            const gd = satellite.eciToGeodetic(posVel.position, gmst);
            const lng = satellite.degreesLong(gd.longitude);
            const alt = gd.height / EARTH_RADIUS_KM;
            
            // Convert spherical (lat, lng, alt) to Cartesian (x, y, z)
            const phi = gd.latitude; // already in radians
            const theta = (lng * Math.PI) / 180;
            const r = 100 * (1 + alt); // Globe radius is 100
            
            const x = r * Math.cos(phi) * Math.sin(theta);
            const y = r * Math.sin(phi);
            const z = r * Math.cos(phi) * Math.cos(theta);
            
            group.position.set(x, y, z);
          }
        }
      }

      // Pulse & Twinkle animation
      const time = Date.now() * 0.0035;
      const phase = group.userData?.phase || 0;
      const pulse = 1.0 + Math.sin(time * 0.8 + phase) * (isSelected ? 0.45 : 0.3);
      
      let shadowFactor = 1.0;
      if (sunVectorRef.current) {
        const satVec = new THREE.Vector3().copy(group.position).normalize();
        const dot = satVec.dot(sunVectorRef.current);
        if (dot < -0.35) {
          shadowFactor = 0.45;
        }
      }
      
      const twinkleTime = Date.now() * 0.007; // faster speed for twinkling/blinking
      const twinkle = isSelected ? 1.0 : (0.75 + Math.sin(twinkleTime * 1.6 + phase * 2.5) * 0.45);
      
      const finalScale = baseScale * pulse * shadowFactor * twinkle;
      group.scale.set(finalScale, finalScale, finalScale);
    };

    return group;
  }, [selectedSat, searchQuery, isTimeFlowing]);

  const satrec = selectedSat?.satrec;
  const tleDateString = satrec ? getTleEpochDate(satrec) : 'TLE 2026-07-20 00:00:00 UTC';

  return (
    <div className="absolute inset-0 bg-[#0e131f] flex overflow-hidden">
      {/* Landing Page Center Dashboard Overlay */}
      <div 
        className={`fixed inset-0 bg-[#0e131f]/75 backdrop-blur-md flex items-center justify-center z-30 transition-all duration-700 ease-in-out pointer-events-auto p-4 sm:p-6 md:p-8 overflow-y-auto ${
          showLanding ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-5xl bg-slate-950/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)] flex flex-col md:flex-row overflow-hidden max-h-[90vh] md:max-h-[85vh]">
          {/* Left Column: Branding, Status, and CTA */}
          <div className="w-full md:w-[42%] p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 bg-slate-950/40">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <div className="flex items-center gap-2 mb-3">
                  <img src={logoImg} alt="Orbitim Logo" className="h-16 w-auto drop-shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse" />
                  <div>
                    <div className="flex items-center gap-1 text-[8px] text-blue-400 font-black tracking-widest uppercase">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> Live Telemetry Grid
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white leading-none uppercase mt-0.5">
                      ORBITIM <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">3D</span>
                    </h1>
                  </div>
                </div>
                <p className="text-white/60 text-xs leading-relaxed max-w-sm mt-1">
                  Earth's orbital shell is crowded. Orbitim 3D dynamically propagates and visualizes satellite systems, constellation pathways, and space debris in real-time.
                </p>
              </div>

              {/* Graphic Banner */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-blue-500/20 shadow-lg group hidden sm:block">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />
                <img 
                  src={starlinkImg} 
                  alt="Starlink Satellite Render" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute bottom-2.5 left-3 z-20 font-mono text-[8px] text-blue-400 space-y-0.5">
                  <div className="text-white/80 font-sans text-xs font-bold uppercase tracking-wide">Starlink v2.0 Array</div>
                  <div>ALTITUDE: ~550 KM | SPEED: ~7.6 KM/S</div>
                </div>
              </div>

              {/* Tech Spec tags */}
              <div className="space-y-2">
                <span className="text-[9px] text-white/30 font-bold tracking-widest uppercase">Telemetry Specs</span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-md">SGP4 PROPAGATOR</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md">CELESTRAK LIVE FEEDS</span>
                  <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-md">THREEJS / WEBGL</span>
                  <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-md">LUNAR PROPAGATION</span>
                </div>
              </div>
            </div>

            {/* Launch Action */}
            <div className="pt-6 border-t border-white/5 mt-6 md:mt-0">
              <button
                onClick={() => setShowLanding(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 text-white font-bold text-xs tracking-widest uppercase py-3.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer group active:translate-y-0"
              >
                <Play className="h-3.5 w-3.5 fill-white group-hover:scale-110 transition-transform" />
                Launch Telemetry Matrix
              </button>
            </div>
          </div>

          {/* Right Column: Capabilities details list */}
          <div className="w-full md:w-[58%] p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-slate-950/20">
            <div className="space-y-4">
              <div className="border-b border-white/5 pb-3">
                <span className="text-[10px] text-blue-400 font-black tracking-widest uppercase">System Capabilities</span>
                <h2 className="text-lg font-bold text-white uppercase mt-0.5">Implemented Core Modules</h2>
              </div>

              {/* Scrollable list of feature cards */}
              <div className="space-y-3 pr-1 max-h-[45vh] md:max-h-[58vh] overflow-y-auto custom-scrollbar">
                {/* SGP4 Physics Engine */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-blue-500/20 transition-all">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-105 transition-transform">
                    <Cpu className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">SGP4 Orbital Propagator (60 FPS)</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Computes precise real-time positions and velocities locally on the GPU/CPU using live TLE (Two-Line Element) satellite data feeds.
                    </p>
                  </div>
                </div>

                {/* Constellation Filters */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-105 transition-transform">
                    <Layers className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Multi-Constellation Layers</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Filter over 12,000 active objects including GPS, GLONASS, Galileo, Weather grids, OneWeb, and Space Debris fields.
                    </p>
                  </div>
                </div>

                {/* Target Locking */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-purple-500/20 transition-all">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg group-hover:scale-105 transition-transform">
                    <Compass className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Telemetry Locking & Signal Footprints</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Click any satellite to track details, render 3D footprint cones, project past/future orbit paths, and visualize nadir downlink streams.
                    </p>
                  </div>
                </div>

                {/* Lunar Orbit Observation */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-105 transition-transform">
                    <GlobeIcon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Lunar Keplerian observation</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Toggle observation targets to view custom-propagated Lunar orbiters, including LRO, Danuri, Chandrayaan-2, and Queqiao relay networks.
                    </p>
                  </div>
                </div>

                {/* Starlink Laser ISL */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-cyan-500/20 transition-all">
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg group-hover:scale-105 transition-transform">
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Starlink Laser Mesh (ISL)</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Simulate and visualize inter-satellite laser links (ISL) connecting active Starlink fleets dynamically as they orbit.
                    </p>
                  </div>
                </div>

                {/* Proximity & Collision Guard */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-red-500/20 transition-all">
                  <div className="p-2 bg-red-500/10 text-red-400 rounded-lg group-hover:scale-105 transition-transform">
                    <ShieldAlert className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Autonomic Collision Guard</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Runs background scans of distance vectors between active orbits, flagging potential close approach encounters and collision alerts.
                    </p>
                  </div>
                </div>

                {/* Time Warp Engine */}
                <div className="group flex gap-3.5 items-start bg-white/3 hover:bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-pink-500/20 transition-all">
                  <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg group-hover:scale-105 transition-transform">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Time Warp & Playback Engine</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Warp time flow up to 300x acceleration to inspect orbit progression, pause simulation to lock vectors, or synchronize back to real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Sources */}
            <div className="text-[9px] text-gray-500 font-mono border-t border-white/5 pt-3.5 mt-4 text-center md:text-left flex flex-col sm:flex-row justify-between gap-2">
              <span>DATA SOURCES: CELESTRAK (TLE) · NASA BLUE MARBLE</span>
              <span>SGP4 ALGORITHMS (SATELLITE.JS)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {(loading || !texturesLoaded) && !showLanding && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white z-20 backdrop-blur-md transition-all duration-500">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-400 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <span className="text-xl font-light tracking-widest text-blue-300">ESTABLISHING TELEMETRY LINKS...</span>
          <span className="text-xs text-white/40 mt-2 font-mono uppercase">Fetching orbit vectors...</span>
        </div>
      )}

      {error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-400 bg-red-950/70 backdrop-blur-md p-6 rounded-2xl border border-red-800/40 z-20 max-w-md shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-900/50 rounded-lg text-red-400">
              <Info className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Network Connection Error</h2>
          </div>
          <p className="text-sm text-white/70 leading-relaxed mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-red-900 hover:bg-red-800 text-white text-sm py-2 px-4 rounded-xl transition-all font-medium"
          >
            Retry Telemetry Link
          </button>
        </div>
      )}

      {/* Left panel - controls & search (With smooth slide-in transition) */}
      <div 
        className={`absolute top-6 left-6 z-10 w-80 pointer-events-none hidden md:flex flex-col gap-4 transition-all duration-1000 ease-in-out ${
          showLanding || loading ? '-translate-x-[360px] opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        {/* Title Header with Cyber Logo */}
        <div className="bg-[#111622]/85 backdrop-blur-lg border border-white/10 p-4 rounded-xl text-white shadow-2xl pointer-events-auto flex items-center gap-3">
          <img src={logoImg} alt="Orbitim Logo" className="h-10 w-auto drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">ORBITIM 3D</h1>
            <p className="text-blue-400 text-[8px] font-bold tracking-widest uppercase">Satellite Telemetry Array</p>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-white/30 font-mono">TIME (UTC)</div>
            <div className="text-sm font-mono text-blue-300 tracking-wider">{time}</div>
          </div>
        </div>

        {/* Observation Target Selector */}
        <div className="bg-[#111622]/85 backdrop-blur-lg border border-white/10 p-3 rounded-xl text-white shadow-2xl pointer-events-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Observation Target</span>
          </div>
          <div className="flex items-center bg-slate-950/60 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => setObservationTarget('earth')}
              className={`text-[9px] font-mono font-bold px-3 py-1 rounded-md transition-all ${
                observationTarget === 'earth' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white/70'
              }`}
            >
              EARTH
            </button>
            <button
              onClick={() => setObservationTarget('moon')}
              className={`text-[9px] font-mono font-bold px-3 py-1 rounded-md transition-all ${
                observationTarget === 'moon' ? 'bg-purple-600 text-white shadow' : 'text-white/40 hover:text-white/70'
              }`}
            >
              MOON
            </button>
            <button
              onClick={() => setObservationTarget('sun')}
              className={`text-[9px] font-mono font-bold px-3 py-1 rounded-md transition-all ${
                observationTarget === 'sun' ? 'bg-amber-600 text-white shadow' : 'text-white/40 hover:text-white/70'
              }`}
            >
              SUN
            </button>
          </div>
        </div>

        {/* Search Panel (Matching the requested style) */}
        <div className="bg-[#111622]/90 backdrop-blur-lg border border-blue-500/50 px-4 py-2.5 rounded-lg text-white shadow-2xl pointer-events-auto flex items-center gap-3 w-full transition-colors focus-within:border-blue-400">
          <Search className="h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search satellite or NORAD id..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-0 outline-none text-xs w-full placeholder-slate-500 text-slate-300 font-mono"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Layers Panel (Matching the requested style) */}
        <div className="bg-[#111622]/85 backdrop-blur-lg border border-white/10 p-5 rounded-2xl text-white shadow-2xl pointer-events-auto flex flex-col gap-4">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Layers</span>
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {observationTarget === 'moon' ? (
              <button
                className="text-left text-xs py-2.5 px-3.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-white font-medium flex items-center justify-between pointer-events-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7] animate-pulse" />
                  <span>Lunar Satellites</span>
                </div>
                <span className="text-[10px] font-mono text-purple-300 font-bold">{LUNAR_SATELLITES.length} ACTIVE</span>
              </button>
            ) : observationTarget === 'sun' ? (
              <button
                className="text-left text-xs py-2.5 px-3.5 rounded-xl bg-amber-600/10 border border-amber-500/20 text-white font-medium flex items-center justify-between pointer-events-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse" />
                  <span>Solar Probes</span>
                </div>
                <span className="text-[10px] font-mono text-amber-300 font-bold">{SOLAR_PROBES.length} ACTIVE</span>
              </button>
            ) : (
              GROUPS.map((g) => {
                const isEnabled = visibleLayers[g.id];
                const isLoading = loadingGroups[g.id];
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleLayer(g.id)}
                    className={`text-left text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-between pointer-events-auto ${
                      isEnabled
                        ? 'bg-blue-600/10 text-white border border-blue-500/20 font-medium'
                        : 'bg-white/2 border border-transparent text-white/40 hover:text-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span 
                        className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                          isEnabled ? 'shadow-[0_0_8px_currentColor]' : 'opacity-25'
                        }`} 
                        style={{ 
                          backgroundColor: g.color,
                          color: g.color
                        }} 
                      />
                      <span className="truncate">{g.name}</span>
                    </div>
                    <span className="text-[10px] font-mono flex items-center gap-1.5">
                      {isLoading ? (
                        <span className="w-2 h-2 border-t-2 border-r-2 border-white rounded-full animate-spin" />
                      ) : (
                        isEnabled 
                          ? (loadedSatellites[g.id]?.length ?? g.count).toLocaleString() 
                          : g.count.toLocaleString()
                      )}
                  </span>
                </button>
              );
            }))}
          </div>

          {/* Laser Links Toggle */}
          {visibleLayers.starlink && (
            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs pointer-events-auto">
              <span className="text-white/60">Laser Links (ISL)</span>
              <button 
                onClick={() => setShowLaserLinks(!showLaserLinks)}
                className={`w-9 h-5 rounded-full transition-all relative ${
                  showLaserLinks ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span 
                  className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${
                    showLaserLinks ? 'left-[18px]' : 'left-[2px]'
                  }`} 
                />
              </button>
            </div>
          )}
          
          <div className="text-[8px] text-gray-500 font-mono border-t border-white/5 pt-3 text-center leading-relaxed">
            TLE CelesTrak · SGP4 satellite.js · Imagery NASA Blue Marble
          </div>
        </div>
      </div>

      {/* Right panel - Telemetry Readout (With smooth slide-in transition) */}
      <div 
        className={`absolute top-6 right-6 z-10 w-80 pointer-events-none hidden md:flex flex-col gap-4 transition-all duration-1000 ease-in-out ${
          showLanding || loading ? 'translate-x-[360px] opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        {/* Array Stats */}
        <div className="bg-black/50 backdrop-blur-lg border border-white/10 p-5 rounded-2xl text-white shadow-2xl pointer-events-auto">
          <h3 className="text-xs font-bold tracking-widest text-white/40 uppercase mb-3 flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-blue-400" /> Array Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-white/40 uppercase">Observed</div>
              <div className="text-2xl font-light font-mono text-blue-300">{satellites.length}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase">Filtered</div>
              <div className="text-2xl font-light font-mono text-emerald-400">
                {filteredSatellites.length}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-white/5 space-y-1 text-[10px] font-mono text-white/40">
            <div className="flex justify-between">
              <span>DATA SOURCE:</span>
              <span className={`font-bold ${
                dataSource === 'live' ? 'text-green-400' :
                dataSource === 'cache' ? 'text-blue-400' :
                dataSource === 'local_fallback' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {dataSource.toUpperCase().replace('_', ' ')}
              </span>
            </div>
            {errorDetails && (
              <div className="text-red-400/80 text-[9px] uppercase leading-tight pt-1">
                API LIMIT: {errorDetails}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1 text-[9px] text-white/30">
              <div>LIVE SIMULATION ACTIVE</div>
              <div>SATS IN MEMORY: {satellites.length}</div>
              <div>FILTERED SATS: {filteredSatellites.length}</div>
              {satellites[0] && (
                <div className="truncate">
                  TEST ({satellites[0].name.trim()}): LAT={satellites[0].lat?.toFixed(2) ?? 'UNDEF'} LNG={satellites[0].lng?.toFixed(2) ?? 'UNDEF'} ALT={satellites[0].alt?.toFixed(3) ?? 'UNDEF'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Target Locked Panel */}
        {selectedSat && selectedSat.lat !== undefined && (
          <div className="bg-[#111622]/95 backdrop-blur-lg border border-white/10 p-5 rounded-2xl text-white shadow-2xl pointer-events-auto w-80 relative flex flex-col gap-4">
            {/* Header info */}
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                  {(selectedSat.group || 'SATELLITE').toUpperCase()}
                </span>
                <button 
                  onClick={() => setSelectedSat(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-xl font-bold truncate tracking-tight mt-1">
                {selectedSat.name}
              </h2>
              <span className="text-[10px] text-slate-500 font-mono">
                NORAD {satrec ? satrec.satnum : '00000'}
              </span>
            </div>

            {/* Grid Layout of parameters */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">ALTITUDE</span>
                <span className="text-sm font-mono text-white mt-1">
                  {Math.round((selectedSat.alt ?? 0) * EARTH_RADIUS_KM).toFixed(1)} km
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">SPEED</span>
                <span className="text-sm font-mono text-white mt-1">
                  {(selectedSat.speed ?? 0).toFixed(2)} km/s
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">LATITUDE</span>
                <span className="text-sm font-mono text-white mt-1">
                  {Math.abs(selectedSat.lat ?? 0).toFixed(2)}° {(selectedSat.lat ?? 0) >= 0 ? 'N' : 'S'}
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">LONGITUDE</span>
                <span className="text-sm font-mono text-white mt-1">
                  {Math.abs(selectedSat.lng ?? 0).toFixed(2)}° {(selectedSat.lng ?? 0) >= 0 ? 'E' : 'W'}
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">PERIOD</span>
                <span className="text-sm font-mono text-white mt-1">
                  {(selectedSat as any).lunarOrbit 
                    ? ((selectedSat as any).lunarOrbit.period >= 36000 
                      ? ((selectedSat as any).lunarOrbit.period / 3600).toFixed(1) + ' hr' 
                      : ((selectedSat as any).lunarOrbit.period / 60).toFixed(1) + ' min') 
                    : (satrec ? ((2 * Math.PI) / satrec.no).toFixed(1) + ' min' : '94.0 min')}
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">INCLINATION</span>
                <span className="text-sm font-mono text-white mt-1">
                  {(selectedSat as any).lunarOrbit
                    ? ((selectedSat as any).lunarOrbit.inclination).toFixed(2)
                    : (satrec ? ((satrec.inclo * 180) / Math.PI).toFixed(2) : '53.16')}°
                </span>
              </div>
            </div>

            {/* TLE Date */}
            <div className="text-[9px] text-slate-500 font-mono">
              {tleDateString}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={() => setShowSelectedOrbit(!showSelectedOrbit)}
                className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2 rounded-lg font-bold transition-all ${
                  showSelectedOrbit 
                    ? 'border-blue-500/50 bg-blue-950/30 text-blue-300 shadow-inner' 
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                Orbit
              </button>
              <button 
                onClick={() => setShowSelectedFootprint(!showSelectedFootprint)}
                className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2 rounded-lg font-bold transition-all ${
                  showSelectedFootprint 
                    ? 'border-blue-500/50 bg-blue-950/30 text-blue-300 shadow-inner' 
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                Footprint
              </button>
              <button 
                onClick={() => setFollowSelected(!followSelected)}
                className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2 rounded-lg font-bold transition-all ${
                  followSelected 
                    ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 shadow-inner' 
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                {followSelected ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Quick Tips (With smooth slide-in transition) */}
      <div 
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-black/40 backdrop-blur-md border border-white/5 py-2 px-6 rounded-full text-white/50 text-[10px] uppercase tracking-wider shadow-xl hidden md:flex items-center gap-2 transition-all duration-1000 ease-in-out ${
          showLanding || loading ? 'translate-y-20 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <span>🖱️ drag to rotate</span>
        <span className="text-white/20">|</span>
        <span>🔍 scroll to zoom</span>
        <span className="text-white/20">|</span>
        <span>🟢 click satellite to lock telemetry</span>
      </div>

      {/* MOBILE HUD OVERLAYS (visible only on < md screens when initialized) */}
      {!showLanding && !loading && (
        <>
          {/* Top Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-[#111622]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between md:hidden pointer-events-auto">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="Orbitim Logo" className="h-7 w-auto drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
              <div className="flex items-center bg-slate-950/60 p-0.5 rounded-lg border border-white/5 ml-1">
                <button
                  onClick={() => setObservationTarget('earth')}
                  className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded transition-all ${
                    observationTarget === 'earth' ? 'bg-blue-600 text-white' : 'text-white/40'
                  }`}
                >
                  EARTH
                </button>
                <button
                  onClick={() => setObservationTarget('moon')}
                  className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded transition-all ${
                    observationTarget === 'moon' ? 'bg-purple-600 text-white' : 'text-white/40'
                  }`}
                >
                  MOON
                </button>
                <button
                  onClick={() => setObservationTarget('sun')}
                  className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded transition-all ${
                    observationTarget === 'sun' ? 'bg-amber-600 text-white' : 'text-white/40'
                  }`}
                >
                  SUN
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setMobileShowSearch(!mobileShowSearch);
                  setMobileShowLayers(false);
                }}
                className={`p-1.5 rounded-lg border transition-all ${
                  mobileShowSearch ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-white/5 border-white/10 text-white/70'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={() => {
                  setMobileShowLayers(!mobileShowLayers);
                  setMobileShowSearch(false);
                }}
                className={`p-1.5 rounded-lg border transition-all ${
                  mobileShowLayers ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-white/5 border-white/10 text-white/70'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <div className="text-[9px] font-mono text-blue-300 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                {time}
              </div>
            </div>
          </div>

          {/* Search Dropdown Panel */}
          <div 
            className={`absolute left-0 right-0 z-15 bg-[#111622]/95 backdrop-blur-md border-b border-blue-500/30 px-4 py-3 transition-all duration-300 md:hidden pointer-events-auto ${
              mobileShowSearch ? 'top-[49px] opacity-100' : '-top-20 opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder="Search satellite or NORAD id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs w-full text-slate-300 font-mono"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/40">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Observation Layers Bottom Sheet */}
          <div 
            className={`fixed bottom-0 left-0 right-0 z-20 bg-[#111622]/95 backdrop-blur-lg border-t border-white/10 rounded-t-2xl p-5 transition-transform duration-500 md:hidden pointer-events-auto max-h-[60vh] overflow-y-auto ${
              mobileShowLayers ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Observation Layers</span>
              <button onClick={() => setMobileShowLayers(false)} className="text-white/40 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {observationTarget === 'moon' ? (
                <button
                  className="text-left text-xs py-2.5 px-3.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-white font-medium flex items-center justify-between pointer-events-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7] animate-pulse" />
                    <span>Lunar Satellites</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 font-bold">{LUNAR_SATELLITES.length} ACTIVE</span>
                </button>
              ) : observationTarget === 'sun' ? (
                <button
                  className="text-left text-xs py-2.5 px-3.5 rounded-xl bg-amber-600/10 border border-amber-500/20 text-white font-medium flex items-center justify-between pointer-events-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse" />
                    <span>Solar Probes</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">{SOLAR_PROBES.length} ACTIVE</span>
                </button>
              ) : (
                GROUPS.map((g) => {
                  const isEnabled = visibleLayers[g.id];
                  const isLoading = loadingGroups[g.id];
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleLayer(g.id)}
                      className={`text-left text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-between pointer-events-auto ${
                        isEnabled
                          ? 'bg-blue-600/10 text-white border border-blue-500/20 font-medium'
                          : 'bg-white/5 border border-transparent text-white/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span 
                          className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                            isEnabled ? 'shadow-[0_0_8px_currentColor]' : 'opacity-25'
                          }`} 
                          style={{ 
                            backgroundColor: g.color,
                            color: g.color
                          }} 
                        />
                        <span className="truncate">{g.name}</span>
                      </div>
                      <span className="text-[10px] font-mono flex items-center gap-1.5">
                        {isLoading ? (
                          <span className="w-2 h-2 border-t-2 border-r-2 border-white rounded-full animate-spin" />
                        ) : (
                          isEnabled 
                            ? (loadedSatellites[g.id]?.length ?? g.count).toLocaleString() 
                            : g.count.toLocaleString()
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {visibleLayers.starlink && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/60">Laser Links (ISL)</span>
                <button 
                  onClick={() => setShowLaserLinks(!showLaserLinks)}
                  className={`w-9 h-5 rounded-full transition-all relative ${
                    showLaserLinks ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <span 
                    className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${
                      showLaserLinks ? 'left-[18px]' : 'left-[2px]'
                    }`} 
                  />
                </button>
              </div>
            )}
          </div>

          {/* Locked Telemetry Bottom Sheet */}
          <div 
            className={`fixed bottom-0 left-0 right-0 z-25 bg-[#111622]/98 backdrop-blur-lg border-t border-blue-500/30 rounded-t-2xl p-5 transition-transform duration-500 md:hidden pointer-events-auto max-h-[75vh] overflow-y-auto ${
              selectedSat && selectedSat.lat !== undefined && !mobileShowLayers && !mobileShowSearch ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            {selectedSat && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Locked Target</span>
                    <h3 className="text-lg font-bold truncate mt-1 tracking-tight" style={{ width: 'calc(100vw - 80px)' }}>{selectedSat.name}</h3>
                    <span className="text-[10px] text-slate-500 font-mono block">NORAD {satrec ? satrec.satnum : '00000'}</span>
                  </div>
                  <button onClick={() => setSelectedSat(null)} className="text-white/40">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">ALTITUDE</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {Math.round((selectedSat.alt ?? 0) * EARTH_RADIUS_KM).toFixed(1)} km
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">SPEED</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {(selectedSat.speed ?? 0).toFixed(2)} km/s
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">LATITUDE</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {Math.abs(selectedSat.lat ?? 0).toFixed(2)}° {(selectedSat.lat ?? 0) >= 0 ? 'N' : 'S'}
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">LONGITUDE</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {Math.abs(selectedSat.lng ?? 0).toFixed(2)}° {(selectedSat.lng ?? 0) >= 0 ? 'E' : 'W'}
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">PERIOD</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {(selectedSat as any).lunarOrbit 
                        ? ((selectedSat as any).lunarOrbit.period >= 36000 
                          ? ((selectedSat as any).lunarOrbit.period / 3600).toFixed(1) + ' hr' 
                          : ((selectedSat as any).lunarOrbit.period / 60).toFixed(1) + ' min') 
                        : (satrec ? ((2 * Math.PI) / satrec.no).toFixed(1) + ' min' : '94.0 min')}
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">INCLINATION</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {(selectedSat as any).lunarOrbit
                        ? ((selectedSat as any).lunarOrbit.inclination).toFixed(2)
                        : (satrec ? ((satrec.inclo * 180) / Math.PI).toFixed(2) : '53.16')}°
                    </span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 font-mono">
                  {tleDateString}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSelectedOrbit(!showSelectedOrbit)}
                    className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2.5 rounded-lg font-bold transition-all ${
                      showSelectedOrbit 
                        ? 'border-blue-500/50 bg-blue-950/30 text-blue-300' 
                        : 'border-white/10 text-white/40'
                    }`}
                  >
                    Orbit
                  </button>
                  <button 
                    onClick={() => setShowSelectedFootprint(!showSelectedFootprint)}
                    className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2.5 rounded-lg font-bold transition-all ${
                      showSelectedFootprint 
                        ? 'border-blue-500/50 bg-blue-950/30 text-blue-300' 
                        : 'border-white/10 text-white/40'
                    }`}
                  >
                    Footprint
                  </button>
                  <button 
                    onClick={() => setFollowSelected(!followSelected)}
                    className={`flex-1 border text-center text-[10px] uppercase tracking-wider py-2.5 rounded-lg font-bold transition-all ${
                      followSelected 
                        ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300' 
                        : 'border-white/10 text-white/40'
                    }`}
                  >
                    {followSelected ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {texturesLoaded && (
        <Globe
          ref={globeRef}
          globeMaterial={
            observationTarget === 'earth' 
              ? (globeMaterial || undefined) 
              : observationTarget === 'moon' 
                ? (moonMaterial || undefined) 
                : (sunMaterial || undefined)
          }
          backgroundColor="#0e131f"
          
          showAtmosphere={observationTarget === 'earth'}
          atmosphereColor="#3b82f6" 
          atmosphereAltitude={0.09}

          globeImageUrl={
            observationTarget === 'earth' 
              ? '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
              : 'https://vasturiano.github.io/react-globe.gl/example/moon-landing-sites/lunar_surface.jpg'
          }
          bumpImageUrl={
            observationTarget === 'earth'
              ? '//unpkg.com/three-globe/example/img/earth-topology.png'
              : 'https://vasturiano.github.io/react-globe.gl/example/moon-landing-sites/lunar_bumpmap.jpg'
          }

          // Satellites 3D custom models
          objectsData={filteredSatellites}
          objectLat="lat"
          objectLng="lng"
          objectAltitude="alt"
          objectFacesSurfaces={false}
          objectThreeObject={getSatObject}
          onObjectClick={(obj: any) => {
            setSelectedSat(obj);
          }}

          // Orbit paths, laser links, and nadir beams
          pathsData={paths}
          pathPoints="coords"
          pathColor={(path: any) => {
            if (path.isNadir) return 'rgba(34, 211, 238, 0.95)'; // Glowing cyan downlink
            if (path.isLaser) return 'rgba(168, 85, 247, 0.65)'; // Neon purple laser link
            if (path.isPastOrbit) return '#ff4d6d'; // Bright neon red/coral
            return '#38bdf8'; // Bright neon cyan/blue (future path)
          }}
          pathStroke={(path: any) => {
            if (path.isNadir) return 2.2;
            if (path.isLaser) return 0.8;
            return 1.5;
          }}
          pathResolution={30}
          pathDashLength={(path: any) => {
            if (path.isNadir) return 0.25;
            if (path.isLaser) return 0.05;
            return 0; // Solid paths for both past and future orbits
          }}
          pathDashGap={(path: any) => {
            if (path.isNadir) return 0.1;
            if (path.isLaser) return 0.02;
            return 0.02;
          }}
          pathDashAnimateTime={(path: any) => {
            if (path.isNadir) return 1200; // Fast descending downlink pulse
            if (path.isLaser) return 4000;
            return 0; // Solid paths do not animate
          }}

          // Rings footprints
          ringsData={rings}
          ringColor={() => 'rgba(16, 185, 129, 0.18)'} 
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"

          // Text labels next to selected uydular (glowing cyan text)
          labelsData={labels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelColor={() => '#38bdf8'}
          labelSize={0.4}
          labelResolution={6}
        />
      )}

      {/* Collision Warning Banner */}
      {!showLanding && collisionWarning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 w-full max-w-lg px-4 pointer-events-none">
          <div className="bg-[#111622]/90 backdrop-blur-lg border border-red-500/30 px-4 py-2.5 rounded-xl text-white shadow-2xl flex items-center justify-between pointer-events-auto border-l-4 border-l-red-500 animate-pulse">
            <div className="flex items-center gap-2.5 truncate">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 truncate">
                {collisionWarning}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Repository Link */}
      <a
        href="https://github.com/LaunchTogether/Orbitim"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 left-6 z-30 hidden md:flex items-center gap-2 bg-[#111622]/90 backdrop-blur-lg border border-white/10 px-4 py-2.5 rounded-full text-white/70 hover:text-white hover:border-blue-500/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300 pointer-events-auto select-none group"
      >
        <svg
          className="h-4 w-4 fill-current text-white/70 group-hover:text-blue-400 group-hover:scale-110 transition-all duration-300"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
        <span className="text-[10px] font-mono tracking-wider uppercase">GitHub</span>
      </a>

      {/* Playback Controls (Play/Pause/Live + Warp Speed Slider) */}
      {!showLanding && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#111622]/90 backdrop-blur-lg border border-white/10 px-5 py-2.5 rounded-full text-white shadow-2xl flex items-center gap-4 pointer-events-auto select-none">
          {/* Play/Pause Buttons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                setIsTimeFlowing(false);
                setIsRotating(false);
              }}
              className={`p-1.5 px-2.5 rounded-full transition-all flex items-center gap-1 text-[10px] uppercase font-bold border ${
                !isTimeFlowing 
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 font-black shadow-[0_0_8px_rgba(239,68,68,0.2)]' 
                  : 'text-white/40 hover:text-white/70 border-transparent'
              }`}
              title="Durdur"
            >
              <Pause className="h-3.5 w-3.5" />
              <span className="text-[9px] font-mono">Durdur</span>
            </button>
            <button 
              onClick={() => {
                setIsTimeFlowing(true);
                setIsRotating(true);
              }}
              className={`p-1.5 px-2.5 rounded-full transition-all flex items-center gap-1 text-[10px] uppercase font-bold border ${
                isTimeFlowing 
                  ? 'bg-green-500/20 text-green-400 border-green-500/40 font-black shadow-[0_0_8px_rgba(34,197,94,0.2)]' 
                  : 'text-white/40 hover:text-white/70 border-transparent'
              }`}
              title="Oynat"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="text-[9px] font-mono">Oynat</span>
            </button>
          </div>
          
          <div className="w-px h-4 bg-white/10" />

          {/* Warp Speed Multiplier */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/40 font-mono">WARP:</span>
            {[1, 10, 60, 300].map((mult) => (
              <button
                key={mult}
                onClick={() => {
                  setTimeMultiplier(mult);
                  setIsTimeFlowing(true);
                  setIsRotating(true);
                }}
                className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all ${
                  timeMultiplier === mult && isTimeFlowing
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {mult}x
              </button>
            ))}
          </div>
          
          <div className="w-px h-4 bg-white/10" />
          
          <button 
            onClick={() => {
              setSimTime(new Date());
              setTimeMultiplier(1);
              setIsTimeFlowing(true);
              setIsRotating(true);
            }}
            className={`flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-mono tracking-wider transition-all ${
              isTimeFlowing && timeMultiplier === 1
                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isTimeFlowing && timeMultiplier === 1 ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isTimeFlowing && timeMultiplier === 1 ? 'LIVE' : 'SYNC LIVE'}
          </button>
        </div>
      )}
    </div>
  );
}

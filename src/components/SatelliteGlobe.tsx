import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { fetchSatellitesByGroup, type SatelliteData } from '../services/tle';
import { Search, Info, Radio, Compass, X, Cpu, Layers, Play, Pause } from 'lucide-react';
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
  { id: 'starlink', name: 'Starlink', count: 10785, color: '#3b82f6' },
  { id: 'brightest', name: 'Brightest', count: 157, color: '#ffffff' },
  { id: 'debris_cosmos', name: 'Debris · Cosmos-2251', count: 593, color: '#f43f5e' },
  { id: 'debris_iridium', name: 'Debris · Iridium-33', count: 110, color: '#fb923c' },
  { id: 'debris_fengyun', name: 'Debris · Fengyun-1C', count: 1919, color: '#ef4444' },
  { id: 'geo', name: 'Other Active', count: 4425, color: '#64748b' }
];



// Geometries for simple dot representation and easy click collision
const dotGeometry = new THREE.SphereGeometry(0.35, 5, 5);
const collisionGeometry = new THREE.SphereGeometry(3.2, 4, 4);
const collisionMaterial = new THREE.MeshBasicMaterial({ visible: false });

// Shared material cache to avoid creating thousands of duplicate WebGL materials
const materialCache: Record<string, THREE.MeshBasicMaterial> = {};

function getSharedMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const key = `${color}_${opacity}`;
  if (!materialCache[key]) {
    materialCache[key] = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1.0,
      opacity
    });
  }
  return materialCache[key];
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

  useEffect(() => {
    if (isTimeFlowing) {
      frozenTimeRef.current = null;
    } else {
      frozenTimeRef.current = new Date();
    }
  }, [isTimeFlowing]);

  // Memoize all currently enabled satellites
  const satellites = useMemo(() => {
    let combined: SatelliteData[] = [];
    for (const groupId of Object.keys(visibleLayers)) {
      if (visibleLayers[groupId] && loadedSatellites[groupId]) {
        combined = combined.concat(loadedSatellites[groupId]);
      }
    }
    return combined;
  }, [visibleLayers, loadedSatellites]);

  // States for Globe.gl layers
  const [paths, setPaths] = useState<any[]>([]);
  const [rings, setRings] = useState<any[]>([]);
  const [globeMaterial, setGlobeMaterial] = useState<THREE.Material | null>(null);

  // Enable auto-rotation globally so that the Earth spins realistically on its axis
  useEffect(() => {
    if (globeRef.current && texturesLoaded) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = isRotating && !selectedSat;
        controls.autoRotateSpeed = 0.12; // slow, realistic rotation
      }
    }
  }, [texturesLoaded, selectedSat, isRotating]);

  // Load default active layers on mount
  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      setLoading(true);
      setError(null);
      setErrorDetails('');
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
    
    initLoad();
    return () => { active = false; };
  }, []);

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
      textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/Shriisoot/Planets-texture/8k_earth_nightmap.jpg')
    ]).then(([dayTexture, nightTexture]) => {
      console.log("8K textures successfully loaded.");
      const mat = new THREE.MeshStandardMaterial({
        map: dayTexture,
        color: new THREE.Color('#556b82'), // Multiplying with slate-blue to desaturate and darken the day side
        emissiveMap: nightTexture,
        emissive: new THREE.Color('#fcd34d'), // Warm golden city lights
        emissiveIntensity: 2.2, // Make city lights pop
        roughness: 0.7,
        metalness: 0.1
      });
      setGlobeMaterial(mat);
      setTexturesLoaded(true);
    }).catch(err => {
      console.error("Failed to load 8K textures, using fallback material:", err);
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

    // Sun visual sphere (Shining pure white space core with dynamic core glow)
    const sunMeshGeo = new THREE.SphereGeometry(22, 32, 32);
    const sunMeshMat = new THREE.MeshBasicMaterial({ 
      color: '#ffffff',
      toneMapped: false
    });
    const sunMesh = new THREE.Mesh(sunMeshGeo, sunMeshMat);
    sunMesh.name = 'sun-visual';
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
    const starsCount = 5500;
    const starsPositions = new Float32Array(starsCount * 3);
    const starsColors = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      const r = 400 + Math.random() * 600;
      
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
      size: 2.2,
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

  // Animation loop for clouds rotation
  useEffect(() => {
    let animId: number;
    
    const animate = () => {
      const globe = globeRef.current;
      
      if (globe) {
        // Rotate clouds
        if (globe._customClouds) {
          globe._customClouds.rotation.y += 0.00018;
          globe._customClouds.rotation.x += 0.00005;
        }
      }
      
      animId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animId);
  }, [texturesLoaded]);

  const [selectedSatLive, setSelectedSatLive] = useState<SatelliteData | null>(null);

  // Update clock, Sun, Moon, and selected satellite telemetry
  useEffect(() => {
    const updateRealtime = () => {
      const now = frozenTimeRef.current || new Date();
      setTime(now.toISOString().substring(11, 19));

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
      if (selectedSat && selectedSat.satrec) {
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
      } else {
        setSelectedSatLive(null);
      }
    };

    updateRealtime();
    const interval = setInterval(updateRealtime, 1000);
    return () => clearInterval(interval);
  }, [selectedSat, isTimeFlowing]);

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

    if (selectedSatLive && selectedSatLive.satrec) {
      const now = frozenTimeRef.current || new Date();

      // Label
      newLabels.push({
        lat: selectedSatLive.lat,
        lng: selectedSatLive.lng,
        text: selectedSatLive.name
      });

      // Orbit Path
      if (showSelectedOrbit) {
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
      starlink: '#3b82f6',
      brightest: '#ffffff',
      debris_cosmos: '#f43f5e',
      debris_iridium: '#fb923c',
      debris_fengyun: '#ef4444',
      geo: '#64748b'
    };
    
    let color = (d.group && groupColorMap[d.group]) || '#38bdf8';
    const opacity = isSearched ? 1.0 : 0.12;
    
    const group = new THREE.Group();
    group.name = 'satellite-mesh';
    group.userData = { 
      phase: Math.random() * 100,
      isSelected
    };

    // 1. Visual dot (represented as a self-luminous glowing sphere)
    const visualColor = isSelected ? '#ffffff' : color;
    const visualMat = getSharedMaterial(visualColor, opacity);
    const visualMesh = new THREE.Mesh(dotGeometry, visualMat);
    group.add(visualMesh);

    // 2. Large invisible collision zone for easy clicking on spinning globe
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    group.add(collisionMesh);

    // Dynamic scaling (Selected dot is larger and pulses more strongly)
    const baseScale = isSelected ? 0.35 : 0.18;
    group.scale.set(baseScale, baseScale, baseScale);

    group.onBeforeRender = () => {
      const time = Date.now() * 0.0035;
      const phase = group.userData?.phase || 0;
      const pulse = 1.0 + Math.sin(time + phase) * (isSelected ? 0.45 : 0.35);
      
      let shadowFactor = 1.0;
      if (sunVectorRef.current) {
        const satVec = new THREE.Vector3().copy(group.position).normalize();
        const dot = satVec.dot(sunVectorRef.current);
        if (dot < -0.35) {
          shadowFactor = 0.45;
        }
      }
      
      const finalScale = baseScale * pulse * shadowFactor;
      group.scale.set(finalScale, finalScale, finalScale);
    };

    return group;
  }, [selectedSat, searchQuery, isTimeFlowing]);

  const satrec = selectedSat?.satrec;
  const tleDateString = satrec ? getTleEpochDate(satrec) : 'TLE 2026-07-20 00:00:00 UTC';

  return (
    <div className="absolute inset-0 bg-[#0e131f] flex overflow-hidden">
      {/* Landing Page Side Panel (Right) */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[460px] bg-slate-950/45 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col justify-between z-30 transition-transform duration-1000 ease-in-out pointer-events-auto overflow-y-auto ${
          showLanding ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center pb-2 border-b border-white/5">
            <img src={logoImg} alt="Orbitim Logo" className="h-28 w-auto mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse" />
            <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-[10px] uppercase mb-1">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Telemetry Control Grid
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white leading-none uppercase">
              ORBITIM <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">3D</span>
            </h1>
            <p className="text-white/50 text-xs mt-2 leading-relaxed max-w-sm">
              Welcome to the central observation hub for Earth's artificial satellite shell. Orbitim 3D parses live orbital data feeds to propagate and render over 12,000 active objects in real-time.
            </p>
          </div>

          {/* Starlink realistic generated graphic */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-blue-500/20 shadow-lg group">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />
            <img 
              src={starlinkImg} 
              alt="Starlink Satellite Render" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute bottom-3 left-3 z-20 font-mono text-[9px] text-blue-400 space-y-0.5">
              <div className="text-white/60 font-sans text-xs font-bold uppercase tracking-wide">Starlink v2.0 Array</div>
              <div>ALTITUDE: ~550 KM | SPEED: ~7.6 KM/S</div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] text-white/40 font-bold tracking-wider uppercase border-b border-white/5 pb-2">Core Telemetry Modules</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex gap-3 items-start bg-white/5 p-3 rounded-xl border border-white/5">
                <Cpu className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">60 FPS Physics Engine</h4>
                  <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">Local orbital mechanics run frame-by-frame on your GPU using LOD optimizations.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white/5 p-3 rounded-xl border border-white/5">
                <Layers className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">Constellation Filters</h4>
                  <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">Toggle between Starlink, GPS, weather, or geostationary arrays.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white/5 p-3 rounded-xl border border-white/5">
                <Compass className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">Target Locking</h4>
                  <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">Click any orbital dot to lock telemetry and draw projected paths.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <button
            onClick={() => setShowLanding(false)}
            className="w-full bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 text-white font-bold text-sm tracking-widest uppercase py-4 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 cursor-pointer group"
          >
            <Play className="h-4 w-4 fill-white group-hover:scale-110 transition-transform" />
            Initialize Telemetry Matrix
          </button>
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
            {GROUPS.map((g) => {
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
            })}
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
                  {satrec ? ((2 * Math.PI) / satrec.no).toFixed(1) : '94.0'} min
                </span>
              </div>
              <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">INCLINATION</span>
                <span className="text-sm font-mono text-white mt-1">
                  {satrec ? ((satrec.inclo * 180) / Math.PI).toFixed(2) : '53.16'}°
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
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-black/40 backdrop-blur-md border border-white/5 py-2 px-6 rounded-full text-white/50 text-[10px] uppercase tracking-wider shadow-xl hidden md:flex items-center gap-2 transition-all duration-1000 ease-in-out ${
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
              <span className="text-white font-extrabold tracking-tight text-xs bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">ORBITIM 3D</span>
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
              {GROUPS.map((g) => {
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
              })}
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
                      {satrec ? ((2 * Math.PI) / satrec.no).toFixed(1) : '94.0'} min
                    </span>
                  </div>
                  <div className="bg-[#181f30]/40 border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">INCLINATION</span>
                    <span className="text-sm font-mono text-white mt-1">
                      {satrec ? ((satrec.inclo * 180) / Math.PI).toFixed(2) : '53.16'}°
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
          globeMaterial={globeMaterial || undefined}
          backgroundColor="#0e131f"
          
          showAtmosphere={true}
          atmosphereColor="#58c0ff" 
          atmosphereAltitude={0.25}

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

      {/* Playback Controls (Play/Pause/Live) */}
      {!showLanding && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-[#111622]/90 backdrop-blur-lg border border-white/10 px-4 py-2 rounded-full text-white shadow-2xl flex items-center gap-4 pointer-events-auto select-none">
          <button 
            onClick={() => {
              const next = !isTimeFlowing;
              setIsTimeFlowing(next);
              setIsRotating(next);
            }}
            className="p-2 hover:bg-white/10 rounded-full transition-all text-blue-400 hover:text-white flex items-center justify-center"
            title={isTimeFlowing ? "Pause Simulation" : "Play Simulation"}
          >
            {isTimeFlowing ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5 fill-current" />}
          </button>
          
          <div className="w-px h-4 bg-white/10" />
          
          <button 
            onClick={() => {
              setIsTimeFlowing(true);
              setIsRotating(true);
            }}
            className={`flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-mono tracking-wider transition-all ${
              isTimeFlowing 
                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isTimeFlowing ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isTimeFlowing ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      )}
    </div>
  );
}

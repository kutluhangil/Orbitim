import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { fetchSatellitesByGroup, type SatelliteData } from '../services/tle';
import { Search, Info, Radio, Compass, X, Cpu, Layers, Play } from 'lucide-react';
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
  { id: 'starlink', name: 'Starlink', count: 6185, color: '#3b82f6' },
  { id: 'brightest', name: 'Brightest', count: 157, color: '#ffffff' },
  { id: 'debris', name: 'Debris', count: 593, color: '#f43f5e' },
  { id: 'geo', name: 'Other Active', count: 4425, color: '#64748b' }
];

// Helper function to merge multiple buffer geometries into a single mesh for 60 FPS rendering
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const mergedGeometry = new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const g of geometries) {
    totalVertices += g.attributes.position.count;
    if (g.index) {
      totalIndices += g.index.count;
    }
  }
  
  const positions = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);
  
  let vertexOffset = 0;
  let indexOffset = 0;
  
  for (const g of geometries) {
    const posAttr = g.attributes.position;
    // Copy positions
    for (let i = 0; i < posAttr.count; i++) {
      positions[(vertexOffset + i) * 3] = posAttr.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = posAttr.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = posAttr.getZ(i);
    }
    
    // Copy indices
    if (g.index) {
      const indAttr = g.index;
      for (let i = 0; i < indAttr.count; i++) {
        indices[indexOffset + i] = indAttr.getX(i) + vertexOffset;
      }
      indexOffset += indAttr.count;
    }
    
    vertexOffset += posAttr.count;
  }
  
  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  
  return mergedGeometry;
}

// Pre-allocate custom 3D geometries for selected detailed models
const starlinkBodyGeo = new THREE.BoxGeometry(0.8, 0.1, 1.2);
const starlinkPanelGeo = new THREE.BoxGeometry(2.0, 0.02, 0.8);
const starlinkConnectorGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4);
starlinkConnectorGeo.rotateZ(Math.PI / 2);

const stationBodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 3.2, 8);
stationBodyGeo.rotateZ(Math.PI / 2);
const stationPanelGeo = new THREE.BoxGeometry(1.4, 0.02, 2.6);

const gpsBodyGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const gpsPanelGeo = new THREE.BoxGeometry(2.2, 0.02, 0.6);

const defaultBodyGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const defaultPanelGeo = new THREE.BoxGeometry(1.2, 0.02, 0.4);

// Pre-allocate materials for satellite parts to keep FPS high
const starlinkPanelMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.5, wireframe: true });
const stationPanelMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.5, wireframe: true });
const gpsPanelMat = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5, wireframe: true });
const defaultPanelMat = new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.5, wireframe: true });

// Pre-build realistic merged geometries for standard (unselected) satellites
const makeStarlinkGeometry = () => {
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.08, 0.7);
  const panelGeo = new THREE.BoxGeometry(1.6, 0.01, 0.5);
  panelGeo.translate(1.05, 0, 0); // Side panel wing
  const connectorGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4);
  connectorGeo.rotateZ(Math.PI / 2);
  connectorGeo.translate(0.35, 0, 0);
  return mergeBufferGeometries([bodyGeo, connectorGeo, panelGeo]);
};

const makeStationGeometry = () => {
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.6, 6);
  bodyGeo.rotateZ(Math.PI / 2);
  const leftPanelGeo = new THREE.BoxGeometry(1.2, 0.01, 2.0);
  leftPanelGeo.translate(-1.9, 0, 0);
  const rightPanelGeo = new THREE.BoxGeometry(1.2, 0.01, 2.0);
  rightPanelGeo.translate(1.9, 0, 0);
  return mergeBufferGeometries([bodyGeo, leftPanelGeo, rightPanelGeo]);
};

const makeGpsGeometry = () => {
  const bodyGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const leftPanelGeo = new THREE.BoxGeometry(1.4, 0.01, 0.5);
  leftPanelGeo.translate(-1.15, 0, 0);
  const rightPanelGeo = new THREE.BoxGeometry(1.4, 0.01, 0.5);
  rightPanelGeo.translate(1.15, 0, 0);
  return mergeBufferGeometries([bodyGeo, leftPanelGeo, rightPanelGeo]);
};

const makeDefaultGeometry = () => {
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const leftPanelGeo = new THREE.BoxGeometry(0.8, 0.01, 0.3);
  leftPanelGeo.translate(-0.7, 0, 0);
  const rightPanelGeo = new THREE.BoxGeometry(0.8, 0.01, 0.3);
  rightPanelGeo.translate(0.7, 0, 0);
  return mergeBufferGeometries([bodyGeo, leftPanelGeo, rightPanelGeo]);
};

const simpleStarlinkGeo = makeStarlinkGeometry();
const simpleStationGeo = makeStationGeometry();
const simpleGpsGeo = makeGpsGeometry();
const simpleDefaultGeo = makeDefaultGeometry();

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
  const [activeGroup, setActiveGroup] = useState<string>('starlink');
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
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
  const [tick, setTick] = useState(0);
  const [showLaserLinks, setShowLaserLinks] = useState(false);
  const sunVectorRef = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0));
  const [mobileShowLayers, setMobileShowLayers] = useState(false);
  const [mobileShowSearch, setMobileShowSearch] = useState(false);

  // States for Globe.gl layers
  const [paths, setPaths] = useState<any[]>([]);
  const [rings, setRings] = useState<any[]>([]);
  const [globeMaterial, setGlobeMaterial] = useState<THREE.Material | null>(null);

  // Enable auto-rotation while on the landing screen, disable when launched
  useEffect(() => {
    if (globeRef.current && texturesLoaded) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = showLanding;
        controls.autoRotateSpeed = 0.4;
      }
    }
  }, [showLanding, texturesLoaded]);

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

  // Fetch satellites when group changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedSat(null);
    setPaths([]);
    setRings([]);

    fetchSatellitesByGroup(activeGroup)
      .then((res) => {
        setSatellites(res.satellites);
        setPositions([]);
        setDataSource(res.source);
        setErrorDetails(res.errorDetails || '');
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeGroup]);

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

    // Sun directional light
    const sunLight = new THREE.DirectionalLight('#fffdf0', 3.0);
    sunLight.name = 'custom-sun';
    scene.add(sunLight);

    // Moon directional light
    const moonLight = new THREE.DirectionalLight('#dbeafe', 0.6);
    moonLight.name = 'custom-moon';
    scene.add(moonLight);

    // Sun visual sphere (shining yellow in deep space)
    const sunMeshGeo = new THREE.SphereGeometry(18, 16, 16);
    const sunMeshMat = new THREE.MeshBasicMaterial({ color: '#ffea00' });
    const sunMesh = new THREE.Mesh(sunMeshGeo, sunMeshMat);
    sunMesh.name = 'sun-visual';
    scene.add(sunMesh);

    // Moon visual sphere (grey wireframe in deep space)
    const moonMeshGeo = new THREE.SphereGeometry(5, 12, 12);
    const moonMeshMat = new THREE.MeshBasicMaterial({ color: '#94a3b8', wireframe: true });
    const moonMesh = new THREE.Mesh(moonMeshGeo, moonMeshMat);
    moonMesh.name = 'moon-visual';
    scene.add(moonMesh);

    // Add sharp 3D Starfield particles
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 4000;
    const starsPositions = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      const r = 500 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      starsPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starsPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPositions[i + 2] = r * Math.cos(phi);
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    
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
      size: 1.8,
      sizeAttenuation: true,
      map: starTex,
      transparent: true,
      opacity: 0.9,
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

  // Animation loop for clouds rotation and satellite pulsation
  useEffect(() => {
    let animId: number;
    
    const animate = () => {
      const time = Date.now() * 0.0035;
      const globe = globeRef.current;
      
      if (globe) {
        // Rotate clouds
        if (globe._customClouds) {
          globe._customClouds.rotation.y += 0.00018;
          globe._customClouds.rotation.x += 0.00005;
        }
        
        // Pulsate & shade satellites (Solar Occlusion)
        const scene = globe.scene();
        scene.traverse((obj: any) => {
          if (obj.name === 'satellite-mesh') {
            const phase = obj.userData?.phase || 0;
            const isSelected = obj.userData?.isSelected;
            
            const baseScale = isSelected ? 1.6 : 0.18;
            
            // Pulsate scale out-of-phase
            const pulse = isSelected 
              ? 1.0 + Math.sin(time + phase) * 0.15
              : 1.0 + Math.sin(time + phase) * 0.35;
            
            // Solar Occlusion: Check if satellite is in Earth's shadow relative to Sun position
            let shadowFactor = 1.0;
            if (sunVectorRef.current) {
              const satVec = new THREE.Vector3().copy(obj.position).normalize();
              const dot = satVec.dot(sunVectorRef.current);
              if (dot < -0.35) {
                shadowFactor = 0.45; // Dim the satellite by reducing its scale
              }
            }
              
            const finalScale = baseScale * pulse * shadowFactor;
            obj.scale.set(finalScale, finalScale, finalScale);
          }
        });
      }
      
      animId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animId);
  }, [texturesLoaded]);

  // Update positions & orbits in-place
  useEffect(() => {
    if (!satellites.length) return;

    const updatePositions = () => {
      const now = new Date();
      const gmst = satellite.gstime(now);

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

      // Propagate satellites
      const propagated: any[] = [];
      for (let i = 0; i < satellites.length; i++) {
        const sat = satellites[i];
        const positionAndVelocity = satellite.propagate(sat.satrec, now);
        if (!positionAndVelocity) continue;
        const positionEci = positionAndVelocity.position;
        const velocityEci = positionAndVelocity.velocity;

        if (positionEci && typeof positionEci !== 'boolean') {
          const positionGd = satellite.eciToGeodetic(positionEci, gmst);
          
          let speed = 0;
          if (typeof velocityEci !== 'boolean' && velocityEci) {
            speed = Math.sqrt(
              velocityEci.x * velocityEci.x +
              velocityEci.y * velocityEci.y +
              velocityEci.z * velocityEci.z
            );
          }
          propagated.push({
            name: sat.name,
            satrec: sat.satrec,
            lat: satellite.degreesLat(positionGd.latitude),
            lng: satellite.degreesLong(positionGd.longitude),
            alt: positionGd.height / EARTH_RADIUS_KM,
            speed
          });
        }
      }

      setTick(t => t + 1);
      setPositions(propagated);

      // Calculate paths and footprints
      const newPaths: any[] = [];
      const newRings: any[] = [];

      if (selectedSat) {
        const currentSat = propagated.find(s => s.name === selectedSat.name);
        if (currentSat && currentSat.lat !== undefined) {
          const pathPoints: any[] = [];
          
          for (let i = 0; i <= 90; i += 2) {
            const futureTime = new Date(now.getTime() + i * 60000);
            const futureGmst = satellite.gstime(futureTime);
            const posVel = satellite.propagate(currentSat.satrec, futureTime);
            if (!posVel) continue;
            const posEci = posVel.position;
            
            if (posEci && typeof posEci !== 'boolean') {
              const posGd = satellite.eciToGeodetic(posEci, futureGmst);
              pathPoints.push({
                lat: satellite.degreesLat(posGd.latitude),
                lng: satellite.degreesLong(posGd.longitude),
                alt: posGd.height / EARTH_RADIUS_KM
              });
            }
          }
          
          if (pathPoints.length > 0) {
            // Selected Orbit Path
            newPaths.push({
              coords: pathPoints.map(p => [p.lat, p.lng, p.alt]),
              isNadir: false,
              isLaser: false
            });

            // Nadir Downlink Beam
            newPaths.push({
              coords: [
                [currentSat.lat, currentSat.lng, currentSat.alt || 0.1],
                [currentSat.lat, currentSat.lng, 0.005]
              ],
              isNadir: true,
              isLaser: false
            });

            // Footprint Ring
            newRings.push({
              lat: currentSat.lat,
              lng: currentSat.lng,
              maxR: 15,
              propagationSpeed: 0,
              repeatPeriod: 0
            });
          }
        }
      }

      // Laser Links (Optical inter-satellite cross-links)
      if (showLaserLinks && activeGroup === 'starlink' && propagated.length > 30) {
        const sorted = [...propagated].sort((a, b) => (a.lng || 0) - (b.lng || 0));
        let laserCount = 0;
        
        for (let i = 0; i < sorted.length; i++) {
          const s1 = sorted[i];
          if (s1.lat === undefined || s1.lng === undefined) continue;
          
          for (let j = 1; j <= 2; j++) {
            const s2 = sorted[(i + j) % sorted.length];
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
              if (laserCount >= 200) break;
            }
          }
          if (laserCount >= 200) break;
        }
      }

      setPaths(newPaths);
      setRings(newRings);
    };

    updatePositions();
    const interval = setInterval(updatePositions, 1000);

    return () => clearInterval(interval);
  }, [satellites, selectedSat, showLaserLinks, activeGroup]);

  // Adjust camera to focus on selected satellite
  useEffect(() => {
    if (selectedSat && selectedSat.lat !== undefined && globeRef.current) {
      globeRef.current.pointOfView({
        lat: selectedSat.lat,
        lng: selectedSat.lng,
        altitude: 2.0
      }, 1000);
    }
  }, [selectedSat]);

  // Filter based on search query
  const filteredSatellites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return positions;
    return positions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.satrec && s.satrec.satnum !== undefined && String(s.satrec.satnum).includes(query))
    );
  }, [positions, searchQuery, tick]);

  // Return a custom ThreeJS Mesh based on satellite classification (glowing models)
  const getSatObject = useCallback((d: any) => {
    const isSelected = selectedSat && d.name === selectedSat.name;
    const isSearched = searchQuery ? d.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    
    // Vibrant colors matching the reference image
    const nameUpper = d.name.toUpperCase();
    let color = '#38bdf8'; // Soft sky blue (Default)
    if (nameUpper.includes('STARLINK')) {
      color = '#22d3ee'; // Vibrant Cyan/Teal
    } else if (nameUpper.includes('ISS') || nameUpper.includes('TIANGONG') || nameUpper.includes('CSS') || nameUpper.includes('SPACE STATION')) {
      color = '#fbbf24'; // Vibrant Gold/Orange
    } else if (nameUpper.includes('GPS') || nameUpper.includes('NAVSTAR') || nameUpper.includes('BEIDOU') || nameUpper.includes('GALILEO') || nameUpper.includes('GLONASS')) {
      color = '#ef4444'; // Vibrant Red
    }
    
    const opacity = isSearched ? 0.95 : 0.15;
    
    // Return detailed model ONLY if selected to save thousands of draw calls
    if (isSelected) {
      const selectedBodyMat = getSharedMaterial('#ffffff', 1.0);
      const group = new THREE.Group();
      group.name = 'satellite-mesh';
      group.userData = { 
        phase: Math.random() * 100,
        isSelected: true
      };
      
      if (nameUpper.includes('STARLINK')) {
        const body = new THREE.Mesh(starlinkBodyGeo, selectedBodyMat);
        group.add(body);
        const connector = new THREE.Mesh(starlinkConnectorGeo, selectedBodyMat);
        connector.position.set(0.6, 0, 0);
        group.add(connector);
        const panel = new THREE.Mesh(starlinkPanelGeo, starlinkPanelMat);
        panel.position.set(1.6, 0, 0);
        group.add(panel);
      } else if (nameUpper.includes('ISS') || nameUpper.includes('TIANGONG') || nameUpper.includes('CSS') || nameUpper.includes('SPACE STATION')) {
        const body = new THREE.Mesh(stationBodyGeo, selectedBodyMat);
        group.add(body);
        const leftPanel = new THREE.Mesh(stationPanelGeo, stationPanelMat);
        leftPanel.position.set(-2.2, 0, 0);
        group.add(leftPanel);
        const rightPanel = new THREE.Mesh(stationPanelGeo, stationPanelMat);
        rightPanel.position.set(2.2, 0, 0);
        group.add(rightPanel);
      } else if (nameUpper.includes('GPS') || nameUpper.includes('NAVSTAR') || nameUpper.includes('BEIDOU') || nameUpper.includes('GALILEO') || nameUpper.includes('GLONASS')) {
        const body = new THREE.Mesh(gpsBodyGeo, selectedBodyMat);
        group.add(body);
        const leftPanel = new THREE.Mesh(gpsPanelGeo, gpsPanelMat);
        leftPanel.position.set(-1.6, 0, 0);
        group.add(leftPanel);
        const rightPanel = new THREE.Mesh(gpsPanelGeo, gpsPanelMat);
        rightPanel.position.set(1.6, 0, 0);
        group.add(rightPanel);
      } else {
        const body = new THREE.Mesh(defaultBodyGeo, selectedBodyMat);
        group.add(body);
        const leftPanel = new THREE.Mesh(defaultPanelGeo, defaultPanelMat);
        leftPanel.position.set(-0.9, 0, 0);
        group.add(leftPanel);
        const rightPanel = new THREE.Mesh(defaultPanelGeo, defaultPanelMat);
        rightPanel.position.set(0.9, 0, 0);
        group.add(rightPanel);
      }
      
      group.scale.set(1.6, 1.6, 1.6);
      return group;
    }
    
    // For standard satellites, reuse shared materials and simple geometries for 60 FPS
    const sharedMat = getSharedMaterial(color, opacity);
    let geom: THREE.BufferGeometry = simpleDefaultGeo;
    
    if (nameUpper.includes('STARLINK')) {
      geom = simpleStarlinkGeo;
    } else if (nameUpper.includes('ISS') || nameUpper.includes('TIANGONG') || nameUpper.includes('CSS') || nameUpper.includes('SPACE STATION')) {
      geom = simpleStationGeo;
    } else if (nameUpper.includes('GPS') || nameUpper.includes('NAVSTAR') || nameUpper.includes('BEIDOU') || nameUpper.includes('GALILEO') || nameUpper.includes('GLONASS')) {
      geom = simpleGpsGeo;
    }
    
    const mesh = new THREE.Mesh(geom, sharedMat);
    mesh.name = 'satellite-mesh';
    mesh.scale.set(0.18, 0.18, 0.18); // Scale down to make them look like tiny glowing dots when zoomed out
    mesh.userData = { 
      phase: Math.random() * 100,
      isSelected: false
    };
    
    return mesh;
  }, [selectedSat, searchQuery]);

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
          <span className="text-xs text-white/40 mt-2 font-mono uppercase">Fetching orbit vectors ({activeGroup})</span>
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
            onClick={() => setActiveGroup(activeGroup)} 
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
          <div className="flex flex-col gap-2">
            {GROUPS.map((g) => {
              const isSelected = activeGroup === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={`text-left text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 font-medium'
                      : 'hover:bg-white/5 text-white/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 rounded-full h-2 shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 group-hover:text-white/80 transition-colors">
                    {isSelected ? filteredSatellites.length.toLocaleString() : g.count.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Laser Links Toggle */}
          {activeGroup === 'starlink' && (
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
              <div>TICK: {tick}</div>
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
          <div className="bg-black/60 backdrop-blur-lg border border-blue-500/20 p-5 rounded-2xl text-white shadow-2xl pointer-events-auto border-l-4 border-l-blue-500 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Target Locked</span>
                <h3 className="text-lg font-bold truncate w-48 mt-1 tracking-tight">{selectedSat.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedSat(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selected Satellite Mini-Asset */}
            <div className="h-28 bg-blue-950/20 border border-blue-500/10 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent z-10" />
              <img 
                src={starlinkImg} 
                alt="Satellite Locked Graphic"
                className="w-full h-full object-cover opacity-80" 
              />
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 font-mono text-[8px] text-blue-400">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                <span>Active Telemetry</span>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs border-t border-white/5 pt-3">
              <div className="flex justify-between">
                <span className="text-white/40">LATITUDE:</span>
                <span className="text-blue-300">{(selectedSat.lat ?? 0).toFixed(4)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">LONGITUDE:</span>
                <span className="text-blue-300">{(selectedSat.lng ?? 0).toFixed(4)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">ALTITUDE:</span>
                <span className="text-blue-300">{Math.round((selectedSat.alt ?? 0) * EARTH_RADIUS_KM)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">SPEED:</span>
                <span className="text-emerald-400">{(selectedSat.speed ?? 0).toFixed(2)} km/s</span>
              </div>
              <div className="flex justify-between text-[10px] text-white/30 border-t border-white/5 pt-2">
                <span>PERIOD:</span>
                <span>~90 Mins (LEO)</span>
              </div>
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
                const isSelected = activeGroup === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroup(g.id);
                      setMobileShowLayers(false);
                    }}
                    className={`text-left text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 text-white border border-blue-500/30 font-medium'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                      <span className="truncate">{g.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">
                      {isSelected ? filteredSatellites.length.toLocaleString() : g.count.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeGroup === 'starlink' && (
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
            className={`fixed bottom-0 left-0 right-0 z-25 bg-[#111622]/98 backdrop-blur-lg border-t border-blue-500/30 rounded-t-2xl p-5 transition-transform duration-500 md:hidden pointer-events-auto ${
              selectedSat && selectedSat.lat !== undefined && !mobileShowLayers && !mobileShowSearch ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            {selectedSat && (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Locked Target</span>
                    <h3 className="text-base font-bold truncate mt-1 tracking-tight" style={{ width: 'calc(100vw - 80px)' }}>{selectedSat.name}</h3>
                  </div>
                  <button onClick={() => setSelectedSat(null)} className="text-white/40">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs border-t border-white/5 pt-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40">LAT:</span>
                    <span className="text-blue-300">{(selectedSat.lat ?? 0).toFixed(3)}°</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40">LNG:</span>
                    <span className="text-blue-300">{(selectedSat.lng ?? 0).toFixed(3)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">ALT:</span>
                    <span className="text-blue-300">{Math.round((selectedSat.alt ?? 0) * EARTH_RADIUS_KM)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">SPD:</span>
                    <span className="text-emerald-400">{(selectedSat.speed ?? 0).toFixed(2)} km/s</span>
                  </div>
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
            return 'rgba(59, 130, 246, 0.5)'; // Slate blue orbit path
          }}
          pathStroke={(path: any) => {
            if (path.isNadir) return 2.2;
            if (path.isLaser) return 0.8;
            return 1.2;
          }}
          pathResolution={30}
          pathDashLength={(path: any) => {
            if (path.isNadir) return 0.25;
            if (path.isLaser) return 0.05;
            return 0.04;
          }}
          pathDashGap={(path: any) => {
            if (path.isNadir) return 0.1;
            if (path.isLaser) return 0.02;
            return 0.02;
          }}
          pathDashAnimateTime={(path: any) => {
            if (path.isNadir) return 1200; // Fast descending downlink pulse
            if (path.isLaser) return 4000;
            return 2500;
          }}

          // Rings footprints
          ringsData={rings}
          ringColor={() => 'rgba(16, 185, 129, 0.18)'} 
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
        />
      )}
    </div>
  );
}

import * as satellite from 'satellite.js';

export interface SatelliteData {
  satrec: satellite.SatRec;
  name: string;
  /** Element-set epoch derived from the TLE itself, not fetch time. */
  epochMs: number;
  lat?: number;
  lng?: number;
  alt?: number;
  speed?: number;
  group?: string;
}

export interface TleResult {
  satellites: SatelliteData[];
  source: 'live' | 'cache' | 'local_fallback' | 'hardcoded_fallback';
  /** When this element set was fetched or written to cache. */
  fetchedAt: number;
  /** Oldest TLE epoch in the set; propagation quality should be judged from this. */
  oldestEpochMs: number | null;
  /** Freshest TLE epoch in the set. */
  newestEpochMs: number | null;
  errorDetails?: string;
}

const CACHE_KEY_PREFIX = 'tle_cache_';
const CACHE_TIME_KEY_PREFIX = 'tle_cache_time_';
const TWO_HOURS = 2 * 60 * 60 * 1000;

function tleEpochMs(satrec: satellite.SatRec): number {
  return (satrec.jdsatepoch - 2440587.5) * 86400000;
}

function resultFor(
  satellites: SatelliteData[],
  source: TleResult['source'],
  fetchedAt: number,
  errorDetails?: string
): TleResult {
  const epochs = satellites.map((item) => item.epochMs).filter(Number.isFinite);
  return {
    satellites,
    source,
    fetchedAt,
    oldestEpochMs: epochs.length > 0 ? Math.min(...epochs) : null,
    newestEpochMs: epochs.length > 0 ? Math.max(...epochs) : null,
    ...(errorDetails ? { errorDetails } : {})
  };
}

// Embed a minimal fallback dataset (ISS + a few active satellites)
const FALLBACK_TLE = `ISS (ZARYA)
1 25544U 98067A   26201.55430556  .00016717  00000-0  30000-3 0  9998
2 25544  51.6397 270.1063 0005092 339.2481  20.8322 15.49002605369346
TIANGONG
1 48274U 21035A   26201.50000000  .00005000  00000-0  10000-3 0  9991
2 48274  41.4789 123.4567 0001234  45.6789 314.3210 15.61000000123456
HST
1 20580U 90037B   26201.21370140  .00000227  00000+0  10016-4 0  9998
2 20580  28.4697 170.1063 0005092 239.2481 120.8322 15.04002605369346
GPS BIIRM-4
1 32711U 08012A   26201.11370140  .00000027  00000+0  00000-0 0  9998
2 32711  55.4397 310.1063 0055092 119.2481 240.8322  2.00562605369346`;

export async function fetchSatellitesByGroup(group: string = 'starlink'): Promise<TleResult> {
  // Map group ID to Satvisor TLE file names
  let fileName = `${group}.tle`;
  let celestrakGroup = group;

  if (group === 'gps') {
    fileName = 'gps-ops.tle';
  } else if (group === 'glonass') {
    fileName = 'glo-ops.tle';
  } else if (group === 'geo') {
    fileName = 'geo.tle';
  } else if (group === 'brightest') {
    fileName = 'visual.tle';
  } else if (group === 'debris' || group === 'debris_iridium') {
    fileName = 'iridium-33-debris.tle';
    celestrakGroup = 'iridium-33-debris';
  } else if (group === 'debris_cosmos') {
    fileName = 'cosmos-2251-debris.tle';
    celestrakGroup = 'cosmos-2251-debris';
  } else if (group === 'debris_fengyun') {
    fileName = 'fengyun-1c-debris.tle';
    celestrakGroup = 'fengyun-1c-debris';
  } else if (group === 'debris_cosmos1408') {
    fileName = 'cosmos-1408-debris.tle';
    celestrakGroup = 'cosmos-1408-debris';
  }

  const githubUrl = `https://raw.githubusercontent.com/satvisorcom/satvisor-data/master/celestrak/tle/${fileName}`;
  const celestrakUrl = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${celestrakGroup}&FORMAT=tle`;
  
  // 1. Try to read from cache first
  const cachedData = localStorage.getItem(`${CACHE_KEY_PREFIX}${group}`);
  const cachedTime = localStorage.getItem(`${CACHE_TIME_KEY_PREFIX}${group}`);
  const now = Date.now();

  if (cachedData && cachedTime) {
    const age = now - parseInt(cachedTime, 10);
    if (age < TWO_HOURS) {
      return resultFor(parseTLE(cachedData, group), 'cache', Number(cachedTime));
    }
  }

  // 2. Fetch from Satvisor CDN (GitHub Mirror) to avoid rate limits
  try {
    const response = await fetch(githubUrl);
    if (!response.ok) {
      throw new Error(`Satvisor CDN returned HTTP ${response.status}`);
    }
    const data = await response.text();
    if (data && data.length > 100) {
      // Cache the successful fetch
      localStorage.setItem(`${CACHE_KEY_PREFIX}${group}`, data);
      localStorage.setItem(`${CACHE_TIME_KEY_PREFIX}${group}`, now.toString());

      return resultFor(parseTLE(data, group), 'live', now);
    }
  } catch (cdnErr) {
    console.warn(`Satvisor CDN fetch failed for group ${group}, trying live CelesTrak...`, cdnErr);
  }

  // 3. Fallback: Fetch directly from CelesTrak (might trigger 403 if refreshed frequently)
  try {
    const response = await fetch(celestrakUrl);
    
    if (response.status === 403) {
      throw new Error("Rate limited by CelesTrak (403).");
    }

    if (!response.ok) {
      throw new Error(`CelesTrak returned error: ${response.statusText}`);
    }

    const data = await response.text();
    
    if (data.includes("GP data has not updated") || data.includes("Forbidden") || data.length < 100) {
      throw new Error("Rate limit active (data not updated yet).");
    }

    // Cache the successful fetch
    localStorage.setItem(`${CACHE_KEY_PREFIX}${group}`, data);
    localStorage.setItem(`${CACHE_TIME_KEY_PREFIX}${group}`, now.toString());

      return resultFor(parseTLE(data, group), 'live', now);
  } catch (error: any) {
    console.error(`Failed live CelesTrak fetch for group ${group}:`, error);
    const errorDetails = error?.message || String(error);
    
    // 4. Fallback to LEO dataset or local static file for starlink if first load and rate-limited
    if (group === 'starlink') {
      console.warn("First load rate-limit. Fetching LEO dataset from CDN fallback...");
      try {
        const cdnResponse = await fetch('https://cdn.jsdelivr.net/npm/globe.gl/example/datasets/space-track-leo.txt');
        if (cdnResponse.ok) {
          const cdnData = await cdnResponse.text();
          const parsed = parseTLE(cdnData, group);
          // Filter to keep only Starlink satellites
          const starlinks = parsed.filter(s => s.name.toUpperCase().includes('STARLINK'));
          if (starlinks.length > 0) {
            return resultFor(starlinks, 'local_fallback', now, errorDetails);
          }
        }
      } catch (cdnErr) {
        console.error("CDN fallback fetch failed, trying local fallback file...", cdnErr);
      }

      // Secondary fallback to local file
      try {
        const localResponse = await fetch('/starlink_fallback.txt');
        if (localResponse.ok) {
          const localData = await localResponse.text();
          return resultFor(parseTLE(localData, group), 'local_fallback', now, errorDetails);
        }
      } catch (localErr) {
        console.error("Local fallback file fetch failed:", localErr);
      }
    }

    // 5. Fallback to expired cache if available
    if (cachedData) {
      return resultFor(
        parseTLE(cachedData, group),
        'cache',
        cachedTime ? Number(cachedTime) : now,
        `${errorDetails} (Using expired cache)`
      );
    }

    // 6. Fallback to hardcoded TLE if absolutely nothing else works
    console.warn("No cache or local files available. Falling back to embedded core satellites.");
    return resultFor(
      parseTLE(FALLBACK_TLE, group),
      'hardcoded_fallback',
      now,
      `${errorDetails} (Using core emergency set)`
    );
  }
}

export function parseTLE(tleData: string, group?: string): SatelliteData[] {
  const lines = tleData
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  const satellites: SatelliteData[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      // Clean up optional "0 " prefix from name
      const name = lines[i].replace(/^0 /, '').trim();
      const tleLine1 = lines[i + 1];
      const tleLine2 = lines[i + 2];

      if (tleLine1.length >= 68 && tleLine2.length >= 68) {
        try {
          const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
          if (satrec) {
            satellites.push({ name, satrec, epochMs: tleEpochMs(satrec), group });
          }
        } catch (cause) {
          console.warn(
            `Skipped malformed TLE entry "${name}": ${cause instanceof Error ? cause.message : String(cause)}`
          );
        }
      }
    }
  }

  return satellites;
}

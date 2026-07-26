import { Crosshair, LocateFixed } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { horizonObjects, nextSatellitePass } from '../lib/ephemeris/observerSky';
import { useFlight } from '../flight/useFlight';
import { ISS_NORAD_ID, useSatelliteGroups } from '../scene/satelliteGroups';
import { OBSERVER_PRESETS, type ObserverLocation, useObserverSettings } from '../scene/observerSettings';
import { useSimTime } from '../scene/useSimTime';
import { useViewSettings } from '../scene/viewSettings';
import { tleHealthLabel } from '../lib/dataHealth';

function formatAngle(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}°`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
  }).format(date);
}

function customLocation(position: GeolocationPosition): ObserverLocation {
  return {
    label: 'Device location',
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    elevationM: position.coords.altitude ?? 0
  };
}

/**
 * A compact topocentric observatory readout. It never asks for device location
 * until the visitor explicitly chooses it; presets remain entirely local.
 */
export function ObserverPanel() {
  const target = useFlight((state) => state.target);
  const light = useViewSettings((state) => state.theme === 'light');
  const location = useObserverSettings((state) => state.location);
  const setLocation = useObserverSettings((state) => state.setLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [stationError, setStationError] = useState<string | null>(null);
  const [observerTime, setObserverTime] = useState(() => {
    const date = useSimTime.getState().date;
    return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
  });
  const load = useSatelliteGroups((state) => state.load);
  const stations = useSatelliteGroups((state) => state.sets.stations);
  const stationsHealth = useSatelliteGroups((state) => state.health.stations);

  useEffect(() => {
    void load('stations').catch((cause) => {
      setStationError(`Station elements unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    });
  }, [load]);

  useEffect(() => {
    return useSimTime.subscribe((state, previous) => {
      const currentMinute = Math.floor(state.date.getTime() / 60_000);
      const previousMinute = Math.floor(previous.date.getTime() / 60_000);
      if (currentMinute !== previousMinute) setObserverTime(new Date(currentMinute * 60_000));
    });
  }, []);

  const horizon = useMemo(() => horizonObjects(location, observerTime), [location, observerTime]);
  const visible = horizon.filter((object) => object.visible).sort((a, b) => b.altitude - a.altitude);
  const iss = stations?.find((item) => Number(item.satrec.satnum) === ISS_NORAD_ID);
  const pass = useMemo(
    () => (iss ? nextSatellitePass(iss, location, observerTime) : null),
    [iss, location, observerTime]
  );

  if (target !== null) return null;

  const surface = light
    ? 'border-slate-300/60 bg-white/70 text-slate-700'
    : 'border-white/10 bg-black/70 text-white';
  const muted = light ? 'text-slate-500' : 'text-white/45';

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('This browser does not provide device location.');
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation(customLocation(position)),
      (error) => setLocationError(`Location unavailable: ${error.message}`),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }
    );
  };

  return (
    <aside
      aria-label="Observer sky"
      className={`pointer-events-auto fixed left-6 top-6 z-10 hidden w-64 rounded-2xl border p-5 backdrop-blur-xl lg:block ${surface}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-[10px] uppercase tracking-[0.28em] ${light ? 'text-sky-600/80' : 'text-sky-300/70'}`}>
            Local sky
          </h2>
          <p className={`mt-1 text-[10px] ${muted}`}>Topocentric ephemeris · horizon</p>
        </div>
        <Crosshair className={`mt-0.5 h-4 w-4 ${light ? 'text-sky-600' : 'text-sky-200/80'}`} aria-hidden />
      </header>

      <div className="mt-4 flex gap-2">
        <select
          value={OBSERVER_PRESETS.some((preset) => preset.label === location.label) ? location.label : ''}
          onChange={(event) => {
            const preset = OBSERVER_PRESETS.find((item) => item.label === event.target.value);
            if (preset) setLocation(preset);
          }}
          aria-label="Observation location"
          className={`min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-2 text-[11px] outline-none ${light ? 'border-slate-300 text-slate-700' : 'border-white/10 text-white/80'}`}
        >
          {location.label === 'Device location' && <option value="">Device location</option>}
          {OBSERVER_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
        </select>
        <button
          type="button"
          onClick={useDeviceLocation}
          aria-label="Use device location"
          title="Use device location"
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${light ? 'border-slate-300 text-slate-500 hover:text-sky-700' : 'border-white/10 text-white/50 hover:text-sky-100'}`}
        >
          <LocateFixed className="h-3.5 w-3.5" />
        </button>
      </div>
      {locationError && <p className="mt-2 text-[10px] leading-relaxed text-red-300/90">{locationError}</p>}

      <ul className="mt-4 space-y-2.5">
        {visible.length > 0 ? visible.slice(0, 4).map((object) => (
          <li key={object.name} className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] tracking-tight">{object.name}</span>
            <span className={`text-[10px] tabular-nums ${light ? 'text-sky-700' : 'text-sky-100/85'}`}>
              {formatAngle(object.altitude)} alt · {Math.round(object.azimuth)}° az
            </span>
          </li>
        )) : <li className={`text-[11px] ${muted}`}>No selected bright body is above the horizon.</li>}
      </ul>

      <div className={`mt-5 border-t pt-4 ${light ? 'border-slate-200' : 'border-white/8'}`}>
        <div className={`text-[10px] uppercase tracking-[0.2em] ${muted}`}>Next ISS pass</div>
        {stationError ? (
          <p className="mt-1 text-[11px] leading-relaxed text-red-300/90">{stationError}</p>
        ) : !stations ? (
          <p className={`mt-1 text-[11px] ${muted}`}>Loading current station elements…</p>
        ) : pass ? (
          <p className="mt-1 text-[11px] leading-relaxed">
            Rise {formatTime(pass.rise)} · peak {formatAngle(pass.peakAltitude)} · set {formatTime(pass.set)}
          </p>
        ) : (
          <p className={`mt-1 text-[11px] ${muted}`}>No ISS pass above the horizon in the next 24 hours.</p>
        )}
        <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>TLE prediction sampled at one-minute cadence; 10° minimum altitude; times are UTC.</p>
        {stationsHealth && <p className={`mt-1 text-[10px] leading-relaxed ${muted}`}>{tleHealthLabel(stationsHealth)}</p>}
      </div>
    </aside>
  );
}

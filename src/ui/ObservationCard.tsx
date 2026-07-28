import { useCallback, useEffect, useState } from 'react';
import { fetchEarthObservation, fetchSolarObservation, type EarthObservation, type SolarObservation } from '../services/observations';
import { DataProvenanceBadge } from './DataProvenanceBadge';

type ObservationTarget = 'earth' | 'sun';
type Observation = EarthObservation | SolarObservation;

function formatUtc(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

function isEarth(observation: Observation): observation is EarthObservation {
  return 'observedAt' in observation;
}

/**
 * A source image is evidence beside the WebGL model, never a texture silently
 * projected over it. EPIC carries a capture time; the SDO asset only exposes
 * its publisher update time and the card says exactly that.
 */
export function ObservationCard({ target }: { target: ObservationTarget }) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const next = target === 'earth'
        ? await fetchEarthObservation(signal)
        : await fetchSolarObservation(signal);
      if (!signal?.aborted) setObservation(next);
    } catch (cause) {
      if (signal?.aborted) return;
      setObservation(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const title = target === 'earth' ? 'Earth observation' : 'Solar observation';

  return (
    <section className="mb-5 border-y border-sky-300/10 py-4" aria-busy={loading}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-sky-200/70">{title}</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-white/40">Source image; not mapped onto this simulation.</p>
        </div>
        <DataProvenanceBadge kind={error ? 'unavailable' : 'observed'}>{error ? 'Unavailable' : 'Observed'}</DataProvenanceBadge>
      </div>

      {error ? (
        <p className="mt-3 text-[11px] leading-relaxed text-rose-200/90">NASA source unavailable: {error}</p>
      ) : observation ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/25">
          <a href={observation.sourceUrl} target="_blank" rel="noreferrer" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
            <img src={observation.imageUrl} alt={isEarth(observation) ? 'NASA EPIC full-disc Earth observation' : 'NASA SDO AIA 171 solar observation'} className="aspect-square w-full object-cover" />
          </a>
          <div className="space-y-1.5 px-3 py-3">
            <p className="text-[11px] text-white/80">{observation.source}</p>
            {isEarth(observation) ? (
              <p className="text-[10px] tabular-nums text-white/45">Observed {formatUtc(observation.observedAt)}</p>
            ) : (
              <>
                <p className="text-[10px] tabular-nums text-white/45">Asset updated {formatUtc(observation.publishedAt)}</p>
                <p className="text-[10px] leading-relaxed text-white/35">{observation.timestampNote}</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-white/45">Loading the NASA source image…</p>
      )}
    </section>
  );
}

type Provenance = 'observed' | 'calculated' | 'predicted' | 'catalogued' | 'procedural' | 'unavailable';

const STYLES: Record<Provenance, string> = {
  observed: 'border-sky-300/30 bg-sky-300/10 text-sky-100',
  calculated: 'border-violet-300/30 bg-violet-300/10 text-violet-100',
  predicted: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  catalogued: 'border-teal-300/30 bg-teal-300/10 text-teal-100',
  procedural: 'border-slate-300/25 bg-slate-300/10 text-slate-200',
  unavailable: 'border-rose-300/30 bg-rose-300/10 text-rose-100'
};

interface DataProvenanceBadgeProps {
  kind: Provenance;
  children: string;
}

/** Small, explicit evidence labels keep observed imagery distinct from the rendered simulation. */
export function DataProvenanceBadge({ kind, children }: DataProvenanceBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${STYLES[kind]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

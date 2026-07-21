interface RowProps {
  label: string;
  value: string;
}

/** One labelled figure in a dossier. Shared by every panel so they read alike. */
export function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-white/5 py-2 last:border-b-0">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</dt>
      <dd className="text-right text-[13px] tabular-nums text-white/85">{value}</dd>
    </div>
  );
}

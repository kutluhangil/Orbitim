import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { useSimTime } from '../scene/useSimTime';
import { SATELLITE_GROUPS, useSatelliteGroups } from '../scene/satelliteGroups';
import { replaceShareState, shareUrl, type ShareState } from '../lib/urlState';
import { useTranslation } from './i18n';

const DEFAULT_GROUPS = SATELLITE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id);

/** Snapshot of everything the URL carries, taken at the instant of the click. */
function currentState(): ShareState {
  const time = useSimTime.getState();
  const enabled = useSatelliteGroups.getState().enabled;
  const isDefault =
    enabled.length === DEFAULT_GROUPS.length && enabled.every((id) => DEFAULT_GROUPS.includes(id));
  return {
    date: time.date,
    multiplier: time.multiplier,
    playing: time.playing,
    groups: isDefault ? null : enabled
  };
}

/**
 * Copies a link to exactly what is on screen — this body, this instant, this
 * rate. The instant is stamped at the click, so the shared sky is the one the
 * sharer is looking at, not whatever it drifts to afterwards.
 */
type Status = 'idle' | 'copied' | 'address-bar';

export function ShareLink() {
  const [status, setStatus] = useState<Status>('idle');
  const { t } = useTranslation();

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const share = async () => {
    const state = currentState();
    // Always update the address bar first, so the link is recoverable even if
    // the clipboard is blocked (an insecure context, or a denied permission).
    replaceShareState(state);
    try {
      await navigator.clipboard.writeText(shareUrl(state));
      setStatus('copied');
    } catch {
      setStatus('address-bar');
    }
  };

  const label = status === 'copied' ? t('linkCopied') : status === 'address-bar' ? t('inAddressBar') : t('shareView');

  return (
    <button
      type="button"
      onClick={share}
      className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 text-[10px] uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl transition-colors hover:border-sky-300/50 hover:text-sky-100"
    >
      {status === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

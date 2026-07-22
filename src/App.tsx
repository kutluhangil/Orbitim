import { useEffect, useRef, useState } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { BodyRail } from './ui/BodyRail';
import { InfoPanel } from './ui/InfoPanel';
import { TimeControls } from './ui/TimeControls';
import { Landing } from './ui/Landing';
import { ViewControls } from './ui/ViewControls';
import { BodyModal } from './ui/BodyModal';
import { useBodyModal } from './ui/bodyModalState';
import { useFlight } from './flight/useFlight';
import { SatellitePanel } from './ui/SatellitePanel';
import { SatelliteInfo } from './ui/SatelliteInfo';
import { useSatelliteSelection } from './scene/satelliteSelection';
import { useSimTime } from './scene/useSimTime';
import { SATELLITE_GROUPS, useSatelliteGroups } from './scene/satelliteGroups';
import { readShareState, replaceShareState } from './lib/urlState';

const DEFAULT_GROUPS = SATELLITE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id);

/** Current enabled set, or null when it is exactly the default. */
function nonDefaultGroups(enabled: string[]): string[] | null {
  const isDefault =
    enabled.length === DEFAULT_GROUPS.length && enabled.every((id) => DEFAULT_GROUPS.includes(id));
  return isDefault ? null : enabled;
}

function App() {
  const [entered, setEntered] = useState(false);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const satellite = useSatelliteSelection((s) => s.selected);

  // A shared link is a specific moment. Restoring it once on load applies the
  // instant, rate and constellations it carries, so the link opens on the sky
  // the sharer meant. The ref guard keeps it to a single pass under StrictMode's
  // double-invoked effects.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const shared = readShareState();
    if (!shared.present) return;

    const time = useSimTime.getState();
    if (shared.date) time.setDate(shared.date);
    if (shared.multiplier !== undefined) time.setMultiplier(shared.multiplier);
    if (shared.playing !== undefined && shared.playing !== time.playing) time.togglePlaying();
    if (shared.groups) useSatelliteGroups.setState({ enabled: shared.groups });

    setEntered(true);
  }, []);

  // Keep the address bar roughly in step with the view. The instant is written
  // on the events that change it — changing rate, pausing, toggling a
  // constellation — not every frame, which would bury the history.
  useEffect(() => {
    if (!entered) return;
    const write = () => {
      const time = useSimTime.getState();
      replaceShareState({
        date: time.date,
        multiplier: time.multiplier,
        playing: time.playing,
        groups: nonDefaultGroups(useSatelliteGroups.getState().enabled)
      });
    };
    write();
    const unsubscribe = [
      useSimTime.subscribe((s, p) => (s.playing !== p.playing || s.multiplier !== p.multiplier) && write()),
      useSatelliteGroups.subscribe((s, p) => s.enabled !== p.enabled && write())
    ];
    return () => unsubscribe.forEach((off) => off());
  }, [entered]);

  // Arriving at a body raises its dossier as a hero card, once — on the
  // transition into orbit, not every frame while there. Leaving a body drops any
  // card with it, so it never lingers over a world no longer in frame.
  useEffect(() => {
    if (!entered) return;
    return useFlight.subscribe((s, p) => {
      const modal = useBodyModal.getState();
      if (s.phase === 'orbiting' && p.phase !== 'orbiting' && s.target) modal.open(s.target);
      else if (s.phase !== 'orbiting' && p.phase === 'orbiting') modal.close();
    });
  }, [entered]);

  // Escape is the way back out of a body, so a visitor who has flown somewhere
  // is never dependent on finding the rail again. It unwinds one step at a time:
  // an open dossier is closed first, then a selected satellite is let go of
  // before the planet is.
  useEffect(() => {
    if (!entered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (useBodyModal.getState().bodyId) {
        useBodyModal.getState().close();
        return;
      }

      const selection = useSatelliteSelection.getState();
      if (selection.selected) {
        const wasFollowing = selection.following;
        selection.clear();
        if (wasFollowing) useFlight.getState().refocus();
        return;
      }
      returnToOverview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered, returnToOverview]);

  return (
    /* Dynamic viewport units: on a phone `100vh` is the tallest the browser
       chrome ever gets, which leaves the scene cropped under the address bar. */
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white antialiased">
      <SceneRoot />

      {entered ? (
        <>
          <BodyRail />
          {/* One dossier at a time, in one place: a satellite is read instead of
              the world it is orbiting, not alongside it. */}
          {satellite ? <SatelliteInfo /> : <InfoPanel />}
          <SatellitePanel />
          <ViewControls />
          <TimeControls />
          <BodyModal />
        </>
      ) : (
        <Landing onEnter={() => setEntered(true)} />
      )}
    </div>
  );
}

export default App;

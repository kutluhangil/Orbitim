import { useEffect, useState } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { BodyRail } from './ui/BodyRail';
import { InfoPanel } from './ui/InfoPanel';
import { TimeControls } from './ui/TimeControls';
import { Landing } from './ui/Landing';
import { useFlight } from './flight/useFlight';
import { SatellitePanel } from './ui/SatellitePanel';
import { SatelliteInfo } from './ui/SatelliteInfo';
import { useSatelliteSelection } from './scene/satelliteSelection';

function App() {
  const [entered, setEntered] = useState(false);
  const returnToOverview = useFlight((s) => s.returnToOverview);
  const satellite = useSatelliteSelection((s) => s.selected);

  // Escape is the way back out of a body, so a visitor who has flown somewhere
  // is never dependent on finding the rail again. It unwinds one step at a time:
  // a selected satellite is let go of before the planet is.
  useEffect(() => {
    if (!entered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

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
          <TimeControls />
        </>
      ) : (
        <Landing onEnter={() => setEntered(true)} />
      )}
    </div>
  );
}

export default App;

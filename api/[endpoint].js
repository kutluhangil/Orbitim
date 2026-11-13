// Hobby plan allows 12 functions per deployment, so every NASA/JPL proxy
// shares this single dynamic route: /api/<endpoint> dispatches to api/_endpoints.

import deepSky from './_endpoints/deep-sky.js';
import earthEvents from './_endpoints/earth-events.js';
import earthObservation from './_endpoints/earth-observation.js';
import earthdataCollections from './_endpoints/earthdata-collections.js';
import exoplanets from './_endpoints/exoplanets.js';
import horizons from './_endpoints/horizons.js';
import nasaMedia from './_endpoints/nasa-media.js';
import nearApproaches from './_endpoints/near-approaches.js';
import pdsTargets from './_endpoints/pds-targets.js';
import smallBody from './_endpoints/small-body.js';
import solarObservation from './_endpoints/solar-observation.js';
import spaceWeather from './_endpoints/space-weather.js';
import tessCandidates from './_endpoints/tess-candidates.js';

const handlers = {
  'deep-sky': deepSky,
  'earth-events': earthEvents,
  'earth-observation': earthObservation,
  'earthdata-collections': earthdataCollections,
  'exoplanets': exoplanets,
  'horizons': horizons,
  'nasa-media': nasaMedia,
  'near-approaches': nearApproaches,
  'pds-targets': pdsTargets,
  'small-body': smallBody,
  'solar-observation': solarObservation,
  'space-weather': spaceWeather,
  'tess-candidates': tessCandidates,
};

export default function handler(req, res) {
  const route = handlers[req.query.endpoint];
  if (!route) {
    res.status(404).json({ error: 'Unknown API endpoint.' });
    return undefined;
  }
  return route(req, res);
}

import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

async function enterSystem(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the system' }).click();
  await expect(page.getByRole('button', { name: 'Open scene controls' })).toBeVisible();
}

async function enterDesktopSystem(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the system' }).click();
  await expect(page.getByRole('button', { name: 'Open Explore Atlas' })).toBeVisible();
}

test('mobile scene controls open from one collision-free cockpit and localize', async ({ page }) => {
  await enterSystem(page);

  await expect(page.getByRole('button', { name: 'Share view' })).toBeHidden();
  await page.getByRole('button', { name: 'Open scene controls' }).click();

  const cockpit = page.locator('#mobile-cockpit');
  await expect(cockpit).toBeVisible();
  await expect(cockpit.getByRole('radiogroup', { name: 'Experience mode' })).toBeVisible();
  await expect(cockpit.getByRole('button', { name: 'Share view' })).toBeVisible();

  await cockpit.getByRole('button', { name: 'TR' }).click();
  await expect(page.getByRole('button', { name: 'Sahne kontrollerini kapat' })).toBeVisible();
  await expect(cockpit.getByRole('button', { name: 'Görünümü paylaş' })).toBeVisible();
});

test('Data Health keeps observed, calculated and operational sources distinct', async ({ page }) => {
  await enterSystem(page);

  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open data health' }).click();

  const health = page.getByRole('dialog', { name: 'Evidence map' });
  await expect(health).toBeVisible();
  await expect(health.getByText('Rendered surfaces and moon models', { exact: true })).toBeVisible();
  await expect(health.getByText('Operational satellite tracking', { exact: true })).toBeVisible();
  await expect(health.getByText('This is operational orbital data, not a NASA data service', { exact: false })).toBeVisible();

  await health.getByRole('button', { name: 'Return to simulation' }).click();
  await expect(health).toBeHidden();
});

test('scene exposes a recoverable WebGL context state', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await canvas.evaluate((element) => element.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.getByRole('status')).toContainText('Restoring WebGL scene');

  await canvas.evaluate((element) => element.dispatchEvent(new Event('webglcontextrestored')));
  await expect(page.getByRole('status')).toBeHidden();
});

test('a Time Journey pauses the cited instant and starts a continuous body flight', async ({ page }) => {
  await enterSystem(page);

  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open time journeys' }).click();

  const journeys = page.getByRole('dialog', { name: 'Revisit a measured moment.' });
  await expect(journeys).toBeVisible();
  await expect(journeys.getByText('Apollo 11 · Tranquility Base', { exact: true })).toBeVisible();
  await expect(journeys.getByText('lunar-module trajectory is not rendered', { exact: false })).toBeVisible();

  await journeys.getByRole('button', { name: 'Begin journey: Apollo 11 · Tranquility Base' }).click();
  await expect(journeys).toBeHidden();
  await expect(page.getByRole('button', { name: 'Resume simulated time' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toContain('t=1969-07-20T20%3A17%3A40Z');
});

test('Explore Atlas reads a bounded, source-stamped JPL small-body record', async ({ page }) => {
  const requestedUrls: string[] = [];
  await page.route('**/api/small-body?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedUrls.push(requestUrl.toString());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'resolved', query: requestUrl.searchParams.get('q'), matches: [],
        record: {
          name: '99942 Apophis (2004 MN4)', designation: '99942', kind: 'an', orbitClass: 'Aten', neo: true, pha: true,
          diameterKm: 0.34, absoluteMagnitude: 19.09, albedo: 0.3, rotationHours: 30.56,
          perihelionAu: 0.746, aphelionAu: 1.099, semiMajorAu: 0.922, eccentricity: 0.191, inclinationDeg: 3.34,
          earthMoidAu: 0.00025, conditionCode: '0', lastObserved: '2026-07-28',
          earthApproaches: [{ at: '2029-Apr-13 21:46', distanceAu: 0.00025, velocityKmS: 5.84, uncertainty: '< 00:01' }],
          detailUrl: 'https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=99942'
        },
        source: 'NASA/JPL Small-Body Database (SBDB) API', sourceUrl: 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html', fetchedAt: '2026-07-29T12:00:00.000Z'
      })
    });
  });

  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();
  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Open atlas entry: Small-body intelligence' }).click();
  await expect(atlas.getByRole('heading', { name: 'Read a small body before drawing it.' })).toBeVisible();
  await atlas.getByRole('textbox', { name: 'Asteroid or comet; e.g. Apophis or 1P/Halley' }).fill('Apophis');
  await atlas.getByRole('button', { name: 'Resolve body' }).click();
  await expect(atlas.getByText('99942 Apophis (2004 MN4)', { exact: true })).toBeVisible();
  await expect(atlas.getByText('Potentially hazardous', { exact: true })).toBeVisible();
  await expect(atlas.getByRole('link', { name: 'Open SBDB documentation' })).toHaveAttribute('href', 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html');
  await expect.poll(() => requestedUrls.some((value) => new URL(value).searchParams.get('q') === 'Apophis')).toBeTruthy();
});

test('Earth exposes the Moon through its child dock', async ({ page }) => {
  await enterSystem(page);

  await page.getByRole('button', { name: 'Show moons of Earth' }).click();
  const moonDock = page.getByRole('group', { name: 'Earth moons' });
  await expect(moonDock).toBeVisible();
  await expect(moonDock.getByRole('button', { name: 'Visit Moon' })).toBeVisible();
});

test('Explore Atlas keeps source and uncertainty labels visible in Turkish', async ({ page }) => {
  test.setTimeout(60_000);
  await enterSystem(page);

  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await expect(atlas).toBeVisible();
  await expect(atlas.getByText('Unknown remains unknown.', { exact: true })).toBeVisible();

  await atlas.getByRole('button', { name: 'Other worlds' }).click();
  await expect(atlas.getByRole('complementary')).toContainText('Confirmed worlds');
  await expect(atlas.getByRole('link', { name: /Open primary source.*NASA Exoplanet Catalog/ })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'TR', exact: true }).click();
  await page.getByRole('button', { name: 'Keşfet Atlasını aç' }).click();

  const turkishAtlas = page.getByRole('dialog', { name: 'Orbitim Keşfet Atlası' });
  await expect(turkishAtlas.getByText('Bilinmeyen, bilinmeyen kalır.', { exact: true })).toBeVisible();
  await expect(turkishAtlas.getByText('Değişken', { exact: true })).toBeVisible();
});

test('Explore Atlas renders a validated NASA archive catalogue page', async ({ page }) => {
  test.setTimeout(60_000);
  const requestedUrls: string[] = [];
  await page.route('**/api/exoplanets?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedUrls.push(requestUrl.toString());
    const requestedPage = Number(requestUrl.searchParams.get('page') ?? '0');
    const requestedMethod = requestUrl.searchParams.get('method');
    const requestedQuery = requestUrl.searchParams.get('q') ?? '';
    const fetchedAt = requestedQuery === 'INVALID' ? '2026-02-30T12:00:00.000Z' : '2026-07-29T12:00:00.000Z';
    const name = requestedPage === 1
      ? 'Kepler-452 b'
      : (requestedMethod === 'transit' || requestedQuery.includes('TRAPPIST')) ? 'TRAPPIST-1 b' : 'HD 209458 b';
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        records: [
          {
            name, hostName: name === 'HD 209458 b' ? 'HD 209458' : 'TRAPPIST-1', discoveryMethod: 'Transit', discoveryYear: 2016,
            radiusEarth: 1.116, massEarth: 1.374, orbitDays: 1.5109, equilibriumTemperatureK: null,
            distanceParsecs: 12.43, starTemperatureK: 2566, rightAscensionDeg: 346.62, declinationDeg: -5.04,
            facility: 'Transiting Planets and Planetesimals Small Telescope', semiMajorAxisAu: 0.01154, eccentricity: null
          }
        ],
        total: 96, page: requestedPage, limit: 48,
        source: 'NASA Exoplanet Archive · PSCompPars',
        sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/API_resources.html',
        fetchedAt
      })
    });
  });

  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Other worlds' }).click();
  await expect(atlas.getByRole('heading', { name: 'Confirmed exoplanets' })).toBeVisible();
  await expect(atlas.getByText('HD 209458 b', { exact: true })).toBeVisible();
  await expect(atlas.getByText('Not reported', { exact: true })).toBeVisible();
  await expect(atlas.getByRole('region', { name: 'Earth reference' })).toContainText('Radius / Earth');
  await expect(atlas.getByRole('region', { name: 'Earth reference' })).toContainText('Semi-major axis / Earth orbit');
  await expect(atlas.getByRole('link', { name: 'Open NASA archive documentation' })).toHaveAttribute(
    'href',
    'https://exoplanetarchive.ipac.caltech.edu/docs/API_resources.html'
  );

  await atlas.getByRole('searchbox', { name: 'Search planet or host star' }).fill('TRAPPIST-1');
  await expect(atlas.getByText('TRAPPIST-1 b', { exact: true })).toBeVisible();
  await expect.poll(() => requestedUrls.some((value) => new URL(value).searchParams.get('q') === 'TRAPPIST-1')).toBeTruthy();

  await atlas.getByRole('button', { name: 'Transit', exact: true }).click();
  await expect.poll(() => requestedUrls.some((value) => new URL(value).searchParams.get('method') === 'transit')).toBeTruthy();

  await atlas.getByRole('searchbox', { name: 'Search planet or host star' }).fill('');
  const nextPage = atlas.getByRole('button', { name: 'Next page' });
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(atlas.getByText('Kepler-452 b', { exact: true })).toBeVisible();
  await expect.poll(() => requestedUrls.some((value) => new URL(value).searchParams.get('page') === '1')).toBeTruthy();

  await atlas.getByRole('searchbox', { name: 'Search planet or host star' }).fill('INVALID');
  const alert = atlas.getByRole('alert');
  await expect(alert).toContainText('invalid fetchedAt timestamp');
});

test('Explore Atlas keeps credited NASA galaxy observations distinct from the simulation', async ({ page }) => {
  test.setTimeout(60_000);
  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Galaxies', exact: true }).click();
  await expect(atlas.getByRole('heading', { name: 'A nearby-universe field guide' })).toBeVisible();
  await expect(atlas.getByRole('article', { name: 'Selected target' })).toContainText('Andromeda · M31');

  await atlas.getByRole('button', { name: /NGC 1300/ }).click();
  const selected = atlas.getByRole('article', { name: 'Selected target' });
  await expect(selected).toContainText('Barred spiral galaxy');
  await expect(selected).toContainText('Distance not displayed here');
  await expect(selected.getByRole('link', { name: 'Read NGC 1300' })).toHaveAttribute('href', 'https://science.nasa.gov/image-detail/ngc-1300/');
});

test('Explore Atlas reveals a selected galaxy gallery after its module loads on mobile', async ({ page }) => {
  test.setTimeout(60_000);
  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Open atlas entry: Galaxy kinds' }).click();
  await expect(atlas.getByRole('heading', { name: 'A nearby-universe field guide' })).toBeInViewport();
});

test('Explore Atlas resolves a bounded NASA/IPAC NED object lookup', async ({ page }) => {
  test.setTimeout(60_000);
  const requestedUrls: string[] = [];
  await page.route('**/api/deep-sky?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedUrls.push(requestUrl.toString());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'resolved', query: requestUrl.searchParams.get('q'), aliases: [],
        record: {
          name: 'MESSIER 087', objectTypeCode: 'G', rightAscensionDeg: 187.70593, declinationDeg: 12.39112,
          redshift: 0.004283, redshiftUncertainty: 0.000013, redshiftReference: '1991RC3.9.C...0000d',
          detailUrl: 'https://ned.ipac.caltech.edu/NED::API/OverviewOfObject?TARGET=M87'
        },
        sourceUrl: 'https://ned.ipac.caltech.edu/Docs::API/',
        fetchedAt: '2026-07-29T12:00:00.000Z'
      })
    });
  });

  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Galaxies', exact: true }).click();
  await atlas.getByRole('button', { name: /Find a deep-sky object/ }).click();
  await expect(atlas.getByRole('heading', { name: 'Find a named deep-sky object' })).toBeVisible();
  await atlas.getByRole('textbox', { name: 'Object name, e.g. M31 or NGC 1300' }).fill('M87');
  await atlas.getByRole('button', { name: 'Resolve object' }).click();
  await expect(atlas.getByText('MESSIER 087', { exact: true })).toBeVisible();
  await expect(atlas.getByText('J2000 coordinates', { exact: true })).toBeVisible();
  await expect(atlas.getByRole('link', { name: 'Open NED object record' })).toHaveAttribute('href', 'https://ned.ipac.caltech.edu/NED::API/OverviewOfObject?TARGET=M87');
  await expect.poll(() => requestedUrls.some((value) => new URL(value).searchParams.get('q') === 'M87')).toBeTruthy();
});

test('Explore Atlas states when NASA/IPAC NED does not resolve an object name', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/api/deep-sky?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'not-found', query: requestUrl.searchParams.get('q'), aliases: [], record: null,
        sourceUrl: 'https://ned.ipac.caltech.edu/Docs::API/', fetchedAt: '2026-07-29T12:00:00.000Z'
      })
    });
  });

  await enterSystem(page);
  await page.getByRole('button', { name: 'Open scene controls' }).click();
  await page.getByRole('button', { name: 'Open Explore Atlas' }).click();

  const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
  await atlas.getByRole('button', { name: 'Galaxies', exact: true }).click();
  await atlas.getByRole('button', { name: /Find a deep-sky object/ }).click();
  await atlas.getByRole('textbox', { name: 'Object name, e.g. M31 or NGC 1300' }).fill('Not A Real Galaxy 1234');
  await atlas.getByRole('button', { name: 'Resolve object' }).click();
  await expect(atlas.getByText('NED did not resolve this as a known extragalactic object.')).toBeVisible();
});

test.describe('desktop Explore Atlas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Now mode keeps observed, reported and modelled solar impact feeds distinct', async ({ page }) => {
    await page.route('**/api/space-weather', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          flares: [], cmes: [], storms: [],
          impactStreams: [
            { id: 'energeticParticles', endpoint: 'SEP', evidence: 'observed', reports: [{ sepID: 'SEP-1' }], error: null },
            { id: 'interplanetaryShocks', endpoint: 'IPS', evidence: 'observed', reports: [{ activityID: 'IPS-1' }], error: null },
            { id: 'highSpeedStreams', endpoint: 'HSS', evidence: 'observed', reports: [], error: null },
            { id: 'radiationBelts', endpoint: 'RBE', evidence: 'observed', reports: [], error: null },
            { id: 'magnetopauseCrossings', endpoint: 'MPC', evidence: 'observed', reports: [], error: null },
            { id: 'notifications', endpoint: 'notifications', evidence: 'reported', reports: [{ messageID: 'NOTICE-1' }], error: null },
            { id: 'enlilSimulations', endpoint: 'WSAEnlilSimulations', evidence: 'modelled', reports: [], error: 'NASA DONKI WSAEnlilSimulations request failed with HTTP 503: maintenance' }
          ],
          fetchedAt: '2026-07-29T12:00:00.000Z', source: 'NASA DONKI'
        })
      });
    });

    await enterDesktopSystem(page);
    await page.getByRole('radio', { name: 'Now' }).click();

    const panel = page.getByRole('complementary', { name: 'Solar weather' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Solar impact ledger', { exact: true })).toBeVisible();
    await expect(panel.getByText('Energetic particles', { exact: true })).toBeVisible();
    await expect(panel.getByText('Observed event', { exact: true }).first()).toBeVisible();
    await expect(panel.getByText('Research notice', { exact: true })).toBeVisible();
    await expect(panel.getByText('Source unavailable', { exact: true })).toBeVisible();
    await expect(panel.getByText('0 reports', { exact: true }).first()).toBeVisible();
  });

  test('Earth Now reads EONET catalogue geometry without presenting it as imagery', async ({ page }) => {
    await page.route('**/api/earth-events', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'NASA EONET · open natural events',
          sourceUrl: 'https://eonet.gsfc.nasa.gov/docs/v3',
          events: [
            {
              id: 'EONET-TEST-1', title: 'Test Wildfire', categories: ['Wildfires'],
              observedAt: '2026-07-29T12:00:00.000Z', geometryType: 'Point',
              position: { longitude: -102.8436111, latitude: 44.7638889 }, magnitudeValue: 510, magnitudeUnit: 'acres',
              sourceUrl: 'https://example.test/events/test-wildfire'
            }
          ],
          fetchedAt: '2026-07-29T12:05:00.000Z'
        })
      });
    });

    await enterDesktopSystem(page);
    await page.getByRole('radio', { name: 'Now' }).click();
    await page.getByRole('button', { name: 'Visit Earth' }).click();

    const card = page.getByRole('region', { name: 'Open natural events' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Catalogued', { exact: true })).toBeVisible();
    await expect(card.getByText('Test Wildfire', { exact: true })).toBeVisible();
    await expect(card.getByText('Wildfires', { exact: true })).toBeVisible();
    await expect(card.getByText('44.76° N, 102.84° W · 510 acres', { exact: true })).toBeVisible();
    await expect(card.getByText('Latest listed geometry is not satellite imagery or a verified incident boundary.', { exact: false })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Open source for Test Wildfire' })).toHaveAttribute('href', 'https://example.test/events/test-wildfire');
  });

  test('Explore Atlas keeps TESS PC candidates separate from confirmed planets', async ({ page }) => {
    test.setTimeout(120_000);
    await page.route('**/api/exoplanets?*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: [], total: 0, page: 0, limit: 48, source: 'NASA Exoplanet Archive · PSCompPars', sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/API_resources.html', fetchedAt: '2026-07-29T12:00:00.000Z' }) });
    });
    await page.route('**/api/tess-candidates?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          records: [{ toi: '1234.01', ticId: 987654321, disposition: 'PC', periodDays: 3.21, durationHours: 2.3, transitDepthPpm: 610, radiusEarth: 1.8, insolationEarth: null, equilibriumTemperatureK: 840, distanceParsecs: 98.4, starTemperatureK: null, rightAscensionDeg: null, declinationDeg: null, createdAt: null, releaseDate: null, sectors: null }],
          total: 1, page: 0, limit: 48, source: 'NASA Exoplanet Archive · TESS TOI · PC', sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html', fetchedAt: '2026-07-29T12:00:00.000Z'
        })
      });
    });

    await enterDesktopSystem(page);
    await page.getByRole('button', { name: 'Open Explore Atlas' }).click();
    const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
    await atlas.getByRole('button', { name: 'Other worlds' }).click();
    await atlas.getByRole('tab', { name: 'TESS candidates' }).click();
    await expect(atlas.getByRole('heading', { name: 'TESS planet candidates' })).toBeVisible();
    await expect(atlas.getByText('Planet candidate · not confirmed', { exact: true })).toBeVisible();
    await expect(atlas.getByRole('heading', { name: 'TOI 1234.01' })).toBeVisible();
    await expect(atlas.getByRole('link', { name: 'Open NASA TAP documentation' })).toHaveAttribute('href', 'https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html');
  });

  test('Explore Atlas preserves NASA media IDs and original-record links', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/nasa-media?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ nasaId: 'jwst-test-image', title: 'Test Webb mirror', description: 'NASA supplied archive caption.', center: 'GSFC', dateCreated: '2026-07-01T00:00:00Z', thumbnailUrl: 'https://example.test/jwst-thumb.jpg', assetUrl: 'https://images.nasa.gov/details/jwst-test-image' }],
          total: 1, page: 1, limit: 20, omittedItems: 0, source: 'NASA Image and Video Library', sourceUrl: 'https://images.nasa.gov/search-results?q=James%20Webb%20Space%20Telescope', fetchedAt: '2026-07-29T12:00:00.000Z'
        })
      });
    });

    await enterDesktopSystem(page);
    await page.getByRole('button', { name: 'Open Explore Atlas' }).click();
    const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
    await atlas.getByRole('button', { name: 'How we know' }).click();
    await expect(atlas.locator('#nasa-media-library-title')).toBeVisible();
    await expect(atlas.getByText('NASA ID · jwst-test-image', { exact: true })).toBeVisible();
    await expect(atlas.getByRole('img', { name: 'Test Webb mirror' })).toBeVisible();
    await expect(atlas.getByRole('link', { name: 'Open original NASA record' }).first()).toHaveAttribute('href', 'https://images.nasa.gov/details/jwst-test-image');
  });

  test('Explore Atlas keeps CMR collection metadata and PDS target context separate from imagery', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/earthdata-collections?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          records: [{
            id: 'C1234567890-NSIDC', title: 'IceBridge L4 Surface Elevation', shortName: 'ILNSA1B', versionId: '2', archiveCenter: 'NSIDC_ECS',
            summary: 'A tested NASA collection record.', timeStart: '2009-01-01T00:00:00Z', timeEnd: null,
            browseAvailable: true, onlineAccess: true, metadataUrl: 'https://cmr.earthdata.nasa.gov/search/concepts/C1234567890-NSIDC.umm_json'
          }],
          total: 1, page: 1, limit: 12, source: 'NASA Earthdata CMR · collection metadata',
          sourceUrl: 'https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html', fetchedAt: '2026-07-29T12:00:00.000Z'
        })
      });
    });
    await page.route('**/api/pds-targets?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          records: [{
            id: 'urn:nasa:pds:context:target:satellite.jupiter.europa::1.2', type: 'Product_Context', title: 'Europa', version: '1.2',
            updatedAt: '2025-04-24T00:00:00Z', labelUrl: 'https://pds.nasa.gov/data/pds4/context-pds4/target/satellite.jupiter.europa_1.2.xml'
          }],
          total: 1, target: 'Europa', limit: 12, source: 'NASA PDS API · target context metadata',
          sourceUrl: 'https://nasa-pds.github.io/pds-api/guides/search.html', fetchedAt: '2026-07-29T12:00:00.000Z', coverage: 'partial'
        })
      });
    });

    await enterDesktopSystem(page);
    await page.getByRole('button', { name: 'Open Explore Atlas' }).click();
    const atlas = page.getByRole('dialog', { name: 'Orbitim Explore Atlas' });
    await atlas.getByRole('button', { name: 'Open atlas entry: Find NASA datasets' }).click();
    await expect(atlas.locator('#nasa-archive-finder-title')).toBeVisible();
    await expect(atlas.getByText('Collection metadata only.', { exact: false })).toBeVisible();
    await expect(atlas.getByText('IceBridge L4 Surface Elevation', { exact: true })).toBeVisible();
    await expect(atlas.getByRole('link', { name: 'Open CMR metadata' })).toHaveAttribute('href', 'https://cmr.earthdata.nasa.gov/search/concepts/C1234567890-NSIDC.umm_json');

    await atlas.getByRole('tab', { name: 'PDS target context' }).click();
    await expect(atlas.getByText('Target-context metadata only.', { exact: false })).toBeVisible();
    await expect(atlas.getByText('urn:nasa:pds:context:target:satellite.jupiter.europa::1.2', { exact: true })).toBeVisible();
    await expect(atlas.getByRole('link', { name: 'Open PDS label' })).toHaveAttribute('href', 'https://pds.nasa.gov/data/pds4/context-pds4/target/satellite.jupiter.europa_1.2.xml');
  });

  test('Escape returns to the same selected world', async ({ page }) => {
    await enterDesktopSystem(page);

    const mars = page.getByRole('button', { name: 'Visit Mars' });
    await mars.click();
    await expect(mars).toHaveAttribute('aria-current', 'page');

    const openAtlas = page.getByRole('button', { name: 'Open Explore Atlas' });
    await openAtlas.click();
    await expect(page.getByRole('dialog', { name: 'Orbitim Explore Atlas' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog', { name: 'Orbitim Explore Atlas' })).toBeHidden();
    await expect(mars).toHaveAttribute('aria-current', 'page');
    await expect(openAtlas).toBeFocused();
  });

  test('shared links retain body and evidence mode without exposing observer location', async ({ page }) => {
    await enterDesktopSystem(page);

    const mars = page.getByRole('button', { name: 'Visit Mars' });
    await mars.click();
    await page.getByRole('radio', { name: 'Scientific' }).click();
    await expect.poll(() => new URL(page.url()).hash).toContain('b=mars');
    await expect.poll(() => new URL(page.url()).hash).toContain('m=scientific');
    expect(new URL(page.url()).hash).not.toContain('lat=');
    expect(new URL(page.url()).hash).not.toContain('lon=');

    await page.goto('/#t=2026-07-29T12%3A00%3A00Z&p=0&b=mars&m=scientific');
    await expect(page.getByRole('button', { name: 'Visit Mars' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('radio', { name: 'Scientific' })).toHaveAttribute('aria-checked', 'true');
  });

  test('observer panel labels civil time separately from UTC predictions', async ({ page }) => {
    await enterDesktopSystem(page);

    const observer = page.getByRole('complementary', { name: 'Local sky' });
    await expect(observer.getByText('Local civil time', { exact: true })).toBeVisible();
    await expect(observer.getByText('Europe/Istanbul', { exact: false })).toBeVisible();
    await expect(observer.getByText('Universal time', { exact: false })).toBeVisible();
  });
});

test('NASA deep-space 3D models are served to the live WebGL scene', async ({ page }) => {
  const models = [
    ['/models/parker-solar-probe.glb', 6_000_000],
    ['/models/voyager.glb', 2_500_000],
    ['/models/new-horizons.glb', 3_000_000]
  ] as const;

  for (const [url, minimumBytes] of models) {
    const response = await page.request.get(url);
    expect(response.ok()).toBeTruthy();
    expect(Number(response.headers()['content-length'] ?? '0')).toBeGreaterThan(minimumBytes);
  }

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
});

test('Parker label opens and leaves a 3D inspection flight', async ({ page }) => {
  await enterSystem(page);

  const inspectParker = page.getByRole('button', { name: 'Inspect 3D model of Parker Solar Probe' });
  await expect(inspectParker).toBeVisible();
  await inspectParker.click();
  await expect(inspectParker).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(inspectParker).toBeVisible();
});

test('every deep-space craft exposes a 3D inspection control', async ({ page }) => {
  await enterSystem(page);

  for (const craft of ['Voyager 1', 'Voyager 2', 'New Horizons', 'Parker Solar Probe', 'James Webb']) {
    await expect(page.getByRole('button', { name: `Inspect 3D model of ${craft}` })).toBeVisible();
  }
});

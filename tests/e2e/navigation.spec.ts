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

test.describe('desktop Explore Atlas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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

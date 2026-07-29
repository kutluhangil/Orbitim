import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

async function enterSystem(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the system' }).click();
  await expect(page.getByRole('button', { name: 'Open scene controls' })).toBeVisible();
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

test('NASA Parker 3D model is served to the live WebGL scene', async ({ page }) => {
  const response = await page.request.get('/models/parker-solar-probe.glb');
  expect(response.ok()).toBeTruthy();
  expect(Number(response.headers()['content-length'] ?? '0')).toBeGreaterThan(6_000_000);

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

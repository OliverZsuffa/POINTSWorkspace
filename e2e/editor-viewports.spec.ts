import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'phone-320x700', width: 320, height: 700 },
];

for (const viewport of viewports) {
  test(`editor layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('./');

    const main = page.getByRole('main', { name: 'POINTS Workspace' });
    await expect(main).toBeVisible();
    await expect(page.getByRole('region', { name: 'Notation editor' })).toBeVisible();
    await expect(page.locator('.editor-toolbar')).toBeVisible();

    const cell = page.locator('.notation-cell').first();
    const bounds = await cell.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBe(42);
    expect(bounds!.height).toBe(42);

    const background = await main.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).toBe('rgb(144, 208, 213)');

    await cell.click();
    await page.getByRole('button', { name: 'LIFT' }).click();
    const symbol = cell.locator('svg.ball-segment');
    await expect(symbol).toBeVisible();
    await expect(symbol).toHaveAttribute('viewBox', '0 0 100 100');
    await expect(symbol.locator('text')).toHaveAttribute('font-size', '46');

    if (viewport.width <= 1100) {
      for (const mode of ['Select', 'Draw', 'Move']) {
        const button = page.getByRole('button', { name: mode, exact: true });
        await expect(button).toBeVisible();
      }
    }

    if (viewport.width <= 700) {
      const toolbarBounds = await page.locator('.editor-toolbar').boundingBox();
      const gridBounds = await page.locator('.grid-head').boundingBox();
      expect(toolbarBounds).not.toBeNull();
      expect(gridBounds).not.toBeNull();
      expect(gridBounds!.y - (toolbarBounds!.y + toolbarBounds!.height)).toBeLessThanOrEqual(24);
    }

    await page.screenshot({
      path: `test-results/03c-${viewport.name}.png`,
      fullPage: true,
    });
  });
}


test('circle passing renderer layout with ten participants', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Add performer' }).click();
  await page.getByRole('button', { name: 'Add performer' }).click();
  await page.getByLabel('Type').selectOption('circle-passing');
  const addPerson = page.getByRole('button', { name: 'Add one person' });
  for (let count = 0; count < 7; count += 1) await addPerson.click();
  await expect(page.getByLabel('People count')).toHaveText('10');

  await page.getByRole('button', { name: 'Renderer' }).click();
  const renderer = page.getByRole('region', { name: 'Sequence renderer' });
  await expect(renderer).toBeVisible();
  const canvas = renderer.locator('canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(400);
  expect(bounds!.height).toBeGreaterThan(250);
  await page.screenshot({ path: 'test-results/07-circle-renderer-ten-people.png', fullPage: true });
});

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
    await page.goto('/');

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
    await expect(symbol.locator('text')).toHaveAttribute('font-size', '38');

    if (viewport.width <= 900) {
      for (const mode of ['Select', 'Draw', 'Move', 'Erase']) {
        const button = page.getByRole('button', { name: mode, exact: true });
        await expect(button).toBeVisible();
      }
    }

    await page.screenshot({
      path: `test-results/03c-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

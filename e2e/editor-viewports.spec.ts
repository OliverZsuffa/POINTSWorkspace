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
    const expectedCellSize = viewport.width <= 700 ? 44 : viewport.width <= 1100 ? 48 : 56;
    expect(bounds!.width).toBe(expectedCellSize);
    expect(bounds!.height).toBe(expectedCellSize);

    const background = await main.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).toBe('rgb(243, 245, 248)');

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
  await page.getByRole('button', { name: 'Settings' }).click();

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


test('desktop workspace panels can be resized, swapped, hidden and restored', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  const editor = page.locator('.editor-workspace-panel');
  const renderer = page.locator('.renderer-workspace-panel');
  await expect(editor).toBeVisible();
  await expect(renderer).toBeVisible();

  const before = await editor.boundingBox();
  const divider = await page.locator('.workspace-divider').boundingBox();
  expect(before).not.toBeNull();
  expect(divider).not.toBeNull();
  await page.mouse.move(divider!.x + divider!.width / 2, divider!.y + divider!.height / 2);
  await page.mouse.down();
  await page.mouse.move(divider!.x + divider!.width / 2 + 100, divider!.y + divider!.height / 2);
  await page.mouse.up();
  const after = await editor.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width + 50);

  await page.getByRole('button', { name: 'Swap panels' }).click();
  expect((await renderer.boundingBox())!.x).toBeLessThan((await editor.boundingBox())!.x);

  await editor.locator('.workspace-panel-header button').click();
  await expect(editor).toBeHidden();
  await page.getByRole('button', { name: 'Show editor' }).click();
  await expect(editor).toBeVisible();
});

test('phone workspace switches between editor and renderer tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const editor = page.locator('.editor-workspace-panel');
  const renderer = page.locator('.renderer-workspace-panel');
  await expect(page.getByRole('navigation', { name: 'Workspace views' })).toBeVisible();
  await expect(editor).toBeVisible();
  await expect(renderer).toBeHidden();

  await page.getByRole('button', { name: 'Renderer', exact: true }).click();
  await expect(renderer).toBeVisible();
  await expect(editor).toBeHidden();

  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(renderer).toBeHidden();
});

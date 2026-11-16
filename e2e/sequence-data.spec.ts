import { expect, test } from '@playwright/test';

test('sequence code can be shown, imported and undone', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  const codeField = page.getByLabel('Import sequence code');
  await page.getByRole('button', { name: 'Show current code' }).click();
  const originalCode = await codeField.inputValue();
  expect(originalCode.startsWith('P4')).toBe(true);

  await page.getByLabel('Find a preset').fill('Individual passing');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Individual passing/ }).click();
  await expect(page.locator('button[title="Undo"]')).toBeEnabled();

  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await codeField.fill(originalCode);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('button[title="Undo"]')).toBeEnabled();
  await page.locator('button[title="Undo"]').click();
  await page.getByRole('button', { name: 'Show current code' }).click();
  await expect(codeField).not.toHaveValue('');
});

test('share links copy the current P4 sequence and load it ahead of local persistence', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const bpm = page.getByRole('region', { name: 'Sequence settings' }).getByLabel('BPM');
  await bpm.fill('85');
  await bpm.press('Enter');

  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toContain('#code=P4');

  await bpm.fill('95');
  await bpm.press('Enter');
  await page.goto(shareUrl);
  const sharedCode = await page.evaluate(() => new URLSearchParams(window.location.hash.slice(1)).get('code'));
  expect(sharedCode).toBeTruthy();
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  const codeField = page.getByLabel('Import sequence code');
  await page.getByRole('button', { name: 'Show current code' }).click();
  await expect(codeField).toHaveValue(sharedCode!);
});

test('invalid share links show an error and preserve the locally saved sequence', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const bpm = page.getByRole('region', { name: 'Sequence settings' }).getByLabel('BPM');
  await bpm.fill('95');
  await bpm.press('Enter');

  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByRole('button', { name: 'Show current code' }).click();
  const savedCode = await page.getByLabel('Import sequence code').inputValue();

  const invalidUrl = new URL(page.url());
  invalidUrl.hash = 'code=P4invalid';
  await page.goto(invalidUrl.toString());
  await expect(page.locator('.update-banner[role="alert"]')).toContainText('could not be loaded');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  const codeField = page.getByLabel('Import sequence code');
  await page.getByRole('button', { name: 'Show current code' }).click();
  await expect(codeField).toHaveValue(savedCode);
});

test('sequence changes persist across a reload in the same tab', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const bpm = page.getByRole('region', { name: 'Sequence settings' }).getByLabel('BPM');
  await bpm.fill('95');
  await bpm.press('Enter');
  await expect(bpm).toHaveValue('95');
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('region', { name: 'Sequence settings' }).getByLabel('BPM')).toHaveValue('95');
});

test('curated presets can be searched and loaded', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByLabel('Find a preset').fill('Solo basics');
  await expect(page.getByRole('button', { name: /Solo basics/ })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Solo basics/ }).click();
  await expect(page.locator('button[title="Undo"]')).toBeEnabled();
});

test('sequence can be exported as a PNG', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await expect(page.locator('.export-options input[type="checkbox"]')).toHaveCount(4);
  await page.locator('.export-options input[type="checkbox"]').nth(2).uncheck();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('points-sequence.png');
});

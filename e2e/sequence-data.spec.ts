import { expect, test } from '@playwright/test';

async function readSavedSequence(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const tabId = sessionStorage.getItem('points.tab-id');
    return tabId ? localStorage.getItem('points.sequence.' + tabId) : null;
  });
}

test('sequence code can be shown, imported and undone', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  const codeField = page.getByLabel('Import sequence code');
  await page.getByRole('button', { name: 'Show current code' }).click();
  const originalCode = await codeField.inputValue();
  expect(originalCode.startsWith('P5')).toBe(true);

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

test('share links require confirmation before replacing saved notation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toContain('#code=P5');

  await page.getByLabel('Find a preset').fill('Solo basics');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Solo basics/ }).click();
  const savedProgress = await readSavedSequence(page);
  expect(savedProgress).not.toBeNull();
  expect(JSON.parse(savedProgress!).notation.length).toBeGreaterThan(0);

  let confirmationCount = 0;
  page.on('dialog', (dialog) => {
    confirmationCount += 1;
    expect(dialog.message()).toBe('Replace the current sequence with the imported sequence?');
    void dialog.accept();
  });
  await page.goto(shareUrl);
  await page.reload();
  await expect.poll(() => confirmationCount).toBe(1);
  await expect.poll(async () => {
    const saved = await readSavedSequence(page);
    return saved ? JSON.parse(saved).notation.length : -1;
  }).toBe(0);
});

test('cancelling a share link import preserves saved progress across reloads', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());

  await page.getByLabel('Find a preset').fill('Solo basics');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Solo basics/ }).click();
  const savedProgress = await readSavedSequence(page);
  expect(savedProgress).not.toBeNull();
  expect(JSON.parse(savedProgress!).notation.length).toBeGreaterThan(0);

  let confirmationCount = 0;
  page.on('dialog', (dialog) => {
    confirmationCount += 1;
    void dialog.dismiss();
  });
  await page.goto(shareUrl);
  await page.reload();
  await expect.poll(() => confirmationCount).toBe(1);
  await expect.poll(() => readSavedSequence(page)).toBe(savedProgress);

  await page.reload();
  await expect.poll(() => confirmationCount).toBe(2);
  await expect.poll(() => readSavedSequence(page)).toBe(savedProgress);
});

test('an empty saved sequence does not require confirmation to open a share link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByLabel('Find a preset').fill('Solo basics');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Solo basics/ }).click();
  await page.getByRole('button', { name: /Code, presets and export/ }).click();
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());

  const emptyTab = await context.newPage();
  let unexpectedDialog = false;
  emptyTab.on('dialog', (dialog) => {
    unexpectedDialog = true;
    void dialog.dismiss();
  });
  await emptyTab.goto('./');
  await emptyTab.goto(shareUrl);
  expect(unexpectedDialog).toBe(false);
  await expect.poll(async () => {
    const saved = await readSavedSequence(emptyTab);
    return saved ? JSON.parse(saved).notation.length : -1;
  }).toBeGreaterThan(0);
});

test('invalid share links show an error and preserve the locally saved sequence', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const bpm = page.getByRole('region', { name: 'Sequence settings' }).getByLabel('BPM');
  await bpm.fill('95');
  await bpm.press('Enter');

  const savedProgress = await readSavedSequence(page);
  expect(savedProgress).not.toBeNull();

  const invalidUrl = new URL(page.url());
  invalidUrl.hash = 'code=P5invalid';
  await page.goto(invalidUrl.toString());
  await page.reload();
  await expect(page.locator('.update-banner[role="alert"]')).toContainText('could not be loaded');
  await expect.poll(() => readSavedSequence(page)).toBe(savedProgress);
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

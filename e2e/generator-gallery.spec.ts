import { expect, test } from '@playwright/test';

test('generator gallery stays usable at desktop and phone sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  const panel = page.getByRole('region', { name: 'Sequence generator' });
  await panel.getByRole('button', { name: 'Show' }).click();
  await panel.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(panel.getByText('Structure 1', { exact: true })).toBeVisible({ timeout: 30000 });
  await panel.getByRole('button', { name: 'Explore locations' }).first().click();
  await expect(panel.getByText('Result 1', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByText('Result 1', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Generate flourishes' }).first().click();
  await expect(panel.getByText('Core sequence', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(panel.getByText('Flourish 1', { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/10-generator-phone-gallery.png', fullPage: true });
});

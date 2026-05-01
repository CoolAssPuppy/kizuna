import { expect, test } from '@playwright/test';

test('app boots and unauthenticated users see the welcome hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kizuna');
});

test('unknown route shows the not found screen', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page Not Found');
});

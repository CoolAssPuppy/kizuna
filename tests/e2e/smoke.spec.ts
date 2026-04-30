import { expect, test } from '@playwright/test';

test('welcome screen renders the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kizuna');
});

test('unknown route shows the not found screen', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

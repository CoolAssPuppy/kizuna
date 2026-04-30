import { expect, test } from '@playwright/test';

test('app boots and unauthenticated users land on the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('unknown route shows the not found screen', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

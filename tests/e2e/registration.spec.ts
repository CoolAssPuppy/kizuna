import { expect, test } from '@playwright/test';

test('registration route redirects unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/registration');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('registration step routes redirect unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/registration/personal-info');
  await expect(page).toHaveURL(/\/sign-in/);
});

import { expect, test } from '@playwright/test';

test('unauthenticated visit to home redirects to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
});

test('sign-in screen exposes employee SSO and guest credentials tabs', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('tab', { name: 'Employee' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'Guest' }).click();
  await expect(page.getByRole('tab', { name: 'Guest' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

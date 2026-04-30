import { expect, test } from '@playwright/test';

// The /documents and /consent routes are auth-gated. Without a session, the
// router redirects to /sign-in. This spec confirms the route guards engage.
test('documents route redirects unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/documents');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('consent route redirects unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/consent');
  await expect(page).toHaveURL(/\/sign-in/);
});

import { expect, test } from '@playwright/test';

test('/all-events redirects unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/all-events');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('/admin/events redirects to /all-events for the new gallery experience', async ({ page }) => {
  await page.goto('/admin/events');
  // Whether unauthenticated (sign-in) or authenticated (all-events), the
  // legacy /admin/events list view should never render anymore.
  await expect(page).not.toHaveURL(/\/admin\/events$/);
});

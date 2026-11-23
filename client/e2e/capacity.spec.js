import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('capacity page shows values from the shared capacity endpoint', async ({ page }) => {
  const state = await installMockApi(page, { role: 'ADMIN' });

  await loginThroughOtp(page, { email: state.user.email });
  await page.goto('/capacidad');

  await expect(page.getByText('Capacidad Operativa y Ocupación')).toBeVisible();
  for (const value of ['1.065', '15', '1.050', '1,4%']) {
    await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/Esta semana .*250/)).toBeVisible();
  await page.screenshot({ path: 'test-results/capacity-page.png', fullPage: true });
});
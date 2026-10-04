import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('capacity page shows values from the shared capacity endpoint', async ({ page }) => {
  const state = await installMockApi(page, { role: 'ADMIN' });

  await loginThroughOtp(page, { email: state.user.email });
  await page.goto('/capacidad');

  await expect(page.getByText('Capacidad Operativa y Ocupación')).toBeVisible();
  await expect(page.getByText('1.065')).toBeVisible();
  await expect(page.getByText('250 turnos máximos por semana')).toBeVisible();
  await expect(page.getByText('15', { exact: true })).toBeVisible();
  await expect(page.getByText('1.050', { exact: true })).toBeVisible();
  await expect(page.getByText('1,4%', { exact: true })).toBeVisible();

  await page.screenshot({ path: 'test-results/capacity-page.png', fullPage: true });
});
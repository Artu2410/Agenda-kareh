import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('SECRETARIA no accede a configuración', async ({ page }) => {
  const state = await installMockApi(page, { role: 'SECRETARIA' });

  await loginThroughOtp(page, { email: state.user.email });
  await page.goto('/configuracion');

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Configuración' })).toHaveCount(0);
});

test('SUPER_USER sí accede a configuración', async ({ page }) => {
  const state = await installMockApi(page, { role: 'SUPER_USER' });

  await loginThroughOtp(page, { email: state.user.email });
  await page.goto('/configuracion');

  await expect(page).toHaveURL(/\/configuracion$/);
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
});

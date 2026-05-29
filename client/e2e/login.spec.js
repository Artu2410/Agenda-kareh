import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('login correcto y logout', async ({ page }) => {
  const state = await installMockApi(page, { role: 'SECRETARIA' });

  await loginThroughOtp(page, { email: state.user.email });

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByText('Cerrar sesión')).toBeVisible();

  await page.getByText('Cerrar sesión').click();
  await page.getByRole('button', { name: /^Cerrar$/i }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByLabel('Correo Electrónico')).toBeVisible();
});

test('login inválido muestra error', async ({ page }) => {
  await installMockApi(page, { role: 'SECRETARIA' });

  await page.goto('/acceso');
  await page.getByLabel('Correo Electrónico').fill('invalid@kareh.test');
  await page.getByRole('button', { name: /Enviar Código/i }).click();

  await expect(page.getByText(/Acceso denegado/i)).toBeVisible();
  await expect(page.getByLabel('Código OTP')).toHaveCount(0);
});

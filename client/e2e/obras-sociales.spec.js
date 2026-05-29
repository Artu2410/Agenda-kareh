import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('filtrar, crear y editar obras sociales', async ({ page }) => {
  const state = await installMockApi(page, { role: 'SUPER_USER' });

  await loginThroughOtp(page, { email: state.user.email });
  await page.goto('/obras-sociales');

  await expect(page.getByRole('heading', { name: 'Obras Sociales' })).toBeVisible();
  await expect(page.locator('table tbody tr').filter({ hasText: 'OSDE' })).toHaveCount(1);

  await page.getByLabel('Buscar obra social').fill('OSDE');
  await expect(page.locator('table tbody tr').filter({ hasText: 'OSDE' })).toHaveCount(1);

  await page.getByLabel('Buscar obra social').fill('');
  await page.getByLabel('Filtro de estado').selectOption('inactive');
  await expect(page.locator('table tbody tr').filter({ hasText: 'IOMA' })).toHaveCount(1);
  await expect(page.locator('table tbody tr').filter({ hasText: 'OSDE' })).toHaveCount(0);

  await page.getByLabel('Filtro de estado').selectOption('active');
  await page.getByRole('button', { name: /Agregar manual/i }).click();
  await page.getByLabel('Nombre').fill('Nueva Salud');
  await page.getByLabel('Código manual').fill('NS-001');
  await page.getByRole('button', { name: /Guardar obra social/i }).click();
  await expect(page.locator('table tbody tr').filter({ hasText: 'Nueva Salud' })).toHaveCount(1);

  await page.getByLabel('Buscar obra social').fill('Nueva Salud');
  await expect(page.locator('table tbody tr').filter({ hasText: 'Nueva Salud' })).toHaveCount(1);

  await page.getByRole('button', { name: /Editar valores/i }).click();
  await page.locator('table').getByLabel('Nombre').fill('Nueva Salud Premium');
  await page.locator('button[title="Guardar"]').click();
  await expect(page.locator('table tbody tr').filter({ hasText: 'Nueva Salud Premium' })).toHaveCount(1);
});

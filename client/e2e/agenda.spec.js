import { expect, test } from '@playwright/test';
import { loginThroughOtp } from './helpers/auth';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 1200 } });

test('crear, editar y proteger un turno atendido', async ({ page }) => {
  const state = await installMockApi(page, { role: 'SECRETARIA' });

  await loginThroughOtp(page, { email: state.user.email });
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/agenda');
  await expect(page.getByLabel('Profesional')).toBeVisible();
  await expect(page.getByRole('button', { name: /Agregar turno/i }).first()).toBeVisible();

  await page.getByRole('button', { name: /Agregar turno/i }).first().click();
  await page.getByLabel('DNI del Paciente').fill('32165498');
  await page.getByLabel('Obra Social', { exact: true }).selectOption('__PARTICULAR__');
  await page.getByLabel('Apellido').fill('Tester');
  await page.getByLabel('Nombre').fill('Agenda');
  await page.getByLabel('Número de Afiliado').fill('AF-123');
  await page.getByLabel('Teléfono', { exact: true }).fill('1122334455');
  await page.getByLabel('Fecha de Nacimiento').fill('1990-05-20');
  await page.getByLabel('Diagnóstico / Evolución').fill('Sesión de prueba E2E');
  await page.getByRole('button', { name: /Confirmar y Agendar/i }).click();

  await expect(page.getByRole('button', { name: 'Cerrar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByText('Tester Agenda')).toBeVisible();

  await page.getByText('Tester Agenda').click();
  await expect(page.getByRole('button', { name: /Guardar Cambios/i })).toBeVisible();
  await page.getByRole('button', { name: 'Asistió' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Asistió' }).click();
  await page.getByRole('button', { name: /Guardar Cambios/i }).click();
  await expect(page.getByText('Tester Agenda').first()).toBeVisible();

  // Un turno atendido es historia del paciente: el backend lo rechaza con 409.
  await page.getByText('Tester Agenda').click();
  await page.getByRole('button', { name: /Solo hoy/i }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Solo hoy/i }).click();
  await expect(page.getByText(/Eliminar turno/i)).toBeVisible();
  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: /^Eliminar$/i }).click();
  await expect.poll(() => dialogMessage).toMatch(/ya atendido/i);
  expect(state.appointments.some((appointment) => appointment.status === 'COMPLETED')).toBe(true);
});

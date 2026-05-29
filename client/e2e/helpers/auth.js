import { expect } from '@playwright/test';

export const loginThroughOtp = async (page, {
  email,
  otp = '123456',
}) => {
  await page.goto('/acceso');
  await page.getByLabel('Correo Electrónico').fill(email);
  await page.getByRole('button', { name: /Enviar Código/i }).click();
  await expect(page.getByLabel('Código OTP')).toBeVisible();
  await page.getByLabel('Código OTP').fill(otp);
  await page.getByRole('button', { name: /^Acceder$/i }).click();
};

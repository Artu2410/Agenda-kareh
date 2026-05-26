import { resolveStoredHonorarioAmount } from './appointmentFinancialSnapshot.js';

const MONTHLY_HONORARIOS_EXCLUDED_PATTERN = /\b(PAMI|OSDE)\b/i;
const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const resolveAppointmentHonorario = (appointment = {}) => resolveStoredHonorarioAmount(appointment);

export const isAgreementInsuranceForMonthlyHonorarios = (appointment = {}) => {
  const obraSocial = appointment?.obraSocial;
  const name = String(obraSocial?.nombreOs || '').trim();

  if (!name || MONTHLY_HONORARIOS_EXCLUDED_PATTERN.test(name)) {
    return false;
  }

  if (!obraSocial || obraSocial.isArchived || obraSocial.isActive === false) {
    return false;
  }

  return resolveAppointmentHonorario(appointment) > 0;
};

export const buildMonthlyHonorariosReport = (appointments = []) => {
  const byInsurance = new Map();

  appointments.forEach((appointment) => {
    if (!isAgreementInsuranceForMonthlyHonorarios(appointment)) {
      return;
    }

    const honorario = resolveAppointmentHonorario(appointment);
    if (honorario <= 0) {
      return;
    }

    const key = appointment.obraSocialId || 'sin-obra-social';
    const current = byInsurance.get(key) || {
      obraSocialId: appointment.obraSocialId,
      obraSocialName: appointment.obraSocial?.nombreOs || 'Sin obra social',
      totalAmount: 0,
      appointmentCount: 0,
    };

    current.totalAmount += honorario;
    current.appointmentCount += 1;
    byInsurance.set(key, current);
  });

  return [...byInsurance.values()]
    .map((row) => ({
      ...row,
      totalAmount: roundCurrency(row.totalAmount),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

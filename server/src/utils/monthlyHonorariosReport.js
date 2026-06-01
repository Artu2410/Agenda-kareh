import { resolveStoredHonorarioAmount } from './appointmentFinancialSnapshot.js';

const MONTHLY_HONORARIOS_EXCLUDED_PATTERN = /\b(PAMI|OSDE)\b/i;
const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const parseCurrencyLikeValue = (value) => {
  const normalized = String(value || '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!normalized) return 0;

  if (/^[\d.]+,\d{2}$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/\./g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d+(\.\d{1,2})?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const extractBonusBreakdown = (obraSocial = {}) => {
  const details = obraSocial?.cokibaDetails || {};
  const manualBonuses = Array.isArray(details.reportBonuses) ? details.reportBonuses : [];
  const sourceText = [
    details.coseguroTexto,
    details.observaciones,
    details.authorizationNote,
    ...manualBonuses.map((bonus) => `${bonus?.label || ''} ${bonus?.amount ?? ''}`),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');

  const bonusMatches = [];
  const seen = new Set();

  const pushBonus = ({ label, sessions = null, amount = 0 }) => {
    const normalizedAmount = roundCurrency(amount);
    if (normalizedAmount <= 0) return;

    const key = `${sessions ?? label}|${normalizedAmount.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);

    bonusMatches.push({
      label,
      sessions,
      amount: normalizedAmount,
    });
  };

  manualBonuses.forEach((bonus, index) => {
    pushBonus({
      label: String(bonus?.label || `Bono ${index + 1}`).trim(),
      amount: parseCurrencyLikeValue(bonus?.amount),
    });
  });

  const bonusPattern = /\bbono(?:\s+de)?\s+(\d+)\s+sesiones?\s*:?\s*\$\s*([\d.,]+)(?=\s|$|\.|,|;|:)/gi;
  let match;
  while ((match = bonusPattern.exec(sourceText)) !== null) {
    pushBonus({
      label: `Bono ${match[1]} sesiones`,
      sessions: Number.parseInt(match[1], 10) || null,
      amount: parseCurrencyLikeValue(match[2]),
    });
  }

  return bonusMatches;
};

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
      bonusDetails: [],
    };

    current.totalAmount += honorario;
    current.appointmentCount += 1;

    if (current.bonusDetails.length === 0) {
      current.bonusDetails = extractBonusBreakdown(appointment.obraSocial);
    }

    byInsurance.set(key, current);
  });

  return [...byInsurance.values()]
    .map((row) => ({
      ...row,
      totalAmount: roundCurrency(row.totalAmount),
      bonusTotal: roundCurrency(
        Array.isArray(row.bonusDetails)
          ? row.bonusDetails.reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0)
          : 0
      ),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

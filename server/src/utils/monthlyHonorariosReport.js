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

const parseDateValue = (value) => {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMonthKey = (date) => {
  const parsed = parseDateValue(date);
  if (!parsed) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const parseMonthWindow = (monthValue = '') => {
  const normalizedMonth = String(monthValue || '').trim();
  const match = normalizedMonth.match(/^(\d{4})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month >= 1 && month <= 12) {
      const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const nextMonthStart = new Date(year, month, 1, 0, 0, 0, 0);

      return {
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        monthStart,
        nextMonthStart,
      };
    }
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    monthKey: getMonthKey(today),
    monthStart,
    nextMonthStart,
  };
};

const compareAppointments = (left, right) => {
  const leftDate = parseDateValue(left?.date);
  const rightDate = parseDateValue(right?.date);

  if (leftDate && rightDate && leftDate.getTime() !== rightDate.getTime()) {
    return leftDate - rightDate;
  }

  const leftTime = String(left?.time || '');
  const rightTime = String(right?.time || '');

  if (leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }

  const leftSlot = Number(left?.slotNumber) || 0;
  const rightSlot = Number(right?.slotNumber) || 0;

  return leftSlot - rightSlot;
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

const extractExplicitCopayAmount = (obraSocial = {}) => {
  const details = obraSocial?.cokibaDetails || {};
  const candidateTexts = [
    details.observaciones,
    details.coseguroTexto,
    Array.isArray(details.norms) ? details.norms.join('\n') : '',
  ];

  for (const candidateText of candidateTexts) {
    const text = String(candidateText || '').trim();
    if (!text) continue;

    const match = text.match(/\bcopago\b[^$\n]*\$\s*([\d.,]+)/i);
    if (match) {
      const amount = parseCurrencyLikeValue(match[1]);
      if (amount > 0) {
        return amount;
      }
    }
  }

  const directCopay = parseCurrencyLikeValue(obraSocial?.coseguroValor);
  if (directCopay > 0) return directCopay;

  const fixedCopay = parseCurrencyLikeValue(obraSocial?.fixedCopay);
  if (fixedCopay > 0) return fixedCopay;

  return 0;
};

const hasStoredCopaySnapshot = (appointment = {}) => {
  const details = appointment?.coinsuranceDetails;

  return Boolean(
    details && (
      Object.prototype.hasOwnProperty.call(details, 'copayAmount')
      || Object.prototype.hasOwnProperty.call(details, 'baseCopay')
    )
  );
};

const resolveStoredCopayAmount = (appointment = {}) =>
  roundCurrency(appointment?.coinsuranceDetails?.copayAmount ?? appointment?.coinsuranceDetails?.baseCopay);

const resolveAppointmentCopayAmount = (appointment = {}) => {
  if (hasStoredCopaySnapshot(appointment)) {
    return resolveStoredCopayAmount(appointment);
  }

  return extractExplicitCopayAmount(appointment?.obraSocial);
};

export const resolveAppointmentHonorario = (appointment = {}) => resolveStoredHonorarioAmount(appointment);

const resolveReportHonorario = (appointment = {}) => {
  const explicitCopay = resolveAppointmentCopayAmount(appointment);
  const patientCharge = roundCurrency(
    appointment?.patientChargeAmount ?? appointment?.coinsuranceAmount
  );

  if (patientCharge > 0 && explicitCopay > 0) {
    const derivedHonorario = roundCurrency(patientCharge - explicitCopay);
    if (derivedHonorario > 0) {
      return derivedHonorario;
    }
  }

  const storedHonorario = resolveAppointmentHonorario(appointment);
  if (storedHonorario > 0) {
    return storedHonorario;
  }

  return roundCurrency(appointment?.obraSocial?.honorarioEstimado);
};

const resolveCycleHonorario = (appointment = {}) => {
  return resolveReportHonorario(appointment);
};

export const isAgreementInsuranceForMonthlyHonorarios = (appointment = {}) => {
  const obraSocial = appointment?.obraSocial;
  const name = String(obraSocial?.nombreOs || '').trim();

  if (!name || MONTHLY_HONORARIOS_EXCLUDED_PATTERN.test(name)) {
    return false;
  }

  if (!obraSocial || obraSocial.isArchived || obraSocial.isActive === false) {
    return false;
  }

  return resolveReportHonorario(appointment) > 0;
};

const isEligibleMonthlyInsurance = (appointment = {}) => {
  const obraSocial = appointment?.obraSocial;
  const name = String(obraSocial?.nombreOs || '').trim();

  if (!name || MONTHLY_HONORARIOS_EXCLUDED_PATTERN.test(name)) {
    return false;
  }

  if (!obraSocial || obraSocial.isArchived || obraSocial.isActive === false) {
    return false;
  }

  return true;
};

const hasSessionBasedBonus = (obraSocial = {}) =>
  extractBonusBreakdown(obraSocial).some((bonus) => Number(bonus.sessions) > 0);

const appendAppointmentToRow = (byInsurance, appointment, amount) => {
  const obraSocial = appointment?.obraSocial;
  const key = appointment.obraSocialId || 'sin-obra-social';
  const current = byInsurance.get(key) || {
    obraSocialId: appointment.obraSocialId,
    obraSocialName: appointment.obraSocial?.nombreOs || 'Sin obra social',
    totalAmount: 0,
    copayTotal: 0,
    appointmentCount: 0,
    bonusDetails: [],
  };

  const resolvedAmount = roundCurrency(amount);
  if (resolvedAmount <= 0) {
    return;
  }

  current.totalAmount += resolvedAmount;
  current.appointmentCount += 1;

  const copayAmount = resolveAppointmentCopayAmount(appointment);
  if (copayAmount > 0) {
    current.copayTotal += copayAmount;
  }

  if (current.bonusDetails.length === 0) {
    current.bonusDetails = extractBonusBreakdown(obraSocial);
  }

  byInsurance.set(key, current);
};

const buildLegacyMonthlyHonorariosReport = (appointments = []) => {
  const byInsurance = new Map();

  appointments.forEach((appointment) => {
    if (!isEligibleMonthlyInsurance(appointment)) {
      return;
    }

    const honorario = resolveReportHonorario(appointment);
    if (honorario <= 0) {
      return;
    }

    appendAppointmentToRow(byInsurance, appointment, honorario);
  });

  return [...byInsurance.values()]
    .map((row) => ({
      ...row,
      totalAmount: roundCurrency(row.totalAmount),
      copayTotal: roundCurrency(row.copayTotal),
      bonusTotal: roundCurrency(
        Array.isArray(row.bonusDetails)
          ? row.bonusDetails.reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0)
          : 0
      ),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

const buildAppointmentCycles = (appointments = []) => {
  const grouped = new Map();

  appointments.forEach((appointment) => {
    if (!isEligibleMonthlyInsurance(appointment)) {
      return;
    }

    if (!appointment?.patientId || !appointment?.obraSocialId) {
      return;
    }

    const key = `${appointment.patientId}::${appointment.obraSocialId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(appointment);
  });

  const cycles = [];

  grouped.forEach((groupAppointments) => {
    const sortedAppointments = [...groupAppointments].sort(compareAppointments);
    let currentCycle = [];
    let previousSessionNumber = null;

    sortedAppointments.forEach((appointment) => {
      const sessionNumber = Number(appointment?.sessionNumber) || 0;
      const shouldStartNewCycle =
        currentCycle.length > 0
        && (
          Boolean(appointment?.isFirstSession)
          || sessionNumber === 1
          || currentCycle.length >= 10
          || (sessionNumber > 0 && previousSessionNumber > 0 && sessionNumber <= previousSessionNumber)
        );

      if (shouldStartNewCycle) {
        cycles.push(currentCycle);
        currentCycle = [];
      }

      currentCycle.push(appointment);
      previousSessionNumber = sessionNumber;
    });

    if (currentCycle.length > 0) {
      cycles.push(currentCycle);
    }
  });

  return cycles.map((cycleAppointments) => {
    const firstAppointment = cycleAppointments[0] || {};
    const lastAppointment = cycleAppointments[cycleAppointments.length - 1] || {};
    const endDate = parseDateValue(lastAppointment.date) || parseDateValue(firstAppointment.date);

    return {
      appointments: cycleAppointments,
      obraSocialId: firstAppointment.obraSocialId || null,
      obraSocialName: firstAppointment.obraSocial?.nombreOs || 'Sin obra social',
      bonusDetails: extractBonusBreakdown(firstAppointment.obraSocial),
      billingMonth: getMonthKey(endDate),
      isComplete: cycleAppointments.length === 10,
    };
  });
};

const buildCycleAwareMonthlyHonorariosReport = (appointments = [], monthWindow) => {
  const byInsurance = new Map();
  const cycleBasedInsuranceIds = new Set();

  appointments.forEach((appointment) => {
    if (!isEligibleMonthlyInsurance(appointment)) {
      return;
    }

    if (hasSessionBasedBonus(appointment.obraSocial)) {
      cycleBasedInsuranceIds.add(appointment.obraSocialId);
    }
  });

  appointments.forEach((appointment) => {
    if (!isEligibleMonthlyInsurance(appointment)) {
      return;
    }

    const appointmentDate = parseDateValue(appointment.date);
    if (!appointmentDate) {
      return;
    }

    if (cycleBasedInsuranceIds.has(appointment.obraSocialId)) {
      return;
    }

    if (appointmentDate < monthWindow.monthStart || appointmentDate >= monthWindow.nextMonthStart) {
      return;
    }

    const honorario = resolveReportHonorario(appointment);
    if (honorario <= 0) {
      return;
    }

    appendAppointmentToRow(byInsurance, appointment, honorario);
  });

  const cycleAppointments = appointments.filter((appointment) => {
    if (!isEligibleMonthlyInsurance(appointment)) {
      return false;
    }

    if (!cycleBasedInsuranceIds.has(appointment.obraSocialId)) {
      return false;
    }

    const appointmentDate = parseDateValue(appointment.date);
    return Boolean(appointmentDate && appointmentDate < monthWindow.nextMonthStart);
  });

  const cycles = buildAppointmentCycles(cycleAppointments);

  cycles.forEach((cycle) => {
    if (!cycle.isComplete || cycle.billingMonth !== monthWindow.monthKey) {
      return;
    }

    cycle.appointments.forEach((appointment) => {
      const honorario = resolveCycleHonorario(appointment);
      if (honorario <= 0) {
        return;
      }

      appendAppointmentToRow(byInsurance, appointment, honorario);
    });

    const current = byInsurance.get(cycle.obraSocialId);
    if (current && current.bonusDetails.length === 0) {
      current.bonusDetails = cycle.bonusDetails;
    }
  });

  return [...byInsurance.values()]
    .map((row) => ({
      ...row,
      totalAmount: roundCurrency(row.totalAmount),
      copayTotal: roundCurrency(row.copayTotal),
      bonusTotal: roundCurrency(
        Array.isArray(row.bonusDetails)
          ? row.bonusDetails.reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0)
          : 0
      ),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

export const buildMonthlyHonorariosReport = (appointments = [], options = {}) => {
  const monthValue = String(options?.month || '').trim();
  if (!monthValue) {
    return buildLegacyMonthlyHonorariosReport(appointments);
  }

  const monthWindow = parseMonthWindow(monthValue);
  return buildCycleAwareMonthlyHonorariosReport(appointments, monthWindow);
};

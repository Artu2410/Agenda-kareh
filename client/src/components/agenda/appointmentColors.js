import { isParticularCoverage } from '@/utils/coverage';

const APPOINTMENT_COLOR_SCHEMES = {
  iu: {
    cardClass: 'border-orange-200 bg-orange-50/90',
    badgeClass: 'bg-orange-100 text-orange-700',
    coverageBadgeClass: 'bg-orange-100/80 text-orange-800',
    coverageBorderClass: 'border-orange-200',
    accentClass: 'bg-orange-500',
    iconClass: 'text-orange-600',
    showCoverageBadge: true,
  },
  respiratory: {
    cardClass: 'border-violet-200 bg-violet-50/90',
    badgeClass: 'bg-violet-100 text-violet-700',
    coverageBadgeClass: 'bg-violet-100/80 text-violet-800',
    coverageBorderClass: 'border-violet-200',
    accentClass: 'bg-violet-500',
    iconClass: 'text-violet-600',
    showCoverageBadge: true,
  },
  particular: {
    cardClass: 'border-blue-200 bg-blue-50/90',
    badgeClass: 'bg-blue-100 text-blue-700',
    coverageBadgeClass: 'bg-blue-100/80 text-blue-800',
    coverageBorderClass: 'border-blue-200',
    accentClass: 'bg-blue-500',
    iconClass: 'text-blue-600',
    showCoverageBadge: true,
  },
  pami: {
    cardClass: 'border-amber-200 bg-amber-50/90',
    badgeClass: 'bg-amber-100 text-amber-700',
    coverageBadgeClass: 'bg-amber-100/80 text-amber-800',
    coverageBorderClass: 'border-amber-200',
    accentClass: 'bg-amber-500',
    iconClass: 'text-amber-600',
    showCoverageBadge: false,
  },
  insurance: {
    cardClass: 'border-indigo-200 bg-indigo-50/90',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    coverageBadgeClass: 'bg-indigo-100/80 text-indigo-800',
    coverageBorderClass: 'border-indigo-200',
    accentClass: 'bg-indigo-500',
    iconClass: 'text-indigo-600',
    showCoverageBadge: true,
  },
  default: {
    cardClass: 'border-slate-200 bg-slate-50/90',
    badgeClass: 'bg-slate-200 text-slate-700',
    coverageBadgeClass: 'bg-slate-100 text-slate-600',
    coverageBorderClass: 'border-slate-200',
    accentClass: 'bg-slate-400',
    iconClass: 'text-slate-600',
    showCoverageBadge: true,
  },
};

const normalizeCoverage = (value) => String(value || '').trim().toUpperCase();

export const getAppointmentColorScheme = (appointment = {}) => {
  const patient = appointment.patient ?? null;
  const source = patient || appointment || {};
  const healthInsurance = source.healthInsurance ?? '';
  const treatAsParticular = Boolean(source.treatAsParticular);
  const isIU = Boolean(source.isIU);
  const isRespiratory = Boolean(source.isRespiratory);
  const normalizedInsurance = normalizeCoverage(healthInsurance);

  if (!patient && !normalizedInsurance && !treatAsParticular && !isIU && !isRespiratory) {
    return {
      category: 'default',
      ...APPOINTMENT_COLOR_SCHEMES.default,
    };
  }

  if (isIU) {
    return {
      category: 'iu',
      ...APPOINTMENT_COLOR_SCHEMES.iu,
    };
  }

  if (isRespiratory) {
    return {
      category: 'respiratory',
      ...APPOINTMENT_COLOR_SCHEMES.respiratory,
    };
  }

  if (isParticularCoverage(healthInsurance, treatAsParticular)) {
    return {
      category: 'particular',
      ...APPOINTMENT_COLOR_SCHEMES.particular,
    };
  }

  if (normalizedInsurance.includes('PAMI')) {
    return {
      category: 'pami',
      ...APPOINTMENT_COLOR_SCHEMES.pami,
    };
  }

  if (normalizedInsurance) {
    return {
      category: 'insurance',
      ...APPOINTMENT_COLOR_SCHEMES.insurance,
    };
  }

  return {
    category: 'default',
    ...APPOINTMENT_COLOR_SCHEMES.default,
  };
};

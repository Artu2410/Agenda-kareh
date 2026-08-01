import { describe, expect, it } from 'vitest';
import { getAppointmentColorScheme } from './appointmentColors.js';

describe('getAppointmentColorScheme', () => {
  it('prioriza IU por encima de cualquier otra categoría', () => {
    const scheme = getAppointmentColorScheme({
      patient: {
        isIU: true,
        isRespiratory: true,
        treatAsParticular: true,
        healthInsurance: 'PAMI',
      },
    });

    expect(scheme.category).toBe('iu');
    expect(scheme.cardClass).toContain('border-orange-200');
    expect(scheme.badgeClass).toContain('bg-orange-100');
    expect(scheme.coverageBadgeClass).toContain('bg-orange-100');
    expect(scheme.coverageBorderClass).toBe('border-orange-200');
    expect(scheme.showCoverageBadge).toBe(true);
  });

  it('prioriza Respiratorio por encima de Particular y PAMI', () => {
    const scheme = getAppointmentColorScheme({
      patient: {
        isRespiratory: true,
        treatAsParticular: true,
        healthInsurance: 'PAMI',
      },
    });

    expect(scheme.category).toBe('respiratory');
    expect(scheme.cardClass).toContain('border-violet-200');
    expect(scheme.badgeClass).toContain('bg-violet-100');
    expect(scheme.coverageBadgeClass).toContain('bg-violet-100');
    expect(scheme.coverageBorderClass).toBe('border-violet-200');
    expect(scheme.showCoverageBadge).toBe(true);
  });

  it('prioriza Particular por encima de PAMI y otras obras sociales', () => {
    const scheme = getAppointmentColorScheme({
      patient: {
        treatAsParticular: true,
        healthInsurance: 'OSDE',
      },
    });

    expect(scheme.category).toBe('particular');
    expect(scheme.cardClass).toContain('border-blue-200');
    expect(scheme.badgeClass).toContain('bg-blue-100');
    expect(scheme.coverageBadgeClass).toContain('bg-blue-100');
    expect(scheme.coverageBorderClass).toBe('border-blue-200');
    expect(scheme.showCoverageBadge).toBe(true);
  });

  it('prioriza PAMI por encima de obras sociales comunes', () => {
    const scheme = getAppointmentColorScheme({
      patient: {
        healthInsurance: 'PAMI',
        treatAsParticular: false,
      },
    });

    expect(scheme.category).toBe('pami');
    expect(scheme.cardClass).toContain('border-amber-200');
    expect(scheme.badgeClass).toContain('bg-amber-100');
    expect(scheme.coverageBadgeClass).toContain('bg-amber-100');
    expect(scheme.coverageBorderClass).toBe('border-amber-200');
    expect(scheme.showCoverageBadge).toBe(false);
  });

  it('usa turquesa para todas las obras sociales comunes', () => {
    ['IOMA', 'SANCOR', 'SWISS MEDICAL S.A.', 'OSDE'].forEach((healthInsurance) => {
      const scheme = getAppointmentColorScheme({
        patient: {
          healthInsurance,
          treatAsParticular: false,
        },
      });

      expect(scheme.category).toBe('insurance');
      expect(scheme.cardClass).toContain('border-teal-200');
      expect(scheme.badgeClass).toContain('bg-teal-100');
      expect(scheme.coverageBadgeClass).toContain('bg-teal-100');
      expect(scheme.coverageBorderClass).toBe('border-teal-200');
      expect(scheme.showCoverageBadge).toBe(true);
    });
  });

  it('mantiene un fallback neutro cuando no hay datos del paciente', () => {
    const scheme = getAppointmentColorScheme({});

    expect(scheme.category).toBe('default');
    expect(scheme.cardClass).toContain('border-slate-200');
    expect(scheme.badgeClass).toContain('bg-slate-200');
    expect(scheme.coverageBadgeClass).toContain('bg-slate-100');
    expect(scheme.coverageBorderClass).toBe('border-slate-200');
    expect(scheme.showCoverageBadge).toBe(true);
  });
});

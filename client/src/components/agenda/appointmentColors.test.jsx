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
    expect(scheme.coverageBadgeClass).toContain('bg-blue-100');
    expect(scheme.coverageBorderClass).toBe('border-blue-200');
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
    expect(scheme.coverageBadgeClass).toContain('bg-blue-100');
    expect(scheme.coverageBorderClass).toBe('border-blue-200');
    expect(scheme.showCoverageBadge).toBe(true);
  });

  it('mantiene indigo para una obra social en tratamientos especiales', () => {
    const scheme = getAppointmentColorScheme({
      patient: {
        isIU: true,
        healthInsurance: 'SANCOR',
        treatAsParticular: false,
      },
    });

    expect(scheme.category).toBe('iu');
    expect(scheme.cardClass).toContain('border-orange-200');
    expect(scheme.badgeClass).toContain('bg-orange-100');
    expect(scheme.coverageBadgeClass).toContain('bg-indigo-100');
    expect(scheme.coverageBorderClass).toBe('border-indigo-200');
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
    expect(scheme.cardClass).toContain('border-indigo-200');
    expect(scheme.badgeClass).toContain('bg-indigo-100');
    expect(scheme.coverageBadgeClass).toContain('bg-indigo-100');
    expect(scheme.coverageBorderClass).toBe('border-indigo-200');
    expect(scheme.showCoverageBadge).toBe(false);
  });

  it('usa el color de IOMA para todas las obras sociales comunes', () => {
    const iomaScheme = getAppointmentColorScheme({
      patient: {
        healthInsurance: 'IOMA',
        treatAsParticular: false,
      },
    });

    ['SANCOR', 'SWISS MEDICAL S.A.', 'OSDE'].forEach((healthInsurance) => {
      const scheme = getAppointmentColorScheme({
        patient: {
          healthInsurance,
          treatAsParticular: false,
        },
      });

      expect(scheme.category).toBe('insurance');
      expect(scheme.cardClass).toBe(iomaScheme.cardClass);
      expect(scheme.badgeClass).toBe(iomaScheme.badgeClass);
      expect(scheme.coverageBadgeClass).toBe(iomaScheme.coverageBadgeClass);
      expect(scheme.coverageBorderClass).toBe(iomaScheme.coverageBorderClass);
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

import React from 'react';
import { describe, expect, it } from 'vitest';
import { buildAppointmentDailyPresentation, getStatusMeta } from './appointmentVisuals.jsx';

describe('appointmentVisuals', () => {
  it('reusa la semántica visual de los estados principales', () => {
    const completed = getStatusMeta({ status: 'COMPLETED', patient: {} });
    expect(completed.label).toBe('Asistió');
    expect(completed.cardClass).toContain('bg-emerald-50');
    expect(React.isValidElement(completed.icon)).toBe(true);

    const cancelled = getStatusMeta({ status: 'CANCELLED', patient: {} });
    expect(cancelled.label).toBe('Cancelado');
    expect(cancelled.cardClass).toContain('bg-slate-50');
    expect(React.isValidElement(cancelled.icon)).toBe(true);
  });

  it('construye badges diarios con cobertura, pago, whatsapp y clínica', () => {
    const { statusMeta, badges, clinicalIcons } = buildAppointmentDailyPresentation({
      status: 'SCHEDULED',
      authorizationStatus: 'PENDING',
      authorizationNumber: 'AUTH-123',
      paidInAdvance: false,
      sessionToken: 'TOKEN-456',
      whatsappTicketSentAt: '2026-05-31T10:00:00.000Z',
      isFirstSession: true,
      patient: {
        fullName: 'Paciente',
        healthInsurance: 'IOMA',
        treatAsParticular: false,
        usesEA: true,
        hasCancer: true,
        hasMarcapasos: true,
        usesWheelchair: true,
        isIU: true,
        isRespiratory: true,
      },
    });

    expect(statusMeta.label).toBe('Tratamiento IU');
    expect(statusMeta.cardClass).toContain('border-orange-200');
    expect(badges.map((badge) => badge.label)).toEqual(expect.arrayContaining([
      'Tratamiento IU',
      'IOMA',
      'Pend. autorización',
      'INGRESO',
      'SESIÓN 1',
      'Token: TOKEN-456',
      'Aut. AUTH-123',
      'Pago pendiente',
      'WhatsApp enviado',
    ]));
    expect(badges.find((badge) => badge.key === 'coverage')?.className).toContain('bg-indigo-100');
    expect(badges.find((badge) => badge.key === 'coverage')?.label).toBe('IOMA');
    expect(clinicalIcons).toHaveLength(6);
  });

  it('muestra un solo badge para PAMI', () => {
    const { badges } = buildAppointmentDailyPresentation({
      status: 'SCHEDULED',
      patient: {
        fullName: 'Paciente PAMI',
        healthInsurance: 'PAMI',
        treatAsParticular: false,
      },
    });

    expect(badges.filter((badge) => badge.label === 'PAMI')).toHaveLength(1);
    expect(badges.some((badge) => badge.key === 'coverage')).toBe(false);
  });
});

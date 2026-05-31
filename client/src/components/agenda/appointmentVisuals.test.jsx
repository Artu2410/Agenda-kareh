import React from 'react';
import { describe, expect, it } from 'vitest';
import { buildAppointmentDailyPresentation, getStatusMeta } from './appointmentVisuals.jsx';

describe('appointmentVisuals', () => {
  it('reusa la semántica visual de los estados principales', () => {
    const completed = getStatusMeta('COMPLETED', false, false, null, false, false);
    expect(completed.label).toBe('Asistió');
    expect(completed.cardClass).toContain('bg-emerald-50');
    expect(React.isValidElement(completed.icon)).toBe(true);

    const cancelled = getStatusMeta('CANCELLED', false, false, null, false, false);
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
        healthInsurance: 'PAMI',
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
    expect(badges.map((badge) => badge.label)).toEqual(expect.arrayContaining([
      'Tratamiento IU',
      'PAMI',
      'Pend. autorización',
      'INGRESO',
      'SESIÓN 1',
      'Token: TOKEN-456',
      'Aut. AUTH-123',
      'Pago pendiente',
      'WhatsApp enviado',
    ]));
    expect(clinicalIcons).toHaveLength(6);
  });
});

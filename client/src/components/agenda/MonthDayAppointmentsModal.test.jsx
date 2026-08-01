import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MonthDayAppointmentsModal from './MonthDayAppointmentsModal.jsx';

const buildAppointment = (overrides = {}) => ({
  id: 'apt-1',
  time: '08:00',
  status: 'SCHEDULED',
  patient: {
    fullName: 'Paciente 1',
    healthInsurance: 'PAMI',
    treatAsParticular: false,
  },
  ...overrides,
});

describe('MonthDayAppointmentsModal', () => {
  it('renderiza la lista del día y abre un turno al tocarlo', () => {
    const onClose = vi.fn();
    const onAppointmentClick = vi.fn();

    render(
      <MonthDayAppointmentsModal
        isOpen
        day={new Date('2026-06-03T12:00:00')}
        appointments={[
          buildAppointment(),
          buildAppointment({
            id: 'apt-2',
            time: '08:30',
            patient: {
              fullName: 'Paciente 2',
              healthInsurance: 'IOMA',
              treatAsParticular: false,
            },
          }),
        ]}
        onClose={onClose}
        onAppointmentClick={onAppointmentClick}
      />
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Paciente 1')).toBeVisible();
    expect(screen.getByText('Paciente 2')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Abrir turno de Paciente 1 a las 08:00/i }));
    expect(onAppointmentClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'apt-1' }));
  });
});

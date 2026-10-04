import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WeeklyCalendarGrid from './WeeklyCalendarGrid';

afterEach(() => cleanup());

describe('WeeklyCalendarGrid closed dates', () => {
  it('marks a holiday as closed and does not offer new appointment slots', () => {
    render(
      <WeeklyCalendarGrid
        currentDate={new Date(2026, 9, 12)}
        onSlotClick={() => {}}
        appointments={[]}
        workSchedule={[{ dayOfWeek: 1, startTime: '14:00', endTime: '19:00' }]}
        selectedProfessional={{ id: 'prof-1', fullName: 'Kareh' }}
        currentTime={new Date(2026, 9, 12, 14)}
        capacityPerSlot={5}
        closedDays={[
          {
            date: '2026-10-12',
            name: 'Día del Respeto a la Diversidad Cultural',
            type: 'NATIONAL_HOLIDAY',
            isClosedForScope: true,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Cerrado · Día del Respeto a la Diversidad Cultural/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Agregar turno/i })).toBeNull();
  });
});

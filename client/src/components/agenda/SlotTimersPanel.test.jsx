import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../tests/msw/server';
import { getApiUrl } from '../../services/apiBase';
import SlotTimersPanel from './SlotTimersPanel';

const fixedCurrentTime = new Date('2026-05-28T09:00:00.000Z');

describe('SlotTimersPanel', () => {
  it('renders the timer slots', async () => {
    server.use(
      http.get(getApiUrl('/agenda/timers'), () => HttpResponse.json({ timers: [] })),
    );

    render(
      <SlotTimersPanel
        currentTime={fixedCurrentTime}
        appointments={[]}
        agendaConfig={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTitle('Iniciar')).toHaveLength(5);
    });
  });

  it('sends a toggle request when a slot is clicked', async () => {
    let toggleCalls = 0;

    server.use(
      http.get(getApiUrl('/agenda/timers'), () => HttpResponse.json({ timers: [] })),
      http.post(getApiUrl('/agenda/timers/toggle'), async () => {
        toggleCalls += 1;
        return HttpResponse.json({
          timer: {
            slotNumber: 1,
            durationSeconds: 1500,
            remainingSeconds: 1500,
            status: 'active',
          },
        });
      }),
    );

    render(
      <SlotTimersPanel
        currentTime={fixedCurrentTime}
        appointments={[]}
        agendaConfig={null}
      />,
    );

    fireEvent.click(screen.getAllByTitle('Iniciar')[0]);

    await waitFor(() => {
      expect(toggleCalls).toBe(1);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { clearClientSession, storeAuthenticatedUser } from './session';
import { persistClinicalHistoryContext } from '../utils/appRoutes';

describe('clearClientSession', () => {
  it('borra los datos de usuario y el paciente de la última historia clínica', () => {
    storeAuthenticatedUser({ id: 'u1', email: 'a@b.c', name: 'Ana', role: 'ADMIN' });
    persistClinicalHistoryContext({ patientId: 'p1', patientName: 'Pérez, Ana' });

    clearClientSession();

    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('agenda_kareh_selected_patient')).toBeNull();
  });
});

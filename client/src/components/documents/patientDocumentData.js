import { getCoverageLabel, isParticularCoverage } from '../../utils/coverage';

/** Datos de la ficha del paciente que se repiten en informes y comprobantes. */
export const getPatientCoverage = (patient = {}) => {
  if (isParticularCoverage(patient.obraSocial?.nombreOs || patient.healthInsurance, patient.treatAsParticular)) {
    return { coverage: 'Particular', affiliateNumber: '' };
  }
  return {
    coverage: getCoverageLabel(patient.obraSocial?.nombreOs || patient.healthInsurance, patient.treatAsParticular),
    affiliateNumber: patient.affiliateNumber || '',
  };
};

const activeAppointments = (patient = {}) => (Array.isArray(patient.appointments) ? patient.appointments : [])
  .filter((appointment) => appointment?.status !== 'CANCELLED')
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** Diagnóstico del turno más reciente que tenga uno cargado. */
export const getLatestDiagnosis = (patient = {}) => (
  activeAppointments(patient).find((appointment) => String(appointment.diagnosis || '').trim())?.diagnosis?.trim() || ''
);

/** Sesiones asistidas del tratamiento actual (mismo diagnóstico que el último). */
export const countTreatmentSessions = (patient = {}) => {
  const completed = activeAppointments(patient).filter((appointment) => appointment.status === 'COMPLETED');
  const diagnosis = getLatestDiagnosis(patient).toUpperCase();
  if (!diagnosis) return completed.length;
  return completed.filter((appointment) => String(appointment.diagnosis || '').trim().toUpperCase() === diagnosis).length;
};

/** Profesional del último turno asistido (o del último turno). */
export const getLatestProfessionalId = (patient = {}) => {
  const appointments = activeAppointments(patient);
  return (appointments.find((appointment) => appointment.status === 'COMPLETED') || appointments[0])?.professionalId || '';
};

/** "15.000,50" o "15000.50" → 15000.5 */
export const parseAmountInput = (value) => {
  const raw = String(value ?? '').trim().replace(/\s|\$/g, '');
  if (!raw) return NaN;
  let normalized = raw;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "15.000" en formato argentino son quince mil, no quince.
    normalized = raw.replace(/\./g, '');
  }
  return Number(normalized);
};

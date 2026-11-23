import logger from '../../config/logger.js';

// Reglas de agenda compartidas por la creación, reprogramación y borrado de turnos.
// Todas reciben el cliente de transacción (tx) para correr dentro de la misma operación.

// Bloqueos de transacción (se liberan solos al commit/rollback). Serializan las
// reservas que compiten por el mismo paciente o el mismo horario de un profesional,
// para que la segunda vea lo que guardó la primera en lugar de chocar.
export const lockScheduleKeys = async (tx, keys = []) => {
  if (typeof tx?.$queryRaw !== 'function') return;
  const sortedKeys = [...new Set(keys.filter(Boolean))].sort();
  for (const key of sortedKeys) {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS lock_holder`;
  }
};

export const patientLockKey = (patientId) => (patientId ? `appointment-patient:${patientId}` : null);
export const slotLockKey = ({ professionalId, date, time }) => {
  const day = date instanceof Date ? date.toISOString().slice(0, 10) : String(date || '').slice(0, 10);
  return `appointment-slot:${professionalId}:${day}:${time}`;
};

// Elige el primer número de lugar libre (1..capacidad) entre los turnos activos.
// Un turno CANCELLED conserva su número y la restricción única lo sigue contando:
// si bloquea el número elegido, se lo "estaciona" en un número negativo.
export const claimSlotNumber = async (tx, { date, time, professionalId, capacityPerSlot, excludeId = null }) => {
  const rows = await tx.appointment.findMany({
    where: {
      date,
      time,
      professionalId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, slotNumber: true, status: true },
  });
  const activeNumbers = new Set(rows.filter((row) => row.status !== 'CANCELLED').map((row) => row.slotNumber));
  const slotNumber = Array.from({ length: capacityPerSlot }, (_, i) => i + 1).find((n) => !activeNumbers.has(n));
  if (!slotNumber) return null;

  const blockingCancelled = rows.find((row) => row.status === 'CANCELLED' && row.slotNumber === slotNumber);
  if (blockingCancelled) {
    const usedNumbers = new Set(rows.map((row) => row.slotNumber));
    let parkedNumber = -1;
    while (usedNumbers.has(parkedNumber)) parkedNumber -= 1;
    await tx.appointment.update({
      where: { id: blockingCancelled.id },
      data: { slotNumber: parkedNumber },
      select: { id: true },
    });
  }
  return slotNumber;
};

// Un paciente no puede tener dos turnos activos el mismo día a la misma hora
// (con el mismo u otro profesional). Los cancelados no cuentan.
export const findPatientTimeConflict = (tx, { patientId, date, time, excludeId = null }) => tx.appointment.findFirst({
  where: {
    patientId,
    date,
    time,
    status: { not: 'CANCELLED' },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  },
  select: { id: true },
});

export const APPOINTMENT_ORDER = [
  { date: 'asc' },
  { time: 'asc' },
  { slotNumber: 'asc' },
];

export const resequencePatientAppointments = async (tx, patientId) => {
  logger.debug('Resequencing patient appointments', { patientId });
  const appointments = await tx.appointment.findMany({
    where: {
      patientId,
      status: { not: 'CANCELLED' },
    },
    orderBy: APPOINTMENT_ORDER,
    select: { id: true, isFirstSession: true, sessionNumber: true, date: true },
  });

  logger.debug('Resequencing appointments fetched', { patientId, count: appointments.length });

  let currentNumber = 1;
  for (const [index, appointment] of appointments.entries()) {
    let isFirst = appointment.isFirstSession;
    if (index === 0) isFirst = true; // La primera sesión histórica siempre es ingreso

    // Regla de negocio automática: Los ciclos son de 10 sesiones. 
    // Si la cuenta superó 10, forzamos un nuevo inicio de ciclo (Ingreso).
    if (currentNumber > 10) {
      isFirst = true;
    }

    if (isFirst) {
      currentNumber = 1;
    }

    // Solo se escribe lo que cambió: antes se actualizaba cada turno del paciente.
    const unchanged = appointment.sessionNumber === currentNumber && appointment.isFirstSession === isFirst;
    if (!unchanged) await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        sessionNumber: currentNumber,
        isFirstSession: isFirst,
      },
      select: { id: true },
    });
    
    // Incrementar para la siguiente sesión del loop
    currentNumber++;
  }
};

// Turnos que son historia clínica/operativa/facturable: no se borran físicamente.
export const PROTECTED_APPOINTMENT_STATUSES = ['COMPLETED', 'NO_SHOW'];

export const getAppointmentDeletionBlocker = (appointment) => {
  if (PROTECTED_APPOINTMENT_STATUSES.includes(appointment?.status)) {
    return appointment.status === 'COMPLETED'
      ? 'No se puede eliminar un turno ya atendido: forma parte de la historia del paciente.'
      : 'No se puede eliminar un turno marcado como ausente: forma parte de la historia del paciente.';
  }
  if (Number(appointment?._count?.billingInvoiceItems) > 0) {
    return 'No se puede eliminar un turno que ya está facturado.';
  }
  return null;
};

export const deletionCheckSelect = {
  status: true,
  _count: { select: { billingInvoiceItems: true } },
};

export const stripDeletionCheck = ({ _count, ...appointment }) => appointment;


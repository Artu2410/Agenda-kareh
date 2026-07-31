import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { createInternalError } from '../errors/AppError.js';

const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const NO_SHOW_STATUS = 'NO_SHOW';
const CANCELLED_INVOICE_STATUS = 'CANCELLED';

const RISK_DAYS_WITHOUT_APPOINTMENT = 21;
const RECOVERY_DAYS_WITHOUT_APPOINTMENT = 30;
const RECOVERY_MAX_DAYS = 180;
const VIP_INVOICED_THRESHOLD = 300_000;
const VIP_SESSION_THRESHOLD = 20;
const HIGH_FREQUENCY_THRESHOLD = 1.5;
const GOOD_ATTENDANCE_THRESHOLD = 75;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;
const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');

const getPatientFirstName = (fullName = '') => String(fullName).trim().split(/\s+/)[0] || 'paciente';

const getInvoicePending = (invoice) => Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount));

const buildFinancialRows = (invoices = []) => {
  const rows = [];

  invoices.forEach((invoice) => {
    const totalAmount = toNumber(invoice.totalAmount);
    const paidAmount = toNumber(invoice.paidAmount);
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [{
          id: `${invoice.id}-unallocated`,
          patientId: invoice.patientId,
          patient: invoice.patient,
          totalAmount: invoice.totalAmount,
        }];

    items.forEach((item) => {
      const itemAmount = toNumber(item.totalAmount);
      const ratio = totalAmount > 0 ? itemAmount / totalAmount : 0;
      const patient = item.patient || invoice.patient || null;
      const patientId = item.patientId || patient?.id || invoice.patientId || null;

      if (!patientId) return;

      rows.push({
        patientId,
        patientName: patient?.fullName || null,
        invoiced: itemAmount,
        collected: roundCurrency(paidAmount * ratio),
        pending: Math.max(0, roundCurrency(itemAmount - (paidAmount * ratio))),
      });
    });
  });

  return rows;
};

const getAttendanceRate = ({ completedCount, noShowCount }) => {
  const evaluable = completedCount + noShowCount;
  if (evaluable === 0) return 100;
  return (completedCount / evaluable) * 100;
};

const getWeeklyFrequency = (completedDates = []) => {
  if (completedDates.length === 0) return 0;
  if (completedDates.length === 1) return 1;

  const firstDate = completedDates[0];
  const lastDate = completedDates[completedDates.length - 1];
  const activeDays = Math.max(1, differenceInCalendarDays(lastDate, firstDate));
  const activeWeeks = Math.max(1, activeDays / 7);

  return completedDates.length / activeWeeks;
};

const buildPatientRecord = (patient) => ({
  patientId: patient.id,
  patientName: patient.fullName,
  phone: patient.phone || null,
  normalizedPhone: normalizePhoneDigits(patient.phone),
  email: patient.email || null,
  healthInsurance: patient.treatAsParticular
    ? 'Particular'
    : (patient.obraSocial?.nombreOs || patient.healthInsurance || null),
  createdAt: patient.createdAt,
  completedCount: 0,
  noShowCount: 0,
  cancelledCount: 0,
  futureAppointmentCount: 0,
  completedDates: [],
  firstAttention: null,
  lastAttention: null,
  nextAppointment: null,
  invoiced: 0,
  collected: 0,
  pending: 0,
});

const classifyPatient = (patient, today) => {
  const completedDates = [...patient.completedDates].sort((left, right) => left - right);
  const firstAttention = completedDates[0] || null;
  const lastAttention = completedDates[completedDates.length - 1] || null;
  const daysSinceLastAttention = lastAttention ? differenceInCalendarDays(today, lastAttention) : null;
  const activeDays = firstAttention && lastAttention
    ? Math.max(0, differenceInCalendarDays(lastAttention, firstAttention))
    : 0;
  const weeklyFrequency = getWeeklyFrequency(completedDates);
  const attendanceRate = getAttendanceRate(patient);
  const hasFutureAppointment = patient.futureAppointmentCount > 0;
  const highFrequency = weeklyFrequency >= HIGH_FREQUENCY_THRESHOLD;
  const recurrent = patient.completedCount >= 8 || weeklyFrequency >= 1;
  const riskReasons = [];
  const recoveryReasons = [];
  const badges = [];

  let riskScore = 0;

  if (!hasFutureAppointment) {
    riskScore += 25;
    riskReasons.push('No tiene agenda futura');
  }

  if (daysSinceLastAttention !== null && daysSinceLastAttention > RISK_DAYS_WITHOUT_APPOINTMENT) {
    riskScore += daysSinceLastAttention > 45 ? 30 : 20;
    riskReasons.push(`Hace ${daysSinceLastAttention} días que no asiste`);
  }

  if (highFrequency) {
    riskScore += 20;
    riskReasons.push(`Frecuencia histórica ${roundOne(weeklyFrequency)} sesiones/semana`);
  }

  if (patient.completedCount >= 12) {
    riskScore += 15;
    riskReasons.push(`${patient.completedCount} sesiones realizadas`);
  }

  if (attendanceRate >= GOOD_ATTENDANCE_THRESHOLD) {
    recoveryReasons.push(`Buena asistencia histórica: ${roundOne(attendanceRate)}%`);
  }

  if (activeDays >= 60) {
    recoveryReasons.push(`Permanencia de ${activeDays} días`);
  }

  if (patient.completedCount >= 8) badges.push('Recurrente');
  if (activeDays >= 60) badges.push('Largo Plazo');

  const atRisk = patient.completedCount >= 6
    && !hasFutureAppointment
    && daysSinceLastAttention !== null
    && daysSinceLastAttention > RISK_DAYS_WITHOUT_APPOINTMENT
    && (weeklyFrequency >= 1 || patient.completedCount >= 10);

  const recoverable = patient.completedCount >= 6
    && !hasFutureAppointment
    && daysSinceLastAttention !== null
    && daysSinceLastAttention >= RECOVERY_DAYS_WITHOUT_APPOINTMENT
    && daysSinceLastAttention <= RECOVERY_MAX_DAYS
    && attendanceRate >= GOOD_ATTENDANCE_THRESHOLD
    && (activeDays >= 45 || patient.completedCount >= 8);

  const vip = patient.invoiced >= VIP_INVOICED_THRESHOLD || patient.completedCount >= VIP_SESSION_THRESHOLD;

  if (vip) badges.push('Paciente estratégico');

  const promoterCandidate = vip
    && attendanceRate >= GOOD_ATTENDANCE_THRESHOLD
    && patient.completedCount >= 10
    && !atRisk;

  if (promoterCandidate) badges.push('Candidato a promotor');

  return {
    ...patient,
    firstAttention,
    lastAttention,
    daysSinceLastAttention,
    activeDays,
    weeklyFrequency: roundOne(weeklyFrequency),
    attendanceRate: roundOne(attendanceRate),
    hasFutureAppointment,
    recurrent,
    atRisk,
    recoverable,
    vip,
    promoter: false,
    promoterCandidate,
    riskScore: atRisk ? Math.max(60, riskScore) : riskScore,
    riskReasons,
    recoveryReasons,
    badges,
    ltv: roundCurrency(patient.invoiced),
    invoiced: roundCurrency(patient.invoiced),
    collected: roundCurrency(patient.collected),
    pending: roundCurrency(patient.pending),
  };
};

const buildPrimaryAction = (patient) => {
  if (patient.atRisk && patient.vip) {
    return {
      type: 'CALL_TODAY',
      label: 'Llamar hoy',
      reason: 'Paciente estratégico en riesgo de abandono',
      priority: 100,
    };
  }

  if (patient.atRisk) {
    return {
      type: 'WHATSAPP_FOLLOW_UP',
      label: 'Contactar seguimiento',
      reason: 'Cortar abandono antes de perder recurrencia',
      priority: 85,
    };
  }

  if (patient.recoverable) {
    return {
      type: 'REACTIVATE',
      label: 'Reactivar',
      reason: 'Buen historial y sin agenda futura',
      priority: 75,
    };
  }

  if (patient.vip) {
    return {
      type: 'RELATIONSHIP',
      label: 'Cuidar relación',
      reason: 'Paciente de alto valor económico',
      priority: 55,
    };
  }

  if (patient.promoterCandidate) {
    return {
      type: 'ASK_REFERRAL',
      label: 'Pedir referido',
      reason: 'Buen historial y perfil promotor',
      priority: 45,
    };
  }

  return null;
};

const buildMessageSuggestion = (patient) => {
  const firstName = getPatientFirstName(patient.patientName);

  if (patient.atRisk) {
    return `Hola ${firstName}, soy de Kareh. Queríamos saber cómo venís con tu evolución y si querés coordinamos el próximo turno.`;
  }

  if (patient.recoverable) {
    return `Hola ${firstName}, soy de Kareh. Vimos que hace un tiempo no venís y queríamos saber si necesitás retomar el tratamiento.`;
  }

  if (patient.vip) {
    return `Hola ${firstName}, soy de Kareh. Queríamos hacer seguimiento de cómo estás y ayudarte a mantener continuidad si lo necesitás.`;
  }

  return `Hola ${firstName}, soy de Kareh. Queríamos saber cómo estás y si necesitás coordinar un turno.`;
};

const buildActionQueue = (patients = []) => patients
  .map((patient) => {
    const action = buildPrimaryAction(patient);
    if (!action) return null;

    const missingPhonePenalty = patient.normalizedPhone ? 0 : -10;
    const valueBoost = patient.invoiced >= VIP_INVOICED_THRESHOLD ? 10 : 0;
    const pendingBoost = patient.pending > 0 ? 5 : 0;
    const urgencyScore = action.priority + valueBoost + pendingBoost + missingPhonePenalty;

    return {
      patientId: patient.patientId,
      patientName: patient.patientName,
      phone: patient.phone,
      normalizedPhone: patient.normalizedPhone,
      healthInsurance: patient.healthInsurance,
      actionType: action.type,
      actionLabel: action.label,
      reason: action.reason,
      urgencyScore,
      messageSuggestion: buildMessageSuggestion(patient),
      lastAttention: patient.lastAttention,
      daysSinceLastAttention: patient.daysSinceLastAttention,
      weeklyFrequency: patient.weeklyFrequency,
      completedCount: patient.completedCount,
      attendanceRate: patient.attendanceRate,
      invoiced: patient.invoiced,
      pending: patient.pending,
      badges: patient.badges,
      riskReasons: patient.riskReasons,
      recoveryReasons: patient.recoveryReasons,
    };
  })
  .filter(Boolean)
  .sort((left, right) => right.urgencyScore - left.urgencyScore);

export const getCrmIntelligenceSummary = async (req, res, prisma) => {
  try {
    const today = startOfDay(new Date());
    const [patients, appointments, invoices] = await Promise.all([
      prisma.patient.findMany({
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          healthInsurance: true,
          treatAsParticular: true,
          createdAt: true,
          obraSocial: {
            select: {
              nombreOs: true,
            },
          },
        },
      }),
      prisma.appointment.findMany({
        select: {
          id: true,
          date: true,
          status: true,
          patientId: true,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
        },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
            },
          },
          items: {
            include: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const patientMap = new Map(patients.map((patient) => [patient.id, buildPatientRecord(patient)]));

    appointments.forEach((appointment) => {
      const patient = patientMap.get(appointment.patientId);
      if (!patient) return;

      const appointmentDate = parseDate(appointment.date);
      if (!appointmentDate) return;

      if (appointment.status === COMPLETED_STATUS) {
        patient.completedCount += 1;
        patient.completedDates.push(appointmentDate);
        patient.firstAttention = patient.firstAttention && patient.firstAttention < appointmentDate
          ? patient.firstAttention
          : appointmentDate;
        patient.lastAttention = patient.lastAttention && patient.lastAttention > appointmentDate
          ? patient.lastAttention
          : appointmentDate;
        return;
      }

      if (appointment.status === NO_SHOW_STATUS) {
        patient.noShowCount += 1;
        return;
      }

      if (appointment.status === CANCELLED_STATUS) {
        patient.cancelledCount += 1;
        return;
      }

      if (appointmentDate >= today) {
        patient.futureAppointmentCount += 1;
        if (!patient.nextAppointment || appointmentDate < patient.nextAppointment) {
          patient.nextAppointment = appointmentDate;
        }
      }
    });

    buildFinancialRows(invoices).forEach((row) => {
      if (!patientMap.has(row.patientId)) {
        patientMap.set(row.patientId, buildPatientRecord({
          id: row.patientId,
          fullName: row.patientName || 'Sin paciente',
          phone: null,
          email: null,
          healthInsurance: null,
          treatAsParticular: false,
          createdAt: null,
          obraSocial: null,
        }));
      }

      const patient = patientMap.get(row.patientId);
      patient.invoiced += row.invoiced;
      patient.collected += row.collected;
      patient.pending += row.pending;
    });

    const rows = Array.from(patientMap.values())
      .map((patient) => classifyPatient(patient, today))
      .filter((patient) => patient.completedCount > 0 || patient.invoiced > 0 || patient.hasFutureAppointment);

    const atRisk = rows
      .filter((patient) => patient.atRisk)
      .sort((left, right) => right.riskScore - left.riskScore);
    const recoverable = rows
      .filter((patient) => patient.recoverable)
      .sort((left, right) => right.invoiced - left.invoiced);
    const vip = rows
      .filter((patient) => patient.vip)
      .sort((left, right) => right.invoiced - left.invoiced);
    const promoterCandidates = rows
      .filter((patient) => patient.promoterCandidate)
      .sort((left, right) => right.attendanceRate - left.attendanceRate);
    const actionQueue = buildActionQueue(rows);
    const activePatients = rows.filter((patient) => (
      patient.hasFutureAppointment
      || (patient.daysSinceLastAttention !== null && patient.daysSinceLastAttention <= 30)
    ));
    const strategicValueAtRisk = atRisk.reduce((sum, patient) => sum + patient.invoiced, 0);
    const pendingAtRisk = atRisk.reduce((sum, patient) => sum + patient.pending, 0);

    res.status(200).json({
      generatedAt: new Date(),
      summary: {
        totalPatients: rows.length,
        activePatients: activePatients.length,
        atRisk: atRisk.length,
        recoverable: recoverable.length,
        vip: vip.length,
        promoters: 0,
        promoterCandidates: promoterCandidates.length,
        actionQueue: actionQueue.length,
        strategicValueAtRisk: roundCurrency(strategicValueAtRisk),
        pendingAtRisk: roundCurrency(pendingAtRisk),
      },
      actionQueue,
      segments: {
        atRisk,
        recoverable,
        vip,
        promoters: [],
        promoterCandidates,
      },
      rules: {
        atRisk: [
          '6 o más sesiones realizadas',
          'Sin agenda futura',
          `Más de ${RISK_DAYS_WITHOUT_APPOINTMENT} días sin asistir`,
          'Frecuencia histórica relevante o 10+ sesiones',
        ],
        recoverable: [
          '6 o más sesiones realizadas',
          `Entre ${RECOVERY_DAYS_WITHOUT_APPOINTMENT} y ${RECOVERY_MAX_DAYS} días sin asistir`,
          `Asistencia histórica mayor o igual a ${GOOD_ATTENDANCE_THRESHOLD}%`,
          'Permanencia de 45+ días o 8+ sesiones',
        ],
        vip: [
          `Más de $${VIP_INVOICED_THRESHOLD.toLocaleString('es-AR')} facturados`,
          `${VIP_SESSION_THRESHOLD}+ sesiones realizadas`,
        ],
        promoter: [
          'Requiere vínculo explícito de derivación entre pacientes',
          'Mientras no exista ese dato, sólo se detectan candidatos a promotor',
        ],
      },
      missingData: [
        {
          key: 'patient_referrals',
          label: 'Derivaciones entre pacientes',
          reason: 'El esquema actual no tiene campo referido_por o fuente_de_derivación; no se puede afirmar que un paciente trajo a otros.',
        },
        {
          key: 'manual_contact_status',
          label: 'Resultado de contactos',
          reason: 'Falta registrar si se llamó, respondió, rechazó o volvió a agendar para cerrar el ciclo CRM.',
        },
        {
          key: 'lost_reason',
          label: 'Motivo de abandono',
          reason: 'El sistema detecta abandono probable, pero todavía no registra causa clínica, económica o administrativa.',
        },
      ],
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener inteligencia CRM');
  }
};

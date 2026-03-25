export const patientSelect = {
  id: true,
  dni: true,
  fullName: true,
  clinicalRecordNumber: true,
  email: true,
  birthDate: true,
  healthInsurance: true,
  affiliateNumber: true,
  dniImageUrl: true,
  dniBackImageUrl: true,
  insuranceCardImageUrl: true,
  insuranceCardBackImageUrl: true,
  phone: true,
  address: true,
  emergencyPhone: true,
  medicalHistory: true,
  hasCancer: true,
  hasMarcapasos: true,
  usesEA: true,
  medicalNotes: true,
  createdAt: true,
  updatedAt: true,
};

export const patientIdSelect = { id: true };

export const patientWithAppointmentCountSelect = {
  ...patientSelect,
  _count: {
    select: {
      appointments: true,
    },
  },
};

export const professionalSelect = {
  id: true,
  fullName: true,
  licenseNumber: true,
  licenseNumberMP: true,
  specialty: true,
  type: true,
  isActive: true,
  isArchived: true,
  dni: true,
  phone: true,
  birthDate: true,
  address: true,
  emergencyPhone: true,
  medicalHistory: true,
  dniImageUrl: true,
  dniBackImageUrl: true,
  licenseMNImageUrl: true,
  licenseMNBackImageUrl: true,
  licenseMPImageUrl: true,
  licenseMPBackImageUrl: true,
  degreeImageUrl: true,
  degreeBackImageUrl: true,
  providerRegistryImageUrl: true,
  malpracticeInsuranceImageUrl: true,
  createdAt: true,
  updatedAt: true,
};

export const workScheduleSelect = {
  id: true,
  professionalId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
};

export const professionalWithScheduleSelect = {
  ...professionalSelect,
  workSchedule: {
    select: workScheduleSelect,
    orderBy: {
      dayOfWeek: 'asc',
    },
  },
};

export const appointmentBaseSelect = {
  id: true,
  date: true,
  time: true,
  slotNumber: true,
  diagnosis: true,
  patientId: true,
  professionalId: true,
  cycleId: true,
  sessionNumber: true,
  isFirstSession: true,
  status: true,
  whatsappTicketSentAt: true,
  whatsappReminderSentAt: true,
};

export const appointmentSelect = {
  ...appointmentBaseSelect,
  patient: {
    select: patientSelect,
  },
  professional: {
    select: professionalSelect,
  },
};

export const appointmentWithProfessionalSelect = {
  ...appointmentBaseSelect,
  professional: {
    select: professionalSelect,
  },
};

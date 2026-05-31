import React from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Flag,
  MessageSquare,
  X,
  Zap,
} from 'lucide-react';
import { getCoverageLabel, isParticularCoverage } from '@/utils/coverage';

export const getCoverageBadgeClass = (value, treatAsParticular = false) => (
  isParticularCoverage(value, treatAsParticular)
    ? 'text-blue-800 bg-blue-100/80'
    : 'text-teal-800 bg-teal-100/50'
);

export const getStatusMeta = (status, usesEA, treatAsParticular, healthInsurance, isRespiratory, isIU) => {
  const isPami = healthInsurance?.toUpperCase().includes('PAMI');

  if (status === 'COMPLETED') {
    return {
      cardClass: 'bg-emerald-50 border-emerald-600',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      label: 'Asistió',
      icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />,
    };
  }

  if (status === 'NO_SHOW') {
    return {
      cardClass: 'bg-rose-50 border-rose-600',
      badgeClass: 'bg-rose-100 text-rose-700',
      label: 'Inasistencia',
      icon: <AlertTriangle size={16} className="text-rose-600 shrink-0" />,
    };
  }

  if (status === 'CANCELLED') {
    return {
      cardClass: 'bg-slate-50 border-slate-300',
      badgeClass: 'bg-slate-200 text-slate-700',
      label: 'Cancelado',
      icon: <X size={16} className="text-slate-500 shrink-0" />,
    };
  }

  if (status === 'PENDING_AUTHORIZATION') {
    return {
      cardClass: 'bg-amber-50 border-amber-500',
      badgeClass: 'bg-amber-100 text-amber-700',
      label: 'Pend. autorización',
      icon: null,
    };
  }

  if (status === 'AUTHORIZED') {
    return {
      cardClass: 'bg-cyan-50 border-cyan-500',
      badgeClass: 'bg-cyan-100 text-cyan-700',
      label: 'Autorizado',
      icon: null,
    };
  }

  if (status === 'REJECTED') {
    return {
      cardClass: 'bg-rose-50 border-rose-500',
      badgeClass: 'bg-rose-100 text-rose-700',
      label: 'Rechazado',
      icon: null,
    };
  }

  if (isIU && status === 'SCHEDULED') {
    return {
      cardClass: 'bg-orange-50 border-orange-400',
      badgeClass: 'bg-orange-100 text-orange-700',
      label: 'Tratamiento IU',
      icon: <span className="text-lg">💧</span>,
    };
  }

  if (isRespiratory && status === 'SCHEDULED') {
    return {
      cardClass: 'bg-purple-50 border-purple-400',
      badgeClass: 'bg-purple-100 text-purple-700',
      label: 'Respiratorio',
      icon: <span className="text-lg">🫁</span>,
    };
  }

  if (isPami && status === 'SCHEDULED') {
    return {
      cardClass: 'bg-amber-50 border-amber-400',
      badgeClass: 'bg-amber-100 text-amber-700',
      label: 'PAMI',
      icon: null,
    };
  }

  if (isParticularCoverage(healthInsurance, treatAsParticular)) {
    return {
      cardClass: 'bg-blue-50 border-blue-600',
      badgeClass: 'bg-blue-100 text-blue-700',
      label: 'Programado',
      icon: null,
    };
  }

  return {
    cardClass: usesEA ? 'bg-indigo-50 border-indigo-600' : 'bg-teal-50 border-teal-600',
    badgeClass: 'bg-slate-100 text-slate-600',
    label: 'Programado',
    icon: null,
  };
};

export const getAuthorizationStatusMeta = (authorizationStatus) => {
  if (authorizationStatus === 'PENDING') {
    return {
      badgeClass: 'bg-amber-100 text-amber-700',
      label: 'Pend. autorización',
    };
  }

  if (authorizationStatus === 'AUTHORIZED') {
    return {
      badgeClass: 'bg-cyan-100 text-cyan-700',
      label: 'Autorizado',
    };
  }

  if (authorizationStatus === 'REJECTED') {
    return {
      badgeClass: 'bg-rose-100 text-rose-700',
      label: 'Rechazado',
    };
  }

  return null;
};

export const buildAppointmentDailyPresentation = (appointment = {}) => {
  const patient = appointment.patient || {};
  const statusMeta = getStatusMeta(
    appointment.status,
    patient.usesEA,
    patient.treatAsParticular,
    patient.healthInsurance,
    patient.isRespiratory,
    patient.isIU
  );

  const badges = [
    {
      key: 'status',
      label: statusMeta.label,
      className: statusMeta.badgeClass,
      icon: statusMeta.icon,
    },
  ];

  const explicitAuthorizationMeta = getAuthorizationStatusMeta(appointment.authorizationStatus);
  if (
    explicitAuthorizationMeta
    && !['PENDING_AUTHORIZATION', 'AUTHORIZED', 'REJECTED'].includes(appointment.status)
  ) {
    badges.push({
      key: 'authorization',
      label: explicitAuthorizationMeta.label,
      className: explicitAuthorizationMeta.badgeClass,
    });
  }

  if (appointment.isFirstSession) {
    badges.push({
      key: 'first-session',
      label: 'INGRESO',
      className: 'bg-rose-500 text-white',
      icon: <Flag size={8} fill="currentColor" />,
    });
  }

  badges.push({
    key: 'coverage',
    label: getCoverageLabel(patient.healthInsurance, patient.treatAsParticular) || 'Sin cobertura',
    className: getCoverageBadgeClass(patient.healthInsurance, patient.treatAsParticular),
  });

  badges.push({
    key: 'session',
    label: `SESIÓN ${appointment.isFirstSession ? 1 : appointment.sessionNumber}`,
    className: 'bg-slate-100 text-slate-600',
  });

  if (appointment.sessionToken) {
    badges.push({
      key: 'session-token',
      label: `Token: ${appointment.sessionToken}`,
      className: 'bg-orange-100 text-orange-700',
    });
  }

  if (appointment.authorizationNumber) {
    badges.push({
      key: 'authorization-number',
      label: `Aut. ${appointment.authorizationNumber}`,
      className: 'bg-slate-100 text-slate-600',
    });
  }

  badges.push({
    key: 'payment',
    label: appointment.paidInAdvance ? 'Abonado' : 'Pago pendiente',
    className: appointment.paidInAdvance ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
    icon: appointment.paidInAdvance ? <Banknote size={11} /> : null,
  });

  if (appointment.whatsappTicketSentAt || appointment.whatsappReminderSentAt) {
    badges.push({
      key: 'whatsapp',
      label: 'WhatsApp enviado',
      className: 'bg-slate-100 text-slate-600',
      icon: <MessageSquare size={11} />,
    });
  }

  const clinicalIcons = [
    patient.hasCancer && { key: 'cancer', title: 'Oncológico', icon: <AlertTriangle size={12} className="text-rose-500" /> },
    patient.hasMarcapasos && { key: 'marcapasos', title: 'Marcapasos', icon: <Activity size={12} className="text-blue-600 stroke-[3px]" /> },
    patient.usesEA && { key: 'ea', title: 'Usa EA', icon: <Zap size={12} className="text-amber-500 fill-amber-500" /> },
    patient.usesWheelchair && { key: 'wheelchair', title: 'Silla de Ruedas', icon: <span className="text-[14px]" title="Silla de Ruedas">🦽</span> },
    patient.isIU && { key: 'iu', title: 'Tratamiento IU / piso pélvico', icon: <span className="text-[14px]" title="Tratamiento IU / piso pélvico">💧</span> },
    patient.isRespiratory && { key: 'respiratory', title: 'Respiratorio', icon: <span className="text-[14px]" title="Respiratorio">🫁</span> },
  ].filter(Boolean);

  return {
    statusMeta,
    badges,
    clinicalIcons,
  };
};

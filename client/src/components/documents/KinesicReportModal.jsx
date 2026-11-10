import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Printer, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { getStoredUser } from '../../services/session';
import { showErrorToast } from '../toastHelpers';
import DocumentModalShell from './DocumentModalShell';
import {
  fieldLabelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './documentStyles';
import {
  KINESIC_REPORT_TEMPLATES,
  KINESIC_REPORT_TEMPLATE_LIST,
  suggestTemplateId,
} from '../../utils/documents/kinesicReportTemplates';
import { buildKinesicReportHtml, buildLicenseLine } from '../../utils/documents/kinesicReportHtml';
import { calculateAge, formatDateAR, formatDniAR, openPrintWindow, todayISO } from '../../utils/documents/printDocument';
import {
  countTreatmentSessions,
  getLatestDiagnosis,
  getLatestProfessionalId,
  getPatientCoverage,
} from './patientDocumentData';

const buildTechniques = (templateId) => KINESIC_REPORT_TEMPLATES[templateId].techniques.map((name) => ({ name, detail: '' }));

/**
 * Informe kinésico (FKT, respiratorio o piso pélvico). Los datos del paciente,
 * el diagnóstico, las sesiones y el profesional se completan solos desde la ficha;
 * el resto es texto clínico que escribe el profesional.
 * Montarlo con key={patient.id} para que se reinicie con cada paciente.
 */
export default function KinesicReportModal({ patient, onClose }) {
  const storedUser = getStoredUser();
  const [templateId, setTemplateId] = useState(() => suggestTemplateId(patient));
  const [date, setDate] = useState(todayISO);
  const [diagnosis, setDiagnosis] = useState(() => getLatestDiagnosis(patient));
  const [physician, setPhysician] = useState('');
  const [anamnesis, setAnamnesis] = useState('');
  const [sessions, setSessions] = useState(() => String(countTreatmentSessions(patient) || 10));
  const [metricsIn, setMetricsIn] = useState({});
  const [metricsOut, setMetricsOut] = useState({});
  const [techniques, setTechniques] = useState(() => buildTechniques(suggestTemplateId(patient)));
  const [dischargeStatus, setDischargeStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [professionals, setProfessionals] = useState([]);
  const [professionalId, setProfessionalId] = useState(() => storedUser.professionalId || getLatestProfessionalId(patient));

  const template = KINESIC_REPORT_TEMPLATES[templateId];
  const { coverage, affiliateNumber } = getPatientCoverage(patient);
  const age = calculateAge(patient?.birthDate);

  useEffect(() => {
    let cancelled = false;
    api.get('/professionals')
      .then(({ data }) => {
        if (!cancelled) setProfessionals(Array.isArray(data) ? data.filter((item) => !item.isArchived) : []);
      })
      .catch(() => {
        if (!cancelled) setProfessionals([]);
      });
    return () => { cancelled = true; };
  }, []);

  const selectedProfessional = useMemo(
    () => professionals.find((item) => item.id === professionalId) || null,
    [professionals, professionalId],
  );

  const changeTemplate = (nextTemplateId) => {
    setTemplateId(nextTemplateId);
    setTechniques(buildTechniques(nextTemplateId));
    setMetricsIn({});
    setMetricsOut({});
  };

  const updateTechnique = (index, field, value) => {
    setTechniques((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const handleGenerate = () => {
    if (!selectedProfessional) {
      showErrorToast('Elegí el profesional que firma el informe.');
      return;
    }

    const toMetricRows = (values) => template.metrics.map((metric) => ({
      label: metric.label,
      suffix: metric.suffix,
      value: values[metric.key] || '',
    }));

    const html = buildKinesicReportHtml({
      title: template.title,
      treatmentIntro: template.treatmentIntro,
      date,
      patient: {
        fullName: patient.fullName,
        dni: formatDniAR(patient.dni),
        birthDate: age ? patient.birthDate : '',
        age,
        clinicalRecordNumber: patient.clinicalRecordNumber,
      },
      coverage,
      affiliateNumber,
      diagnosis,
      physician,
      anamnesis,
      metricsIn: toMetricRows(metricsIn),
      sessions,
      techniques,
      dischargeStatus,
      metricsOut: toMetricRows(metricsOut),
      plan,
      professional: {
        fullName: selectedProfessional.fullName,
        licenseLine: buildLicenseLine(selectedProfessional),
      },
    });

    if (!openPrintWindow(html)) {
      showErrorToast('El navegador bloqueó la ventana del informe. Permití ventanas emergentes para este sitio.');
    }
  };

  const metricInputs = (values, setValues, suffixLabel) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {template.metrics.map((metric) => (
        <label key={`${suffixLabel}-${metric.key}`} className="block">
          <span className={fieldLabelClass}>{metric.label} {suffixLabel}</span>
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              value={values[metric.key] || ''}
              placeholder={metric.placeholder}
              onChange={(event) => setValues((prev) => ({ ...prev, [metric.key]: event.target.value }))}
            />
            {metric.suffix && <span className="shrink-0 text-xs font-black text-slate-400">{metric.suffix}</span>}
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <DocumentModalShell
      title="Informe kinésico"
      subtitle={`${patient.fullName} · DNI ${formatDniAR(patient.dni)}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={(
        <>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button type="button" className={primaryButtonClass} onClick={handleGenerate}>
            <Printer size={16} /> Generar e imprimir
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <section>
          <span className={fieldLabelClass}>Tipo de informe</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINESIC_REPORT_TEMPLATE_LIST.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => changeTemplate(option.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-black transition ${templateId === option.id ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}
              >
                <FileText size={16} /> {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">1. Datos del paciente (desde la ficha)</p>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold text-slate-400">Nombre</dt><dd className="font-black text-slate-800">{patient.fullName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">DNI</dt><dd className="font-black text-slate-800">{formatDniAR(patient.dni)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">Nacimiento / edad</dt><dd className="font-black text-slate-800">{age ? `${formatDateAR(patient.birthDate)} · ${age} años` : 'Sin dato en la ficha'}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">Cobertura</dt><dd className="font-black text-slate-800">{coverage}{affiliateNumber ? ` · ${affiliateNumber}` : ''}</dd></div>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Diagnóstico</span>
              <input className={inputClass} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Fecha del informe</span>
              <input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Médico derivante</span>
              <input className={inputClass} value={physician} placeholder="Dr./Dra. ..." onChange={(event) => setPhysician(event.target.value)} />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Profesional que firma</span>
              <select className={inputClass} value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                <option value="">Elegir…</option>
                {professionals.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">2. Estado funcional de ingreso</p>
          <label className="block">
            <span className={fieldLabelClass}>Anamnesis y motivo de consulta</span>
            <textarea rows={3} className={inputClass} value={anamnesis} onChange={(event) => setAnamnesis(event.target.value)} />
          </label>
          {metricInputs(metricsIn, setMetricsIn, 'inicial')}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">3. Tratamiento efectuado y evolución</p>
            <label className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500">Sesiones realizadas</span>
              <input type="number" min="1" className={`${inputClass} w-24`} value={sessions} onChange={(event) => setSessions(event.target.value)} />
            </label>
          </div>
          {techniques.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className={inputClass} value={row.name} placeholder="Técnica" onChange={(event) => updateTechnique(index, 'name', event.target.value)} />
              <textarea rows={2} className={inputClass} value={row.detail} placeholder="Objetivo, aplicación y evolución observada" onChange={(event) => updateTechnique(index, 'detail', event.target.value)} />
              <button type="button" className="self-start rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Quitar técnica" onClick={() => setTechniques((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="inline-flex items-center gap-2 text-sm font-black text-teal-700 hover:text-teal-900" onClick={() => setTechniques((rows) => [...rows, { name: '', detail: '' }])}>
            <Plus size={16} /> Agregar técnica
          </button>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">4. Estado de egreso y recomendaciones</p>
          <label className="block">
            <span className={fieldLabelClass}>Estado actual de egreso</span>
            <textarea rows={3} className={inputClass} value={dischargeStatus} onChange={(event) => setDischargeStatus(event.target.value)} />
          </label>
          {metricInputs(metricsOut, setMetricsOut, 'al egreso')}
          <label className="block">
            <span className={fieldLabelClass}>Indicación profesional y plan de continuidad</span>
            <textarea rows={3} className={inputClass} value={plan} onChange={(event) => setPlan(event.target.value)} />
          </label>
        </section>
      </div>
    </DocumentModalShell>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Printer, Save, SpellCheck, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { getStoredUser } from '../../services/session';
import { showErrorToast, showSuccessToast } from '../toastHelpers';
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

/** Pasa las filas de mediciones guardadas ({ label, value }) al formato del formulario ({ key: value }). */
const metricRowsToValues = (templateId, rows) => {
  const metrics = KINESIC_REPORT_TEMPLATES[templateId]?.metrics || [];
  return Object.fromEntries(metrics
    .map((metric) => [metric.key, (rows || []).find((row) => row?.label === metric.label)?.value || ''])
    .filter(([, value]) => value));
};

const toDateInput = (value) => String(value || '').slice(0, 10);

/**
 * Informe kinésico (FKT, respiratorio o piso pélvico). Los datos del paciente,
 * el diagnóstico, las sesiones y el profesional se completan solos desde la ficha;
 * el resto es texto clínico que escribe el profesional.
 * Con `report` se abre en modo edición de un informe ya guardado.
 * Montarlo con key={patient.id} (o el id del informe) para que se reinicie.
 */
export default function KinesicReportModal({ patient, report = null, onClose, onSaved }) {
  const storedUser = getStoredUser();
  const saved = report?.data || null;
  const isEditing = Boolean(report?.id);
  const initialTemplateId = KINESIC_REPORT_TEMPLATES[report?.type] ? report.type : suggestTemplateId(patient);
  const [saving, setSaving] = useState(false);
  const [checkingSpelling, setCheckingSpelling] = useState(false);
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [date, setDate] = useState(() => (saved ? toDateInput(saved.date || report.reportDate) : todayISO()));
  const [diagnosis, setDiagnosis] = useState(() => (saved ? saved.diagnosis || '' : getLatestDiagnosis(patient)));
  const [physician, setPhysician] = useState(() => saved?.physician || '');
  const [anamnesis, setAnamnesis] = useState(() => saved?.anamnesis || '');
  const [sessions, setSessions] = useState(() => (saved ? String(saved.sessions || '') : String(countTreatmentSessions(patient) || 10)));
  const [metricsIn, setMetricsIn] = useState(() => (saved ? metricRowsToValues(initialTemplateId, saved.metricsIn) : {}));
  const [metricsOut, setMetricsOut] = useState(() => (saved ? metricRowsToValues(initialTemplateId, saved.metricsOut) : {}));
  const [techniques, setTechniques] = useState(() => (
    saved && Array.isArray(saved.techniques)
      ? saved.techniques.map((row) => ({ name: row?.name || '', detail: row?.detail || '' }))
      : buildTechniques(initialTemplateId)
  ));
  const [dischargeStatus, setDischargeStatus] = useState(() => saved?.dischargeStatus || '');
  const [plan, setPlan] = useState(() => saved?.plan || '');
  const [professionals, setProfessionals] = useState([]);
  const [professionalId, setProfessionalId] = useState(() => (
    report?.professionalId || storedUser.professionalId || getLatestProfessionalId(patient)
  ));

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

  const handleGenerate = async () => {
    if (saving) return;
    if (!selectedProfessional) {
      showErrorToast('Elegí el profesional que firma el informe.');
      return;
    }
    if (!date) {
      showErrorToast('Completá la fecha del informe.');
      return;
    }

    const toMetricRows = (values) => template.metrics.map((metric) => ({
      label: metric.label,
      suffix: metric.suffix,
      value: values[metric.key] || '',
    }));

    const reportData = {
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
    };

    const payload = {
      professionalId: selectedProfessional.id,
      type: templateId,
      title: template.title,
      reportDate: date,
      data: reportData,
    };

    if (isEditing) {
      setSaving(true);
      try {
        const { data: updated } = await api.put(`/reports/${report.id}`, payload);
        showSuccessToast('Informe actualizado. Podés reimprimirlo desde la historia clínica.');
        onSaved?.(updated);
        onClose();
      } catch (error) {
        showErrorToast(error?.friendlyMessage || 'No se pudo actualizar el informe. Intentá de nuevo.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Primero se abre la impresión (tiene que ser en el mismo click o el navegador
    // bloquea la ventana) y después se guarda en la historia clínica.
    const printed = openPrintWindow(buildKinesicReportHtml(reportData));

    setSaving(true);
    try {
      const { data: created } = await api.post('/reports', { patientId: patient.id, ...payload });
      showSuccessToast(printed
        ? 'Informe guardado en la historia clínica.'
        : 'Informe guardado. El navegador bloqueó la impresión: reimprimilo desde la historia clínica.');
      onSaved?.(created);
      onClose();
    } catch (error) {
      showErrorToast(error?.friendlyMessage || 'No se pudo guardar el informe en la historia clínica. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSpellcheck = async () => {
    if (checkingSpelling) return;
    const texts = { diagnosis, anamnesis, dischargeStatus, plan };
    techniques.forEach((row, index) => {
      texts[`technique.${index}.name`] = row.name;
      texts[`technique.${index}.detail`] = row.detail;
    });
    const toCheck = Object.fromEntries(Object.entries(texts).filter(([, value]) => String(value || '').trim()));
    if (Object.keys(toCheck).length === 0) {
      showErrorToast('No hay texto para corregir todavía.');
      return;
    }

    setCheckingSpelling(true);
    try {
      const { data } = await api.post('/reports/spellcheck', { texts: toCheck });
      const fixed = data?.texts || {};
      const changed = Object.keys(toCheck).filter((key) => typeof fixed[key] === 'string' && fixed[key] !== toCheck[key]);
      const pick = (key, current) => (changed.includes(key) ? fixed[key] : current);

      setDiagnosis((value) => pick('diagnosis', value));
      setAnamnesis((value) => pick('anamnesis', value));
      setDischargeStatus((value) => pick('dischargeStatus', value));
      setPlan((value) => pick('plan', value));
      setTechniques((rows) => rows.map((row, index) => ({
        name: pick(`technique.${index}.name`, row.name),
        detail: pick(`technique.${index}.detail`, row.detail),
      })));

      showSuccessToast(changed.length
        ? `Ortografía corregida en ${changed.length} ${changed.length === 1 ? 'campo' : 'campos'}. Revisá el texto antes de guardar.`
        : 'No se encontraron errores de ortografía.');
    } catch (error) {
      showErrorToast(error?.friendlyMessage || 'No se pudo corregir la ortografía. Intentá de nuevo.');
    } finally {
      setCheckingSpelling(false);
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
      title={isEditing ? 'Editar informe kinésico' : 'Informe kinésico'}
      subtitle={`${patient.fullName} · DNI ${formatDniAR(patient.dni)}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={(
        <>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button type="button" className={secondaryButtonClass} onClick={handleSpellcheck} disabled={checkingSpelling || saving}>
            <SpellCheck size={16} /> {checkingSpelling ? 'Corrigiendo…' : 'Corregir ortografía'}
          </button>
          <button type="button" className={primaryButtonClass} onClick={handleGenerate} disabled={saving || checkingSpelling}>
            {isEditing
              ? <><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</>
              : <><Printer size={16} /> {saving ? 'Guardando…' : 'Generar, guardar e imprimir'}</>}
          </button>
        </>
      )}
    >
      {/* lang + spellCheck: el navegador subraya las palabras mal escritas en español mientras se tipea. */}
      <div className="space-y-6" lang="es" spellCheck>
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

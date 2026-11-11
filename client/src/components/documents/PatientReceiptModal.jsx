import React, { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import api from '../../services/api';
import { showErrorToast, showSuccessToast } from '../toastHelpers';
import DocumentModalShell from './DocumentModalShell';
import {
  fieldLabelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './documentStyles';
import { formatCurrencyAR, formatDniAR, todayISO } from '../../utils/documents/printDocument';
import { getLatestDiagnosis, getPatientCoverage, parseAmountInput } from './patientDocumentData';
import { printPatientReceipt } from './printReceipt';

/**
 * Comprobante no válido como factura ante ARCA. Todo sale de la ficha del paciente;
 * a mano solo se cargan la descripción, el monto y la fecha (por defecto, hoy).
 * Si no recibe paciente, permite buscarlo por DNI.
 */
export default function PatientReceiptModal({ patient: initialPatient = null, onClose, onCreated }) {
  const [patient, setPatient] = useState(initialPatient);
  const [dniQuery, setDniQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO);
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseAmountInput(amount);
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const coverageData = patient ? getPatientCoverage(patient) : null;

  const handleSearch = async (event) => {
    event.preventDefault();
    const dni = dniQuery.replace(/\D/g, '');
    if (!dni) {
      showErrorToast('Ingresá el DNI del paciente.');
      return;
    }
    try {
      setSearching(true);
      const { data } = await api.get('/patients/search', { params: { dni } });
      setPatient(data || null);
      if (!data) showErrorToast('No se encontró un paciente con ese DNI.');
    } catch (error) {
      setPatient(null);
      showErrorToast(error?.response?.status === 404 ? 'No se encontró un paciente con ese DNI.' : 'No se pudo buscar el paciente.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!patient) {
      showErrorToast('Primero elegí el paciente.');
      return;
    }
    if (!description.trim()) {
      showErrorToast('Escribí la descripción de la prestación.');
      return;
    }
    if (!amountIsValid) {
      showErrorToast('Ingresá un monto mayor a 0.');
      return;
    }
    if (!issueDate) {
      showErrorToast('Elegí la fecha del comprobante.');
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post('/receipts', {
        patientId: patient.id,
        description: description.trim(),
        amount: parsedAmount,
        issueDate,
      });
      showSuccessToast(`Comprobante ${data.displayNumber} emitido`);
      printPatientReceipt(data);
      onCreated?.(data);
      onClose?.();
    } catch (error) {
      showErrorToast(error?.response?.data?.message || 'No se pudo emitir el comprobante.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DocumentModalShell
      title="Comprobante no fiscal"
      subtitle="No válido como factura ante ARCA. Los datos del paciente se completan solos."
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={(
        <>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button type="submit" form="patient-receipt-form" className={primaryButtonClass} disabled={saving || !patient}>
            <Printer size={16} /> {saving ? 'Emitiendo…' : 'Emitir e imprimir'}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {!initialPatient && (
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="DNI del paciente"
              value={dniQuery}
              onChange={(event) => setDniQuery(event.target.value)}
              aria-label="DNI del paciente"
            />
            <button type="submit" className={secondaryButtonClass} disabled={searching}>
              <Search size={16} /> {searching ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
        )}

        {patient && (
          <dl className="grid gap-x-6 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold text-slate-400">Paciente</dt><dd className="font-black text-slate-800">{patient.fullName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">DNI</dt><dd className="font-black text-slate-800">{formatDniAR(patient.dni)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">Obra social / prepaga</dt><dd className="font-black text-slate-800">{coverageData.coverage}</dd></div>
            <div><dt className="text-xs font-bold text-slate-400">N° de afiliado</dt><dd className="font-black text-slate-800">{coverageData.affiliateNumber || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-400">Diagnóstico</dt><dd className="font-black text-slate-800">{getLatestDiagnosis(patient) || '—'}</dd></div>
            <p className="text-xs font-semibold text-slate-400 sm:col-span-2">El profesional y su matrícula se toman del último turno del paciente.</p>
          </dl>
        )}

        <form id="patient-receipt-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className={fieldLabelClass}>Descripción</span>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Ej.: 10 sesiones de kinesiología y fisioterapia"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!patient}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Monto</span>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="15.000,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={!patient}
            />
            {amount && (
              <span className={`mt-1 block text-xs font-bold ${amountIsValid ? 'text-slate-500' : 'text-rose-600'}`}>
                {amountIsValid ? formatCurrencyAR(parsedAmount) : 'Monto inválido'}
              </span>
            )}
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Fecha del comprobante</span>
            <input
              type="date"
              className={inputClass}
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              disabled={!patient}
            />
          </label>
        </form>
      </div>
    </DocumentModalShell>
  );
}

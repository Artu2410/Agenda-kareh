import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Printer, Receipt } from 'lucide-react';
import api from '../../services/api';
import { showErrorToast } from '../toastHelpers';
import PatientReceiptModal from './PatientReceiptModal';
import { printPatientReceipt } from './printReceipt';
import { formatCurrencyAR, formatDateAR } from '../../utils/documents/printDocument';

/** Comprobantes no fiscales: emitir nuevos y reimprimir los últimos. */
export default function ReceiptsSection() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadReceipts = useCallback(async () => {
    try {
      const { data } = await api.get('/receipts', { params: { limit: 20 } });
      setReceipts(Array.isArray(data) ? data : []);
    } catch (error) {
      showErrorToast(error?.friendlyMessage || 'No se pudieron cargar los comprobantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Receipt size={20} /> Comprobantes no fiscales</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">No válidos como factura ante ARCA. Se completan con los datos del paciente.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-black text-white transition hover:bg-teal-700"
        >
          <Plus size={16} /> Nuevo comprobante
        </button>
      </div>

      {loading ? (
        <p className="px-5 py-6 text-center text-sm font-semibold text-slate-400">Cargando comprobantes...</p>
      ) : receipts.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm font-semibold text-slate-400">Todavía no se emitieron comprobantes.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {receipts.map((receipt) => (
            <li key={receipt.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-black text-slate-900">
                  {receipt.patientName}
                  <span className="ml-2 text-xs font-bold text-slate-400">N° {receipt.displayNumber} · {formatDateAR(receipt.issueDate)}</span>
                </p>
                <p className="truncate text-sm font-semibold text-slate-500">{receipt.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-slate-800">{formatCurrencyAR(receipt.amount)}</span>
                <button
                  type="button"
                  onClick={() => printPatientReceipt(receipt)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  <Printer size={14} /> Reimprimir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <PatientReceiptModal
          onClose={() => setShowModal(false)}
          onCreated={(receipt) => setReceipts((prev) => [receipt, ...prev].slice(0, 20))}
        />
      )}
    </section>
  );
}

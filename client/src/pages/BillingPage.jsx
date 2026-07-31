import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import api from '../services/api';
import { showErrorToast, showSuccessToast } from '../components/toastHelpers';

const todayInputValue = () => new Date().toISOString().slice(0, 10);
const currentMonthValue = () => new Date().toISOString().slice(0, 7);
const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const createEmptyInvoiceForm = () => ({
  invoiceNumber: '',
  payerType: 'OBRA_SOCIAL',
  obraSocialId: '',
  payerName: '',
  issueDate: todayInputValue(),
  serviceMonth: currentMonthValue(),
  expectedPaymentDate: '',
  description: 'Prestaciones facturadas',
  quantity: 1,
  unitAmount: '',
  notes: '',
});

const createEmptyPaymentForm = (pendingAmount = 0) => ({
  amount: pendingAmount ? String(pendingAmount) : '',
  paymentDate: todayInputValue(),
  paymentMethod: 'Banco Provincia',
  account: 'BANCO_PROVINCIA',
  notes: '',
});

const createInvoiceFormFromInvoice = (invoice = {}) => {
  const primaryItem = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items[0]
    : {};
  const quantity = Number(primaryItem.quantity) || 1;
  const unitAmount = Number(primaryItem.unitAmount) || (Number(invoice.totalAmount) / quantity) || '';

  return {
    invoiceNumber: invoice.invoiceNumber || '',
    payerType: invoice.payerType || 'OBRA_SOCIAL',
    obraSocialId: invoice.obraSocialId || invoice.obraSocial?.id || '',
    payerName: invoice.payerName || '',
    issueDate: dateInputValue(invoice.issueDate) || todayInputValue(),
    serviceMonth: invoice.serviceMonth || currentMonthValue(),
    expectedPaymentDate: dateInputValue(invoice.expectedPaymentDate),
    description: primaryItem.description || 'Prestaciones facturadas',
    quantity,
    unitAmount: unitAmount === '' ? '' : String(unitAmount),
    notes: invoice.notes || '',
  };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-AR');
};

const statusLabels = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Cobrada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

const statusClassNames = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ISSUED: 'bg-sky-100 text-sky-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

const SummaryCard = ({ label, value, description, icon, iconClassName, valueClassName }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
        <p className={`mt-2 text-2xl font-black leading-tight ${valueClassName || 'text-slate-900'}`}>
          {value}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <div className={`shrink-0 rounded-xl p-3 ${iconClassName}`}>
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </section>
);

const BillingPage = () => {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(createEmptyInvoiceForm);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [paymentForms, setPaymentForms] = useState({});
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingPaymentId, setSavingPaymentId] = useState(null);

  const fetchBillingData = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const [summaryResponse, invoicesResponse, obrasSocialesResponse] = await Promise.all([
        api.get('/billing/summary'),
        api.get('/billing/invoices'),
        api.get('/obras-sociales?activeOnly=1'),
      ]);

      setSummary(summaryResponse.data);
      setInvoices(Array.isArray(invoicesResponse.data) ? invoicesResponse.data : []);
      setObrasSociales(Array.isArray(obrasSocialesResponse.data) ? obrasSocialesResponse.data : []);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar facturación.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBillingData();
  }, [fetchBillingData]);

  const openInvoices = useMemo(
    () => invoices.filter((invoice) => Number(invoice.pendingAmount) > 0 && invoice.status !== 'CANCELLED'),
    [invoices]
  );

  const paidInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'PAID'),
    [invoices]
  );

  const obraSocialOptions = useMemo(() => {
    const optionsById = new Map();

    obrasSociales.forEach((obraSocial) => {
      optionsById.set(obraSocial.id, obraSocial);
    });

    invoices.forEach((invoice) => {
      if (invoice.obraSocial?.id && !optionsById.has(invoice.obraSocial.id)) {
        optionsById.set(invoice.obraSocial.id, invoice.obraSocial);
      }
    });

    return Array.from(optionsById.values()).sort((left, right) => (
      String(left.nombreOs || '').localeCompare(String(right.nombreOs || ''), 'es')
    ));
  }, [invoices, obrasSociales]);

  const editingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === editingInvoiceId) || null,
    [editingInvoiceId, invoices]
  );

  const summaryCards = [
    {
      key: 'invoiced',
      label: 'Facturado',
      value: formatCurrency(summary?.totalInvoiced),
      description: `${summary?.invoiceCount || 0} facturas registradas`,
      icon: FileText,
      iconClassName: 'bg-slate-100 text-slate-700',
      valueClassName: 'text-slate-900',
    },
    {
      key: 'collected',
      label: 'Cobrado',
      value: formatCurrency(summary?.totalCollected),
      description: `${paidInvoices.length} facturas saldadas`,
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-100 text-emerald-700',
      valueClassName: 'text-emerald-700',
    },
    {
      key: 'pending',
      label: 'Pendiente',
      value: formatCurrency(summary?.totalPending),
      description: `${summary?.openInvoiceCount || 0} facturas abiertas`,
      icon: Clock3,
      iconClassName: 'bg-amber-100 text-amber-700',
      valueClassName: 'text-amber-700',
    },
    {
      key: 'overdue',
      label: 'Vencido',
      value: formatCurrency(summary?.overduePending),
      description: 'Pendientes fuera de plazo estimado',
      icon: AlertTriangle,
      iconClassName: 'bg-rose-100 text-rose-700',
      valueClassName: Number(summary?.overduePending) > 0 ? 'text-rose-700' : 'text-slate-900',
    },
    {
      key: 'projected60',
      label: 'Caja 60 días',
      value: formatCurrency(summary?.projected60),
      description: 'Pendiente con fecha esperada hasta 60 días',
      icon: Wallet,
      iconClassName: 'bg-teal-100 text-teal-700',
      valueClassName: 'text-teal-700',
    },
  ];

  const updateInvoiceForm = (field, value) => {
    setInvoiceForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'payerType' ? { obraSocialId: '', payerName: '' } : {}),
    }));
  };

  const closeInvoiceForm = () => {
    setInvoiceForm(createEmptyInvoiceForm());
    setEditingInvoiceId(null);
    setShowCreateForm(false);
  };

  const openCreateInvoiceForm = () => {
    if (showCreateForm && !editingInvoiceId) {
      closeInvoiceForm();
      return;
    }

    setInvoiceForm(createEmptyInvoiceForm());
    setEditingInvoiceId(null);
    setShowCreateForm(true);
  };

  const openEditInvoiceForm = (invoice) => {
    setInvoiceForm(createInvoiceFormFromInvoice(invoice));
    setEditingInvoiceId(invoice.id);
    setShowCreateForm(true);
  };

  const buildInvoicePayload = () => {
    const selectedObraSocial = obraSocialOptions.find((obraSocial) => obraSocial.id === invoiceForm.obraSocialId);

    return {
      invoiceNumber: invoiceForm.invoiceNumber || null,
      payerType: invoiceForm.payerType,
      obraSocialId: invoiceForm.payerType === 'OBRA_SOCIAL' ? invoiceForm.obraSocialId || null : null,
      payerName: invoiceForm.payerType === 'OBRA_SOCIAL'
        ? selectedObraSocial?.nombreOs || invoiceForm.payerName
        : invoiceForm.payerName,
      issueDate: invoiceForm.issueDate,
      serviceMonth: invoiceForm.serviceMonth || null,
      expectedPaymentDate: invoiceForm.expectedPaymentDate || null,
      notes: invoiceForm.notes || null,
      items: [{
        description: invoiceForm.description,
        quantity: Number(invoiceForm.quantity) || 1,
        unitAmount: Number(invoiceForm.unitAmount) || 0,
      }],
    };
  };

  const handleSaveInvoice = async (event) => {
    event.preventDefault();

    try {
      setSavingInvoice(true);
      const payload = buildInvoicePayload();
      const totalAmount = (Number(invoiceForm.quantity) || 1) * (Number(invoiceForm.unitAmount) || 0);

      if (editingInvoice && totalAmount < Number(editingInvoice.paidAmount || 0)) {
        showErrorToast(`El total no puede ser menor a lo ya cobrado (${formatCurrency(editingInvoice.paidAmount)}).`);
        return;
      }

      if (editingInvoiceId) {
        await api.put(`/billing/invoices/${editingInvoiceId}`, payload);
      } else {
        await api.post('/billing/invoices', payload);
      }

      closeInvoiceForm();
      await fetchBillingData({ silent: true });
      showSuccessToast(editingInvoiceId ? 'Factura actualizada.' : 'Factura registrada.');
    } catch (error) {
      const message = error?.response?.data?.error || error?.response?.data?.message || error?.friendlyMessage;
      showErrorToast(message || 'No se pudo guardar la factura.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const getPaymentForm = (invoice) => (
    paymentForms[invoice.id] || createEmptyPaymentForm(invoice.pendingAmount)
  );

  const updatePaymentForm = (invoice, field, value) => {
    setPaymentForms((current) => ({
      ...current,
      [invoice.id]: {
        ...getPaymentForm(invoice),
        [field]: value,
      },
    }));
  };

  const handleRegisterPayment = async (invoice) => {
    const form = getPaymentForm(invoice);

    try {
      setSavingPaymentId(invoice.id);
      await api.post(`/billing/invoices/${invoice.id}/payments`, {
        amount: Number(form.amount) || 0,
        paymentDate: form.paymentDate,
        paymentMethod: form.paymentMethod,
        account: form.account,
        notes: form.notes || null,
      });

      setPaymentForms((current) => {
        const next = { ...current };
        delete next[invoice.id];
        return next;
      });
      await fetchBillingData({ silent: true });
      showSuccessToast('Cobro registrado e impactado en Caja.');
    } catch (error) {
      const message = error?.response?.data?.error || error?.response?.data?.message || error?.friendlyMessage;
      showErrorToast(message || 'No se pudo registrar el cobro.');
    } finally {
      setSavingPaymentId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Etapa 2</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Facturación y Cuentas por Cobrar</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Separa dinero facturado, cobrado y pendiente para proyectar caja real a 30, 60 y 90 días.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => fetchBillingData()}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={openCreateInvoiceForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-teal-700"
            >
              {showCreateForm && !editingInvoiceId ? <X size={16} /> : <Plus size={16} />}
              {showCreateForm && !editingInvoiceId ? 'Cerrar' : 'Nueva factura'}
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.key} {...card} />
          ))}
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Caja proyectada</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">30 días</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(summary?.projected30)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
                <span className="text-sm font-bold text-teal-700">60 días</span>
                <span className="text-lg font-black text-teal-800">{formatCurrency(summary?.projected60)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">90 días</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(summary?.projected90)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Pendiente por pagador</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Qué obra social o cliente debe más</h2>
              </div>
              <Building2 className="text-slate-300" size={24} />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
              {(summary?.byPayer || []).length === 0 ? (
                <p className="px-4 py-6 text-center text-sm font-semibold text-slate-400">
                  Todavía no hay facturas registradas.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(summary?.byPayer || []).slice(0, 5).map((row) => (
                    <div key={row.key} className="grid grid-cols-3 gap-3 bg-white px-4 py-3 text-sm">
                      <div className="col-span-1 min-w-0">
                        <p className="truncate font-black text-slate-800">{row.payerName}</p>
                        <p className="text-xs font-semibold text-slate-400">{row.invoiceCount} factura{row.invoiceCount === 1 ? '' : 's'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cobrado</p>
                        <p className="font-black text-emerald-700">{formatCurrency(row.totalCollected)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pendiente</p>
                        <p className="font-black text-amber-700">{formatCurrency(row.totalPending)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {showCreateForm && (
          <form onSubmit={handleSaveInvoice} className="mb-6 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-teal-100 p-3 text-teal-700">
                {editingInvoiceId ? <Pencil size={20} /> : <Receipt size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {editingInvoiceId ? 'Editar factura' : 'Registrar factura'}
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  {editingInvoiceId
                    ? 'Corregí errores de carga. Si ya hubo cobros, el total no puede quedar por debajo de lo cobrado.'
                    : 'Esto crea el pendiente de cobro, no impacta en caja hasta registrar el cobro.'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tipo pagador</span>
                <select
                  value={invoiceForm.payerType}
                  onChange={(event) => updateInvoiceForm('payerType', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="OBRA_SOCIAL">Obra social</option>
                  <option value="PATIENT">Paciente</option>
                  <option value="OTHER">Otro</option>
                </select>
              </label>

              {invoiceForm.payerType === 'OBRA_SOCIAL' ? (
                <label className="md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Obra social</span>
                  <select
                    value={invoiceForm.obraSocialId}
                    onChange={(event) => updateInvoiceForm('obraSocialId', event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                    required
                  >
                    <option value="">Seleccionar</option>
                    {obraSocialOptions.map((obraSocial) => (
                      <option key={obraSocial.id} value={obraSocial.id}>{obraSocial.nombreOs}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Pagador</span>
                  <input
                    type="text"
                    value={invoiceForm.payerName}
                    onChange={(event) => updateInvoiceForm('payerName', event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                    required
                  />
                </label>
              )}

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nro factura</span>
                <input
                  type="text"
                  value={invoiceForm.invoiceNumber}
                  onChange={(event) => updateInvoiceForm('invoiceNumber', event.target.value)}
                  placeholder="Opcional"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Emisión</span>
                <input
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(event) => updateInvoiceForm('issueDate', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </label>

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Mes servicio</span>
                <input
                  type="month"
                  value={invoiceForm.serviceMonth}
                  onChange={(event) => updateInvoiceForm('serviceMonth', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Cobro esperado</span>
                <input
                  type="date"
                  value={invoiceForm.expectedPaymentDate}
                  onChange={(event) => updateInvoiceForm('expectedPaymentDate', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Descripción</span>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(event) => updateInvoiceForm('description', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </label>

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Cantidad</span>
                <input
                  type="number"
                  min="1"
                  value={invoiceForm.quantity}
                  onChange={(event) => updateInvoiceForm('quantity', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </label>

              <label>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Valor unitario</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.unitAmount}
                  onChange={(event) => updateInvoiceForm('unitAmount', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </label>

              <label className="md:col-span-4">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Notas</span>
                <textarea
                  rows={2}
                  value={invoiceForm.notes}
                  onChange={(event) => updateInvoiceForm('notes', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={closeInvoiceForm}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingInvoice}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {editingInvoiceId ? <Pencil size={16} /> : <Plus size={16} />}
                {savingInvoice ? 'Guardando...' : editingInvoiceId ? 'Guardar cambios' : 'Guardar factura'}
              </button>
            </div>
          </form>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-xl font-black text-slate-900">Facturas emitidas</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {openInvoices.length} abiertas · {paidInvoices.length} cobradas
            </p>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-slate-400">Cargando facturación...</p>
          ) : invoices.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-slate-400">
              Todavía no hay facturas. Registrá la primera para empezar a medir cuentas por cobrar.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-3">Factura</th>
                      <th className="px-4 py-3">Pagador</th>
                      <th className="px-4 py-3">Fechas</th>
                      <th className="px-4 py-3 text-right">Facturado</th>
                      <th className="px-4 py-3 text-right">Cobrado</th>
                      <th className="px-4 py-3 text-right">Pendiente</th>
                      <th className="px-4 py-3">Cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const paymentForm = getPaymentForm(invoice);
                      const canRegisterPayment = Number(invoice.pendingAmount) > 0 && invoice.status !== 'CANCELLED';

                      return (
                        <tr key={invoice.id} className="border-b border-slate-100 align-top">
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-900">{invoice.invoiceNumber || 'Sin número'}</p>
                            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClassNames[invoice.status] || statusClassNames.ISSUED}`}>
                              {statusLabels[invoice.status] || invoice.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditInvoiceForm(invoice)}
                              className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                            >
                              <Pencil size={13} />
                              Editar
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-800">{invoice.payerName}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">{invoice.serviceMonth || 'Sin mes de servicio'}</p>
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-500">
                            <p>Emitida: {formatDate(invoice.issueDate)}</p>
                            <p>Esperado: {formatDate(invoice.expectedPaymentDate)}</p>
                          </td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">{formatCurrency(invoice.totalAmount)}</td>
                          <td className="px-4 py-4 text-right font-black text-emerald-700">{formatCurrency(invoice.paidAmount)}</td>
                          <td className="px-4 py-4 text-right font-black text-amber-700">{formatCurrency(invoice.pendingAmount)}</td>
                          <td className="px-4 py-4">
                            {canRegisterPayment ? (
                              <div className="grid min-w-[390px] grid-cols-[1fr,1fr,1fr,auto] gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={paymentForm.amount}
                                  onChange={(event) => updatePaymentForm(invoice, 'amount', event.target.value)}
                                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400"
                                />
                                <input
                                  type="date"
                                  value={paymentForm.paymentDate}
                                  onChange={(event) => updatePaymentForm(invoice, 'paymentDate', event.target.value)}
                                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400"
                                />
                                <select
                                  value={paymentForm.account}
                                  onChange={(event) => updatePaymentForm(invoice, 'account', event.target.value)}
                                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-teal-400"
                                >
                                  <option value="MERCADO_PAGO">Mercado Pago</option>
                                  <option value="BANCO_PROVINCIA">Banco Provincia</option>
                                  <option value="CASH">Efectivo</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRegisterPayment(invoice)}
                                  disabled={savingPaymentId === invoice.id}
                                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                                >
                                  <Banknote size={15} />
                                  Cobrar
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                                <CheckCircle2 size={14} />
                                Sin pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {invoices.map((invoice) => {
                  const paymentForm = getPaymentForm(invoice);
                  const canRegisterPayment = Number(invoice.pendingAmount) > 0 && invoice.status !== 'CANCELLED';

                  return (
                    <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{invoice.invoiceNumber || invoice.payerName}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">{invoice.payerName}</p>
                          <button
                            type="button"
                            onClick={() => openEditInvoiceForm(invoice)}
                            className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600"
                          >
                            <Pencil size={13} />
                            Editar
                          </button>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${statusClassNames[invoice.status] || statusClassNames.ISSUED}`}>
                          {statusLabels[invoice.status] || invoice.status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white px-2 py-3">
                          <p className="text-[10px] font-black uppercase text-slate-400">Facturado</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-3">
                          <p className="text-[10px] font-black uppercase text-slate-400">Cobrado</p>
                          <p className="mt-1 text-sm font-black text-emerald-700">{formatCurrency(invoice.paidAmount)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-3">
                          <p className="text-[10px] font-black uppercase text-slate-400">Pendiente</p>
                          <p className="mt-1 text-sm font-black text-amber-700">{formatCurrency(invoice.pendingAmount)}</p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Emitida {formatDate(invoice.issueDate)} · Cobro esperado {formatDate(invoice.expectedPaymentDate)}
                      </p>

                      {canRegisterPayment && (
                        <div className="mt-4 grid gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={paymentForm.amount}
                            onChange={(event) => updatePaymentForm(invoice, 'amount', event.target.value)}
                            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={paymentForm.paymentDate}
                              onChange={(event) => updatePaymentForm(invoice, 'paymentDate', event.target.value)}
                              className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                            />
                            <select
                              value={paymentForm.account}
                              onChange={(event) => updatePaymentForm(invoice, 'account', event.target.value)}
                              className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                            >
                              <option value="MERCADO_PAGO">Mercado Pago</option>
                              <option value="BANCO_PROVINCIA">Banco Provincia</option>
                              <option value="CASH">Efectivo</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRegisterPayment(invoice)}
                            disabled={savingPaymentId === invoice.id}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
                          >
                            <Banknote size={16} />
                            Registrar cobro
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default BillingPage;

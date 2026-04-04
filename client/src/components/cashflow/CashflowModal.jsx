import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown } from 'lucide-react';
import {
  BONOS_QR_CATEGORY,
  CASHFLOW_ACCOUNTS,
  DEFAULT_CATEGORY,
  resolveAccount,
  resolveCategory,
} from '../../utils/cashflow';

const CashflowModal = ({ isOpen, onClose, onSave, transaction }) => {
  const [type, setType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [concept, setConcept] = useState('');
  const [account, setAccount] = useState('CASH');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  useEffect(() => {
    if (transaction && isOpen) {
      setType(transaction.type || 'INCOME');
      setAmount(transaction.amount?.toString() || '');
      setCategory(resolveCategory(transaction));
      setConcept(transaction.concept || '');
      setAccount(resolveAccount(transaction));
      setPaymentMethod(transaction.paymentMethod || 'Efectivo');
    } else {
      setType('INCOME');
      setAmount('');
      setCategory(DEFAULT_CATEGORY);
      setConcept('');
      setAccount('CASH');
      setPaymentMethod('Efectivo');
    }
  }, [transaction, isOpen]);

  useEffect(() => {
    if (type === 'EXPENSE') {
      setCategory(DEFAULT_CATEGORY);
    }
  }, [type]);

  useEffect(() => {
    if (type !== 'INCOME' || category === BONOS_QR_CATEGORY) return;
    if (resolveCategory({ type, category, paymentMethod, concept }) === BONOS_QR_CATEGORY) {
      setCategory(BONOS_QR_CATEGORY);
    }
  }, [type, category, paymentMethod, concept]);

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    if (nextCategory === BONOS_QR_CATEGORY) {
      setAccount('MERCADO_PAGO');
      setPaymentMethod('QR');
      setConcept((current) => current.trim() ? current : 'Ingreso bonos QR');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      type,
      amount: parseFloat(amount),
      category: type === 'INCOME' ? category : DEFAULT_CATEGORY,
      concept,
      account,
      paymentMethod,
      id: transaction ? transaction.id : undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">
            {transaction ? 'Editar' : 'Nuevo'} Movimiento
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Selector de Tipo */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Movimiento</label>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border-2 ${
                  type === 'INCOME' 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                }`}
              >
                <ArrowUp size={18} /> Ingreso
              </button>
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border-2 ${
                  type === 'EXPENSE' 
                  ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                }`}
              >
                <ArrowDown size={18} /> Egreso
              </button>
            </div>
          </div>

          {type === 'INCOME' && (
          <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mt-1 text-slate-700 focus:border-teal-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
              >
                <option value={DEFAULT_CATEGORY}>Ingreso General</option>
                <option value={BONOS_QR_CATEGORY}>Bonos QR</option>
              </select>
              {category === BONOS_QR_CATEGORY && (
                <p className="mt-2 text-xs font-semibold text-teal-700">
                  Se registrará como ingreso QR y quedará impactando en Mercado Pago.
                </p>
              )}
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Monto ($)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-8 pr-4 text-xl font-bold text-slate-700 focus:border-teal-500 focus:bg-white outline-none transition-all"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Concepto</label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mt-1 text-slate-700 focus:border-teal-500 focus:bg-white outline-none transition-all"
              placeholder={category === BONOS_QR_CATEGORY ? 'Ej: Ingreso bonos QR' : 'Ej: Pago de sesión'}
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cuenta que impacta</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mt-1 text-slate-700 focus:border-teal-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
            >
              {CASHFLOW_ACCOUNTS.map((accountOption) => (
                <option key={accountOption.value} value={accountOption.value}>
                  {accountOption.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Esto define si el saldo sube o baja en efectivo o en Mercado Pago.
            </p>
          </div>

          {/* Método de Pago */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Método de Pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mt-1 text-slate-700 focus:border-teal-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="QR">QR</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta de Débito">Tarjeta de Débito</option>
              <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              <option value="Otro">Otro</option>
            </select>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              El método explica cómo se cobró o pagó; la cuenta define dónde queda la plata.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-100 transition-all transform active:scale-[0.98]"
            >
              {transaction ? 'Actualizar' : 'Guardar'} Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashflowModal;

import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown } from 'lucide-react';


const CashflowModal = ({ isOpen, onClose, onSave, transaction }) => {
  const [type, setType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  useEffect(() => {
  if (transaction && isOpen) { // Asegurar que ambos existan
    setType(transaction.type || 'INCOME');
    setAmount(transaction.amount?.toString() || '');
    setConcept(transaction.concept || '');
    setPaymentMethod(transaction.paymentMethod || 'Efectivo');
  } else {
    // Reset manual si no hay transacción (modo "Nuevo")
    setType('INCOME');
    setAmount('');
    setConcept('');
    setPaymentMethod('Efectivo');
  }
}, [transaction, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      type,
      amount: parseFloat(amount),
      concept,
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
              placeholder="Ej: Pago de sesión"
              required
            />
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
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta de Débito">Tarjeta de Débito</option>
              <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              <option value="Otro">Otro</option>
            </select>
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
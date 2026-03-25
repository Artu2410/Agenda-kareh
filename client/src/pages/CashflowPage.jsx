import React, { useState, useEffect, useMemo } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { Plus, ArrowUp, ArrowDown, DollarSign, Trash2 } from 'lucide-react'; // Añadí Trash2
import CashflowModal from '../components/cashflow/CashflowModal';
import { useConfirmModal } from '../components/ConfirmModal';

const CashflowPage = () => {
  const { ConfirmModalComponent, openModal: openConfirmModal } = useConfirmModal();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await instance.get('/cashflow');
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // --- GUARDAR O ACTUALIZAR ---
  const handleSaveTransaction = async (transactionData) => {
    try {
      const url = transactionData.id ? `/cashflow/${transactionData.id}` : '/cashflow';
      const method = transactionData.id ? 'put' : 'post';
      await instance[method](url, transactionData);

      // Refrescamos toda la lista para asegurar consistencia con la DB
      fetchTransactions();
      setIsModalOpen(false);
      setSelectedTransaction(null);
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert("Error al guardar el movimiento");
    }
  };

  // --- ELIMINAR ---
  const handleDeleteTransaction = async (e, id) => {
    e.stopPropagation(); // Evita que al hacer clic en borrar se abra el modal de edición

    openConfirmModal({
      title: 'Eliminar movimiento',
      message: 'Este movimiento saldrá de caja de forma definitiva. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        try {
          await instance.delete(`/cashflow/${id}`);
          setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
        } catch (error) {
          console.error('Error al eliminar:', error);
          alert('No se pudo eliminar el movimiento');
        }
      },
    });
  };

  const openModal = (transaction = null) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  // --- CÁLCULOS ---
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [transactions]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header y Balance Cards (Igual que antes) */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
           <h1 className="text-3xl font-bold text-slate-800">Caja Chica</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           {/* Card Ingresos */}
           <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
             <div className="p-3 bg-green-100 rounded-full"><ArrowUp className="text-green-600" size={24} /></div>
             <div><p className="text-sm text-slate-500">Ingresos Totales</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p></div>
           </div>
           {/* Card Egresos */}
           <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
             <div className="p-3 bg-red-100 rounded-full"><ArrowDown className="text-red-600" size={24} /></div>
             <div><p className="text-sm text-slate-500">Egresos Totales</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalExpense)}</p></div>
           </div>
           {/* Card Balance */}
           <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
             <div className="p-3 bg-teal-100 rounded-full"><DollarSign className="text-teal-600" size={24} /></div>
             <div><p className="text-sm text-slate-500">Balance Actual</p><p className={`text-2xl font-bold ${balance >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{formatCurrency(balance)}</p></div>
           </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-700">Historial de Movimientos</h2>
            <button onClick={() => openModal()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white transition-all hover:bg-teal-700 sm:w-auto">
              <Plus size={18} /> Nuevo Movimiento
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? <p className="text-center p-4">Cargando...</p> : (
              <>
              <table className="hidden w-full text-left md:table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-sm uppercase">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Concepto</th>
                    <th className="p-3">Método</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => openModal(t)}>
                      <td className="p-3 text-slate-600">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium text-slate-800">{t.concept}</td>
                      <td className="p-3 text-slate-500">{t.paymentMethod}</td>
                      <td className={`p-3 font-bold text-right ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={(e) => handleDeleteTransaction(e, t.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-3 md:hidden">
                {transactions.map((transaction) => (
                  <article
                    key={transaction.id}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openModal(transaction)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-black text-slate-800">{transaction.concept}</p>
                        <p className="text-xs font-semibold text-slate-500">{format(new Date(transaction.date), 'dd/MM/yyyy')}</p>
                        <p className="mt-1 text-xs text-slate-500">{transaction.paymentMethod}</p>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleDeleteTransaction(event, transaction.id)}
                        className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <p className={`mt-3 text-lg font-black ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'INCOME' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </p>
                  </article>
                ))}
              </div>
              </>
            )}
            {!loading && transactions.length === 0 && (
              <p className="text-center text-slate-500 p-8">No hay movimientos registrados.</p>
            )}
          </div>
        </div>
      </div>

      <CashflowModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        transaction={selectedTransaction}
      />
      {ConfirmModalComponent}
    </div>
  );
};

export default CashflowPage;

import React, { useState, useEffect, useMemo } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { Plus, ArrowUp, ArrowDown, DollarSign, Trash2 } from 'lucide-react'; // Añadí Trash2
import CashflowModal from '../components/cashflow/CashflowModal';

const CashflowPage = () => {
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
    
    if (!window.confirm('¿Estás seguro de que deseas eliminar este movimiento?')) return;

    try {
      await instance.delete(`/cashflow/${id}`);
      // Actualización optimista: filtramos el estado local
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('No se pudo eliminar el movimiento');
    }
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
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header y Balance Cards (Igual que antes) */}
        <div className="flex justify-between items-center mb-6">
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
        <div className="bg-white p-6 rounded-2xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-700">Historial de Movimientos</h2>
            <button onClick={() => openModal()} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-teal-700 transition-all">
              <Plus size={18} /> Nuevo Movimiento
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? <p className="text-center p-4">Cargando...</p> : (
              <table className="w-full text-left">
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
    </div>
  );
};

export default CashflowPage;
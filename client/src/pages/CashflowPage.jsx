import React, { useState, useEffect, useMemo } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ArrowUp, ArrowDown, DollarSign, Trash2 } from 'lucide-react'; // Añadí Trash2
import CashflowModal from '../components/cashflow/CashflowModal';
import { useConfirmModal } from '../components/ConfirmModal';

const BONOS_QR_CATEGORY = 'BONOS_QR';
const resolveCategory = (transaction) => {
  if (transaction?.type !== 'INCOME') return 'GENERAL';
  if (transaction?.category === BONOS_QR_CATEGORY) return BONOS_QR_CATEGORY;

  const paymentMethod = String(transaction?.paymentMethod || '').trim().toUpperCase();
  const concept = String(transaction?.concept || '').trim().toUpperCase();
  return paymentMethod === 'QR' && /(IOMA|BONO|BONOS)/.test(concept)
    ? BONOS_QR_CATEGORY
    : 'GENERAL';
};

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
  const { totalIncome, totalExpense, totalBonosQr, balance } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const bonosQr = transactions
      .filter(t => resolveCategory(t) === BONOS_QR_CATEGORY)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return { totalIncome: income, totalExpense: expense, totalBonosQr: bonosQr, balance: income - expense };
  }, [transactions]);

  const monthlyGroups = useMemo(() => {
    const groups = new Map();

    [...transactions]
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .forEach((transaction) => {
        const transactionDate = new Date(transaction.date);
        const monthKey = format(transactionDate, 'yyyy-MM');

        if (!groups.has(monthKey)) {
          groups.set(monthKey, {
            key: monthKey,
            label: format(transactionDate, 'MMMM yyyy', { locale: es }),
            items: [],
            totalIncome: 0,
            totalExpense: 0,
            totalBonosQr: 0,
          });
        }

        const monthGroup = groups.get(monthKey);
        monthGroup.items.push(transaction);

        const amount = parseFloat(transaction.amount) || 0;
        if (transaction.type === 'INCOME') {
          monthGroup.totalIncome += amount;
          if (resolveCategory(transaction) === BONOS_QR_CATEGORY) {
            monthGroup.totalBonosQr += amount;
          }
        } else {
          monthGroup.totalExpense += amount;
        }
      });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      balance: group.totalIncome - group.totalExpense,
    }));
  }, [transactions]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }

  const formatCategory = (category) => {
    if (category === BONOS_QR_CATEGORY) return 'Bonos QR';
    return 'General';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header y Balance Cards (Igual que antes) */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
           <h1 className="text-3xl font-bold text-slate-800">Caja Chica</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
           {/* Card Ingresos */}
           <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
             <div className="p-3 bg-green-100 rounded-full"><ArrowUp className="text-green-600" size={24} /></div>
             <div><p className="text-sm text-slate-500">Ingresos Totales</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p></div>
           </div>
           {/* Card Bonos QR */}
           <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
             <div className="p-3 bg-cyan-100 rounded-full"><DollarSign className="text-cyan-700" size={24} /></div>
             <div><p className="text-sm text-slate-500">Bonos QR</p><p className="text-2xl font-bold text-cyan-800">{formatCurrency(totalBonosQr)}</p></div>
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

        {/* Transactions by Month */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-700">Caja organizada por mes</h2>
              <p className="text-sm font-medium text-slate-400">
                Cada bloque resume los números del negocio en su propio mes.
              </p>
            </div>
            <button onClick={() => openModal()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white transition-all hover:bg-teal-700 sm:w-auto">
              <Plus size={18} /> Nuevo Movimiento
            </button>
          </div>
 
          <div>
            {loading ? <p className="text-center p-4">Cargando...</p> : (
              <div className="space-y-6">
                {monthlyGroups.map((group) => (
                  <section key={group.key} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50/80">
                    <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Mes contable</p>
                          <h3 className="mt-1 text-2xl font-black capitalize text-slate-900">{group.label}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {group.items.length} movimiento{group.items.length === 1 ? '' : 's'} registrados
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Ingresos</p>
                            <p className="mt-1 text-lg font-black text-emerald-700">{formatCurrency(group.totalIncome)}</p>
                          </div>
                          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">Bonos QR</p>
                            <p className="mt-1 text-lg font-black text-cyan-700">{formatCurrency(group.totalBonosQr)}</p>
                          </div>
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Egresos</p>
                            <p className="mt-1 text-lg font-black text-rose-700">{formatCurrency(group.totalExpense)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Balance</p>
                            <p className={`mt-1 text-lg font-black ${group.balance >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                              {formatCurrency(group.balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Concepto</th>
                            <th className="p-3">Categoría</th>
                            <th className="p-3">Método</th>
                            <th className="p-3 text-right">Monto</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((transaction) => {
                            const resolvedCategory = resolveCategory(transaction);
                            return (
                              <tr
                                key={transaction.id}
                                className="border-b border-slate-100 bg-white/70 hover:bg-white cursor-pointer"
                                onClick={() => openModal(transaction)}
                              >
                                <td className="p-3 text-slate-600">{format(new Date(transaction.date), 'dd/MM/yyyy')}</td>
                                <td className="p-3 font-medium text-slate-800">{transaction.concept}</td>
                                <td className="p-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                    resolvedCategory === BONOS_QR_CATEGORY
                                      ? 'bg-cyan-100 text-cyan-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {formatCategory(resolvedCategory)}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-500">{transaction.paymentMethod}</td>
                                <td className={`p-3 text-right font-bold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                  {transaction.type === 'INCOME' ? '+' : '-'} {formatCurrency(transaction.amount)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={(event) => handleDeleteTransaction(event, transaction.id)}
                                    className="rounded-full p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 p-4 md:hidden">
                      {group.items.map((transaction) => {
                        const resolvedCategory = resolveCategory(transaction);
                        return (
                          <article
                            key={transaction.id}
                            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => openModal(transaction)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="text-sm font-black text-slate-800">{transaction.concept}</p>
                                <p className="text-xs font-semibold text-slate-500">{format(new Date(transaction.date), 'dd/MM/yyyy')}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                                    resolvedCategory === BONOS_QR_CATEGORY
                                      ? 'bg-cyan-100 text-cyan-800'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {formatCategory(resolvedCategory)}
                                  </span>
                                  <p className="text-xs text-slate-500">{transaction.paymentMethod}</p>
                                </div>
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
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {!loading && transactions.length === 0 && (
              <p className="p-8 text-center text-slate-500">No hay movimientos registrados.</p>
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

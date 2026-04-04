import React, { useState, useEffect, useMemo } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight, DollarSign, Trash2, Wallet, Smartphone } from 'lucide-react';
import CashflowModal from '../components/cashflow/CashflowModal';
import { useConfirmModal } from '../components/ConfirmModal';
import {
  BONOS_QR_CATEGORY,
  formatAccountFlow,
  resolveAccount,
  resolveDestinationAccount,
  resolveCategory,
} from '../utils/cashflow';

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
  const { totalIncome, totalExpense, totalBonosQr, balance, balancesByAccount } = useMemo(() => {
    return transactions.reduce((summary, transaction) => {
      const amount = parseFloat(transaction.amount);
      const sourceAccount = resolveAccount(transaction);

      if (transaction.type === 'INCOME') {
        summary.totalIncome += amount;
        summary.balance += amount;
        summary.balancesByAccount[sourceAccount] += amount;
      } else if (transaction.type === 'EXPENSE') {
        summary.totalExpense += amount;
        summary.balance -= amount;
        summary.balancesByAccount[sourceAccount] -= amount;
      } else if (transaction.type === 'TRANSFER') {
        const destinationAccount = resolveDestinationAccount(transaction);
        summary.balancesByAccount[sourceAccount] -= amount;

        if (destinationAccount && destinationAccount !== sourceAccount) {
          summary.balancesByAccount[destinationAccount] += amount;
        }
      }

      if (resolveCategory(transaction) === BONOS_QR_CATEGORY) {
        summary.totalBonosQr += amount;
      }

      return summary;
    }, {
      totalIncome: 0,
      totalExpense: 0,
      totalBonosQr: 0,
      balance: 0,
      balancesByAccount: {
        CASH: 0,
        MERCADO_PAGO: 0,
      },
    });
  }, [transactions]);

  const cashBalance = balancesByAccount.CASH;
  const mercadoPagoBalance = balancesByAccount.MERCADO_PAGO;

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
          });
        }

        const monthGroup = groups.get(monthKey);
        monthGroup.items.push(transaction);
      });

    return Array.from(groups.values());
  }, [transactions]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }

  const formatCategory = (transaction) => {
    if (transaction.type === 'TRANSFER') return 'Traspaso';
    if (resolveCategory(transaction) === BONOS_QR_CATEGORY) return 'Bonos QR';
    return 'General';
  };

  const getAccountBadgeClass = (transaction) => {
    if (transaction.type === 'TRANSFER') {
      return 'bg-indigo-100 text-indigo-800';
    }

    return resolveAccount(transaction) === 'CASH'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-sky-100 text-sky-800';
  };

  const getCategoryBadgeClass = (transaction) => {
    if (transaction.type === 'TRANSFER') {
      return 'bg-indigo-100 text-indigo-800';
    }

    return resolveCategory(transaction) === BONOS_QR_CATEGORY
      ? 'bg-cyan-100 text-cyan-800'
      : 'bg-slate-100 text-slate-600';
  };

  const getAmountClass = (transaction) => {
    if (transaction.type === 'TRANSFER') return 'text-indigo-600';
    return transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600';
  };

  const formatAmount = (transaction) => {
    if (transaction.type === 'TRANSFER') return formatCurrency(transaction.amount);
    return `${transaction.type === 'INCOME' ? '+' : '-'} ${formatCurrency(transaction.amount)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Caja Chica</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Cada movimiento ahora impacta en una cuenta concreta para no mezclar efectivo con Mercado Pago.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full"><Wallet className="text-amber-700" size={24} /></div>
            <div><p className="text-sm text-slate-500">Saldo en Efectivo</p><p className={`text-2xl font-bold ${cashBalance >= 0 ? 'text-amber-800' : 'text-red-700'}`}>{formatCurrency(cashBalance)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-full"><Smartphone className="text-sky-700" size={24} /></div>
            <div><p className="text-sm text-slate-500">Saldo Mercado Pago</p><p className={`text-2xl font-bold ${mercadoPagoBalance >= 0 ? 'text-sky-800' : 'text-red-700'}`}>{formatCurrency(mercadoPagoBalance)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-teal-100 rounded-full"><DollarSign className="text-teal-600" size={24} /></div>
            <div><p className="text-sm text-slate-500">Balance General</p><p className={`text-2xl font-bold ${balance >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{formatCurrency(balance)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-cyan-100 rounded-full"><DollarSign className="text-cyan-700" size={24} /></div>
            <div><p className="text-sm text-slate-500">Bonos QR</p><p className="text-2xl font-bold text-cyan-800">{formatCurrency(totalBonosQr)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full"><ArrowUp className="text-green-600" size={24} /></div>
            <div><p className="text-sm text-slate-500">Ingresos Totales</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-full"><ArrowDown className="text-red-600" size={24} /></div>
            <div><p className="text-sm text-slate-500">Egresos Totales</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalExpense)}</p></div>
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
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Mes contable</p>
                      <h3 className="mt-1 text-2xl font-black capitalize text-slate-900">{group.label}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {group.items.length} movimiento{group.items.length === 1 ? '' : 's'} registrados
                      </p>
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Concepto</th>
                            <th className="p-3">Categoría</th>
                            <th className="p-3">Método</th>
                            <th className="p-3">Cuenta</th>
                            <th className="p-3 text-right">Monto</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((transaction) => {
                            return (
                              <tr
                                key={transaction.id}
                                className="border-b border-slate-100 bg-white/70 hover:bg-white cursor-pointer"
                                onClick={() => openModal(transaction)}
                              >
                                <td className="p-3 text-slate-600">{format(new Date(transaction.date), 'dd/MM/yyyy')}</td>
                                <td className="p-3 font-medium text-slate-800">{transaction.concept}</td>
                                <td className="p-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getCategoryBadgeClass(transaction)}`}>
                                    {formatCategory(transaction)}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-500">{transaction.paymentMethod}</td>
                                <td className="p-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getAccountBadgeClass(transaction)}`}>
                                    {formatAccountFlow(transaction)}
                                  </span>
                                </td>
                                <td className={`p-3 text-right font-bold ${getAmountClass(transaction)}`}>
                                  {transaction.type === 'TRANSFER' && <ArrowLeftRight className="mr-1 inline" size={15} />}
                                  {formatAmount(transaction)}
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
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${getCategoryBadgeClass(transaction)}`}>
                                    {formatCategory(transaction)}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${getAccountBadgeClass(transaction)}`}>
                                    {formatAccountFlow(transaction)}
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
                            <p className={`mt-3 text-lg font-black ${getAmountClass(transaction)}`}>
                              {transaction.type === 'TRANSFER' && <ArrowLeftRight className="mr-1 inline" size={15} />}
                              {formatAmount(transaction)}
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

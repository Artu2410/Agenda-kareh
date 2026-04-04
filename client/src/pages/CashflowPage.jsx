import React, { useCallback, useEffect, useMemo, useState } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight, ChevronDown, ChevronRight, DollarSign, Printer, Trash2, Wallet, Smartphone } from 'lucide-react';
import CashflowModal from '../components/cashflow/CashflowModal';
import { useConfirmModal } from '../hooks/useConfirmModal';
import {
  BONOS_QR_CATEGORY,
  formatAccountFlow,
  resolveAccount,
  resolveDestinationAccount,
  resolveCategory,
} from '../utils/cashflow';
import { openCashflowReceiptPrintWindow } from '../utils/cashflowReceipt';
import { showErrorToast, showSuccessToast } from '../components/toastHelpers';

const CashflowPage = () => {
  const { ConfirmModalComponent, openModal: openConfirmModal } = useConfirmModal();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [modalInstanceKey, setModalInstanceKey] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [collapsedMonths, setCollapsedMonths] = useState({});

  const fetchTransactions = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const response = await instance.get('/cashflow');
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      if (!silent) {
        showErrorToast('No se pudieron cargar los movimientos de caja.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  }, []);

  const handleSaveTransaction = async (transactionData) => {
    try {
      setIsSavingTransaction(true);
      const url = transactionData.id ? `/cashflow/${transactionData.id}` : '/cashflow';
      const method = transactionData.id ? 'put' : 'post';
      await instance[method](url, transactionData);
      await fetchTransactions({ silent: true });
      closeModal();
      showSuccessToast(transactionData.id ? 'Movimiento actualizado.' : 'Movimiento guardado.');
    } catch (error) {
      console.error("Error saving transaction:", error);
      const backendMessage = error?.response?.data?.error || error?.response?.data?.message;
      showErrorToast(backendMessage || 'Error al guardar el movimiento.');
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const handleDeleteTransaction = async (e, id) => {
    e.stopPropagation();

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
          showSuccessToast('Movimiento eliminado.');
        } catch (error) {
          console.error('Error al eliminar:', error);
          showErrorToast('No se pudo eliminar el movimiento.');
        }
      },
    });
  };

  const handlePrintReceipt = (e, transaction) => {
    e.stopPropagation();
    openCashflowReceiptPrintWindow(transaction);
  };

  const openModal = (transaction = null) => {
    setSelectedTransaction(transaction);
    setModalInstanceKey((current) => current + 1);
    setIsModalOpen(true);
  };

  // --- CÁLCULOS ---
  const { totalIncome, totalExpense, balance, balancesByAccount } = useMemo(() => {
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

      return summary;
    }, {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      balancesByAccount: {
        CASH: 0,
        MERCADO_PAGO: 0,
      },
    });
  }, [transactions]);

  const cashBalance = balancesByAccount.CASH;
  const mercadoPagoBalance = balancesByAccount.MERCADO_PAGO;

  const formatCurrency = (value) => (
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
  );

  const summaryCards = [
    {
      key: 'cash-balance',
      label: 'Saldo en Efectivo',
      value: formatCurrency(cashBalance),
      valueClassName: cashBalance >= 0 ? 'text-amber-800' : 'text-red-700',
      icon: Wallet,
      iconWrapperClassName: 'bg-amber-100',
      iconClassName: 'text-amber-700',
    },
    {
      key: 'mercado-pago-balance',
      label: 'Saldo Mercado Pago',
      value: formatCurrency(mercadoPagoBalance),
      valueClassName: mercadoPagoBalance >= 0 ? 'text-sky-800' : 'text-red-700',
      icon: Smartphone,
      iconWrapperClassName: 'bg-sky-100',
      iconClassName: 'text-sky-700',
    },
    {
      key: 'general-balance',
      label: 'Balance General',
      value: formatCurrency(balance),
      valueClassName: balance >= 0 ? 'text-teal-700' : 'text-red-700',
      icon: DollarSign,
      iconWrapperClassName: 'bg-teal-100',
      iconClassName: 'text-teal-600',
    },
    {
      key: 'income',
      label: 'Ingresos Totales',
      value: formatCurrency(totalIncome),
      valueClassName: 'text-slate-800',
      icon: ArrowUp,
      iconWrapperClassName: 'bg-green-100',
      iconClassName: 'text-green-600',
    },
    {
      key: 'expense',
      label: 'Egresos Totales',
      value: formatCurrency(totalExpense),
      valueClassName: 'text-slate-800',
      icon: ArrowDown,
      iconWrapperClassName: 'bg-red-100',
      iconClassName: 'text-red-600',
    },
  ];

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

  useEffect(() => {
    setCollapsedMonths((current) => {
      const next = {};

      monthlyGroups.forEach((group, index) => {
        next[group.key] = current[group.key] ?? index > 0;
      });

      return next;
    });
  }, [monthlyGroups]);

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

  const toggleMonthVisibility = (monthKey) => {
    setCollapsedMonths((current) => ({
      ...current,
      [monthKey]: !current[monthKey],
    }));
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

        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.key} className="flex min-w-0 items-start gap-4 rounded-2xl bg-white p-6 shadow-md">
                <div className={`shrink-0 rounded-full p-3 ${card.iconWrapperClassName}`}>
                  <Icon className={card.iconClassName} size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-500">{card.label}</p>
                  <p className={`mt-2 break-words text-xl font-bold leading-tight sm:text-2xl ${card.valueClassName}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Transactions by Month */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-700">Caja organizada por mes</h2>
              <p className="text-sm font-medium text-slate-400">
                El mes más reciente queda visible y los anteriores se pueden ocultar o mostrar cuando los necesites.
              </p>
            </div>
            <button type="button" onClick={() => openModal()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white transition-all hover:bg-teal-700 sm:w-auto">
              <Plus size={18} /> Nuevo Movimiento
            </button>
          </div>
 
          <div>
            {loading ? <p className="text-center p-4">Cargando...</p> : (
              <div className="space-y-6">
                {monthlyGroups.map((group) => {
                  const isCollapsed = collapsedMonths[group.key] ?? false;

                  return (
                  <section key={group.key} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50/80">
                    <div className={`bg-white px-4 py-4 sm:px-5 ${isCollapsed ? '' : 'border-b border-slate-200'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Mes contable</p>
                          <h3 className="mt-1 text-2xl font-black capitalize text-slate-900">{group.label}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {group.items.length} movimiento{group.items.length === 1 ? '' : 's'} registrados
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleMonthVisibility(group.key)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          {isCollapsed ? 'Mostrar movimientos' : 'Ocultar movimientos'}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                    <>
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
                                  {transaction.type === 'INCOME' && (
                                    <button
                                      onClick={(event) => handlePrintReceipt(event, transaction)}
                                      className="mr-1 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                      title="Imprimir comprobante"
                                    >
                                      <Printer size={18} />
                                    </button>
                                  )}
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
                              <div className="flex items-center gap-1">
                                {transaction.type === 'INCOME' && (
                                  <button
                                    type="button"
                                    onClick={(event) => handlePrintReceipt(event, transaction)}
                                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <Printer size={18} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => handleDeleteTransaction(event, transaction.id)}
                                  className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                            <p className={`mt-3 text-lg font-black ${getAmountClass(transaction)}`}>
                              {transaction.type === 'TRANSFER' && <ArrowLeftRight className="mr-1 inline" size={15} />}
                              {formatAmount(transaction)}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                    </>
                    )}
                  </section>
                )})}
              </div>
            )}

            {!loading && transactions.length === 0 && (
              <p className="p-8 text-center text-slate-500">No hay movimientos registrados.</p>
            )}
          </div>
        </div>
      </div>

      <CashflowModal
        key={modalInstanceKey}
        isOpen={isModalOpen}
        isSaving={isSavingTransaction}
        onClose={closeModal}
        onSave={handleSaveTransaction}
        transaction={selectedTransaction}
      />
      {ConfirmModalComponent}
    </div>
  );
};

export default CashflowPage;

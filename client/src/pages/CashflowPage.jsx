import React, { useCallback, useEffect, useMemo, useState } from 'react';
import instance from '../api/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight, ChevronDown, ChevronRight, DollarSign, Printer, Trash2, Wallet, Smartphone, Building2 } from 'lucide-react';
import CashflowModal from '../components/cashflow/CashflowModal';
import { useConfirmModal } from '../hooks/useConfirmModal';
import {
  BONOS_QR_CATEGORY,
  CASHFLOW_ACCOUNTS,
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
  const [showBalances, setShowBalances] = useState(true);

  const fetchTransactions = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const response = await instance.get('/cashflow');
      setTransactions(response.data);
    } catch {
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
        } catch {
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
    const initialBalances = Object.fromEntries(
      CASHFLOW_ACCOUNTS.map((account) => [account.value, 0])
    );

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
      balancesByAccount: initialBalances,
    });
  }, [transactions]);

  const cashBalance = balancesByAccount.CASH || 0;
  const mercadoPagoBalance = balancesByAccount.MERCADO_PAGO || 0;
  const bancoProvinciaBalance = balancesByAccount.BANCO_PROVINCIA || 0;

  const formatCurrency = (value) => {
    if (!showBalances) return '***';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const weeklyStats = useMemo(() => {
    const weeks = new Map();
    
    transactions.forEach(t => {
      const d = new Date(t.date);
      // Obtener el lunes de esa semana
      const day = d.getDay() || 7; 
      const monday = new Date(d);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(d.getDate() - day + 1);
      
      const weekKey = format(monday, 'yyyy-MM-dd');
      if (!weeks.has(weekKey)) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        weeks.set(weekKey, { 
          income: 0, 
          expense: 0, 
          label: `Semana del ${format(monday, 'dd/MM')} al ${format(sunday, 'dd/MM')}`,
          mondayDate: monday
        });
      }
      
      const stat = weeks.get(weekKey);
      const amount = parseFloat(t.amount);
      if (t.type === 'INCOME') stat.income += amount;
      if (t.type === 'EXPENSE') stat.expense += amount;
    });

    const sortedWeeks = Array.from(weeks.values())
      .sort((a, b) => b.mondayDate - a.mondayDate);

    return sortedWeeks.map((week, index) => {
      const previousWeek = sortedWeeks[index + 1];
      let diffNet = 0;
      if (previousWeek) {
        const currentNet = week.income - week.expense;
        const prevNet = previousWeek.income - previousWeek.expense;
        diffNet = currentNet - prevNet;
      }

      return {
        ...week,
        diffNet
      };
    }).slice(0, 4); 
  }, [transactions]);

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
      key: 'banco-provincia-balance',
      label: 'Saldo Banco Provincia',
      value: formatCurrency(bancoProvinciaBalance),
      valueClassName: bancoProvinciaBalance >= 0 ? 'text-indigo-800' : 'text-red-700',
      icon: Building2,
      iconWrapperClassName: 'bg-indigo-100',
      iconClassName: 'text-indigo-700',
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
            income: 0,
            expense: 0
          });
        }

        const monthGroup = groups.get(monthKey);
        monthGroup.items.push(transaction);
        
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'INCOME') monthGroup.income += amount;
        if (transaction.type === 'EXPENSE') monthGroup.expense += amount;
      });

    return Array.from(groups.values()).map(group => ({
      ...group,
      balance: group.income - group.expense
    }));
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

    const account = resolveAccount(transaction);
    if (account === 'CASH') return 'bg-amber-100 text-amber-800';
    if (account === 'BANCO_PROVINCIA') return 'bg-indigo-100 text-indigo-800';
    return 'bg-sky-100 text-sky-800';
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
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Caja Chica</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Cada movimiento impacta en una cuenta concreta para no mezclar efectivo, Mercado Pago y Banco Provincia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBalances(!showBalances)}
              className="p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-400"
              title={showBalances ? 'Ocultar saldos' : 'Mostrar saldos'}
            >
              {showBalances ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 4.62 4.62"/><path d="M1 1s3 7 10 7 10-7 10-7"/><path d="m23 23-4.62-4.62"/><path d="M8.47 16.14A10.3 10.3 0 0 1 2 12s3-7 10-7c.92 0 1.76.12 2.53.33"/><path d="M15.53 15.53c-.93.3-1.91.47-3.03.47-7 0-10-7-10-7"/><path d="M15 9.21a3 3 0 0 0-4.21 4.21"/><path d="M21.16 16.11A10.33 10.33 0 0 0 22 12s-3-7-10-7"/></svg>
              )}
            </button>
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
                  <p className={`mt-2 wrap-break-word text-xl font-bold leading-tight sm:text-2xl ${card.valueClassName}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Stats Section */}
        {weeklyStats.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-slate-400">Resumen Semanal (Últimas 4 semanas)</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {weeklyStats.map((week) => (
                <div key={week.label} className="rounded-2xl border border-slate-200 bg-white/60 p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-teal-600 mb-3">{week.label}</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                        <ArrowUp size={12} className="text-green-500" /> Entra
                      </span>
                      <span className="text-sm font-black text-slate-800">{formatCurrency(week.income)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                        <ArrowDown size={12} className="text-red-500" /> Sale
                      </span>
                      <span className="text-sm font-black text-slate-800">{formatCurrency(week.expense)}</span>
                    </div>
                    <div className="mt-1 border-t border-slate-100 pt-2 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400">Neto</span>
                        <span className={`text-xs font-black ${week.income - week.expense >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                          {formatCurrency(week.income - week.expense)}
                        </span>
                      </div>
                      
                      {week.diffNet !== 0 && (
                        <div className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-black ${week.diffNet > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {week.diffNet > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {formatCurrency(Math.abs(week.diffNet))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex gap-6">
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase text-green-600">Ingresos</p>
                              <p className="text-sm font-black text-slate-900">{formatCurrency(group.income)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase text-red-600">Egresos</p>
                              <p className="text-sm font-black text-slate-900">{formatCurrency(group.expense)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase text-teal-600">Neto</p>
                              <p className={`text-sm font-black ${group.balance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{formatCurrency(group.balance)}</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => toggleMonthVisibility(group.key)}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            {isCollapsed ? 'Mostrar' : 'Ocultar'}
                          </button>
                        </div>
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


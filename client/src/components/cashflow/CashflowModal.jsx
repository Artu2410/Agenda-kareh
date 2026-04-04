import React, { useState } from 'react';
import { X, ArrowUp, ArrowDown, ArrowLeftRight } from 'lucide-react';
import {
  BONOS_QR_CATEGORY,
  CASHFLOW_ACCOUNTS,
  DEFAULT_CATEGORY,
  resolveAccount,
  resolveDestinationAccount,
  resolveCategory,
  TRANSFER_PAYMENT_METHOD,
} from '../../utils/cashflow';

const getOppositeAccount = (account) => (account === 'CASH' ? 'MERCADO_PAGO' : 'CASH');
const inferPaymentMethodFromAccount = (account) => (account === 'CASH' ? 'Efectivo' : 'Mercado Pago');

const applyBonosQrPreset = (draft) => ({
  ...draft,
  category: BONOS_QR_CATEGORY,
  account: 'MERCADO_PAGO',
  paymentMethod: 'QR',
  concept: draft.concept.trim() ? draft.concept : 'Ingreso bonos QR',
});

const syncIncomeCategory = (draft) => {
  if (draft.type !== 'INCOME') {
    return {
      ...draft,
      category: DEFAULT_CATEGORY,
    };
  }

  if (draft.category === BONOS_QR_CATEGORY) {
    return applyBonosQrPreset(draft);
  }

  return resolveCategory(draft) === BONOS_QR_CATEGORY
    ? applyBonosQrPreset(draft)
    : draft;
};

const createInitialFormState = (transaction) => {
  const type = transaction?.type || 'INCOME';
  const account = resolveAccount(transaction || { account: 'CASH', paymentMethod: 'Efectivo' });

  return {
    type,
    amount: transaction?.amount?.toString() || '',
    category: resolveCategory(transaction || { type, account }),
    concept: transaction?.concept || '',
    account,
    destinationAccount: type === 'TRANSFER'
      ? resolveDestinationAccount(transaction || { type, account })
      : getOppositeAccount(account),
    paymentMethod: type === 'TRANSFER'
      ? TRANSFER_PAYMENT_METHOD
      : transaction?.paymentMethod || inferPaymentMethodFromAccount(account),
  };
};

const CashflowModal = ({
  isOpen,
  isSaving = false,
  onClose,
  onSave,
  transaction,
}) => {
  const [formState, setFormState] = useState(() => createInitialFormState(transaction));
  const {
    type,
    amount,
    category,
    concept,
    account,
    destinationAccount,
    paymentMethod,
  } = formState;

  const isBonosQrIncome = type === 'INCOME' && category === BONOS_QR_CATEGORY;
  const availableDestinationAccounts = CASHFLOW_ACCOUNTS.filter((accountOption) => accountOption.value !== account);

  const handleTypeChange = (nextType) => {
    setFormState((previous) => {
      if (nextType === previous.type) return previous;

      if (nextType === 'TRANSFER') {
        return {
          ...previous,
          type: nextType,
          category: DEFAULT_CATEGORY,
          paymentMethod: TRANSFER_PAYMENT_METHOD,
          destinationAccount: previous.destinationAccount && previous.destinationAccount !== previous.account
            ? previous.destinationAccount
            : getOppositeAccount(previous.account),
        };
      }

      const nextDraft = {
        ...previous,
        type: nextType,
        category: nextType === 'INCOME' ? previous.category : DEFAULT_CATEGORY,
        paymentMethod: previous.paymentMethod === TRANSFER_PAYMENT_METHOD
          ? inferPaymentMethodFromAccount(previous.account)
          : previous.paymentMethod,
        destinationAccount: getOppositeAccount(previous.account),
      };

      return syncIncomeCategory(nextDraft);
    });
  };

  const handleCategoryChange = (nextCategory) => {
    setFormState((previous) => (
      nextCategory === BONOS_QR_CATEGORY
        ? applyBonosQrPreset({ ...previous, category: nextCategory })
        : { ...previous, category: DEFAULT_CATEGORY }
    ));
  };

  const handleConceptChange = (nextConcept) => {
    setFormState((previous) => syncIncomeCategory({
      ...previous,
      concept: nextConcept,
    }));
  };

  const handleAccountChange = (nextAccount) => {
    setFormState((previous) => {
      const nextDraft = {
        ...previous,
        account: nextAccount,
      };

      if (previous.type === 'TRANSFER') {
        return {
          ...nextDraft,
          paymentMethod: TRANSFER_PAYMENT_METHOD,
          destinationAccount: previous.destinationAccount && previous.destinationAccount !== nextAccount
            ? previous.destinationAccount
            : getOppositeAccount(nextAccount),
        };
      }

      if (previous.paymentMethod === TRANSFER_PAYMENT_METHOD) {
        nextDraft.paymentMethod = inferPaymentMethodFromAccount(nextAccount);
      }

      return syncIncomeCategory(nextDraft);
    });
  };

  const handleDestinationAccountChange = (nextDestinationAccount) => {
    setFormState((previous) => ({
      ...previous,
      destinationAccount: nextDestinationAccount,
    }));
  };

  const handlePaymentMethodChange = (nextPaymentMethod) => {
    setFormState((previous) => syncIncomeCategory({
      ...previous,
      paymentMethod: nextPaymentMethod,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSave({
      type,
      amount: Number(amount),
      category: type === 'INCOME' ? category : DEFAULT_CATEGORY,
      concept: concept.trim(),
      account,
      destinationAccount: type === 'TRANSFER' ? destinationAccount : undefined,
      paymentMethod: type === 'TRANSFER' ? TRANSFER_PAYMENT_METHOD : paymentMethod,
      id: transaction ? transaction.id : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            {transaction ? 'Editar' : 'Nuevo'} Movimiento
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Tipo de Movimiento
            </label>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('INCOME')}
                className={`flex-1 rounded-xl border-2 px-4 py-3 font-bold transition-all ${
                  type === 'INCOME'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowUp size={18} />
                  Ingreso
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                className={`flex-1 rounded-xl border-2 px-4 py-3 font-bold transition-all ${
                  type === 'EXPENSE'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowDown size={18} />
                  Egreso
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('TRANSFER')}
                className={`flex-1 rounded-xl border-2 px-4 py-3 font-bold transition-all ${
                  type === 'TRANSFER'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeftRight size={18} />
                  Traspaso
                </span>
              </button>
            </div>
          </div>

          {type === 'INCOME' && (
            <div>
              <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Categoría
              </label>
              <select
                value={category}
                onChange={(event) => handleCategoryChange(event.target.value)}
                className="mt-1 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white"
              >
                <option value={DEFAULT_CATEGORY}>Ingreso General</option>
                <option value={BONOS_QR_CATEGORY}>Bonos QR</option>
              </select>
              {isBonosQrIncome && (
                <p className="mt-2 text-xs font-semibold text-teal-700">
                  Se registrará como ingreso QR y quedará impactando en Mercado Pago.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Monto ($)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setFormState((previous) => ({ ...previous, amount: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-4 text-xl font-bold text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white"
                placeholder="0.00"
                required
                disabled={isSaving}
              />
            </div>
          </div>

          <div>
            <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Concepto
            </label>
            <input
              type="text"
              value={concept}
              onChange={(event) => handleConceptChange(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white"
              placeholder={isBonosQrIncome ? 'Ej: Ingreso bonos QR' : 'Ej: Pago de sesión'}
              required
              disabled={isSaving}
            />
          </div>

          {type === 'TRANSFER' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Sale de
                </label>
                <select
                  value={account}
                  onChange={(event) => handleAccountChange(event.target.value)}
                  className="mt-1 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  disabled={isSaving}
                >
                  {CASHFLOW_ACCOUNTS.map((accountOption) => (
                    <option key={accountOption.value} value={accountOption.value}>
                      {accountOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Entra en
                </label>
                <select
                  value={destinationAccount}
                  onChange={(event) => handleDestinationAccountChange(event.target.value)}
                  className="mt-1 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  disabled={isSaving}
                >
                  {availableDestinationAccounts.map((accountOption) => (
                    <option key={accountOption.value} value={accountOption.value}>
                      {accountOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs font-semibold text-slate-500 sm:col-span-2">
                El traspaso mueve saldo entre cuentas sin afectar el balance general.
              </p>
            </div>
          ) : (
            <div>
              <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Cuenta que impacta
              </label>
              <select
                value={account}
                onChange={(event) => handleAccountChange(event.target.value)}
                disabled={isSaving || isBonosQrIncome}
                className={`mt-1 w-full appearance-none rounded-xl border px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white ${
                  isBonosQrIncome
                    ? 'cursor-not-allowed border-cyan-100 bg-cyan-50 text-cyan-700'
                    : 'cursor-pointer border-slate-200 bg-slate-50'
                }`}
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
          )}

          {type !== 'TRANSFER' && (
            <div>
              <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(event) => handlePaymentMethodChange(event.target.value)}
                disabled={isSaving || isBonosQrIncome}
                className={`mt-1 w-full appearance-none rounded-xl border px-4 py-3 text-slate-700 outline-none transition-all focus:border-teal-500 focus:bg-white ${
                  isBonosQrIncome
                    ? 'cursor-not-allowed border-cyan-100 bg-cyan-50 text-cyan-700'
                    : 'cursor-pointer border-slate-200 bg-slate-50'
                }`}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Mercado Pago">Mercado Pago</option>
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
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-teal-600 py-4 font-bold text-white shadow-lg shadow-teal-100 transition-all active:scale-[0.98] hover:bg-teal-700 disabled:cursor-wait disabled:opacity-75"
            >
              {isSaving
                ? 'Guardando...'
                : `${transaction ? 'Actualizar' : 'Guardar'} Movimiento`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashflowModal;

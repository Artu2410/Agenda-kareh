export const DEFAULT_CATEGORY = 'GENERAL';
export const BONOS_QR_CATEGORY = 'BONOS_QR';
export const TRANSFER_PAYMENT_METHOD = 'Transferencia interna';
export const CASHFLOW_ACCOUNTS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
];

const ACCOUNT_LABELS = new Map(CASHFLOW_ACCOUNTS.map((account) => [account.value, account.label]));
const ACCOUNT_SET = new Set(CASHFLOW_ACCOUNTS.map((account) => account.value));

const normalizeText = (value) => String(value || '').trim().toUpperCase();

export const resolveCategory = ({ type, category, paymentMethod, concept }) => {
  if (type !== 'INCOME') return DEFAULT_CATEGORY;
  if (category === BONOS_QR_CATEGORY) return BONOS_QR_CATEGORY;

  const normalizedMethod = normalizeText(paymentMethod);
  const normalizedConcept = normalizeText(concept);
  return normalizedMethod === 'QR' && /(IOMA|BONO|BONOS)/.test(normalizedConcept)
    ? BONOS_QR_CATEGORY
    : DEFAULT_CATEGORY;
};

export const resolveAccount = ({ account, paymentMethod }) => {
  const normalizedAccount = normalizeText(account);
  if (ACCOUNT_SET.has(normalizedAccount)) return normalizedAccount;
  return normalizeText(paymentMethod) === 'EFECTIVO' ? 'CASH' : 'MERCADO_PAGO';
};

export const resolveDestinationAccount = ({ type, account, destinationAccount }) => {
  const normalizedDestinationAccount = normalizeText(destinationAccount);
  if (ACCOUNT_SET.has(normalizedDestinationAccount)) return normalizedDestinationAccount;
  if (type !== 'TRANSFER') return null;

  const normalizedSourceAccount = normalizeText(account);
  const sourceAccount = ACCOUNT_SET.has(normalizedSourceAccount) ? normalizedSourceAccount : 'CASH';
  return sourceAccount === 'CASH' ? 'MERCADO_PAGO' : 'CASH';
};

export const getAccountLabel = (account) => ACCOUNT_LABELS.get(account) || 'Mercado Pago';

export const formatAccount = (transaction) => {
  const account = resolveAccount(transaction);
  return getAccountLabel(account);
};

export const formatAccountFlow = (transaction) => {
  if (transaction?.type !== 'TRANSFER') {
    return formatAccount(transaction);
  }

  const sourceAccount = resolveAccount(transaction);
  const destinationAccount = resolveDestinationAccount(transaction);
  return `${getAccountLabel(sourceAccount)} -> ${getAccountLabel(destinationAccount)}`;
};

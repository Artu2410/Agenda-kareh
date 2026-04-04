export const DEFAULT_CATEGORY = 'GENERAL';
export const BONOS_QR_CATEGORY = 'BONOS_QR';
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

export const formatAccount = (transaction) => {
  const account = resolveAccount(transaction);
  return ACCOUNT_LABELS.get(account) || 'Mercado Pago';
};

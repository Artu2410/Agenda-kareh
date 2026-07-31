const isMissingValue = (value) => value === null || value === undefined || value === '' || value === '-';

export const formatCount = (value) => {
  if (isMissingValue(value)) return '-';

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';

  return new Intl.NumberFormat('es-AR').format(numericValue);
};

export const formatRate = (value) => {
  if (isMissingValue(value)) return '-';

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';

  return `${numericValue.toFixed(1)}%`;
};

export const formatVolumeChange = (value) => {
  if (value === null || value === undefined) return 'Sin base';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

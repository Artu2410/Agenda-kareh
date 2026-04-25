export const formatCount = (value) => new Intl.NumberFormat('es-AR').format(Number(value) || 0);

export const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;

export const formatVolumeChange = (value) => {
  if (value === null || value === undefined) return 'Sin base';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

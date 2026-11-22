const parseBirthDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const datePart = text.includes('T') ? text.split('T')[0] : text;
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const plural = (count, singular, pluralWord) => `${count} ${count === 1 ? singular : pluralWord}`;

/**
 * Edad legible para fichas clínicas. En bebés la edad en años ("0 años")
 * no sirve: se muestran días, meses o "1 año y N meses".
 */
export const formatPatientAge = (birthDateValue, today = new Date()) => {
  const birth = parseBirthDate(birthDateValue);
  if (!birth) return null;
  if (birth > today) return null;

  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;

  if (months < 1) {
    const days = Math.floor((today - birth) / 86400000);
    return plural(days, 'día', 'días');
  }
  if (months < 12) return plural(months, 'mes', 'meses');
  if (months < 24) {
    const extra = months - 12;
    return extra > 0 ? `1 año y ${plural(extra, 'mes', 'meses')}` : '1 año';
  }
  return plural(Math.floor(months / 12), 'año', 'años');
};

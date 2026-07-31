import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { es } from 'date-fns/locale';

const monthFormat = "d 'de' MMMM yyyy";

export const formatShortDate = (value) => {
  if (!value) return 'Sin datos';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';

  return format(date, 'dd/MM/yyyy', { locale: es });
};

export const formatLongDate = (value) => {
  if (!value) return 'Sin datos';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';

  return format(date, `eeee ${monthFormat}`, { locale: es });
};

export const formatCurrentMonthRange = (referenceDate = new Date()) => {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  return `${format(start, monthFormat, { locale: es })} - ${format(end, monthFormat, { locale: es })}`;
};

export const formatYearRange = (referenceDate = new Date()) => {
  const start = startOfYear(referenceDate);
  return `Desde ${format(start, monthFormat, { locale: es })}`;
};

export const getFutureCoverageStats = (farthestDateValue, referenceDate = new Date()) => {
  if (!farthestDateValue) return null;

  const farthestDate = new Date(farthestDateValue);
  if (Number.isNaN(farthestDate.getTime())) return null;

  const daysCovered = Math.max(1, differenceInCalendarDays(farthestDate, startOfDay(referenceDate)));

  return {
    farthestDate,
    daysCovered,
    weeksCovered: daysCovered / 7,
    monthsCovered: daysCovered / 30.44,
    reaches30: daysCovered >= 30,
    reaches60: daysCovered >= 60,
    reaches90: daysCovered >= 90,
  };
};


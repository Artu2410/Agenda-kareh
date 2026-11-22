// El calendario automático puede traer la misma fecha dos veces con distinta
// capitalización ("Año nuevo" / "Año Nuevo"): se muestra una sola vez.
export const dedupeCalendarEntries = (entries = []) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.date}|${entry.type}|${entry.professionalId || ''}|${String(entry.name || '').trim().toLocaleLowerCase('es')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

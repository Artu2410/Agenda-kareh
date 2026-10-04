export const getHistoricalAxisMax = (rows = []) => {
  const maximum = rows.reduce(
    (currentMaximum, row) =>
      Math.max(
        currentMaximum,
        Number(row?.effectiveCapacity ?? row?.capacity) || 0,
      ),
    0,
  );

  return maximum > 0 ? Math.ceil(maximum / 100) * 100 : 100;
};

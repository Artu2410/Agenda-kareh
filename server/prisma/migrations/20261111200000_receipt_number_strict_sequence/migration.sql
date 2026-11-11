-- Los comprobantes pasan a numerarse solo con la secuencia de la base: un número
-- nunca se vuelve a usar, aunque se elimine el comprobante.
-- Hasta ahora se insertaban números explícitos ("último + 1"), así que la secuencia
-- puede haber quedado atrás: se la alinea con el número más alto existente.
SELECT setval(
  pg_get_serial_sequence('"PatientReceipt"', 'number'),
  COALESCE((SELECT MAX("number") FROM "PatientReceipt"), 0) + 1,
  false
);

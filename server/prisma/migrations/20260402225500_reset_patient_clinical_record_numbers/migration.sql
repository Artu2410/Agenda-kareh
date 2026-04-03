WITH ordered_patients AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS new_number
  FROM "Patient"
)
UPDATE "Patient" AS patient
SET "clinicalRecordNumber" = -ordered_patients.new_number
FROM ordered_patients
WHERE patient.id = ordered_patients.id;

UPDATE "Patient"
SET "clinicalRecordNumber" = ABS("clinicalRecordNumber")
WHERE "clinicalRecordNumber" < 0;

SELECT setval(
  '"Patient_clinicalRecordNumber_seq"',
  COALESCE(
    (
      SELECT MAX("clinicalRecordNumber")
      FROM "Patient"
      WHERE "clinicalRecordNumber" > 0
    ),
    1
  ),
  (SELECT COUNT(*) > 0 FROM "Patient")
);

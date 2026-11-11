-- La versión inicial de 20261111130000_add_patient_acta_book creaba esta columna y
-- luego se editó para no hacerlo. Si la base ya la tenía, se elimina; si no, no hace nada.
ALTER TABLE "Patient" DROP COLUMN IF EXISTS "actaBookRecordedById";

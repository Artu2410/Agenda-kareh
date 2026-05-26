DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'SECRETARIA'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'SECRETARIA';
  END IF;
END $$;

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'PROFESSIONAL';

UPDATE "User"
SET "role" = 'SUPER_USER'
WHERE email = 'centrokareh@gmail.com'
  AND "role" <> 'SUPER_USER';

UPDATE "User"
SET "role" = 'ADMIN'
WHERE email = 'arturoazocar2410@gmail.com'
  AND "role" <> 'ADMIN';

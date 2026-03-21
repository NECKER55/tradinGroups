-- Rename existing transaction timestamp and add approval timestamp
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transazione'
      AND column_name = 'data_ora'
  ) THEN
    ALTER TABLE transazione RENAME COLUMN data_ora TO created_at;
  END IF;
END $$;

ALTER TABLE transazione
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP(3);

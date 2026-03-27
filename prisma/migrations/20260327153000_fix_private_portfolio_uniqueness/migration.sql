BEGIN;

-- Existing UNIQUE(id_persona, id_gruppo) does not prevent duplicates for private portfolios
-- because PostgreSQL treats NULLs as distinct. This migration merges existing private
-- duplicates and then enforces one private portfolio per user.
LOCK TABLE "portafoglio" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "transazione" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "azioni_in_possesso" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  p RECORD;
  d RECORD;
BEGIN
  FOR p IN
    SELECT "id_persona", MIN("id_portafoglio") AS keeper_id
    FROM "portafoglio"
    WHERE "id_gruppo" IS NULL
    GROUP BY "id_persona"
    HAVING COUNT(*) > 1
  LOOP
    FOR d IN
      SELECT "id_portafoglio"
      FROM "portafoglio"
      WHERE "id_persona" = p."id_persona"
        AND "id_gruppo" IS NULL
        AND "id_portafoglio" <> p.keeper_id
      ORDER BY "id_portafoglio"
    LOOP
      -- Keep transaction history by re-pointing rows to the keeper portfolio.
      UPDATE "transazione"
      SET "id_portafoglio" = p.keeper_id
      WHERE "id_portafoglio" = d."id_portafoglio";

      -- Merge holdings into keeper; if a stock already exists, recompute weighted average.
      INSERT INTO "azioni_in_possesso" ("id_portafoglio", "id_stock", "prezzo_medio_acquisto", "numero")
      SELECT p.keeper_id, a."id_stock", a."prezzo_medio_acquisto", a."numero"
      FROM "azioni_in_possesso" a
      WHERE a."id_portafoglio" = d."id_portafoglio"
      ON CONFLICT ("id_portafoglio", "id_stock") DO UPDATE
      SET
        "numero" = "azioni_in_possesso"."numero" + EXCLUDED."numero",
        "prezzo_medio_acquisto" = CASE
          WHEN ("azioni_in_possesso"."numero" + EXCLUDED."numero") = 0 THEN 0
          ELSE ROUND(
            (
              ("azioni_in_possesso"."prezzo_medio_acquisto" * "azioni_in_possesso"."numero") +
              (EXCLUDED."prezzo_medio_acquisto" * EXCLUDED."numero")
            ) / ("azioni_in_possesso"."numero" + EXCLUDED."numero"),
            2
          )
        END;

      -- Consolidate available cash.
      UPDATE "portafoglio" keep
      SET "liquidita" = keep."liquidita" + dup."liquidita"
      FROM "portafoglio" dup
      WHERE keep."id_portafoglio" = p.keeper_id
        AND dup."id_portafoglio" = d."id_portafoglio";

      -- Delete duplicate portfolio row (remaining dependent rows are already moved).
      DELETE FROM "portafoglio"
      WHERE "id_portafoglio" = d."id_portafoglio";
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "portafoglio_id_persona_private_key"
ON "portafoglio" ("id_persona")
WHERE "id_gruppo" IS NULL;

COMMIT;

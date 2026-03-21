-- =============================================================
-- migrations/001_triggers_and_constraints.sql
-- Trigger e vincoli custom non gestibili da Prisma schema.
-- Da eseguire DOPO prisma migrate deploy.
-- =============================================================


-- =============================================================
-- A. TRIGGER DI ESECUZIONE (Pending → Executed)
-- Quando una transazione passa a Executed, completa il settlement.
-- BUY: aggiunge azioni in possesso (fondi già scalati in Pending).
-- SELL: accredita liquidità (azioni già scalate in Pending).
-- =============================================================

CREATE OR REPLACE FUNCTION fn_esegui_transazione()
RETURNS TRIGGER AS $$
DECLARE
  v_ricavo DECIMAL(18,6);
  v_prezzo_medio DECIMAL(18,2);
BEGIN
  -- Attiva solo quando stato passa da Pending a Executed
  IF OLD.stato = 'Pending' AND NEW.stato = 'Executed' THEN

    -- Traccia il momento di approvazione/esecuzione.
    NEW.approved_at := NOW();

    IF NEW.tipo = 'Buy' THEN
      -- Aggiorna o inserisce Azioni_in_possesso con prezzo medio ponderato
      INSERT INTO azioni_in_possesso (id_portafoglio, id_stock, numero, prezzo_medio_acquisto)
      VALUES (NEW.id_portafoglio, NEW.id_stock, NEW.quantita_azioni, NEW.prezzo_esecuzione)
      ON CONFLICT (id_portafoglio, id_stock) DO UPDATE
        SET
          prezzo_medio_acquisto = (
            (azioni_in_possesso.numero * azioni_in_possesso.prezzo_medio_acquisto
              + EXCLUDED.numero * EXCLUDED.prezzo_medio_acquisto)
            / (azioni_in_possesso.numero + EXCLUDED.numero)
          ),
          numero = azioni_in_possesso.numero + EXCLUDED.numero;

    ELSIF NEW.tipo = 'Sell' THEN
      -- Calcola ricavo
      v_ricavo := NEW.quantita_azioni * NEW.prezzo_esecuzione;

      -- Accredita il ricavo nel portafoglio
      UPDATE portafoglio
        SET liquidita = liquidita + v_ricavo
      WHERE id_portafoglio = NEW.id_portafoglio;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_esegui_transazione ON transazione;
CREATE TRIGGER trg_esegui_transazione
  BEFORE UPDATE OF stato ON transazione
  FOR EACH ROW
  EXECUTE FUNCTION fn_esegui_transazione();


-- =============================================================
-- B. TRIGGER CREAZIONE PORTAFOGLIO (nuovo membro gruppo)
-- Crea automaticamente un Portafoglio per il nuovo membro.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_crea_portafoglio_gruppo()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO portafoglio (liquidita, id_persona, id_gruppo)
  VALUES (NEW.budget_iniziale, NEW.id_persona, NEW.id_gruppo)
  ON CONFLICT (id_persona, id_gruppo) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crea_portafoglio_gruppo ON membro_gruppo;
CREATE TRIGGER trg_crea_portafoglio_gruppo
  AFTER INSERT ON membro_gruppo
  FOR EACH ROW
  EXECUTE FUNCTION fn_crea_portafoglio_gruppo();


-- =============================================================
-- C. TRIGGER BAN GLOBALE
-- Annulla tutte le transazioni Pending dell'utente bannato.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_ban_utente()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_banned = FALSE AND NEW.is_banned = TRUE THEN
    DELETE FROM transazione t
      USING portafoglio p
     WHERE t.id_portafoglio = p.id_portafoglio
       AND p.id_persona = NEW.id_persona
       AND t.stato = 'Pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ban_utente ON persona;
CREATE TRIGGER trg_ban_utente
  AFTER UPDATE OF is_banned ON persona
  FOR EACH ROW
  EXECUTE FUNCTION fn_ban_utente();


-- =============================================================
-- D. TRIGGER CLEAN STORICO su cancellazione portafoglio
-- Elimina i record Storico_Portafoglio orfani.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_clean_storico_portafoglio()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storico_portafoglio
   WHERE id_persona = OLD.id_persona
     AND (
       (OLD.id_gruppo IS NULL AND id_gruppo IS NULL)
       OR id_gruppo = OLD.id_gruppo
     );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_storico_portafoglio ON portafoglio;
CREATE TRIGGER trg_clean_storico_portafoglio
  BEFORE DELETE ON portafoglio
  FOR EACH ROW
  EXECUTE FUNCTION fn_clean_storico_portafoglio();


-- =============================================================
-- E1. TRIGGER NO SELF-FRIENDSHIP
-- Impedisce id_persona_1 == id_persona_2.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_no_self_friendship()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_persona_1 = NEW.id_persona_2 THEN
    RAISE EXCEPTION 'Non puoi aggiungere te stesso come amico.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_self_friendship ON amicizia;
CREATE TRIGGER trg_no_self_friendship
  BEFORE INSERT ON amicizia
  FOR EACH ROW
  EXECUTE FUNCTION fn_no_self_friendship();


-- =============================================================
-- E2. TRIGGER UNIQUE FRIENDSHIP
-- Impedisce duplicati indipendentemente dall'ordine degli ID.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_unique_friendship()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM amicizia
     WHERE (id_persona_1 = NEW.id_persona_2 AND id_persona_2 = NEW.id_persona_1)
        OR (id_persona_1 = NEW.id_persona_1 AND id_persona_2 = NEW.id_persona_2)
  ) THEN
    RAISE EXCEPTION 'Esiste già una relazione di amicizia tra questi due utenti.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unique_friendship ON amicizia;
CREATE TRIGGER trg_unique_friendship
  BEFORE INSERT ON amicizia
  FOR EACH ROW
  EXECUTE FUNCTION fn_unique_friendship();


-- =============================================================
-- F. TRIGGER AUTO-DELETE INVITATION
-- Cancella l'invito quando l'utente viene aggiunto al gruppo.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_auto_delete_invitation()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM invito_gruppo
   WHERE id_invitato = NEW.id_persona
     AND id_gruppo   = NEW.id_gruppo;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_delete_invitation ON membro_gruppo;
CREATE TRIGGER trg_auto_delete_invitation
  AFTER INSERT ON membro_gruppo
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_delete_invitation();


-- =============================================================
-- G. CHECK: PARTECIPAZIONE ATTIVA (Transazione → Membro_Gruppo)
-- Garantisce che solo User/Admin/Owner possano fare trading.
-- Implementato come CHECK CONSTRAINT via funzione.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_check_ruolo_trading(
  p_id_portafoglio INT,
  p_id_stock VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_id_persona INT;
  v_id_gruppo  INT;
  v_ruolo      text;
BEGIN
  SELECT id_persona, id_gruppo
    INTO v_id_persona, v_id_gruppo
    FROM portafoglio
   WHERE id_portafoglio = p_id_portafoglio;

  -- Portafoglio personale: nessun vincolo di ruolo gruppo
  IF v_id_gruppo IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT ruolo::text INTO v_ruolo
    FROM membro_gruppo
   WHERE id_persona = v_id_persona
     AND id_gruppo  = v_id_gruppo;

  RETURN v_ruolo IN ('Owner', 'Admin', 'User');
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger che usa la funzione sopra
CREATE OR REPLACE FUNCTION fn_check_trading_permission()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT fn_check_ruolo_trading(NEW.id_portafoglio, NEW.id_stock) THEN
    RAISE EXCEPTION 'Ruolo insufficiente: solo Owner/Admin/User possono effettuare transazioni nel gruppo.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_trading_permission ON transazione;
CREATE TRIGGER trg_check_trading_permission
  BEFORE INSERT ON transazione
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_trading_permission();


-- =============================================================
-- VINCOLO UNICITÀ OWNER PER GRUPPO
-- Garantisce che ogni gruppo abbia esattamente 1 Owner.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_unique_owner()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_count INT;
BEGIN
  IF NEW.ruolo = 'Owner' THEN
    SELECT COUNT(*) INTO v_owner_count
      FROM membro_gruppo
     WHERE id_gruppo = NEW.id_gruppo
       AND ruolo = 'Owner'
       AND id_persona != NEW.id_persona;

    IF v_owner_count > 0 THEN
      RAISE EXCEPTION 'Il gruppo % ha già un Owner. Declassa prima il precedente.', NEW.id_gruppo;
    END IF;
  END IF;

  -- Impedisce di rimuovere il ruolo Owner senza successore
  IF OLD.ruolo = 'Owner' AND NEW.ruolo != 'Owner' THEN
    SELECT COUNT(*) INTO v_owner_count
      FROM membro_gruppo
     WHERE id_gruppo = NEW.id_gruppo
       AND ruolo = 'Owner'
       AND id_persona != NEW.id_persona;

    IF v_owner_count = 0 THEN
      RAISE EXCEPTION 'Non puoi declassare l''Owner senza nominare prima un successore.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unique_owner ON membro_gruppo;
CREATE TRIGGER trg_unique_owner
  BEFORE INSERT OR UPDATE OF ruolo ON membro_gruppo
  FOR EACH ROW
  EXECUTE FUNCTION fn_unique_owner();


-- =============================================================
-- VINCOLO: LIQUIDITÀ NON NEGATIVA
-- Impedisce che la liquidità scenda sotto 0.
-- =============================================================

ALTER TABLE portafoglio
  ADD CONSTRAINT chk_liquidita_non_negativa
  CHECK (liquidita >= 0);


-- =============================================================
-- VINCOLO: INVITI SOLO DA ADMIN/OWNER
-- =============================================================

CREATE OR REPLACE FUNCTION fn_check_invito_permesso()
RETURNS TRIGGER AS $$
DECLARE
  v_ruolo text;
BEGIN
  SELECT ruolo::text INTO v_ruolo
    FROM membro_gruppo
   WHERE id_persona = NEW.id_mittente
     AND id_gruppo  = NEW.id_gruppo;

  IF v_ruolo NOT IN ('Owner', 'Admin') THEN
    RAISE EXCEPTION 'Solo Admin e Owner possono inviare inviti al gruppo %.', NEW.id_gruppo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invito_permesso ON invito_gruppo;
CREATE TRIGGER trg_check_invito_permesso
  BEFORE INSERT ON invito_gruppo
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_invito_permesso();


-- =============================================================
-- VINCOLO: ID MITTENTE != ID INVITATO
-- =============================================================

ALTER TABLE invito_gruppo
  ADD CONSTRAINT chk_invito_no_self
  CHECK (id_mittente != id_invitato);
-- Indici funzionali per ricerca prefix veloce su persona.
-- 1) username case-insensitive: lower(username) LIKE 'prefisso%'
-- 2) id prefisso testuale: (id_persona::text) LIKE '123%'
CREATE INDEX IF NOT EXISTS idx_persona_username_prefix
  ON persona (lower(username) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_persona_id_text_prefix
  ON persona ((id_persona::text) text_pattern_ops);

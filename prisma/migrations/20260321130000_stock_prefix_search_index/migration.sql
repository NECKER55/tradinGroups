-- Indice funzionale per ricerca prefix case-insensitive su nome_societa.
-- Supporta query del tipo: lower(nome_societa) LIKE 'prefisso%'
CREATE INDEX IF NOT EXISTS idx_stock_nome_societa_prefix
  ON stock (lower(nome_societa) text_pattern_ops);

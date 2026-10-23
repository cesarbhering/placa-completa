-- Controle de publicacao de recall (blog + tweet + LinkedIn mensal).
-- Vive no leiloes-poc-db, ao lado de recall_montadora. O refresh mensal do
-- recall apaga/reinsere campanhas, entao "novo" = id que nunca entrou aqui.
-- Primeira carga: pc-recall-publicar --baseline (marca tudo que ja existe).
CREATE TABLE IF NOT EXISTS recall_publicacao (
  recall_id     TEXT PRIMARY KEY,           -- recall_montadora.id
  marca         TEXT NOT NULL,
  titulo        TEXT,
  start_date    DATE,
  status        TEXT NOT NULL DEFAULT 'detectado'
                CHECK (status IN ('baseline','detectado','pr_aberto','publicado','ignorado')),
  detectado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  slug          TEXT,
  pr_url        TEXT,
  publicado_em  TIMESTAMPTZ,                -- merge do PR / post no ar
  url_post      TEXT,
  tweet_id      TEXT,
  linkedin_mes  TEXT                        -- 'YYYY-MM' do apanhado mensal em que entrou
);
CREATE INDEX IF NOT EXISTS ix_recall_pub_status ON recall_publicacao (status);
-- LGPD: so dado de campanha/veiculo, nada de proprietario.
ALTER TABLE recall_publicacao ENABLE ROW LEVEL SECURITY;

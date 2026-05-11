-- Index ip_address to keep the rate-limit count query cheap.
CREATE INDEX IF NOT EXISTS idx_consultas_ip_address ON consultas (ip_address);

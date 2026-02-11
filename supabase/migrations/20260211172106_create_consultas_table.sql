CREATE TABLE IF NOT EXISTS consultas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  placa TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  api_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultas_email ON consultas (email);
CREATE INDEX idx_consultas_placa ON consultas (placa);
CREATE INDEX idx_consultas_created_at ON consultas (created_at DESC);

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON consultas
  FOR INSERT
  WITH CHECK (true);

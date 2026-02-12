-- Add is_pwa column to track if the query came from PWA or Web
ALTER TABLE consultas
ADD COLUMN is_pwa BOOLEAN DEFAULT FALSE;

-- Create index for filtering by source
CREATE INDEX idx_consultas_is_pwa ON consultas (is_pwa);

-- Add comment to document the field
COMMENT ON COLUMN consultas.is_pwa IS 'Indicates if the query was made from PWA (true) or Web (false)';

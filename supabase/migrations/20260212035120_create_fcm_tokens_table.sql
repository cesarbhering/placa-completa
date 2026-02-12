-- Create FCM tokens table for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_email TEXT,
  user_agent TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_fcm_tokens_token ON fcm_tokens (token);
CREATE INDEX idx_fcm_tokens_user_email ON fcm_tokens (user_email);
CREATE INDEX idx_fcm_tokens_created_at ON fcm_tokens (created_at DESC);

-- Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow anonymous inserts (for PWA registration)
CREATE POLICY "Allow anonymous token registration" ON fcm_tokens
  FOR INSERT
  WITH CHECK (true);

-- Policy to allow reading tokens (for backend to send notifications)
CREATE POLICY "Allow backend to read tokens" ON fcm_tokens
  FOR SELECT
  USING (true);

-- Policy to allow updating last_used_at
CREATE POLICY "Allow token updates" ON fcm_tokens
  FOR UPDATE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_fcm_tokens_updated_at_trigger
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();

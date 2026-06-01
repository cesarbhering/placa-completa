-- Add delivery-channel selection to public.consultas.
--
-- Until now every consulta was delivered by email; the new web-only
-- WhatsApp option needs a way to (a) record which channel was used,
-- (b) track delivery success per channel, and (c) allow consultas
-- where the user only provided a phone number.

ALTER TABLE public.consultas
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp')),
  ADD COLUMN whatsapp_sent BOOLEAN DEFAULT false;

-- Email was NOT NULL; loosen it so whatsapp-only rows are valid.
ALTER TABLE public.consultas
  ALTER COLUMN email DROP NOT NULL;

-- At least one of (email, phone) must be set, matching the chosen channel.
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_channel_recipient_chk
  CHECK (
    (channel = 'email'    AND email IS NOT NULL) OR
    (channel = 'whatsapp' AND phone IS NOT NULL)
  );

-- Existing INSERT policy validates email/placa formats. Tighten it
-- to also accept whatsapp inserts (which may have NULL email).
DROP POLICY IF EXISTS "Allow validated anonymous inserts" ON public.consultas;
CREATE POLICY "Allow validated anonymous inserts" ON public.consultas
  FOR INSERT
  WITH CHECK (
    placa IS NOT NULL AND
    placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' AND
    email_sent = FALSE AND
    whatsapp_sent = FALSE AND
    channel IN ('email', 'whatsapp') AND
    (
      (channel = 'email' AND
        email IS NOT NULL AND
        email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' AND
        LENGTH(email) <= 254)
      OR
      (channel = 'whatsapp' AND
        phone IS NOT NULL AND
        LENGTH(phone) BETWEEN 10 AND 15)
    )
  );

-- Index for whatsapp dedupe by phone + placa.
CREATE INDEX IF NOT EXISTS idx_consultas_phone_placa
  ON public.consultas (phone, placa)
  WHERE phone IS NOT NULL;

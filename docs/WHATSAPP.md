# WhatsApp delivery channel — feature notes

Web visitors can now choose between **e-mail** and **WhatsApp** as the
delivery channel for a consulta. The PWA flow is untouched and keeps
returning the data inline.

The feature is shipped behind a public flag (`NUXT_PUBLIC_WHATSAPP_ENABLED`)
so the wiring can land in main without flipping the UI on for end users.

## Architecture

```
                    +---------------------+
                    |  Web user (browser) |
                    +----------+----------+
                               |
                  POST /api/consulta { channel, email|phone, ... }
                               |
                    +----------v----------+
                    |  Nuxt Nitro server  |
                    +-+-----------------+-+
                      |                 |
            channel='email'      channel='whatsapp'
                      |                 |
                +-----v-----+      +----v---------------+
                |  Resend   |      |  Evolution API     |
                |  (prod)   |      |  POST /message/    |
                +-----------+      |  sendText/{inst}   |
                                   +--------+-----------+
                                            |
                                   +--------v-----------+
                                   | Baileys -> WA Web  |
                                   +--------------------+
```

- `server/utils/evolutionApi.ts` is the only piece that knows how to
  talk to Evolution. It exposes `sendWhatsAppText(phone, text)` plus a
  `normalizePhoneForWhatsApp(raw)` helper that prepends `55` when the
  user didn't include a country code.
- `server/api/consulta.post.ts` accepts `channel: 'email' | 'whatsapp'`,
  validates the recipient field that matches that channel, dedupes
  per-channel (email+placa or phone+placa), and dispatches to the
  matching sender. The Supabase insert now carries `channel`,
  `email_sent`, and `whatsapp_sent`.
- `pages/index.vue` shows the channel toggle inside the existing
  "Informe seu E-mail" / confirmation modals. Tied to
  `useRuntimeConfig().public.whatsappEnabled` — when the flag is
  `false` the form behaves exactly like main.

## Database

`supabase/migrations/20260602030000_add_channel_to_consultas.sql` adds
to `public.consultas`:

| Column          | Type    | Notes                                         |
|-----------------|---------|-----------------------------------------------|
| `channel`       | TEXT    | NOT NULL DEFAULT 'email', CHECK in `('email','whatsapp')` |
| `whatsapp_sent` | BOOLEAN | DEFAULT false                                 |

It also:
- relaxes `email NOT NULL` (whatsapp-only rows may not have one),
- adds a CHECK that the channel matches a non-null recipient,
- rewrites the `Allow validated anonymous inserts` RLS policy to
  accept either pair (email+email-format) or (phone+length range),
- creates `idx_consultas_phone_placa` for the per-phone dedupe query.

**Applied to staging only** (`nqhlxsvggrumgcceamwg`). When you merge
this branch, the same migration will be picked up by `supabase db push
--linked` against prod.

## Environment

`.env.example` was extended with:

```
EVOLUTION_API_URL=http://127.0.0.1:8081      # http://evolution:8080 in prod
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE=placa-completa
NUXT_PUBLIC_WHATSAPP_ENABLED=false
```

`nuxt.config.ts` reads these into `runtimeConfig.evolution*` (server)
and `runtimeConfig.public.whatsappEnabled` (UI gating). Forgetting to
set them in Coolify just means the WhatsApp branch fails with a
`500 Evolution API is not configured`, never silently — the email
path keeps working.

## Local dev stack

`dev/whatsapp/` brings up Evolution API + Postgres + Redis bound to
`127.0.0.1` only.

```bash
cd dev/whatsapp
./up.sh                       # boots stack, prints API key on first run
./create-instance.sh placa-completa
# scan the QR shown at http://127.0.0.1:8081/manager
./down.sh                     # stop containers (volumes kept)
./down.sh --wipe              # also drop the volumes
```

Used by hand against a Nuxt `nuxt dev` server pointed at:

```
EVOLUTION_API_URL=http://127.0.0.1:8081
EVOLUTION_API_KEY=<value from dev/whatsapp/.env>
EVOLUTION_INSTANCE=placa-completa
NUXT_PUBLIC_WHATSAPP_ENABLED=true
```

Pointed at the staging Supabase project (`nqhlxsvggrumgcceamwg`) so
the migration is in scope, prod is untouched.

## Run this feature on your laptop

Requisitos: Node 22, Docker, git, ~2 GB livres.

### 1. Clonar a branch

```bash
git clone git@github.com:cesarbhering/placa-completa.git
cd placa-completa
git checkout feature/whatsapp
npm install
```

### 2. Subir o Evolution API local

```bash
cd dev/whatsapp
./up.sh
# Anote a API key impressa na primeira execução, ou veja em dev/whatsapp/.env
cd ../..
```

Sobe Evolution + Postgres + Redis em `127.0.0.1:8081`. Manager UI em
http://127.0.0.1:8081/manager (login = a API key gerada).

### 3. Criar `.env` na raiz com os 6 valores

```bash
cp .env.example .env
```

Edite e preencha:

| Variável | De onde vem |
|---|---|
| `SUPABASE_URL` | Dashboard Supabase → projeto **placa-completa-staging** (ref `nqhlxsvggrumgcceamwg`) → Settings → API |
| `SUPABASE_SERVICE_KEY` | Mesmo lugar (Legacy `service_role`). **Use staging — não a de prod** |
| `PLACA_API_TOKEN` | Coolify → app placa-completa → Environment Variables |
| `FIPE_API_TOKEN` + `FIPE_API_URL` | Idem Coolify |
| `RESEND_API_KEY` | Pode deixar vazio se for testar só o caminho WhatsApp |
| `API_KEY_OPENAI` | Pode deixar vazio (só usado pelo PWA pra OCR de foto) |
| `EVOLUTION_API_URL` | `http://127.0.0.1:8081` |
| `EVOLUTION_API_KEY` | O que apareceu no `up.sh` (ou veja `dev/whatsapp/.env`) |
| `EVOLUTION_INSTANCE` | `placa-completa` |
| `NUXT_PUBLIC_WHATSAPP_ENABLED` | `true` — sem isso o toggle não aparece |

### 4. Subir o Nuxt em dev

```bash
npm run dev
```

http://localhost:3000

### 5. Testar o caminho WhatsApp

- Digite uma placa válida (qualquer placa brasileira real)
- Clica em Consultar
- Modal abre com toggle **E-mail | WhatsApp**
- Escolhe WhatsApp, digita seu telefone, manda

⚠️ Sem parear o número no Evolution (passo abaixo) a mensagem vai falhar na entrega. O backend retorna `whatsappSent: false` e mostra erro genérico. **Útil mesmo assim** pra ver toda a UX e o request indo pra Evolution. Pra ver a mensagem chegar de verdade no celular, faça o pareamento (próxima seção).

### 6. Pra ver chegar no celular (opcional)

Depois do `up.sh`:

```bash
cd dev/whatsapp
./create-instance.sh placa-completa
```

Abra `http://127.0.0.1:8081/manager`, log com a API key, clica em
`placa-completa`, escaneia o QR no WhatsApp → Configurações → Aparelhos
conectados → Conectar aparelho. Pode usar o número que você tem
disponível pra teste.

### 7. Parar tudo

```bash
cd dev/whatsapp && ./down.sh
# (Ctrl+C no terminal do npm run dev)
```

Sem `--wipe` o estado do Evolution (incluindo o pareamento) fica salvo
pra próxima vez que você der `up.sh`.

## How to pair a real WhatsApp number (QR flow)

1. `cd dev/whatsapp && ./up.sh` (or the prod-equivalent compose later)
2. `./create-instance.sh placa-completa` — registers the instance with
   Evolution and asks WhatsApp to issue a QR code
3. Open `http://127.0.0.1:8081/manager` in a browser, paste the API
   key, click the `placa-completa` instance — the QR code is rendered
4. On the phone that owns the number: WhatsApp → Settings → Linked
   Devices → Link a Device → scan the QR
5. The instance status flips to `connected`. From that moment any
   `POST /message/sendText/placa-completa` actually delivers.

The Evolution database persists the session — you only re-pair if the
volume is wiped, the number is unlinked, or the device is logged out.

## Security notes that matter when this goes to prod

- **Service exposure**: keep Evolution on a private network (Docker
  network alongside the Nuxt server, or Tailscale). Expose only via
  the Nuxt API. Do NOT publish port 8080 to the internet.
- **API key**: `AUTHENTICATION_API_KEY` is global — anyone with it
  can create/delete instances and send any message. Treat like a root
  credential.
- **Rate limit**: backend uses the existing per-recipient + per-IP
  hourly cap (5/h). Already covers phone too because the SQL filter
  swaps to `phone` for `channel='whatsapp'`.
- **Phone validation**: `isValidPhone` (server) + `validatePhone`
  (client) accept 10–13 digits. Anything else is rejected before
  reaching Evolution.
- **PWA bypass**: `channel='whatsapp'` is explicitly rejected when
  `isPWA=true`. Same hardening still applies to the `isPWA` flag
  itself (the broader audit item A1 is unrelated to this change).

## What's left for prod cutover

- [ ] Plan a separate Coolify app for Evolution (with its own Postgres
      + Redis), kept on the internal Docker network only
- [ ] Wire the prod Nuxt app's env to that internal URL
- [ ] Set `NUXT_PUBLIC_WHATSAPP_ENABLED=true` in Coolify only when
      ready to roll out to users
- [ ] Apply the migration against prod (`supabase db push --linked`)
- [ ] First-time QR pairing on the prod instance (one-shot operator
      task)
- [ ] Optional: webhooks (`MESSAGES_UPSERT`, `CONNECTION_UPDATE`) for
      observability and to auto-page when the number gets
      disconnected

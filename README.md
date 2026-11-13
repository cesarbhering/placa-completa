# PlacaCompleta

**Vehicle history reports for Brazilian used-car buyers, by license plate.**
Live at [placacompleta.com.br](https://placacompleta.com.br). Licensed under Apache 2.0 (see [LICENSE](LICENSE)).

## What we do

Buying a used car in Brazil is risky: salvage titles, auction history, unpaid fines, liens and odometer fraud are common and hard to check. PlacaCompleta turns a license plate into a plain-language report in under five minutes.

- **Free lookup**: make, model, year, FIPE market value, and a signal whether the car appears in our auction database.
- **Paid reports** (Pix or card, R$ 29,90 and R$ 44,90): official registry data (chassis, status, theft and lien indicators, recall and auction flags), state fines where available, auction history with photos of the actual lot, FIPE price history and depreciation, insurance estimate, chassis origin decoding, and a pre-purchase checklist.
- **Auction database**: our own crawler collects catalogs from Brazilian auction houses and public DETRAN auction notices, with photos, so a buyer can see the car as it was sold at auction.

Built for mobile first (82% of paid traffic comes from phones).

## Real usage

All windows are explicit (dates as dd-mm-yy, Brazil time unless noted). Figures come from our production database, Cloudflare and Google Search Console. Customer data is never in this repository.

| Metric | Window | Value |
|---|---|---|
| Free plate lookups | 03-08-26 to 11-11-26 | 53,710 |
| Free plate lookups | 13-10-26 to 11-11-26 | 33,413 |
| Distinct plates looked up | 03-08-26 to 11-11-26 | 42,457 |
| Unique visitors per day (Cloudflare, UTC days) | 05-11-26 to 11-11-26 | 2,270 to 3,936 |
| Google organic | 30-07-26 to 29-10-26 | 10,221 clicks, 495,572 impressions, CTR 2.1%, avg. position 8.4 |
| Google organic | 02-10-26 to 29-10-26 | 6,541 clicks, 311,190 impressions |

## Stack

- **Nuxt 3** (Vue, Nitro server routes), TypeScript, Vitest, Playwright.
- **Supabase** (Postgres) for orders, funnel events and caches; row-level security on every table.
- **Payments**: Pix via Woovi and AbacatePay, cards via Stripe. Google Play Billing in the Android app.
- **Data sources**: official government vehicle registry (via SERPRO), state DETRAN fines through Infosimples, FIPE, NHTSA vPIC for chassis decoding, our own auction database (separate repository).
- **Infra**: Docker on a single VPS behind Cloudflare, deployed by Coolify from `main`. Transactional e-mail via Resend.
- **AI**: Claude (Haiku) to disambiguate FIPE versions and group recall campaigns.

## Running locally

```bash
npm install
npm run dev              # dev server
npm run dev:no-analytics # dev without analytics
npm run test             # unit tests (Vitest)
npm run test:e2e         # end-to-end (Playwright)
npm run test:all
```

Copy `.env.example` to `.env` and fill the keys you have. Without paid-source keys the free lookup and the report layout still work with stubbed data.

## Optional: electronic service invoices (NFS-e)

Invoicing is an optional module, off by default. When enabled, each paid report is invoiced automatically after delivery through an external emitter that speaks the Brazilian national NFS-e standard (`nfse-emissor`, a separate service consumed over HTTP with a URL and an API key, so any provider with the same contract can replace it). The site never waits on the emitter: the report, its e-mail and refunds behave exactly the same whether the module is on, off or unreachable.

Turn it on with these variables (all empty by default):

| Variable | Meaning |
|---|---|
| `NUXT_NFSE` | `on` enables the module. Anything else disables every call and every UI element. |
| `NUXT_NFSE_URL` | Base URL of the emitter (for example `http://nfse:3000`). |
| `NUXT_NFSE_API_KEY` | Bearer key issued by the emitter for this site. |
| `NUXT_NFSE_WEBHOOK_SECRET` | HMAC secret the emitter signs its webhooks with. |
| `NUXT_NFSE_DESDE` | ISO timestamp; orders delivered before it are never invoiced. Required when the module is on (missing or invalid means nothing is invoiced). |
| `NUXT_TOMADOR_KEY` | 32-byte base64 key that encrypts the payer's document and name at rest (`pedidos_tomador`). Without it no payer data is stored and no invoice can be issued. |

Configure the emitter's webhook to `POST /api/premium/nfse/webhook` on the site, signed with `NUXT_NFSE_WEBHOOK_SECRET`. A host timer (`ops/systemd/pc-nfse-reconciliar.timer`, every 10 min, running `ops/pc-nfse-reconciliar`) calls `POST /api/premium/nfse/reconciliar` to enqueue, poll, e-mail and cancel whatever the webhook missed; it needs `NUXT_ADMIN_SECRET`.

Orders paid through Google Play, and orders without an identifiable payer, are skipped and the operator is notified. The privacy policy and terms must mention the payer-data retention before `NUXT_TOMADOR_KEY` is set in production.

## Optional: price A/B test

A price experiment for the full report, off by default (`shared/ab-preco.ts`). When on, each web visitor is assigned once to arm A (table price from `shared/planos.ts`) or arm B (`PRECO_COMPLETA_BRACO.B`), 50/50, and keeps that arm across visits (`localStorage`, `sessionStorage` as fallback; no cookie). The app, bots and server-rendered pages always use arm A. The arm travels in the checkout request and the server charges that arm's price (coupons apply on top of it); it is stored in `pedidos_premium.ab_preco` and stamped as `extra.ab_preco` on every funnel event.

Visible prices on consumer pages go through `usePrecoCompleta` / `<PrecoCompleta>` / `<TextoComPreco>`: arm A in server rendering, the visitor's arm after mount; first-fold spots keep the number hidden until mount in both arms. JSON-LD, meta tags, Open Graph, blog text and `/para-empresas` always show arm A.

| Variable | Meaning |
|---|---|
| `NUXT_PUBLIC_AB_PRECO` | `on` enables the test. Anything else (default empty) puts everybody in arm A, with nothing drawn, stored, sent or read. |

With the flag off the site never touches the `ab_preco` column. Going live, in this order:

1. Apply `supabase/migrations/20261113120000_pedidos_ab_preco.sql` in production AND staging.
2. Reload the PostgREST schema cache (`notify pgrst, 'reload schema';`, already at the end of the migration; run it again if in doubt).
3. Smoke test through the API in each environment: `select ab_preco from pedidos_premium limit 1` must succeed.
4. Only then set `NUXT_PUBLIC_AB_PRECO=on`.

**Turning the flag on before the migration breaks the report page and the checkout**: with the flag on, the order insert and the report query use the `ab_preco` column, and both fail while it does not exist.

The daily host report is `ops/pc-ab-preco-report` with `ops/systemd/pc-ab-preco-report.{service,timer}`.

## Repository layout

- `pages/`, `components/`, `composables/`: the site and the report UI.
- `server/api/premium/`: checkout, payment webhooks, report generation, post-delivery photo backfill.
- `server/utils/`: source adapters (registry, fines, FIPE, recall, auction API), report snapshot, e-mails.
- `shared/`: plans and prices, FIPE version matching rules, report types shared by client and server.
- `supabase/migrations/`: database schema and RPCs.
- `docs/`: incident write-ups and design notes.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what we are working on and what comes next. Open issues track individual items.

## Contributing

Issues and pull requests are welcome. Please do not open issues containing real license plates, customer data or payment identifiers. Security reports: contato@placacompleta.com.br.

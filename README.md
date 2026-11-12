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

# Roadmap

Updated 2026-10-31. Items are in rough priority order within each horizon. Dates are targets, not promises.

## Shipped recently (October 2026)

- Report 2.0: job queue for paid reports, per-source cache with TTL, FIPE price history and depreciation, NHTSA chassis decoding.
- Full photo carousel of the auction lot (up to 300 photos and video), with a fast post-delivery backfill when photos arrive after the report.
- Paid-report photo requests now preempt crawler backfills (lot photos in about one minute instead of ten).
- Truck FIPE versions resolved by axle count from the registry.
- Checkout A/B test (preview and risk summary vs. compact screen), with daily report.
- Business page and lead form for dealers (`/para-empresas`).

## Now (next 4 to 6 weeks)

1. **Delivery when the buyer leaves no contact**: a "Já paguei" recovery page by plate and a stronger prompt for e-mail on the Pix screen. Several paid customers close the tab before confirmation and never see the link.
2. **Card payments via Stripe** as a one-click alternative to Pix.
3. **Fines coverage**: more states through the fines provider, and a self-hosted gov.br login path (e-CPF certificate) for the states that have no API.
4. **Auction coverage**: close the gap between our own auction database and the partner source to under 20%; daily collection health report; more auction houses.
5. **Android app (Capacitor v3)**: replace the TWA, Google Play Billing with real-time developer notifications so purchases made on the phone are never lost.
6. **Search ads migration**: Microsoft Ads SOAP to REST before SOAP is retired (31 Jan 2027).

## Next (Q1 2027)

- **Vehicle-owner notifications**: opt-in alerts when a plate the buyer checked appears in a new auction or recall.
- **Dealer packages**: bulk lookups and monthly billing for used-car lots (leads already being collected).
- **Programmatic SEO**: per-model and per-state pages for FIPE, auctions and fines, built from our own data; English and Spanish landing pages for expats and importers.
- **Report sharing**: a public, redacted version of the report the seller can hand to buyers.
- **Direct SERPRO accreditation** to reduce per-query cost and remove the intermediary.

## Later

- Motorcycle and truck specific reports (domains already reserved).
- Insurance and financing quotes inside the report, with partners.
- API for marketplaces and classifieds to embed the auction signal.
- Open data: publish aggregated, anonymized statistics about auctioned vehicles in Brazil.

## How we work

Everything goes through pull requests into `main`, which deploys to production automatically. Every deploy is followed by a synthetic checkout probe; a deploy without a green probe is not considered done. Incidents get a write-up in `docs/incidentes/`.

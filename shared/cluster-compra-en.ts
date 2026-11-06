import type { PaginaCompra } from './cluster-compra'

// English twins of the buying cluster pages (Nov 6, 2026). For now only
// /consulta-veicular-completa has one (shared/idiomas.ts). Same shape as the
// PT entry: shared/cluster-compra-en.test.ts checks every section, list item
// and FAQ has its English line. Copy rules: no em dash, no "free" in title or
// description, never the federal agency acronym.

const LEAD_COMPLETA_EN = 'The PlacaCompleta full report brings together, by license plate, what the official records and our auction database say about the vehicle, in up to 5 minutes.'

export const PAGINAS_COMPRA_EN: PaginaCompra[] = [
  {
    rota: '/consulta-veicular-completa',
    termo: 'Full vehicle history check',
    h1: 'Full vehicle history check in Brazil: what the report includes',
    title: 'Full Vehicle History Check: What the Report Includes',
    description: 'What a full vehicle check in Brazil covers: theft, liens, court blocks, auctions, recalls, fines and FIPE value. See what is in the report and what is not.',
    lead: 'A full vehicle check brings together, by license plate, the data in the national vehicle registry and the issues that decide a purchase: theft, liens, court blocks, auction records, recalls and traffic violations. It is the step between seeing the listing and booking the visit.',
    secoes: [
      {
        h2: 'What comes in the full report',
        lista: [
          'Data from the national vehicle registry: specs, full VIN and RENAVAM, registration status, city and state',
          'Theft indicator',
          'Liens and chattel mortgage (vehicle financing)',
          'RENAJUD and court, administrative and federal tax restrictions',
          'Traffic violations indicator (RENAINF) and, in 20 states, the unpaid violations straight from the state traffic department',
          'Open recalls',
          'Auction record on the vehicle title and auction history cross-checked with our database of more than 2 million auction records',
          'Notice of sale',
          'FIPE value with history, estimated insurance and 5-year cost of ownership',
          'Country of manufacture from the VIN',
        ],
      },
      {
        h2: 'What it does not include (and where to get it)',
        lista: [
          'A physical inspection: nobody looks at the car. We do not check paint, structure, welding, engine or the VIN etched on the chassis and windows.',
          'A pre-purchase inspection report with a technical pass or fail, which only an inspection company can do with the car in front of them.',
          'Real mileage or workshop maintenance history.',
          'A guarantee that an accident with no official record never happened.',
        ],
      },
      {
        h2: 'Basic or full check?',
        paragrafos: [
          'The basic check shows the vehicle record and confirms that the listing matches the car. The full check is the one that shows the issues that block a title transfer or bring the price down. If you are about to close a deal, the full check is the one that matters.',
          LEAD_COMPLETA_EN,
        ],
      },
    ],
    faq: [
      { pergunta: 'How long does the full check take?', resposta: 'It usually comes within 5 minutes after payment, on screen and by email if you give us one.' },
      { pergunta: 'Does the full check work for motorcycles and trucks?', resposta: 'Yes. The check is by license plate and works for cars, motorcycles, trucks and other vehicles registered in Brazil.' },
      { pergunta: 'Where does the data come from?', resposta: 'From the national vehicle registry, the state traffic departments and our own auction database, built from public auction notices and catalogs.' },
    ],
    datePublished: '2026-10-02',
  },
]

export const paginaCompraEn = (rota: string) => PAGINAS_COMPRA_EN.find((p) => p.rota === rota) || null

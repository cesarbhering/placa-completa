# GET /api/fipe/dados

Entrega ao app mobile os mesmos dados que as páginas `/tabela-fipe` do site usam,
para o app não depender só do retrato gerado no build dele (`npm run fipe-data`, no
repo do app).
O site serve o que já tem em `data/`; quem mapeia para os tipos do app é o app.

- Rota: `server/api/fipe/dados.get.ts`. Sem query, sem autenticação, sem gate.
- Consumidor: `placacompleta-app-ios`. O `FipeApi` busca na abertura (uma vez por
  dia), guarda no MMKV e usa o retrato do bundle como reserva; a tela nunca espera.

## Resposta 200

```json
{
  "versao": 1,
  "referencia": { "mes": 10, "ano": 2026 },
  "marcas": {},
  "precos": {},
  "intros": {},
  "seguro": {}
}
```

| Campo | De onde vem |
| --- | --- |
| `referencia` | Mês mais recente entre as entradas de `precos` (`referenceMonth`/`referenceYear` da primeira linha do `priceTable` de cada entrada; vale o maior ano/mês). É o mesmo mês que o app chama de `FIPE_SNAPSHOT_REFERENCE`. |
| `marcas` | `fipeBrands` de `data/fipe-brands.ts`, inteiro. |
| `precos` | `data/fipe-prices.json`, inteiro (`priceTable`, `historyChart`, `referenceLabel`...). Chaves `marca-modelo`. |
| `intros` | `modelSeoData` de `data/fipe-model-intros.ts`, inteiro. A chave é um slug de marca (`honda`, `honda-motos`, `suzuki-motos`) ou `marca-modelo`. |
| `seguro` | `data/seguro-modelos.json`, inteiro (regiões e faixa). Chaves `marca-modelo`. |

Nada é cortado nem resumido: o app recebe tudo que a página do modelo usa. O corpo
tem cerca de 190 KB sem compressão (~186 KB, medido em 04/nov/2026); a compressão
fica por conta do Cloudflare/Traefik.

## Cache

- `Cache-Control: public, max-age=86400` (um dia).
- `ETag` forte (sha1 do corpo serializado). Com `If-None-Match` igual, responde `304`
  sem corpo.
- Os dados são fixos por build: o corpo e o ETag são calculados uma vez, no
  carregamento do módulo. Quando `data/` muda (`scripts/fetch-fipe-prices.ts`,
  `scripts/compile-seguro-data.ts`), um novo deploy troca o corpo e o ETag muda sozinho.

## Rate limit

`server/middleware/rate-limit.ts`: 10 por minuto por IP. O app baixa uma vez por dia
e tem o retrato do bundle como reserva, então o teto cobre tentativas e barra
varredura. A chave é `/api/fipe/dados`, que não colide com `/api/fipe-prices`.

## Testes

`server/api/fipe/dados.test.ts`: versão e chaves, dados inteiros, `referencia`,
consistência das chaves com o catálogo de marcas, `Cache-Control`/`ETag`/`304` e o
teto do rate limit.

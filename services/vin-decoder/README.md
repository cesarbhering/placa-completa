# vin-decoder

Decodificador de VIN/chassi (ISO 3779), serviço interno na rede docker da VPS. Sem porta pública — só o Nuxt (`http://vin-decoder:3000`) fala com ele.

## Por quê

O relatório completo ganha um bloco "Origem do chassi" (fabricante, país, ano-modelo, planta quando conhecida), decodificado localmente a partir do chassi do veículo. Feature exclusiva da completa (decisão de produto).

## Como roda

```
npm install
npm run import:vpic          # popula a tabela wmi a partir da API pública do vPIC/NHTSA (demora — pagina milhares de fabricantes)
npm run import:overrides-br  # aplica nomes amigáveis + correções pros WMIs mais comuns no Brasil
npm start                    # sobe o Fastify na porta 3000
```

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /decode/:vin` → dados decodificados ou `422` com `{ valido: false, motivo }` se o VIN não tem o formato válido (17 chars, sem I/O/Q)

Resposta de sucesso:
```json
{
  "valido": true,
  "checksumOk": true,
  "wmi": "9BW",
  "fabricante": "Volkswagen do Brasil",
  "pais": "Brasil",
  "regiao": "América do Sul",
  "anoModelo": 2018,
  "planta": null,
  "vds": "ZZZ377J",
  "serial": "T004321"
}
```

`checksumOk` é **informativo, não bloqueante** — o check digit (posição 9) só é significativo pra VINs da América do Norte; chassi brasileiro "reprovar" no checksum é normal e não indica erro no chassi.

## Schema (SQLite, `better-sqlite3`)

- `wmi` — código (3 chars) → fabricante/país, importado do vPIC. Fonte da verdade primária.
- `wmi_overrides` — corrige/melhora entradas específicas sem tocar no dump importado (nomes amigáveis BR, país corrigido). Aplicado por cima do `wmi` na hora do decode. Re-rodar `import:vpic` não apaga overrides.
- `plants` — fabricante + posição 11 do VIN → planta. Começa vazia (vPIC não tem mapa confiável disso); povoada manualmente conforme confirmarmos casos reais.
- `year_codes` — posição 10 → ano-modelo (padrão ISO 3779, fixo, não depende de import).
- `decode_log` — todo decode processado (hash do VIN, não o VIN em si), pra curadoria de WMIs desconhecidos e pras métricas agregadas que sobem pro Supabase (só agregados, nunca decode individual).

## Escolha da fonte do seed (vPIC)

Avaliei 3 caminhos pra importar a base de WMI:

- **(a) API pública REST do vPIC** (escolhida) — `scripts/import-vpic.mjs`. Sem chave, dado já estruturado/normalizado pelo NHTSA, atualizável rodando o script de novo. Downside: mais lento (paginado), mas é um job raro, não é caminho quente.
- (b) Dump `.bak` SQL Server standalone — mais completo (inclui VDS patterns), mas exige converter formato proprietário só pra rodar um import único. Sem ganho real pro que precisamos agora (WMI → fabricante/país).
- (c) Mirrors de terceiros em CSV/SQLite — procedência/atualização incertas. Preferi a fonte primária.

## Anti-abuso / operação

- Sem porta pública, sem auth: a rede docker interna é o perímetro.
- Fail-open no lado do Nuxt: timeout curto (~500ms), se o serviço estiver fora o relatório sai sem o bloco de importação, nunca quebra a entrega.
- `decode_log` fica só local — o que sobe pro Supabase é agregado (contagens por dia/fabricante/país + WMIs desconhecidos mais frequentes), schema a alinhar com o @infra.

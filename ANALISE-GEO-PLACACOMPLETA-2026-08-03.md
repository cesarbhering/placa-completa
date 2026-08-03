# Auditoria SEO/GEO — PlacaCompleta — 03/ago/2026

Ciclo anterior: 26/jun/2026. Fontes: GSC (export 03/ago), GA4, Google Ads API,
DataForSEO, Supabase. Atrasada ~1 semana (o dia 26 não rodou).

## 1. Resumo executivo

O orgânico **cresce de forma composta e saudável**, mas continua **preso na
posição ~9** — o mesmo teto de 3 meses. O gargalo é confirmado: **autoridade
de domínio (backlinks)**, não conteúdo nem CTR. A grande novidade positiva:
as páginas que estavam "Rastreadas mas não indexadas" **pararam de crescer**
(94 vs ~95) e as **páginas de seguro já aparecem com impressões** — sinal de
que o Google começou a comê-las. A grande novidade de produto: o **funil de
seguro converte a ~3-4%** (13 leads), dentro do previsto.

## 2. Orgânico (GSC) — deltas vs ciclo anterior

| Mês | Cliques | Impressões | CTR | Posição méd. |
|---|---|---|---|---|
| Maio | 101 | 4.355 | 2,32% | ~10,4 |
| Junho | 206 (+104%) | 14.796 (+240%) | 1,39% | ~9,2 |
| **Julho** | **291 (+41%)** | **20.047 (+35%)** | **1,45%** | **~9,7** |

- **Cliques dobraram e depois +41%**: crescimento orgânico real e composto.
- **Impressões 6,7x desde abril** — o índice do Google está engolindo o site.
- **CTR 1,45% é saudável** dado o volume de impressões mal-posicionadas
  (posição ~9). Não é problema de título; é problema de posição.

**Top queries (cliques):** "placa completa" (55cl, #2, CTR 24,5% — marca
convertendo lindo), "consulta placa" (25cl, #9), "consultar placa" (23cl, #9),
"consultar placa de carro" (13cl, #8).

**Top páginas:** home (153cl, pos 4,9), consultar-placa/capital/cuiaba (45cl),
consultar-placa/parana (39cl), tabela-fipe-por-placa (38cl, pos 14). As pSEO
estaduais/capitais são o motor do long-tail.

## 3. Indexação — a pergunta que abriu o projeto

- **"Rastreadas mas não indexadas": 94** (vs ~95 em jun). **Parou de crescer** —
  o conteúdo único de seguro adicionado às páginas está segurando a sangria.
- **Páginas /seguro já têm impressões no GSC** (7 URLs, ex.: carro-eletrico/rj
  com 29 imp, /rs 10, hub 8) — foram rastreadas e indexadas em <2 semanas.
  **Zero páginas de seguro entre as não-indexadas.** Vitória: o formato novo
  entra no índice sem fricção.
- **Ressalva:** as páginas antigas de tabela-fipe (Compass, Duster, S10...)
  ainda estão na lista de não-indexadas com último rastreamento de jun/jul —
  o Google ainda não voltou nelas pós-enriquecimento. Precisam de novo
  "Solicitar indexação" no GSC pra forçar o recrawl.

## 4. Posições (DataForSEO, mobile BR nacional)

- "placa completa": **#1** (marca)
- "consulta placa", "consultar placa", "tabela fipe pela placa": **fora do
  top 100** no SERP nacional genérico.

**Discrepância GSC (pos ~9) vs DataForSEO (>100) — explicação:** o GSC mede a
experiência REAL dos usuários (mobile, geolocalizado, personalizado), onde
aparecemos na pág. 1 pra buscas locais. O DataForSEO mede o SERP nacional
"limpo", dominado por DETRANs estaduais (.gov.br ocupam #2-6 de "consulta
placa") + concorrentes antigos (consultadeplaca.net, buscasim). Ou seja:
**ganhamos tráfego no long-tail geo-localizado, mas não rankeamos as
head-keywords nacionais** — de novo, questão de autoridade.

## 5. Tráfego pago (Google Ads, 30d)

506 cliques | R$138 | 366 conversões | **custo/consulta R$0,38** (era R$0,64
no início — melhorou com a otimização). Segue 5x abaixo do critério de
escalar (<R$2). Máquina saudável.

## 6. Funil de seguro (produto novo)

- Consultas jul: 1.221 (recorde; +80% vs jun 678).
- **Leads de cotação: 13** (tabela cotacoes_seguro) desde 24/jul.
- Conversão modal→lead ~3-4% (proxy), **no meio da previsão (1-6%)**.
- Detalhe: consultas de agosto (159 em 3 dias) mantêm o ritmo de ~50/dia.

## 6b. Histórico de crescimento (todas as auditorias)

GSC em 90 dias acumulados (base comparável entre ciclos):

| Métrica | 22/abr (base) | 22/mai | 26/jun | 03/ago | Δ abr→ago |
|---|---|---|---|---|---|
| Cliques (GSC 90d) | 90 | 152 | 328 | **607** | **+574%** (6,7x) |
| Impressões (90d) | 14.828 | 17.353 | 24.164 | **40.385** | +172% |
| CTR médio | 0,61% | 0,88% | 1,36% | **1,50%** | +146% |
| Posição média | ~15 | 14,21 | 9,78 | **9,54** | subiu 5,5 pos. |
| Sessões GA4 (90d) | — | 1.662 | 2.710 | **4.690** | +182% (mai→ago) |

Ritmo de cliques entre ciclos: +69% → +116% → +85%. Composto e consistente.
(Nota: o ciclo de agosto tem ~1 semana a mais de dados que os anteriores pelo
atraso, então o +85% está levemente inflado.)

### Canais GA4 (05/mai–02/ago, 90d)

| Canal | Sessões | Engaj. | Tempo méd. |
|---|---|---|---|
| Organic Search | **1.579** | 78% | 43s |
| Direct | 1.194 | 66% | 25s |
| **AI Assistant** | **623** | **91%** | 45s |
| Paid Search | 453 | 82% | 42s |
| Unassigned (prob. IA) | 430 | 83% | 45s |
| Referral | 217 | 89% | 44s |
| Organic Video | 166 | 55% | 17s |
| Social | 20 | — | — |

**Três leituras:**
1. **Orgânico do Google multiplicou por ~9** (170 sessões em mai → 1.579).
   Virou nossa maior fonte identificável, confirmando o +574% de cliques do GSC.
2. **IA é o 3º canal e o mais engajado** — AI Assistant (623) + provável
   spillover em Unassigned (430) ≈ 1.000 sessões, 91% engajamento, 45s. E
   ANTES do destravamento dos crawlers na Cloudflare fazer efeito pleno.
   O llms.txt/GEO está pagando.
3. **Referral só 217 = a prova do gargalo de backlink.** É o canal que os
   links externos alimentam; está baixo porque temos quase nenhum. A rodada
   de agosto vira essa curva e, de tabela, destrava a posição orgânica.

## 7. Ações priorizadas (próximo ciclo)

1. **Backlinks é o gargalo nº1** — executar a rodada 2 do release de agosto
   (pool de 456 jornais já pronto, tiers A/B/C). Meta: 10-15 domínios de
   referência → destravar a posição ~9.
2. **Recrawl das tabela-fipe enriquecidas** — solicitar indexação no GSC das
   ~40 páginas de modelo que ganharam seção de seguro mas não foram
   revisitadas (Compass, Duster, S10, Territory, Oroch, ASX, i30, Cruze...).
3. **Página /estudos** (âncora de backlinks do release) — ainda a fazer.
4. **Não mexer no que funciona:** ads a R$0,38/consulta, escalar em degraus.
5. **GA4 Data API** — configurar pra trazer funil de seguro + orgânico ao
   report diário/auditoria automaticamente.

## Comparativo de metas (vs 26/jun)

| Métrica | Jun | Ago | Meta era |
|---|---|---|---|
| Cliques GSC/mês | 206 | 291 | crescer ✓ |
| CTR global | 1,39% | 1,45% | estável ✓ |
| Posição média | ~9,2 | ~9,7 | melhorar ✗ (gargalo backlink) |
| Não-indexadas | ~95 | 94 | reduzir ⚠ (estabilizou) |
| Leads de seguro | 0 | 13 | novo ✓ |
| Custo/consulta ads | R$0,64 | R$0,38 | reduzir ✓ |
| Sessões GA4 (90d) | 2.710 | 4.690 | crescer ✓ (+73%) |
| Sessões de IA (90d) | ~174 | ~1.000 | crescer ✓✓ |

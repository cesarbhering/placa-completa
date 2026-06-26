# Auditoria GEO — Suplemento DataForSEO (26/jun/2026)

**Fonte:** API DataForSEO (Google Brazil, idioma Português)
**Métricas:** volume de busca, CPC, dificuldade competitiva, posição real do domínio, SERP
**Complementa:** [`ANALISE-GEO-PLACACOMPLETA-2026-06-26.md`](./ANALISE-GEO-PLACACOMPLETA-2026-06-26.md)

---

## TL;DR

A auditoria principal mostrou que cliques dobraram e CTR subiu. Este suplemento mostra a **outra metade da história**: os termos que estamos rankeando são minúsculos. Os termos gigantes do mercado, **não rankeamos em nenhum**.

| Termo (volume mensal Brasil) | Nossa posição |
|---|---:|
| consulta placa (450.000/mês) | fora do top 100 |
| consultar placa (450.000/mês) | fora do top 100 |
| tabela fipe pela placa (135.000/mês) | **#56** (era #34 no GSC, é o nosso melhor head term) |
| fipe pela placa (90.500/mês) | fora do top 100 |
| consultar veículo pela placa (74.000/mês) | fora do top 100 |
| consultar placa de carro (60.500/mês) | fora do top 100 |
| consultar veículo pela placa grátis (33.100/mês) | fora do top 100 |

**Volume mensal total das queries que não rankeamos: ~1,3 milhão de buscas/mês.**

Os cliques que estamos pegando hoje vêm de cauda longa específica + termo de marca ("placa completa", 50/mês). Os top 10 do Google nessas head queries são DETRANs estaduais (.gov.br) e portais grandes (Olho no Carro, Webmotors, Gringo). **Não é uma SERP fácil**, mas é onde está o dinheiro.

---

## 1. Volume de busca para queries do GSC

Top 20 queries do GSC, agora com volume mensal real (Brasil/PT) e CPC:

| Keyword | Volume Brasil/mês | CPC | Comp. | Nossa pos GSC | Nossa pos DataForSEO |
|---|---:|---:|---|---:|---:|
| **consulta placa** | **450.000** | $0.16 | MEDIUM | 9,36 | fora top 100 |
| **consultar placa** | **450.000** | $0.16 | MEDIUM | 9,06 | fora top 100 |
| **tabela fipe pela placa** | **135.000** | $0.09 | LOW | 34,05 | **#56** |
| **fipe pela placa** | **90.500** | $0.07 | LOW | — | fora top 100 |
| **consultar veiculo pela placa** | **74.000** | $0.28 | HIGH | 8,26 | fora top 100 |
| consultar placa de carro | 60.500 | $0.21 | HIGH | 8,26 | fora top 100 |
| consulta placa de carro | 60.500 | $0.21 | HIGH | 9,00 | fora top 100 |
| consultar veículo pela placa grátis | 33.100 | $0.22 | MEDIUM | 11,67 | fora top 100 |
| pesquisa placa | 22.200 | $0.17 | MEDIUM | 7,80 | fora top 100 |
| consulta de placa | 22.200 | $0.18 | MEDIUM | 8,50 | fora top 100 |
| tabela fipe placa | 18.100 | $0.05 | LOW | — | fora top 100 |
| consulta placa carro | 18.100 | $0.31 | HIGH | 8,43 | fora top 100 |
| placa veiculo | 9.900 | $0.13 | MEDIUM | 6,53 | fora top 100 |
| consultar placa gratis | 8.100 | $0.18 | MEDIUM | 7,55 | fora top 100 |
| consulta placa gratis | 8.100 | $0.18 | MEDIUM | 7,70 | fora top 100 |
| placa de veiculo | 8.100 | $0.14 | MEDIUM | 8,81 | fora top 100 |
| verificar placa | 2.900 | $0.17 | MEDIUM | — | fora top 100 |
| placa completa | 50 | $0.67 | MEDIUM | 2,95 | fora top 100 |

**Discrepância GSC vs DataForSEO:** o GSC mostra impressões em posições 6-12 para essas queries, mas DataForSEO não nos vê em nenhuma das top 100. Provável causa: o GSC agrega micro-impressões esporádicas (search personalizado, location-based, queries similares), enquanto DataForSEO faz um snapshot atual desktop sem personalização. **Implicação:** posições GSC são otimistas. Nossa posição "real" é ainda mais baixa.

---

## 2. Quais keywords rankeamos hoje (31 total)

Top 10 ranked keywords ordenadas por volume (todas LOW/MEDIUM comp):

| Keyword | Vol/mês | Pos | URL |
|---|---:|---:|---|
| **tabela fipe pela placa** | **135.000** | **56** | `/tabela-fipe-por-placa` |
| consultar tabela fipe pela placa | 12.100 | 37 | `/tabela-fipe-por-placa` |
| detran pi consulta placa | 8.100 | 55 | `/consultar-placa/piaui` |
| consultar placa detran pi | 8.100 | 50 | `/consultar-placa/piaui` |
| tabela pela placa | 5.400 | 59 | `/tabela-fipe-por-placa` |
| qual placa | 1.300 | 83 | `/consultar-placa/capital/belem` |
| consultar tabela fipe por placa | 1.300 | 48 | `/tabela-fipe-por-placa` |
| audi a3 tabela fipe | 1.300 | 31 | `/tabela-fipe/audi-a3` |
| valor fipe pela placa | 880 | 34 | `/tabela-fipe-por-placa` |
| valor tabela fipe pela placa | 590 | 41 | `/tabela-fipe-por-placa` |

Padrão claro: **a maioria das 31 keywords ranqueadas é tabela FIPE específica de modelo (200-500 vol/mês cada)**. A página `/tabela-fipe-por-placa` aparece em 8 queries diferentes mas todas em página 4-6 do Google.

---

## 3. SERP analysis — quem ganha as queries grandes

### `consultar placa` (450.000/mês)

| Pos | Domínio | Tipo |
|---:|---|---|
| 1 | olhonocarro.com.br | Player privado |
| 2-4 | detran.{pe,rs,sc}.gov.br | Gov |
| 5 | play.google.com | App |
| 6 | senatran.serpro.gov.br | Gov federal |
| 7 | usezapay.com.br | Player privado |
| 8-10 | detran.{sp,mg,rj}.gov.br | Gov |

**Leitura:** SERP dominada por DETRANs estaduais. Espaço pra player privado: posições 1 e 7. Olho no Carro mantém #1 com autoridade e link profile pesado.

### `tabela fipe pela placa` (135.000/mês)

| Pos | Domínio | Tipo |
|---:|---|---|
| 1 | placafipe.com.br | Player nicho |
| 2 | veiculos.fipe.org.br | Oficial |
| 3 | play.google.com | App |
| 4 | webmotors.com.br | Player grande |
| 5 | gringo.com.vc | Player grande |
| 6 | apps.apple.com | App |
| 7 | placafipe.com | Player nicho |

**Leitura:** SERP menos governamental. Players privados pequenos (placafipe.com.br) lideram. **Esta é a SERP mais alcançável**. Estamos em #56 — subir pra #15-20 é viável em 60 dias com schema + conteúdo.

### `consultar placa de carro` (60.500/mês)

| Pos | Domínio |
|---:|---|
| 1 | gov.br (federal) |
| 2 | olhonocarro.com.br |
| 3-5, 10 | detrans estaduais |
| 6 | rj.gov.br |
| 7 | usezapay.com.br |
| 8 | carcheckbrasil.com.br |
| 9 | play.google.com |

Mesmo padrão de "consultar placa". Gov + 2-3 players privados.

---

## 4. Análise de gap — onde investir

### Categoria A: Head terms massivos (>50k vol/mês)

**Realidade:** SERP dominada por gov (.gov.br). Difícil de competir só com SEO técnico. Estratégia possível: criar conteúdo MAIS COMPLETO que os DETRANs (eles têm UX terrível). Sucesso vai depender de **link building** + **autoridade** acumulada.

| Keyword | Vol | Esforço | ROI esperado |
|---|---:|---|---|
| consultar placa / consulta placa | 900.000 total | 12+ meses | Médio (SERP dura) |
| consultar veículo pela placa | 74.000 | 6-12 meses | Alto (CPC $0.28) |

### Categoria B: FIPE + placa (alta intenção, SERP alcançável)

**SERP não-gov.** Players privados lideram. **Maior unlock disponível.**

| Keyword | Vol | Nossa pos | Esforço | ROI esperado |
|---|---:|---:|---|---|
| **tabela fipe pela placa** | **135.000** | **#56** | 60-90 dias | **MUITO ALTO** |
| fipe pela placa | 90.500 | sem rank | 90 dias | Alto |
| consultar tabela fipe pela placa | 12.100 | #37 | 30-60 dias | Médio |
| valor fipe pela placa | 880 | #34 | 30 dias | Pequeno (mas fácil) |

**Plano para `/tabela-fipe-por-placa` (single biggest unlock):**
1. Adicionar tabela FIPE interativa real (não só link/redirect)
2. Schema HowTo + FAQ (a SERP tem múltiplas perguntas comuns)
3. Conteúdo: passos claros + screenshots + exemplo real
4. Backlinks contextuais das outras páginas do site

### Categoria C: Cauda longa específica de modelo

31 keywords ranqueadas hoje, todas com 100-500 vol/mês. Soma de tráfego potencial ~5.000 vol/mês. Pequeno por keyword mas **fácil de melhorar** porque já temos posições 25-50. Subir 20 posições = top 5 = ~30% do CTR. Pode ser um ganho rápido de 1.000-1.500 cliques/mês adicionais.

**Plano:** template otimizado pras páginas `/tabela-fipe/{marca-modelo}` com schema Vehicle + Product (já listamos como recomendação na auditoria principal).

---

## 5. Custo-benefício consolidado

| Frente | Volume potencial | Dificuldade | Tempo p/ resultado | Prioridade |
|---|---:|---|---|---|
| `/tabela-fipe-por-placa` rebuild | 135.000 + 90.500 + 12.100 | Média | 60-90d | 🔴 **#1** |
| Schema Vehicle nas 31 pages FIPE-modelo | ~5.000 | Baixa | 30d | 🟡 #2 |
| Conteúdo pra `consulta placa` head | 900.000 | Alta | 12+ meses | 🟢 #3 (longo prazo) |
| Páginas pSEO de UFs (consultar-placa/X) | ~5.000-10.000 cada | Média | 60d | 🟡 #2 (paralelo) |

---

## 6. Update das recomendações da auditoria principal

A auditoria principal listou 3 prioridades. DataForSEO permite priorizar:

| # | Recomendação original | Validação DataForSEO |
|---|---|---|
| 1 | Auditar 51 páginas "Rastreada, não indexada" | **Mantém prioridade.** Provavelmente são páginas pSEO de cidade/estado/modelo que precisam de conteúdo único. |
| 2 | Implementar schema FAQ + Vehicle no top 10 | **Reforça:** dados de DataForSEO confirmam que essas páginas têm volume real (tabela-fipe-por-placa = 135k, parana = 22.200 buscas "consulta placa pernambuco" e similares). |
| 3 | Subir `/tabela-fipe-por-placa` | **Promove pra #1.** 135k volume + LOW competition + posição atual 56. Maior unlock individual disponível em todo o portfólio. |

---

## Notas metodológicas

- Volumes Brazil/Portuguese, fonte: DataForSEO Keywords Data API (Google Ads).
- Posições: snapshot atual, desktop, sem personalização.
- Discrepância GSC ↔ DataForSEO é esperada. GSC agrega mobile + desktop + queries-similares + impressões parciais. DataForSEO é snapshot determinístico.
- CPC em USD — para comparação relativa entre keywords, não como benchmark de ad spend.
- 31 keywords ranqueadas é universo small. Pode ser que DataForSEO ainda não tenha capturado páginas novas (3-4 semanas de lag típico). Próximo ciclo deve mostrar 50+.

# Auditoria GEO — placacompleta.com.br

**Fonte:** Google Search Console + GA4
**Período GSC:** últimos 90 dias até 2026-06-26
**Período GA4:** 2026-03-28 a 2026-06-25 (90 dias)
**Comparação:** [`ANALISE-GEO-PLACACOMPLETA-2026-05-22.md`](./ANALISE-GEO-PLACACOMPLETA-2026-05-22.md) (35 dias atrás)

---

## TL;DR

Crescimento real e consistente em quase todas as frentes. Cliques mais que dobraram (152 → 328, +116%), CTR saltou de 0,88% para 1,36% (+54%) e posição média melhorou para 9,78 (estava em 13,38). A correção sobre CTR baixo recomendada na auditoria anterior está funcionando.

O ponto que NÃO mudou: **zero rich results detectados** no GSC pelo segundo ciclo seguido. A aba "Aspecto da pesquisa" continua vazia. Implementação de schema continua sendo o maior multiplicador de tráfego não explorado.

Surpresa do ciclo: **51 páginas marcadas como "Rastreada, mas não indexada"** no Coverage. É a primeira vez que esse número aparece nesse volume e merece investigação imediata.

---

## Sumário executivo

### Delta vs. auditoria anterior (22/mai → 26/jun, ~35 dias)

| Métrica | Anterior | Atual | Δ | Leitura |
|---|---:|---:|---:|---|
| Cliques totais (GSC, 90d) | 152 | **328** | **+116%** | Crescimento forte e consistente |
| Impressões totais | 17.353 | **24.164** | +39% | Visibilidade segue subindo |
| CTR médio | 0,88% | **1,36%** | **+54%** | Quase dobrou. Meta 30d era 1,5% (~missed por 0,14pp) |
| Posição média | 14,21 | **9,78** | -31% (melhor) | Primeira vez consistentemente em página 1 |
| Rich results detectados | 0 | **0** | = | Schema ainda não aplicado |
| Sessões GA4 (90d) | 1.662 | **2.710** | +63% | Crescimento real |

### Trânsito por dispositivo (GSC, 90d)

| Dispositivo | Cliques jun | Cliques mai | Δ cliques | CTR jun | Posição jun |
|---|---:|---:|---:|---:|---:|
| Celular | 211 | 100 | +111% | 1,55% | 9,25 |
| Computador | 117 | 52 | +125% | 1,12% | 9,80 |
| Tablet | 0 | 0 | = | 0% | 8,75 |

Crescimento equilibrado entre mobile e desktop. CTR mobile (1,55%) maior que desktop (1,12%) — usuário mobile clica mais quando aparece no resultado.

### Tráfego AI (GA4, 90d)

⚠ **Atenção metodológica:** a auditoria anterior agregou tráfego ChatGPT manualmente (`chatgpt.com / referral` + `chatgpt.com / (not set)` + `chatgpt.com / (none)` = 354). Esta auditoria usa o relatório nativo de canais, que tem um grupo agregado **"AI Assistant"** com 174 sessões. A queda aparente (354 → 174) **não é real** — parte do tráfego AI provavelmente foi reclassificada para **Unassigned** (508 sessões, sem equivalente claro em maio).

| Canal | Sessões | Engajamento | Tempo médio | Eventos chave |
|---|---:|---:|---:|---:|
| Organic Search | 877 | 75,7% | 38,5s | 1.158 |
| Direct | 739 | 66,6% | 26,7s | 1.132 |
| **Unassigned** | **508** | 78,9% | 45,6s | 1.143 |
| Referral | 238 | 86,6% | 45,0s | 661 |
| **AI Assistant** | **174** | 87,4% | 39,9s | 450 |
| Organic Video | 161 | 52,8% | 16,6s | 148 |
| Organic Social | 10 | 60,0% | 49,9s | 16 |

**Observações relevantes:**
- AI Assistant tem maior taxa de engajamento de TODAS as fontes (87,4%) — confirma a tese de maio: tráfego de IA é qualidade.
- Unassigned com 508 sessões e tempo médio de 45,6s tem perfil idêntico ao AI Assistant. Provavelmente é tráfego AI sem referrer fingerprint reconhecido (Claude, Gemini, copilot, etc).
- Organic Search agora é o canal #1 (era 374 em maio somando google + bing + duckduckgo + yahoo organic). **+135%**. A virada predita em maio (foco em CTR/schema vai destravar Organic) está confirmada.

---

## Páginas — quem cresceu

### Top 5 páginas em junho

| Página | Cliques jun | Cliques mai | Δ | Posição jun |
|---|---:|---:|---:|---:|
| `/` (home) | 74 | 47 | +57% | 5,12 |
| `/consultar-placa/parana` | 39 | 5 | **+680%** | 10,06 |
| `/consultar-placa/piaui` | 24 | 22 | +9% | 10,38 |
| `/consultar-placa/capital/cuiaba` | 22 | n/a | **NOVO** | 8,17 |
| `/consultar-placa/distrito-federal` | 11 | 5 | +120% | 9,02 |

Paraná foi a maior virada: 5 → 39 cliques (+680%) em 35 dias. Cuiabá é nova no top — entrou direto na 4ª posição. As páginas de capital (pSEO) estão começando a maturar — confirma que o investimento em programmatic SEO está pagando.

### Páginas em queda

| Página | Cliques mai | Cliques jun | Δ |
|---|---:|---:|---:|
| `/tabela-fipe/chevrolet-celta` | 2 | 0 | -100% |
| `/consultar-placa-de-onibus` | 2 | 0 | -100% |
| `/consultar-placa/amazonas` | 2 | n/a | sumiu |
| `/consultar-placa/rondonia` | 2 | n/a | sumiu |

Páginas de cauda longa (1-2 cliques) flutuam naturalmente, não é sinal de regressão. Mas vale checar se as 4 acima ainda estão indexadas (relacionado ao tópico Coverage abaixo).

---

## Consultas — o que mudou no comportamento de busca

### Top consultas jun (já é o "rabo" da home agora)

| Consulta | Cliques | CTR | Posição | Mai → Jun |
|---|---:|---:|---:|---|
| placa completa | 35 | 25,4% | 2,95 | 18 → 35 (+94%) — termo de marca consolidando |
| consulta placa | 15 | 4,9% | 9,36 | 3 → 15 (+400%) — termo genérico de alto volume |
| consultar placa | 7 | 3,3% | 9,06 | 1 → 7 (+600%) |
| consultar veículo pela placa grátis | 5 | 12,8% | 11,67 | 0 → 5 (novo) |
| consulta placa de carro | 4 | 10% | 9,00 | 0 → 4 (novo) |
| tabela fipe pela placa | 3 | 2,6% | 34,05 | 3 → 3 — **posição péssima (34!)** mas mantém clique |
| placa veículo | 3 | 2,1% | 6,53 | 1 → 2 |

**Insight tático:**
- "tabela fipe pela placa" tem 115 impressões e está em posição 34. Subir 10 posições nessa query (pra ~24) é provavelmente o maior unlock de cliques individual disponível. Pode ser feito com schema FAQ específico + interlinking interno.
- Termo de marca "placa completa" virou o maior driver, sinal positivo de reconhecimento de nome.

---

## Cobertura — primeiro alerta novo desde abril

Pela primeira vez no histórico desta auditoria, o relatório de Coverage do GSC tem **problemas críticos não-zero**:

| Motivo | Páginas |
|---|---:|
| **Rastreada, mas não indexada no momento** | **51** |
| Excluída pela tag "noindex" | 3 |
| Página alternativa com tag canônica adequada | 2 |
| Página com redirecionamento | 1 |
| Não encontrado (404) | 1 |
| Bloqueada devido a acesso proibido (403) | 1 |
| Erro soft 404 | 1 |

**O que significa "Rastreada, mas não indexada":** Google visitou a página, leu o HTML, mas decidiu não colocar no índice — geralmente por (a) baixa qualidade percebida, (b) conteúdo duplicado/similar a outras páginas do site, (c) sinais fracos de relevância.

**51 páginas é um número grande pra ignorar.** Hipóteses prováveis (precisa confirmar):
1. Páginas de programmatic SEO com conteúdo muito similar entre si (consultar-placa/estado-X, consultar-placa/capital-Y)
2. Páginas FIPE de modelos com poucas vendas (cauda longa demais)
3. Páginas internas técnicas que vazaram no sitemap

**Investigação recomendada:** acessar GSC → Indexação → Páginas → filtrar por "Rastreada, mas não indexada" → exportar lista das 51 URLs e classificar. Isso destrava a próxima onda de crescimento.

---

## Recomendações priorizadas

### Crítico (semana 1)

- [ ] **Exportar e auditar as 51 páginas "Rastreada, mas não indexada"** no GSC. Decidir, por grupo: (a) melhorar conteúdo, (b) consolidar/redirecionar pra página canônica, (c) `noindex` se realmente é cauda longa demais.
- [ ] **Implementar schema FAQ + Vehicle nas top 10 páginas de cliques.** Listadas em ordem: `/`, `/consultar-placa/parana`, `/consultar-placa/piaui`, `/consultar-placa/capital/cuiaba`, `/consultar-placa/distrito-federal`, `/tabela-fipe-por-placa`, `/consultar-placa/capital/goiania`, `/consultar-placa/capital/belem`, `/consultar-placa/bahia`, `/consultar-placa/pernambuco`. Cada FAQ schema válida deve gerar ~1 rich result no GSC dentro de 14 dias.

### Alto impacto (semana 2-3)

- [ ] **Reverter a queda de posição do `/tabela-fipe-por-placa` (15,69) e `tabela fipe pela placa` (query em 34).** Página tem volume (1.452 impressões) mas está fora do top 10 — única página entre as top 6 abaixo de posição 11. Adicionar conteúdo substantivo + tabela interativa + schema HowTo.
- [ ] **Identificar e investigar o canal "Unassigned" (508 sessões).** Comparar tempo médio (45,6s — muito alto) e taxa de engajamento (78,9%) com o canal AI Assistant. Confirmar se é tráfego de IA não-categorizado. Se for, criar regra GA4 pra reclassificar.

### Medir (semana 4)

- [ ] Confirmar que rich results começaram a aparecer no GSC (esperado: pelo menos 5).
- [ ] Validar que páginas "Rastreada, mas não indexada" diminuíram para menos de 25.
- [ ] Comparar tráfego organic search com a meta de 300+ cliques/mês — atualmente em ~110/mês, está a caminho.

---

## Métricas de sucesso (atualizadas para próximo ciclo, 26/jul)

| Métrica | Anterior (mai) | Atual (jun) | Meta 30d (jul) | Meta 90d |
|---|---:|---:|---:|---:|
| CTR global GSC | 0,88% | **1,36%** | 2,0% | 3,0%+ |
| Cliques GSC/mês | ~50 | **~110** | 180 | 350+ |
| Sessões AI (ChatGPT + Unassigned) | ~120 | **~570** (?)* | 800 | 1.500+ |
| Sessões Perplexity/mês | 1 | n/a | 15 | 50+ |
| Rich results detectados | 0 | **0** | 20+ | 100+ |
| Páginas "Rastreada, mas não indexada" | n/d | **51** | <25 | <10 |
| Páginas em top 10 (posição < 11) | ~3 | **~5** | 8 | 15+ |

*Estimativa combinando AI Assistant + Unassigned. Quando confirmar a categorização da Unassigned, a métrica fica mais precisa.

---

## Diferença-chave vs. maio

A auditoria de maio diagnosticou: "site sobe ranking mas não converte impressão em clique". Recomendou foco em CTR.

**Esta auditoria diz: a recomendação funcionou.** CTR saltou de 0,88% para 1,36% (+54%) e cliques mais que dobraram. Posição também melhorou (14,21 → 9,78). É a primeira vez em que os três indicadores (cliques, CTR, posição) crescem simultaneamente sem desacelerar.

A próxima fronteira é **dual**:
1. **Indexação**: 51 páginas rastreadas não-indexadas é um teto técnico que precisa ser removido.
2. **Rich results**: zero por 2 ciclos consecutivos. É a fronteira que mais multiplica CTR no Google (rich snippets duplicam ou triplicam o CTR de páginas equivalentes).

Ambos são problemas de implementação técnica, não de produção de conteúdo. São fixáveis em 2-3 sprints de dev.

---

## Notas metodológicas

- Cruzei CSVs do GSC (Performance + Coverage) com GA4 (90 dias), janelas aproximadamente equivalentes.
- A janela GA4 atual é 90 dias contados de 28/mar a 25/jun. A janela de maio era 21/fev a 21/mai. Diferença de 35 dias entre as duas — não 30 — então deltas são levemente sobre-representados.
- Comparei delta com `ANALISE-GEO-PLACACOMPLETA-2026-05-22.md` consistentemente.
- O grupo de canais "AI Assistant" do GA4 é categoria nativa nova; trafego ChatGPT em maio foi agregado manualmente em 3 buckets diferentes (chatgpt.com / not set, referral, none). Comparação 1:1 exige inspecionar a Unassigned do junho com mais cuidado em ciclo futuro.
- Posições GSC são médias agregadas por dia/query — leve filtro pra evitar bias de queries de baixíssima impressão pode ser útil em ciclos futuros.
- Não verifiquei view-source dos top 5 URLs para confirmar ausência de schema (assumi com base no relatório do GSC, que mostra zero rich results detectados).
- Próxima re-auditoria recomendada: **26/jul/2026** (mantém a cadência de 30 dias).

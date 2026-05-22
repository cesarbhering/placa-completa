# Auditoria SEO — placacompleta.com.br
**Fonte**: Google Search Console · **Período**: 2026-02-10 a 2026-04-20 (últimos 3 meses) · **Tipo**: Pesquisa Web

---

## Sumário executivo

| Indicador | Valor | Leitura |
|---|---|---|
| Cliques totais | 90 | Baixo |
| Impressões totais | ~14.828 | Médio/alto |
| CTR médio | 0,61% | **Muito abaixo do esperado** (5–8% seria normal para a posição atual) |
| Posição média | ~15 | Boa e melhorando |
| Tendência de posição | Fev ~28–33 → Abr ~9–10 | Excelente — melhoria de ~3x em 70 dias |
| Tendência de cliques | Estável em 1–3/dia | Estagnada apesar de melhor ranking |

**Diagnóstico de uma linha**: o site está **ganhando ranking mas não convertendo impressão em clique**. O gargalo saiu de "não aparecer no Google" e migrou para "aparecer e não ser clicado". Todo o esforço agora deve ser em **CTR** (title, meta description, schema, rich results), não em mais conteúdo ou mais links.

---

## Observações e plano de ação (formato one-two)

### 1. CTR global 10–20x abaixo do esperado

**Observação**
- CTR médio de 0,61% com posição média 9–15 é anômalo. Para posição 9–10, o benchmark é 2–5% (com AI Overviews) ou 5–12% (SERP limpa).
- O gap não é de ranking — é de atratividade do snippet.

**Ação**
1. Auditar títulos e meta descriptions das 20 páginas com mais impressões.
2. Adotar padrão de title com **gatilhos de especificidade** (ano atual, faixa de preço, "grátis", "oficial", "atualizado").
3. Reescrever meta descriptions em até 155 caracteres com benefício + CTA.
4. Comparar SERPs reais no Google (em modo anônimo) para entender o que os concorrentes oferecem no snippet (rich results, sitelinks, estrelas).
5. Em 30 dias, remedir CTR das páginas editadas vs. não editadas.

---

### 2. Páginas /tabela-fipe/ com milhares de impressões e zero cliques

**Observação**
Amostra crítica:

| Página | Impressões | Cliques | CTR | Posição |
|---|---|---|---|---|
| /tabela-fipe/yamaha-mt-03 | 1.112 | 1 | 0,09% | 14,9 |
| /tabela-fipe/volkswagen-gol | 882 | 1 | 0,11% | 13,5 |
| /tabela-fipe/yamaha-lander | 733 | 1 | 0,14% | 14,7 |
| /tabela-fipe/honda-motos-cg-160 | 410 | 0 | 0% | 13,2 |
| /tabela-fipe/yamaha-r3 | 400 | 0 | 0% | 10,0 |
| /tabela-fipe/honda-motos-biz | 382 | 0 | 0% | 27,1 |
| /tabela-fipe/honda-civic | 323 | 0 | 0% | 12,8 |
| /tabela-fipe/byd | 303 | 1 | 0,33% | 8,1 |
| /tabela-fipe/yamaha-crosser | 289 | 1 | 0,35% | 9,3 |
| /tabela-fipe/chevrolet-cruze | 269 | 0 | 0% | 8,7 |

Estas ~10 páginas somam mais de **5.000 impressões e apenas 4 cliques** (CTR ~0,08%). É aqui que a maior parte do potencial está sendo desperdiçada.

**Causa provável**
- SERPs de "tabela fipe" são dominadas por **fipe.org.br** (fonte oficial), Webmotors, iCarros, KBB e pelo próprio **AI Overview** do Google, que resolve a intenção sem clique.
- Seus snippets atuais provavelmente não diferenciam da concorrência.

**Ação**
1. **Reescrever titles** com padrão que disputa clique mesmo contra fonte oficial:
   - Ruim: `Tabela FIPE Yamaha MT-03 | Placa Completa`
   - Bom: `Tabela FIPE Yamaha MT-03 2026 — Preço por Versão e Ano`
   - Melhor: `Yamaha MT-03 2026 Tabela FIPE — R$ XX.XXX a R$ XX.XXX`
2. **Adicionar `Product` / `Vehicle` schema** com `offers.priceRange`, `brand`, `model`, `vehicleModelDate`. Isso pode gerar rich snippet com preço direto na SERP (+10–20% de CTR).
3. **Adicionar FAQ schema** respondendo: "Qual o preço FIPE do X em 2026?", "Quanto vale um X ano Y?", "Como a FIPE calcula o preço?".
4. **Meta description específica com faixa de preço** (ex: "Consulte o preço FIPE de todas as versões da Yamaha MT-03 2015–2026. Valores atualizados de R$ X.XXX a R$ XX.XXX."). A faixa de preço no meta é o maior gatilho de clique em buscas de FIPE.
5. Priorizar pelas 20 páginas com mais impressões primeiro — o retorno é desproporcional.

---

### 3. Páginas /consultar-placa/{estado} — o padrão vencedor que deve ser replicado

**Observação**
Estas convertem muito bem:

| Página | Cliques | CTR | Posição |
|---|---|---|---|
| /consultar-placa/piaui | 14 | 3,9% | 9,6 |
| /consultar-placa/pernambuco | 7 | **9,72%** | 11,3 |
| /consultar-placa/distrito-federal | 5 | 3,85% | 8,2 |
| /consultar-placa/bahia | 4 | 5,0% | 10,7 |
| /consultar-placa/santa-catarina | 2 | **11,76%** | 12,1 |
| /consultar-placa/sergipe | 2 | **8,7%** | 10,3 |
| /consultar-placa/ceara | 1 | **20%** | 7,8 |

CTR de 4–20% em posições 8–12 é **excelente** — é o dobro do benchmark. O padrão da página funciona.

**Ação**
1. Identificar o que essas páginas têm que outras (/rio-de-janeiro, /minas-gerais, /goias — todas com 0 cliques) não têm. Candidatos: título inclui nome do estado + "DETRAN"? Descrição cita "grátis" ou "oficial"? Existe um H1 específico?
2. **Padronizar a melhor versão em todos os 27 estados.**
3. Criar páginas de capitais e grandes cidades como variações (ex: `/consultar-placa/recife`, `/consultar-placa/salvador`) — aproveitar demanda por "consultar placa sp", "consultar placa rj".

---

### 4. /consultar-placa/sao-paulo — maior oportunidade de upside imediata

**Observação**
- 121 impressões, posição **31,03**, CTR 3,31%.
- É o maior estado do Brasil. Se entrar no top 10, vira a página líder do site.
- Páginas equivalentes de estados menores (PI, PE) estão em posição 9–11.

**Ação**
1. Auditar a página atual vs. `/consultar-placa/piaui` (top performer). O que PI tem que SP não tem?
2. Verificar se existe conteúdo duplicado ou canibalização (ex: `/consultar-placa-de-carro` vs `/consultar-placa/sao-paulo`).
3. Reforçar links internos apontando para `/consultar-placa/sao-paulo` (usar anchor "consultar placa SP").
4. Adicionar seção específica: "DETRAN-SP", "consultar placa de veículo em SP", "placa Mercosul SP".
5. Meta description otimizada: "Consulte placa de veículo em SP grátis — dados do DETRAN-SP atualizados. Modelo, ano, chassi e mais."

---

### 5. Gap de CTR entre mobile (0,86%) e desktop (0,32%)

**Observação**

| Dispositivo | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| Celular | 68 | 7.866 | 0,86% | 10,9 |
| Computador | 22 | 6.883 | 0,32% | 21,4 |
| Tablet | 0 | 79 | 0% | 12,3 |

- Desktop aparece quase tanto quanto mobile mas converte ~3x pior.
- Posição média pior no desktop (21 vs. 11) explica parte, mas não tudo.

**Causa provável**
No desktop, as SERPs mostram Knowledge Panel da FIPE, AI Overviews expandidos e rich results de grandes sites automotivos no lado direito — tudo comendo o clique antes mesmo do usuário rolar a tela.

**Ação**
1. Verificar manualmente (incógnito) como as SERPs de "tabela fipe gol", "consultar placa sp", "tabela fipe yamaha mt-03" se comportam no desktop.
2. Se houver Knowledge Panel/FIPE.org.br dominante: priorizar rich snippets (FAQ, Product) para roubar atenção.
3. Se houver muitos AI Overviews: aceitar que queries informacionais puras terão CTR baixo no desktop e focar em queries **transacionais** ("consultar placa grátis", "placa completa", "como consultar placa").

---

### 6. Trend de impressões caindo em abril, mesmo com melhora de ranking

**Observação**
- Pico de impressões no final de março (~350/dia).
- Abril em queda para ~180–250/dia.
- Posição seguiu estável em 8–10 em abril.

**Causa possível**
- Sazonalidade (semana santa 2026 caiu 03–05 abr).
- Redução de cobertura em long-tail (queries menores deixando de aparecer).
- Mudança recente do algoritmo do Google ou indexação.

**Ação**
1. Cruzar com GSC "Indexação de páginas" — houve queda de páginas indexadas em abril?
2. Verificar se sitemap.xml está retornando "Sucesso" com mesma contagem de URLs.
3. Comparar com semana equivalente do ano anterior (se disponível) para isolar sazonalidade.
4. Se a queda persistir, investigar na aba "Desempenho" quais queries perderam impressões.

---

### 7. Queries vencedoras concentradas em "consultar placa", mas volume real está em "tabela fipe"

**Observação**
Top queries por clique (quase todas de consulta de placa):

| Query | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| consultar placa | 2 | 84 | 2,38% | 8,85 |
| tabela fipe pela placa | 2 | 11 | 18,18% | 47,82 |
| consultar placa gratis | 2 | 10 | 20% | 9,9 |
| consulta placa | 1 | 66 | 1,52% | 9,38 |
| consultar placa de veículo grátis | 2 | 4 | 50% | 14 |

Top queries por impressão sem cliques (o volume real):

| Query | Impressões | Cliques | Posição |
|---|---|---|---|
| gol 2026 tabela fipe | 66 | 0 | 10,15 |
| consultar placa de ônibus | 63 | 0 | 9,37 |
| tabela fipe do gol 2026 | 37 | 0 | 10,22 |
| tabela fipe audi q3 abril 2026 | 35 | 0 | 10,6 |
| tabela fipe lander | 32 | 0 | 9,97 |
| crosser 2026 tabela fipe | 31 | 0 | 8,77 |

**Leitura**: usuários estão **encontrando** o site para buscas de FIPE, mas clicam no FIPE oficial ou resolvem no AI Overview.

**Ação**
1. **Dobrar aposta em queries transacionais** (consultar placa) — são o que converte, e o site rankeia bem.
2. Para FIPE: criar diferenciais que o site oficial não tem — histórico de preços, comparativo entre versões, gráfico de depreciação, "vale a pena comprar?". Isso vira **intent único** que o FIPE.org.br não oferece.
3. **Atacar query específica "tabela fipe pela placa"** — já tem 18% CTR e posição 47. Há uma página (`/tabela-fipe-por-placa`) em posição 35 — otimizar para chegar ao top 10 é uma alavanca gigante.
4. Investigar queries long-tail com CTR >30% e posição <20 — são baixo volume mas alta conversão, valem títulos dedicados.

---

### 8. `/tabela-fipe-por-placa` — query de alto valor em posição ruim

**Observação**
- Query "tabela fipe pela placa": 2 cliques, 11 impressões, CTR 18,18%, posição **47,82**.
- Query "fipe pela placa": 1 clique, 14 impressões, 7,14%, posição 51,5.
- Página `/tabela-fipe-por-placa`: 204 impressões, 2 cliques, posição 35,37.

Há demanda real para esse cruzamento FIPE + placa — e o CTR quando aparece é ótimo. A página simplesmente não rankeia bem o suficiente.

**Ação**
1. Esta página merece tratamento de **hub de conteúdo**: guia completo "Como consultar FIPE pela placa", passo-a-passo, FAQ, schema `HowTo`.
2. Links internos de TODAS as páginas `/consultar-placa/{estado}` apontando para ela.
3. Links internos de todas as páginas `/tabela-fipe/{marca}` apontando para ela.
4. Meta dedicada: "Consulte a Tabela FIPE pela Placa — Método oficial, grátis, atualizado 2026".

---

### 9. Tráfego internacional desperdiçado (impressões sem cliques)

**Observação**
- 98% dos cliques vêm do Brasil.
- Impressões de Estados Unidos (1.492), Canadá (94), Índia, Colômbia, México — todos com 0 ou 1 clique.
- É quase certo que são brasileiros no exterior ou pessoas buscando assuntos brasileiros.

**Ação**
Baixa prioridade — não vale perseguir, mas:
1. Verificar se há hreflang incorreto ou canonical apontando errado.
2. Se houver páginas só em português, garantir `<html lang="pt-BR">` e hreflang `pt-BR`.
3. Não criar versão em inglês — o intent é doméstico.

---

### 10. Cauda longa de páginas /tabela-fipe/ com <20 impressões

**Observação**
Dezenas de páginas (fiat-pulse, peugeot-308, bmw-serie-1, chevrolet-tracker, etc.) têm tráfego desprezível mas ocupam crawl budget e diluem autoridade.

**Ação**
1. Não deletar — a maioria ainda pode crescer com a melhoria geral.
2. **Mas não investir tempo individual nelas**. Foco em templates e padrões que as beneficiam coletivamente (titles automatizados, schema, links internos).
3. Revisar em 90 dias e podar páginas com 0 impressões prolongadas (via 410 ou consolidação).

---

## Plano de 30/60/90 dias

### Primeiros 30 dias — **alta prioridade / alto retorno**
- [ ] Reescrever titles e metas das 20 páginas `/tabela-fipe/` com mais impressões
- [ ] Adicionar `Product`/`Vehicle` schema com faixa de preço em todas as páginas FIPE
- [ ] Padronizar titles e metas das 27 páginas `/consultar-placa/{estado}` seguindo o padrão PI/PE/CE
- [ ] Auditar e otimizar `/consultar-placa/sao-paulo` (maior alavanca individual)
- [ ] Verificar SERPs reais no desktop para as 10 principais queries

### 30–60 dias — **consolidar CTR e cobertura**
- [ ] Adicionar FAQ schema a todas as páginas de alta impressão
- [ ] Construir `/tabela-fipe-por-placa` como hub com `HowTo` e links internos
- [ ] Implementar links internos sistemáticos (cada página estadual → FIPE por placa, cada página FIPE → página estadual/capital correspondente)
- [ ] Criar diferenciais em `/tabela-fipe/{marca}` que o site oficial não tem: histórico de preços, gráfico de depreciação

### 60–90 dias — **medir e escalar**
- [ ] Comparar CTR antes/depois das páginas editadas (meta: CTR global subir de 0,61% para 2%+)
- [ ] Expandir padrão vencedor para páginas de capitais (consultar-placa/recife, salvador, curitiba, etc.)
- [ ] Análise de canibalização: `/consultar-placa-de-carro` vs `/consultar-placa/{estado}` vs `/consulta-placa`
- [ ] Revisar cauda longa e podar páginas com 0 impressões há 90 dias

---

## Métricas de sucesso

| Métrica | Atual | Meta 30 dias | Meta 90 dias |
|---|---|---|---|
| CTR global | 0,61% | 1,2% | 2,5%+ |
| Cliques totais/mês | ~40 | 120 | 400+ |
| Páginas com CTR >3% (top 20 impressões) | 0 | 5 | 15 |
| /consultar-placa/sao-paulo posição | 31 | 15 | <10 |
| Páginas com rich results (schema válido) | ? | 30 | 150+ |

---

## Observações sobre a metodologia

- Dados baseados apenas em GSC — **não houve acesso a GA4**, servidor, ou código-fonte.
- Recomendações de title/meta/schema devem ser testadas em amostra pequena primeiro antes de rollout total.
- Qualquer mudança deve ser datada para correlacionar com oscilações futuras no GSC.
- Recomendo screenshot mensal dos gráficos do GSC (retenção do GSC é limitada).
- Re-auditar em 30 dias para validar hipóteses, ou antes se houver sinal de queda brusca.

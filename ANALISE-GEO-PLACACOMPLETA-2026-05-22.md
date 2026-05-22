# Auditoria GEO — placacompleta.com.br
**Fonte**: Google Search Console + GA4 · **Período GSC**: 2026-02-20 a 2026-05-19 (~90 dias) · **Período GA4**: 2026-02-21 a 2026-05-21 (90 dias) · **Comparação**: ANALISE-SEO-PLACACOMPLETA.md (22/abr/2026)

---

## TL;DR — leitura de uma linha

**ChatGPT já manda mais tráfego para o seu site do que o Google orgânico** (354 vs 170 sessões em 90 dias). O motor de busca tradicional está estagnado em CTR baixo (0,88%) e seu maior risco agora não é "não ranquear" — é continuar invisível para LLMs que estão se tornando o ponto de partida da pesquisa.

---

## Sumário executivo

### Delta vs. auditoria anterior (22/abr → 22/mai, ~30 dias depois)

| Métrica | Anterior | Atual (90d) | Δ | Leitura |
|---|---|---|---|---|
| Cliques totais (GSC) | 90 | **152** | +69% | Crescimento real, mas baixa base |
| Impressões totais | 14.828 | **17.353** | +17% | Mais visibilidade |
| CTR médio | 0,61% | **0,88%** | +44% | Melhorou mas continua 5–10× abaixo do benchmark |
| Posição média | ~15 | **14,21** | +5% | Sutil |
| Rich results / Aparência | n/d | **0** | — | Aba "Aspecto da pesquisa" do GSC está **vazia**: zero schema válido |

### Descoberta nova e principal — tráfego de IA (GA4, 90d)

| Fonte | Sessões | Taxa de engajamento | Tempo médio | Leitura |
|---|---|---|---|---|
| (direct) / (none) | 580 | 67% | 27s | Maior parte deve ser PWA / digitação direta / IA sem referrer |
| **chatgpt.com (total)** | **354** | **~84%** | **44s** | **🔥 Sua maior fonte de tráfego identificável depois de direct** |
| bing / organic | 204 | 70% | 31s | |
| google / organic | 170 | 74% | 33s | **ChatGPT manda mais tráfego que Google orgânico** |
| youtube.com / referral | 140 | 56% | 18s | |
| br.search.yahoo.com | 76 | 63% | 35s | |
| google / cpc | 56 | 87% | 59s | Anúncios pagos performam bem |
| perplexity / (not set) | 3 | 100% | 47s | Migalha, mas existe |

**Implicação**: o GSC subestima drasticamente sua performance porque ele só conta o canal Google Search. Em 2026 o "search" se fragmentou — você está sendo descoberto via LLMs e o seu tracking precisa refletir isso.

---

## 1. ChatGPT é seu canal #2 — e ninguém estava medindo

**Observação**

- 354 sessões de ChatGPT em 90 dias (~4/dia). É **2× o Google orgânico** (170) e **1,7× o Bing orgânico** (204).
- Engajamento muito alto: **84% de taxa de engajamento, 44s de tempo médio**. Comparar com Bing (70%, 31s) ou Google (74%, 33s) — usuários vindos do ChatGPT são **os mais qualificados do site**.
- Perplexity aparece com 3 sessões (100% engajamento) — sinal de que outros LLMs também estão te citando, só que com volume menor.

**Por que isto está acontecendo**

ChatGPT (e Perplexity, Claude.ai, Gemini) faz duas coisas que beneficiam você:
1. Quando um usuário pergunta "como consultar placa de carro grátis no Brasil", o LLM pesquisa, pega os top resultados (você já está bem-rankeado), sintetiza e **inclui o link da fonte**.
2. O usuário que clica chega muito mais "pré-qualificado" — já leu uma descrição, sabe o que vai encontrar, vem com intenção clara.

**Ação — alta prioridade**

1. **Aumentar a discoverability para LLM crawlers**:
   - Confirmar que `robots.txt` não bloqueia: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `CCBot` (Common Crawl)
   - Criar `/llms.txt` na raiz com sumário do site, principais URLs e descrição (padrão emergente, já adotado por Anthropic, Vercel, Mintlify)
   - Adicionar `<meta name="robots" content="max-snippet:-1, max-image-preview:large">` para liberar trechos maiores na citação

2. **Otimizar conteúdo para citation-worthiness** (ver seção 5).

3. **Setar tracking dedicado**:
   - GA4 já capta `chatgpt.com / referral` — bom.
   - Adicionar evento custom `ai_referral` quando `document.referrer` casar com `chatgpt|perplexity|claude|gemini|copilot` para conseguir filtrar e atribuir conversões.
   - O bloco `(direct) / (none)` (580 sessões) provavelmente inclui muito tráfego de IA com referrer strippado — vale investigar a diferença entre direct + first-touch para entender o tamanho real.

---

## 2. Páginas /tabela-fipe/ — AI Overview confirmadamente comendo cliques

**Observação**

Comparativo direto com a auditoria anterior (deixei as duas linhas para destacar a evolução):

| Página | Impressões antes | Impressões agora | Cliques antes | Cliques agora | CTR agora |
|---|---:|---:|---:|---:|---:|
| /tabela-fipe/yamaha-mt-03 | 1.112 | **989** | 1 | **0** | **0%** |
| /tabela-fipe/yamaha-lander | 733 | **920** (+26%) | 1 | **1** | 0,11% |
| /tabela-fipe/volkswagen-gol | 882 | **711** | 1 | **1** | 0,14% |
| /tabela-fipe/yamaha-r3 | 400 | **637** (+59%) | 0 | **0** | 0% |
| /tabela-fipe/honda-civic | 323 | **411** | 0 | **0** | 0% |
| /tabela-fipe/chevrolet-cruze | 269 | **407** | 0 | **0** | 0% |
| /tabela-fipe/honda-motos-cg-160 | 410 | **398** | 0 | **0** | 0% |

**Diagnóstico**: as páginas estão sendo *mais* exibidas pelo Google (impressões subindo) mas o CTR é **zero**. Isso é a assinatura clássica de **AI Overview que responde a pergunta sem o usuário precisar clicar**. Em 30 dias, nenhuma dessas top páginas reverteu. As recomendações de schema da auditoria anterior **não foram aplicadas** (confirmado pela aba Aspecto da pesquisa estar vazia).

**Ação — alta prioridade**

Reordeno o que foi sugerido em abril com lente GEO:

1. **Schema `Vehicle` + `Product` com faixa de preço como dado citável** — isto serve dois propósitos: gera rich snippet no Google E vira fonte estruturada que LLMs preferem citar. LLMs priorizam dados estruturados ao decidir o que extrair.

2. **Adicionar `FAQPage` em todas as páginas FIPE** com perguntas no formato exato que o usuário faria a um chatbot:
   - "Qual o preço FIPE da Yamaha MT-03 2026?"
   - "Quanto custa um Yamaha MT-03 2024 na tabela FIPE?"
   - "A MT-03 está desvalorizando?"

3. **Resposta no formato self-contained** (ver seção 5) — uma frase com resposta completa logo após a pergunta. LLMs extraem o primeiro parágrafo após o H2/H3 quase sempre.

4. **Citar a fonte oficial (FIPE.org.br)** no corpo do texto explicitamente. Contraintuitivo, mas crítico: LLMs confiam em páginas que citam fontes primárias. Você ganha autoridade derivada.

---

## 3. Páginas /consultar-placa/{estado} — o padrão vencedor continua

**Observação**

| Página | Cliques (antes → agora) | CTR atual | Posição |
|---|---|---|---|
| /consultar-placa/piaui | 14 → **22** (+57%) | 3,65% | 10,42 |
| /consultar-placa/parana | n/d → 5 | 2,51% | 10,21 |
| /consultar-placa/distrito-federal | 5 → 5 | 2,67% | 8,3 |
| /consultar-placa/bahia | 4 → 5 | 4,46% | 10,4 |
| /consultar-placa/pernambuco | 7 → 4 | 2,25% | 8,3 |
| /consultar-placa/santa-catarina | 2 → 2 | 9,52% | 11,67 |
| /consultar-placa/acre | n/d → 2 | 11,11% | 8,89 |
| /consultar-placa/ceara | 1 → 2 | 4,88% | 7,95 |

A maioria dos estados está performando bem ou melhorou. **PI, AC, SC mostram CTR de 9–11%** — provam que o padrão funciona quando a SERP não é dominada por sites grandes.

Páginas zeradas (continuam): goias (38 impr, 0), minas-gerais (11, 0), maranhao (25, 0), tocantins, amapa, roraima, mato-grosso. Padrão: estados que disputam com sites de DETRAN próprios fortes.

**Ação**

Esta recomendação da auditoria anterior continua válida e **não foi cumprida**:
1. Auditar pagina-a-pagina e padronizar título/meta/H1 com a versão de PI (replicar literalmente, trocando só o estado).
2. Para estados zerados em SERPs dominadas: a única alavanca disponível é **schema + GEO** (citation pelos LLMs) — porque ranquear no top 5 contra DETRAN-MG é improvável.

---

## 4. Homepage virou estrela — protege e amplifica

**Observação**

A homepage `/` é hoje a página #1 do site em cliques: **47 cliques / 155 impressões / 30,32% CTR / posição 5,95**.

Na auditoria anterior, era a 2ª (12 cliques, 12% CTR, pos 7). Em 30 dias, **quase 4× mais cliques** e **CTR pulou de 12% para 30%**.

Query principal que traz: "placa completa" (brand, 24% CTR) e "consulta placa" (4,5%).

**Ação**

1. **Não mexer no que está funcionando** — qualquer redesign precisa ser A/B testado.
2. Aproveitar o tráfego de marca para empurrar usuários para `/consultar-placa/{estado_do_usuario}` (já tem o geo do IP que falamos antes — bom uso). Garantir que esse link seja crawlable (rendering SSR, não só JS).
3. Adicionar `WebSite` + `SearchAction` schema na home (potential search action) — facilita o sitelinks searchbox no Google.
4. Considerar `Organization` schema com `sameAs` apontando para perfis de IA (se você tiver perfil verificado no Bing IndexNow, OpenAI plugin diretório, etc.) — sinaliza identidade para LLMs.

---

## 5. Patterns de conteúdo GEO — o que aplicar nas páginas

Adaptado das melhores práticas para Generative Engine Optimization. Aplica em ordem de impacto:

### Pattern 1 — Self-Contained Answer (alto impacto)

LLMs extraem o **primeiro parágrafo após um H2/H3 como resposta completa**. Cada pergunta importante deve ter resposta auto-suficiente logo abaixo.

**Ruim** (genérico, não citável):
```
## Como funciona a consulta de placa?
Você pode consultar sua placa de várias formas. Cada estado tem
suas particularidades. Continue lendo para saber mais.
```

**Bom** (auto-suficiente, citável):
```
## Como funciona a consulta de placa no Brasil?

A consulta de placa veicular no Brasil retorna dados públicos
mantidos pelo DETRAN de cada estado: marca, modelo, ano, cor,
município de registro e situação do veículo. A consulta é gratuita
em sites credenciados como o PlacaCompleta, e leva menos de 10
segundos. Dados restritos (CPF do proprietário, histórico de multas)
exigem autenticação no Gov.br.
```

A segunda versão pode ser citada literalmente por ChatGPT/Perplexity sem precisar do contexto da página inteira.

### Pattern 2 — Statistic Citation (médio-alto)

LLMs preferem páginas com números específicos atribuídos a fontes. Adicionar estatísticas em FAQ e introdução:

```
Mais de 47 milhões de carros estão licenciados no Brasil (DENATRAN, 2025).
A consulta de dados do veículo pela placa é gratuita e está prevista na
Lei 9.503/97 (Código de Trânsito Brasileiro), Art. 257.
```

### Pattern 3 — FAQ Block com schema

Toda página `/tabela-fipe/{modelo}` e `/consultar-placa/{estado}` precisa de um bloco FAQ no final, com `<script type="application/ld+json">` válido.

Já está no plano de 30 dias da auditoria anterior — **continua não feito** (Aspecto da pesquisa vazio confirma).

### Pattern 4 — Step-by-Step com `HowTo` schema

Para `/como-consultar-placa` e `/tabela-fipe-por-placa`:

```
## Como consultar a tabela FIPE pela placa do veículo

1. **Digite a placa** no formato Mercosul ou antigo no campo de busca.
2. **Confirme o e-mail** para receber o resultado.
3. **Receba os dados FIPE** em até 30 segundos.
```

Com `HowTo` schema, isso vira passo-a-passo visual no Google e fragmento citável em IA.

### Pattern 5 — Definition Block para queries informacionais

```
## O que é a Tabela FIPE?

A Tabela FIPE é o índice oficial de preços médios de veículos
no Brasil, publicado mensalmente pela Fundação Instituto de Pesquisas
Econômicas. Serve de referência para compra/venda de veículos,
seguros, IPVA e financiamentos. É consultada gratuitamente em
fipe.org.br ou via APIs licenciadas como a usada pelo PlacaCompleta.
```

---

## 6. Volatilidade da semana de 9–15/mai — investigar

**Observação**

```
2026-05-08   6 cliques  ( 3,95% CTR)
2026-05-09  23 cliques  (17,04% CTR) ← spike
2026-05-10   5 cliques  ( 7,14% CTR)
2026-05-13  10 cliques  ( 6,41% CTR)
2026-05-14   2 cliques
2026-05-16   1 clique   (pos média caiu de ~10 para 25,8) ← perda
2026-05-17–19  baseline normal volta
```

Três interpretações possíveis (não excludentes):
- **Atualização do core do Google em maio** mexeu temporariamente em ranqueamento — a queda repentina de posição em 16/05 é um indício.
- **Um evento externo** (notícia sobre placa Mercosul, mudança em FIPE) gerou query temporária com seu site ranqueando inesperadamente bem.
- **Teste de UI da Google** (mostrando vs. escondendo AI Overviews para um % de usuários) — explica spike de CTR sem mudança no seu lado.

**Ação**
- Cruzar com `https://status.search.google.com/` e [Search Engine Roundtable](https://www.seroundtable.com) para ver se houve update conhecido.
- Olhar GSC > Páginas e Consultas com filtro de data 08–15/mai isolado, comparar com o resto do mês.
- Se foi tendência: aproveitar para entender o que funcionou e replicar.

---

## 7. Gap mobile vs desktop continua (mas melhorou)

| Dispositivo | Antes (CTR) | Agora (CTR) | Posição |
|---|---:|---:|---:|
| Celular | 0,86% | **1,06%** | 10,33 |
| Computador | 0,32% | **0,66%** | 18,1 |
| Tablet | 0% | 0% | 11,23 |

**Leitura**: ambos melhoraram, mas desktop continua **~40% pior** que mobile. Isto é consistente com AI Overviews aparecendo mais no desktop (onde tem mais espaço) e roubando clique antes do usuário rolar.

Não tem fix técnico — é estrutural da SERP atual. Aceitar e priorizar mobile no design.

---

## 8. Aparência na pesquisa **VAZIA** — alarme

Esta aba do GSC está literalmente em branco (sem dados). Significa que o Google **não detectou nenhum rich result, FAQ schema, breadcrumb, ou AI Overview citation** do seu site em 90 dias.

Isto é o resultado mais acionável da auditoria toda: **schema markup não está sendo aplicado ou está inválido**.

**Ação**
1. Testar páginas em https://search.google.com/test/rich-results para 5 páginas-amostra.
2. Se schema existe mas é inválido, corrigir e reenviar via "Validar correção" no GSC.
3. Se não existe, implementar (esta é a única recomendação de abril que se for aplicada terá impacto direto e mensurável).

---

## 9. Tráfego internacional — mesma observação

Anomalia notável: **Estados Unidos com 1.828 impressões e 3 cliques (CTR 0,16%)** — 12% das suas impressões totais. Quase certo que são bots de IA crawleando ou brasileiros no exterior.

Continua sendo baixa prioridade.

---

## 10. Cauda longa — investigar `/consultar-placa/piaui`

Curiosidade não explicada da auditoria anterior continua: **PI tem 22 cliques** (3,65% CTR, 602 impressões). É o estado com 8ª maior frota do Nordeste, mas o que ranqueia melhor no seu site.

Hipótese: você indexou primeiro PI e construiu links internos sem perceber, **ou** SERP de PI tem menos competição forte do DETRAN local.

**Ação**: rodar uma pesquisa em modo anônimo de "consultar placa piauí" vs "consultar placa minas gerais" vs "consultar placa goiás" — você vai ver com seus olhos por que PI ganha e MG/GO perdem.

---

## Plano de 30 dias — versão GEO

Reordeno o backlog colocando o que tem **maior impacto na era de IA-search**:

### Crítico (semana 1)
- [ ] **Verificar/abrir robots.txt para crawlers de IA** (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended, CCBot)
- [ ] **Criar `/llms.txt`** na raiz com índice do site, principais áreas e descrição
- [ ] **Validar por que Aspecto da pesquisa está vazio** — testar 5 URLs em Rich Results Test

### Alto impacto (semana 2–3)
- [ ] Aplicar **FAQPage schema + JSON-LD** em todas as 27 páginas de estado e 20 top páginas FIPE
- [ ] Reescrever H2 + 1º parágrafo de top páginas FIPE em formato **Self-Contained Answer**
- [ ] Adicionar **Vehicle/Product schema** com faixa de preço nas top 30 páginas FIPE
- [ ] Adicionar **HowTo schema** em /como-consultar-placa e /tabela-fipe-por-placa
- [ ] Citar **fontes primárias** (DETRAN-X, FIPE.org.br, Lei 9.503/97) explicitamente no corpo do texto

### Medir (semana 4)
- [ ] Configurar evento custom GA4 `ai_referral` (regex em document.referrer)
- [ ] Re-exportar Aspecto da pesquisa — verificar se algum rich result foi detectado
- [ ] Comparar tráfego ChatGPT antes/depois (esperar +30% com llms.txt + schema bem feito)

---

## Métricas de sucesso atualizadas

| Métrica | Atual | Meta 30d | Meta 90d |
|---|---:|---:|---:|
| CTR global GSC | 0,88% | 1,5% | 2,5%+ |
| Cliques GSC/mês | ~50 | 120 | 300+ |
| Sessões ChatGPT/mês | ~120 | 200 | 400+ |
| Sessões Perplexity/mês | 1 | 10 | 30+ |
| Rich results detectados (Aspecto da pesquisa) | **0** | **20+** | 100+ |
| Páginas com FAQ schema válido | ? (provavelmente 0) | 30 | 150+ |
| Páginas com Vehicle/Product schema válido | ? | 20 | 100+ |

---

## Diferença-chave vs. abril

A auditoria de abril identificou "site sobe ranking mas não converte impressão em clique". A leitura era: foco em title/meta/schema para melhorar CTR no Google.

**Esta auditoria diz: continue fazendo isso, mas a métrica que importa mudou.** O Google tradicional está saturado pelo AI Overview na sua categoria (consulta veicular / FIPE). Mais ganho de CTR no Google é provável que seja marginal — você já está em posição 9–10 nas queries que importam.

O *unfair advantage* agora é estar bem-indexado e bem-formatado para **LLMs**, que já estão mandando mais tráfego que o Google orgânico e com qualidade superior. É menos esforço (LLMs preferem conteúdo bem-estruturado, que é o que schema/FAQ produzem mesmo) e o ROI é maior.

---

## Notas metodológicas

- Cruzei dados de GSC (3 meses) com GA4 (3 meses), mesma janela aproximada.
- Comparei delta com `ANALISE-SEO-PLACACOMPLETA.md` de 22/abr para isolar o que mudou em 30 dias.
- A aba "Aspecto da pesquisa" do GSC veio vazia — usei como sinal de "schema não aplicado".
- Não verifiquei o código-fonte HTML das páginas — recomendo `view-source:` em algumas top URLs para confirmar.
- "ChatGPT / (not set)" e "ChatGPT / referral" tratei como mesma fonte (provavelmente diferença de session vs hit attribution no GA4).
- Re-auditar em 30 dias após implementação para validar se as métricas de IA mudaram.

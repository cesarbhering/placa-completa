# Plano SEO + Ads · PlacaCompleta

Documento interno (atrás de senha). Estratégia candida, dados reais. Data: 18/ago/2026.
Fonte dos números: DataForSEO (Google Ads search volume + DataForSEO Labs, BR/pt-BR) e SERP ao vivo. Google Ads Keyword Planner ficou indisponível (token OAuth expirado, ver Apêndice). Os CPC/bids abaixo vêm do Google Ads via DataForSEO, ou seja, são os mesmos dados de leilão que o Planner usaria.

---

## 1. Sumário executivo

A tese é uma escadinha: capturar tráfego orgânico barato de topo (consulta grátis, tabela FIPE) e funilar para o **relatório completo pago (R$ 45 Pix)**. Hoje a escadinha tem um degrau só de verdade: quase todo o nosso footprint orgânico é `tabela-fipe`, e ele rankeia mal (150 keywords indexadas, **só 1 no top 10**, a maioria entre a posição 15 e 59). Ou seja, temos páginas, mas não temos posição, e as páginas que temos são de baixa intenção de compra.

A oportunidade real não está no topo amplo (`consulta placa` = 450.000/mês, `tabela fipe` = 1.830.000/mês, mas CPC de R$ 0,14 a R$ 0,17 e intenção de vitrine). Está nos **clusters de compra iminente**: quem está prestes a fechar um usado e digita "laudo cautelar" (18.100/mês, CPC R$ 1,23), "vistoria veicular" (27.100/mês), "consultar débitos do veículo" (22.200/mês), "consulta veicular completa" (1.900/mês, CPC R$ 1,74, competição HIGH), "consultar gravame" (4.400/mês), "consulta veículo roubado pela placa" (2.400/mês). Esses são os termos onde o CPC alto denuncia dinheiro na mesa: o anunciante só paga R$ 1,74 num clique porque ele converte em venda.

Plano: (1) construir um **hub de intenção pré-compra** com páginas dedicadas a gravame, leilão, restrição, débitos, roubo, laudo cautelar e histórico, cada uma funilando para a landing paga; (2) consertar o SEO on-page do cluster tabela-fipe que já existe mas não rankeia; (3) ligar **Google Ads de alta intenção** no dia em que o pago entrar no ar, focado nos termos de compra iminente, com negativação agressiva dos termos "grátis"/informativos. CPC estimado dos termos-dinheiro: R$ 0,50 a R$ 1,75. Com ticket de R$ 45 e conversão landing de 3 a 6%, o CPA-alvo cabe folgado (detalhe na seção 5).

---

## 2. Onde estamos (dados reais)

### Footprint orgânico (DataForSEO Labs, placacompleta.com.br)
- **150 keywords rankeadas** capturadas (top 250 por volume).
- **1 keyword no top 10**, **0 no top 3**. A grande maioria está na posição 15 a 59 (página 2 a 6 do Google): tráfego residual.
- ETV somado (tráfego orgânico estimado) das 150 keywords: **~592 visitas/mês**. Pouco, e concentrado.
- **Concentração perigosa**: praticamente todo o footprint é `tabela-fipe`. As páginas que mais puxam keyword:

| Página | # keywords | ETV (visitas/mês) |
|---|---|---|
| `/tabela-fipe-por-placa` | 14 | 333 |
| `/tabela-fipe/yamaha-mt-03` | 22 | 131 |
| `/tabela-fipe/honda-civic` | 24 | 21 |
| `/tabela-fipe/volkswagen-nivus` | 16 | 16 |
| `/tabela-fipe/volkswagen-t-cross` | 12 | 9 |

- Termo de maior volume que "rankeamos": `tabela fipe pela placa` (135.000/mês) mas na **posição 56**. Não traz tráfego nenhum. É potencial, não resultado.
- **Leitura**: temos um ativo (189 páginas FIPE + estados + seguro elétrico + IBV) que o Google indexou mas não premiou. E o ativo é de baixa intenção de compra. Não há hoje nenhuma página nossa rankeando para os termos de compra iminente (gravame, leilão, cautelar, débitos).

### GA4
G-24H7QSPX4G está instalado, mas sem API programática garantida neste ambiente. Não puxei sessão/conversão do GA4 aqui. Recomendação de tracking na seção 7.

### agent_queries (endpoint /llms, tese reverse-mullet)
- Últimos 90 dias: **7 consultas de agentes**, 71% com match de dado (5 de 7), 0 user-agents de IA identificáveis (GPTBot, ClaudeBot, PerplexityBot etc.).
- Intents: `sobre` (2), `seguro_estado` (2), `fipe` (1), `seguro_modelo` (1), `ibv` (1).
- **Leitura**: canal nascente. Vale manter instrumentado, mas não é alavanca de receita agora. Não priorizar.

---

## 3. A escadinha (cluster por cluster: como captura e como funila pro pago)

Legenda de intenção: 🟢 compra iminente (casa com o pago) · 🟡 comercial-morno · ⚪ isca/topo (grátis, alto volume, baixa intenção).

| Cluster (páginas existentes) | Intenção | Como captura | Como deve funilar pro R$ 45 |
|---|---|---|---|
| **Home grátis** (`index.vue`) | ⚪→🟢 | Tráfego direto + "consulta grátis" | Ação primária JÁ é iniciar o relatório completo. Manter. Bloco de upsell logo abaixo do resultado grátis: "Isso diz o que é o carro. Quer saber se dá pra confiar nele? Veja restrição, gravame, leilão e dívida." CTA R$ 45. |
| **tabela-fipe/[slug]** (~189 pág.) | ⚪ | Vitrine: preço/modelo | Bloco fixo pós-tabela: "Vai comprar esse [modelo]? Antes de fechar, cheque se tem dívida, gravame ou passou por leilão." Link para a página de intenção + landing paga. É onde o comprador de usado JÁ está pesquisando preço. |
| **tabela-fipe-por-placa** (top ETV) | 🟡 | Cruza FIPE + placa | Já é meio-caminho para "consulta pela placa". Adicionar upsell direto: da placa digitada, oferecer o relatório completo daquele veículo. |
| **consultar-placa/[estado]** + capitais | 🟡 | "consulta placa [estado]" | O usuário de estado quer situação/débito local. CTA para relatório completo daquele veículo. Internal link para o hub de intenção (débitos, restrição). |
| **seguro/carro-eletrico/[estado]** | ⚪ | Nicho seguro elétrico | Baixa relação com compra de usado. Manter como topo/branding, upsell leve. Não investir mais aqui. |
| **ibv/[slug]** (15 posts) | 🟡 | Conteúdo educativo (o que é gravame etc.) | Melhor canal para **educar e converter**: cada post que explica um risco (gravame, RENAJUD, leilão) deve terminar com CTA "Cheque o seu carro agora" para a landing paga. Internal-link hub. |
| **premium/[token]** e `premium/index` | 🟢 | Landing/entrega do pago | É o destino. Ver on-page na seção 4. |

Princípio de linkagem interna: **toda página de topo (FIPE, estado) aponta para a página de intenção correspondente**, e toda página de intenção aponta para a **landing paga**. A escadinha só funciona se o link existir e o CTA falar a língua do medo do comprador ("não compre problema escondido").

---

## 4. Oportunidades de SEO (priorizadas por intenção de compra)

Ranqueadas por **intenção comercial** (CPC alto/competição alta = dinheiro), não por volume bruto. Todos os números são reais (DataForSEO / Google Ads BR).

### 4.1 Clusters de compra iminente 🟢 — CRIAR páginas/hub dedicado

| Cluster / página nova | Keyword-âncora | Volume/mês | CPC (R$) | Comp. | Prioridade |
|---|---|---|---|---|---|
| **Laudo cautelar / vistoria** | laudo cautelar | 18.100 | 1,23 | MEDIUM | P0 |
| | vistoria veicular | 27.100 | 0,61 | MEDIUM | P0 |
| | vistoria veicular para transferência | 1.300 | 0,88 | MEDIUM | P1 |
| **Débitos do veículo** | consultar débitos do veículo | 22.200 | 0,48 | MEDIUM | P0 |
| | consultar débito de veículo pela placa | 4.400 | 0,37 | MEDIUM | P1 |
| **Consulta veicular completa** (landing pilar) | consulta veicular completa | 1.900 | 1,74 | HIGH | P0 |
| **Gravame / financiamento** | consultar gravame | 4.400 | 0,68 | MEDIUM | P0 |
| **Restrição** | consultar restrição veículo | 2.400 | 0,66–0,70 | MEDIUM | P1 |
| **Veículo roubado** | consulta veículo roubado pela placa | 2.400 | 0,14 | LOW | P1 |
| | consultar veículo roubado | 1.000 | 0,12 | LOW | P2 |
| **Multas** | consultar multas veículo | 9.900 | 0,32 | LOW-MED | P1 |
| | consultar multas por placa | 880 | 0,27 | MEDIUM | P2 |
| **Chassi / decodificador** | consultar chassi | 9.900 | 0,42 | LOW | P1 |
| | decodificador de chassi | 210 | 0,44 | — | P2 (gap concorrente) |
| **Leilão** | consulta leilão veículo | 720 | 1,88 | — | P1 (CPC altíssimo = intenção pura) |
| | comprar carro de leilão vale a pena | 210 | 0,58 | — | P2 |
| **Situação do veículo** | situação do veículo | 12.100 | 0,36 | LOW | P1 |
| | consultar situação do veículo mg | 22.200 | 0,57 | LOW | P1 |

Observação de leilão: `consulta leilão veículo` tem só 720/mês mas CPC de **R$ 1,88**, o mais alto do conjunto. É o comprador com medo máximo de herdar um carro de leilão. Página dedicada + Ads valem mesmo com volume baixo.

### 4.2 Termos-âncora "consulta pela placa" 🟡 (alto volume, intenção mista) — melhorar on-page do que já existe
Estes têm volume gigante e servem de ponte grátis→pago. Não são a prioridade nº1 de conversão, mas são a maior fonte de tráfego qualificável:

| Keyword | Volume | CPC | Nota |
|---|---|---|---|
| consulta renavam | 74.000 | 0,40 | criar/otimizar página renavam |
| consultar placa de veículo | 60.500 | 0,24 | reforçar home/consultar-placa |
| consultar veículo pela placa grátis | 33.100 | 0,23 | ⚪ isca, converter no upsell |
| consultar situação do veículo mg | 22.200 | 0,57 | 🟡 estado, alta intenção local |
| consulta histórico veículo grátis | 3.600 | 0,31 | ⚪→🟢 ponte perfeita p/ pago |

### 4.3 Isca / topo ⚪ (mencionar, NÃO priorizar conversão)
`consulta placa` 450.000 · `tabela fipe` 1.830.000 · `tabela fipe por placa` 14.800 · `consultar placa grátis` 8.100. CPC R$ 0,05–0,21. Servem de aquisição barata de tráfego e alimentam o topo da escadinha. Estratégia aqui é **melhorar posição das páginas que já temos** (rankeamos `tabela fipe pela placa` na posição 56 para 135.000 buscas: subir isso para a página 1 é o maior ganho isolado de tráfego). Não gastar Ads aqui.

### 4.4 Gap vs. concorrente (olhonocarro.com.br)
A API de domain_intersection falhou (erro de schema no cliente, ver Apêndice), então comparei os dois conjuntos de ranked keywords manualmente. O concorrente tem **248 das 250 keywords amostradas no top 10** (contra 1 nosso). Termos de intenção onde ele rankeia e nós não aparecemos:

| Keyword (gap) | Volume | CPC | Rank concorrente |
|---|---|---|---|
| consulta leilão veículo | 720 | 1,88 | 2 |
| como saber se a moto é de leilão | 260 | 0,42 | 4 |
| como saber se o chassi foi remarcado | 210 | 0,95 | 3 |
| decodificador de chassi | 210 | 0,44 | 2 |
| tipos de sinistro | 170 | 0,32 | 3 |
| como descobrir o chassi pela placa | 140 | 0,33 | 3 |

O concorrente domina o long-tail informacional de risco (chassi remarcado, sinistro, moto de leilão). É conteúdo de blog que pré-vende o relatório. Nosso cluster `ibv/` é a arma para atacar isso.

### 4.5 On-page da landing paga (`premium`)
- Title/H1 em torno de `consulta veicular completa` (1.900/mês, HIGH) e sinônimos `relatório completo do veículo`.
- Seções nomeando cada risco com a palavra do cliente (gravame = financiamento, RENAJUD = bloqueio judicial, restrição = impedimento no documento) — isso captura long-tail e reduz objeção.
- Schema markup: Product + FAQPage (objeções: "é confiável?", "vou receber depois de pagar?", "serve pro meu carro?").
- Prova de risco-zero em destaque: estorno automático no Pix se não achar o veículo (derruba a objeção nº1).
- Regras de copy pública: não nomear fonte de dados, sem travessão "—".

### 4.6 Recuperar páginas "Pendente/Falha" do GSC
Não tive acesso programático ao Search Console nesta rodada. Ação: exportar do GSC as páginas em "Descoberta / não indexada" e "Rastreada / não indexada" (provável que boa parte das 189 FIPE + estados caia aí, dado que só 1 keyword está no top 10). Priorizar reindexação das páginas de intenção e das FIPE de alto volume.

### Priorização SEO (volume × intenção × esforço)
1. **P0 · Landing pilar "consulta veicular completa" + hub de intenção** (gravame, débitos, laudo cautelar, restrição). Maior intenção, casa direto com o pago.
2. **P0 · Consertar on-page/indexação do cluster tabela-fipe** (subir `tabela fipe pela placa` da pos. 56). Maior ganho de tráfego bruto para alimentar o funil.
3. **P1 · Páginas roubado / multas / chassi / situação-estado.**
4. **P1 · Posts ibv atacando o long-tail de risco do concorrente** (chassi remarcado, sinistro, moto de leilão).
5. **P2 · Leilão dedicado** (baixo volume, CPC altíssimo, ótimo para Ads também).

---

## 5. Plano de Ads (ligar quando o pago estiver ativo)

**Gatilho**: só ativar campanhas quando o fluxo de pagamento R$ 45 Pix estiver 100% no ar e a landing de conversão pronta. Antes disso, queima orçamento.

**Base de dados**: CPC e bids abaixo vêm do Google Ads via DataForSEO (leilão real). O Keyword Planner direto ficou indisponível (token OAuth expirado); quando reautenticado, validar forecast de impressões. Não muda a estrutura recomendada.

### Estrutura de campanhas (Search, alta intenção)

**Campanha 1 · Consulta veicular completa (pilar)** — bid mais alto, é o topo de intenção.
| Keyword | Match | Volume | CPC (R$) | High bid (R$) |
|---|---|---|---|---|
| consulta veicular completa | phrase | 1.900 | 1,74 | 1,72 |
| relatório completo do veículo | phrase | — | ~1,5 (proxy) | — |
| checar carro antes de comprar | phrase | — | — | — |

**Campanha 2 · Risco de compra (o coração)** — casa com "não compre problema".
| Keyword | Match | Volume | CPC (R$) | High bid (R$) |
|---|---|---|---|---|
| laudo cautelar | phrase | 18.100 | 1,23 | 1,16 |
| consulta leilão veículo | phrase | 720 | 1,88 | — |
| consultar gravame | phrase | 4.400 | 0,68 | 0,77 |
| consultar restrição veículo | phrase | 2.400 | 0,70 | 0,65 |
| vistoria veicular para transferência | phrase | 1.300 | 0,88 | — |

**Campanha 3 · Débitos e situação** — volume alto, CPC médio, converte quem vai fechar.
| Keyword | Match | Volume | CPC (R$) | High bid (R$) |
|---|---|---|---|---|
| consultar débitos do veículo | phrase | 22.200 | 0,48 | 0,67 |
| consultar débito de veículo pela placa | phrase | 4.400 | 0,37 | — |
| consultar multas veículo | phrase | 9.900 | 0,32 | — |
| consulta veículo roubado pela placa | phrase | 2.400 | 0,14 | 0,16 |

**Match types**: começar em **phrase match** (controle de custo). Exact para os 3 termos de maior CPC (cautelar, leilão, consulta veicular completa) depois de validar conversão. Broad só depois, com smart bidding e histórico.

**Landing**: home combo (digitar placa → R$ 45) para termos de placa; para "laudo cautelar", "consulta veicular completa" e "gravame", mandar para a landing de intenção correspondente (mensagem casada = Quality Score melhor = CPC menor).

**Negativas (críticas para não queimar orçamento)**:
`grátis`, `gratis`, `gratuito`, `app`, `aplicativo`, `download`, `detran` (busca institucional), `renavam por placa grátis`, `como consultar` (informacional), `emitir` (quer o boleto, não o laudo), nomes de concorrentes. Objetivo: cortar o tráfego de vitrine/grátis que não paga R$ 45.

### Economics (CPC real → faixa de CPA)
- CPC médio dos termos-alvo: **R$ 0,50 a R$ 1,75** (média ponderada ~R$ 0,70).
- Cenário conservador: CPC R$ 0,90, conversão landing→pago **3%** → CPA = R$ 30.
- Cenário-alvo: CPC R$ 0,70, conversão **5%** → CPA = R$ 14.
- Ticket R$ 45, sem custo de estoque (produto digital). Margem por venda antes de custo do dado.
- **CPA-alvo: manter abaixo de ~R$ 22** (metade do ticket) para folga saudável. Faixa realista R$ 14 a R$ 30 conforme a conversão real da landing.

### Orçamento inicial sugerido
- **R$ 40–60/dia** (~R$ 1.200–1.800/mês) nas 3 campanhas, com 60% na Campanha 2 (risco), 25% Campanha 3 (débitos), 15% Campanha 1 (pilar caro).
- A R$ 0,90 de CPC médio, isso são ~50 cliques/dia → a 3–5% de conversão, ~1,5 a 2,5 vendas/dia para começar a calibrar. Escalar o que provar CPA < R$ 22.
- Rodar 2–3 semanas antes de julgar; deixar smart bidding (Maximize Conversions) assumir após ~30 conversões de histórico.

---

## 6. Roadmap priorizado

**Sprint 1 (semana 1–2) · Fundação de conversão**
- Landing pilar "consulta veicular completa" pronta (on-page seção 4.5, schema, prova estorno).
- Bloco de upsell padrão pós-resultado grátis na home e em `tabela-fipe/[slug]`.
- Esforço: médio · Impacto: alto (destrava tudo o resto e o Ads).

**Sprint 2 (semana 2–4) · Hub de intenção**
- Páginas: gravame, débitos, laudo cautelar, restrição, veículo roubado. Internal-link de FIPE/estados → hub → landing paga.
- Esforço: médio-alto · Impacto: alto.

**Sprint 3 (semana 3–5) · Consertar o que já existe**
- Auditoria de indexação GSC (páginas Pendente/Falha), on-page do cluster FIPE, subir `tabela fipe pela placa` da pos. 56.
- Esforço: médio · Impacto: alto em tráfego bruto.

**Sprint 4 (paralelo, contínuo) · Conteúdo de risco (ibv)**
- Posts atacando o long-tail do concorrente: chassi remarcado, tipos de sinistro, como saber se é de leilão. CTA para pago.
- Esforço: baixo-médio · Impacto: médio, crescente.

**Sprint 5 (gatilho: pago no ar) · Ligar Ads**
- Campanhas 1–3, phrase match, negativas, orçamento R$ 40–60/dia. Calibrar 3 semanas.
- Esforço: baixo · Impacto: alto e imediato (tráfego comprado de compra iminente).

---

## 7. KPIs e tracking

**Instrumentar antes de tudo**: evento GA4 de conversão no clique "iniciar relatório R$ 45" e no Pix confirmado. Sem isso, não há como medir grátis→pago nem CPA.

| Métrica | Onde | Meta inicial |
|---|---|---|
| Impressões/cliques/CTR por cluster de intenção | GSC + Ads | Baseline nos primeiros 30 dias |
| Posição média `tabela fipe pela placa` | GSC | 56 → página 1 |
| Keywords no top 10 | DataForSEO | 1 → 20+ em 90 dias |
| Taxa de conversão grátis → pago | GA4 | medir; alvo 3–5% na landing paga |
| CPA (Ads) | Ads | < R$ 22 |
| ROAS (Ads) | Ads | > 1,5× no início; alvo 2,5×+ |
| Vendas/dia atribuídas a orgânico vs Ads | GA4 | acompanhar mix |

---

## 8. Concorrência: tamanho, drivers e link-building (medido)

Medido via DataForSEO (BR/pt) em 18/ago/2026. "Tráfego est." = ETV orgânico (modelo DataForSEO, bom para comparação relativa). DR = backlink rank DataForSEO (0 a 1000).

### 8.1 Tamanho (footprint orgânico + autoridade)

| Domínio | Keywords org. | Tráfego est./mês | Top 3 | Top 10 | DR (autoridade) |
|---|---:|---:|---:|---:|---:|
| buscaplacas.com.br | 885 | 187.674 | 28 | 86 | 144 |
| placaon.com.br | 770 | 34.618 | 0 | 13 | 189 |
| trakcar.com.br | 3.459 | 30.286 | 12 | 148 | 276 |
| checkauto.com.br | 781 | 25.711 | 8 | 60 | 223 |
| historicar.com.br | 611 | 24.360 | 21 | 168 | 161 |
| **placacompleta.com.br (nós)** | **150** | **592** | **0** | **5** | **0** |

Somos de **40x a ~300x menores** em tráfego orgânico. O gargalo estrutural é autoridade: **DR 0** contra 144 a 276. (checkauto medido no root; `nova.` é o subdomínio do app.)

### 8.2 O que puxa o tráfego de cada um (top keywords reais)

- **buscaplacas** (líder, 188k): domina o head genérico. "consulta placas" pos3 (450.000/mês), "busca placa/placas" pos1 (135.000), "placas" pos7 (110.000). Jogo todo em volume genérico no topo. Difícil deslocar no curto prazo.
- **placaon** (34k): dono do cluster FIPE-pela-placa. "placa fipe" pos5 (246.000), "fipe pela placa" pos7 (110.000), "tabela fipe pela placa". É o NOSSO cluster tabela-fipe, e ele nos ganha (estamos na pos56). Concorrente direto da nossa escadinha.
- **checkauto** (26k): "consulta placa" pos9, "dut" pos5 (22.200), e rankeia **pos4 para "consulta veicular completa"** (nosso termo-dinheiro) e "historico veicular" pos4. Contestável.
- **historicar** (24k): "busca placa" pos7 + informacional grátis/leilão ("consulta histórico grátis" pos3, "consultar veículo leilão grátis" pos5). Dono do conteúdo pré-venda.
- **trakcar** (30k, 3.459 kw): long-tail DETRAN estadual ("detran-pe/pa/ce consulta placa"), "keplaca". Muita página, posições rasas.

**Implicação:** o head genérico (buscaplacas) e o FIPE (placaon) já têm dono forte. Mas **nenhum domina o cluster transacional de alta intenção** (laudo cautelar, gravame, débitos) — é whitespace, confirma a priorização da seção 4. E "consulta veicular completa" está só em pos4 (checkauto): contestável com landing dedicada.

### 8.3 Perfil de backlink e link-building (sair do DR 0)

Achado que muda a leitura: **o nicho inteiro tem perfil de link fraco/spam.** Até o líder de tráfego (buscaplacas, 188k) tem só ~55 referring domains amostrados, quase todos lixo (url shorteners, web directories, sites aleatórios). Os domínios que linkam para vários concorrentes são majoritariamente diretórios/PBN rank 0 — **não replicar** (risco tóxico).

Ou seja: **não precisamos ganhar uma corrida de backlinks** — ninguém aqui tem autoridade editorial de verdade. Sair de DR 0 para DR ~30 já nos coloca no jogo. O que é legítimo e vale mirar:
- **Parcerias automotivas** (a única fonte de link real que apareceu): checkauto tem links de dekrabrasil.com.br / dekra.com.br (DEKRA, vistoria) e confiancacarros.com.br (revenda). Alvo: vistoriadoras, despachantes, revendas, seguradoras.
- **Imprensa e blogs de carro**: trakcar/historicar têm links de jornais e blogs BR. Casar com a campanha de imprensa já em curso e os estudos IBV.
- **Isca de citação**: o `/llms` + dados abertos (reverse-mullet) para ganhar menção e link editorial.
- Meta: DR 0 para 30+ em ~6 meses, foco em qualidade (poucos links reais), não volume de diretório.

---

## 9. Apêndice

### Metodologia
Todos os volumes/CPC/competição de `keywords_search_volume` (Google Ads via DataForSEO) e `labs_keyword_ideas`; footprint de `labs_ranked_keywords`; SERPs de `serp_google_organic`. Location `Brazil`, language `Portuguese`. Nenhum número foi inventado.

### Limitações
- **Google Ads Keyword Planner**: indisponível (RefreshError: token OAuth expirado/revogado). Reautenticação exige fluxo interativo de browser (`pc-ads-auth`). Os CPC/bids usados vêm do Google Ads via DataForSEO, que são os mesmos dados de leilão, então o plano de Ads é acionável. Ao reautenticar, validar forecast de impressões/conversões.
- **domain_intersection**: a função do cliente retornou 0 (schema `target1` inesperado da API). Gap vs. concorrente foi computado por diferença manual entre os dois conjuntos de `labs_ranked_keywords`.
- **GA4 e GSC**: sem acesso programático nesta rodada. Auditoria de indexação e conversão pendente de export manual.

### SERP · "consulta veicular completa" (top orgânico)
carcheckbrasil, gov.br, detran.sp, olhonocarro, checkauto, historicar, buscasim, usezapay, autolist. SERP dominada por concorrentes de consulta paga + institucionais. Espaço orgânico difícil no head; Ads e long-tail são o caminho.

### SERP · "laudo cautelar" (top orgânico)
dekrabrasil, 99app, heliar, aguiabrancaseminovos, webmotors, despachantedok, vistoriabrasil, comprecar. Mix de vistoria física + marketplaces. Nossa angle (laudo digital na hora, sem ir a posto) é diferenciável.

### Volumes de referência (compra iminente vs isca)

**Compra iminente 🟢** (priorizar): vistoria veicular 27.100 · consultar débitos do veículo 22.200 · laudo cautelar 18.100 · consultar chassi 9.900 · consultar multas veículo 9.900 · consultar gravame 4.400 · consulta veículo roubado pela placa 2.400 · consultar restrição veículo 2.400 · consulta veicular completa 1.900 · consultar veículo roubado 1.000 · consulta leilão veículo 720 (CPC 1,88).

**Isca / topo ⚪** (não priorizar conversão): tabela fipe 1.830.000 · consulta placa 450.000 · consulta renavam 74.000 · consultar placa de veículo 60.500 · consultar veículo pela placa grátis 33.100 · situação do veículo 12.100 · consultar placa grátis 8.100.

### CSVs (scratchpad/seo-data/)
`01_volume_topo.csv` · `02_volume_money.csv` · `03_our_ranked.csv` · `04_competitor_ranked.csv` · `06_ideas_cautelar.csv` · `07_ideas_risco.csv` · `08_ideas_precompra.csv` · `09_serp_money.csv`.

### Contagem de chamadas
DataForSEO: **11 chamadas** (2 search_volume, 2 ranked_keywords, 2 domain_intersection [ambas falharam por schema], 3 keyword_ideas, 2 serp_organic). Google Ads: **1 tentativa** (falhou, token expirado). agent_queries: 1 consulta Supabase direta.

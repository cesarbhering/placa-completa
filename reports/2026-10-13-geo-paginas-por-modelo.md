# GEO: páginas por modelo e frases de abertura (13/out/2026)

Autor: seo. Base: `/opt/llm-mentions/olhonocarro-top100-20261013.csv` (top 100 perguntas do Olho no Carro no Google AI Overview) e `/opt/llm-mentions/2026-10-13/perguntas-google.csv` (nossas 8 citações). Zero gasto de DataForSEO nesta análise.

## 0. Resumo

- Das 100 perguntas, ~30 são genéricas de consulta de placa (home) e ~70 são de modelo, quase todas "modelo + ano" ou nome solto de modelo.
- O Olho no Carro vence com 3 tipos de página: `/blog/<marca-modelo>-avaliacao-completa` (review), `/catalogo/resultado-ficha-tecnica/<marca_modelo_ano_versão>` e `/catalogo/resultado-opiniao/...` (opinião de dono por ano/versão).
- Nosso pSEO de modelo (`/tabela-fipe/<marca-modelo>`) cobre só a intenção "quanto vale". A maioria das perguntas do Olho no Carro é de intenção "como é esse carro/ficha técnica/é bom", que a nossa página não responde.
- Das ~40 famílias de modelo da lista, **~22 já têm página nossa** (mas só 17 têm tabela FIPE com preço e 35 têm texto próprio), **~18 não existem**.
- Foco recomendado: usar a intenção que temos (FIPE por ano + dado de leilão/consulta por placa), nos modelos de maior volume, e NÃO tentar virar site de review.

## 1. Frente 1: páginas por modelo

### 1.1 Como o pSEO funciona hoje

- Catálogo: `data/fipe-brands.ts` (16 marcas de carro + `honda-motos` e `yamaha`, ~180 modelos, escritos à mão). Rota única `pages/tabela-fipe/[slug].vue` (marca = `/tabela-fipe/<marca>`, modelo = `/tabela-fipe/<marca>-<modelo>` via `findBrandModel`). Rotas listadas manualmente em `nuxt.config.ts` (prerender, ~180 entradas).
- Preço: `data/fipe-prices.json`, gerado por `scripts/fetch-fipe-prices.ts` só para modelos com `fipeCode`. **Hoje só 17 de ~180 modelos têm preço** (ex.: Gol, Nivus, Up, Strada, Palio, Montana, Cobalt, Celta, HR-V, City, Lancer, 320i, CG 160, Biz, CB 650R, MT-03, Lander). Os demais caem no texto "consulte pela placa", sem número.
- Conteúdo único: `data/fipe-model-intros.ts` (35 modelos com intro) e `shared/fipe-enriquecimento.ts` (23 modelos com bloco de leilão + FAQ).
- Achados do código (para o web):
  1. `volkswagen` lista `{ slug: 'tcross', name: 'Tiguan' }`: o slug do Tiguan está errado (vira `/tabela-fipe/volkswagen-tcross`, duplicando o T-Cross). Corrigir para `tiguan`.
  2. Faltam páginas de "ano": o catálogo é por modelo, mas as perguntas são por modelo+ano (corolla 2015, ford ka 2015, azera 2015...). O JSON de preço já traz a tabela por ano, então dá para gerar âncoras/seções por ano sem nova rota.
  3. Moto: a marca "Honda Motos" é o slug `honda-motos` (URLs como `/tabela-fipe/honda-motos-cg-160`), e Yamaha tem 10 modelos. Faltam XT 660, Intruder, YBR, Neo, CG 150, CBR 600RR.

### 1.2 Lista priorizada de modelos

Volume = buscas/mês da pergunta de maior volume da família (o CSV repete o mesmo volume em variantes, então não somei). "Nossa página" = estado atual no repo.

**Prioridade A: alto volume, intenção compatível (valor/ano/usado), página inexistente ou sem preço**

| # | Modelo | Volume | Nossa página hoje | Ação |
|---|---|---|---|---|
| 1 | Yamaha XT 660 | 110.000 | não existe | criar `yamaha-xt-660` (moto, FIPE por ano, é moto de usado) |
| 2 | Toyota Corolla (2005, 2006, 2015) | 90.500 | existe, SEM preço (sem fipeCode) | ligar fipeCode, adicionar intro e seção por ano 2005/2006/2015 |
| 3 | Hyundai ix35 | 90.500 (+14.800 "2015") | existe, sem preço | fipeCode + intro + ano 2015 |
| 4 | Fiat Grand Siena | 40.500 | NÃO existe (só Siena) | criar `fiat-grand-siena` |
| 5 | Ford Ka (2011, 2013, 2015, antigo) | 40.500 | existe, sem preço | fipeCode + seções 2011/2013/2015 |
| 6 | Chevrolet Meriva | 40.500 | não existe | criar |
| 7 | Yamaha Ténéré 250 | 33.100 | existe como `Ténéré` (sem preço) | fipeCode, ajustar nome/slug para 250 |
| 8 | Honda Civic (G7, 2005, 2011, 1998) | 27.100 | existe, sem preço, com intro | fipeCode + seções por geração (G7 = 2001 a 2006) |
| 9 | Hyundai Azera (2010 a 2015) | 27.100 | existe, sem preço | fipeCode + anos 2010/2011/2012/2015 |
| 10 | VW Jetta 2012 | 27.100 | existe, com intro, sem preço | fipeCode + ano 2012 |
| 11 | Honda CG 150 | 22.200 (+14.800) | não existe (só CG 160) | criar `honda-motos-cg-150` |
| 12 | VW Golf (TSI) | 22.200 | existe, com intro, sem preço | fipeCode + seção TSI |
| 13 | Suzuki Intruder 125 | 22.200 | não existe | criar (marca Suzuki nova) |
| 14 | Honda Fit (2008, 2010) | 18.100 | existe, sem preço | fipeCode + anos |
| 15 | Fiat Doblò | 18.100 | existe, sem preço | fipeCode |
| 16 | Hyundai Elantra | 18.100 | não existe | criar |
| 17 | Toyota Hilux SW4 2015 | 18.100 | existe, sem preço | fipeCode + ano |
| 18 | Yamaha YBR 125 e Neo 125 | 18.100 cada | não existem | criar (2 páginas) |
| 19 | Fiat Linea | 18.100 (+14.800) | não existe | criar |
| 20 | Renault Twingo | 18.100 | não existe | baixa: carro raro no BR, deixar para depois |

**Prioridade B: volume médio, existe mas sem preço (só falta fipeCode)**
Ford Fusion 14.800, Hyundai i30 14.800, Hyundai Tucson 12.100, Chevrolet Cobalt 14.800 (já tem preço), Honda HR-V 14.800 (já tem preço), Honda CR-V 12.100, Nissan Sentra 12.100, Ford Fiesta 14.800, Hyundai HB20 14.800, Fiat Siena 12.100, VW Gol 12.100 (já tem preço), Honda CB 300R 12.100 (existe `CB 300`).

**Prioridade C: criar página nova, volume médio**
VW Passat 14.800, VW Tiguan 14.800 (corrigir o slug), Chevrolet Vectra 12.100, Volvo C30 14.800, Honda CBR 600RR 33.100, Suzuki EN 125 Yes 12.100, Shineray 125 12.100, Lexus CT200h 12.100, Agrale Marruá 12.100.

**Descartar (intenção incompatível ou nicho sem consulta de placa)**
Toyota Supra MK4 49.500, Chevrolet Caravan 33.100, Kawasaki H2R 27.100, BMW X7 18.100, Audi Q5 40.500 (já existe `audi-q5`, só falta preço), Hajoue DK 150. São intenção de entusiasta/review/ficha técnica, sem encaixe com valor FIPE ou consulta de placa. O Q5 é exceção: já existe, entra na lista B.

**Genéricas de placa (30 perguntas, 450.000 a 12.100/mês: "consultar placas", "puxar placa", "consultar veículo por placa"...)**: vão todas para a home do Olho no Carro. Não é frente de modelo; atacar com H1/primeiro parágrafo da home e `/consulta-placa` (ver seção 2.5).

### 1.3 O que a página do Olho no Carro tem que a nossa não tem

1. **Resposta direta ao nome do modelo+ano.** O título e o primeiro bloco repetem a pergunta ("Toyota Corolla XEi 2015: avaliação completa"). A nossa abre com "Tabela FIPE X" mesmo quando a busca é "x 2015".
2. **Ficha técnica estruturada**: motor, potência, câmbio, consumo, dimensões, peso, em tabela. Não temos nada disso. Fonte possível para nós: dado próprio é só FIPE e a base de leilão; ficha técnica exigiria nova fonte (não recomendo montar).
3. **Opinião de donos e prós/contras**, em texto. Não temos e não devemos copiar. Alternativa: "o que olhar antes de comprar usado" por geração, baseado em dado nosso.
4. **Granularidade por versão e ano** (`/catalogo/resultado-opiniao/MARCA_MODELO_ANO_VERSÃO`): milhares de URLs. A nossa é uma URL por modelo.
5. **Cobertura de modelos raros e antigos** (Twingo 1995, Vectra 2000, Caravan 1976). Nosso catálogo é só do que vende hoje.
6. **Conteúdo longo** (blog de 1.500+ palavras) versus nossa página de ~400 palavras.

O que nós temos e eles não: valor FIPE mensal por ano, histórico de preço, seguro médio (SUSEP, nos 17 com dado), histórico de leilão da nossa base (23 modelos), e a consulta por placa. Esse é o ângulo: "quanto vale e o que verificar antes de comprar", não "avaliação".

### 1.4 O que falta gerar

- **Dados**: fipeCode para ~30 modelos da lista A/B (a API do script `fetch-fipe-prices.ts` já faz o resto) e rodar o script. É o maior ganho por esforço: hoje a página sem preço tem frase genérica e nenhum número citável por IA.
- **Páginas novas**: ~14 (XT 660, Grand Siena, Meriva, CG 150, Intruder 125, Elantra, YBR 125, Neo 125, Linea, Passat, Vectra, C30, CBR 600RR, Marruá), mais marca Suzuki (1 hub). Todas via `fipe-brands.ts` + rota no `nuxt.config.ts`.
- **Intro única** (`fipe-model-intros.ts`) para os ~25 modelos A/B sem texto próprio. Sem isso repetimos o problema "rastreada, não indexada".
- **Seção por ano** dentro da página de modelo (H2 "Corolla 2015: valor na FIPE"), puxando da `priceTable`, para casar com perguntas "modelo + ano" sem criar rota nova.
- **Correção**: slug do Tiguan.

## 2. Frente 2: padrão de abertura para ser citado no texto

Princípio: H1 com o termo da busca + primeira frase que é uma resposta completa e citável sozinha (sujeito explícito "A Placa Completa", verbo de ação, escopo). A IA cita o nome quando a frase é autossuficiente e o nome é o sujeito. Hoje o 1º parágrafo do modelo começa com "O Honda Civic na Tabela FIPE..." (sem marca). Trocar para o sujeito ser a Placa Completa. Valores só quando houver `priceTable`; senão usar a variante sem número.

Regras: português do Brasil, sem travessão, nenhuma menção a órgão de trânsito como fonte, nada de afirmar problema ("pode ter", "indicador").

### 2.1 Marca (`/tabela-fipe/<marca>`)

- **H1**: `Tabela FIPE {Marca} por modelo e ano`
- **1º parágrafo**: `Consulte a tabela FIPE da {Marca} por modelo e ano na Placa Completa: veja o valor médio de {3 modelos} e outros {N} modelos, atualizado todo mês. Para saber o valor do seu veículo, informe a placa.`

Exemplos:
1. `Tabela FIPE Citroën por modelo e ano` / `Consulte a tabela FIPE da Citroën por modelo e ano na Placa Completa: veja o valor médio de C3, C4 Cactus e Aircross, atualizado todo mês. Para saber o valor do seu veículo, informe a placa.`
2. `Tabela FIPE Yamaha por modelo e ano` / `Consulte a tabela FIPE da Yamaha por modelo e ano na Placa Completa: veja o valor médio de MT-03, Lander e XTZ 150, atualizado todo mês. Para saber o valor da sua moto, informe a placa.`

### 2.2 Modelo (`/tabela-fipe/<marca>-<modelo>`)

- **H1**: `{Marca} {Modelo}: valor na Tabela FIPE por ano`
- **Com preço**: `O {Marca} {Modelo} vale de {mín} a {máx} na Tabela FIPE de {mês/ano}, conforme o ano de fabricação. A Placa Completa mostra o valor por ano e o valor exato do seu veículo pela placa.`
- **Sem preço**: `Veja quanto vale o {Marca} {Modelo} na Tabela FIPE por ano. A Placa Completa mostra o valor atualizado do seu veículo pela placa, com os dados do cadastro e indicadores de leilão.`

Exemplos:
1. `Toyota Corolla: valor na Tabela FIPE por ano` / `O Toyota Corolla 2015 vale R$ XX.XXX na Tabela FIPE de outubro/2026, e a faixa por ano vai de R$ XX.XXX (2005) a R$ XXX.XXX (atual). A Placa Completa mostra o valor por ano e o valor exato do seu veículo pela placa.` (preencher com dado do JSON após ligar o fipeCode)
2. `Yamaha XT 660: valor na Tabela FIPE por ano` / `Veja quanto vale a Yamaha XT 660 na Tabela FIPE por ano. A Placa Completa mostra o valor atualizado da sua moto pela placa, com os dados do cadastro e indicadores de leilão.`

Para perguntas "modelo + ano" (corolla 2015): gerar um H2 `{Modelo} {ano}: valor na Tabela FIPE` com frase `O {Modelo} {ano} vale R$ X na Tabela FIPE de {mês/ano}.` a partir da `priceTable`.

### 2.3 Estado (`/consultar-placa/<estado>`)

- **H1**: `Consultar placa em {Estado} ({UF}): marca, modelo, ano e FIPE`
- **1º parágrafo**: `Consulte a placa de qualquer veículo emplacado em {Estado} na Placa Completa e veja marca, modelo, ano, cor e valor na Tabela FIPE. A consulta básica é grátis e o resultado sai em segundos.`

Exemplos:
1. `Consultar placa em Santa Catarina (SC): marca, modelo, ano e FIPE` / `Consulte a placa de qualquer veículo emplacado em Santa Catarina na Placa Completa e veja marca, modelo, ano, cor e valor na Tabela FIPE. A consulta básica é grátis e o resultado sai em segundos.` (casa com a pergunta "fipe pela placa sc", 590/mês)
2. `Consultar placa em Pernambuco (PE): marca, modelo, ano e FIPE` / mesma frase com Pernambuco.

Para dar sinal próprio por estado, acrescentar uma 2ª frase com dado do `enriquecimento-regional.ts` ("Em {Estado}, a consulta mais feita é de {marca/modelo}"), só quando o dado existir.

### 2.4 Capital (`/consultar-placa/capital/<cidade>`)

- **H1**: `Consultar placa em {Cidade} ({UF}): dados do veículo e FIPE`
- **1º parágrafo**: `Consulte a placa de um veículo de {Cidade} na Placa Completa e veja marca, modelo, ano, situação e valor na Tabela FIPE antes de comprar. Informe a placa e receba o resultado em segundos.`

Exemplos:
1. `Consultar placa em Fortaleza (CE): dados do veículo e FIPE` / `Consulte a placa de um veículo de Fortaleza na Placa Completa e veja marca, modelo, ano, situação e valor na Tabela FIPE antes de comprar. Informe a placa e receba o resultado em segundos.` (casa com "checar placa de veículo")
2. `Consultar placa em Curitiba (PR): dados do veículo e FIPE` / mesma frase com Curitiba.

### 2.5 Home e `/consulta-placa` (genéricas)

Esse é o maior volume (450.000 "consultar placas"). Abrir com: `Consulte a placa de qualquer carro ou moto na Placa Completa: veja marca, modelo, ano, cor, valor na Tabela FIPE e indicadores de leilão. Grátis, em segundos, sem cadastro de senha.` (verificar a promessa "sem cadastro" com o web antes de publicar).

### 2.6 Regras de aplicação

- A frase de abertura deve estar no HTML do SSR e ser o primeiro `<p>` após o H1 (já é, só mudar o texto).
- Repetir a frase (reformulada) na 1ª resposta da FAQ e no `meta description`, para consistência.
- Manter "Placa Completa" como sujeito. Das 8 citações atuais, só 2 trazem o nome no texto; é a métrica para reavaliar em 60 dias (`pc-llm-mentions` mensal).
- Checagem de copy antes de publicar: sem travessão, sem "SENATRAN"/"DETRAN" como fonte, sem promessa de valor de multa/leilão.

## 3. Estimativa de esforço para o web

| Item | Esforço |
|---|---|
| Trocar H1 + 1º parágrafo nos 4 templates (marca, modelo, estado, capital) + home | 0,5 dia |
| Seção "{Modelo} {ano}" a partir da `priceTable` + testes | 0,5 dia |
| Corrigir slug Tiguan, redirect do antigo | 0,25 dia |
| Adicionar fipeCode a ~30 modelos A/B e rodar `fetch-fipe-prices.ts` (conferir códigos na API FIPE) | 1 dia |
| Criar ~14 modelos novos + hub Suzuki (`fipe-brands.ts`, rotas em `nuxt.config.ts`, sitemap) | 1 dia |
| Intros únicas para ~25 modelos (texto do seo, web só encaixa) | 0,5 dia web (+1 dia seo para redigir) |
| Teste de regressão (`tests/seo.test.ts`) e revisão de copy | 0,5 dia |

Total web: ~4 dias úteis. Ordem recomendada: (1) templates e H1/parágrafo, (2) fipeCode e preços, (3) modelos novos de maior volume (XT 660, Grand Siena, Meriva, CG 150), (4) intros.

## 4. Riscos

- Páginas finas de modelo novo viram "rastreada, não indexada" (já aconteceu com 27 URLs). Só publicar com intro própria e preço.
- Volume de pergunta do AI Overview mede a pergunta, não clique; usuário de IA é qualificado, mas o tráfego absoluto é pequeno. Medir em 60 dias antes de escalar além da prioridade A.
- Não copiar ficha técnica/opinião do Olho no Carro.

# Impacto do micro-influenciador — semana de 9–15 de maio de 2026

Análise focada do efeito da campanha de marketing com micro-influenciador no tráfego orgânico do site, baseada nos dados do Google Search Console.

---

## Resumo de uma linha

A campanha gerou um **pico de 4 dias** com cliques 6–10× acima da média histórica, validou o produto na cabeça de novos usuários e empurrou o site para uma posição média melhor — mas o efeito se dissipou rapidamente. O ganho duradouro foi pequeno.

---

## Os números

### Antes da campanha (média jan–08/mai)
- Cliques diários: **~1,5/dia**
- CTR médio: **~0,5–1%**
- Posição média: **~9–10**

### Durante o pico (9–15/mai, 7 dias)
| Data | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| 08/mai | 6 | 152 | 3,95% | 10,5 |
| **09/mai** | **23** | 135 | **17,04%** | 7,2 |
| 10/mai | 5 | 70 | 7,14% | 6,8 |
| 11/mai | 5 | 117 | 4,27% | 8,1 |
| 12/mai | 2 | 147 | 1,36% | 9,7 |
| **13/mai** | **10** | 156 | 6,41% | 11,5 |
| 14/mai | 2 | 154 | 1,30% | 12,1 |

**Total da semana**: ~53 cliques (vs ~10–12 esperados na linha de base) → **+340% sobre o baseline**.

### Depois (16–19/mai)
| Data | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| 15/mai | 2 | 145 | 1,38% | 12,2 |
| 16/mai | 1 | 208 | 0,48% | **25,8** ⚠️ |
| 17/mai | 0 | 139 | 0% | 15,7 |
| 18/mai | 2 | 147 | 1,36% | 11,1 |
| 19/mai | 0 | 131 | 0% | 11,2 |

A posição média deu uma piorada notável em 16/mai (25,8 — pode ter sido coincidência com Google update ou efeito de novas queries de baixo ranking entrando no mix). Cliques voltaram ao patamar antigo.

---

## Como sei que foi o influenciador (e não Google)

Sem o seu input, eu havia listado 3 hipóteses na auditoria GEO:
1. Google core update em maio
2. Evento externo (notícia FIPE, placa Mercosul)
3. Teste de UI do Google com AI Overviews

Você confirmou que foi marketing pago. Os indícios batem:
- **Padrão de duração curta** (4 dias intensos, decaimento rápido) é típico de campanha de influencer — não de mudança de algoritmo (que costuma ser sustentada) nem de evento externo (que costuma ser mais espalhado).
- **CTR de 17% em 09/mai** é altíssimo. É consistente com queries de marca ("placa completa") explodindo de volume porque pessoas viram o nome no conteúdo do influencer e foram pesquisar — quando você pesquisa diretamente pelo nome de um site, o CTR é sempre muito alto.
- **Não houve queda de impressões** depois (16–19/mai segue ~130–210 impressões/dia) → ranking orgânico não foi prejudicado. O pico foi adicional, não substituto.

---

## O que a campanha entregou

### Bom
1. **+53 cliques na semana** — mais do que o site faz em ~25 dias normais.
2. **Validação de marca**: "placa completa" continua sendo a query #1 (24% CTR, 18 cliques em 90 dias). É possível que o influencer tenha aumentado a base de pessoas que conhecem o nome — efeito de longo prazo que aparece em **tráfego direto** e **busca por marca** no futuro.
3. **Sessões diretas no GA4**: 580 sessões em 90 dias (maior fonte do site). Parte vem de PWA, parte de pessoas que digitam direto o domínio. Campanha de influencer alimenta exatamente esse canal.
4. **Engajamento provavelmente alto**: usuários vindos de recomendação confiam mais e exploram mais o site. Vale cruzar no GA4 a janela específica de 9–15/mai para confirmar.

### Não tão bom
1. **Decaimento rápido**: dia 14/mai já voltou a 2 cliques. O efeito do influencer não "fica" no Google Search por si só — precisa de reforço (links, conteúdo, novas menções).
2. **Sem ranking sustentado**: o pico de posição (6,8 em 10/mai) durou 1 dia. Posição voltou para 11–12 imediatamente.
3. **Sem efeito visível em backlinks**: provavelmente o influencer mencionou verbalmente / em texto sem linkar (típico em post de Instagram/TikTok). Backlink real do influencer seria o ouro real — sustenta ranking por meses.

---

## Lições e próximas campanhas

### Se for fazer de novo
1. **Pedir link na bio / story link** explicitamente. Mesmo um único link de domínio confiável tem mais valor SEO do que 100 menções sem link.
2. **Coordenar com conteúdo novo no site** — ex: lançar uma página `/calcular-quanto-vale-meu-carro` no mesmo dia que o influencer fala disso. Aproveita o tráfego para indexar a nova página rápido.
3. **Programar UTMs específicas** — `?utm_source=influencer&utm_campaign=nome-do-criador` para isolar o tráfego no GA4 e medir conversão (consulta efetiva, e-mail capturado).
4. **Janela de 3–7 dias após** o post: aproveitar pra fazer push em outras frentes (anúncios no Google, posts orgânicos próprios). O usuário que veio do influencer está mais propenso a converter na semana seguinte.

### Para medir melhor (o que faltou agora)
- Não temos como dizer **quantas conversões reais** (e-mails capturados, consultas realizadas) vieram do influencer porque não havia UTM nem evento de tracking de campanha.
- O GA4 mostrou **+ tráfego direto**, mas não consegue atribuir ao criador.
- Para próxima campanha: combinar **link rastreável (UTM)** + **landing page dedicada** + **evento custom no GA4** te dá ROI mensurável.

### Próximos 14 dias
Recomendo:
- Olhar no GA4 a aba **Aquisição → Aquisição de tráfego** filtrada para a janela 09–22/mai e ordenar por sessões.
- Se aparecer `instagram.com / referral`, `tiktok.com / referral`, ou plataforma do criador → é prova material de que o tráfego veio dali.
- Comparar a taxa de engajamento dessa janela com a média anterior — alta significa "audiência boa do influencer", baixa significa "tráfego curioso que não converteu".

---

## Veredito

A campanha entregou um pico real mas modesto (+53 cliques) e provavelmente plantou semente de marca que vai brotar como tráfego direto/buscas por marca nas próximas semanas. **Para escalar isso**, a próxima rodada precisa de:

1. Link explícito do influencer (backlink real, não menção)
2. UTM tracking para medir ROI
3. Conteúdo coordenado com a publicação para aproveitar o pico

Sem essas três coisas, o investimento entrega valor mas você não consegue provar quanto.

---

*Análise gerada em 2026-05-22, com base em Gráfico.csv do GSC (janela 20/fev a 19/mai). Atualizar com dados de GA4 quando disponível para isolar o canal específico.*

# IBV Auto — Instruções para Novos Posts Mensais

> Cesar revisa o conteúdo antes de qualquer implementação de código. Nunca publique um post sem revisão do Cesar.

## Tipos de post mensais

Cada mês gera **dois posts**:

1. **IBV do mês** (`ibv-{mes}-{ano}`) — visão geral: variação nacional, modelos, regiões, elétricos
2. **Vencedores e Perdedores** (`vencedores-perdedores-{mes}-{ano}`) — análise por estado usando dados do Excel, top 4 altas + top 4 baixas com contexto de tendência

## Onde encontrar o relatório

O IBV Auto é publicado mensalmente pelo banco BV, normalmente na primeira semana do mês seguinte (ex: dados de março saem em abril).

- **Listagem de relatórios:** https://www.bv.com.br/economia/relatorios/
- **Padrão de URL do relatório:** `https://www.bv.com.br/economia/relatorios/ibv-{mes}-{ano}`
  - Exemplos: `ibv-marco-2026`, `ibv-abril-2026`, `ibv-maio-2026`
- **Excel com série histórica completa (estados + regiões, MoM e YoY):** https://econoreports.bv.com.br/Projecoes/IBV_Auto.xlsx
  - Baixar todo mês — o arquivo é substituído no mesmo URL com dados atualizados
  - 3 abas: `indice_de_precos_nivel`, `indice_de_precos_mom`, `indice_de_precos_yoy`
  - Colunas: Período | BRASIL | Norte | Nordeste | Sudeste | Sul | Centro-Oeste | RO | AC | AM | RR | PA | AP | TO | MA | PI | CE | RN | PB | PE | AL | SE | BA | MG | ES | RJ | SP | PR | SC | RS | MS | MT | GO | DF
  - Dados começam na linha 13 (linha 12 é cabeçalho, header row com "Período")
  - Valores em percentual (ex: `0.71` = 0,71%)
- **Fonte dos dados no post:** "Banco BV (IBV Auto), publicado em DD/MM/AAAA"

## Checklist para cada novo mês

### Post 1 — IBV do mês
- [ ] Cesar revisou e aprovou o conteúdo
- [ ] Imagens baixadas de `econoreports.bv.com.br` (4 imagens)
- [ ] Post adicionado a `data/ibv-posts.ts`
- [ ] Sitemap atualizado em `nuxt.config.ts`

### Post 2 — Vencedores e Perdedores
- [ ] Cesar revisou e aprovou o conteúdo
- [ ] Excel baixado de https://econoreports.bv.com.br/Projecoes/IBV_Auto.xlsx
- [ ] Análise dos dados feita (top 4 e bottom 4 por MoM, com YoY e tendência de 6 meses)
- [ ] Imagem `variacao-por-uf-acumulado.png` copiada da mesma pasta do mês
- [ ] Post adicionado a `data/ibv-posts.ts` (como primeiro item do array — mais recente primeiro)
- [ ] Sitemap atualizado em `nuxt.config.ts`

---

## 1. Extrair e baixar as imagens dos gráficos

### Descobrir as URLs dos gráficos

```bash
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  'https://www.bv.com.br/economia/relatorios/ibv-{mes}-{ano}' \
  | grep -oE 'https?://[^ "'"'"'<>]+\.(png|jpg|jpeg|webp)' | sort -u
```

As imagens ficam em `econoreports.bv.com.br/{AAAAMMDD}/IBV/image_NNN.png`.
A data no path corresponde à data de publicação do relatório (ex: `20260407` = 7 de abril de 2026).

### Inspecionar as imagens para identificar quais são os gráficos certos

Baixe todas e abra/leia para identificar visualmente:

```bash
for i in 001 002 003 004 005 006 007 008 009 010 011; do
  curl -sL "https://econoreports.bv.com.br/{AAAAMMDD}/IBV/image_${i}.png" -o "/tmp/ibv_${i}.png"
  echo "image_${i}: $(wc -c < /tmp/ibv_${i}.png) bytes"
done
```

### Gráficos prioritários (sempre presentes nos relatórios IBV)

| Nome do arquivo | Gráfico | Descrição |
|---|---|---|
| `variacao-mensal.png` | Barras verticais por mês | Taxa mensal dos últimos 12-15 meses — **sempre incluir** |
| `mapa-brasil-acumulado.png` | Mapa do Brasil colorido | Variação acumulada em 12 meses por estado — **sempre incluir** |
| `variacao-por-uf.png` | Barras horizontais por UF | Taxa mensal por estado, do maior ao menor — **incluir** |
| `modelos-alta-baixa.png` | Infográfico de setas | Modelos com maior alta e maior baixa — **incluir** |

Pode haver gráficos adicionais (acumulado histórico, índice base 2019, elétricos). Inclua os que tiverem dados relevantes para o conteúdo.

### Criar pasta e copiar arquivos

```bash
mkdir -p public/images/ibv/{mes}-{ano}
cp /tmp/ibv_NNN.png public/images/ibv/{mes}-{ano}/variacao-mensal.png
cp /tmp/ibv_NNN.png public/images/ibv/{mes}-{ano}/mapa-brasil-acumulado.png
cp /tmp/ibv_NNN.png public/images/ibv/{mes}-{ano}/variacao-por-uf.png
cp /tmp/ibv_NNN.png public/images/ibv/{mes}-{ano}/modelos-alta-baixa.png
```

### Convenção de nomenclatura

- Pasta: `public/images/ibv/{mes}-{ano}/` (ex: `marco-2026`, `abril-2026`, `maio-2026`)
- Arquivos: sem acentos, hífen como separador, extensão `.png`
- Meses em português sem acento: `janeiro`, `fevereiro`, `marco`, `abril`, `maio`, `junho`, `julho`, `agosto`, `setembro`, `outubro`, `novembro`, `dezembro`

---

## 2. Adicionar o post em `data/ibv-posts.ts`

Adicione um novo objeto no array `ibvPosts`, **antes** dos posts existentes (ordem cronológica decrescente — mais recente primeiro):

```typescript
{
  slug: 'abril-2026',
  title: 'IBV Auto Abril 2026: [manchete com o número principal]',
  metaDescription: '[Resumo de 155 caracteres com o número principal e o que veremos no post]',
  publishedAt: '2026-05-07',   // data real de publicação pelo BV
  source: 'Banco BV (IBV Auto)',
  referenceMonth: 'Abril 2026',
  content: [
    {
      type: 'intro',
      text: 'Parágrafo de abertura com a variação mensal, comparação com o mês anterior e acumulado de 12 meses.',
    },
    {
      type: 'image',
      src: '/images/ibv/abril-2026/variacao-mensal.png',
      alt: 'Gráfico de barras: Variação mensal dos preços de automóveis leves usados — taxa mensal',
      caption: 'Variação mensal dos preços de automóveis usados. Fonte: Banco BV (IBV Auto), maio/2026.',
    },
    {
      type: 'heading',
      heading: 'Quais modelos mais subiram?',
      text: 'Texto sobre os modelos de destaque, com percentuais. Mencionar altas e baixas.',
    },
    {
      type: 'image',
      src: '/images/ibv/abril-2026/modelos-alta-baixa.png',
      alt: 'Modelos com maior alta e maior queda no IBV Auto de abril de 2026',
      caption: 'Modelos de destaque no IBV Auto de abril de 2026. Fonte: Banco BV.',
    },
    {
      type: 'heading',
      heading: 'E por região?',
      text: 'Texto sobre variação por região e estados de destaque. Usar \n\n para separar parágrafos.',
    },
    {
      type: 'image',
      src: '/images/ibv/abril-2026/variacao-por-uf.png',
      alt: 'Gráfico de barras com variação mensal por estado',
      caption: 'Variação mensal por estado (UF) — abril de 2026. Fonte: Banco BV (IBV Auto).',
    },
    {
      type: 'image',
      src: '/images/ibv/abril-2026/mapa-brasil-acumulado.png',
      alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado',
      caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto).',
    },
    // Adicione mais seções 'heading' conforme necessário (ex: elétricos, tendências)
    {
      type: 'highlight',
      heading: 'O que isso significa para você?',
      text: 'Análise prática: o que fazer se está vendendo ou comprando. Deve ser acionável.',
    },
    {
      type: 'cta',
      text: 'Quer saber quanto vale o seu carro hoje?',
      ctaLabel: 'Consultar Placa Grátis',
      ctaTo: '/',
    },
  ],
},
```

---

## 3. Template para o post "Vencedores e Perdedores"

Baixe o Excel, rode o Python abaixo para extrair os dados, depois escreva o conteúdo:

```bash
curl -sL "https://econoreports.bv.com.br/Projecoes/IBV_Auto.xlsx" -o /tmp/IBV_Auto.xlsx
```

```python
import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/tmp/IBV_Auto.xlsx', read_only=True, data_only=True)

def get_sheet_data(sheet_name):
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(values_only=True))
    headers = None
    data = []
    for i, row in enumerate(all_rows):
        non_none = [v for v in row if v is not None]
        if non_none and non_none[0] == 'Período':
            headers = list(row)
            for j in range(i+1, len(all_rows)):
                r = list(all_rows[j])
                if r[0] is not None and isinstance(r[0], datetime):
                    data.append(r)
    return headers, data

headers, data_mom = get_sheet_data('indice_de_precos_mom')
_, data_yoy = get_sheet_data('indice_de_precos_yoy')
_, data_lvl = get_sheet_data('indice_de_precos_nivel')

def by_month(data):
    return {(r[0].year, r[0].month): r for r in data if r[0] is not None}

mom_idx = by_month(data_mom)
yoy_idx = by_month(data_yoy)
lvl_idx = by_month(data_lvl)

# Change YEAR and MONTH here:
YEAR, MONTH = 2026, 4   # April 2026
PREV_MONTH = (YEAR, MONTH-1) if MONTH > 1 else (YEAR-1, 12)

target_mom = mom_idx[(YEAR, MONTH)]
target_yoy = yoy_idx[(YEAR, MONTH)]
target_lvl = lvl_idx[(YEAR, MONTH)]

state_headers = headers[7:]   # RO, AC, AM, ...
region_headers = headers[1:7] # BRASIL, Norte, Nordeste, Sudeste, Sul, Centro-Oeste

# State ranking
state_data = []
for i, h in enumerate(state_headers):
    col = i + 7
    state_data.append({
        'state': h,
        'mom': target_mom[col] or 0,
        'yoy': target_yoy[col] or 0,
        'lvl': target_lvl[col] or 0,
        'prev_mom': (mom_idx.get(PREV_MONTH) or [None]*34)[col] or 0,
    })

ranked = sorted(state_data, key=lambda x: x['mom'], reverse=True)

print("=== TOP 4 ===")
for r in ranked[:4]:
    print(f"  {r['state']}: MoM={r['mom']:.2f}% | YoY={r['yoy']:.2f}% | Prev={r['prev_mom']:.2f}% | Level={r['lvl']:.1f}")

print("\n=== BOTTOM 4 ===")
for r in ranked[-4:]:
    print(f"  {r['state']}: MoM={r['mom']:.2f}% | YoY={r['yoy']:.2f}% | Prev={r['prev_mom']:.2f}% | Level={r['lvl']:.1f}")

print("\n=== REGIONS ===")
for i, h in enumerate(region_headers):
    col = i + 1
    print(f"  {h}: MoM={target_mom[col] or 0:.2f}% | YoY={target_yoy[col] or 0:.2f}%")

# Trend: last 6 months for top 4 and bottom 4
print("\n=== TREND (last 6 months) ===")
months_recent = []
y, m = YEAR, MONTH
for _ in range(6):
    months_recent.insert(0, (y, m))
    m -= 1
    if m == 0: m = 12; y -= 1

for r in ranked[:4] + ranked[-4:]:
    si = headers.index(r['state'])
    vals = [f"{(mom_idx.get(ym) or [None]*34)[si]:+.2f}%" if (mom_idx.get(ym) or [None]*34)[si] else "N/A" for ym in months_recent]
    print(f"  {r['state']}: {' '.join(vals)}")
```

**Slug:** `vencedores-perdedores-{mes}-{ano}`

**Foco:** modelos de veículos, não estados. Os estados são contexto secundário no final.

**Dados de modelos:** vêm do gráfico `image_005` da página BV (infográfico de setas com 3 altas e 3 baixas). O Excel não tem dados por modelo — só por estado/região.

**Estrutura de seções:**
1. **intro** — IBV nacional do mês + gancho de dispersão entre modelos (diferença entre o maior vencedor e maior perdedor)
2. **image** — `modelos-alta-baixa.png` (infográfico com as 3 altas e 3 baixas)
3. **heading** "Os modelos que mais valorizaram" — análise por modelo: por que subiu? contexto de segmento, oferta/demanda, situação do zero-km, continuidade ou descontinuação
4. **heading** "Os modelos que mais perderam" — mesmo tratamento: por que caiu? descontinuação? pressão competitiva? perda de relevância no segmento?
5. **image** — `variacao-mensal.png` (contexto histórico do índice)
6. **heading** "O que une os vencedores — e o que separa os perdedores" — padrões estruturais: oferta escassa vs modelo descontinuado, zero-km como âncora de preço, etc.
7. **image** — `variacao-por-uf.png` (contexto regional, como item secundário)
8. **highlight** "O que fazer com essa informação?" — acionável por perfil (vendedor vs comprador, por modelo)
9. **cta** — consulta de placa

**Tom:** análise de dados, não jornalismo de release. Ir além do que o BV já mostra: contexto de descontinuação, pressão competitiva, dinâmica de oferta e demanda, comparação com o zero-km, trajetória dos últimos meses. Os números do BV são o ponto de partida, não o destino.

**Imagem extra necessária:** `variacao-por-uf-acumulado.png` — gráfico de barras YoY por UF (geralmente `image_007`). Copiar para `public/images/ibv/{mes}-{ano}/variacao-por-uf-acumulado.png`.

---

## 4. Atualizar o sitemap em `nuxt.config.ts`

Na seção `sitemap: { urls: [...] }`, adicione as duas novas URLs **junto às outras URLs do IBV**:

```typescript
// IBV Auto blog
"/ibv",
"/ibv/marco-2026",
"/ibv/abril-2026",   // ← adicionar
```

---

## 4. Estrutura do conteúdo e tom

### Tom editorial
- **Direto e informativo**, sem jargão excessivo
- **Números reais** do relatório (não arredondar, usar vírgula como decimal: `0,71%`, não `0.71%`)
- **Acionável**: o leitor deve saber o que fazer com a informação (vender? comprar? esperar?)
- Evitar superlativos vazios ("incríveis altas"). Deixar os números falar

### Estrutura padrão de seções
1. **intro** — 2-3 frases com variação mensal, comparação com mês anterior, acumulado 12 meses
2. **image** — gráfico variação mensal (barras por mês)
3. **heading** "Quais modelos mais subiram?" — top 3 altas + top 3 baixas com percentuais
4. **image** — infográfico modelos alta/baixa
5. **heading** "E por região?" — destaque Sudeste, Nordeste, estados líderes e retardatários
6. **image** — barras por UF
7. **image** — mapa do Brasil acumulado
8. **heading** "Elétricos/Tendência" — se o relatório trouxer dado relevante de segmento
9. **highlight** "O que isso significa para você?" — análise prática
10. **cta** — chamada para consulta de placa

### Links internos obrigatórios
- **CTA principal:** `/` (consulta de placa)
- **Link secundário no CTA:** `/tabela-fipe-por-placa`
- Dentro do texto: use `NuxtLink` apenas no componente Vue, não no conteúdo em `ibv-posts.ts`

---

## 5. SEO — requisitos por post

| Campo | Regra |
|---|---|
| `title` | Deve conter "IBV Auto {Mês} {Ano}" + o dado principal + gancho |
| `metaDescription` | 140–160 caracteres, incluir variação percentual e CTA implícito |
| `publishedAt` | Data real de publicação pelo BV (não a data de implementação) |
| Schema `BlogPosting` | Gerado automaticamente pelo `[slug].vue` — sem ação necessária |
| Schema `BreadcrumbList` | Gerado automaticamente — sem ação necessária |
| `og:type` | `article` — gerado automaticamente |
| `article:published_time` | Preenchido com `publishedAt` — automático |
| Alt text das imagens | Descritivo e específico: mencionar o tipo de gráfico e dado principal |

---

## 6. Referência — arquivos envolvidos

| Arquivo | Função |
|---|---|
| `data/ibv-posts.ts` | Todos os posts e seu conteúdo estruturado |
| `pages/ibv/index.vue` | Página de listagem `/ibv` — **não precisa alterar por post** |
| `pages/ibv/[slug].vue` | Página de post — **não precisa alterar por post** |
| `public/images/ibv/{mes}-{ano}/` | Imagens do post (gráficos do BV) |
| `nuxt.config.ts` | Sitemap — adicionar as novas URLs |

---

## 7. Exemplo real — Março 2026

- **Relatório BV:** https://www.bv.com.br/economia/relatorios/ibv-marco-2026
- **Publicado em:** 07/04/2026
- **CDN das imagens:** `https://econoreports.bv.com.br/20260407/IBV/image_NNN.png`
- **Imagens usadas:**
  - `image_002.png` → `variacao-mensal.png`
  - `image_005.png` → `modelos-alta-baixa.png`
  - `image_006.png` → `variacao-por-uf.png`
  - `image_008.png` → `mapa-brasil-acumulado.png`
- **Slug:** `marco-2026`
- **URL final:** `/ibv/marco-2026`

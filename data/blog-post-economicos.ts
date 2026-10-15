import type { BlogPost, BlogSection } from './blog-posts'
import { estudoModelos, combinado, custoKm, pearson, brl, brl2, kml, PRECO_GASOLINA, PRECO_ETANOL } from './estudo-economicos'
import type { Cat } from './estudo-economicos'

// Todos os numeros do texto saem de data/estudo-economicos.ts (ver tests/estudo-economicos.test.ts).

const MEDIA = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const MEDIANA = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

const linhas = estudoModelos.map((m) => ({
  ...m,
  gasKml: combinado(m.gasolina),
  etaKml: combinado(m.etanol),
  cGas: custoKm(m, 'gasolina'),
  cEta: custoKm(m, 'etanol'),
}))

function tabela(cat: Cat): BlogSection {
  const rows = linhas
    .filter((l) => l.cat === cat)
    .sort((a, b) => a.cGas - b.cGas)
    .map((l) => [l.modelo, String(l.anoModelo), brl(l.fipe), kml(l.gasKml), kml(l.etaKml), brl2(l.cGas), brl2(l.cEta), brl(l.cGas * 12000)])
  return {
    type: 'table',
    columns: ['Modelo e versão', 'Ano', 'FIPE out/2026', 'km/l gasolina', 'km/l etanol', 'R$/km gasolina', 'R$/km etanol', 'R$/ano gasolina (12 mil km)'],
    rows,
    caption: 'Ordenado do menor para o maior custo por km com gasolina. Consumo combinado (55% cidade, 45% estrada) calculado a partir da tabela PBEV do Inmetro do ano-modelo. Preço FIPE do mesmo ano-modelo e versão, referência outubro de 2026.',
  }
}

const porCat = (c: Cat) => linhas.filter((l) => l.cat === c)
const precos = linhas.map((l) => l.fipe)
const r = pearson(precos, linhas.map((l) => l.gasKml))
const ordenadoPreco = [...linhas].sort((a, b) => a.fipe - b.fipe)
const metade = Math.floor(ordenadoPreco.length / 2)
const barata = ordenadoPreco.slice(0, metade)
const cara = ordenadoPreco.slice(metade)
const melhor = [...linhas].sort((a, b) => a.cGas - b.cGas)[0]
const pior = [...linhas].sort((a, b) => b.cGas - a.cGas)[0]
const mediana = MEDIANA(linhas.map((l) => l.cGas))
const anual = (c: number, kmMes: number) => brl(c * kmMes * 12)
const get = (nome: string) => linhas.find((l) => l.modelo === nome)!
const pulse = get('Fiat Pulse Drive 1.3 manual')
const tracker = get('Chevrolet Tracker 1.0 turbo')
const duster = get('Renault Duster Zen 1.6 manual')
const tcross = get('VW T-Cross 200 TSI')
const kwid = get('Renault Kwid Zen 1.0')
const rEta = PRECO_ETANOL / PRECO_GASOLINA

const kmMeses = [500, 1000, 1500, 2000]

export const postEconomicos: BlogPost = {
  slug: 'carros-usados-mais-economicos',
  title: 'Carros usados mais econômicos: consumo do Inmetro cruzado com o preço FIPE',
  seoTitles: [
    'Carros usados mais econômicos: consumo e custo por km',
    'Carros usados mais econômicos: custo por km e FIPE',
    'Carros usados mais econômicos: ranking com FIPE',
  ],
  metaDescription: `Estudo com 27 carros usados: consumo do Inmetro x preço FIPE, custo por km (${brl2(melhor.cGas)} a ${brl2(pior.cGas)}), economia por ano e se carro barato gasta mais.`,
  publishedAt: '2026-10-15',
  categoria: 'Estudos',
  capa: {
    src: '/images/blog/carros-usados-mais-economicos.png',
    og: '/images/blog/carros-usados-mais-economicos-1200.png',
    alt: 'Estudo PlacaCompleta: carros usados mais econômicos. Gráfico de barras com o custo por km com gasolina, de R$ 0,42 (Kwid) a R$ 0,61 (Creta 1.6).',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: `Cruzamos o consumo oficial do Inmetro com o preço da Tabela FIPE de **27 versões de carros usados (2022 a 2024)** e chegamos a três números. **Primeiro:** o custo de abastecer vai de ${brl2(melhor.cGas)} a ${brl2(pior.cGas)} por km com gasolina. **Segundo:** quem roda 1.000 km por mês paga até ${brl(pior.cGas * 12000 - melhor.cGas * 12000)} a mais por ano no carro menos econômico da lista do que no mais econômico. **Terceiro:** carro mais barato não gasta mais, ao contrário: na amostra, a correlação entre preço FIPE e km/l é de ${r.toFixed(2).replace('.', ',')}, ou seja, os mais caros tendem a render menos por litro, por causa do porte e do motor. Abaixo estão as tabelas, a metodologia e as fontes.`,
    },
    {
      type: 'heading',
      heading: 'O que o estudo mostra, em resumo',
      text: `- **Hatches** somam a melhor média: ${kml(MEDIA(porCat('Hatch').map((l) => l.gasKml)))} km/l combinados com gasolina e ${brl2(MEDIA(porCat('Hatch').map((l) => l.cGas)))} por km.\n- **Sedãs** vêm logo atrás: ${kml(MEDIA(porCat('Sedã').map((l) => l.gasKml)))} km/l e ${brl2(MEDIA(porCat('Sedã').map((l) => l.cGas)))} por km.\n- **SUVs** gastam mais: ${kml(MEDIA(porCat('SUV').map((l) => l.gasKml)))} km/l e ${brl2(MEDIA(porCat('SUV').map((l) => l.cGas)))} por km.\n- **Metade mais barata** da amostra (preço médio de ${brl(MEDIA(barata.map((l) => l.fipe)))}) faz ${kml(MEDIA(barata.map((l) => l.gasKml)))} km/l. **Metade mais cara** (média de ${brl(MEDIA(cara.map((l) => l.fipe)))}) faz ${kml(MEDIA(cara.map((l) => l.gasKml)))} km/l.\n- Com etanol a ${brl2(PRECO_ETANOL)} e gasolina a ${brl2(PRECO_GASOLINA)}, o etanol saiu mais barato por km em todos os 27 modelos.`,
    },
    {
      type: 'heading',
      heading: 'Como fizemos a conta (metodologia)',
      text: `Para que os números sejam verificáveis, cada etapa usa uma fonte pública:\n\n1. **Consumo:** tabelas do Programa Brasileiro de Etiquetagem Veicular ([PBEV, do Inmetro](https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular)), em km/l na cidade e na estrada, com etanol e com gasolina. Cada carro usa a tabela do seu ano-modelo: [2022](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/pbe-veicular-2022.pdf/@@download/file), [2023](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/pbe-veicular-2023.pdf/@@download/file) ou [2024](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/pbe-veicular-2024-1.pdf/@@download/file).\n2. **Consumo combinado:** média harmônica com 55% de cidade e 45% de estrada. É a mesma fórmula do Inmetro: ela reproduziu a coluna "combinado" em 261 de 261 versões flex da tabela de 2026.\n3. **Preço:** [Tabela FIPE](https://veiculos.fipe.org.br), referência de outubro de 2026, do mesmo ano-modelo e da mesma versão do carro etiquetado.\n4. **Combustível:** [síntese semanal da ANP](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arq-sintese-semanal/2026/sintese-precos-41.pdf), edição 41/2026 (semana de 4 a 10 de outubro): gasolina a ${brl2(PRECO_GASOLINA)} e etanol a ${brl2(PRECO_ETANOL)} por litro, médias nacionais.\n5. **Custo por km:** preço do litro dividido pelo km/l combinado. **Custo por ano:** custo por km vezes 12.000 km.\n\nLimites do estudo: são 27 versões flex populares de 2022 a 2024, não o mercado inteiro. O Inmetro mede em laboratório (norma ABNT NBR 7024) e a própria tabela informa que os valores são ajustados para simular condições mais comuns de uso. Na rua, o seu consumo muda com trânsito, carga, ar-condicionado e estilo de condução. Os preços FIPE e do combustível mudam toda semana ou todo mês: use a conta como ordem de grandeza.`,
    },
    {
      type: 'heading',
      heading: 'Hatches usados mais econômicos',
      text: `Entre os hatches, o **${kwid.modelo}** e o **Onix LT 1.0 manual** lideram, com cerca de 15 km/l combinados com gasolina. Todos os oito ficam na faixa de 13,7 a 15,5 km/l, e a diferença entre o primeiro e o último é de ${brl((get('Citroën C3 Feel 1.0').cGas - kwid.cGas) * 12000)} por ano em 12 mil km. Um aviso sobre o Kwid: a tabela de 2024 traz 15,3 km/l na cidade com gasolina, mas as tabelas de 2025 e 2026 trazem 14,4 km/l para as versões atuais, e o [site da Renault](https://www.renault.com.br/veiculos-de-passeio/kwid/motorizacao.html) usa esse valor mais recente. Confira sempre a versão e o ano do carro que você vai comprar.`,
    },
    tabela('Hatch'),
    {
      type: 'heading',
      heading: 'Sedãs usados mais econômicos',
      text: `Entre os sedãs, o **Onix Plus LT 1.0 manual** foi o mais econômico da amostra, com ${kml(get('Chevrolet Onix Plus LT 1.0 manual').gasKml)} km/l combinados. A [Chevrolet afirma, em comunicado de 2023,](https://news.chevrolet.com.br/newsroom.detail.html/Pages/news/br/pt/2023/feb/0203-pelo.html) que o Onix Plus foi o carro mais econômico do Brasil pelo quarto ano seguido, segundo o Inmetro. A tabela mostra o motivo: o consumo na estrada do modelo é ${kml(get('Chevrolet Onix Plus LT 1.0 manual').gasolina[1])} km/l com gasolina, o melhor valor de estrada da nossa lista. O **Corolla XEi 2.0** custa ${brl(get('Toyota Corolla XEi 2.0').fipe)}, mais que o dobro do Onix Plus, e rende ${kml(get('Toyota Corolla XEi 2.0').gasKml)} km/l: bom para um 2.0 automático, mas não é um carro barato de abastecer em relação aos sedãs 1.0.`,
    },
    tabela('Sedã'),
    {
      type: 'heading',
      heading: 'SUVs usados mais econômicos',
      text: `SUV costuma gastar mais por ser mais pesado e ter mais área frontal, e os dados confirmam: a média da categoria é ${kml(MEDIA(porCat('SUV').map((l) => l.gasKml)))} km/l, contra ${kml(MEDIA(porCat('Hatch').map((l) => l.gasKml)))} dos hatches. Mas há diferença grande dentro da categoria. O **${pulse.modelo}** faz ${kml(pulse.gasKml)} km/l e custa ${brl(pulse.fipe)}. O **${tracker.modelo}** faz ${kml(tracker.gasKml)} km/l e custa ${brl(tracker.fipe)}. Ou seja, o Pulse é ${brl(tracker.fipe - pulse.fipe)} mais barato e ainda economiza cerca de ${brl((tracker.cGas - pulse.cGas) * 12000)} por ano em combustível (12 mil km). Já o motor 1.6 aspirado (Creta Action) e os 1.3 turbo (Compass e Captur) ficam no fim da lista, com ${kml(pior.gasKml)} a ${kml(get('Renault Captur Zen 1.3 turbo').gasKml)} km/l.`,
    },
    tabela('SUV'),
    {
      type: 'heading',
      heading: 'Quanto você economiza por ano, conforme os km rodados',
      text: `A economia depende de quanto você roda. A tabela abaixo mostra o gasto anual com gasolina (${brl2(PRECO_GASOLINA)} por litro) para três referências da amostra: o mais econômico (${melhor.modelo}), a mediana (${brl2(mediana)} por km) e o menos econômico (${pior.modelo}).`,
    },
    {
      type: 'table',
      columns: ['Km por mês', `${melhor.modelo}`, `Mediana (${brl2(mediana)}/km)`, `${pior.modelo}`, 'Diferença entre extremos por ano'],
      rows: kmMeses.map((k) => [
        k.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km',
        anual(melhor.cGas, k),
        anual(mediana, k),
        anual(pior.cGas, k),
        brl((pior.cGas - melhor.cGas) * k * 12),
      ]),
      caption: 'Gasto anual com gasolina = custo por km x km por mês x 12. Valores em reais, com o preço médio nacional da ANP (edição 41/2026).',
    },
    {
      type: 'intro',
      text: `Um cuidado de quem compra: a economia de combustível raramente paga a diferença de preço entre carros de classes diferentes. Entre o ${melhor.modelo} e o ${pior.modelo} a diferença de FIPE é de ${brl(pior.fipe - melhor.fipe)}, e a economia anual de abastecimento a 1.000 km por mês é de ${brl((pior.cGas - melhor.cGas) * 12000)}: seriam cerca de ${Math.round((pior.fipe - melhor.fipe) / ((pior.cGas - melhor.cGas) * 12000))} anos para compensar. Use o consumo para desempatar carros do mesmo porte e faixa de preço, não para justificar a troca de classe.`,
    },
    {
      type: 'heading',
      heading: 'Carro mais barato gasta mais? O que a correlação mostra',
      text: `Cruzamos o preço FIPE de cada versão com o consumo combinado de gasolina. O coeficiente de correlação de Pearson ficou em **${r.toFixed(2).replace('.', ',')}** para as 27 versões: quanto maior o preço, menor o km/l. Em termos práticos:\n\n- A metade mais barata da amostra faz **${kml(MEDIA(barata.map((l) => l.gasKml)))} km/l** e custa ${brl2(MEDIA(barata.map((l) => l.cGas)))} por km.\n- A metade mais cara faz **${kml(MEDIA(cara.map((l) => l.gasKml)))} km/l** e custa ${brl2(MEDIA(cara.map((l) => l.cGas)))} por km, uma diferença de cerca de ${brl((MEDIA(cara.map((l) => l.cGas)) - MEDIA(barata.map((l) => l.cGas))) * 12000)} por ano em 12 mil km.\n\nOu seja, **carro barato não é carro beberrão**: os modelos de entrada são leves e têm motor pequeno. Mas isso não é uma lei do mercado, e sim um efeito do porte. A explicação está na composição da amostra: os mais caros são SUVs e sedãs maiores. Dentro da mesma categoria a relação é mais fraca: correlação de ${pearson(porCat('Hatch').map((l) => l.fipe), porCat('Hatch').map((l) => l.gasKml)).toFixed(2).replace('.', ',')} nos hatches, ${pearson(porCat('Sedã').map((l) => l.fipe), porCat('Sedã').map((l) => l.gasKml)).toFixed(2).replace('.', ',')} nos sedãs e ${pearson(porCat('SUV').map((l) => l.fipe), porCat('SUV').map((l) => l.gasKml)).toFixed(2).replace('.', ',')} nos SUVs. Com poucos carros por categoria, trate esses valores como indicativos.\n\nHá exceções nos dois sentidos. O ${duster.modelo} custa ${brl(duster.fipe)} e rende ${kml(duster.gasKml)} km/l, menos que o ${tcross.modelo}, que custa ${brl(tcross.fipe)} e rende ${kml(tcross.gasKml)} km/l. Pagar mais não garante gastar menos, e pagar menos não garante economia: confira a versão.`,
    },
    {
      type: 'heading',
      heading: 'Etanol ou gasolina: qual compensa nas contas do estudo',
      text: `Com os preços médios da ANP, o litro do etanol custa **${Math.round(rEta * 100)}% do da gasolina**. Nos 27 modelos, o etanol rende entre 69% e 73% do que a gasolina rende. Enquanto o preço do etanol ficar abaixo de cerca de 70% do preço da gasolina, ele sai mais barato por km. Em 12 mil km por ano, a diferença para o mesmo carro foi de ${brl((kwid.cGas - kwid.cEta) * 12000)} no ${kwid.modelo} e de ${brl((pior.cGas - pior.cEta) * 12000)} no ${pior.modelo}. O preço do etanol varia muito entre regiões e semanas, então refaça a conta no posto: divida o preço do etanol pelo da gasolina e compare com 0,70.`,
    },
    {
      type: 'heading',
      heading: 'O que o Inmetro, o Conpet e as montadoras dizem',
      text: `O consumo oficial vem do [Programa Brasileiro de Etiquetagem Veicular](https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular), coordenado pelo Inmetro com o [Conpet](http://www.conpet.gov.br/portal/conpet/pt_br/conteudo-gerais/etiquetagem-veicular.shtml). A etiqueta classifica os carros de A (mais eficiente) a E (menos eficiente), na categoria e no ranking geral, e informa os km/l na cidade e na estrada. As montadoras publicam esses números em seus sites: a [Fiat explica o programa e a etiqueta](https://www.fiat.com.br/institucional/eficiencia_energetica.html), a [Hyundai hospeda uma versão da tabela PBEV](https://www.hyundai.com.br/content/dam/hmb/ibama/Tabela_PBEV-2024-30-SET_2.pdf) e a [Renault informa o consumo do Kwid e o selo Conpet](https://www.renault.com.br/veiculos-de-passeio/kwid/motorizacao.html). Os números são os mesmos que aparecem na etiqueta colada no carro novo, por isso são a melhor base de comparação entre modelos.`,
    },
    {
      type: 'heading',
      heading: 'Como conferir o consumo antes de comprar um usado',
      text: `Antes de fechar negócio, faça este roteiro:\n\n1. **Identifique a versão exata:** motor, câmbio e ano-modelo. Um mesmo modelo pode ter consumo diferente entre versões (manual e automático, aspirado e turbo).\n2. **Procure a versão na tabela PBEV** do ano-modelo, nos links acima, e anote cidade e estrada.\n3. **Cheque o preço na FIPE** e compare com o anúncio. Use a [tabela FIPE por placa](/tabela-fipe-por-placa) para ver o valor da versão certa.\n4. **Teste na rua:** zere o computador de bordo, rode um trecho de cidade e um de estrada e compare com a tabela. Uma diferença grande pode indicar pneus descalibrados, injeção suja, velas gastas ou problema mecânico.\n5. **Confira o histórico do carro:** consumo baixo não adianta se há leilão, gravame ou débito escondido. Veja o [histórico veicular](/historico-veicular) e o que significa [gravame](/o-que-e/gravame) antes de pagar sinal.\n6. **Peça a manutenção em dia:** troca de óleo, filtros e pneus influenciam o consumo.`,
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes sobre carros usados econômicos',
      faq: [
        {
          q: 'Qual é o carro usado mais econômico?',
          a: `Na nossa amostra de 27 versões flex de 2022 a 2024, o ${kwid.modelo}, o Onix Plus 1.0 manual e o Onix 1.0 manual lideram, com cerca de 15 km/l combinados com gasolina (tabelas PBEV do Inmetro). O resultado depende da versão e do ano-modelo, então confirme na tabela.`,
        },
        {
          q: 'Carro mais barato gasta mais combustível?',
          a: `Não. Na amostra, os carros mais baratos foram os mais econômicos: a metade mais barata faz ${kml(MEDIA(barata.map((l) => l.gasKml)))} km/l e a metade mais cara faz ${kml(MEDIA(cara.map((l) => l.gasKml)))} km/l. O que aumenta o consumo é o porte e o motor, não o preço baixo.`,
        },
        {
          q: 'Quanto se economiza por ano com um carro mais econômico?',
          a: `Depende dos km rodados. A 1.000 km por mês, a diferença entre o mais e o menos econômico da amostra foi de ${brl((pior.cGas - melhor.cGas) * 12000)} por ano com gasolina. A 500 km por mês, ${brl((pior.cGas - melhor.cGas) * 6000)}.`,
        },
        {
          q: 'Etanol ou gasolina: qual sai mais barato por km?',
          a: `Quando o etanol custa menos de cerca de 70% do preço da gasolina, ele sai mais barato por km. Com as médias nacionais da ANP de outubro de 2026 (etanol a ${brl2(PRECO_ETANOL)} e gasolina a ${brl2(PRECO_GASOLINA)}), o etanol compensou nos 27 modelos.`,
        },
        {
          q: 'O consumo do Inmetro é o consumo real?',
          a: 'Não exatamente. É medido em laboratório e ajustado para simular condições comuns de uso. O consumo real varia com trânsito, carga, ar-condicionado, estado do carro e estilo de condução, mas a tabela é a melhor base para comparar modelos.',
        },
        {
          q: 'Como descobrir o consumo de um carro usado específico?',
          a: 'Identifique a versão e o ano-modelo e procure na tabela PBEV do Inmetro daquele ano, publicada no site do programa. Compare também o preço do anúncio com a Tabela FIPE da mesma versão.',
        },
      ],
    },
    {
      type: 'cta',
      text: 'Achou o carro certo? Antes de fechar negócio, consulte a placa: a consulta grátis mostra sinais de alerta e a consulta completa traz o histórico, com registro de leilão, gravame e débitos.',
      ctaLabel: 'Consultar placa grátis',
      ctaTo: '/consulta-gratis',
    },
  ],
}

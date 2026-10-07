import { BASE_LEILAO_TEXTO } from './base-leilao'
// Blocos regionais e de paginas genericas, mesma razao de existir do
// shared/fipe-enriquecimento.ts: dar a cada pagina algo que so ela tem.
//
// Aqui a chave e a UF (nao a cidade), porque o dado de leilao que temos e
// estadual: a pagina de Curitiba e a do Parana falam do mesmo agregado, e
// inventar um recorte municipal que a base nao sustenta seria numero bonito e
// falso. Texto do seo.

export interface FaqItem {
  pergunta: string
  resposta: string
}

export interface BlocoRegional {
  titulo: string
  texto: string
  faq: FaqItem[]
}

/** Por UF. A pagina de capital usa a UF dela. */
export const REGIONAL: Record<string, BlocoRegional> = {
  PR: {
    titulo: 'Leilões de veículos no Paraná',
    texto: 'Nossa base de leilões registra mais de 167 mil veículos leiloados no Paraná ao longo dos anos, incluindo carros e motos. Entre os carros, os modelos mais frequentes na base são o Volkswagen Gol (quase 8 mil registros), o Fiat Uno (cerca de 4 mil) e modelos mais antigos como Chevrolet Chevette e Monza, refletindo o perfil histórico da frota do estado. Antes de comprar um usado em Curitiba ou em qualquer cidade do Paraná, consultar a placa cruza o veículo específico com esses registros e retorna um indício de passagem por leilão, quando existir.',
    faq: [
      { pergunta: 'Como consultar se um carro de Curitiba já foi de leilão?', resposta: 'Pela placa do veículo, numa consulta que cruza com a base de registros de leilão, incluindo os do Paraná.' },
      { pergunta: 'O Paraná tem muitos veículos de leilão registrados?', resposta: 'Sim, é um dos estados com mais registros na nossa base, o que reflete tanto o tamanho da frota quanto o volume histórico de leilões no estado.' },
      { pergunta: 'Onde fica o DETRAN de Curitiba?', resposta: 'As informações de atendimento do órgão de trânsito estadual do Paraná estão disponíveis no site oficial do governo do estado.' },
    ],
  },
  CE: {
    titulo: 'Leilões de veículos no Ceará',
    // Contagem de 03/out/2026 (leilao_index, uf_fonte CE, sem notificacoes): 7.436
    // veiculos distintos em 7.627 registros de leilao de edital do DETRAN-CE,
    // 2016 a 2022; mais 82.545 notificacoes de leilao, que nao entram aqui.
    texto: 'Nossa base registra cerca de 7,4 mil veículos leiloados no Ceará entre 2016 e 2022, em editais do DETRAN-CE. É um volume bem menor que estados como Paraná ou Minas Gerais, o que reflete tanto o tamanho da frota quanto a cobertura de coleta de dados disponível até agora. No Ceará, os mais frequentes são motos: Honda CG, Yamaha Factor e Yamaha YBR lideram a lista. Se você está comprando um usado no Ceará, vale consultar a placa do veículo específico antes de fechar negócio.',
    faq: [
      { pergunta: 'Como saber se um carro do Ceará já foi de leilão?', resposta: 'Pela consulta de placa, que cruza com a base nacional de registros de leilão, incluindo os do Ceará.' },
      { pergunta: 'A base de leilões do Ceará é menor que a de outros estados?', resposta: 'Sim, atualmente. Isso não significa que existem menos leilões no estado, pode refletir cobertura de coleta ainda em expansão.' },
      { pergunta: 'Onde fica o DETRAN do Ceará?', resposta: 'As informações de atendimento do órgão de trânsito estadual do Ceará estão disponíveis no site oficial do governo do estado.' },
    ],
  },
}

export interface BlocoPagina {
  titulo: string
  texto: string
  faq: FaqItem[]
}

/** Paginas genericas, por rota. */
export const GENERICAS: Record<string, BlocoPagina> = {
  '/consulta-placa': {
    titulo: 'O que você recebe na consulta de placa',
    texto: `A consulta de placa gratuita mostra marca, modelo, ano de fabricação e do modelo, cor e o início do número do chassi, direto na tela, sem cadastro. Pra quem precisa de mais detalhe antes de negociar um veículo, o relatório completo cruza a mesma placa com indicadores de restrição, indicador de roubo e furto, gravame e indício de passagem por leilão, reunidos numa base com ${BASE_LEILAO_TEXTO}.`,
    faq: [
      { pergunta: 'A consulta de placa é realmente gratuita?', resposta: 'A consulta básica sim, mostra marca, modelo, ano e cor sem custo. Informações de restrição, roubo e furto, gravame e leilão fazem parte do relatório completo, pago.' },
      { pergunta: 'A consulta de placa funciona pra qualquer veículo?', resposta: 'Funciona pra carros, motos e a maioria dos veículos com placa registrada no Brasil.' },
      { pergunta: 'Preciso me cadastrar pra consultar uma placa?', resposta: 'Não, a consulta básica é feita direto, sem necessidade de cadastro prévio.' },
    ],
  },
  '/consultar-placa-de-van': {
    titulo: 'O que verificar numa van usada',
    texto: 'Vans usadas têm particularidades que vale checar além do que uma consulta genérica de placa mostra: categoria do veículo (passageiro ou carga, isso muda a documentação exigida), lotação registrada, histórico de uso comercial (frota, transporte de passageiros, entrega), e o mesmo conjunto de indicadores de qualquer veículo, restrição, gravame, indício de roubo e furto e passagem por leilão. Vans com uso comercial intenso tendem a ter desgaste maior que a média, então a checagem de histórico pesa ainda mais na decisão de compra.',
    faq: [
      { pergunta: 'Como saber a categoria de uma van pela placa?', resposta: 'A consulta pela placa traz o tipo de veículo registrado (passageiro ou carga), que ajuda a confirmar se bate com o uso que você pretende dar.' },
      { pergunta: 'Van de uso comercial tem mais risco de restrição?', resposta: 'Pode ter, pelo uso mais intenso. Por isso vale sempre consultar o histórico antes de comprar uma van usada de origem comercial.' },
      { pergunta: 'A consulta de van mostra se ela já foi de leilão?', resposta: `O relatório completo cruza a placa com nossa base de ${BASE_LEILAO_TEXTO} e retorna um indício de passagem, quando existir registro compatível.` },
    ],
  },
}

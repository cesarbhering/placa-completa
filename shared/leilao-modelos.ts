// Dados das 19 paginas de "[Modelo] de leilao" (/carro-de-leilao/{slug}).
//
// Um arquivo de dados e um template so, em vez de 19 paginas escritas a mao: a
// anatomia e identica em todas, so os numeros e o nome mudam. Escrever 19
// arquivos garantiria que, no dia em que a regra de exibicao mudasse, alguma
// delas ficaria pra tras.
//
// Os numeros vem do levantamento do seo sobre o leilao_index (1.617.965
// registros com marca e modelo). Nao sao estimativa nem projecao: e a contagem
// do que a base tem hoje. Quando ela crescer, atualize aqui e as 19 paginas
// mudam juntas.
//
// AO REGERAR: exclua `situacao = 'notificado'` (detalhes.tipo_registro =
// 'notificacao_leilao'). Desde 30/set o indice tem editais de NOTIFICACAO do
// DETRAN (34,5 mil so do RJ), que nao sao leilao realizado e inflariam
// "passagens em leilao". Os numeros abaixo sao de 07/set, antes disso.
//
// DUAS REGRAS DE EXIBICAO, definidas pelo Cesar, aplicadas no template e nao
// no texto (ver pages/carro-de-leilao/[slug].vue):
//   1. percentual de sucata e recuperavel so aparece com amostra de desfecho
//      >= 300. Abaixo disso o numero existe, mas nao significa nada, e numero
//      sem significado numa pagina publica vira citacao errada em outro lugar.
//   2. valor medio de arremate so aparece com >= 100 lotes com valor, e sempre
//      rotulado como historico. Ele NUNCA aparece ao lado da FIPE: um e preco
//      de arremate no dia do leilao, o outro e referencia de mercado hoje, e
//      juntos viram uma comparacao que ninguem fez.

export interface FaqModelo {
  pergunta: string
  resposta: string
}

export interface ModeloLeilao {
  /** Slug da URL: /carro-de-leilao/{slug} */
  slug: string
  /** Como o modelo e chamado no texto corrido ("Gol", "T-Cross"). */
  nome: string
  /** Marca e modelo, pro primeiro paragrafo ("Volkswagen Gol"). */
  nomeCompleto: string
  title: string
  description: string
  h1: string
  intro: string
  /** Passagens por leilao registradas na base. */
  registros: number
  anoDe: number
  anoAte: number
  /** Registros com desfecho informado. Abaixo de 300, os percentuais somem. */
  desfechoAmostra: number
  pctSucata: number | null
  pctRecuperavel: number | null
  /** Lotes com valor de arremate. Abaixo de 100, o valor medio some. */
  lotesComValor: number
  valorMedioReais: number | null
  faq: FaqModelo[]
}

/** Amostra minima pra publicar percentual de desfecho. */
export const MINIMO_DESFECHO = 300
/** Amostra minima pra publicar valor medio de arremate. */
export const MINIMO_LOTES_VALOR = 100

export const MODELOS_LEILAO: ModeloLeilao[] = [
  {
    "slug": "gol",
    "nome": "Gol",
    "nomeCompleto": "Volkswagen Gol",
    "title": "Gol de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Volkswagen Gol de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Gol que você vai comprar já passou por um leilão.",
    "h1": "Gol de leilão: como saber se o seu Gol já passou por um",
    "intro": "O Volkswagen Gol é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Gol tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Gol usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 74143,
    "anoDe": 1980,
    "anoAte": 2022,
    "desfechoAmostra": 35216,
    "pctSucata": 59,
    "pctRecuperavel": 18,
    "lotesComValor": 24403,
    "valorMedioReais": 4854,
    "faq": [
      {
        "pergunta": "Todo Gol de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Gol recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Gol específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Gol de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "uno",
    "nome": "Uno",
    "nomeCompleto": "Fiat Uno",
    "title": "Uno de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Fiat Uno de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Uno que você vai comprar já passou por um leilão.",
    "h1": "Uno de leilão: como saber se o seu Uno já passou por um",
    "intro": "O Fiat Uno é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Uno tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Uno usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 42998,
    "anoDe": 1978,
    "anoAte": 2021,
    "desfechoAmostra": 24462,
    "pctSucata": 63,
    "pctRecuperavel": 15,
    "lotesComValor": 9775,
    "valorMedioReais": 2992,
    "faq": [
      {
        "pergunta": "Todo Uno de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Uno recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Uno específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Uno de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "palio",
    "nome": "Palio",
    "nomeCompleto": "Fiat Palio",
    "title": "Palio de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Fiat Palio de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Palio que você vai comprar já passou por um leilão.",
    "h1": "Palio de leilão: como saber se o seu Palio já passou por um",
    "intro": "O Fiat Palio é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Palio tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Palio usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 37369,
    "anoDe": 1981,
    "anoAte": 2021,
    "desfechoAmostra": 15498,
    "pctSucata": 57,
    "pctRecuperavel": 21,
    "lotesComValor": 11582,
    "valorMedioReais": 5215,
    "faq": [
      {
        "pergunta": "Todo Palio de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Palio recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Palio específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Palio de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "corsa",
    "nome": "Corsa",
    "nomeCompleto": "Chevrolet Corsa",
    "title": "Corsa de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet Corsa de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Corsa que você vai comprar já passou por um leilão.",
    "h1": "Corsa de leilão: como saber se o seu Corsa já passou por um",
    "intro": "O Chevrolet Corsa é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Corsa tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Corsa usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 33710,
    "anoDe": 1971,
    "anoAte": 2021,
    "desfechoAmostra": 13183,
    "pctSucata": 49,
    "pctRecuperavel": 17,
    "lotesComValor": 9374,
    "valorMedioReais": 2916,
    "faq": [
      {
        "pergunta": "Todo Corsa de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Corsa recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Corsa específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Corsa de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "celta",
    "nome": "Celta",
    "nomeCompleto": "Chevrolet Celta",
    "title": "Celta de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet Celta de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Celta que você vai comprar já passou por um leilão.",
    "h1": "Celta de leilão: como saber se o seu Celta já passou por um",
    "intro": "O Chevrolet Celta é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Celta tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Celta usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 15869,
    "anoDe": 1983,
    "anoAte": 2018,
    "desfechoAmostra": 4930,
    "pctSucata": 46,
    "pctRecuperavel": 21,
    "lotesComValor": 4728,
    "valorMedioReais": 4753,
    "faq": [
      {
        "pergunta": "Todo Celta de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Celta recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Celta específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Celta de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "voyage",
    "nome": "Voyage",
    "nomeCompleto": "Volkswagen Voyage",
    "title": "Voyage de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Volkswagen Voyage de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Voyage que você vai comprar já passou por um leilão.",
    "h1": "Voyage de leilão: como saber se o seu Voyage já passou por um",
    "intro": "O Volkswagen Voyage é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Voyage tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Voyage usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 8111,
    "anoDe": 1980,
    "anoAte": 2022,
    "desfechoAmostra": 3095,
    "pctSucata": 73,
    "pctRecuperavel": 9,
    "lotesComValor": 2012,
    "valorMedioReais": 10017,
    "faq": [
      {
        "pergunta": "Todo Voyage de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Voyage recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Voyage específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Voyage de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "strada",
    "nome": "Strada",
    "nomeCompleto": "Fiat Strada",
    "title": "Strada de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Fiat Strada de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Strada que você vai comprar já passou por um leilão.",
    "h1": "Strada de leilão: como saber se o seu Strada já passou por um",
    "intro": "O Fiat Strada é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Strada tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Strada usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 7473,
    "anoDe": 1992,
    "anoAte": 2026,
    "desfechoAmostra": 1570,
    "pctSucata": 65,
    "pctRecuperavel": 23,
    "lotesComValor": 4024,
    "valorMedioReais": 30980,
    "faq": [
      {
        "pergunta": "Todo Strada de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Strada recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Strada específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Strada de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "vectra",
    "nome": "Vectra",
    "nomeCompleto": "Chevrolet Vectra",
    "title": "Vectra de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet Vectra de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Vectra que você vai comprar já passou por um leilão.",
    "h1": "Vectra de leilão: como saber se o seu Vectra já passou por um",
    "intro": "O Chevrolet Vectra é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Vectra tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Vectra usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 6419,
    "anoDe": 1988,
    "anoAte": 2011,
    "desfechoAmostra": 2651,
    "pctSucata": 52,
    "pctRecuperavel": 19,
    "lotesComValor": 2280,
    "valorMedioReais": 4184,
    "faq": [
      {
        "pergunta": "Todo Vectra de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Vectra recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Vectra específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Vectra de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "saveiro",
    "nome": "Saveiro",
    "nomeCompleto": "Volkswagen Saveiro",
    "title": "Saveiro de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Volkswagen Saveiro de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Saveiro que você vai comprar já passou por um leilão.",
    "h1": "Saveiro de leilão: como saber se o seu Saveiro já passou por um",
    "intro": "O Volkswagen Saveiro é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Saveiro tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Saveiro usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 6067,
    "anoDe": 1980,
    "anoAte": 2026,
    "desfechoAmostra": 1901,
    "pctSucata": 69,
    "pctRecuperavel": 20,
    "lotesComValor": 2521,
    "valorMedioReais": 18128,
    "faq": [
      {
        "pergunta": "Todo Saveiro de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Saveiro recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Saveiro específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Saveiro de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "onix",
    "nome": "Onix",
    "nomeCompleto": "Chevrolet Onix",
    "title": "Onix de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet Onix de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Onix que você vai comprar já passou por um leilão.",
    "h1": "Onix de leilão: como saber se o seu Onix já passou por um",
    "intro": "O Chevrolet Onix é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Onix tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Onix usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 5561,
    "anoDe": 1998,
    "anoAte": 2026,
    "desfechoAmostra": 342,
    "pctSucata": 29,
    "pctRecuperavel": 43,
    "lotesComValor": 3205,
    "valorMedioReais": 41303,
    "faq": [
      {
        "pergunta": "Todo Onix de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Onix recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Onix específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Onix de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "fox",
    "nome": "Fox",
    "nomeCompleto": "Volkswagen Fox",
    "title": "Fox de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Volkswagen Fox de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Fox que você vai comprar já passou por um leilão.",
    "h1": "Fox de leilão: como saber se o seu Fox já passou por um",
    "intro": "O Volkswagen Fox é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Fox tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Fox usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 5414,
    "anoDe": 1995,
    "anoAte": 2021,
    "desfechoAmostra": 1563,
    "pctSucata": 45,
    "pctRecuperavel": 28,
    "lotesComValor": 1971,
    "valorMedioReais": 10026,
    "faq": [
      {
        "pergunta": "Todo Fox de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Fox recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Fox específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Fox de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "astra",
    "nome": "Astra",
    "nomeCompleto": "Chevrolet Astra",
    "title": "Astra de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet Astra de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Astra que você vai comprar já passou por um leilão.",
    "h1": "Astra de leilão: como saber se o seu Astra já passou por um",
    "intro": "O Chevrolet Astra é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Astra tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Astra usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 4369,
    "anoDe": 1995,
    "anoAte": 2016,
    "desfechoAmostra": 1389,
    "pctSucata": 55,
    "pctRecuperavel": 17,
    "lotesComValor": 1414,
    "valorMedioReais": 5655,
    "faq": [
      {
        "pergunta": "Todo Astra de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Astra recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Astra específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Astra de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "sandero",
    "nome": "Sandero",
    "nomeCompleto": "Renault Sandero",
    "title": "Sandero de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Renault Sandero de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Sandero que você vai comprar já passou por um leilão.",
    "h1": "Sandero de leilão: como saber se o seu Sandero já passou por um",
    "intro": "O Renault Sandero é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Sandero tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Sandero usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 4358,
    "anoDe": 2003,
    "anoAte": 2024,
    "desfechoAmostra": 647,
    "pctSucata": 37,
    "pctRecuperavel": 28,
    "lotesComValor": 1979,
    "valorMedioReais": 12080,
    "faq": [
      {
        "pergunta": "Todo Sandero de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Sandero recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Sandero específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Sandero de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "s10",
    "nome": "S10",
    "nomeCompleto": "Chevrolet S10",
    "title": "S10 de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Chevrolet S10 de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o S10 que você vai comprar já passou por um leilão.",
    "h1": "S10 de leilão: como saber se o seu S10 já passou por um",
    "intro": "O Chevrolet S10 é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo S10 tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um S10 usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 4015,
    "anoDe": 1981,
    "anoAte": 2026,
    "desfechoAmostra": 441,
    "pctSucata": 65,
    "pctRecuperavel": 17,
    "lotesComValor": 2830,
    "valorMedioReais": 68830,
    "faq": [
      {
        "pergunta": "Todo S10 de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um S10 recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um S10 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um S10 de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "corolla",
    "nome": "Corolla",
    "nomeCompleto": "Toyota Corolla",
    "title": "Corolla de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Toyota Corolla de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Corolla que você vai comprar já passou por um leilão.",
    "h1": "Corolla de leilão: como saber se o seu Corolla já passou por um",
    "intro": "O Toyota Corolla é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Corolla tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Corolla usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 2408,
    "anoDe": 1987,
    "anoAte": 2026,
    "desfechoAmostra": 467,
    "pctSucata": 47,
    "pctRecuperavel": 31,
    "lotesComValor": 1192,
    "valorMedioReais": 37517,
    "faq": [
      {
        "pergunta": "Todo Corolla de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Corolla recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Corolla específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Corolla de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "hb20",
    "nome": "HB20",
    "nomeCompleto": "Hyundai HB20",
    "title": "HB20 de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Hyundai HB20 de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o HB20 que você vai comprar já passou por um leilão.",
    "h1": "HB20 de leilão: como saber se o seu HB20 já passou por um",
    "intro": "O Hyundai HB20 é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo HB20 tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um HB20 usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 2324,
    "anoDe": 1996,
    "anoAte": 2026,
    "desfechoAmostra": 0,
    "pctSucata": null,
    "pctRecuperavel": null,
    "lotesComValor": 1136,
    "valorMedioReais": 24432,
    "faq": [
      {
        "pergunta": "Todo HB20 de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um HB20 recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um HB20 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um HB20 de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "compass",
    "nome": "Compass",
    "nomeCompleto": "Jeep Compass",
    "title": "Compass de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Jeep Compass de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o Compass que você vai comprar já passou por um leilão.",
    "h1": "Compass de leilão: como saber se o seu Compass já passou por um",
    "intro": "O Jeep Compass é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo Compass tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um Compass usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 1771,
    "anoDe": 2008,
    "anoAte": 2026,
    "desfechoAmostra": 0,
    "pctSucata": null,
    "pctRecuperavel": null,
    "lotesComValor": 1347,
    "valorMedioReais": 104976,
    "faq": [
      {
        "pergunta": "Todo Compass de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um Compass recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um Compass específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um Compass de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "t-cross",
    "nome": "T-Cross",
    "nomeCompleto": "Volkswagen T-Cross",
    "title": "T-Cross de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Volkswagen T-Cross de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o T-Cross que você vai comprar já passou por um leilão.",
    "h1": "T-Cross de leilão: como saber se o seu T-Cross já passou por um",
    "intro": "O Volkswagen T-Cross é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo T-Cross tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um T-Cross usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 231,
    "anoDe": 2019,
    "anoAte": 2026,
    "desfechoAmostra": 0,
    "pctSucata": null,
    "pctRecuperavel": null,
    "lotesComValor": 77,
    "valorMedioReais": null,
    "faq": [
      {
        "pergunta": "Todo T-Cross de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um T-Cross recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um T-Cross específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um T-Cross de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  },
  {
    "slug": "sw4",
    "nome": "SW4",
    "nomeCompleto": "Toyota SW4",
    "title": "SW4 de Leilão: Como Descobrir se o Seu Já Passou | PlacaCompleta",
    "description": "Veja o que significa um Toyota SW4 de leilão, o que a nossa base mostra sobre o modelo e como descobrir se o SW4 que você vai comprar já passou por um leilão.",
    "h1": "SW4 de leilão: como saber se o seu SW4 já passou por um",
    "intro": "O Toyota SW4 é um dos modelos mais comuns em registros de leilão de veículo no Brasil. Isso não quer dizer que todo SW4 tenha algum problema, apenas que é um dos carros mais populares do país e, por consequência, um dos mais frequentes em leilões de recuperação de crédito, remoção e sucata. Se você está de olho em um SW4 usado, vale entender o que a passagem por leilão significa e como descobrir se o carro específico que você vai comprar já foi arrematado assim.",
    "registros": 74,
    "anoDe": 2018,
    "anoAte": 2026,
    "desfechoAmostra": 0,
    "pctSucata": null,
    "pctRecuperavel": null,
    "lotesComValor": 9,
    "valorMedioReais": null,
    "faq": [
      {
        "pergunta": "Todo SW4 de leilão é ruim?",
        "resposta": "Não. Depende do tipo de leilão. Um SW4 recuperado de financiamento pode estar conservado; um classificado como sucata exige mais cuidado e inspeção técnica."
      },
      {
        "pergunta": "Como saber se um SW4 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza os dados do veículo com registros de leilão. O resultado é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "Vale a pena comprar um SW4 de leilão?",
        "resposta": "Pode valer, se você souber a origem (recuperação de crédito e judicial tendem a ter menos risco que sucata) e fizer uma inspeção antes de fechar negócio."
      }
    ]
  }
]

export function modeloPorSlug(slug: string): ModeloLeilao | undefined {
  return MODELOS_LEILAO.find((m) => m.slug === slug)
}

/** Ordenados do mais frequente pro menos: e a ordem que interessa ao leitor. */
export const MODELOS_POR_VOLUME = [...MODELOS_LEILAO].sort((a, b) => b.registros - a.registros)

// Enriquecimento das paginas /tabela-fipe/<modelo>.
//
// Contexto: 27 URLs estavam "rastreada, atualmente nao indexada" no Search
// Console. Conferi as 27 em producao e nao havia nada tecnico travando: todas
// respondem 200, com index/follow, canonical propria e conteudo no SSR. O
// problema era outro: comparando o texto visivel de tres delas, 83% era
// identico entre paginas diferentes. O Google rastreou, entendeu, e decidiu
// que nao valia guardar mais uma copia.
//
// Por isso o que entra aqui e SO conteudo que muda de pagina pra pagina: o
// historico de leilao daquele modelo, com numeros da nossa base, e um paragrafo
// proprio sobre a geracao e a motorizacao do carro. Texto generico a mais
// pioraria o problema em vez de resolver.
//
// Textos do seo (placa-completa-marketing/seo/indexacao/
// enriquecimento-27-paginas-2026-09-07.md), com os numeros do levantamento
// dele. Refiz o levantamento por um caminho independente pra conferir; onde
// divergiu mais de 10%, esta anotado no PR e a decisao ficou com o seo.
//
// Quatro modelos ficam SEM o bloco de leilao de proposito (Territory, Q7,
// Equinox e Song Plus): a amostra e pequena demais, e publicar "a amostra ainda
// e pequena" nas quatro criaria mais um paragrafo identico entre paginas, que e
// exatamente a doenca que estamos tratando.

export interface FaqItem {
  pergunta: string
  resposta: string
}

export interface BlocoLeilaoModelo {
  /** Paragrafo com os numeros da base pra este modelo. */
  dado: string
  /** Leitura por categoria de veiculo (picape, SUV, hatch popular...). */
  categoria: string | null
  /** Fechamento com o convite pra consulta e os links. */
  cta: string | null
}

export interface EnriquecimentoModelo {
  nomeCurto: string
  /** Substitui o "Sobre o X" generico, que era a mesma frase em toda pagina. */
  paragrafoUnico?: string
  /** Ausente quando a amostra nao sustenta um bloco proprio. */
  leilao?: BlocoLeilaoModelo
  faq?: FaqItem[]
}

export const ENRIQUECIMENTO_FIPE: Record<string, EnriquecimentoModelo> = {
  "audi-q3": {
    "nomeCurto": "Q3",
    "paragrafoUnico": "O Q3 chegou ao Brasil em 2012 na primeira geração, um SUV compacto de luxo com motorização 1.4 ou 2.0 TFSI turbo. A segunda geração, maior e com plataforma MQB, chegou em 2019. Na nossa base de leilão, o ano-modelo mais frequente é 2017, ainda da primeira geração. Como a amostra de leilão do Q3 é pequena, o desfecho predominante não é estatisticamente confiável ainda, mas a maioria dos registros disponíveis aparece como recuperável, não sucata.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 90 passagens de Audi Q3, entre os anos 2012 e 2024. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Um SUV premium como este costuma ter ticket alto e público mais atento à procedência, o que reduz a proporção de unidades em leilão vindas de sucata, mas não elimina o risco de gravame ou restrição em unidades financiadas.",
      "cta": "Antes de comprar um Q3 usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Q3 de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Q3 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Q3 considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "volkswagen-jetta": {
    "nomeCurto": "Jetta",
    "paragrafoUnico": "O Jetta é o sedã médio da Volkswagen construído sobre a mesma plataforma do Golf. A geração mais popular no Brasil foi nacionalizada a partir de 2011 (motor 2.0 aspirado e, depois, 1.4 TSI), sucedida por uma geração totalmente importada desde 2019 com motor 1.4 TSI. Na nossa base, o ano-modelo mais comum é 2011, coincidindo com o início da produção nacional, período em que o carro teve maior volume de vendas e, por consequência, mais passagens por leilão ao longo dos anos.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 613 passagens de Volkswagen Jetta, entre os anos 2001 e 2023. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Sedãs médios como este circulam bastante como carro de uso pessoal e empresarial, o que os torna comuns tanto em leilões de recuperação de crédito quanto em remoção.",
      "cta": "Antes de comprar um Jetta usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Jetta de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Jetta específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Jetta considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "volkswagen-voyage": {
    "nomeCurto": "Voyage",
    "paragrafoUnico": "O Voyage é a versão sedã do Gol, um dos carros mais vendidos da história do mercado brasileiro. Passou pelas gerações G5 (2008-2012) e G6 (2012-2016), sempre com motor 1.0 ou 1.6 flex, encerrando produção em 2023. Na nossa base de leilão, o ano-modelo mais frequente é 2010, da geração G5. Entre os registros com desfecho informado, a maior parte aparece classificada como sucata, reflexo direto do alto volume de unidades em circulação por décadas.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 10.196 passagens de Volkswagen Voyage, entre os anos 1980 e 2022. Entre os 3.561 registros com desfecho informado, 73% foram classificados como sucata ou inservível e 9% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Modelos populares como este estão entre os mais vendidos historicamente no Brasil, e por isso aparecem com frequência em leilões de todos os tipos, simplesmente porque a frota circulante é grande.",
      "cta": "Antes de comprar um Voyage usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Voyage de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Voyage específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Voyage considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "chevrolet-s10": {
    "nomeCurto": "S10",
    "paragrafoUnico": "A S10 é uma picape média com duas gerações relevantes na base: a segunda geração (1995-2011, motor 2.8 turbo diesel ou 4.3 V6 a gasolina nas versões mais antigas) e a \"nova S10\" lançada em 2012, com motor 2.8 Duramax turbo diesel e opções flex 2.4 e 2.5. Na nossa base, o ano-modelo mais frequente é 2016, já da geração atual. Entre os registros com desfecho informado, a maioria aparece como sucata ou inservível, consistente com o uso profissional intenso típico do segmento.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 4.015 passagens de Chevrolet S10, entre os anos 1981 e 2026. Entre os 441 registros com desfecho informado, 65% foram classificados como sucata ou inservível e 17% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Picapes médias como esta têm uso profissional intenso (frota, transporte de carga), o que aumenta tanto o desgaste quanto a frequência de leilões de recuperação de crédito e sucata.",
      "cta": "Antes de comprar um S10 usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao) e a [análise dedicada do S10](/carro-de-leilao/s10)."
    },
    "faq": [
      {
        "pergunta": "O S10 de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um S10 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do S10 considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "peugeot-207": {
    "nomeCurto": "207",
    "paragrafoUnico": "O 207 foi o sucessor do 206 na Peugeot, produzido no Brasil entre 2008 e 2014, quando foi substituído pelo 208. Vendido em versões hatch e sedã (207 Passion/207 Sedan), com motor 1.4 ou 1.6 flex. Na nossa base, o ano-modelo mais frequente é 2010, período de pico de vendas do modelo no país. A maior parte dos registros com desfecho informado aparece como sucata, mesmo padrão de outros populares da época.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 2.899 passagens de Peugeot 207, entre os anos 1996 e 2017. Entre os 795 registros com desfecho informado, 44% foram classificados como sucata ou inservível e 23% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Hatches compactos como este são um dos segmentos mais populares do país, com grande volume de unidades circulando e, por consequência, presença relevante em leilões de diferentes origens.",
      "cta": "Antes de comprar um 207 usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O 207 de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um 207 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do 207 considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "renault-duster": {
    "nomeCurto": "Duster",
    "paragrafoUnico": "O Duster é o SUV compacto de entrada da Renault, com primeira geração de 2011 a 2020 (motor 1.6 ou 2.0 flex) e segunda geração a partir de 2020. Na nossa base, o ano-modelo mais frequente é 2013, ainda da primeira geração, período de maior volume de vendas do modelo no Brasil. A amostra com desfecho detalhado ainda é pequena pra esse SUV, então não destacamos percentual até ela crescer.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 1.085 passagens de Renault Duster, entre os anos 2000 e 2025. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "SUVs compactos como este tiveram forte crescimento de vendas nos últimos anos, e a base de leilões ainda reflete uma frota mais nova e menor volume de sucata proporcional.",
      "cta": "Antes de comprar um Duster usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Duster de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Duster específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Duster considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "hyundai-ix35": {
    "nomeCurto": "ix35",
    "paragrafoUnico": "O ix35 foi o SUV médio da Hyundai vendido no Brasil entre 2010 e 2020, quando a marca migrou o posicionamento pro Creta e pro Tucson. A motorização mais comum no mercado nacional foi o 2.0 flex. Na nossa base, o ano-modelo mais frequente é 2017, período final de comercialização do modelo no país. A amostra ainda é pequena pra detalhar percentual de desfecho com confiança estatística.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 269 passagens de Hyundai ix35, entre os anos 2010 e 2020. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "SUVs médios como este têm ticket mais alto e uso familiar predominante, o que costuma reduzir a proporção de sucata na base de leilões em relação a modelos populares.",
      "cta": "Antes de comprar um ix35 usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O ix35 de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um ix35 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do ix35 considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "jeep-compass": {
    "nomeCurto": "Compass",
    "paragrafoUnico": "O Compass atual (segunda geração global, primeira desse porte pra Jeep no Brasil) chegou em 2016/2017, com motor 2.0 diesel turbo e, depois, 1.3 turbo flex (linha T270) nas versões de entrada, além de uma versão híbrida plug-in mais recente. Na nossa base, o ano-modelo mais frequente é 2021, no meio do ciclo de vida da geração atual. A amostra com desfecho detalhado ainda é pequena, típico de um SUV relativamente recente com frota mais nova circulando.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 1.771 passagens de Jeep Compass, entre os anos 2008 e 2026. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "SUVs médios como este têm ticket mais alto e uso familiar predominante, o que costuma reduzir a proporção de sucata na base de leilões em relação a modelos populares.",
      "cta": "Antes de comprar um Compass usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Compass de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Compass específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Compass considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "renault-oroch": {
    "nomeCurto": "Oroch",
    "paragrafoUnico": "A Oroch é a picape compacta de cabine dupla da Renault, derivada da plataforma do Duster, vendida no Brasil desde 2015. Motorização 1.6 ou 2.0 flex. Na nossa base, o ano-modelo mais frequente é 2019. Como é um nicho menor (picape compacta com cabine dupla de série), a amostra com desfecho detalhado ainda é pequena pra detalhar percentual de sucata ou recuperável com confiança.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 205 passagens de Renault Oroch, entre os anos 2015 e 2025. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Picapes compactas como esta têm uso misto (pessoal e comercial leve), o que gera um volume relevante de passagens por leilão ao longo dos anos.",
      "cta": "Antes de comprar um Oroch usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Oroch de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Oroch específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Oroch considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "mitsubishi-asx": {
    "nomeCurto": "ASX",
    "paragrafoUnico": "O ASX é o SUV compacto importado da Mitsubishi, vendido no Brasil desde 2011, com motor 2.0 flex. Na nossa base, o ano-modelo mais frequente é 2011, ano de lançamento do modelo no país. A amostra de leilão pra esse modelo é pequena e, entre os poucos registros com desfecho informado, nenhum aparece como sucata, todos como recuperável, mas o volume é baixo demais pra tirar uma conclusão estatística sólida.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 154 passagens de Mitsubishi ASX, entre os anos 1995 e 2020. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "SUVs compactos como este tiveram forte crescimento de vendas nos últimos anos, e a base de leilões ainda reflete uma frota mais nova e menor volume de sucata proporcional.",
      "cta": "Antes de comprar um ASX usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O ASX de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um ASX específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do ASX considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "ford-territory": {
    "nomeCurto": "Territory",
    "paragrafoUnico": "O Territory é o SUV médio que a Ford passou a vender no Brasil a partir de 2020, resultado de uma parceria com a fabricante chinesa JMC, com motor 1.5 turbo flex. Por ser um modelo recente, a nossa base ainda tem pouquíssimos registros de leilão pra esse veículo, o que é esperado dado o tempo curto de mercado e a frota ainda nova em circulação.",
    "faq": [
      {
        "pergunta": "O Territory de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Territory específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Territory considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "fiat-strada": {
    "nomeCurto": "Strada",
    "paragrafoUnico": "A Strada é a picape compacta mais vendida historicamente no Brasil, com quatro gerações: a original (1998-2004), a segunda (2004-2012), a terceira (2012-2020) e a atual, lançada em 2020 sobre plataforma nova, com cabine dupla de série em todas as versões e motor 1.3 ou 1.4 flex. Na nossa base, o ano-modelo mais frequente é 2018, da geração anterior à atual. A maioria dos registros com desfecho informado aparece como sucata, reflexo do uso comercial intenso comum ao segmento.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 7.473 passagens de Fiat Strada, entre os anos 1992 e 2026. Entre os 1.570 registros com desfecho informado, 65% foram classificados como sucata ou inservível e 23% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Picapes compactas como esta têm uso misto (pessoal e comercial leve), o que gera um volume relevante de passagens por leilão ao longo dos anos.",
      "cta": "Antes de comprar um Strada usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao) e a [análise dedicada do Strada](/carro-de-leilao/strada)."
    },
    "faq": [
      {
        "pergunta": "O Strada de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Strada específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Strada considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "volkswagen-golf": {
    "nomeCurto": "Golf",
    "paragrafoUnico": "O Golf teve produção nacional no Brasil principalmente na quarta geração (1999-2006), com motores 1.6, 1.8 e 2.0, além de gerações posteriores vendidas de forma importada, incluindo versões GTI turbo. Na nossa base, o ano-modelo mais frequente é 2000, já da geração nacional. Entre os registros com desfecho informado, a maioria aparece como sucata, consistente com um modelo mais antigo e com grande volume histórico de unidades em circulação.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 5.674 passagens de Volkswagen Golf, entre os anos 1987 e 2018. Entre os 1.998 registros com desfecho informado, 57% foram classificados como sucata ou inservível e 17% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Hatches premium como este tiveram gerações com grande volume de vendas no Brasil, o que explica a presença relevante na base de leilões mesmo sendo um segmento de ticket mais alto.",
      "cta": "Antes de comprar um Golf usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Golf de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Golf específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Golf considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "audi-q7": {
    "nomeCurto": "Q7",
    "paragrafoUnico": null,
    "faq": [
      {
        "pergunta": "O Q7 de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Q7 específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Q7 considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "renault-master": {
    "nomeCurto": "Master",
    "paragrafoUnico": "A Master é a van e chassi-cabine de maior porte da Renault, usada tanto para transporte de passageiros quanto de carga, com motor 2.3 diesel turbo nas gerações mais recentes. Na nossa base, o ano-modelo mais frequente é 2018. Por ser um veículo de uso predominantemente comercial, o desgaste tende a ser maior que o de um carro de passeio equivalente em idade, o que se reflete na proporção de leilões de recuperação de crédito na categoria.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 851 passagens de Renault Master, entre os anos 2001 e 2026. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Vans e utilitários como este têm uso comercial intenso, o que aumenta o desgaste e a frequência de passagem por recuperação de crédito ao longo da vida útil.",
      "cta": "Antes de comprar um Master usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Master de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Master específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Master considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "volkswagen-saveiro": {
    "nomeCurto": "Saveiro",
    "paragrafoUnico": "A Saveiro é a picape compacta derivada do Gol, uma das mais vendidas do segmento no Brasil por décadas, com motor 1.6 predominante nas gerações mais recentes (G5 e G6, entre 2009 e 2021). Na nossa base, o ano-modelo mais frequente é 2010, da geração G5. A maioria dos registros com desfecho informado aparece como sucata, coerente com o uso misto (pessoal e comercial leve) que caracteriza o modelo.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 7.028 passagens de Volkswagen Saveiro, entre os anos 1980 e 2026. Entre os 2.368 registros com desfecho informado, 71% foram classificados como sucata ou inservível e 18% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Picapes compactas como esta têm uso misto (pessoal e comercial leve), o que gera um volume relevante de passagens por leilão ao longo dos anos.",
      "cta": "Antes de comprar um Saveiro usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao) e a [análise dedicada do Saveiro](/carro-de-leilao/saveiro)."
    },
    "faq": [
      {
        "pergunta": "O Saveiro de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Saveiro específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Saveiro considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "chevrolet-montana": {
    "nomeCurto": "Montana",
    "paragrafoUnico": "A Montana é a picape compacta da Chevrolet, com a primeira geração baseada na plataforma do Corsa (2003-2010), uma segunda geração baseada no Prisma/Onix antigo (2011-2022) e a geração atual, relançada em 2023 sobre a plataforma do Onix atual. Na nossa base, o ano-modelo mais frequente é 2020, ainda da segunda geração. Entre os registros com desfecho informado, a maior parte aparece como sucata, mas com uma proporção de recuperável relevante também.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 2.817 passagens de Chevrolet Montana, entre os anos 1984 e 2026. Entre os 323 registros com desfecho informado, 76% foram classificados como sucata ou inservível e 24% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Picapes compactas como esta têm uso misto (pessoal e comercial leve), o que gera um volume relevante de passagens por leilão ao longo dos anos.",
      "cta": "Antes de comprar um Montana usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao) e a [análise dedicada do Montana](/carro-de-leilao/montana)."
    },
    "faq": [
      {
        "pergunta": "O Montana de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Montana específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Montana considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "chevrolet-equinox": {
    "nomeCurto": "Equinox",
    "paragrafoUnico": "O Equinox é o SUV médio importado da Chevrolet, com pouco volume de vendas no Brasil comparado aos modelos nacionais da marca, motorização 1.5 turbo nas versões mais recentes. Na nossa base, o ano-modelo mais frequente é 2018. O volume de registros de leilão pra esse modelo é baixo, reflexo direto do volume de vendas menor no mercado nacional, não necessariamente de um padrão de risco diferente.",
    "faq": [
      {
        "pergunta": "O Equinox de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Equinox específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Equinox considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "byd-dolphin-mini": {
    "nomeCurto": "Dolphin Mini",
    "paragrafoUnico": "O Dolphin Mini é o hatch elétrico de entrada da BYD no Brasil, lançado em 2023 como uma das opções mais acessíveis da marca no segmento compacto. Na nossa base, o ano-modelo mais frequente é 2024, refletindo o lançamento recente do modelo. Por ser um carro elétrico ainda muito novo no mercado nacional, a base de leilão pra esse modelo é pequena, e deve crescer conforme a frota envelhece.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 49 passagens de BYD Dolphin Mini, entre os anos 2023 e 2026. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Como é um modelo elétrico ainda recente no mercado brasileiro, a base de leilões pra esse tipo de veículo é pequena e deve crescer nos próximos anos conforme a frota envelhece.",
      "cta": "Antes de comprar um Dolphin Mini usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Dolphin Mini de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Dolphin Mini específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Dolphin Mini considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "fiat-argo": {
    "nomeCurto": "Argo",
    "paragrafoUnico": "O Argo é o hatch compacto que a Fiat lançou em 2017 pra substituir o Palio, com motorizações 1.0, 1.3 e, nas versões esportivas Trekking e HGT, 1.3 e 1.8. Na nossa base, o ano-modelo mais frequente é 2021, no meio do ciclo de vida do modelo. Entre os registros com desfecho informado, a proporção entre sucata e recuperável é mais equilibrada que em modelos mais antigos, reflexo de uma frota ainda relativamente jovem.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 1.328 passagens de Fiat Argo, entre os anos 2010 e 2026. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Hatches compactos como este são um dos segmentos mais populares do país, com grande volume de unidades circulando e, por consequência, presença relevante em leilões de diferentes origens.",
      "cta": "Antes de comprar um Argo usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Argo de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Argo específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Argo considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "honda-city": {
    "nomeCurto": "City",
    "paragrafoUnico": "O City é o sedã compacto da Honda vendido no Brasil desde 2009, com motor 1.5, e teve uma versão hatch relançada em 2022 (City Hatchback). Na nossa base, o ano-modelo mais frequente é 2010, da primeira geração nacional. Entre os registros com desfecho informado, a proporção entre sucata e recuperável é bem próxima, sem um padrão fortemente dominante em nenhuma direção.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 758 passagens de Honda City, entre os anos 1988 e 2026. A quantidade de registros com desfecho detalhado ainda é pequena pra esse modelo, então não destacamos percentual até a amostra crescer.",
      "categoria": "Sedãs compactos como este têm uso misto entre pessoal e aplicativo de transporte, o que impacta tanto o desgaste quanto a frequência de passagem por leilão.",
      "cta": "Antes de comprar um City usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O City de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um City específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do City considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "byd-song-plus": {
    "nomeCurto": "Song Plus",
    "paragrafoUnico": "O Song Plus é o SUV híbrido plug-in (DM) da BYD, parte da linha eletrificada mais recente da marca no Brasil, com chegada em 2023. Na nossa base, o ano-modelo mais frequente é 2024, refletindo o lançamento recente do modelo. Assim como outros elétricos e híbridos plug-in chineses recém-chegados, a base de leilão pra esse modelo ainda é pequena.",
    "faq": [
      {
        "pergunta": "O Song Plus de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Song Plus específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Song Plus considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  },
  "renault-logan": {
    "nomeCurto": "Logan",
    "paragrafoUnico": "O Logan é o sedã compacto da Renault construído sobre a mesma plataforma do Sandero, vendido no Brasil desde 2007, com motor 1.0 ou 1.6 flex. Na nossa base, o ano-modelo mais frequente é 2008, logo no início da comercialização nacional. Entre os registros com desfecho informado, a maioria aparece como sucata, seguida de uma proporção relevante de recuperável, padrão parecido com outros populares da mesma época.",
    "leilao": {
      "dado": "Nossa base de leilões já registra 3.559 passagens de Renault Logan, entre os anos 1996 e 2024. Entre os 683 registros com desfecho informado, 43% foram classificados como sucata ou inservível e 24% como recuperável. Esse percentual é sobre quem já passou por leilão, não sobre a frota total do modelo.",
      "categoria": "Modelos populares como este estão entre os mais vendidos historicamente no Brasil, e por isso aparecem com frequência em leilões de todos os tipos, simplesmente porque a frota circulante é grande.",
      "cta": "Antes de comprar um Logan usado, consulte a placa do carro específico: a consulta cruza com nossa base de mais de 1 milhão de registros de leilão e retorna um indício de passagem quando existe registro compatível. Veja também o [guia de carro de leilão](/carro-de-leilao)."
    },
    "faq": [
      {
        "pergunta": "O Logan de leilão costuma estar em bom estado?",
        "resposta": "Depende do tipo de leilão: recuperação de crédito e disputa judicial tendem a preservar melhor o veículo do que leilão de sucata."
      },
      {
        "pergunta": "Como saber se um Logan específico já foi de leilão?",
        "resposta": "Consultando a placa numa base que cruza com registros de leilão. O retorno é um indício de passagem, não uma certeza absoluta."
      },
      {
        "pergunta": "O valor da Tabela FIPE do Logan considera se o carro já foi de leilão?",
        "resposta": "Não. A Tabela FIPE reflete o valor médio de mercado do modelo/ano/versão, sem considerar o histórico individual do veículo, por isso vale sempre cruzar com uma consulta pela placa."
      }
    ]
  }
}

export function enriquecimentoDe(slug: string): EnriquecimentoModelo | undefined {
  return ENRIQUECIMENTO_FIPE[slug]
}

export interface VehicleType {
  slug: string
  name: string
  titlebar: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string
  audience: string
  brands: string[]
  dataFields: string[]
  faqs: { question: string; answer: string }[]
}

export const vehicleTypes: Record<string, VehicleType> = {
  carro: {
    slug: 'carro',
    name: 'Carro',
    titlebar: 'Consulta Placa de Carro',
    title: 'Consultar Placa de Carro Online e Grátis',
    metaTitle: 'Consultar Placa de Carro Grátis - Dados Completos por E-mail',
    metaDescription: 'Consulte a placa de qualquer carro e receba marca, modelo, ano, cor, valor FIPE, situação e mais no seu e-mail. Grátis, sem cadastro e em segundos.',
    intro: 'Precisa verificar os dados de um carro antes de comprar ou vender? Com o PlacaCompleta você consulta qualquer placa de automóvel e recebe todas as informações no seu e-mail em segundos. Ideal para lojistas, compradores e vendedores de veículos.',
    audience: 'Ideal para lojistas de veículos que precisam consultar múltiplos carros por dia, compradores que querem verificar a procedência antes de fechar negócio, e vendedores que desejam confirmar os dados do próprio veículo.',
    brands: ['Volkswagen (Gol, Polo, T-Cross, Saveiro)', 'Fiat (Argo, Mobi, Strada, Toro)', 'Chevrolet (Onix, Tracker, S10)', 'Hyundai (HB20, Creta, Tucson)', 'Toyota (Corolla, Hilux, Yaris)', 'Honda (Civic, HR-V, City)', 'Renault (Kwid, Duster, Sandero)', 'Jeep (Renegade, Compass, Commander)'],
    dataFields: ['Marca e modelo completo', 'Ano de fabricação e ano modelo', 'Cor do veículo', 'Valor atualizado na tabela FIPE', 'Município e estado de registro', 'Situação (restrições, débitos)', 'Chassi (parcial)', 'Combustível e cilindradas', 'Tipo de carroceria', 'Quantidade de passageiros'],
    faqs: [
      { question: 'Como consultar a placa de um carro grátis?', answer: 'Acesse o PlacaCompleta, digite a placa do carro no formato ABC1D23 ou ABC1234, informe seu e-mail e clique em "Receber Dados no E-mail". Em segundos você recebe todas as informações do veículo.' },
      { question: 'Quais dados do carro aparecem na consulta por placa?', answer: 'Você recebe marca, modelo, ano, cor, valor FIPE, município de registro, situação do veículo, chassi parcial, combustível, tipo de carroceria e muito mais.' },
      { question: 'A consulta de placa de carro é realmente grátis?', answer: 'Sim, o PlacaCompleta é 100% grátis. Não precisa de cadastro, não cobra nada e os dados são enviados direto no seu e-mail.' },
      { question: 'Posso consultar qualquer carro pela placa?', answer: 'Sim, você pode consultar carros com placa no formato antigo (ABC1234) ou no formato Mercosul (ABC1D23). O serviço cobre veículos de todo o Brasil.' },
    ],
  },
  moto: {
    slug: 'moto',
    name: 'Moto',
    titlebar: 'Consulta Placa de Moto',
    title: 'Consultar Placa de Moto Online e Grátis',
    metaTitle: 'Consultar Placa de Moto Grátis - Dados Completos por E-mail',
    metaDescription: 'Consulte a placa de qualquer moto e receba marca, modelo, ano, cilindradas, valor FIPE e situação no e-mail. Grátis e instantâneo.',
    intro: 'Vai comprar ou vender uma moto? Consulte a placa gratuitamente no PlacaCompleta e receba todos os dados do veículo no seu e-mail. Funciona com motos de qualquer marca, cilindrada e ano — do modelo popular ao esportivo.',
    audience: 'Perfeito para lojistas de motos, mecânicos que precisam confirmar dados técnicos, compradores que querem verificar a procedência, e entusiastas que desejam checar informações de qualquer motocicleta.',
    brands: ['Honda (CG 160, Biz, CB 300, XRE 300, PCX)', 'Yamaha (Fazer 250, MT-03, Crosser, NMAX)', 'Suzuki (GSX-S750, Burgman, Intruder)', 'BMW (G 310 GS, F 850 GS, S 1000 RR)', 'Kawasaki (Z400, Ninja 400, Versys)', 'Triumph (Tiger, Street Triple)', 'Ducati (Monster, Scrambler)', 'Royal Enfield (Meteor, Himalayan)'],
    dataFields: ['Marca e modelo completo', 'Ano de fabricação e ano modelo', 'Cor da moto', 'Cilindradas', 'Valor atualizado na tabela FIPE', 'Município e estado de registro', 'Situação (restrições, débitos)', 'Chassi (parcial)', 'Combustível', 'Espécie e tipo de veículo'],
    faqs: [
      { question: 'Como consultar a placa de uma moto grátis?', answer: 'Acesse o PlacaCompleta, digite a placa da moto, informe seu e-mail e receba os dados completos em segundos. Funciona com placa antiga e Mercosul.' },
      { question: 'Quais dados da moto aparecem na consulta?', answer: 'Você recebe marca, modelo, ano, cor, cilindradas, valor FIPE, município de registro, situação, chassi parcial, combustível e tipo do veículo.' },
      { question: 'Consigo ver as cilindradas da moto pela placa?', answer: 'Sim. A consulta retorna as cilindradas, combustível e outras informações técnicas da motocicleta.' },
      { question: 'Funciona para motos importadas?', answer: 'Sim, desde que a moto esteja registrada no Brasil com placa brasileira, a consulta funciona normalmente.' },
    ],
  },
  caminhao: {
    slug: 'caminhao',
    name: 'Caminhão',
    titlebar: 'Consulta Placa de Caminhão',
    title: 'Consultar Placa de Caminhão Online e Grátis',
    metaTitle: 'Consultar Placa de Caminhão Grátis - Dados Completos por E-mail',
    metaDescription: 'Consulte a placa de qualquer caminhão e receba marca, modelo, ano, PBT, valor FIPE e situação no e-mail. Grátis para transportadoras e frotistas.',
    intro: 'Precisa verificar os dados de um caminhão? O PlacaCompleta permite consultar a placa de qualquer caminhão registrado no Brasil e receber informações completas no e-mail. Ferramenta essencial para transportadoras, frotistas e compradores de veículos pesados.',
    audience: 'Essencial para transportadoras que gerenciam frotas, frotistas que precisam verificar dados técnicos, compradores de caminhões usados e despachantes que lidam com documentação de veículos pesados.',
    brands: ['Mercedes-Benz (Actros, Atego, Accelo)', 'Volvo (FH, VM, FMX)', 'Scania (R, S, P)', 'Volkswagen (Constellation, Delivery, Worker)', 'DAF (XF, CF)', 'Iveco (Tector, Hi-Way, Daily)', 'Ford (Cargo)', 'MAN (TGX, TGS)'],
    dataFields: ['Marca e modelo completo', 'Ano de fabricação e ano modelo', 'Cor do veículo', 'Peso bruto total (PBT)', 'Capacidade máxima de tração', 'Número de eixos', 'Valor na tabela FIPE', 'Município e estado de registro', 'Situação (restrições)', 'Tipo de carroceria', 'Chassi (parcial)'],
    faqs: [
      { question: 'Como consultar a placa de um caminhão?', answer: 'Acesse o PlacaCompleta, digite a placa do caminhão, informe seu e-mail e receba dados como marca, modelo, PBT, eixos, FIPE e situação em segundos.' },
      { question: 'Consigo ver o peso bruto e número de eixos pela placa?', answer: 'Sim. A consulta retorna peso bruto total, capacidade de tração, número de eixos e tipo de carroceria do caminhão.' },
      { question: 'Funciona para carretas e semi-reboques?', answer: 'Sim, desde que o veículo tenha placa brasileira registrada, a consulta retorna os dados disponíveis.' },
      { question: 'É grátis para transportadoras?', answer: 'Sim, o PlacaCompleta é 100% grátis para qualquer pessoa ou empresa. Ideal para transportadoras que precisam consultar múltiplos veículos.' },
    ],
  },
  onibus: {
    slug: 'onibus',
    name: 'Ônibus',
    titlebar: 'Consulta Placa de Ônibus',
    title: 'Consultar Placa de Ônibus Online e Grátis',
    metaTitle: 'Consultar Placa de Ônibus Grátis - Dados Completos por E-mail',
    metaDescription: 'Consulte a placa de qualquer ônibus e receba marca, modelo, ano, capacidade, valor FIPE e situação no e-mail. Grátis e instantâneo.',
    intro: 'Consulte gratuitamente a placa de qualquer ônibus ou micro-ônibus registrado no Brasil. O PlacaCompleta retorna informações completas do veículo, incluindo dados técnicos importantes para empresas de transporte, fretamento e turismo.',
    audience: 'Voltado para empresas de ônibus, operadores de fretamento e turismo, órgãos de fiscalização, e compradores de ônibus usados que precisam verificar dados antes de fechar negócio.',
    brands: ['Mercedes-Benz (O 500, OF 1721, LO 916)', 'Volvo (B270F, B340R, B450R)', 'Scania (K 310, K 400, F 270)', 'Volkswagen (17.230 OD, 9.160 OD)', 'Iveco (Cityclass, Urbanway)', 'Agrale (MA 8.5, MT 12.0)'],
    dataFields: ['Marca e modelo completo', 'Ano de fabricação e ano modelo', 'Cor do veículo', 'Quantidade de passageiros', 'Peso bruto total', 'Número de eixos', 'Valor na tabela FIPE', 'Município e estado de registro', 'Situação (restrições)', 'Tipo de carroceria', 'Chassi (parcial)'],
    faqs: [
      { question: 'Como consultar a placa de um ônibus?', answer: 'Acesse o PlacaCompleta, digite a placa do ônibus, informe seu e-mail e receba dados completos como marca, modelo, capacidade de passageiros e situação.' },
      { question: 'Consigo ver a capacidade de passageiros pela placa?', answer: 'Sim. A consulta retorna a quantidade de passageiros, peso bruto total, eixos e outros dados técnicos do ônibus.' },
      { question: 'Funciona para micro-ônibus?', answer: 'Sim, funciona para ônibus, micro-ônibus e qualquer veículo de transporte coletivo com placa brasileira.' },
      { question: 'A consulta é grátis para empresas de ônibus?', answer: 'Sim, o PlacaCompleta é grátis para qualquer pessoa ou empresa, sem limites de consultas.' },
    ],
  },
  van: {
    slug: 'van',
    name: 'Van',
    titlebar: 'Consulta Placa de Van',
    title: 'Consultar Placa de Van Online e Grátis',
    metaTitle: 'Consultar Placa de Van Grátis - Dados Completos por E-mail',
    metaDescription: 'Consulte a placa de qualquer van ou utilitário e receba marca, modelo, ano, valor FIPE e situação no e-mail. Grátis e instantâneo.',
    intro: 'Precisa consultar os dados de uma van ou utilitário? No PlacaCompleta você verifica qualquer placa gratuitamente e recebe informações completas no e-mail. Útil para empresas de fretamento, locadoras e compradores de utilitários.',
    audience: 'Ideal para empresas de fretamento e transporte escolar, locadoras de veículos, compradores de vans usadas e profissionais autônomos que utilizam utilitários para trabalho.',
    brands: ['Mercedes-Benz (Sprinter)', 'Fiat (Ducato, Fiorino)', 'Renault (Master)', 'Peugeot (Boxer, Expert)', 'Citroën (Jumper, Jumpy)', 'Iveco (Daily)', 'Volkswagen (Kombi, Delivery)'],
    dataFields: ['Marca e modelo completo', 'Ano de fabricação e ano modelo', 'Cor do veículo', 'Quantidade de passageiros', 'Peso bruto total', 'Valor na tabela FIPE', 'Município e estado de registro', 'Situação (restrições)', 'Tipo de carroceria', 'Chassi (parcial)', 'Combustível'],
    faqs: [
      { question: 'Como consultar a placa de uma van?', answer: 'Acesse o PlacaCompleta, digite a placa da van, informe seu e-mail e receba dados como marca, modelo, capacidade, FIPE e situação em segundos.' },
      { question: 'Funciona para Sprinter, Ducato e outros utilitários?', answer: 'Sim, funciona para qualquer van ou utilitário com placa brasileira: Sprinter, Ducato, Master, Boxer e outros.' },
      { question: 'Consigo ver se a van tem restrição?', answer: 'Sim. A consulta retorna a situação do veículo, informando se há restrições registradas.' },
      { question: 'A consulta é grátis para frotas de vans?', answer: 'Sim, o PlacaCompleta é 100% grátis para consultas individuais ou em volume. Sem cadastro e sem limites.' },
    ],
  },
}

export const vehicleTypeSlugs = Object.keys(vehicleTypes)

import { PLANOS } from '../shared/planos'
import { BASE_LEILAO_TEXTO } from '../shared/base-leilao'

// Preco do relatorio completo: sempre de shared/planos.ts.
const PRECO_COMPLETA = `R$ ${(PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')}`

/** dataFields: o que o RELATORIO COMPLETO traz (a consulta gratis fica fixa na pagina). */
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
    title: 'Consultar Placa de Carro Online',
    metaTitle: 'Consultar Placa de Carro: Leilão, Roubo e FIPE',
    metaDescription: 'Consulte a placa de qualquer carro: marca, modelo, ano e FIPE grátis na tela. O relatório completo mostra leilão, roubo, gravame, multas e recall.',
    intro: `Vai comprar ou vender um carro usado? Digite a placa no PlacaCompleta e veja na hora, sem custo, marca, modelo, ano e valor FIPE, além de sinais de leilão ou recall quando houver. Para decidir a compra, o relatório completo (${PRECO_COMPLETA}, no Pix ou no cartão) checa se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, e fica na tela e no seu e-mail.`,
    audience: 'Ideal para lojistas de veículos que precisam consultar múltiplos carros por dia, compradores que querem verificar a procedência antes de fechar negócio, e vendedores que desejam confirmar os dados do próprio veículo.',
    brands: ['Volkswagen (Gol, Polo, T-Cross, Saveiro)', 'Fiat (Argo, Mobi, Strada, Toro)', 'Chevrolet (Onix, Tracker, S10)', 'Hyundai (HB20, Creta, Tucson)', 'Toyota (Corolla, Hilux, Yaris)', 'Honda (Civic, HR-V, City)', 'Renault (Kwid, Duster, Sandero)', 'Jeep (Renegade, Compass, Commander)'],
    dataFields: ['Ficha técnica do carro: chassi, RENAVAM, cor, combustível e carroceria', 'Se há indicador de roubo e furto', 'Se há gravame ou alienação fiduciária', 'Se há restrições judiciais ou administrativas', 'Se há multas registradas', 'Se há recall pendente', `Se há registro de leilão, cruzado com nossa base de ${BASE_LEILAO_TEXTO}`, 'Valor FIPE com histórico e seguro estimado'],
    faqs: [
      { question: 'Como consultar a placa de um carro?', answer: 'Digite a placa (ABC1D23 ou ABC1234) na página inicial do PlacaCompleta. Marca, modelo, ano e valor FIPE do carro aparecem na tela, sem cadastro e sem custo.' },
      { question: 'O que a consulta grátis mostra?', answer: 'Marca, modelo, ano e valor FIPE, e sinais de leilão ou recall quando houver. Os detalhes desses sinais e as demais checagens ficam no relatório completo.' },
      { question: 'O que o relatório completo traz?', answer: `Mostra se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, além da ficha técnica e do valor FIPE com histórico. Custa ${PRECO_COMPLETA}, no Pix ou no cartão, sem assinatura.` },
      { question: 'Como recebo o relatório completo?', answer: 'Depois do pagamento, o relatório abre na própria tela e uma cópia chega no seu e-mail, com o link do relatório.' },
      { question: 'Posso consultar qualquer carro pela placa?', answer: 'Sim, carros com placa no formato antigo (ABC1234) ou Mercosul (ABC1D23), registrados em qualquer estado do Brasil.' },
    ],
  },
  moto: {
    slug: 'moto',
    name: 'Moto',
    titlebar: 'Consulta Placa de Moto',
    title: 'Consultar Placa de Moto Online',
    metaTitle: 'Consultar Placa de Moto: Leilão, Roubo e FIPE',
    metaDescription: 'Consulte a placa de qualquer moto: marca, modelo, ano e FIPE grátis na tela. O relatório completo mostra leilão, roubo, gravame, multas e recall.',
    intro: `Vai comprar ou vender uma moto? Digite a placa no PlacaCompleta e veja na hora, sem custo, marca, modelo, ano e valor FIPE, além de sinais de leilão ou recall quando houver. Para decidir a compra, o relatório completo (${PRECO_COMPLETA}, no Pix ou no cartão) checa se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, e fica na tela e no seu e-mail.`,
    audience: 'Perfeito para lojistas de motos, mecânicos que precisam confirmar dados técnicos, compradores que querem verificar a procedência, e entusiastas que desejam checar informações de qualquer motocicleta.',
    brands: ['Honda (CG 160, Biz, CB 300, XRE 300, PCX)', 'Yamaha (Fazer 250, MT-03, Crosser, NMAX)', 'Suzuki (GSX-S750, Burgman, Intruder)', 'BMW (G 310 GS, F 850 GS, S 1000 RR)', 'Kawasaki (Z400, Ninja 400, Versys)', 'Triumph (Tiger, Street Triple)', 'Ducati (Monster, Scrambler)', 'Royal Enfield (Meteor, Himalayan)'],
    dataFields: ['Ficha técnica da moto: chassi, RENAVAM, cor, cilindrada e combustível', 'Se há indicador de roubo e furto', 'Se há gravame ou alienação fiduciária', 'Se há restrições judiciais ou administrativas', 'Se há multas registradas', 'Se há recall pendente', `Se há registro de leilão, cruzado com nossa base de ${BASE_LEILAO_TEXTO}`, 'Valor FIPE com histórico e seguro estimado'],
    faqs: [
      { question: 'Como consultar a placa de uma moto?', answer: 'Digite a placa (ABC1D23 ou ABC1234) na página inicial do PlacaCompleta. Marca, modelo, ano e valor FIPE da moto aparecem na tela, sem cadastro e sem custo.' },
      { question: 'O que a consulta grátis mostra?', answer: 'Marca, modelo, ano e valor FIPE, e sinais de leilão ou recall quando houver. Os detalhes desses sinais e as demais checagens ficam no relatório completo.' },
      { question: 'O que o relatório completo traz?', answer: `Mostra se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, além da ficha técnica e do valor FIPE com histórico. Custa ${PRECO_COMPLETA}, no Pix ou no cartão, sem assinatura.` },
      { question: 'Como recebo o relatório completo?', answer: 'Depois do pagamento, o relatório abre na própria tela e uma cópia chega no seu e-mail, com o link do relatório.' },
      { question: 'Consigo ver as cilindradas da moto pela placa?', answer: 'Sim. A cilindrada e os demais dados técnicos estão na ficha técnica do relatório completo.' },
      { question: 'Funciona para motos importadas?', answer: 'Sim, desde que a moto esteja registrada no Brasil, com placa brasileira.' },
    ],
  },
  caminhao: {
    slug: 'caminhao',
    name: 'Caminhão',
    titlebar: 'Consulta Placa de Caminhão',
    title: 'Consultar Placa de Caminhão Online',
    metaTitle: 'Consultar Placa de Caminhão: Leilão, Roubo e FIPE',
    metaDescription: 'Consulte a placa de qualquer caminhão: marca, modelo, ano e FIPE grátis na tela. O relatório completo mostra leilão, roubo, gravame, multas e recall.',
    intro: `Vai comprar um caminhão usado ou conferir um veículo da frota? Digite a placa no PlacaCompleta e veja na hora, sem custo, marca, modelo, ano e valor FIPE, além de sinais de leilão ou recall quando houver. Para decidir a compra, o relatório completo (${PRECO_COMPLETA}, no Pix ou no cartão) checa se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, e fica na tela e no seu e-mail.`,
    audience: 'Essencial para transportadoras que gerenciam frotas, frotistas que precisam verificar dados técnicos, compradores de caminhões usados e despachantes que lidam com documentação de veículos pesados.',
    brands: ['Mercedes-Benz (Actros, Atego, Accelo)', 'Volvo (FH, VM, FMX)', 'Scania (R, S, P)', 'Volkswagen (Constellation, Delivery, Worker)', 'DAF (XF, CF)', 'Iveco (Tector, Hi-Way, Daily)', 'Ford (Cargo)', 'MAN (TGX, TGS)'],
    dataFields: ['Ficha técnica do caminhão: chassi, RENAVAM, peso bruto total, capacidade de tração, eixos e carroceria', 'Se há indicador de roubo e furto', 'Se há gravame ou alienação fiduciária', 'Se há restrições judiciais ou administrativas', 'Se há multas registradas', 'Se há recall pendente', `Se há registro de leilão, cruzado com nossa base de ${BASE_LEILAO_TEXTO}`, 'Valor FIPE com histórico e seguro estimado'],
    faqs: [
      { question: 'Como consultar a placa de um caminhão?', answer: 'Digite a placa (ABC1D23 ou ABC1234) na página inicial do PlacaCompleta. Marca, modelo, ano e valor FIPE do caminhão aparecem na tela, sem cadastro e sem custo.' },
      { question: 'O que a consulta grátis mostra?', answer: 'Marca, modelo, ano e valor FIPE, e sinais de leilão ou recall quando houver. Os detalhes desses sinais e as demais checagens ficam no relatório completo.' },
      { question: 'O que o relatório completo traz?', answer: `Mostra se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, além da ficha técnica e do valor FIPE com histórico. Custa ${PRECO_COMPLETA}, no Pix ou no cartão, sem assinatura.` },
      { question: 'Como recebo o relatório completo?', answer: 'Depois do pagamento, o relatório abre na própria tela e uma cópia chega no seu e-mail, com o link do relatório.' },
      { question: 'Consigo ver o peso bruto e o número de eixos pela placa?', answer: 'Sim. Peso bruto total, capacidade de tração, eixos e carroceria estão na ficha técnica do relatório completo.' },
      { question: 'Funciona para carretas e semirreboques?', answer: 'Sim, desde que o veículo tenha placa brasileira registrada.' },
    ],
  },
  onibus: {
    slug: 'onibus',
    name: 'Ônibus',
    titlebar: 'Consulta Placa de Ônibus',
    title: 'Consultar Placa de Ônibus Online',
    metaTitle: 'Consultar Placa de Ônibus: Leilão, Roubo e FIPE',
    metaDescription: 'Consulte a placa de qualquer ônibus: marca, modelo, ano e FIPE grátis na tela. O relatório completo mostra leilão, roubo, gravame, multas e recall.',
    intro: `Vai comprar um ônibus ou micro-ônibus usado? Digite a placa no PlacaCompleta e veja na hora, sem custo, marca, modelo, ano e valor FIPE, além de sinais de leilão ou recall quando houver. Para decidir a compra, o relatório completo (${PRECO_COMPLETA}, no Pix ou no cartão) checa se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, e fica na tela e no seu e-mail.`,
    audience: 'Voltado para empresas de ônibus, operadores de fretamento e turismo, órgãos de fiscalização, e compradores de ônibus usados que precisam verificar dados antes de fechar negócio.',
    brands: ['Mercedes-Benz (O 500, OF 1721, LO 916)', 'Volvo (B270F, B340R, B450R)', 'Scania (K 310, K 400, F 270)', 'Volkswagen (17.230 OD, 9.160 OD)', 'Iveco (Cityclass, Urbanway)', 'Agrale (MA 8.5, MT 12.0)'],
    dataFields: ['Ficha técnica do ônibus: chassi, RENAVAM, lotação, peso bruto total, eixos e carroceria', 'Se há indicador de roubo e furto', 'Se há gravame ou alienação fiduciária', 'Se há restrições judiciais ou administrativas', 'Se há multas registradas', 'Se há recall pendente', `Se há registro de leilão, cruzado com nossa base de ${BASE_LEILAO_TEXTO}`, 'Valor FIPE com histórico e seguro estimado'],
    faqs: [
      { question: 'Como consultar a placa de um ônibus?', answer: 'Digite a placa (ABC1D23 ou ABC1234) na página inicial do PlacaCompleta. Marca, modelo, ano e valor FIPE do ônibus aparecem na tela, sem cadastro e sem custo.' },
      { question: 'O que a consulta grátis mostra?', answer: 'Marca, modelo, ano e valor FIPE, e sinais de leilão ou recall quando houver. Os detalhes desses sinais e as demais checagens ficam no relatório completo.' },
      { question: 'O que o relatório completo traz?', answer: `Mostra se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, além da ficha técnica e do valor FIPE com histórico. Custa ${PRECO_COMPLETA}, no Pix ou no cartão, sem assinatura.` },
      { question: 'Como recebo o relatório completo?', answer: 'Depois do pagamento, o relatório abre na própria tela e uma cópia chega no seu e-mail, com o link do relatório.' },
      { question: 'Consigo ver a capacidade de passageiros pela placa?', answer: 'Sim. A lotação, o peso bruto total e os eixos estão na ficha técnica do relatório completo.' },
      { question: 'Funciona para micro-ônibus?', answer: 'Sim, para ônibus, micro-ônibus e qualquer veículo de transporte coletivo com placa brasileira.' },
    ],
  },
  van: {
    slug: 'van',
    name: 'Van',
    titlebar: 'Consulta Placa de Van',
    title: 'Consultar Placa de Van Online',
    metaTitle: 'Consultar Placa de Van: Leilão, Roubo e FIPE',
    metaDescription: 'Consulte a placa de qualquer van: marca, modelo, ano e FIPE grátis na tela. O relatório completo mostra leilão, roubo, gravame, multas e recall.',
    intro: `Vai comprar uma van ou um utilitário usado? Digite a placa no PlacaCompleta e veja na hora, sem custo, marca, modelo, ano e valor FIPE, além de sinais de leilão ou recall quando houver. Para decidir a compra, o relatório completo (${PRECO_COMPLETA}, no Pix ou no cartão) checa se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, e fica na tela e no seu e-mail.`,
    audience: 'Ideal para empresas de fretamento e transporte escolar, locadoras de veículos, compradores de vans usadas e profissionais autônomos que utilizam utilitários para trabalho.',
    brands: ['Mercedes-Benz (Sprinter)', 'Fiat (Ducato, Fiorino)', 'Renault (Master)', 'Peugeot (Boxer, Expert)', 'Citroën (Jumper, Jumpy)', 'Iveco (Daily)', 'Volkswagen (Kombi, Delivery)'],
    dataFields: ['Ficha técnica da van: chassi, RENAVAM, lotação, peso bruto total, combustível e carroceria', 'Se há indicador de roubo e furto', 'Se há gravame ou alienação fiduciária', 'Se há restrições judiciais ou administrativas', 'Se há multas registradas', 'Se há recall pendente', `Se há registro de leilão, cruzado com nossa base de ${BASE_LEILAO_TEXTO}`, 'Valor FIPE com histórico e seguro estimado'],
    faqs: [
      { question: 'Como consultar a placa de uma van?', answer: 'Digite a placa (ABC1D23 ou ABC1234) na página inicial do PlacaCompleta. Marca, modelo, ano e valor FIPE da van aparecem na tela, sem cadastro e sem custo.' },
      { question: 'O que a consulta grátis mostra?', answer: 'Marca, modelo, ano e valor FIPE, e sinais de leilão ou recall quando houver. Os detalhes desses sinais e as demais checagens ficam no relatório completo.' },
      { question: 'O que o relatório completo traz?', answer: `Mostra se há registro de leilão, roubo e furto, gravame, restrições, multas e recall pendente, além da ficha técnica e do valor FIPE com histórico. Custa ${PRECO_COMPLETA}, no Pix ou no cartão, sem assinatura.` },
      { question: 'Como recebo o relatório completo?', answer: 'Depois do pagamento, o relatório abre na própria tela e uma cópia chega no seu e-mail, com o link do relatório.' },
      { question: 'Funciona para Sprinter, Ducato e outros utilitários?', answer: 'Sim, para qualquer van ou utilitário com placa brasileira: Sprinter, Ducato, Master, Boxer e outros.' },
    ],
  },
}

export const vehicleTypeSlugs = Object.keys(vehicleTypes)

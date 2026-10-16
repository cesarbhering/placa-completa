export interface StateData {
  slug: string
  name: string
  uf: string
  capital: string
  detranSite: string
  plateRanges: string
  ipvaInfo: string
  context: string
  faqs: { question: string; answer: string }[]
}

export const states: Record<string, StateData> = {
  'acre': {
    slug: 'acre', name: 'Acre', uf: 'AC', capital: 'Rio Branco',
    detranSite: 'https://detran.ac.gov.br',
    plateRanges: 'QWA a QWZ (formato antigo)',
    ipvaInfo: 'O IPVA no Acre pode ser parcelado e possui alíquota de 2% para automóveis.',
    context: 'O Acre possui uma frota veicular em crescimento, concentrada principalmente em Rio Branco e Cruzeiro do Sul.',
    faqs: [
      { question: 'Como consultar uma placa do Acre?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo registrado no AC, informe seu e-mail e receba os dados completos gratuitamente.' },
      { question: 'Quais as letras de placa do Acre?', answer: 'No formato antigo, as placas do Acre começam com as letras QWA a QWZ. No formato Mercosul, a identificação é pelo município de registro.' },
      { question: 'Onde fica o DETRAN do Acre?', answer: 'O DETRAN-AC fica em Rio Branco. Acesse o site oficial em detran.ac.gov.br para serviços online.' },
    ],
  },
  'alagoas': {
    slug: 'alagoas', name: 'Alagoas', uf: 'AL', capital: 'Maceió',
    detranSite: 'https://detran.al.gov.br',
    plateRanges: 'QUA a QUZ (formato antigo)',
    ipvaInfo: 'O IPVA em Alagoas tem alíquota de 2,75% para veículos de passeio e pode ser parcelado em até 6 vezes.',
    context: 'Alagoas tem sua frota concentrada em Maceió e Arapiraca, com crescimento no número de motocicletas nos últimos anos.',
    faqs: [
      { question: 'Como consultar uma placa de Alagoas?', answer: 'No PlacaCompleta, digite a placa do veículo registrado em AL e receba marca, modelo, ano, FIPE e situação no seu e-mail.' },
      { question: 'Quais as letras de placa de Alagoas?', answer: 'No formato antigo, placas de Alagoas começam com QUA a QUZ.' },
      { question: 'Qual a alíquota do IPVA em Alagoas?', answer: 'A alíquota do IPVA em Alagoas é de 2,75% para automóveis de passeio.' },
    ],
  },
  'amapa': {
    slug: 'amapa', name: 'Amapá', uf: 'AP', capital: 'Macapá',
    detranSite: 'https://detran.ap.gov.br',
    plateRanges: 'OKA a OKZ (formato antigo)',
    ipvaInfo: 'O IPVA no Amapá tem alíquota de 3% para veículos de passeio.',
    context: 'O Amapá possui uma frota menor, concentrada em Macapá e Santana, com predomínio de automóveis e motocicletas.',
    faqs: [
      { question: 'Como consultar uma placa do Amapá?', answer: 'Acesse o PlacaCompleta, informe a placa do veículo do AP e seu e-mail para receber os dados completos gratuitamente.' },
      { question: 'Quais as letras de placa do Amapá?', answer: 'No formato antigo, placas do Amapá começam com OKA a OKZ.' },
      { question: 'Qual o site do DETRAN do Amapá?', answer: 'O site do DETRAN-AP é detran.ap.gov.br, onde você pode acessar serviços de veículos e habilitação.' },
    ],
  },
  'amazonas': {
    slug: 'amazonas', name: 'Amazonas', uf: 'AM', capital: 'Manaus',
    detranSite: 'https://detran.am.gov.br',
    plateRanges: 'OAA a OAZ, PHO a PHZ (formato antigo)',
    ipvaInfo: 'O IPVA no Amazonas tem alíquota de 3% para automóveis e pode ser pago com desconto à vista.',
    context: 'O Amazonas concentra sua frota em Manaus, que é polo industrial automotivo com a Zona Franca. A cidade possui uma das maiores frotas da região Norte.',
    faqs: [
      { question: 'Como consultar uma placa do Amazonas?', answer: 'No PlacaCompleta, digite a placa do veículo registrado no AM, informe seu e-mail e receba todos os dados em segundos.' },
      { question: 'Quais as letras de placa do Amazonas?', answer: 'No formato antigo, placas do Amazonas usam as séries OAA a OAZ e PHO a PHZ.' },
      { question: 'Veículos da Zona Franca de Manaus têm placa diferente?', answer: 'Não, veículos fabricados na Zona Franca recebem placas normais do Amazonas ao serem registrados.' },
    ],
  },
  'bahia': {
    slug: 'bahia', name: 'Bahia', uf: 'BA', capital: 'Salvador',
    detranSite: 'https://detran.ba.gov.br',
    plateRanges: 'JAA a JDZ, OVA a OXZ (formato antigo)',
    ipvaInfo: 'O IPVA na Bahia tem alíquota de 2,5% para automóveis e oferece desconto para pagamento antecipado.',
    context: 'A Bahia possui a maior frota do Nordeste, com veículos concentrados em Salvador, Feira de Santana, Vitória da Conquista e Camaçari.',
    faqs: [
      { question: 'Como consultar uma placa da Bahia?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo baiano e receba marca, modelo, FIPE e situação no seu e-mail gratuitamente.' },
      { question: 'Quais as letras de placa da Bahia?', answer: 'No formato antigo, placas da Bahia usam as séries JAA a JDZ e OVA a OXZ.' },
      { question: 'Qual a alíquota do IPVA na Bahia?', answer: 'A alíquota do IPVA na Bahia é de 2,5% para veículos de passeio.' },
    ],
  },
  'ceara': {
    slug: 'ceara', name: 'Ceará', uf: 'CE', capital: 'Fortaleza',
    detranSite: 'https://detran.ce.gov.br',
    plateRanges: 'HUA a HZZ, OCA a OCZ (formato antigo)',
    ipvaInfo: 'O IPVA no Ceará tem alíquota de 3% para automóveis e pode ser parcelado em cotas.',
    context: 'O Ceará tem sua frota concentrada em Fortaleza, Juazeiro do Norte e Sobral. É o terceiro maior estado do Nordeste em número de veículos.',
    faqs: [
      { question: 'Como consultar uma placa do Ceará?', answer: 'No PlacaCompleta, digite a placa do veículo cearense, informe seu e-mail e receba os dados completos gratuitamente em segundos.' },
      { question: 'Quais as letras de placa do Ceará?', answer: 'No formato antigo, placas do Ceará usam as séries HUA a HZZ e OCA a OCZ.' },
      { question: 'O IPVA do Ceará pode ser parcelado?', answer: 'Sim, o IPVA no Ceará pode ser pago em cotas ou à vista com desconto.' },
    ],
  },
  'distrito-federal': {
    slug: 'distrito-federal', name: 'Distrito Federal', uf: 'DF', capital: 'Brasília',
    detranSite: 'https://detran.df.gov.br',
    plateRanges: 'JGA a JHZ, OPA a OPZ (formato antigo)',
    ipvaInfo: 'O IPVA no DF tem alíquota de 3,5% para automóveis, uma das mais altas do país. Oferece desconto para pagamento em cota única.',
    context: 'O Distrito Federal tem uma das maiores frotas per capita do Brasil, com veículos concentrados em Brasília e cidades satélites como Taguatinga e Ceilândia.',
    faqs: [
      { question: 'Como consultar uma placa do Distrito Federal?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo do DF e receba todos os dados no seu e-mail. Grátis e em segundos.' },
      { question: 'Quais as letras de placa do DF?', answer: 'No formato antigo, placas do DF usam as séries JGA a JHZ e OPA a OPZ.' },
      { question: 'Qual a alíquota do IPVA no DF?', answer: 'A alíquota é de 3,5% para automóveis, uma das mais altas do Brasil.' },
    ],
  },
  'espirito-santo': {
    slug: 'espirito-santo', name: 'Espírito Santo', uf: 'ES', capital: 'Vitória',
    detranSite: 'https://detran.es.gov.br',
    plateRanges: 'MTA a MUZ, PPO a PPZ (formato antigo)',
    ipvaInfo: 'O IPVA no Espírito Santo tem alíquota de 2% para automóveis, uma das mais baixas do país.',
    context: 'O Espírito Santo concentra sua frota na Grande Vitória (Vitória, Vila Velha, Serra e Cariacica) e em Cachoeiro de Itapemirim.',
    faqs: [
      { question: 'Como consultar uma placa do Espírito Santo?', answer: 'No PlacaCompleta, informe a placa do veículo capixaba e seu e-mail para receber marca, modelo, FIPE e situação gratuitamente.' },
      { question: 'Quais as letras de placa do Espírito Santo?', answer: 'No formato antigo, placas do ES usam as séries MTA a MUZ e PPO a PPZ.' },
      { question: 'Qual a alíquota do IPVA no ES?', answer: 'A alíquota do IPVA no Espírito Santo é de 2%, uma das mais baixas do Brasil.' },
    ],
  },
  'goias': {
    slug: 'goias', name: 'Goiás', uf: 'GO', capital: 'Goiânia',
    detranSite: 'https://detran.go.gov.br',
    plateRanges: 'OEA a OFZ (formato antigo)',
    ipvaInfo: 'O IPVA em Goiás tem alíquota de 3,75% para automóveis e pode ser parcelado.',
    context: 'Goiás possui uma das maiores frotas do Centro-Oeste, concentrada em Goiânia, Aparecida de Goiânia e Anápolis.',
    faqs: [
      { question: 'Como consultar uma placa de Goiás?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo goiano e receba os dados completos no e-mail. Grátis e instantâneo.' },
      { question: 'Quais as letras de placa de Goiás?', answer: 'No formato antigo, placas de Goiás usam as séries OEA a OFZ.' },
      { question: 'Qual a alíquota do IPVA em Goiás?', answer: 'A alíquota do IPVA em Goiás é de 3,75% para automóveis de passeio.' },
    ],
  },
  'maranhao': {
    slug: 'maranhao', name: 'Maranhão', uf: 'MA', capital: 'São Luís',
    detranSite: 'https://detran.ma.gov.br',
    plateRanges: 'HSA a HTZ, OBA a OBZ (formato antigo)',
    ipvaInfo: 'O IPVA no Maranhão tem alíquota de 2,5% para automóveis.',
    context: 'O Maranhão concentra sua frota em São Luís e Imperatriz, com crescimento significativo de motocicletas no interior do estado.',
    faqs: [
      { question: 'Como consultar uma placa do Maranhão?', answer: 'No PlacaCompleta, digite a placa do veículo maranhense, informe seu e-mail e receba dados como marca, modelo, FIPE e situação.' },
      { question: 'Quais as letras de placa do Maranhão?', answer: 'No formato antigo, placas do Maranhão usam as séries HSA a HTZ e OBA a OBZ.' },
      { question: 'Qual a alíquota do IPVA no Maranhão?', answer: 'A alíquota do IPVA no Maranhão é de 2,5% para automóveis.' },
    ],
  },
  'mato-grosso': {
    slug: 'mato-grosso', name: 'Mato Grosso', uf: 'MT', capital: 'Cuiabá',
    detranSite: 'https://detran.mt.gov.br',
    plateRanges: 'NUA a NWZ, QCA a QCZ (formato antigo)',
    ipvaInfo: 'O IPVA no Mato Grosso tem alíquota de 3% para automóveis, com desconto para pagamento antecipado.',
    context: 'Mato Grosso concentra sua frota em Cuiabá, Rondonópolis e Sinop. O agronegócio impulsiona uma alta demanda por caminhonetes e veículos utilitários.',
    faqs: [
      { question: 'Como consultar uma placa de Mato Grosso?', answer: 'Acesse o PlacaCompleta, informe a placa do veículo de MT e receba os dados no e-mail gratuitamente.' },
      { question: 'Quais as letras de placa de Mato Grosso?', answer: 'No formato antigo, placas de MT usam as séries NUA a NWZ e QCA a QCZ.' },
      { question: 'Qual a alíquota do IPVA em MT?', answer: 'A alíquota do IPVA no Mato Grosso é de 3% para automóveis de passeio.' },
    ],
  },
  'mato-grosso-do-sul': {
    slug: 'mato-grosso-do-sul', name: 'Mato Grosso do Sul', uf: 'MS', capital: 'Campo Grande',
    detranSite: 'https://detran.ms.gov.br',
    plateRanges: 'NQA a NTZ, HTA a HTZ (formato antigo)',
    ipvaInfo: 'O IPVA no Mato Grosso do Sul tem alíquota de 3,5% para automóveis.',
    context: 'Mato Grosso do Sul concentra sua frota em Campo Grande e Dourados, com forte presença de caminhonetes e veículos rurais.',
    faqs: [
      { question: 'Como consultar uma placa do Mato Grosso do Sul?', answer: 'No PlacaCompleta, digite a placa do veículo de MS e receba marca, modelo, FIPE e situação no e-mail.' },
      { question: 'Quais as letras de placa de MS?', answer: 'No formato antigo, placas de MS usam as séries NQA a NTZ.' },
      { question: 'Qual a alíquota do IPVA em MS?', answer: 'A alíquota do IPVA no Mato Grosso do Sul é de 3,5% para automóveis.' },
    ],
  },
  'minas-gerais': {
    slug: 'minas-gerais', name: 'Minas Gerais', uf: 'MG', capital: 'Belo Horizonte',
    detranSite: 'https://detran.mg.gov.br',
    plateRanges: 'GUA a HBZ, OQA a ORZ (formato antigo)',
    ipvaInfo: 'O IPVA em Minas Gerais tem alíquota de 4% para automóveis, a mais alta do país. Pode ser parcelado em 3 vezes.',
    context: 'Minas Gerais possui a segunda maior frota do Brasil, atrás apenas de São Paulo. Belo Horizonte, Uberlândia, Contagem e Juiz de Fora concentram a maior parte dos veículos.',
    faqs: [
      { question: 'Como consultar uma placa de Minas Gerais?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo mineiro e receba os dados completos no e-mail. Grátis e em segundos.' },
      { question: 'Quais as letras de placa de Minas Gerais?', answer: 'No formato antigo, placas de MG usam as séries GUA a HBZ e OQA a ORZ.' },
      { question: 'Qual a alíquota do IPVA em MG?', answer: 'A alíquota do IPVA em Minas Gerais é de 4% para automóveis, a mais alta do Brasil.' },
    ],
  },
  'para': {
    slug: 'para', name: 'Pará', uf: 'PA', capital: 'Belém',
    detranSite: 'https://detran.pa.gov.br',
    plateRanges: 'QDA a QEZ (formato antigo)',
    ipvaInfo: 'O IPVA no Pará tem alíquota de 2,5% para automóveis.',
    context: 'O Pará concentra sua frota em Belém, Ananindeua e Marabá. É o estado com maior frota da região Norte.',
    faqs: [
      { question: 'Como consultar uma placa do Pará?', answer: 'No PlacaCompleta, informe a placa do veículo paraense e receba todos os dados gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa do Pará?', answer: 'No formato antigo, placas do Pará usam as séries QDA a QEZ.' },
      { question: 'Qual a alíquota do IPVA no Pará?', answer: 'A alíquota do IPVA no Pará é de 2,5% para automóveis.' },
    ],
  },
  'paraiba': {
    slug: 'paraiba', name: 'Paraíba', uf: 'PB', capital: 'João Pessoa',
    detranSite: 'https://detran.pb.gov.br',
    plateRanges: 'QFA a QGZ (formato antigo)',
    ipvaInfo: 'O IPVA na Paraíba tem alíquota de 2,5% para automóveis.',
    context: 'A Paraíba concentra sua frota em João Pessoa e Campina Grande, com crescimento no uso de motocicletas no Sertão.',
    faqs: [
      { question: 'Como consultar uma placa da Paraíba?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo paraibano e receba marca, modelo, FIPE e situação no e-mail.' },
      { question: 'Quais as letras de placa da Paraíba?', answer: 'No formato antigo, placas da Paraíba usam as séries QFA a QGZ.' },
      { question: 'Qual a alíquota do IPVA na Paraíba?', answer: 'A alíquota do IPVA na Paraíba é de 2,5% para automóveis de passeio.' },
    ],
  },
  'parana': {
    slug: 'parana', name: 'Paraná', uf: 'PR', capital: 'Curitiba',
    detranSite: 'https://detran.pr.gov.br',
    plateRanges: 'AAA a BEZ, ALJ a AQE (formato antigo)',
    ipvaInfo: 'O IPVA no Paraná tem alíquota de 3,5% para automóveis e pode ser pago em 5 parcelas.',
    context: 'O Paraná possui a quarta maior frota do Brasil, concentrada em Curitiba, Londrina, Maringá e Cascavel.',
    faqs: [
      { question: 'Como consultar uma placa do Paraná?', answer: 'No PlacaCompleta, informe a placa do veículo paranaense e receba os dados completos gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa do Paraná?', answer: 'No formato antigo, placas do PR usam as séries AAA a BEZ.' },
      { question: 'Qual a alíquota do IPVA no Paraná?', answer: 'A alíquota do IPVA no Paraná é de 3,5% para automóveis.' },
    ],
  },
  'pernambuco': {
    slug: 'pernambuco', name: 'Pernambuco', uf: 'PE', capital: 'Recife',
    detranSite: 'https://detran.pe.gov.br',
    plateRanges: 'NXA a OAZ, QHA a QHZ (formato antigo)',
    ipvaInfo: 'O IPVA em Pernambuco tem alíquota de 3% para automóveis.',
    context: 'Pernambuco possui a maior frota do Norte-Nordeste depois da Bahia, concentrada em Recife, Jaboatão dos Guararapes e Olinda.',
    faqs: [
      { question: 'Como consultar uma placa de Pernambuco?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo pernambucano e receba os dados no e-mail gratuitamente.' },
      { question: 'Quais as letras de placa de Pernambuco?', answer: 'No formato antigo, placas de PE usam as séries NXA a OAZ e QHA a QHZ.' },
      { question: 'Qual a alíquota do IPVA em Pernambuco?', answer: 'A alíquota do IPVA em Pernambuco é de 3% para automóveis.' },
    ],
  },
  'piaui': {
    slug: 'piaui', name: 'Piauí', uf: 'PI', capital: 'Teresina',
    detranSite: 'https://detran.pi.gov.br',
    plateRanges: 'QIA a QJZ (formato antigo)',
    ipvaInfo: 'O IPVA no Piauí tem alíquota de 2,5% para automóveis.',
    context: 'O Piauí concentra sua frota em Teresina e Parnaíba, com alta proporção de motocicletas em relação a automóveis.',
    faqs: [
      { question: 'Como consultar uma placa do Piauí?', answer: 'No PlacaCompleta, digite a placa do veículo piauiense e receba todos os dados gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa do Piauí?', answer: 'No formato antigo, placas do Piauí usam as séries QIA a QJZ.' },
      { question: 'Qual a alíquota do IPVA no Piauí?', answer: 'A alíquota do IPVA no Piauí é de 2,5% para automóveis.' },
    ],
  },
  'rio-de-janeiro': {
    slug: 'rio-de-janeiro', name: 'Rio de Janeiro', uf: 'RJ', capital: 'Rio de Janeiro',
    detranSite: 'https://detran.rj.gov.br',
    plateRanges: 'KMA a LVZ, QQA a QRZ (formato antigo)',
    ipvaInfo: 'O IPVA no Rio de Janeiro tem alíquota de 4% para automóveis flex/gasolina e 2% para GNV. Pode ser parcelado em 3 vezes.',
    context: 'O Rio de Janeiro possui a terceira maior frota do Brasil, concentrada na capital, Niterói, São Gonçalo e Duque de Caxias.',
    faqs: [
      { question: 'Como consultar uma placa do Rio de Janeiro?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo carioca e receba marca, modelo, FIPE e situação gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa do RJ?', answer: 'No formato antigo, placas do RJ usam as séries KMA a LVZ e QQA a QRZ.' },
      { question: 'Qual a alíquota do IPVA no RJ?', answer: 'A alíquota do IPVA no RJ é de 4% para automóveis flex/gasolina e 2% para veículos movidos a GNV.' },
    ],
  },
  'rio-grande-do-norte': {
    slug: 'rio-grande-do-norte', name: 'Rio Grande do Norte', uf: 'RN', capital: 'Natal',
    detranSite: 'https://detran.rn.gov.br',
    plateRanges: 'QKA a QLZ (formato antigo)',
    ipvaInfo: 'O IPVA no Rio Grande do Norte tem alíquota de 3% para automóveis.',
    context: 'O RN concentra sua frota em Natal e Mossoró, com crescimento no setor de turismo impulsionando locadoras de veículos.',
    faqs: [
      { question: 'Como consultar uma placa do Rio Grande do Norte?', answer: 'No PlacaCompleta, informe a placa do veículo potiguar e receba os dados completos no e-mail gratuitamente.' },
      { question: 'Quais as letras de placa do RN?', answer: 'No formato antigo, placas do RN usam as séries QKA a QLZ.' },
      { question: 'Qual a alíquota do IPVA no RN?', answer: 'A alíquota do IPVA no Rio Grande do Norte é de 3% para automóveis.' },
    ],
  },
  'rio-grande-do-sul': {
    slug: 'rio-grande-do-sul', name: 'Rio Grande do Sul', uf: 'RS', capital: 'Porto Alegre',
    detranSite: 'https://detran.rs.gov.br',
    plateRanges: 'IAA a JCZ, QSA a QTZ (formato antigo)',
    ipvaInfo: 'O IPVA no RS tem alíquota de 3% para automóveis e pode ser pago em até 6 parcelas com desconto para antecipação.',
    context: 'O Rio Grande do Sul possui a quinta maior frota do Brasil, concentrada em Porto Alegre, Caxias do Sul, Canoas e Pelotas.',
    faqs: [
      { question: 'Como consultar uma placa do Rio Grande do Sul?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo gaúcho e receba todos os dados no e-mail. Grátis e em segundos.' },
      { question: 'Quais as letras de placa do RS?', answer: 'No formato antigo, placas do RS usam as séries IAA a JCZ e QSA a QTZ.' },
      { question: 'Qual a alíquota do IPVA no RS?', answer: 'A alíquota do IPVA no RS é de 3% para automóveis de passeio.' },
    ],
  },
  'rondonia': {
    slug: 'rondonia', name: 'Rondônia', uf: 'RO', capital: 'Porto Velho',
    detranSite: 'https://detran.ro.gov.br',
    plateRanges: 'NEA a NFZ (formato antigo)',
    ipvaInfo: 'O IPVA em Rondônia tem alíquota de 3% para automóveis.',
    context: 'Rondônia concentra sua frota em Porto Velho e Ji-Paraná, com crescimento impulsionado pelo agronegócio.',
    faqs: [
      { question: 'Como consultar uma placa de Rondônia?', answer: 'No PlacaCompleta, digite a placa do veículo de RO e receba marca, modelo, FIPE e situação gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa de Rondônia?', answer: 'No formato antigo, placas de RO usam as séries NEA a NFZ.' },
      { question: 'Qual a alíquota do IPVA em RO?', answer: 'A alíquota do IPVA em Rondônia é de 3% para automóveis.' },
    ],
  },
  'roraima': {
    slug: 'roraima', name: 'Roraima', uf: 'RR', capital: 'Boa Vista',
    detranSite: 'https://detran.rr.gov.br',
    plateRanges: 'QMA a QMZ (formato antigo)',
    ipvaInfo: 'O IPVA em Roraima tem alíquota de 3% para automóveis.',
    context: 'Roraima possui a menor frota entre os estados, concentrada em Boa Vista.',
    faqs: [
      { question: 'Como consultar uma placa de Roraima?', answer: 'Acesse o PlacaCompleta, informe a placa do veículo de RR e receba os dados no e-mail gratuitamente.' },
      { question: 'Quais as letras de placa de Roraima?', answer: 'No formato antigo, placas de RR usam a série QMA a QMZ.' },
      { question: 'Qual a alíquota do IPVA em RR?', answer: 'A alíquota do IPVA em Roraima é de 3% para automóveis.' },
    ],
  },
  'santa-catarina': {
    slug: 'santa-catarina', name: 'Santa Catarina', uf: 'SC', capital: 'Florianópolis',
    detranSite: 'https://detran.sc.gov.br',
    plateRanges: 'LWA a MMZ, QNA a QPZ (formato antigo)',
    ipvaInfo: 'O IPVA em Santa Catarina tem alíquota de 2% para automóveis, uma das mais baixas do país.',
    context: 'Santa Catarina possui uma das maiores frotas per capita do Brasil, concentrada em Florianópolis, Joinville, Blumenau e Chapecó.',
    faqs: [
      { question: 'Como consultar uma placa de Santa Catarina?', answer: 'No PlacaCompleta, digite a placa do veículo catarinense e receba os dados completos no e-mail. Grátis e instantâneo.' },
      { question: 'Quais as letras de placa de SC?', answer: 'No formato antigo, placas de SC usam as séries LWA a MMZ e QNA a QPZ.' },
      { question: 'Qual a alíquota do IPVA em SC?', answer: 'A alíquota do IPVA em SC é de 2% para automóveis, uma das menores do Brasil.' },
    ],
  },
  'sao-paulo': {
    slug: 'sao-paulo', name: 'São Paulo', uf: 'SP', capital: 'São Paulo',
    detranSite: 'https://detran.sp.gov.br',
    plateRanges: 'BFA a GTA, FPA a GTA (formato antigo)',
    ipvaInfo: 'O IPVA em São Paulo tem alíquota de 4% para automóveis flex/gasolina e 2% para veículos elétricos. Pode ser parcelado em até 5 vezes.',
    context: 'São Paulo possui a maior frota de veículos do Brasil, com mais de 30 milhões de veículos. A capital, Campinas, Guarulhos, São Bernardo e Ribeirão Preto concentram a maior parte.',
    faqs: [
      { question: 'Como consultar uma placa de São Paulo?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo paulista e receba marca, modelo, FIPE e situação gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa de São Paulo?', answer: 'No formato antigo, placas de SP usam as séries BFA a GTA, a maior faixa de qualquer estado devido ao tamanho da frota.' },
      { question: 'Qual a alíquota do IPVA em SP?', answer: 'A alíquota do IPVA em SP é de 4% para automóveis flex/gasolina e 2% para veículos elétricos.' },
    ],
  },
  'sergipe': {
    slug: 'sergipe', name: 'Sergipe', uf: 'SE', capital: 'Aracaju',
    detranSite: 'https://detran.se.gov.br',
    plateRanges: 'QOA a QOZ (formato antigo)',
    ipvaInfo: 'O IPVA em Sergipe tem alíquota de 2,5% para automóveis.',
    context: 'Sergipe concentra sua frota em Aracaju e Nossa Senhora do Socorro.',
    faqs: [
      { question: 'Como consultar uma placa de Sergipe?', answer: 'No PlacaCompleta, informe a placa do veículo sergipano e receba os dados completos gratuitamente no e-mail.' },
      { question: 'Quais as letras de placa de Sergipe?', answer: 'No formato antigo, placas de SE usam a série QOA a QOZ.' },
      { question: 'Qual a alíquota do IPVA em SE?', answer: 'A alíquota do IPVA em Sergipe é de 2,5% para automóveis.' },
    ],
  },
  'tocantins': {
    slug: 'tocantins', name: 'Tocantins', uf: 'TO', capital: 'Palmas',
    detranSite: 'https://detran.to.gov.br',
    plateRanges: 'QPA a QPZ (formato antigo)',
    ipvaInfo: 'O IPVA no Tocantins tem alíquota de 3% para automóveis.',
    context: 'Tocantins concentra sua frota em Palmas e Araguaína, com crescimento impulsionado pelo agronegócio.',
    faqs: [
      { question: 'Como consultar uma placa de Tocantins?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo tocantinense e receba todos os dados no e-mail gratuitamente.' },
      { question: 'Quais as letras de placa de Tocantins?', answer: 'No formato antigo, placas de TO usam a série QPA a QPZ.' },
      { question: 'Qual a alíquota do IPVA em TO?', answer: 'A alíquota do IPVA no Tocantins é de 3% para automóveis.' },
    ],
  },
}

export const stateSlugs = Object.keys(states)

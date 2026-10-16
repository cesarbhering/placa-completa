/**
 * Conteúdo SEO único por estado, para resolver as 9 páginas
 * `/consultar-placa/{uf}` marcadas como "Rastreada, mas não indexada"
 * pelo GSC em 26/jun/2026.
 *
 * Cada entry tem 3 blocos:
 * - extendedIntro: 2 parágrafos sobre o cenário veicular do estado
 * - detranInfo: contexto específico do DETRAN local
 * - tipsBuying: dicas práticas pra compra de seminovo naquele estado
 *
 * Chave: slug do estado.
 */

export interface StateSeoIntro {
  extendedIntro: string
  detranInfo: string
  tipsBuying: string
}

export const stateSeoIntros: Record<string, StateSeoIntro> = {
  alagoas: {
    extendedIntro: `Alagoas concentra a maior parte da frota nas regiões metropolitanas de Maceió e Arapiraca. O perfil de veículos mais comum no estado inclui modelos populares como Fiat Strada, Volkswagen Gol, Chevrolet Onix e motos Honda CG. A frota cresce de forma constante mas em ritmo moderado comparada ao Sudeste, o que mantém o mercado de usados ativo e com preços competitivos.

Para quem está comprando ou vendendo um veículo em Alagoas, a consulta pela placa é uma ferramenta essencial para verificar a procedência, situação cadastral e valor FIPE atualizado. O DETRAN-AL emplaca tanto no formato antigo quanto Mercosul, e a transferência de propriedade exige documentação completa.`,
    detranInfo: `O DETRAN de Alagoas fica em Maceió, com unidades de atendimento em diversos municípios incluindo Arapiraca, Palmeira dos Índios e União dos Palmares. O atendimento online cobre licenciamento, consulta de IPVA e segunda via de CRLV. Para serviços que exigem presença, o agendamento é feito pelo site oficial.`,
    tipsBuying: `Antes de fechar negócio em Alagoas, recomenda-se três passos: 1) consultar a placa pelo PlacaCompleta para ver dados completos do veículo, 2) verificar restrições e débitos no site do DETRAN-AL, 3) conferir histórico de multas e licenciamento. Veículos com placa de Alagoas podem ter IPVA atrasado de outras unidades federativas se houve transferência recente.`,
  },

  amapa: {
    extendedIntro: `O Amapá tem uma das menores frotas veiculares do Brasil, concentrada quase totalmente em Macapá e Santana. A logística do estado, com pouco acesso rodoviário ao restante do país, faz com que o mercado de usados tenha dinâmica própria: veículos chegam novos em ritmo moderado e ficam em uso por mais tempo. Picapes médias como Toyota Hilux e Mitsubishi L200 têm presença forte por causa do uso misto urbano-estrada.

A consulta pela placa de veículos do Amapá é particularmente relevante para verificar histórico de origem, já que muitos carros são transferidos do Pará ou outros estados próximos. O valor FIPE serve como referência mas o preço local pode ser ajustado por logística de transporte.`,
    detranInfo: `O DETRAN do Amapá fica em Macapá e oferece atendimento centralizado para todo o estado. Os serviços online incluem consulta de pontuação, segunda via de documentos e situação do veículo. Para emplacamento e transferência, o atendimento presencial requer agendamento prévio.`,
    tipsBuying: `Comprar veículo no Amapá tem peculiaridades: 1) confirme se a placa é mesmo de origem AP ou foi transferida recentemente, 2) verifique se houve transporte interestadual que pode ter impactado a manutenção, 3) consulte o estado de conservação considerando o clima úmido amazônico que acelera oxidação. Use o PlacaCompleta para checar marca, modelo, ano e situação antes de qualquer compra.`,
  },

  roraima: {
    extendedIntro: `Roraima é o estado de menor frota veicular do Brasil, com presença majoritária em Boa Vista. O mercado de usados tem giro lento por causa do tamanho reduzido da população, o que mantém preços relativamente estáveis comparados às médias nacionais. Veículos a diesel e picapes 4x4 são valorizados pelo perfil de uso em estradas mistas (BR-174 e estradas vicinais).

Para quem vai comprar veículo em Roraima, é importante saber que parte da frota vem transferida de outros estados, principalmente Amazonas e Pará. A consulta pela placa permite identificar a origem real, o histórico de manutenção declarado e o valor FIPE de referência.`,
    detranInfo: `O DETRAN de Roraima fica em Boa Vista e centraliza praticamente todos os serviços do estado. O atendimento online cobre consulta de licenciamento, IPVA e CRLV. Para emplacamento Mercosul e transferência, o agendamento via site oficial é obrigatório.`,
    tipsBuying: `Três cuidados específicos pra comprar em Roraima: 1) verificar se a placa é nativa ou de transferência recente (importante pra pendências em outros estados), 2) checar histórico de uso em estradas não pavimentadas (afeta suspensão e tração), 3) confirmar valor FIPE atualizado pra evitar pagar acima do mercado. O PlacaCompleta retorna esses dados em segundos.`,
  },

  rondonia: {
    extendedIntro: `Rondônia tem uma frota expressiva concentrada em Porto Velho, Ji-Paraná e Vilhena, cidades estrategicamente posicionadas ao longo da BR-364. O perfil veicular do estado inclui forte presença de picapes médias e grandes (Toyota Hilux, Chevrolet S10, Mitsubishi L200) por causa do agronegócio e da logística. Motos como Honda XRE 300 e Yamaha Crosser também são comuns no uso misto.

O mercado de usados em Rondônia é ativo, principalmente em Porto Velho e na divisa com Mato Grosso. A consulta pela placa é especialmente útil para verificar se um veículo a venda no estado tem origem local ou foi transferido de outros estados produtores agrícolas.`,
    detranInfo: `O DETRAN de Rondônia tem sede em Porto Velho e CIRETRANs em Ji-Paraná, Vilhena, Ariquemes, Cacoal e Rolim de Moura. O atendimento online cobre licenciamento, IPVA, multas e segunda via. Para placa Mercosul e transferência, agendamento obrigatório.`,
    tipsBuying: `Pra comprar em Rondônia, atenção a três pontos: 1) verificar histórico de uso em estradas e fazendas (afeta veículos pesados), 2) confirmar regularização de IPVA e licenciamento, especialmente em picapes de trabalho, 3) usar o PlacaCompleta para checar valor FIPE e comparar com preço pedido: a diferença pode justificar negociação.`,
  },

  'mato-grosso-do-sul': {
    extendedIntro: `Mato Grosso do Sul tem frota distribuída entre Campo Grande, Dourados, Três Lagoas e Corumbá. O perfil veicular reflete a economia do estado: forte presença de picapes médias e grandes (Toyota Hilux, Volkswagen Amarok, Ford Ranger) por conta do agronegócio, e SUVs intermediários nos centros urbanos. A frota cresce em ritmo acelerado puxada pela renda do agro.

Para o mercado de usados em MS, a consulta pela placa é especialmente útil. Picapes seminovas são produto de alta demanda e a verificação de placa permite confirmar ano, modelo, situação e valor FIPE antes de fechar negócio. O estado também tem volume relevante de transferências para outros estados via Campo Grande.`,
    detranInfo: `O DETRAN do Mato Grosso do Sul tem sede em Campo Grande e unidades em todos os municípios médios e grandes. Os serviços online incluem licenciamento, IPVA, multas, CRLV digital e leilão. Para transferência interestadual e emplacamento Mercosul, agendamento via site oficial.`,
    tipsBuying: `Pra comprar em MS, principalmente picapes: 1) confirmar se o veículo era usado em fazenda (verificar suspensão, tração, embreagem), 2) checar histórico de manutenção e licenciamento, 3) consultar a placa pelo PlacaCompleta antes da negociação: picapes seminovas no MS tem preço alto por demanda, e saber o FIPE exato dá poder de negociação.`,
  },

  'rio-grande-do-sul': {
    extendedIntro: `O Rio Grande do Sul tem uma das maiores frotas veiculares do Brasil, concentrada em Porto Alegre, Caxias do Sul, Pelotas e Santa Maria. O perfil veicular é diversificado: forte presença de hatches populares nos centros urbanos, picapes médias na zona rural e SUVs intermediários na classe média. Marcas europeias têm presença acima da média nacional, especialmente Renault, Peugeot e Citroën.

O mercado de usados gaúcho é um dos mais ativos do país, com Porto Alegre e Caxias do Sul concentrando volume relevante de transações. A consulta pela placa é ferramenta essencial pra qualquer compra, principalmente em veículos com mais de 5 anos onde a verificação de procedência e situação cadastral evita problemas comuns como débitos acumulados e restrições de transferência.`,
    detranInfo: `O DETRAN do Rio Grande do Sul tem sede em Porto Alegre e CRVAs (Centros de Registro de Veículos Automotores) em mais de 200 municípios. O atendimento online é dos mais completos do país: licenciamento, IPVA, multas, CRLV digital, transferência simplificada via SNG-D. Emplacamento Mercosul disponível em todas as unidades.`,
    tipsBuying: `Pra comprar veículo no RS, três pontos: 1) confirmar se foi usado em região litorânea (oxidação por maresia), 2) checar histórico de inverno rigoroso (afeta bateria, motor, suspensão), 3) consultar a placa pelo PlacaCompleta: RS tem mercado maduro e a diferença entre o anunciado e o real é fonte comum de disputa. Ter dados FIPE em mãos vale ouro.`,
  },

  'mato-grosso': {
    extendedIntro: `Mato Grosso tem frota concentrada em Cuiabá, Várzea Grande, Rondonópolis e Sinop. O perfil veicular é fortemente marcado pelo agronegócio: picapes Toyota Hilux, Volkswagen Amarok e Chevrolet S10 dominam o segmento de trabalho, enquanto Fiat Strada e Renault Oroch atendem o uso urbano. A frota cresce em ritmo acima da média nacional puxada pela renda agrícola.

Pra comprar usado em Mato Grosso, a consulta pela placa traz informações fundamentais. Picapes seminovas frequentemente foram usadas em fazendas, o que impacta valor de revenda. A verificação pela placa confirma ano, modelo, situação e valor FIPE: base sólida pra negociar com segurança.`,
    detranInfo: `O DETRAN do Mato Grosso tem sede em Cuiabá e unidades em todos os municípios maiores. O atendimento online cobre licenciamento, IPVA, multas, CRLV digital e regularização. Para transferência interestadual (comum em MT por causa do agronegócio), agendamento obrigatório.`,
    tipsBuying: `Comprar em MT exige cuidados específicos: 1) verificar se a picape foi usada em fazenda (suspensão, embreagem, motor), 2) confirmar regularização documental, principalmente IPVA, 3) consultar placa pelo PlacaCompleta: Mato Grosso tem preços de seminovo acima da média por demanda agrícola, então saber o FIPE exato é diferença entre fechar bem ou pagar caro.`,
  },

  para: {
    extendedIntro: `O Pará tem uma das maiores frotas do Norte, concentrada em Belém, Ananindeua, Santarém e Marabá. O perfil veicular é amplo: hatches populares nos centros urbanos, picapes médias em municípios do interior, e motos Honda e Yamaha em todos os segmentos. A frota cresce em ritmo moderado e o mercado de usados é ativo, principalmente em Belém e na região metropolitana.

Para quem está comprando veículo no Pará, a consulta pela placa é ferramenta essencial. O estado tem alto volume de transferências dentro e fora da região Norte, o que torna a verificação de procedência via placa especialmente importante. Valor FIPE e situação cadastral ajudam a negociar com base em dados reais.`,
    detranInfo: `O DETRAN do Pará tem sede em Belém e CIRETRANs em 30+ municípios incluindo Santarém, Marabá, Castanhal e Altamira. Os serviços online incluem licenciamento, IPVA, multas e CRLV digital. Emplacamento Mercosul disponível com agendamento.`,
    tipsBuying: `Três pontos pra comprar no Pará: 1) considerar o clima úmido amazônico (afeta carroceria, parte elétrica e estofamento), 2) verificar se o veículo veio de outro estado recentemente (comum em Belém), 3) consultar placa pelo PlacaCompleta: saber marca, modelo, ano, situação e valor FIPE antes de negociar evita surpresas.`,
  },

  maranhao: {
    extendedIntro: `O Maranhão tem frota distribuída entre São Luís, Imperatriz, Caxias e Timon. O perfil veicular varia entre regiões: hatches populares e motos urbanas predominam em São Luís, picapes médias e SUVs no interior agrícola. O mercado de usados é ativo em São Luís e Imperatriz, com bom volume de transferências da região metropolitana.

Pra quem vai comprar veículo no MA, a consulta pela placa é ferramenta indispensável. Permite confirmar marca, modelo, ano, cor, valor FIPE e situação cadastral em segundos, antes de qualquer pagamento. Essencial para evitar negócios com pendências, especialmente em veículos seminovos.`,
    detranInfo: `O DETRAN do Maranhão tem sede em São Luís e CIRETRANs em Imperatriz, Caxias, Bacabal e outros municípios maiores. O atendimento online cobre licenciamento, IPVA, multas, CRLV digital e segunda via. Para placa Mercosul e transferência, agendamento via site oficial.`,
    tipsBuying: `Comprar veículo no MA, três cuidados: 1) clima litorâneo em São Luís (atenção a oxidação por maresia), 2) verificar histórico de uso em estradas (afeta suspensão e pneus), 3) consultar placa pelo PlacaCompleta: saber valor FIPE atualizado é base para negociar com segurança, especialmente em hatches populares de alta liquidez no estado.`,
  },
}

export function getStateSeoIntro(slug: string): StateSeoIntro | null {
  return stateSeoIntros[slug] || null
}

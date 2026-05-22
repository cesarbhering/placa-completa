export interface CapitalData {
  slug: string
  name: string
  stateSlug: string
  context: string
  neighborhoods: string
  faqs: { question: string; answer: string }[]
}

export const capitals: Record<string, CapitalData> = {
  'sao-paulo': {
    slug: 'sao-paulo', name: 'São Paulo', stateSlug: 'sao-paulo',
    context: 'A capital paulista é a maior cidade do Brasil e da América Latina, com mais de 12 milhões de habitantes e uma frota que ultrapassa 8 milhões de veículos. O rodízio municipal de placas, as zonas de máxima restrição (ZMRC) e o intenso trânsito tornam a consulta veicular ainda mais útil na cidade.',
    neighborhoods: 'Centro, Pinheiros, Vila Mariana, Moema, Santana, Tatuapé, Itaquera, Morumbi, Butantã e Santo Amaro',
    faqs: [
      { question: 'Como consultar uma placa de São Paulo capital?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo paulistano e seu e-mail. Em segundos você recebe marca, modelo, ano, valor FIPE e situação do veículo — grátis, sem cadastro.' },
      { question: 'O rodízio de placas de SP vale para quais veículos?', answer: 'O rodízio municipal em São Paulo atinge carros particulares, caminhões e veículos de carga dentro do centro expandido. Motos, ônibus, táxis e veículos elétricos estão isentos.' },
      { question: 'Como saber se um carro de São Paulo tem débitos?', answer: 'Na consulta do PlacaCompleta você recebe a situação do veículo, incluindo indicações de restrições ou débitos. Para consulta completa de IPVA e multas, acesse também o site do DETRAN-SP.' },
    ],
  },
  'rio-de-janeiro': {
    slug: 'rio-de-janeiro', name: 'Rio de Janeiro', stateSlug: 'rio-de-janeiro',
    context: 'A capital fluminense é a segunda maior cidade do Brasil, com cerca de 6,8 milhões de habitantes. A frota carioca supera 3 milhões de veículos, distribuídos entre as zonas Norte, Sul, Oeste e Centro — com intenso fluxo diário entre municípios da Baixada e da região metropolitana.',
    neighborhoods: 'Copacabana, Ipanema, Leblon, Tijuca, Barra da Tijuca, Recreio, Jacarepaguá, Centro, Méier e Campo Grande',
    faqs: [
      { question: 'Como consultar uma placa do Rio de Janeiro?', answer: 'No PlacaCompleta, digite a placa do veículo carioca e informe seu e-mail. Receba marca, modelo, ano, cor, FIPE e situação em segundos, gratuitamente.' },
      { question: 'Qual o DETRAN do Rio de Janeiro capital?', answer: 'O DETRAN-RJ tem postos espalhados por toda a capital, incluindo Centro, Ilha do Governador, Campo Grande e Barra. Serviços online estão em detran.rj.gov.br.' },
      { question: 'Como saber se um carro do RJ foi roubado?', answer: 'A consulta do PlacaCompleta retorna a situação do veículo. Para confirmação oficial de ocorrência, cruze com o DETRAN-RJ ou o sistema SINESP Cidadão.' },
    ],
  },
  'brasilia': {
    slug: 'brasilia', name: 'Brasília', stateSlug: 'distrito-federal',
    context: 'Brasília, capital federal, tem uma das maiores frotas per capita do Brasil. O Plano Piloto e as regiões administrativas como Taguatinga, Ceilândia, Gama e Águas Claras concentram a maior parte dos veículos registrados no DF.',
    neighborhoods: 'Plano Piloto, Asa Sul, Asa Norte, Lago Sul, Lago Norte, Taguatinga, Ceilândia, Gama, Sobradinho e Águas Claras',
    faqs: [
      { question: 'Como consultar uma placa de Brasília?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo do DF e seu e-mail. Em segundos você recebe todos os dados do veículo, inclusive o valor FIPE. Totalmente grátis.' },
      { question: 'As placas de Brasília são diferentes das do entorno goiano?', answer: 'Sim. Veículos registrados no DF usam as séries de letras de Brasília. Veículos do entorno (Luziânia, Valparaíso, Águas Lindas) são registrados em Goiás e usam séries do GO.' },
      { question: 'Como saber a situação de um carro em Brasília?', answer: 'A consulta no PlacaCompleta mostra a situação do veículo. Para débitos detalhados de IPVA e multas, consulte também o DETRAN-DF em detran.df.gov.br.' },
    ],
  },
  'fortaleza': {
    slug: 'fortaleza', name: 'Fortaleza', stateSlug: 'ceara',
    context: 'Fortaleza é a quarta cidade mais populosa do Brasil, com cerca de 2,7 milhões de habitantes. A capital cearense concentra mais da metade da frota do estado, distribuída pela Aldeota, Meireles, Messejana, Parangaba e outros bairros de forte fluxo.',
    neighborhoods: 'Aldeota, Meireles, Cocó, Messejana, Parangaba, Benfica, Papicu, Centro, Maraponga e Edson Queiroz',
    faqs: [
      { question: 'Como consultar uma placa de Fortaleza?', answer: 'No PlacaCompleta, digite a placa do veículo cearense e informe seu e-mail. Em segundos você recebe marca, modelo, ano, FIPE e situação gratuitamente.' },
      { question: 'Onde fica o DETRAN de Fortaleza?', answer: 'O DETRAN-CE tem a sede principal em Fortaleza, com postos descentralizados nos shoppings e Vapt Vupt da cidade. Serviços online em detran.ce.gov.br.' },
      { question: 'O IPVA de Fortaleza pode ser parcelado?', answer: 'Sim. O IPVA no Ceará (alíquota de 3%) pode ser pago em cotas ou à vista com desconto — as regras valem para toda a capital.' },
    ],
  },
  'salvador': {
    slug: 'salvador', name: 'Salvador', stateSlug: 'bahia',
    context: 'Salvador, primeira capital do Brasil, tem cerca de 2,4 milhões de habitantes e uma das maiores frotas do Nordeste. O trânsito soteropolitano se concentra na Orla, no Centro Histórico e em bairros como Pituba, Barra, Rio Vermelho e Itapuã.',
    neighborhoods: 'Pituba, Barra, Rio Vermelho, Itapuã, Pelourinho, Centro, Brotas, Liberdade, Cajazeiras e Stella Maris',
    faqs: [
      { question: 'Como consultar uma placa de Salvador?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo baiano e seu e-mail. Receba marca, modelo, FIPE e situação em segundos, grátis.' },
      { question: 'Quais as letras de placa de Salvador?', answer: 'Placas registradas em Salvador usam as séries JAA a JDZ e OVA a OXZ no formato antigo. No Mercosul, a identificação é feita pelo município de registro.' },
      { question: 'Como ver débitos de um veículo em Salvador?', answer: 'A consulta no PlacaCompleta mostra a situação básica. Para débitos detalhados de IPVA, licenciamento e multas, consulte também o DETRAN-BA em detran.ba.gov.br.' },
    ],
  },
  'belo-horizonte': {
    slug: 'belo-horizonte', name: 'Belo Horizonte', stateSlug: 'minas-gerais',
    context: 'Belo Horizonte é a capital de Minas Gerais e a sexta cidade mais populosa do Brasil, com cerca de 2,3 milhões de habitantes. A frota de BH passa de 1,8 milhão de veículos e se distribui por toda a Região Metropolitana — Contagem, Betim, Nova Lima e outras cidades vizinhas.',
    neighborhoods: 'Savassi, Funcionários, Centro, Lourdes, Buritis, Pampulha, Barreiro, Venda Nova, Sion e Belvedere',
    faqs: [
      { question: 'Como consultar uma placa de Belo Horizonte?', answer: 'No PlacaCompleta, digite a placa do veículo belo-horizontino e seu e-mail. Em segundos você recebe dados completos como marca, modelo, FIPE e situação.' },
      { question: 'Qual o site do DETRAN-MG em BH?', answer: 'O DETRAN-MG tem sede em Belo Horizonte e oferece serviços online em detran.mg.gov.br, incluindo transferência, licenciamento e consulta de pontos na CNH.' },
      { question: 'Como saber o valor FIPE de um carro de BH?', answer: 'Basta consultar a placa no PlacaCompleta. Junto com os dados do veículo, você recebe o valor FIPE atualizado no e-mail — útil para compra, venda ou seguro.' },
    ],
  },
  'manaus': {
    slug: 'manaus', name: 'Manaus', stateSlug: 'amazonas',
    context: 'Manaus é a maior cidade da região Norte, com cerca de 2,2 milhões de habitantes. A capital amazonense abriga a Zona Franca de Manaus, um dos principais polos industriais automotivos do país, e concentra a maior frota do Norte brasileiro.',
    neighborhoods: 'Centro, Adrianópolis, Chapada, Ponta Negra, Flores, Cidade Nova, Cachoeirinha, Alvorada, Compensa e São José',
    faqs: [
      { question: 'Como consultar uma placa de Manaus?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo amazonense e seu e-mail. Receba marca, modelo, ano, FIPE e situação em segundos, grátis.' },
      { question: 'Veículos fabricados na Zona Franca têm placa de Manaus?', answer: 'Não. Motocicletas e veículos fabricados na Zona Franca recebem placas conforme o município onde forem registrados — que pode ser Manaus ou qualquer outra cidade do país.' },
      { question: 'Qual o DETRAN da capital do Amazonas?', answer: 'O DETRAN-AM tem a sede em Manaus, com serviços online em detran.am.gov.br para transferência, licenciamento e consulta veicular.' },
    ],
  },
  'curitiba': {
    slug: 'curitiba', name: 'Curitiba', stateSlug: 'parana',
    context: 'Curitiba, capital do Paraná, tem cerca de 1,8 milhão de habitantes e uma das maiores frotas do Sul do país. Conhecida pelo planejamento urbano e pelo sistema integrado de transporte, a cidade ainda assim concentra mais de 1,4 milhão de veículos registrados.',
    neighborhoods: 'Batel, Água Verde, Centro, Bigorrilho, Cabral, Portão, Ecoville, Santa Felicidade, Boqueirão e CIC',
    faqs: [
      { question: 'Como consultar uma placa de Curitiba?', answer: 'No PlacaCompleta, digite a placa do veículo curitibano e informe seu e-mail. Em segundos você recebe marca, modelo, ano, FIPE e situação gratuitamente.' },
      { question: 'Onde fica o DETRAN-PR em Curitiba?', answer: 'O DETRAN-PR tem a sede administrativa em Curitiba e postos descentralizados em Vapt Vupt e shoppings. Serviços online em detran.pr.gov.br.' },
      { question: 'Como saber a situação de um veículo em Curitiba?', answer: 'A consulta no PlacaCompleta mostra a situação do veículo. Para IPVA, licenciamento e multas, consulte também o DETRAN-PR.' },
    ],
  },
  'recife': {
    slug: 'recife', name: 'Recife', stateSlug: 'pernambuco',
    context: 'Recife é a capital de Pernambuco e um dos principais centros urbanos do Nordeste, com cerca de 1,6 milhão de habitantes. A capital pernambucana concentra a maior frota do estado, distribuída pela Região Metropolitana do Recife — incluindo Olinda, Jaboatão, Paulista e Camaragibe.',
    neighborhoods: 'Boa Viagem, Pina, Casa Forte, Parnamirim, Boa Vista, Santo Antônio, Ibura, Cordeiro, Torre e Espinheiro',
    faqs: [
      { question: 'Como consultar uma placa do Recife?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo pernambucano e seu e-mail. Em segundos você recebe todos os dados — marca, modelo, FIPE, situação. Grátis.' },
      { question: 'Qual o DETRAN de Recife?', answer: 'O DETRAN-PE tem sede em Recife, com serviços online em detran.pe.gov.br, incluindo licenciamento, transferência e consulta veicular.' },
      { question: 'Como saber o valor FIPE de um carro do Recife?', answer: 'Basta consultar a placa no PlacaCompleta — o valor FIPE vem no e-mail junto com os outros dados do veículo. Totalmente grátis.' },
    ],
  },
  'porto-alegre': {
    slug: 'porto-alegre', name: 'Porto Alegre', stateSlug: 'rio-grande-do-sul',
    context: 'Porto Alegre é a capital do Rio Grande do Sul, com cerca de 1,3 milhão de habitantes. A capital gaúcha concentra a maior frota do estado e forma uma das maiores regiões metropolitanas do Sul ao lado de Curitiba.',
    neighborhoods: 'Centro Histórico, Moinhos de Vento, Bela Vista, Petrópolis, Menino Deus, Cidade Baixa, Tristeza, Ipanema, Partenon e Lomba do Pinheiro',
    faqs: [
      { question: 'Como consultar uma placa de Porto Alegre?', answer: 'No PlacaCompleta, digite a placa do veículo porto-alegrense e informe seu e-mail. Receba marca, modelo, FIPE e situação em segundos, grátis.' },
      { question: 'Onde fica o DETRAN-RS em Porto Alegre?', answer: 'O DETRAN-RS tem a sede em Porto Alegre e postos descentralizados na capital e região metropolitana. Serviços online em detran.rs.gov.br.' },
      { question: 'O IPVA de Porto Alegre pode ser parcelado?', answer: 'Sim. O IPVA no RS (alíquota de 3%) pode ser parcelado em até 3 vezes ou pago à vista com desconto.' },
    ],
  },
  'goiania': {
    slug: 'goiania', name: 'Goiânia', stateSlug: 'goias',
    context: 'Goiânia é a capital de Goiás, com cerca de 1,5 milhão de habitantes e a maior frota do Centro-Oeste depois de Brasília. A capital goiana concentra a indústria automotiva regional e atende toda a Região Metropolitana, com municípios como Aparecida de Goiânia, Anápolis e Trindade.',
    neighborhoods: 'Setor Bueno, Setor Oeste, Setor Marista, Setor Sul, Setor Central, Jardim Goiás, Alto da Glória, Campinas, Vila Nova e Setor Pedro Ludovico',
    faqs: [
      { question: 'Como consultar uma placa de Goiânia?', answer: 'No PlacaCompleta, digite a placa do veículo goianiense e informe seu e-mail. Receba marca, modelo, ano, FIPE e situação em segundos, grátis.' },
      { question: 'Onde fica o DETRAN-GO em Goiânia?', answer: 'O DETRAN-GO tem a sede em Goiânia e postos descentralizados na capital e interior. Serviços online em detran.go.gov.br para transferência, licenciamento e consulta veicular.' },
      { question: 'Como saber a situação de um veículo em Goiânia?', answer: 'A consulta no PlacaCompleta mostra a situação básica do veículo. Para IPVA, licenciamento e multas detalhadas, consulte também o DETRAN-GO.' },
    ],
  },
  'belem': {
    slug: 'belem', name: 'Belém', stateSlug: 'para',
    context: 'Belém é a capital do Pará e a segunda maior cidade da região Norte, com cerca de 1,3 milhão de habitantes. A capital paraense é o principal centro econômico da Amazônia oriental e concentra a maior frota do estado.',
    neighborhoods: 'Nazaré, Batista Campos, Umarizal, Reduto, Pedreira, Marco, Telégrafo, Cremação, Guamá e Mangueirão',
    faqs: [
      { question: 'Como consultar uma placa de Belém?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo paraense e seu e-mail. Em segundos você recebe marca, modelo, ano, FIPE e situação gratuitamente.' },
      { question: 'Qual o DETRAN do Pará em Belém?', answer: 'O DETRAN-PA tem sede em Belém, com serviços online em detran.pa.gov.br para transferência, licenciamento, multas e consulta veicular.' },
      { question: 'Como ver o valor FIPE de um carro em Belém?', answer: 'Basta consultar a placa no PlacaCompleta — o valor FIPE atualizado vem no e-mail junto com os demais dados do veículo, totalmente grátis.' },
    ],
  },
  'sao-luis': {
    slug: 'sao-luis', name: 'São Luís', stateSlug: 'maranhao',
    context: 'São Luís é a capital do Maranhão, com cerca de 1,1 milhão de habitantes. Única capital brasileira fundada por franceses, São Luís concentra a maior frota do estado e é polo de logística portuária no Norte/Nordeste.',
    neighborhoods: 'Centro, Renascença, Calhau, Cohama, Cohajap, Olho d\'Água, Anil, Vinhais, Ponta D\'Areia e Turu',
    faqs: [
      { question: 'Como consultar uma placa de São Luís?', answer: 'No PlacaCompleta, digite a placa do veículo maranhense e seu e-mail. Receba marca, modelo, FIPE e situação em segundos, grátis.' },
      { question: 'Qual o DETRAN-MA em São Luís?', answer: 'O DETRAN-MA tem sede em São Luís. Serviços online em detran.ma.gov.br para transferência, licenciamento e multas.' },
      { question: 'Como descobrir o valor FIPE de um carro em São Luís?', answer: 'Consulte a placa no PlacaCompleta. O valor FIPE atualizado é enviado no e-mail junto com os demais dados.' },
    ],
  },
  'maceio': {
    slug: 'maceio', name: 'Maceió', stateSlug: 'alagoas',
    context: 'Maceió é a capital de Alagoas, com cerca de 1 milhão de habitantes. Conhecida pelas praias urbanas e pelo turismo, a capital alagoana concentra a maior frota do estado.',
    neighborhoods: 'Pajuçara, Ponta Verde, Jatiúca, Mangabeiras, Cruz das Almas, Farol, Tabuleiro do Martins, Antares, Benedito Bentes e Cidade Universitária',
    faqs: [
      { question: 'Como consultar uma placa de Maceió?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo alagoano e informe seu e-mail. Em segundos recebe dados completos — grátis e sem cadastro.' },
      { question: 'Qual o site do DETRAN-AL?', answer: 'O DETRAN-AL tem sede em Maceió e atende em detran.al.gov.br, com serviços online para licenciamento, transferência e consulta veicular.' },
      { question: 'Como saber se um carro de Maceió tem restrição?', answer: 'A consulta no PlacaCompleta mostra a situação básica. Para detalhes de débito de IPVA e multas, consulte também o DETRAN-AL.' },
    ],
  },
  'natal': {
    slug: 'natal', name: 'Natal', stateSlug: 'rio-grande-do-norte',
    context: 'Natal é a capital do Rio Grande do Norte, com cerca de 900 mil habitantes. A "Cidade do Sol" concentra a maior frota do estado e é polo turístico do Nordeste.',
    neighborhoods: 'Petrópolis, Tirol, Ponta Negra, Lagoa Nova, Capim Macio, Candelária, Alecrim, Lagoa Seca, Nova Descoberta e Cidade Alta',
    faqs: [
      { question: 'Como consultar uma placa de Natal?', answer: 'No PlacaCompleta, digite a placa do veículo potiguar e seu e-mail. Em segundos você recebe marca, modelo, FIPE e situação gratuitamente.' },
      { question: 'Onde fica o DETRAN-RN em Natal?', answer: 'O DETRAN-RN tem sede em Natal. Serviços online em detran.rn.gov.br para licenciamento, transferência e consulta.' },
      { question: 'Quanto custa consultar uma placa em Natal?', answer: 'Nada. A consulta no PlacaCompleta é totalmente gratuita, sem cadastro e sem custo escondido.' },
    ],
  },
  'campo-grande': {
    slug: 'campo-grande', name: 'Campo Grande', stateSlug: 'mato-grosso-do-sul',
    context: 'Campo Grande é a capital de Mato Grosso do Sul, com cerca de 925 mil habitantes. A capital sul-mato-grossense concentra a maior frota do estado e é polo logístico para o agronegócio do Centro-Oeste.',
    neighborhoods: 'Centro, Carandá Bosque, Jardim dos Estados, Vila Albuquerque, Tiradentes, Mata do Jacinto, Coronel Antonino, Universitário, Monte Castelo e Aero Rancho',
    faqs: [
      { question: 'Como consultar uma placa de Campo Grande?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo sul-mato-grossense e informe seu e-mail. Receba os dados em segundos, gratuitamente.' },
      { question: 'Qual o DETRAN-MS?', answer: 'O DETRAN-MS tem sede em Campo Grande, com serviços online em detran.ms.gov.br para transferência, licenciamento e consulta veicular.' },
      { question: 'Como ver o valor FIPE de um carro em Campo Grande?', answer: 'Consultando a placa no PlacaCompleta — o valor FIPE vem direto no e-mail com os outros dados do veículo.' },
    ],
  },
  'teresina': {
    slug: 'teresina', name: 'Teresina', stateSlug: 'piaui',
    context: 'Teresina é a capital do Piauí, com cerca de 880 mil habitantes. A única capital nordestina fora do litoral, Teresina é polo médico e logístico do Meio-Norte, concentrando a maior frota do estado.',
    neighborhoods: 'Centro, Jóquei, Fátima, São Cristóvão, Horto, Ininga, Piçarra, Saci, Dirceu Arcoverde e Memorare',
    faqs: [
      { question: 'Como consultar uma placa de Teresina?', answer: 'No PlacaCompleta, digite a placa do veículo piauiense e seu e-mail. Receba marca, modelo, FIPE e situação em segundos — totalmente grátis.' },
      { question: 'Qual o DETRAN-PI em Teresina?', answer: 'O DETRAN-PI tem sede em Teresina. Serviços online em detran.pi.gov.br para licenciamento, transferência e multas.' },
      { question: 'A consulta de placa do PI inclui valor FIPE?', answer: 'Sim. O PlacaCompleta retorna o valor FIPE atualizado de qualquer veículo registrado no Piauí, junto com os demais dados.' },
    ],
  },
  'joao-pessoa': {
    slug: 'joao-pessoa', name: 'João Pessoa', stateSlug: 'paraiba',
    context: 'João Pessoa é a capital da Paraíba, com cerca de 830 mil habitantes. A terceira cidade mais antiga do Brasil concentra a maior frota do estado e é destino turístico do Nordeste.',
    neighborhoods: 'Tambaú, Cabo Branco, Manaíra, Bessa, Bancários, Mangabeira, Centro, Jaguaribe, Cristo Redentor e Altiplano',
    faqs: [
      { question: 'Como consultar uma placa de João Pessoa?', answer: 'No PlacaCompleta, digite a placa do veículo paraibano e seu e-mail. Em segundos recebe os dados completos do veículo, grátis.' },
      { question: 'Onde fica o DETRAN-PB?', answer: 'O DETRAN-PB tem sede em João Pessoa. Serviços online em detran.pb.gov.br para transferência, licenciamento e consultas.' },
      { question: 'Como saber se um carro de João Pessoa tem multas?', answer: 'A consulta no PlacaCompleta mostra a situação básica. Para detalhamento de multas e IPVA, consulte também o DETRAN-PB.' },
    ],
  },
  'florianopolis': {
    slug: 'florianopolis', name: 'Florianópolis', stateSlug: 'santa-catarina',
    context: 'Florianópolis é a capital de Santa Catarina, com cerca de 510 mil habitantes. Conhecida como "Ilha da Magia", a capital catarinense concentra a frota da região litorânea e é polo turístico do Sul do Brasil.',
    neighborhoods: 'Centro, Trindade, Córrego Grande, Itacorubi, Lagoa da Conceição, Jurerê Internacional, Canasvieiras, Ingleses, Campeche e Coqueiros',
    faqs: [
      { question: 'Como consultar uma placa de Florianópolis?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo catarinense e informe seu e-mail. Receba marca, modelo, FIPE e situação em segundos, grátis.' },
      { question: 'Qual o DETRAN-SC?', answer: 'O DETRAN-SC tem sede em Florianópolis e postos descentralizados pelo estado. Serviços online em detran.sc.gov.br.' },
      { question: 'O IPVA de SC pode ser parcelado?', answer: 'Sim. O IPVA em Santa Catarina (alíquota de 2% para carros) pode ser parcelado em até 3 vezes ou pago à vista com desconto.' },
    ],
  },
  'aracaju': {
    slug: 'aracaju', name: 'Aracaju', stateSlug: 'sergipe',
    context: 'Aracaju é a capital de Sergipe, com cerca de 660 mil habitantes. A capital sergipana concentra a maior frota do menor estado brasileiro e é polo administrativo e de serviços do Nordeste oriental.',
    neighborhoods: 'Atalaia, Treze de Julho, Coroa do Meio, Jardins, Grageru, Pereira Lobo, Suíssa, Centro, Aruana e Salgado Filho',
    faqs: [
      { question: 'Como consultar uma placa de Aracaju?', answer: 'No PlacaCompleta, digite a placa do veículo sergipano e seu e-mail. Em segundos você recebe marca, modelo, FIPE e situação — grátis e sem cadastro.' },
      { question: 'Qual o DETRAN-SE em Aracaju?', answer: 'O DETRAN-SE tem sede em Aracaju. Serviços online em detran.se.gov.br para licenciamento, transferência e consulta veicular.' },
      { question: 'A consulta de placa de SE inclui FIPE?', answer: 'Sim. O PlacaCompleta retorna o valor FIPE atualizado junto com os demais dados do veículo, totalmente grátis.' },
    ],
  },
  'cuiaba': {
    slug: 'cuiaba', name: 'Cuiabá', stateSlug: 'mato-grosso',
    context: 'Cuiabá é a capital de Mato Grosso, com cerca de 650 mil habitantes. A "Cidade Verde" é o centro político e logístico do agronegócio mato-grossense, concentrando a maior frota do estado.',
    neighborhoods: 'Centro, Bandeirantes, Jardim das Américas, Goiabeiras, Verdão, CPA, Coxipó, Boa Esperança, Ribeirão da Ponte e Jardim Imperial',
    faqs: [
      { question: 'Como consultar uma placa de Cuiabá?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo mato-grossense e informe seu e-mail. Receba os dados em segundos, gratuitamente.' },
      { question: 'Qual o DETRAN-MT?', answer: 'O DETRAN-MT tem sede em Cuiabá, com serviços online em detran.mt.gov.br para transferência, licenciamento e consulta de multas.' },
      { question: 'Como ver o valor FIPE de um carro em Cuiabá?', answer: 'Consultando a placa no PlacaCompleta — o valor FIPE atualizado vem no e-mail com os outros dados do veículo.' },
    ],
  },
  'porto-velho': {
    slug: 'porto-velho', name: 'Porto Velho', stateSlug: 'rondonia',
    context: 'Porto Velho é a capital de Rondônia, com cerca de 470 mil habitantes. Às margens do rio Madeira, a capital rondoniense concentra a maior frota do estado e é polo logístico do Norte.',
    neighborhoods: 'Centro, Nova Porto Velho, Olaria, Costa e Silva, Embratel, Conceição, Aponiã, Areal, Liberdade e Calama',
    faqs: [
      { question: 'Como consultar uma placa de Porto Velho?', answer: 'No PlacaCompleta, digite a placa do veículo rondoniense e seu e-mail. Em segundos recebe dados completos do veículo — totalmente grátis.' },
      { question: 'Qual o DETRAN-RO em Porto Velho?', answer: 'O DETRAN-RO tem sede em Porto Velho. Serviços online em detran.ro.gov.br para licenciamento, transferência e multas.' },
      { question: 'A consulta veicular de RO é gratuita?', answer: 'Sim. O PlacaCompleta oferece consulta gratuita de qualquer placa registrada em Rondônia, com dados completos enviados no e-mail.' },
    ],
  },
  'macapa': {
    slug: 'macapa', name: 'Macapá', stateSlug: 'amapa',
    context: 'Macapá é a capital do Amapá, com cerca de 530 mil habitantes. Cortada pela Linha do Equador, a capital amapaense concentra a maior frota do estado e é o portão de entrada para a Amazônia setentrional.',
    neighborhoods: 'Centro, Beirol, Trem, Pacoval, Buritizal, Santa Rita, Marco Zero, Universidade, Jardim Marco Zero e Novo Buritizal',
    faqs: [
      { question: 'Como consultar uma placa de Macapá?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo amapaense e informe seu e-mail. Em segundos recebe marca, modelo, FIPE e situação — grátis.' },
      { question: 'Qual o DETRAN-AP?', answer: 'O DETRAN-AP tem sede em Macapá. Serviços online em detran.ap.gov.br para licenciamento, transferência e consulta veicular.' },
      { question: 'O PlacaCompleta funciona para placas do AP?', answer: 'Sim. O PlacaCompleta consulta qualquer placa registrada no Brasil, incluindo todas as registradas no Amapá.' },
    ],
  },
  'rio-branco': {
    slug: 'rio-branco', name: 'Rio Branco', stateSlug: 'acre',
    context: 'Rio Branco é a capital do Acre, com cerca de 410 mil habitantes. Cortada pelo rio Acre, a capital acreana concentra a maior frota do estado e é o principal centro urbano da Amazônia Ocidental.',
    neighborhoods: 'Centro, Bosque, Cadeia Velha, Conjunto Castelo Branco, Sobral, Tucumã, Jardim Tropical, Conjunto Manoel Julião, Floresta Sul e Vila Acre',
    faqs: [
      { question: 'Como consultar uma placa de Rio Branco?', answer: 'No PlacaCompleta, digite a placa do veículo acreano e seu e-mail. Em segundos você recebe marca, modelo, FIPE e situação — totalmente grátis.' },
      { question: 'Qual o DETRAN-AC?', answer: 'O DETRAN-AC tem sede em Rio Branco. Serviços online em detran.ac.gov.br para licenciamento, transferência e consulta veicular.' },
      { question: 'A consulta no Acre tem custo?', answer: 'Não. A consulta no PlacaCompleta é 100% gratuita, sem cadastro, para qualquer placa registrada no Brasil — incluindo todas as do Acre.' },
    ],
  },
  'boa-vista': {
    slug: 'boa-vista', name: 'Boa Vista', stateSlug: 'roraima',
    context: 'Boa Vista é a capital de Roraima, com cerca de 440 mil habitantes. Única capital brasileira ao norte da Linha do Equador, a capital roraimense concentra praticamente toda a frota do estado.',
    neighborhoods: 'Centro, São Vicente, Caçari, Mecejana, Aparecida, Pricumã, União, 13 de Setembro, Cinturão Verde e Cauamé',
    faqs: [
      { question: 'Como consultar uma placa de Boa Vista?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo roraimense e informe seu e-mail. Receba os dados completos em segundos, gratuitamente.' },
      { question: 'Qual o DETRAN-RR em Boa Vista?', answer: 'O DETRAN-RR tem sede em Boa Vista. Serviços online em detran.rr.gov.br para licenciamento, transferência e multas.' },
      { question: 'O PlacaCompleta tem dados de placas de RR?', answer: 'Sim. O PlacaCompleta consulta qualquer placa registrada no Brasil, incluindo todas as registradas em Roraima.' },
    ],
  },
  'palmas': {
    slug: 'palmas', name: 'Palmas', stateSlug: 'tocantins',
    context: 'Palmas é a capital do Tocantins, com cerca de 320 mil habitantes. Última capital planejada do Brasil (1989), Palmas concentra a maior frota do estado mais jovem da federação.',
    neighborhoods: 'Plano Diretor Sul, Plano Diretor Norte, Aureny I, II e III, Taquaralto, Jardim Aureny IV, Setor Bertaville, Setor Sul, Lago Norte e Lago Sul',
    faqs: [
      { question: 'Como consultar uma placa de Palmas?', answer: 'No PlacaCompleta, digite a placa do veículo tocantinense e seu e-mail. Em segundos recebe os dados — totalmente grátis e sem cadastro.' },
      { question: 'Qual o DETRAN-TO em Palmas?', answer: 'O DETRAN-TO tem sede em Palmas. Serviços online em detran.to.gov.br para licenciamento, transferência e multas.' },
      { question: 'A consulta de placa em Palmas inclui FIPE?', answer: 'Sim. O PlacaCompleta retorna o valor FIPE atualizado junto com os demais dados do veículo, sem custo.' },
    ],
  },
  'vitoria': {
    slug: 'vitoria', name: 'Vitória', stateSlug: 'espirito-santo',
    context: 'Vitória é a capital do Espírito Santo, com cerca de 365 mil habitantes. Localizada em uma ilha, a capital capixaba é o coração da Região Metropolitana da Grande Vitória — que inclui Vila Velha, Serra e Cariacica e ultrapassa 2 milhões de habitantes.',
    neighborhoods: 'Centro, Praia do Canto, Jardim da Penha, Mata da Praia, Bento Ferreira, Jardim Camburi, Enseada do Suá, Santa Lúcia, Ilha do Frade e Goiabeiras',
    faqs: [
      { question: 'Como consultar uma placa de Vitória?', answer: 'Acesse o PlacaCompleta, digite a placa do veículo capixaba e informe seu e-mail. Em segundos recebe marca, modelo, FIPE e situação — grátis.' },
      { question: 'Qual o DETRAN-ES?', answer: 'O DETRAN-ES tem sede em Vitória. Serviços online em detran.es.gov.br para licenciamento, transferência e consulta veicular.' },
      { question: 'Como saber o valor FIPE de um carro de Vitória?', answer: 'Consultando a placa no PlacaCompleta — o valor FIPE atualizado vem no e-mail com os demais dados do veículo.' },
    ],
  },
}

export const capitalSlugByStateSlug: Record<string, string> = Object.fromEntries(
  Object.entries(capitals).map(([slug, capital]) => [capital.stateSlug, slug])
)

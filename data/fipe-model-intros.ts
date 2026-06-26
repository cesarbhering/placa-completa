/**
 * Textos SEO únicos por modelo. Cada entry deve ser substantiva (2-3 parágrafos)
 * com fatos verificáveis do modelo: histórico, geração, mercado de usados, ponto
 * forte/fraco. Evita que páginas templated com mesmos blocos sejam classificadas
 * como "Rastreada, mas não indexada" pelo Google.
 *
 * Chave é o slug completo da rota (`brand-model`).
 *
 * Lista priorizada das 35 páginas marcadas pelo GSC como "rastreada, não
 * indexada" em 26/jun/2026 (relatorios/26-06-2026/...Coverage-Drilldown.../Tabela.csv).
 */

export interface ModelSeoData {
  intro: string
  /** Outros slugs (brand-model) da mesma marca pra interlinking contextual. */
  related?: string[]
}

export const modelSeoData: Record<string, ModelSeoData> = {
  'volkswagen-golf': {
    intro: `O Volkswagen Golf é um dos hatches mais consolidados do mundo. No Brasil foi produzido em três grandes ciclos, com a versão GTI e a R-Line ainda figurando entre as mais buscadas no mercado de usados premium. Apesar da Volkswagen não vender mais o Golf zero no Brasil desde 2021, o estoque de seminovos segue ativo, principalmente nas gerações 6 e 7 a partir do ano 2013.

Na Tabela FIPE, o Golf sofre depreciação acentuada nos primeiros anos por ser um modelo importado e premium, mas estabiliza após o 7º ano. Versões a diesel (TDI) tendem a valer ligeiramente mais que as TSI equivalentes na revenda. A faixa FIPE costuma ir de R$ 45.000 (geração 6 básica) a R$ 180.000 (GTI/R 2023+).`,
    related: ['volkswagen-jetta', 'volkswagen-polo', 'volkswagen-gol'],
  },

  'honda-motos': {
    intro: `A Honda é a maior fabricante de motos do Brasil e domina o mercado de usados com folga. Modelos como CG, Biz, Bros, PCX, CB Twister e XRE 300 representam a maior parte das transações de seminovos. Cada linha tem dinâmica de depreciação própria: as urbanas (CG, Biz) seguem curvas estáveis, enquanto as esportivas (CB 500, CB 650) depreciam mais rápido nos primeiros anos.

A Tabela FIPE Honda Motos é atualizada mensalmente como a dos carros, mas com volatilidade maior por causa de mudanças de linha e descontinuações frequentes. Para consultar uma moto Honda pela placa, o resultado retorna o valor FIPE específico para aquela versão exata, evitando confusão entre PCX 150 e 160, ou entre CG Fan e CG Titan.`,
    related: ['honda-civic', 'honda-city', 'honda-cr-v'],
  },

  'audi-q7': {
    intro: `O Audi Q7 é o SUV de sete lugares topo da Audi e o que mais perdeu valor proporcionalmente entre os SUVs premium nos últimos cinco anos no Brasil. O motivo é triplo: alta carga de manutenção, peças importadas com câmbio caro, e concorrência crescente de SUVs híbridos premium como o BMW X5 híbrido e o Volvo XC90 T8.

Na FIPE, um Q7 com cinco anos de uso já perdeu próximo de 50% do valor de zero quilômetro, mas a curva de depreciação se atenua depois. Versões a diesel (TDI) tinham mercado próprio até 2019; com a saída do diesel da linha Audi no Brasil, esses modelos viraram nicho. Consultar pela placa retorna o valor FIPE exato para versão e ano, importante porque o Q7 teve quatro versões diferentes só na geração atual.`,
    related: ['audi-a5', 'audi-q3'],
  },

  'yamaha-lander': {
    intro: `A Yamaha Lander XTZ 250 é uma das motos trail mais respeitadas do Brasil. Produzida em diferentes versões entre 2007 e 2018 (Lander, Lander BlueFlex), continua presente em volumes relevantes no mercado de usados, especialmente nas regiões Norte e Nordeste onde o uso em estradas mistas valoriza o conjunto.

Na FIPE, a Lander tem depreciação lenta comparada a motos urbanas equivalentes — efeito do nicho off-road brasileiro que mantém demanda firme. Modelos pós-2014 com partida elétrica e injeção valem entre 25% e 40% mais que os antigos a carburador. Consultar pela placa é especialmente útil para a Lander porque a Yamaha repetiu nomenclatura entre anos modelo diferentes.`,
    related: ['yamaha-mt-07', 'yamaha-xtz-150'],
  },

  'ford-f-250': {
    intro: `A Ford F-250 é uma picape pesada vendida no Brasil entre 1999 e 2011. Mesmo descontinuada há mais de uma década, mantém um mercado de usados ativo entre fazendeiros, transportadores e colecionadores das versões XL e XLT. Versões a diesel (motor MWM Sprint 4.2) seguem sendo as mais valorizadas.

A FIPE da F-250 estabilizou desde 2018 — efeito típico de modelos descontinuados que viram referência. Versões com cabine dupla e tração 4x4 chegam a custar até R$ 90.000 hoje na FIPE, dependendo da conservação. A consulta pela placa é importante para diferenciar entre os anos modelo, já que a Ford alterou pequenos detalhes (caçamba, painel, suspensão) ao longo da produção.`,
    related: [],
  },

  'renault-sandero': {
    intro: `O Renault Sandero foi um dos hatches de entrada mais populares do Brasil entre 2008 e 2022. Produzido em duas gerações pela Renault Curitiba, o Sandero teve foco em custo-benefício e disputou diretamente com Hyundai HB20, Fiat Argo e Chevrolet Onix.

Apesar de descontinuado em 2022, o Sandero segue muito presente em frotas e revendas. Na FIPE, a versão GT Line e a Stepway (mais alta) valem entre 15% e 25% a mais que a versão Expression equivalente. Consultar pela placa retorna o valor exato e ajuda muito na hora de comprar usado porque a Renault usou o mesmo motor 1.0 SCe em várias configurações diferentes ao longo dos anos.`,
    related: ['renault-logan'],
  },

  'chevrolet-equinox': {
    intro: `O Chevrolet Equinox foi vendido no Brasil entre 2017 e 2021 como SUV médio importado do México. Foi descontinuado quando a Chevrolet decidiu não trazer a geração atual ao mercado brasileiro, o que tornou os usados disponíveis um bem relativamente raro: estoque limitado, demanda firme entre quem buscava SUV intermediário com motor 2.0 turbo.

A FIPE do Equinox manteve curva estável depois da descontinuação. Versões Premier (top de linha) com teto solar, bancos em couro e sistema MyLink valem cerca de 20% a mais que a versão LT base. Por ser importado, a consulta pela placa é especialmente recomendada para verificar histórico de quilometragem e procedência antes da compra.`,
    related: ['chevrolet-tracker', 'chevrolet-trailblazer'],
  },

  'yamaha-mt-07': {
    intro: `A Yamaha MT-07 é uma naked média de 689cc bicilíndrica que se tornou referência na categoria desde 2014. No Brasil é importada e fica em uma faixa de preço acessível para o segmento esportivo médio, o que mantém demanda alta no mercado de usados. As gerações 2018+ com painel digital e ABS são as mais procuradas.

Na FIPE, a MT-07 deprecia mais devagar que motos esportivas equivalentes pelo perfil naked-roadster que não cansa com o tempo. Modelos com poucos quilômetros podem custar próximo do zero quilômetro recente. Importante consultar pela placa antes de comprar uma MT-07 usada para verificar versão exata (alguns anos tiveram apenas mudanças cosméticas que afetam pouco o preço FIPE).`,
    related: ['yamaha-lander', 'yamaha-xtz-150'],
  },

  'audi-a5': {
    intro: `O Audi A5 é um coupé/sedan premium de 4 portas (Sportback) baseado na plataforma do A4. No Brasil foi vendido nas configurações 2.0 TFSI Quattro e S5, com importação direto da Alemanha. Foi descontinuado em 2022.

Na FIPE, o A5 tem comportamento típico de premium importado: queda forte nos primeiros 3 anos (50% do valor de zero), depois estabiliza. A versão Sportback é mais procurada que o cupê 2 portas por questão de praticidade. Para consulta de placa, é particularmente útil distinguir entre as gerações (B8 até 2017, B9 a partir de 2017) já que o nome comercial não mudou.`,
    related: ['audi-q3', 'audi-q7'],
  },

  'honda-motos-pop-110': {
    intro: `A Honda POP 110 é uma das motocicletas urbanas mais vendidas do Brasil. Sucedeu a POP 100 em 2016 e ainda hoje é referência em entrega, locomoção urbana e mototáxi. Tem dinâmica de mercado próprio: depreciação muito controlada por ser objeto de trabalho, com peças baratas e revenda fácil.

A FIPE da POP 110 é atualizada mensalmente e oscila pouco. Versões a partir de 2019 com painel digital e freio CBS valem ligeiramente mais que as anteriores. Para entregadores que compram usada, consultar pela placa garante saber o valor exato e checar restrições financeiras (comum em motos de trabalho).`,
    related: ['honda-motos', 'honda-motos-nxr-160-bros', 'honda-motos-pcx'],
  },

  'byd-shark': {
    intro: `A BYD Shark é uma das primeiras picapes híbridas plug-in (PHEV) do Brasil, lançada em 2024 com sistema DM-i da BYD. Posicionada como concorrente direta de Toyota Hilux e Ford Ranger nas versões premium, traz autonomia elétrica + híbrida combinada para uso urbano sem abrir mão da capacidade de carga típica de uma picape média.

Por ser modelo recém-lançado, a FIPE da Shark ainda está em formação. Primeira tabela apareceu apenas em 2024 e por enquanto os preços oscilam menos. Modelos com menos de 12 meses tipicamente perdem 10% a 15% do valor zero. Consultar pela placa é especialmente importante porque a BYD lançou variantes muito próximas (GS, GL, Premium) que diferem em detalhes pequenos mas impactam a FIPE.`,
    related: ['byd-song-plus', 'byd-song-pro'],
  },

  'bmw-x1': {
    intro: `O BMW X1 é o SUV de entrada da BMW e o mais vendido da marca no Brasil. Está em sua terceira geração (U11), produzida na Alemanha e importada. As gerações anteriores (F48 de 2016 a 2022 e E84 de 2010 a 2015) ainda têm presença forte no mercado de usados.

Na FIPE, o X1 deprecia em ritmo similar ao do Mercedes GLA e ligeiramente menor que o Audi Q3. Versões com pacote M Sport e bancos em couro valem entre 15% e 25% mais que a versão básica equivalente. Para comprar X1 usado, a consulta pela placa identifica versão exata (sDrive20i, xDrive25i, etc.) que muitas vezes não aparece clara no anúncio.`,
    related: [],
  },

  'volkswagen-amarok': {
    intro: `A Volkswagen Amarok é a picape média da VW, produzida na Argentina entre 2010 e 2024 e agora na nova geração baseada na Ford Ranger. Tornou-se referência em picapes premium de cabine dupla, com motor 2.0 TDI e câmbio automático ZF de oito marchas que ainda hoje é um dos mais elogiados do segmento.

A FIPE da Amarok é uma das mais estáveis entre picapes médias. Versões Highline V6 (240 cv) chegam a valer 35% mais que a versão básica equivalente. Consultar pela placa é essencial para a Amarok porque a VW fez três facelift discretos durante a produção, e versões intermediárias (Comfortline vs Highline) podem ser facilmente confundidas.`,
    related: ['volkswagen-gol', 'volkswagen-golf', 'volkswagen-jetta'],
  },

  'chevrolet-trailblazer': {
    intro: `A Chevrolet Trailblazer é um SUV grande de 7 lugares produzido na Tailândia e importado para o Brasil. Vendida entre 2012 e 2023, foi descontinuada quando a Chevrolet redefiniu o portfólio. Concorria com Toyota SW4, Mitsubishi Pajero Sport e Ford Everest.

Versões a diesel (2.8 turbodiesel Duramax) são as mais valorizadas no mercado de usados e mantêm a FIPE com depreciação muito controlada após o 5º ano. Versão Premier (top de linha) com tração 4x4 e bancos em couro vale entre 30% e 40% mais que a versão LT 4x2. Para consulta de placa, a Trailblazer é caso clássico onde o ano modelo e a versão impactam fortemente o valor FIPE.`,
    related: ['chevrolet-equinox', 'chevrolet-tracker'],
  },

  'honda-civic': {
    intro: `O Honda Civic é um dos sedãs médios mais consolidados do Brasil. Produzido localmente até 2020 (geração 10) e atualmente importado do Japão (geração 11, híbrida). A 10ª geração (2017-2021) ainda é a mais comum no mercado de usados, com versões EXL e Touring sendo as mais procuradas.

Na FIPE, o Civic deprecia em curva estável e tem uma das menores taxas de perda anual entre sedãs médios — entre 7% e 10% ao ano após o 3º ano. Versões Touring (turbo 1.5) valem entre 15% e 20% mais que EXL equivalente. Para comprar Civic usado, consultar pela placa garante saber a versão exata (LX, EX, EXL, Touring, Sport) que mudam motor, transmissão e equipamento.`,
    related: ['honda-city', 'honda-cr-v'],
  },

  'honda-motos-nxr-160-bros': {
    intro: `A Honda NXR 160 Bros é a sucessora da NXR 150, lançada em 2015. Manteve a vocação dual-purpose (trail urbano) que tornou a Bros uma das motos preferidas para uso misto no Brasil — entrega, cidade e estradas de terra. Sua dinâmica de mercado é única: alta demanda em todas as regiões e baixa oferta proporcional.

A FIPE da NXR 160 Bros mantém depreciação muito controlada. Versões ESDD (com partida elétrica, freio a disco dianteiro e injeção) valem entre 15% e 20% mais que a versão ES básica. Para consulta de placa, é importante para diferenciar entre os anos modelo, que tiveram pequenas atualizações de bicos, painel e revestimentos.`,
    related: ['honda-motos', 'honda-motos-pop-110'],
  },

  'nissan-livina': {
    intro: `O Nissan Livina foi um minivan compacto vendido no Brasil entre 2009 e 2014. Importado da China, ofereceu sete lugares em um pacote acessível na época, atributo raro no mercado brasileiro. Foi descontinuado quando a Nissan focou em SUVs.

Na FIPE, a Livina chegou ao patamar de estabilidade típico de modelos descontinuados após o 4º ano. Versão SL (top de linha) com sete lugares e câmbio CVT vale entre 20% e 25% mais que S equivalente. Para consultar pela placa, vale conferir se é Grand Livina (3 fileiras) ou Livina hatch (5 lugares) — nomes parecidos mas mercados diferentes.`,
    related: ['nissan-sentra'],
  },

  'volkswagen-gol': {
    intro: `O Volkswagen Gol foi o carro mais vendido do Brasil por mais de 25 anos consecutivos. Produzido entre 1980 e 2023 em diversas gerações (G1 a G8), tornou-se ícone do mercado nacional. Foi descontinuado em 2023 quando a VW decidiu focar em SUVs e elétricos para o segmento de entrada.

Mesmo descontinuado, o Gol segue como o usado mais transacionado do país. Na FIPE, o Gol G5 e G6 (2008-2014) representam o maior volume de oferta. Versões Power, Highline e Comfortline têm preço FIPE significativamente diferente. Para a consulta de placa, é particularmente útil para identificar versão exata e ano modelo — o Gol teve restylings sutis ao longo de décadas que mudam pouco a aparência mas afetam FIPE.`,
    related: ['volkswagen-amarok', 'volkswagen-jetta', 'volkswagen-golf'],
  },

  'audi-q3': {
    intro: `O Audi Q3 é o SUV compacto premium da Audi. Vendido no Brasil desde 2012, está atualmente em sua segunda geração (F3). Concorre diretamente com BMW X1, Mercedes GLA e Volvo XC40 no segmento premium de entrada.

Na FIPE, o Q3 segue a curva típica de premium importado: queda forte nos primeiros 3 anos e estabilização depois. Versão Black com pacote estético escurecido vale 10% a 15% mais que a Prestige equivalente. Para consulta pela placa, é especialmente útil para diferenciar entre Q3 e Q3 Sportback (cupê), nomes vendidos em paralelo desde 2020 com preços FIPE distintos.`,
    related: ['audi-a5', 'audi-q7'],
  },

  'honda': {
    intro: `A Honda é uma das principais montadoras com presença consolidada no Brasil. Atua nos segmentos de carros (Civic, City, HR-V, CR-V, WR-V) e motos (CG, Biz, PCX, NXR, CB). É reconhecida por engenharia japonesa confiável, baixa depreciação e rede ampla de assistência.

A FIPE Honda costuma ter depreciação inferior à média do mercado brasileiro. Modelos como Civic e CR-V chegam a perder apenas 8% ao ano após o 3º ano. Esta página agrupa todos os modelos Honda disponíveis na Tabela FIPE — selecione o modelo específico abaixo ou consulte pela placa para o valor exato.`,
    related: ['honda-civic', 'honda-city', 'honda-cr-v', 'honda-motos'],
  },

  'honda-cr-v': {
    intro: `O Honda CR-V foi um dos SUVs médios mais respeitados do Brasil até a descontinuação em 2020. Vendido entre 2007 e 2020 em três gerações, o CR-V foi referência em confiabilidade e baixa depreciação no segmento.

Na FIPE, o CR-V depreciava em ritmo muito controlado. Versões EXL com tração 4WD valem entre 20% e 25% mais que LX 2WD equivalente. Para comprar CR-V usado, consultar pela placa é especialmente importante para confirmar configuração (FWD vs AWD) e versão (LX, EX, EXL) — informações que muitas vezes não aparecem claras no anúncio.`,
    related: ['honda-civic', 'honda-city'],
  },

  'chevrolet-tracker': {
    intro: `O Chevrolet Tracker é o SUV compacto da Chevrolet. A geração atual (segunda) é produzida no Brasil desde 2020 e substituiu a primeira (2013-2019), aquela importada do México. Disputa diretamente com Hyundai Creta, Volkswagen T-Cross e Renault Captur.

Na FIPE, o Tracker tem comportamento típico de SUV nacional: queda moderada nos primeiros 2-3 anos e estabilização depois. Versão Premier (top de linha) vale entre 20% e 25% mais que LT equivalente. Versões com motor 1.0 turbo e 1.2 turbo têm preços FIPE distintos. Consultar pela placa retorna a versão e ano modelo exatos, essencial pra evitar pagar pelo carro errado.`,
    related: ['chevrolet-equinox', 'chevrolet-trailblazer'],
  },

  'honda-city': {
    intro: `O Honda City é um sedan compacto presente no Brasil desde 2009. Atualmente em sua geração 5 (lançada em 2022), disputa com Toyota Yaris Sedan, Chevrolet Onix Plus e Hyundai HB20S no segmento de sedans compactos.

A FIPE City tem depreciação muito estável. Versão Touring (top com motor 1.5 turbo) vale entre 15% e 20% mais que Sport equivalente. A geração atual com motor turbo está consolidando posicionamento premium dentro do segmento. Para consultar pela placa, vale lembrar que o nome City foi reaproveitado entre gerações com formatos diferentes (hatch e sedan) — placa identifica precisamente.`,
    related: ['honda-civic', 'honda-cr-v'],
  },

  'volkswagen-jetta': {
    intro: `O Volkswagen Jetta é o sedan médio da Volkswagen vendido no Brasil há mais de 30 anos. Importado do México atualmente, está em sua sétima geração desde 2019. Disputa com Toyota Corolla, Honda Civic e Chevrolet Cruze.

Na FIPE, o Jetta tem depreciação típica de importado: queda forte nos primeiros 2 anos e estabilização. Versão GLI (esportiva turbo) vale entre 25% e 35% mais que a Comfortline equivalente. Para comprar Jetta usado, consultar pela placa é essencial para distinguir entre versões com motor 1.4 TSI e 2.0 TSI, e entre câmbio manual e automático DSG.`,
    related: ['volkswagen-gol', 'volkswagen-amarok', 'volkswagen-golf'],
  },

  'byd-song-plus': {
    intro: `O BYD Song Plus é um SUV híbrido plug-in (PHEV) lançado no Brasil em 2023. Equipado com sistema DM-i da BYD, oferece autonomia elétrica relevante para uso urbano combinada com motor a combustão para viagens. Posicionado como concorrente premium acessível do Toyota RAV4 Hybrid e Jeep Compass híbrido.

Por ser modelo recente e elétrico, a FIPE do Song Plus ainda está em formação. Os preços do segmento elétrico costumam oscilar bastante na FIPE por conta de mudanças de tarifa do imposto de importação e estratégia agressiva de preço da BYD. Consultar pela placa garante o valor mais atualizado e ajuda a distinguir entre versões GS e GL.`,
    related: ['byd-shark', 'byd-song-pro'],
  },

  'citroen-c4-lounge': {
    intro: `O Citroën C4 Lounge foi um sedan médio da Citroën vendido no Brasil entre 2013 e 2018. Produzido na Argentina, posicionou-se como alternativa premium acessível dentro do segmento médio. Foi descontinuado quando a Citroën reorganizou sua linha brasileira.

Na FIPE, o C4 Lounge tem depreciação acelerada típica de modelos descontinuados com baixa oferta de peças. Versão Exclusive THP (motor turbo) vale entre 25% e 30% mais que a Origine 1.6 equivalente. Para comprar usado, vale consultar pela placa para confirmar versão e principalmente histórico de manutenção — ponto fraco conhecido de Citroëns do período.`,
    related: [],
  },

  'fiat-500': {
    intro: `O Fiat 500 é um citadino italiano vendido no Brasil em quantidades limitadas entre 2009 e 2018. Posicionou-se como urbano premium estiloso, com versões Cult, Lounge, Sport e a icônica 500 Abarth (esportiva). Foi descontinuado quando a Fiat focou em modelos populares.

Na FIPE, o 500 tem comportamento atípico: oscila pouco por ser nicho colecionável. Modelos Abarth bem conservados podem valer hoje próximo do valor zero quilômetro original — fenômeno raro no mercado brasileiro. Versões Cult e Lounge têm comportamento mais convencional de depreciação. Consulta pela placa é importante para confirmar se é uma versão regular ou Abarth, que diferem 50%+ no preço FIPE.`,
    related: ['fiat-toro'],
  },

  'peugeot-2008': {
    intro: `O Peugeot 2008 é o SUV compacto da Peugeot. Está em sua segunda geração no Brasil desde 2020. Concorre com Hyundai Creta, Volkswagen T-Cross e Chevrolet Tracker. Reposicionou a Peugeot no segmento SUV após anos de baixa relevância no Brasil.

Na FIPE, o 2008 tem depreciação acima da média do segmento, efeito típico de marcas francesas no Brasil. Versão GT Pack vale entre 20% e 25% mais que a Allure equivalente. Para comprar 2008 usado, consultar pela placa é importante para diferenciar entre 2008 (geração atual) e 2008 antigo (2015-2019 com plataforma anterior) — nome igual, carro completamente diferente.`,
    related: [],
  },

  'yamaha-xtz-150': {
    intro: `A Yamaha XTZ 150 Crosser é uma das motos trail mais vendidas do Brasil. Substituta da XTZ 125 desde 2014, é referência em uso misto urbano-estradas de terra, especialmente em médias e pequenas cidades. Tem mercado de usados extremamente ativo.

A FIPE da XTZ 150 mantém depreciação muito controlada, próxima à da XRE 300 da Honda. Versão Sed (com partida elétrica e injeção) vale entre 10% e 15% mais que a versão básica equivalente. Para consultar pela placa, vale verificar se é Crosser (mais comum) ou versão de exportação — a Yamaha exportou variantes que retornaram ao Brasil como seminovos.`,
    related: ['yamaha-lander', 'yamaha-mt-07'],
  },

  'toyota-prius': {
    intro: `O Toyota Prius foi o híbrido pioneiro no Brasil. Importado entre 2013 e 2019, tornou-se a primeira opção popular para quem queria um híbrido japonês confiável, ainda que com preço elevado pela carga tributária dos importados na época.

Na FIPE, o Prius depreciou em ritmo muito controlado por causa da escassez de oferta. Versões com pacote completo (couro, GPS, sensores) chegam a manter 65% do valor original após 5 anos — taxa de retenção excelente para o mercado brasileiro. Para comprar usado, consultar pela placa é fundamental para verificar saúde da bateria híbrida, que tem garantia limitada e custo de troca alto.`,
    related: [],
  },

  'byd-song-pro': {
    intro: `O BYD Song Pro é um SUV elétrico puro (BEV) da BYD vendido no Brasil desde 2023. Diferente do Song Plus (híbrido plug-in), o Pro é 100% elétrico com bateria de aproximadamente 71 kWh e autonomia declarada acima de 500 km. Concorre direto com Tesla Model Y e Volkswagen ID.4.

Por ser elétrico puro recente, a FIPE do Song Pro está em formação e sofre influência das oscilações tarifárias de modelos elétricos. Versões com pacote tecnológico avançado e teto solar valem 15% a 20% mais que a versão base. Consultar pela placa é particularmente importante porque a BYD lançou três configurações próximas que se diferenciam em detalhes que impactam a FIPE.`,
    related: ['byd-shark', 'byd-song-plus'],
  },

  'renault-logan': {
    intro: `O Renault Logan é um sedan compacto produzido na Argentina e vendido no Brasil entre 2007 e 2022. Posicionou-se como alternativa econômica no segmento de sedans de entrada, disputando com Chevrolet Prisma e Volkswagen Voyage.

Na FIPE, o Logan tem depreciação alinhada à média de sedans de entrada brasileiros. A última geração (2014-2022) com motor 1.6 SCe é a mais comum no mercado de usados. Versão Privilege (top de linha) vale entre 10% e 15% mais que a Expression equivalente. Para consulta pela placa, vale lembrar que o Logan teve um restyling discreto em 2017 que mudou frente e luzes.`,
    related: ['renault-sandero'],
  },

  'nissan-sentra': {
    intro: `O Nissan Sentra é um sedan médio importado do México vendido no Brasil em diversas gerações. A última (2014-2020) foi a mais relevante no mercado nacional, posicionando-se entre Honda Civic e Toyota Corolla. Foi descontinuado em 2020 quando a Nissan reorganizou a linha.

Na FIPE, o Sentra depreciou em ritmo acelerado nos primeiros anos pós-descontinuação. Versão SL (top com bancos em couro e pacote tecnológico) vale entre 15% e 20% mais que a Advance equivalente. Para comprar usado, consultar pela placa é importante para identificar geração e versão, e principalmente para verificar histórico de transmissão CVT — ponto de atenção em modelos Nissan da época.`,
    related: ['nissan-livina'],
  },

  'fiat-toro': {
    intro: `A Fiat Toro é a picape média compacta da Fiat. Lançada em 2016 e produzida em Pernambuco, foi pioneira no segmento entre Strada e picapes médias tradicionais. Concorre com Renault Oroch, Volkswagen Saveiro e Chevrolet Montana.

Na FIPE, a Toro tem depreciação típica de picape brasileira: moderada nos primeiros 3 anos e estável depois. Versões Ranch e Volcano (4x4 diesel) valem entre 30% e 40% mais que Endurance 4x2 flex equivalente. Para comprar Toro usada, consulta pela placa é especialmente útil para confirmar versão exata — a Fiat teve seis versões em paralelo durante alguns anos.`,
    related: ['fiat-500'],
  },

  'hyundai-santa-fe': {
    intro: `O Hyundai Santa Fe é o SUV grande de sete lugares da Hyundai. Importado da Coreia, foi vendido no Brasil em três gerações até 2020. Posicionou-se como SUV premium acessível, com configurações que iam de motor 2.4 flex até 3.5 V6.

Na FIPE, o Santa Fe depreciou em ritmo acima da média de SUVs equivalentes — efeito de custo de manutenção alto e peças importadas. A versão 3.3 V6 com sete lugares e tração 4WD vale entre 25% e 30% mais que a 2.4 base equivalente. Consultar pela placa é importante para confirmar configuração de tração (4x2 vs 4WD) e número de lugares (5 ou 7), que impactam fortemente FIPE.`,
    related: [],
  },
}

export function getModelSeoIntro(slug: string): ModelSeoData | null {
  return modelSeoData[slug] || null
}

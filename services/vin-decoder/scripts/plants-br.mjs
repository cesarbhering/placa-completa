#!/usr/bin/env node
// Curadoria de plantas de fabricacao: (WMI + posicao 11 do VIN) e, quando a
// posicao 11 nao separa a fabrica, regra por MODELO do registro.
// Roda depois de import-vpic.mjs / overrides-br.mjs. Idempotente.
//
// REGRA (do Cesar): mostrar planta ERRADA e pior que nao mostrar. Nenhuma
// cidade entra aqui por parecer certa. Quando a fabrica e ambigua, a linha nao
// existe (ou existe com confianca 'ambigua', que so serve pra bloquear o
// curinga '*'): o relatorio mostra montadora e pais, sem cidade.
//
// Filtros de cada linha brasileira:
//   1. fonte publica (montadora, imprensa especializada, IBGE/SUFRAMA) dizendo
//      que a montadora produz aquele modelo naquela cidade;
//   2. a base de leiloes (984 mil chassis unicos de 17 caracteres,
//      leiloes-poc-db, set/2026) concordando: os modelos que aparecem naquele
//      (WMI, posicao 11) sao compativeis com a planta, com menos de 2% de
//      contradicao e no minimo 30 veiculos de amostra.
// Linha estrangeira: PlantCity do vPIC/NHTSA igual em todas as amostras
// consultadas (3 chassis reais da base por codigo), ou planta unica da marca
// no pais (Argentina). O vPIC ERRA chassi brasileiro, entao nunca e usado pra
// WMI 9xx.
//
// Relatorio da validacao: docs/validacao-plantas.md.
//
// position_11 = '*' significa que o WMI inteiro e de uma fabrica so.
import { db } from '../src/db.js'

const IBGE = 'IBGE, Cadastro Central de Empresas, e comunicacao oficial da montadora'
const SUFRAMA = 'SUFRAMA, cadastro de empresas do Polo Industrial de Manaus, e site oficial da marca'
const IMPRENSA = 'Imprensa especializada (AutoData, Automotive Business) e site da montadora, cruzado com a base de leiloes'
// Argentina: cada montadora tem UMA fabrica de automovel no pais, entao a
// cidade vale pra qualquer posicao 11. O vPIC nao tem PlantCity pra VIN
// argentino; a confirmacao e a planta unica da marca + a base de leiloes
// (8AJ so Hilux/SW4 = Zarate; 8AG so Corsa/Classic/Agile = Alvear).
const AR = 'Planta unica da montadora na Argentina (site oficial da marca) + cross-check da base de leiloes'
const VPIC = 'vPIC/NHTSA DecodeVin (PlantCity do VIN, 3 chassis reais da base concordando)'
// v6 (importados): tabela de codigos de planta por montadora (Wikibooks "Vehicle
// Identification Numbers (VIN codes)", pagina de cada marca) + vPIC/NHTSA com
// 3 chassis reais da base concordando com a mesma cidade. So entra o que as
// duas fontes dizem igual; BMW/Mini (sem pagina de codigos) so com vPIC 3/3.
const DOC_VPIC = 'Tabela de codigos de planta da montadora (Wikibooks VIN codes) + vPIC/NHTSA, 3 chassis reais da base concordando'
// WAU pos11 R: vPIC nao tem PlantCity pra Audi de mercado europeu. Tabela de
// codigos diz Martorell, e os 38 chassis da base com WAU..R sao TODOS Q3 8U
// (2013-2018), modelo feito so na SEAT Martorell nessa geracao.
const DOC_MODELO = 'Tabela de codigos de planta da montadora (Wikibooks VIN codes) + 100% dos chassis da base sao de um modelo feito so nessa fabrica'

// Versao do arquivo curado. O servico compara com o que esta gravado no banco
// e reimporta sozinho quando sobe (ver server.js). Subir esta versao SEMPRE que
// mexer na lista, senao a mudanca nao chega no container ja rodando.
export const PLANTS_VERSAO = 6

// Atalhos pra nao repetir o pais em cada linha.
const br = (wmi, pos, cidade, uf, de = null, ate = null, fonte = IBGE, conf = 'alta') =>
  [wmi, pos, `${cidade} (${uf})`, cidade, uf, 'Brasil', de, ate, fonte, conf]
const ext = (wmi, pos, cidade, pais, fonte = VPIC, conf = 'alta') =>
  [wmi, pos, `${cidade}, ${pais}`, cidade, null, pais, null, null, fonte, conf]
const unica = (wmi, cidade, uf, fonte = IBGE) => br(wmi, '*', cidade, uf, null, null, fonte, 'marca_unica_fabrica')
// Codigo que NAO e da fabrica unica do WMI: bloqueia o curinga '*' e deixa a
// regra por modelo decidir (ou fica sem cidade).
const bloqueia = (wmi, pos, motivo) => [wmi, pos, motivo, null, null, null, null, null, 'bloqueio', 'ambigua']

const PLANTS = [
  // [wmi, pos11, nome, cidade, uf, pais, ano_de, ano_ate, fonte, confianca]
  // confianca 'alta'                = codigo validado contra a base de leiloes
  // confianca 'marca_unica_fabrica' = a marca so tem uma fabrica no pais
  // confianca 'ambigua'             = nao publica; so bloqueia o '*'

  // ---------------- Volkswagen ----------------
  // Taubate faz a familia Gol; Anchieta (SBC) faz Santana, Kombi e o Gol
  // antigo; Sao Jose dos Pinhais faz Fox, Golf e T-Cross.
  br('9BW', 'T', 'Taubaté', 'SP'),
  br('9BW', 'P', 'São Bernardo do Campo', 'SP'),
  br('9BW', '4', 'São José dos Pinhais', 'PR'),
  // Autolatina: Logus, Pointer e Apollo (1990-1997), montados na fabrica da
  // Ford em Sao Bernardo; Royale/Versailles na da VW, tambem em SBC. A cidade
  // e a mesma nos dois casos. 3.294 chassis, nenhum modelo de outra cidade.
  br('9BW', 'B', 'São Bernardo do Campo', 'SP', null, 1997),
  // Caminhoes e onibus VW: Resende desde nov/1996 (antes, Ipiranga/SP).
  // 397 chassis, so Delivery, Constellation, Worker e chassis de onibus.
  br('9BW', 'R', 'Resende', 'RJ', 1996, null, IMPRENSA),
  unica('953', 'Resende', 'RJ', IMPRENSA), // MAN / VW Caminhoes e Onibus

  // ---------------- Fiat / Stellantis ----------------
  // 9BD inteiro e Betim; Goiana tem WMI proprio (988: Jeep, Toro, Rampage).
  br('9BD', '*', 'Betim', 'MG'),
  br('988', 'K', 'Goiana', 'PE'),
  // Ducato (93W) e as vans Boxer (936) e Jumper (935) sairam da Iveco em Sete
  // Lagoas de nov/2000 a dez/2016. Nos WMIs 935/936 elas usam os codigos 1 e
  // 2 (201 e 301 chassis, 100% vans); o resto do WMI e Porto Real.
  unica('93W', 'Sete Lagoas', 'MG', IMPRENSA),
  br('935', '1', 'Sete Lagoas', 'MG', null, 2017, IMPRENSA),
  br('935', '2', 'Sete Lagoas', 'MG', null, 2017, IMPRENSA),
  br('936', '1', 'Sete Lagoas', 'MG', null, 2017, IMPRENSA),
  br('936', '2', 'Sete Lagoas', 'MG', null, 2017, IMPRENSA),
  br('935', 'B', 'Porto Real', 'RJ'),
  br('936', 'B', 'Porto Real', 'RJ'),
  unica('935', 'Porto Real', 'RJ'),
  unica('936', 'Porto Real', 'RJ'),

  // ---------------- GM ----------------
  // B = Sao Caetano do Sul, C = Sao Jose dos Campos. Revisto em set/2026: a
  // v2 recusou os dois codigos porque Corsa, Kadett e Classic aparecem nos
  // dois. Esses sao justamente os modelos que foram feitos nas duas fabricas
  // (Kadett/Ipanema sairam de SJC pra SCS em 1994; Classic em paralelo ate
  // 2013; Corsa B em SCS). Separando por modelo de fabrica unica, a base fecha:
  //   B (35.425): Monza, Opala, Omega, Vectra, Astra, Cobalt, Spin, Tracker,
  //     Cruze, Montana II. Contradicao 0,6% (Montana I 2007-2009).
  //   C (37.622): Chevette, S10, Blazer, Trailblazer, Meriva, Zafira,
  //     Montana I, D20. Contradicao 0,01%.
  br('9BG', 'B', 'São Caetano do Sul', 'SP', null, null, IMPRENSA),
  br('9BG', 'C', 'São José dos Campos', 'SP', null, null, IMPRENSA),
  // Gravatai: Celta, Prisma e Onix e nada mais.
  br('9BG', 'G', 'Gravataí', 'RS'),

  // ---------------- Ford ----------------
  // Camacari (2001-2021): Fiesta Rocam, EcoSport, Ka de 2014 em diante.
  br('9BF', '8', 'Camaçari', 'BA', 2001),
  // B = Sao Bernardo ate o fechamento (2019). Revisto em set/2026: a v2 cortava
  // em 2001 achando que o Ka pos-2001 era de Camacari. A base mostra o
  // contrario: Ka 1997-2013, Courier ate 2013, Fiesta 1996-2006, New Fiesta
  // 2014-2019 e Cargo so no B; Ka 2014+ e EcoSport so no 8. 21.734 chassis com
  // modelo, 1 contradicao.
  br('9BF', 'B', 'São Bernardo do Campo', 'SP', null, 2019),
  // Codigos antigos (Escort, Del Rey, Pampa, Versailles): SBC ate 2001.
  br('9BF', 'D', 'São Bernardo do Campo', 'SP', null, 2001),
  br('9BF', 'E', 'São Bernardo do Campo', 'SP', null, 2001),
  br('9BF', 'F', 'São Bernardo do Campo', 'SP', null, 2001),
  br('9BF', 'G', 'São Bernardo do Campo', 'SP', null, 2001),
  br('9BF', 'H', 'São Bernardo do Campo', 'SP', null, 2001),
  br('9BF', 'P', 'São Bernardo do Campo', 'SP', null, 2001),

  // ---------------- Toyota ----------------
  // 9BR: a posicao 11 NAO separa a fabrica (o codigo 8 tem Corolla e Yaris;
  // 0/2/4/5 misturam Corolla e Etios). A cidade sai pela regra de MODELO (ver
  // MODELOS). Excecao: o codigo 1 e so Bandeirante (47 chassis), SBC ate 2001.
  br('9BR', '1', 'São Bernardo do Campo', 'SP', null, 2001, IMPRENSA),

  // ---------------- Honda carros ----------------
  br('93H', 'Z', 'Sumaré', 'SP'),
  br('93H', 'K', 'Itirapina', 'SP', 2019),

  // ---------------- Renault / Nissan ----------------
  br('93Y', 'J', 'São José dos Pinhais', 'PR'),
  unica('93Y', 'São José dos Pinhais', 'PR'),
  br('94D', 'J', 'São José dos Pinhais', 'PR'),
  br('94D', 'B', 'Resende', 'RJ', 2014),

  // ---------------- Hyundai / CAOA / Chery ----------------
  // Hyundai tem duas fabricas (Piracicaba e a CAOA em Anapolis), por isso
  // 9BH so no codigo P. A CAOA tem WMI proprio (95P): Tucson, ix35, HR, HD e
  // os CAOA Chery Tiggo 5x/7/8, todos de Anapolis. A Chery de Jacarei (98R:
  // QQ, Celer, Tiggo 2/3X, Arrizo) fechou em 2021/22.
  br('9BH', 'P', 'Piracicaba', 'SP'),
  unica('95P', 'Anápolis', 'GO', IMPRENSA),
  unica('98R', 'Jacareí', 'SP', IMPRENSA),

  // ---------------- Mitsubishi / Mercedes / BMW / Audi / Land Rover / BYD ----------------
  br('93X', 'C', 'Catalão', 'GO'),
  unica('93X', 'Catalão', 'GO'),
  // Mercedes: Classe A em Juiz de Fora (A, 1999-2005); caminhao e onibus em
  // SBC (B); Actros/Accelo em Juiz de Fora de 2012 a 2020 (S, 44 chassis, so
  // Actros e Accelo). Carro de 2016-2020 (Classe C, GLA) e de Iracemapolis,
  // pela regra de modelo.
  br('9BM', 'A', 'Juiz de Fora', 'MG'),
  br('9BM', 'B', 'São Bernardo do Campo', 'SP'),
  br('9BM', 'S', 'Juiz de Fora', 'MG', 2012, 2020, IMPRENSA),
  unica('98M', 'Araquari', 'SC', IMPRENSA),      // BMW
  unica('93U', 'São José dos Pinhais', 'PR', IMPRENSA), // Audi (A3 1999-2006)
  unica('99A', 'São José dos Pinhais', 'PR', IMPRENSA), // Audi (A3 Sedan, Q3)
  unica('99J', 'Itatiaia', 'RJ', IMPRENSA),      // Land Rover
  unica('99L', 'Camaçari', 'BA', IMPRENSA),      // BYD (desde jul/2025)

  // ---------------- Caminhoes e onibus ----------------
  br('93Z', '8', 'Sete Lagoas', 'MG'),
  unica('93Z', 'Sete Lagoas', 'MG'),             // Iveco
  br('9BV', 'E', 'Curitiba', 'PR'),
  unica('9BV', 'Curitiba', 'PR', IMPRENSA),      // Volvo
  unica('9BS', 'São Bernardo do Campo', 'SP'),   // Scania

  // ---------------- Motos (Manaus salvo indicacao) ----------------
  // Marca de fabrica UNICA no Brasil: a cidade e certa qualquer que seja o
  // codigo. Vale so pro WMI brasileiro da propria marca.
  br('9C2', 'R', 'Manaus', 'AM'),
  unica('9C2', 'Manaus', 'AM', SUFRAMA),         // Honda
  br('9C6', '0', 'Manaus', 'AM'),                // Yamaha
  unica('9CD', 'Manaus', 'AM', SUFRAMA),         // Suzuki / J.Toledo
  unica('95V', 'Manaus', 'AM', SUFRAMA),         // Dafra (e BMW/KTM/Ducati que ela montou)
  unica('94J', 'Manaus', 'AM', SUFRAMA),         // Sundown
  unica('93F', 'Manaus', 'AM', SUFRAMA),         // Kasinski
  unica('932', 'Manaus', 'AM', SUFRAMA),         // Harley-Davidson
  unica('97N', 'Manaus', 'AM', SUFRAMA),         // Triumph
  unica('96P', 'Manaus', 'AM', SUFRAMA),         // Kawasaki (fabrica propria desde 2009)
  unica('99K', 'Manaus', 'AM', SUFRAMA),         // JTZ / Haojue
  unica('951', 'Manaus', 'AM', SUFRAMA),         // Traxx

  // ---------------- Argentina ----------------
  ['8AF', '*', 'General Pacheco, Argentina', 'General Pacheco', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'], // Ford
  ['8AJ', '*', 'Zárate, Argentina', 'Zárate', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'],                   // Toyota (Hilux/SW4)
  ['8AD', '*', 'El Palomar, Argentina', 'El Palomar', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'],           // Peugeot
  ['8BC', '*', 'El Palomar, Argentina', 'El Palomar', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'],           // Citroen (C4 Pallas, Berlingo)
  ['8AW', '*', 'General Pacheco, Argentina', 'General Pacheco', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'], // Volkswagen
  ['8AG', '*', 'General Alvear (Santa Fe), Argentina', 'General Alvear', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'], // GM
  // Silverado/Veraneio argentinas (1995-1998) sao de Cordoba, de antes de Alvear.
  bloqueia('8AG', 'A', 'GM Argentina pre-Alvear (Silverado)'),
  ['8AP', '*', 'Ferreyra (Córdoba), Argentina', 'Ferreyra', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'],     // Fiat
  ['8A1', '*', 'Santa Isabel (Córdoba), Argentina', 'Santa Isabel', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'], // Renault
  ['8AC', '*', 'Virrey del Pino, Argentina', 'Virrey del Pino', null, 'Argentina', null, null, AR, 'marca_unica_fabrica'], // Mercedes (Sprinter)

  // ---------------- Fora do Mercosul (vPIC) ----------------
  // Alemanha
  ext('WAU', 'A', 'Ingolstadt', 'Alemanha'),
  ext('WAU', 'N', 'Neckarsulm', 'Alemanha'),
  ext('WVW', 'W', 'Wolfsburg', 'Alemanha'),
  ext('WVG', 'W', 'Wolfsburg', 'Alemanha'),
  ext('WVW', 'E', 'Emden', 'Alemanha'),
  ext('WVW', 'P', 'Zwickau', 'Alemanha'),        // planta Mosel
  ext('WBA', 'A', 'Munique', 'Alemanha'),
  ext('WBA', 'F', 'Munique', 'Alemanha'),
  ext('WB1', 'Z', 'Berlim', 'Alemanha'),         // BMW Motorrad
  ext('WDD', 'A', 'Sindelfingen', 'Alemanha'),
  ext('WDB', 'A', 'Sindelfingen', 'Alemanha'),
  ext('WDD', 'F', 'Bremen', 'Alemanha'),
  ext('WDB', 'F', 'Bremen', 'Alemanha'),
  ext('WDD', 'J', 'Rastatt', 'Alemanha'),
  ext('W1K', 'N', 'Kecskemét', 'Hungria'),
  ext('WP1', 'L', 'Leipzig', 'Alemanha'),        // Porsche
  // Reino Unido / Belgica
  ext('SAL', 'A', 'Solihull', 'Reino Unido'),
  ext('SAL', 'H', 'Halewood', 'Reino Unido'),
  ext('WMW', 'T', 'Oxford', 'Reino Unido'),      // Mini
  ext('YV1', '2', 'Gent', 'Bélgica'),            // Volvo
  // Mexico / EUA / Canada
  ext('3VW', 'M', 'Puebla', 'México'),
  ext('3N1', 'L', 'Aguascalientes', 'México'),
  ext('3N1', 'Y', 'Aguascalientes', 'México'),
  ext('3N1', 'K', 'Cuernavaca', 'México'),
  ext('3FA', 'M', 'Cuautitlán', 'México'),
  ext('3FA', 'R', 'Hermosillo', 'México'),
  ext('3GN', 'S', 'Ramos Arizpe', 'México'),
  ext('3G1', 'S', 'Ramos Arizpe', 'México'),
  ext('3GN', 'L', 'San Luis Potosí', 'México'),
  ext('3C3', 'T', 'Toluca', 'México'),
  ext('3C4', 'T', 'Toluca', 'México'),
  ext('3D4', 'T', 'Toluca', 'México'),
  ext('1A8', 'T', 'Toluca', 'México'),
  ext('3CZ', 'G', 'El Salto', 'México'),         // Honda
  ext('3HG', 'G', 'El Salto', 'México'),         // Honda
  ext('2HG', 'H', 'Alliston', 'Canadá'),
  ext('2FM', 'B', 'Oakville', 'Canadá'),
  ext('1C4', 'W', 'Toledo', 'Estados Unidos'),
  ext('1C3', 'D', 'Belvidere', 'Estados Unidos'),
  ext('1C3', 'N', 'Sterling Heights', 'Estados Unidos'),
  ext('1FT', 'T', 'Edison', 'Estados Unidos'),
  ext('1HG', 'A', 'Marysville', 'Estados Unidos'),
  ext('1HG', 'L', 'East Liberty', 'Estados Unidos'),
  // Asia
  ext('KMH', 'U', 'Ulsan', 'Coreia do Sul'),
  ext('KMH', 'A', 'Asan', 'Coreia do Sul'),
  ext('KNA', '5', 'Hwaseong', 'Coreia do Sul'),
  ext('KNA', '7', 'Gwangju', 'Coreia do Sul'),
  ext('KL1', 'B', 'Bupyeong (Incheon)', 'Coreia do Sul'),
  ext('JHM', 'S', 'Suzuka', 'Japão'),
  ext('JHM', 'C', 'Sayama', 'Japão'),
  ext('JH2', 'M', 'Hamamatsu', 'Japão'),         // Honda motos
  ext('JH2', 'K', 'Kumamoto', 'Japão'),          // Honda motos
  ext('JYA', 'A', 'Hamamatsu', 'Japão'),         // Yamaha motos
  ext('JM1', '0', 'Hiroshima', 'Japão'),         // Mazda
  ext('MLH', '5', 'Bangkok', 'Tailândia'),       // Honda motos
  ext('LHJ', 'B', 'Chongqing', 'China'),
  ext('LAT', '1', 'Luoyang', 'China'),
  ext('LP6', '0', 'Guangzhou', 'China'),
  ext('LF3', 'B', 'Jiangmen', 'China'),

  // ---------------- Importados v6 (tabela de codigos + vPIC 3/3) ----------------
  // Audi
  ext('WAU', 'R', 'Martorell', 'Espanha', DOC_MODELO),   // Q3 8U
  ext('TRU', '1', 'Győr', 'Hungria', DOC_VPIC),          // TT
  // Volkswagen
  ext('WVG', 'D', 'Bratislava', 'Eslováquia', DOC_VPIC),  // Touareg
  ext('WVG', 'K', 'Osnabrück', 'Alemanha', DOC_VPIC),
  ext('WV2', 'H', 'Hannover', 'Alemanha', DOC_VPIC),     // Kombi/Eurovan
  // Porsche
  ext('WP1', 'D', 'Bratislava', 'Eslováquia', DOC_VPIC), // Cayenne
  // Mercedes-Benz
  ext('WDD', 'N', 'Kecskemét', 'Hungria', DOC_VPIC),
  ext('WDD', 'R', 'East London', 'África do Sul', DOC_VPIC),
  ext('WDD', 'G', 'Bremen', 'Alemanha', DOC_VPIC),
  ext('WDD', 'W', 'Aguascalientes', 'México', DOC_VPIC),
  ext('W1N', 'W', 'Aguascalientes', 'México', DOC_VPIC), // GLB
  ext('WDC', 'J', 'Rastatt', 'Alemanha', DOC_VPIC),      // GLA
  ext('WDC', 'G', 'Bremen', 'Alemanha', DOC_VPIC),
  // BMW / Mini (sem tabela publica de codigos: vPIC 3/3)
  ext('WBA', 'P', 'Regensburg', 'Alemanha'),
  ext('WBA', 'C', 'Dingolfing', 'Alemanha'),
  ext('WBA', 'W', 'Graz', 'Áustria'),                    // X3 1a geracao (Magna Steyr)
  ext('WBS', 'E', 'Regensburg', 'Alemanha'),
  ext('WBS', 'L', 'Greer', 'Estados Unidos'),
  ext('WMW', 'W', 'Graz', 'Áustria'),                    // Countryman (Magna Steyr)
  ext('WMW', '2', 'Oxford', 'Reino Unido'),
  // Volvo
  ext('YV1', '1', 'Gotemburgo (Torslanda)', 'Suécia', DOC_VPIC),
  // Kia
  ext('KNA', '6', 'Gwangmyeong (Sohari)', 'Coreia do Sul', DOC_VPIC),
  // Honda, Mitsubishi, Toyota (Japao)
  ext('JHL', 'C', 'Sayama', 'Japão', DOC_VPIC),
  ext('JA3', 'U', 'Kurashiki (Mizushima)', 'Japão', DOC_VPIC),
  ext('JA3', 'P', 'Nagoya (Ooe)', 'Japão', DOC_VPIC),
  ext('JA3', 'Z', 'Okazaki', 'Japão', DOC_VPIC),
  ext('JTM', 'D', 'Obu', 'Japão', DOC_VPIC),
  ext('JTM', 'J', 'Toyota (Takaoka)', 'Japão', DOC_VPIC),
]

// Regras por MODELO, pra quando a posicao 11 nao separa a fabrica.
// [wmi, pos11 ('*' = qualquer), padrao, excluir, nome, cidade, uf, pais, ano_de, ano_ate, fonte, confianca]
// padrao/excluir sao regex aplicadas ao modelo do registro normalizado (ver
// normalizarModelo em src/decode.js): maiusculo, sem acento, sem "I/", so
// letras, numeros e espaco, com um espaco em cada ponta. A primeira regra
// que casa (padrao, sem excluir, ano dentro da janela) vence, entao a mais
// especifica (Corolla Cross) vem antes da geral (Corolla).
const TOYOTA = 'Toyota do Brasil (fabricas de Indaiatuba e Sorocaba) e AutoData, cruzado com a base de leiloes'
const mod = (wmi, pos, padrao, excluir, cidade, uf, de, ate, fonte) =>
  [wmi, pos, padrao, excluir, `${cidade} (${uf})`, cidade, uf, 'Brasil', de, ate, fonte, 'alta']
const MODELOS = [
  // Toyota 9BR. Corolla Cross: Sorocaba desde 2021. Corolla sedan e Fielder:
  // Indaiatuba de 1998 ate jun/2026 (a producao vai pra Sorocaba a partir de
  // nov/2026, entao ano-modelo 2027 em diante fica sem cidade ate confirmar).
  // Etios (2012-2023) e Yaris (2018-2024): Sorocaba.
  mod('9BR', '*', ' COROLLA ?CROSS | CROSS ', null, 'Sorocaba', 'SP', 2021, null, TOYOTA),
  mod('9BR', '*', ' COROLLA| FIELDER ', ' CROSS ', 'Indaiatuba', 'SP', 1998, 2026, TOYOTA),
  mod('9BR', '*', ' ETIOS ', null, 'Sorocaba', 'SP', 2012, 2024, TOYOTA),
  mod('9BR', '*', ' YARIS ', ' CROSS ', 'Sorocaba', 'SP', 2018, 2025, TOYOTA),
  // Mercedes carro 2016-2020 (Classe C, GLA): Iracemapolis, unica fabrica de
  // automovel da marca no Brasil nesse periodo.
  mod('9BM', '*', ' C ?1[0-9]0 | C ?2[0-9]0 | CLASSE C | GLA ', null, 'Iracemápolis', 'SP', 2016, 2020, IMPRENSA),
  // Amarok: WV1 com codigo A e da fabrica de General Pacheco (o mesmo A do 8AW).
  ['WV1', 'A', ' AMAROK ', null, 'General Pacheco, Argentina', 'General Pacheco', null, 'Argentina', null, null, AR, 'alta'],
]

const inserePlanta = db.prepare(`
  INSERT INTO plants (wmi_code, position_11, plant_name, cidade, uf, pais, ano_de, ano_ate, fonte, confianca)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insereRegra = db.prepare(`
  INSERT INTO plant_modelos (wmi_code, position_11, padrao, excluir, plant_name, cidade, uf, pais, ano_de, ano_ate, fonte, confianca)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Substitui a tabela inteira (nao so upsert): linha que sai do arquivo tem que
// sair do banco tambem, senao uma cidade reprovada continuaria na tela.
const run = db.transaction(() => {
  db.prepare('DELETE FROM plants').run()
  db.prepare('DELETE FROM plant_modelos').run()
  for (const r of PLANTS) inserePlanta.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9] ?? 'alta')
  for (const r of MODELOS) {
    const [wmi, pos, padrao, excluir, nome, cidade, uf, pais, de, ate, fonte, conf] = r
    new RegExp(padrao) // regex invalida quebra aqui, dentro da transacao, antes de gravar
    if (excluir) new RegExp(excluir)
    insereRegra.run(wmi, pos, padrao, excluir, nome, cidade, uf, pais, de, ate, fonte, conf ?? 'alta')
  }
  db.prepare("INSERT INTO meta (chave, valor) VALUES ('plants_versao', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
    .run(String(PLANTS_VERSAO))
})

export function aplicarPlantas() {
  run()
  return PLANTS.length + MODELOS.length
}

// Rodado direto pela linha de comando (npm run import:plants-br). Quando este
// arquivo e so importado pelo servico, nada acontece na importacao: quem decide
// e o start, comparando a versao gravada.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`${aplicarPlantas()} planta(s) aplicada(s), versao ${PLANTS_VERSAO}.`)
}

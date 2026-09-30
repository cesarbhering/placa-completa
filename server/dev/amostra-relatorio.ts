// Payloads de amostra pro relatorio de desenvolvimento (/premium/_amostra*).
// Retornos reais de consultas do dono; so o handler dev-only importa isto.
//
// _amostra       QNA3903, o caso carregado: furto declarado, alienacao,
//                RENAINF e licenciamento atrasado (2024).
// _amostra-kicks GGO6C06, o caso limpo: nada consta, licenciamento no ano
//                anterior (tom ambar "confira") e FIPE presente na fonte
//                livre, entao a secao de valor aparece.
const AMOSTRA_QNA3903 = [
  {
    placa: 'QNA3903',
    chassi: '9BWAG45UXJT036030',
    lotacao: 5,
    renavam: '01129294215',
    potencia: 82,
    situacao: 'EM_CIRCULACAO',
    anoModelo: 2018,
    pesoBruto: 1.41,
    cilindrada: 999,
    importacao: {
      codigoOrgaoSrf: '0',
      numeroProcessoImportacao: '0',
      numeroDeclaracaoImportacao: '0',
      numeroRegistroDespachoAduaneira: '0',
    },
    restricoes: {
      items: [
        { tipoRestricao: 'ROUBO_FURTO' },
        { tipoRestricao: 'ALIENACAO_FIDUCIARIA_FILE_VEICULOS' },
        { tipoRestricao: 'RENAINF' },
      ],
      indicadorAlarme: false,
      indicadorLeilao: false,
      indicadorRecall: false,
      indicadorSiniav: false,
      descricaoRestricao1: 'ALIENACAO_FIDUCIARIA_FILE_VEICULOS',
      indicadorRouboFurto: true,
      indicadorMultaRenainf: true,
      indicadorRestricaoRfb: false,
      indicadorComunicacaoVenda: false,
      indicadorPendenciaEmissao: false,
      indicadorRestricaoRenajud: false,
    },
    procedencia: 'NACIONAL',
    descricaoCor: 'PRATA',
    ufJurisdicao: 'MG',
    anoFabricacao: 2017,
    descricaoEspecie: 'PASSAGEIRO',
    codigoCombustivel: '16',
    quantidadeDeEixos: 2,
    descricaoCategoria: 'PARTICULAR',
    ultimoLicenciamento: {
      dataHoraEmissao: '2024-04-03T06:58:17',
      anoLicenciamento: '2024',
    },
    codigoTipoCarroceria: '999',
    descricaoMarcaModelo: 'VW/NOVO GOL TL MCV',
    descricaoTipoVeiculo: 'AUTOMOVEL',
    ocorrenciasRouboFurto: {
      ocorrencias: [
        {
          dataOcorrencia: '2024-05-24',
          categoriaOcorrencia: 'DECLARACAO',
          tipoOcorrenciaDeclaracao: 'FURTO',
          nomeCorNoRegistroOcorrencia: 'PRATA',
          ufJurisdicaoNoRegistroOcorrencia: 'MG',
          nomeMarcaModeloNoRegistroOcorrencia: 'VW/NOVO GOL TL MCV',
        },
      ],
    },
    capacidadeMaximaDeCarga: 0,
    capacidadeMaximaDeTracao: 1.61,
  },
]

const AMOSTRA_GGO6C06 = [
  {
    placa: 'GGO6C06',
    chassi: '94DFCAP15LB253516',
    lotacao: 5,
    renavam: '01233497909',
    potencia: 114,
    situacao: 'EM_CIRCULACAO',
    anoModelo: 2020,
    pesoBruto: 1.55,
    cilindrada: 1598,
    importacao: {
      codigoOrgaoSrf: '0',
      numeroProcessoImportacao: '0',
      numeroDeclaracaoImportacao: '0',
      numeroRegistroDespachoAduaneira: '0',
    },
    restricoes: {
      items: [],
      indicadorAlarme: false,
      indicadorLeilao: false,
      indicadorRecall: false,
      indicadorSiniav: false,
      indicadorRouboFurto: false,
      indicadorMultaRenainf: false,
      indicadorRestricaoRfb: false,
      indicadorComunicacaoVenda: false,
      indicadorPendenciaEmissao: false,
      indicadorRestricaoRenajud: false,
    },
    procedencia: 'NACIONAL',
    descricaoCor: 'VERMELHA',
    ufJurisdicao: 'MG',
    anoFabricacao: 2020,
    descricaoEspecie: 'PASSAGEIRO',
    codigoCombustivel: '16',
    quantidadeDeEixos: 2,
    descricaoCategoria: 'PARTICULAR',
    ultimoLicenciamento: {
      dataHoraEmissao: '2025-05-24T15:13:25',
      anoLicenciamento: '2025',
    },
    codigoTipoCarroceria: '999',
    descricaoMarcaModelo: 'NISSAN/KICKS SL CVT',
    descricaoTipoVeiculo: 'AUTOMOVEL',
    capacidadeMaximaDeCarga: 0,
    capacidadeMaximaDeTracao: 1.55,
  },
]

// Veiculo REAL da base de leiloes que so tem edital de NOTIFICACAO do
// DETRAN-RJ (AIC2103, Kombi 1989): serve pra revisar o bloco cinza de
// "Notificado para leilao". O resto do payload e o do caso limpo (Kicks), so
// com a identificacao trocada, porque o que importa aqui e a secao de leilao.
const AMOSTRA_NOTIFICADO = AMOSTRA_GGO6C06.map((v: any) => ({
  ...v,
  placa: 'AIC2103',
  chassi: '9BWZZZ23ZKP011355',
  renavam: null,
  descricaoMarcaModelo: 'VW/KOMBI',
  descricaoCor: 'BRANCA',
  anoFabricacao: 1989,
  anoModelo: 1989,
  ufJurisdicao: 'RJ',
}))

// uf/municipio espelham o que o fluxo real guardaria no preview (vem da fonte
// livre na hora do checkout, nao da jurisdicao): e o que alimenta IPVA/seguro.
export const AMOSTRAS: Record<string, { placa: string; uf: string; municipio: string; payload: any }> = {
  _amostra: { placa: 'QNA3903', uf: 'MG', municipio: 'Belo Horizonte', payload: AMOSTRA_QNA3903 },
  '_amostra-kicks': { placa: 'GGO6C06', uf: 'SP', municipio: 'São Paulo', payload: AMOSTRA_GGO6C06 },
  // Mesmo veiculo da amostra padrao; o que muda e o valorCusto, forcado pra
  // "versao FIPE nao identificada" no report.get. Serve pra revisar essa tela.
  '_amostra-fipe-incerta': { placa: 'QNA3903', uf: 'MG', municipio: 'Belo Horizonte', payload: AMOSTRA_QNA3903 },
  '_amostra-notificado': { placa: 'AIC2103', uf: 'RJ', municipio: 'Rio de Janeiro', payload: AMOSTRA_NOTIFICADO },
}

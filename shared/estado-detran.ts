// Paginas de estado mais completas (plano SEO 02/out, item #9): o que se
// resolve no DETRAN da UF, link oficial, e um dado PROPRIO da UF, agregado e
// com N >= 30. Comeca por PE, CE, SP, MG e BA. Regras: nunca parecer orgao
// publico (o texto manda pro site oficial e diz que nao somos o DETRAN), sem
// PII, sem valor de leilao, sem afirmar que o carro do leitor tem problema.
//
// Numeros (prod, so leitura, so agregados):
// - leilao: consultas gratis com sinal de leilao respondido (positivo ou
//   negativo), 1 por placa (a mais recente), UF do registro do veiculo, de
//   20/09 a 02/10/2026; % com registro na nossa base de leiloes.
// - recall: relatorios completos entregues (1 por placa, 27/08 a 02/10/2026)
//   com recall pendente no registro nacional. So SP e MG passam de N 30.

export interface DadoUf { texto: string }
export interface EstadoDetran {
  orgao: string
  servicos: string[]
  dados: DadoUf[]
}

const SERVICOS = (orgao: string, fazenda: string) => [
  `Licenciamento anual: o ${orgao} emite o CRLV-e depois que IPVA, taxa de licenciamento e multas vencidas estão pagos.`,
  `IPVA: é cobrado pela ${fazenda}; o calendário e as formas de pagamento ficam no site da Fazenda estadual.`,
  `Transferência de propriedade: começa com a ATPV-e (autorização de transferência) assinada pelo vendedor e segue com vistoria e pagamento das taxas no ${orgao}.`,
  'Débitos e infrações: o site oficial mostra multas, IPVA e licenciamento em aberto do veículo.',
]

const LEV_LEILAO = 'nas consultas feitas na PlacaCompleta entre 20 de setembro e 2 de outubro de 2026'
const LEV_RECALL = 'nos relatórios completos emitidos entre 27 de agosto e 2 de outubro de 2026'

export const ESTADO_DETRAN: Record<string, EstadoDetran> = {
  PE: {
    orgao: 'DETRAN-PE',
    servicos: SERVICOS('DETRAN-PE', 'Secretaria da Fazenda de Pernambuco (SEFAZ-PE)'),
    dados: [{ texto: `Entre 58 veículos de Pernambuco consultados ${LEV_LEILAO}, 5,2% (3) tinham registro compatível na nossa base de leilões.` }],
  },
  CE: {
    orgao: 'DETRAN-CE',
    servicos: SERVICOS('DETRAN-CE', 'Secretaria da Fazenda do Ceará (SEFAZ-CE)'),
    dados: [{ texto: `Entre 84 veículos do Ceará consultados ${LEV_LEILAO}, 4,8% (4) tinham registro compatível na nossa base de leilões.` }],
  },
  SP: {
    orgao: 'DETRAN-SP',
    servicos: [
      ...SERVICOS('DETRAN-SP', 'Secretaria da Fazenda e Planejamento de São Paulo (SEFAZ-SP)'),
      'Atendimento presencial: os serviços de veículo do DETRAN-SP também são feitos nos postos do Poupatempo.',
    ],
    dados: [
      { texto: `Entre 235 veículos de São Paulo consultados ${LEV_LEILAO}, 7,7% (18) tinham registro compatível na nossa base de leilões.` },
      { texto: `Entre 40 veículos de São Paulo ${LEV_RECALL}, 5,0% (2) tinham recall pendente no registro nacional.` },
    ],
  },
  MG: {
    orgao: 'DETRAN-MG',
    servicos: SERVICOS('DETRAN-MG', 'Secretaria de Estado de Fazenda de Minas Gerais (SEF-MG)'),
    dados: [
      { texto: `Entre 118 veículos de Minas Gerais consultados ${LEV_LEILAO}, 6,8% (8) tinham registro compatível na nossa base de leilões.` },
      { texto: `Entre 38 veículos de Minas Gerais ${LEV_RECALL}, 7,9% (3) tinham recall pendente no registro nacional.` },
    ],
  },
  BA: {
    orgao: 'DETRAN-BA',
    servicos: SERVICOS('DETRAN-BA', 'Secretaria da Fazenda da Bahia (SEFAZ-BA)'),
    dados: [{ texto: `Entre 74 veículos da Bahia consultados ${LEV_LEILAO}, 8,1% (6) tinham registro compatível na nossa base de leilões.` }],
  },
}

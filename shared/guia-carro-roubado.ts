// Guia "Como saber se o carro e roubado" (rota /como-saber-se-o-carro-e-roubado).
// Regras: nunca afirmar que um carro especifico e roubado (sempre indicador ou
// registro), nenhum numero de roubo, sem travessao, sem nome de fornecedor.
// Entrega (shared/planos.ts): a consulta gratis identifica o veiculo (marca,
// modelo, ano, cor, parte do chassi). "Roubo e furto" so no relatorio completo.

export const H1_CARRO_ROUBADO = 'Como saber se o carro é roubado'

export const RESPOSTA_CARRO_ROUBADO =
  'Para saber se um carro é roubado, consulte a placa e confira se marca, modelo, cor e chassi batem com o carro e o documento. O jeito mais fácil é o Relatório Completo, que mostra o indicador de roubo e furto. Na dúvida, não pague nada e procure a polícia, porque placa sem registro não descarta clone.'

export const PASSOS_CARRO_ROUBADO = [
  { nome: 'Consulte a placa', texto: 'A consulta grátis mostra marca, modelo, ano, cor e parte do chassi. Compare com o carro na sua frente: se a placa é de um carro e o veículo é outro, pare ali. O indicador de roubo e furto aparece no relatório completo.' },
  { nome: 'Confira o documento', texto: 'Peça o CRLV e veja se placa, chassi e Renavam batem com o relatório. Documento rasurado, com cara de cópia ou com dados que não fecham é motivo para desistir.' },
  { nome: 'Olhe o chassi e o motor no carro', texto: 'O número gravado no chassi e no motor precisa ser igual ao do documento. Marcas de lixa, solda ou etiquetas trocadas são alerta. Se puder, leve a um mecânico de confiança ou faça uma vistoria cautelar.' },
  { nome: 'Desconfie de placa clonada', texto: 'No clone, a placa é de um carro legítimo e o veículo é outro. Preço muito abaixo da tabela, vendedor com pressa, negócio só em dinheiro e recusa em deixar você levar o carro para avaliar são sinais clássicos.' },
  { nome: 'Confirme com o DETRAN', texto: 'Em caso de suspeita, confirme a situação do veículo no DETRAN do estado e com a polícia antes de transferir qualquer valor. A consulta é um indicador e ajuda a decidir, mas não substitui a confirmação oficial.' },
]

export const SE_FOR_ROUBADO = [
  'Não pague nem assine nada, e não confronte o vendedor.',
  'Guarde prints, anúncio, conversas e dados do carro e do vendedor.',
  'Procure a polícia e informe o que encontrou.',
  'Se já pagou, registre boletim de ocorrência e guarde o comprovante.',
]

export const FAQ_CARRO_ROUBADO = [
  { pergunta: H1_CARRO_ROUBADO + '?', resposta: RESPOSTA_CARRO_ROUBADO },
  { pergunta: 'Dá para consultar a placa para ver se o carro é roubado?', resposta: 'Sim. A consulta pela placa identifica o veículo (marca, modelo, ano, cor e parte do chassi) para você conferir se bate com o carro. O indicador de roubo e furto aparece no relatório completo.' },
  { pergunta: 'A prévia da consulta mostra roubo e furto?', resposta: 'Não. A prévia identifica o veículo. O indicador de roubo e furto é parte do relatório completo.' },
  { pergunta: 'Placa sem registro de roubo garante que o carro está limpo?', resposta: 'Não. Num clone, a placa é de outro carro e pode estar sem registro. Por isso compare marca, modelo, cor, chassi e motor do relatório com o carro e o documento.' },
  { pergunta: 'Como saber se a placa é clonada?', resposta: 'Veja se o carro bate com o cadastro da placa (modelo, cor e chassi), se o documento fecha com o carro e se o preço e o comportamento do vendedor parecem normais. Qualquer divergência é motivo para não fechar negócio.' },
  { pergunta: 'O que fazer se o carro for roubado?', resposta: 'Não pague nada, não confronte o vendedor, guarde as provas do anúncio e procure a polícia. Se já pagou, registre boletim de ocorrência.' },
]

export const RESPOSTA_CONSULTAR_ROUBO =
  'Para consultar a placa e ver se o carro é roubado, digite-a e confira se marca, modelo, cor e chassi batem com o carro. O indicador de roubo e furto aparece no Relatório Completo, que consulta as bases e mostra o registro, ativo ou recuperado, quando constar no registro. A prévia identifica o veículo, mas não mostra roubo e furto.'

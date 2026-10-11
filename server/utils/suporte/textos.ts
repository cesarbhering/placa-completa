// Textos fixos do atendimento por WhatsApp (plano aprovado pelo Cesar, v7).
// Sem travessao. Nao citar a fonte oficial dos dados. Nada de cupom.

export const EMAIL_CONTATO_SUPORTE = 'contato@placacompleta.com.br'

export const TXT = {
  foraDeEscopo: `Por aqui a gente trata só de assuntos da PlacaCompleta (consulta de placa e relatório). Para outros assuntos, escreva para ${EMAIL_CONTATO_SUPORTE}.`,
  empresa: `Esse tipo de informação a gente trata por e-mail: ${EMAIL_CONTATO_SUPORTE}.`,
  verificando: 'Estou verificando com a nossa equipe. Volto aqui em alguns minutos.',
  // So quando o caso vai ao N2 (Cesar). O N1 atende 24 h.
  foraDoHorarioN2: 'Uma pessoa da equipe responde a partir das 8h.',
  pedirNota: 'De 0 a 5, como foi este atendimento?',
  obrigadoNota: 'Obrigado pela avaliação! Se precisar de algo, é só chamar por aqui.',
  escalada: 'Entendi. Esse caso precisa da atenção de uma pessoa da equipe. Já encaminhei com prioridade e a resposta vem por aqui.',
  encerramento: `Vou encerrar o atendimento por aqui. Se precisar de algo sobre a PlacaCompleta, escreva para ${EMAIL_CONTATO_SUPORTE}.`,
  dadoDeTerceiro: 'Não passamos dado pessoal de proprietário (nome, CPF, endereço ou telefone). Isso é protegido por lei e não entra em nenhum relatório. Posso ajudar com a situação do veículo?',
  semCupom: 'No momento não temos cupom disponível. O relatório completo já está em promoção no site.',
  precisaConfirmarDono: 'Encontrei um pedido para essa placa. Para liberar, preciso confirmar que é seu: me passa o e-mail usado na compra ou, se não informou e-mail, o CPF ou CNPJ de quem pagou.',
  soTexto: 'Por aqui eu leio só mensagens de texto. Pode escrever a sua dúvida?',
  erro: 'Tive um problema para responder agora. Já avisei a equipe e volto aqui em alguns minutos.',
} as const

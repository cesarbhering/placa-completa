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
  // Persona (pedido do Cesar, 12/out): Guilherme, do time de suporte. Nunca
  // "assistente virtual/automatico"; perguntado se e robo, nao nega nem afirma.
  apresentacao: 'Oi! Aqui é o Guilherme, do time de suporte da PlacaCompleta.',
  souGuilherme: 'Sou o Guilherme, do atendimento da PlacaCompleta. Se preferir, passo para outra pessoa da equipe.',
  passoParaEquipe: 'Combinado, vou passar para outra pessoa da equipe. A resposta vem por aqui em alguns minutos.',
  semCupom: 'No momento não temos cupom disponível.',
  precisaConfirmarDono: 'Encontrei um pedido para essa placa. Para liberar, preciso confirmar que é seu: me passa o e-mail usado na compra ou, se não informou e-mail, o CPF ou CNPJ de quem pagou.',
  soTexto: 'Não consigo abrir arquivo por aqui. Pode me escrever?',
  semAudio: 'Não consigo ouvir áudio por aqui. Pode me escrever?',
  // Texto so com emoji (👍, 🙏): confirmacao, nao pergunta.
  confirmacao: 'Combinado! Qualquer coisa é só chamar.',
  erro: 'Tive um problema para responder agora. Já avisei a equipe e volto aqui em alguns minutos.',
} as const

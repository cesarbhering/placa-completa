import { describe, it, expect, vi } from 'vitest'
import { processarMensagem, rodarFilaN1, type Conversa, type Deps, type Repo, type Tarefa } from './fluxo'
import { fatoDoPedido } from './pedidos'
import { hmacPagador } from '../pagador-hash'
import { guardarResposta, separarDocumento, gatilhoN2, pedePessoa, pedeDadoDeTerceiro, mascararNumero, cifrarJid, decifrarJid, horarioComercial } from './regras'
import { perguntarAoAgente, SCHEMA_VEREDITO, mensagensParaApi, type Veredito } from './agente'
import { promptDoSistema } from './conhecimento'
import { TXT } from './textos'
import { textoDaMensagem, numeroParaEvolution } from './evolution'
import { PLANOS, precoBRL } from '../../../shared/planos'

const SEG = 'segredo-teste-suporte'
const SEG_PAG = 'segredo-pagador'
const JID = '5511987654321@s.whatsapp.net'
// 15h em Brasilia (horario comercial)
const HORARIO = new Date('2026-10-11T18:00:00Z')

function repoMemoria() {
  const conversas: Conversa[] = []
  const tarefas: Tarefa[] = []
  const bloqueios: { h: string; motivo: string }[] = []
  let seq = 0
  const repo: Repo = {
    async obterConversa(h) { return conversas.find((c) => c.numero_hash === h) || null },
    async conversaPorId(id) { return conversas.find((c) => c.id === id) || null },
    async criarConversa(c) { const n = { ...c, id: `c${++seq}` } as Conversa; conversas.push(n); return n },
    async salvarConversa(c) { const i = conversas.findIndex((x) => x.id === c.id); conversas[i] = c },
    async criarTarefa(t) { tarefas.push({ ...t, id: `t${++seq}`, resposta: null, status: 'pendente', criado_em: new Date().toISOString() }) },
    async tarefaPendenteDaConversa(id) { return [...tarefas].reverse().find((t) => t.conversa_id === id && t.status === 'pendente') || null },
    async tarefasRespondidas() { return tarefas.filter((t) => t.status === 'respondida' && t.resposta) },
    async marcarTarefa(id, campos) { Object.assign(tarefas.find((t) => t.id === id)!, campos) },
    async tarefasPendentesDesde(antes) { return tarefas.filter((t) => t.status === 'pendente' && t.criado_em < antes) },
    async registrarBloqueio(h, motivo) { bloqueios.push({ h, motivo }) },
  }
  return { repo, conversas, tarefas, bloqueios }
}

const V = (p: Partial<Veredito>): Veredito => ({
  categoria: 'outro', acao: 'responder', resposta: '', consulta: { email: '', placa: '', token: '' }, resumo_n1: '', motivo_n2: '', ...p,
})

function montar(roteiro: Veredito[], pedidos: any[] = [], agora = HORARIO) {
  const mem = repoMemoria()
  const enviados: string[] = []
  const emails: { assunto: string; texto: string }[] = []
  const histsAgente: any[] = []
  const bloquear = vi.fn(async () => ({ ok: true, status: 200 }))
  const deps: Deps = {
    repo: mem.repo,
    segredo: SEG,
    segredoPagador: SEG_PAG,
    agente: async (hist, extra) => {
      histsAgente.push({ hist: JSON.parse(JSON.stringify(hist)), extra })
      const v = roteiro.shift()
      return v ? { veredito: v, falha: null } : { veredito: null, falha: 'timeout 8000 ms' }
    },
    consultarPedidos: async (c) => pedidos
      .filter((p) => (c.placa ? p.placa === c.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') : c.email ? p.email === c.email : c.token ? p.token_entrega === c.token : false))
      .map((p) => fatoDoPedido(p, c)),
    enviar: async (_jid, texto) => { enviados.push(texto); return { ok: true, status: 200 } },
    bloquear,
    email: async (assunto, texto) => { emails.push({ assunto, texto }) },
    agora: () => agora,
    log: () => {},
  }
  const msg = (texto: string | null, id?: string) => processarMensagem({ jid: JID, texto, msgId: id }, deps)
  return { deps, mem, enviados, emails, histsAgente, bloquear, msg }
}

describe('simulação 1: dúvida antes de comprar (N0 sozinho)', () => {
  it('responde com o texto do agente, sem tarefa nem e-mail', async () => {
    const preco = precoBRL(PLANOS.completa.valorCentavos)
    const s = montar([V({ categoria: 'venda', resposta: `Mostramos sim. O relatório completo sai por ${preco}, Pix ou cartão.` })])
    await s.msg('Oi, vocês mostram se o carro já foi de leilão? Quanto custa?')
    expect(s.enviados).toEqual([`Mostramos sim. O relatório completo sai por ${preco}, Pix ou cartão.`])
    expect(s.mem.tarefas).toHaveLength(0)
    expect(s.emails).toHaveLength(0)
  })
  it('o prompt traz o preço do site (promoção) e as regras', () => {
    const p = promptDoSistema()
    expect(p).toContain(precoBRL(PLANOS.completa.valorCentavos))
    expect(p).toContain(`de ${precoBRL(PLANOS.completa.precoDeCentavos!)}`)
    expect(p).toContain('Nunca ofereça nem crie cupom')
    expect(p).not.toContain('—')
    expect(p.toLowerCase()).not.toContain('senatran')
  })
})

describe('simulação 2: pagou e não recebeu (identifica por CPF, N1 resolve)', () => {
  const CPF = '123.456.789-00'
  const pedido = { id: 'p1', placa: 'RBF5A06', plano: 'completa', status: 'pago', pago_em: '2026-10-11T02:10:00Z', entregue_em: null, email: null, token_entrega: 'TokFicticio000000000001', pagador_hash: hmacPagador(CPF, SEG_PAG) }

  it('pede o documento, confere por hash sem guardar e cria tarefa N1; resposta da equipe chega ao cliente', async () => {
    const s = montar([
      V({ categoria: 'pedido', resposta: 'Vamos resolver agora. Me passa a placa e o e-mail usado na compra?' }),
      V({ categoria: 'pedido', acao: 'consultar_pedido', consulta: { email: 'jetro@x.com', placa: 'RBF5A06', token: '' } }),
      V({ categoria: 'pedido', resposta: 'Encontrei a consulta da placa RBF5A06, mas o pedido ficou sem e-mail. Pode me passar o CPF ou CNPJ de quem fez o Pix?' }),
      V({ categoria: 'pedido', acao: 'chamar_n1', resposta: 'Confirmado, o pedido é seu. Já acionei a equipe para liberar o relatório. Volto em alguns minutos.', resumo_n1: 'RBF5A06 pago e não entregue, dono confirmado por CPF' }),
    ], [pedido])
    await s.msg('Paguei o Pix faz 20 minutos e não chegou nada!!')
    await s.msg('placa RBF5A06, email jetro@x.com')
    // a consulta voltou ao agente sem link (dono nao comprovado ainda)
    expect(s.histsAgente[2].extra).toContain('"tem_email":false')
    expect(s.histsAgente[2].extra).not.toContain('link')
    await s.msg('123.456.789-00')

    // CPF: nunca guardado nem mandado ao modelo
    const c = s.mem.conversas[0]
    expect(JSON.stringify(c.mensagens)).not.toMatch(/089|123.456.789-00/)
    expect(JSON.stringify(s.histsAgente)).not.toMatch(/089\.740|123.456.789-00/)
    expect(s.histsAgente[3].extra).toContain('CONFERE')
    // pago e nao entregue: dono comprovado, mas sem link (nao ha relatorio ainda)
    expect(s.histsAgente[3].extra).toContain('"dono_comprovado":true')
    expect(s.histsAgente[3].extra).not.toContain('"link"')
    expect(c.pedido_id).toBe('p1')
    expect(s.mem.tarefas).toHaveLength(1)
    expect(s.mem.tarefas[0].resumo).toContain('RBF5A06')
    expect(c.status).toBe('aguardando_n1')

    // N1 responde pela tabela; a fila repassa ao cliente
    s.mem.tarefas[0].resposta = 'Pronto! Seu relatório está aqui: https://placacompleta.com.br/premium/TokFicticio000000000001'
    s.mem.tarefas[0].status = 'respondida'
    const r = await rodarFilaN1(s.deps)
    expect(r.repassadas).toBe(1)
    expect(s.enviados.at(-1)).toContain('/premium/TokFicticio000000000001')
    expect(s.mem.tarefas[0].status).toBe('repassada')
    expect(s.mem.conversas[0].status).toBe('aberta')
  })

  it('CPF que não confere: o agente é avisado de que NÃO confere', async () => {
    const s = montar([V({ acao: 'chamar_n1', resposta: 'Não localizei. Qual o horário aproximado do Pix e o nome de quem pagou?', resumo_n1: 'CPF não confere' })], [pedido])
    s.deps.repo.criarConversa // conversa nasce na 1a mensagem
    await s.msg('A placa é RBF5A06 e o CPF 111.222.333-96')
    expect(s.histsAgente[0].extra).toContain('NAO confere')
  })
})

describe('simulação 3: reclamação de dado errado (N1 corrige)', () => {
  it('vira tarefa N1 com o resumo e o cliente recebe a resposta do agente', async () => {
    const s = montar([V({ categoria: 'reclamacao', acao: 'chamar_n1', resposta: 'Você tem razão em reclamar, já pedi a correção para a equipe.', resumo_n1: 'HSX1F20: versão FIPE 5p, cliente diz 2 portas' })])
    await s.msg('O relatório diz que meu Celta é 5 portas e ele é 2 portas. HSX1F20')
    expect(s.mem.tarefas[0].resumo).toContain('HSX1F20')
    expect(s.enviados[0]).toContain('correção')
  })
})

describe('simulação 4: reembolso + Procon (N2)', () => {
  it('escala sempre, manda 1 e-mail por hora e não promete reembolso', async () => {
    const s = montar([V({ resposta: 'Claro, vou fazer o seu reembolso agora.' }), V({ resposta: 'ok' })])
    await s.msg('Quero meu dinheiro de volta. O relatório não achou leilão. Vou no Procon.')
    expect(s.enviados[0]).toBe(TXT.escalada)
    expect(s.emails).toHaveLength(1)
    expect(s.emails[0].assunto).toContain('N2')
    expect(s.emails[0].texto).toContain('+55 11 9****-4321')
    expect(s.emails[0].texto).not.toContain('987654321')
    expect(s.mem.tarefas[0].resumo).toMatch(/^\[N2\]/)
    await s.msg('E aí? Quero o reembolso')
    expect(s.emails).toHaveLength(1)
  })
  it('pedir pessoa 2 vezes escala', async () => {
    const s = montar([V({ resposta: 'Sou o assistente automático da PlacaCompleta. Posso ajudar?' }), V({ resposta: 'x' })])
    await s.msg('quero falar com um atendente')
    expect(s.emails).toHaveLength(0)
    await s.msg('quero falar com uma pessoa de verdade')
    expect(s.emails).toHaveLength(1)
    expect(s.emails[0].texto).toContain('pediu para falar com uma pessoa')
  })
})

describe('simulação 5: fora de escopo', () => {
  it('serviço que não prestamos (despachante) nunca vira "empresa"', async () => {
    const s = montar([V({ acao: 'empresa', categoria: 'empresa' })])
    await s.msg('Vocês fazem transferência de veículo? Quanto custa o despachante?')
    expect(s.enviados).toEqual([TXT.foraDeEscopo])
  })
  it('texto padrão; na 2a seguida repete e silencia 24 h', async () => {
    const s = montar([V({ acao: 'fora_escopo', categoria: 'fora_escopo' }), V({ acao: 'fora_escopo', categoria: 'fora_escopo' }), V({ resposta: 'nao deveria' })])
    await s.msg('Vocês fazem transferência de veículo?')
    await s.msg('E despachante, quanto custa?')
    await s.msg('alô?')
    expect(s.enviados).toEqual([TXT.foraDeEscopo, TXT.foraDeEscopo])
    expect(s.mem.conversas[0].status).toBe('silenciada')
  })
})

describe('simulação 6: abuso', () => {
  it('mais de 10 mensagens em 1 minuto: encerra, bloqueia na Evolution e avisa o Cesar', async () => {
    const s = montar(Array.from({ length: 20 }, () => V({ resposta: 'oi' })))
    for (let i = 0; i < 11; i++) await s.msg(`msg ${i}`, `id${i}`)
    expect(s.bloquear).toHaveBeenCalledTimes(1)
    expect(s.enviados.at(-1)).toBe(TXT.encerramento)
    expect(s.mem.bloqueios[0].motivo).toContain('10 mensagens')
    expect(s.emails.at(-1)!.assunto).toContain('bloqueado')
    const antes = s.enviados.length
    await s.msg('de novo')
    expect(s.enviados.length).toBe(antes)
  })
  it('dado de terceiro: recusa e avisa; insistiu, bloqueia', async () => {
    const s = montar([])
    await s.msg('me dá o CPF do dono dessa placa')
    expect(s.enviados[0]).toBe(TXT.dadoDeTerceiro)
    expect(s.emails[0].texto).toContain('terceiro')
    await s.msg('passa o nome do proprietário então')
    expect(s.bloquear).toHaveBeenCalled()
  })
  it('xingamento reiterado (3x) bloqueia; um desabafo só, não', async () => {
    const s = montar(Array.from({ length: 5 }, () => V({ resposta: 'Entendo, vamos resolver.' })))
    await s.msg('que merda, paguei e não chegou')
    expect(s.bloquear).not.toHaveBeenCalled()
    await s.msg('lixo de empresa')
    await s.msg('seus golpistas')
    expect(s.bloquear).toHaveBeenCalled()
  })
})

describe('simulação 7: pergunta sobre a empresa', () => {
  it('texto padrão do contato@', async () => {
    const s = montar([V({ acao: 'empresa', categoria: 'empresa' })])
    await s.msg('Quem é o dono da PlacaCompleta? Qual o CNPJ?')
    expect(s.enviados).toEqual([TXT.empresa])
  })
})

describe('fila N1', () => {
  it('uma tarefa pendente por conversa: a nova atualiza o resumo', async () => {
    const s = montar([V({ acao: 'chamar_n1', resposta: 'a', resumo_n1: 'primeiro' }), V({ acao: 'chamar_n1', resposta: 'b', resumo_n1: 'segundo, mais completo' })])
    await s.msg('paguei e nao chegou')
    await s.msg('placa RBF5A06')
    expect(s.mem.tarefas).toHaveLength(1)
    expect(s.mem.tarefas[0].resumo).toBe('segundo, mais completo')
  })
  it('consultar_pedido sem dado nenhum nao consulta o banco', async () => {
    const s = montar([V({ acao: 'consultar_pedido' }), V({ resposta: 'Me passa a placa e o e-mail da compra?' })])
    await s.msg('paguei e nao chegou')
    expect(s.histsAgente[1].extra).toContain('nao informou placa')
    expect(s.enviados).toEqual(['Me passa a placa e o e-mail da compra?'])
    expect(s.mem.tarefas).toHaveLength(0)
  })
})

describe('freios e falhas', () => {
  it('agente fora do ar: N1 + mensagem de erro; fora do horário avisa que a equipe volta às 8h', async () => {
    const madrugada = new Date('2026-10-11T06:00:00Z') // 3h em Brasilia
    const s = montar([], [], madrugada)
    await s.msg('meu relatório não abre')
    expect(s.mem.tarefas[0].resumo).toContain('timeout')
    expect(s.enviados[0]).toContain(TXT.erro)
    expect(s.enviados[0]).toContain(TXT.foraDoHorario)
  })
  it('resposta que cita a fonte oficial ou afirma problema vira "verificando" + N1', async () => {
    const s = montar([V({ resposta: 'Segundo o SENATRAN o carro está ok.' }), V({ resposta: 'O seu carro tem leilão.' })])
    await s.msg('o carro está ok?')
    await s.msg('e leilão?')
    expect(s.enviados).toEqual([TXT.verificando, TXT.verificando])
    // mesma conversa: uma tarefa so, com o motivo mais recente
    expect(s.mem.tarefas.map((t) => t.resumo)).toEqual([expect.stringContaining('tem problema')])
  })
  it('30 respostas por dia, depois silêncio', async () => {
    const s = montar(Array.from({ length: 40 }, () => V({ resposta: 'ok' })))
    let t = HORARIO.getTime()
    s.deps.agora = () => new Date(t)
    for (let i = 0; i < 32; i++) { t += 70_000; await s.msg(`pergunta ${i}`) }
    expect(s.enviados).toHaveLength(30)
  })
  it('mensagem repetida (mesmo id do WhatsApp) não responde duas vezes', async () => {
    const s = montar([V({ resposta: 'a' }), V({ resposta: 'b' })])
    await s.msg('oi', 'X1')
    await s.msg('oi', 'X1')
    expect(s.enviados).toEqual(['a'])
  })
  it('áudio/imagem: pede texto', async () => {
    const s = montar([])
    await s.msg(null)
    expect(s.enviados).toEqual([TXT.soTexto])
  })
  it('N1 sem resposta em 15 min no horário comercial vai ao N2 (uma vez)', async () => {
    const s = montar([V({ acao: 'chamar_n1', resposta: 'Verificando.', resumo_n1: 'link não abre' })])
    await s.msg('o link não abre')
    s.mem.tarefas[0].criado_em = new Date(HORARIO.getTime() - 20 * 60_000).toISOString()
    expect((await rodarFilaN1(s.deps)).escaladas).toBe(1)
    expect(s.emails[0].texto).toContain('N1 sem resposta')
    expect((await rodarFilaN1(s.deps)).escaladas).toBe(0)
  })
})

describe('regras puras', () => {
  it('guarda: travessão vira vírgula; cupom e reembolso barrados', () => {
    expect(guardarResposta('Pronto — está aqui').texto).toBe('Pronto, está aqui')
    expect(guardarResposta('Use o cupom VOLTA20 de desconto').barrada).toBeTruthy()
    expect(guardarResposta('Já fiz o seu reembolso').barrada).toBeTruthy()
    expect(guardarResposta('Vou fazer o estorno agora').barrada).toBeTruthy()
    expect(guardarResposta('Já encaminhei o seu pedido de reembolso para a equipe analisar.').barrada).toBeNull()
    expect(guardarResposta('O relatório mostra se consta registro de leilão.').barrada).toBeNull()
    expect(guardarResposta('Mostramos se o carro tem registro de leilão.').barrada).toBeNull()
  })
  it('documento sai do texto', () => {
    expect(separarDocumento('meu cpf 123.456.789-00 ok')).toEqual({ texto: 'meu cpf [documento informado] ok', digitos: '123.456.789-00' })
    expect(separarDocumento('cnpj 12.345.678/0001-95').digitos).toBe('12345678000195')
    expect(separarDocumento('placa ABC1D23').digitos).toBeNull()
  })
  it('gatilhos', () => {
    expect(gatilhoN2('vou no procon')).toBe('juridico_imprensa')
    expect(gatilhoN2('quero meu dinheiro de volta')).toBe('reembolso')
    expect(gatilhoN2('quanto custa?')).toBeNull()
    expect(pedePessoa('quero falar com um atendente')).toBe(true)
    expect(pedeDadoDeTerceiro('qual o nome do dono?')).toBe(true)
    expect(pedeDadoDeTerceiro('o dono pode vender?')).toBe(false)
  })
  it('número: máscara, cifra e jid', () => {
    expect(mascararNumero(JID)).toBe('+55 11 9****-4321')
    expect(decifrarJid(cifrarJid(JID, SEG), SEG)).toBe(JID)
    expect(decifrarJid(cifrarJid(JID, SEG), 'outro')).toBeNull()
    expect(numeroParaEvolution(JID)).toBe('5511987654321')
    expect(numeroParaEvolution('123@lid')).toBe('123@lid')
  })
  it('horário comercial 8h às 22h de Brasília', () => {
    expect(horarioComercial(new Date('2026-10-11T11:00:00Z'))).toBe(true) // 8h
    expect(horarioComercial(new Date('2026-10-12T00:59:00Z'))).toBe(true) // 21h59
    expect(horarioComercial(new Date('2026-10-12T01:00:00Z'))).toBe(false) // 22h
  })
  it('texto de mensagem do Evolution', () => {
    expect(textoDaMensagem({ message: { conversation: ' oi ' } })).toBe('oi')
    expect(textoDaMensagem({ message: { extendedTextMessage: { text: 'link' } } })).toBe('link')
    expect(textoDaMensagem({ message: { audioMessage: {} } })).toBeNull()
  })
  it('link do relatório só com dono comprovado e pedido entregue', () => {
    const p = { id: 'x', placa: 'AAA1A11', status: 'entregue', email: 'a@b.com', token_entrega: 'T', pagador_hash: null }
    expect(fatoDoPedido(p, { placa: 'AAA1A11' }).link).toBeUndefined()
    expect(fatoDoPedido(p, { email: 'A@B.com ' }).link).toContain('/premium/T')
    expect(JSON.stringify(fatoDoPedido(p, { placa: 'AAA1A11' }))).not.toContain('a@b.com')
  })
})

describe('chamada ao Haiku', () => {
  it('claude-haiku-5-5, thinking disabled, sem temperature, structured output', async () => {
    let corpo: any
    const f = vi.fn(async (_u: any, init: any) => { corpo = JSON.parse(init.body); return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(V({ resposta: 'oi' })) }] }) } as any })
    const r = await perguntarAoAgente([{ de: 'cliente', texto: 'oi' }], 'k', { fetchImpl: f as any })
    expect(r.veredito?.resposta).toBe('oi')
    expect(corpo.model).toBe('claude-haiku-5-5')
    expect(corpo.thinking).toEqual({ type: 'disabled' })
    expect(corpo).not.toHaveProperty('temperature')
    expect(corpo.output_config.format).toEqual({ type: 'json_schema', schema: SCHEMA_VEREDITO })
  })
  it('falha vira null com motivo', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: { type: 'rate_limit_error' } }) }) as any)
    expect((await perguntarAoAgente([{ de: 'cliente', texto: 'oi' }], 'k', { fetchImpl: f as any })).falha).toBe('HTTP 429 rate_limit_error')
  })
  it('histórico alterna papéis e começa pelo cliente', () => {
    const m = mensagensParaApi([{ de: 'bot', texto: 'a' }, { de: 'cliente', texto: 'b' }, { de: 'cliente', texto: 'c' }], 'resultado')
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user'])
    expect(m[2].content).toBe('b\nc\n[SISTEMA] resultado')
  })
})

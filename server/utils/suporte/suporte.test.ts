import { describe, it, expect, vi } from 'vitest'
import { processarMensagem, rodarFilaN1, rodarInatividade, type Conversa, type Deps, type Repo, type Tarefa } from './fluxo'
import { fatoDoPedido } from './pedidos'
import { hmacPagador } from '../pagador-hash'
import { guardarResposta, separarDocumento, gatilhoN2, pedePessoa, pedeDadoDeTerceiro, mascararNumero, cifrarJid, decifrarJid, horarioComercial, parseNota } from './regras'
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
    async obterConversa(h) { return [...conversas].reverse().find((c) => c.numero_hash === h) || null },
    async conversaPorId(id) { return conversas.find((c) => c.id === id) || null },
    async criarConversa(c) { const n = { ...c, id: `c${++seq}` } as Conversa; conversas.push(n); return n },
    async salvarConversa(c) { const i = conversas.findIndex((x) => x.id === c.id); conversas[i] = c },
    async criarTarefa(t) { tarefas.push({ ...t, id: `t${++seq}`, resposta: null, status: 'pendente', criado_em: new Date().toISOString() }) },
    async tarefaPendenteDaConversa(id) { return [...tarefas].reverse().find((t) => t.conversa_id === id && t.status === 'pendente') || null },
    async tarefasRespondidas() { return tarefas.filter((t) => t.status === 'respondida' && t.resposta) },
    async marcarTarefa(id, campos) { Object.assign(tarefas.find((t) => t.id === id)!, campos) },
    async tarefasPendentesDesde(antes) { return tarefas.filter((t) => t.status === 'pendente' && t.criado_em < antes) },
    async registrarBloqueio(h, motivo) { bloqueios.push({ h, motivo }) },
    async numeroBloqueado(h) { return bloqueios.some((b) => b.h === h) },
    async conversasAbertasParadasDesde(antes) { return conversas.filter((c) => c.status === 'aberta' && (c.mensagens.at(-1)?.em || '') <= antes) },
  }
  return { repo, conversas, tarefas, bloqueios }
}

const V = (p: Partial<Veredito>): Veredito => ({
  categoria: 'outro', acao: 'responder', resposta: '', consulta: { email: '', placa: '', token: '' }, resumo_n1: '', motivo_n2: '', atendimento_concluido: false, ...p,
})

function montar(roteiro: Veredito[], pedidos: any[] = [], agora = HORARIO) {
  const mem = repoMemoria()
  const enviados: string[] = []
  // Texto exato que saiu (com a apresentacao do Guilherme na 1a mensagem).
  const brutos: string[] = []
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
    enviar: async (_jid, texto) => { brutos.push(texto); enviados.push(texto.replace(`${TXT.apresentacao}\n\n`, '')); return { ok: true, status: 200 } },
    bloquear,
    email: async (assunto, texto) => { emails.push({ assunto, texto }) },
    agora: () => agora,
    log: () => {},
  }
  const msg = (texto: string | null, id?: string) => processarMensagem({ jid: JID, texto, msgId: id }, deps)
  return { deps, mem, enviados, brutos, emails, histsAgente, bloquear, msg }
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

describe('nota de 0 a 5 ao fim do atendimento', () => {
  it('simulação 1 até o fim: concluído pede a nota uma vez; "nota 4" salva, agradece e encerra', async () => {
    const s = montar([
      V({ categoria: 'venda', resposta: 'O relatório completo mostra registro de leilão. Consulte em https://placacompleta.com.br.' }),
      V({ categoria: 'venda', resposta: 'Por nada! Qualquer coisa, é só chamar.', atendimento_concluido: true }),
      V({ categoria: 'venda', resposta: 'Disponha!', atendimento_concluido: true }),
    ])
    await s.msg('Vocês mostram leilão?')
    await s.msg('obrigado, era só isso')
    expect(s.enviados.slice(-2)).toEqual(['Por nada! Qualquer coisa, é só chamar.', TXT.pedirNota])
    await s.msg('legal') // nao e nota: segue pro agente, e nao pergunta de novo
    expect(s.enviados.filter((t) => t === TXT.pedirNota)).toHaveLength(1)
    await s.msg('nota 4')
    expect(s.enviados.at(-1)).toBe(TXT.obrigadoNota)
    const c = s.mem.conversas[0]
    expect(c.nota).toBe(4)
    expect(c.nivel_final).toBe('N0')
    expect(c.status).toBe('encerrada')
    // proxima mensagem abre outro atendimento (outra linha)
    await s.msg('oi de novo')
    expect(s.mem.conversas).toHaveLength(2)
    expect(s.mem.conversas[1].nota).toBeNull()
  })
  it('N1 respondeu e encerrou: pede a nota com nível final N1; "cinco" vale', async () => {
    const s = montar([V({ acao: 'chamar_n1', resposta: 'Verificando.', resumo_n1: 'link' })])
    await s.msg('o link não abre')
    Object.assign(s.mem.tarefas[0], { resposta: 'Pronto, link reenviado: https://placacompleta.com.br/premium/T', status: 'respondida', encerrar: true })
    await rodarFilaN1(s.deps)
    expect(s.enviados.slice(-2)).toEqual(['Pronto, link reenviado: https://placacompleta.com.br/premium/T', TXT.pedirNota])
    await s.msg('cinco')
    expect(s.mem.conversas[0]).toMatchObject({ nota: 5, nivel_final: 'N1', status: 'encerrada' })
  })
  it('resposta da equipe sem "encerrar" não pede nota', async () => {
    const s = montar([V({ acao: 'chamar_n1', resposta: 'Verificando.', resumo_n1: 'x' })])
    await s.msg('o link não abre')
    Object.assign(s.mem.tarefas[0], { resposta: 'Qual o e-mail da compra?', status: 'respondida' })
    await rodarFilaN1(s.deps)
    expect(s.enviados).not.toContain(TXT.pedirNota)
  })
  it('fora de escopo e bloqueio nunca pedem nota', async () => {
    const s = montar([V({ acao: 'fora_escopo', atendimento_concluido: true })])
    await s.msg('vocês vendem carro?')
    expect(s.enviados).toEqual([TXT.foraDeEscopo])
  })
  it('sem nota em 24 h: fica nula e a próxima mensagem abre outro atendimento', async () => {
    const s = montar([V({ resposta: 'Disponha!', atendimento_concluido: true }), V({ resposta: 'Oi!' })])
    let t = HORARIO.getTime()
    s.deps.agora = () => new Date(t)
    await s.msg('valeu')
    t += 25 * 3600_000
    await s.msg('5')
    expect(s.mem.conversas[0]).toMatchObject({ nota: null, status: 'encerrada' })
    expect(s.mem.conversas).toHaveLength(2)
    expect(s.brutos.at(-1)).toBe(TXT.apresentacao) // novo atendimento: 'Oi!' do agente vira so a apresentacao
  })
  it('parse da nota', () => {
    for (const [t, n] of [['5', 5], ['nota 4', 4], ['cinco', 5], ['0', 0], ['zero', 0], ['4/5', 4], ['dou 3!', 3], ['Nota: 2', 2], ['3 estrelas', 3]] as const) expect(parseNota(t)).toBe(n)
    for (const t of ['10', '6', 'foi bom', 'ABC1D23', 'paguei 5 reais', '']) expect(parseNota(t)).toBeNull()
  })
})

describe('inatividade (40 min desde a última mensagem, de qualquer lado)', () => {
  const relogio = (s: ReturnType<typeof montar>) => { let t = HORARIO.getTime(); s.deps.agora = () => new Date(t); return (min: number) => { t += min * 60_000 } }

  it('última mensagem há 39 min: nada; há 40 min: encerra uma vez, com a nota', async () => {
    const s = montar([V({ resposta: 'O relatório completo custa R$ 39,90.' })])
    const passa = relogio(s)
    await s.msg('quanto custa?')
    passa(39); expect((await rodarInatividade(s.deps)).encerradas).toBe(0)
    passa(1); expect((await rodarInatividade(s.deps)).encerradas).toBe(1)
    expect(s.enviados.at(-1)).toBe(TXT.pedirNota)
    expect(s.mem.conversas[0].status).toBe('encerrada')
    passa(5); expect((await rodarInatividade(s.deps)).encerradas).toBe(0)
    expect(s.enviados.filter((t) => t === TXT.pedirNota)).toHaveLength(1)
    await s.msg('4')
    expect(s.mem.conversas).toHaveLength(1)
    expect(s.mem.conversas[0].nota).toBe(4)
  })
  it('conta da última mensagem do CLIENTE também (ele escreveu por último)', async () => {
    const s = montar([V({ resposta: 'A' })])
    const passa = relogio(s)
    await s.msg('oi')
    passa(30)
    const { receberMensagem } = await import('./fluxo')
    await receberMensagem({ jid: JID, texto: 'deixa eu ver aqui...' }, s.deps) // ainda sem resposta (debounce)
    passa(39); expect((await rodarInatividade(s.deps)).encerradas).toBe(0)
    passa(1); expect((await rodarInatividade(s.deps)).encerradas).toBe(1)
  })
  it('qualquer mensagem nova zera; aguardando N1 nunca encerra; sem "posso encerrar?"', async () => {
    const s = montar([V({ resposta: 'A' }), V({ resposta: 'B' })])
    const passa = relogio(s)
    await s.msg('oi')
    passa(35); await s.msg('mais uma dúvida')
    passa(35); expect((await rodarInatividade(s.deps)).encerradas).toBe(0)
    expect(s.enviados).toEqual(['A', 'B'])
    const n1 = montar([V({ acao: 'chamar_n1', resposta: 'Verificando.', resumo_n1: 'x' })])
    const p1 = relogio(n1)
    await n1.msg('link não abre')
    p1(120); expect((await rodarInatividade(n1.deps)).encerradas).toBe(0)
  })
})

describe('reação, figurinha, emoji e mídia', () => {
  it('classifica o que chega da Evolution', async () => {
    const { classificarMensagem } = await import('./evolution')
    // caso real 13/out: reacao 👍🏻 a uma mensagem nossa
    expect(classificarMensagem({ messageType: 'reactionMessage', message: { reactionMessage: { text: '👍🏻', key: { id: 'X' } } } })).toEqual({ tipo: 'reacao', texto: '👍🏻' })
    expect(classificarMensagem({ messageType: 'reactionMessage', message: { reactionMessage: { text: '' } } })).toEqual({ tipo: 'ignorar' })
    expect(classificarMensagem({ messageType: 'stickerMessage', message: { stickerMessage: {} } })).toEqual({ tipo: 'figurinha' })
    expect(classificarMensagem({ messageType: 'audioMessage', message: { audioMessage: { ptt: true } } })).toEqual({ tipo: 'midia', midia: 'audio' })
    expect(classificarMensagem({ messageType: 'imageMessage', message: { imageMessage: {} } })).toEqual({ tipo: 'midia', midia: 'imagem' })
    expect(classificarMensagem({ messageType: 'documentMessage', message: { documentMessage: {} } })).toEqual({ tipo: 'midia', midia: 'documento' })
    expect(classificarMensagem({ messageType: 'conversation', message: { conversation: ' 👍 ' } })).toEqual({ tipo: 'texto', texto: '👍' })
  })
  it('reação: registra como atividade, não responde e não chama o agente', async () => {
    const s = montar([V({ resposta: 'O relatório sai por R$ 39,90.' })])
    let t = HORARIO.getTime(); s.deps.agora = () => new Date(t)
    await s.msg('quanto custa?')
    t += 39 * 60_000
    const { receberMensagem, responderConversa } = await import('./fluxo')
    const r = await receberMensagem({ jid: JID, texto: '👍🏻', tipo: 'reacao' }, s.deps)
    expect(r.responder).toBe(false)
    await responderConversa(r.conversa, JID, null, s.deps)
    expect(s.enviados).toEqual(['O relatório sai por R$ 39,90.'])
    expect(s.histsAgente).toHaveLength(1)
    expect(s.mem.conversas[0].mensagens.at(-1)).toMatchObject({ de: 'cliente', tipo: 'reacao', texto: '👍🏻' })
    // zerou a inatividade: 39 min depois da reacao ainda nao encerra
    t += 39 * 60_000
    expect((await rodarInatividade(s.deps)).encerradas).toBe(0)
  })
  it('figurinha: registra e não responde', async () => {
    const s = montar([])
    const { receberMensagem } = await import('./fluxo')
    const r = await receberMensagem({ jid: JID, texto: null, tipo: 'figurinha' }, s.deps)
    expect(r.responder).toBe(false)
    expect(s.mem.conversas[0].mensagens.at(-1)).toMatchObject({ tipo: 'figurinha', texto: '[figurinha]' })
    expect(s.enviados).toEqual([])
  })
  it('texto só com emoji: confirmação curta, sem agente; depois de despedida, nada', async () => {
    const s = montar([V({ resposta: 'O relatório sai por R$ 39,90.' })])
    await s.msg('quanto custa?')
    await s.msg('👍')
    expect(s.enviados.at(-1)).toBe(TXT.confirmacao)
    await s.msg('🙏🏻')
    expect(s.enviados.filter((x) => x === TXT.confirmacao)).toHaveLength(1)
    expect(s.histsAgente).toHaveLength(1)
    expect(s.enviados.join(' ')).not.toContain('só mensagens de texto')
  })
  it('áudio e arquivo: frase natural pedindo para escrever', async () => {
    const a = montar([])
    await processarMensagem({ jid: JID, texto: null, tipo: 'midia', midia: 'audio' }, a.deps)
    expect(a.enviados).toEqual([TXT.semAudio])
    const b = montar([])
    await processarMensagem({ jid: JID, texto: null, tipo: 'midia', midia: 'documento' }, b.deps)
    expect(b.enviados).toEqual([TXT.soTexto])
    expect(TXT.semAudio).toBe('Não consigo ouvir áudio por aqui. Pode me escrever?')
  })
  it('detector de só emoji', async () => {
    const { soEmoji } = await import('./regras')
    for (const t of ['👍', '🙏🏻', '👏👏', ' 👍🏻 ', '❤️']) expect(soEmoji(t)).toBe(true)
    for (const t of ['ok 👍', '5', 'obrigado', '', ':)']) expect(soEmoji(t)).toBe(false)
  })
})

describe('debounce de 2 min', () => {
  it('3 linhas em 90 s: 1 resposta só, 2 min depois da 3a', async () => {
    vi.useFakeTimers()
    try {
      const { agendarResposta, DEBOUNCE_MS } = await import('./agenda')
      expect(DEBOUNCE_MS).toBe(120_000)
      const chamadas: number[] = []
      const fn = async () => { chamadas.push(Date.now()) }
      const t0 = Date.now()
      agendarResposta('conv-teste', fn)
      await vi.advanceTimersByTimeAsync(45_000); agendarResposta('conv-teste', fn)
      await vi.advanceTimersByTimeAsync(45_000); agendarResposta('conv-teste', fn) // 3a linha aos 90 s
      await vi.advanceTimersByTimeAsync(119_000)
      expect(chamadas).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(chamadas).toEqual([t0 + 90_000 + 120_000])
    } finally { vi.useRealTimers() }
  })
  it('a resposta trata as linhas acumuladas como uma mensagem só', async () => {
    const s = montar([V({ resposta: 'Entendi.' })])
    const { receberMensagem, responderConversa } = await import('./fluxo')
    await receberMensagem({ jid: JID, texto: 'oi' }, s.deps)
    await receberMensagem({ jid: JID, texto: 'paguei e não chegou' }, s.deps)
    const r = await receberMensagem({ jid: JID, texto: 'quero meu dinheiro de volta' }, s.deps)
    await responderConversa(r.conversa, JID, null, s.deps)
    // o gatilho de reembolso foi visto no conjunto, e saiu UMA resposta
    expect(s.enviados).toEqual([TXT.escalada])
    expect(s.mem.tarefas[0].pergunta).toBe('oi\npaguei e não chegou\nquero meu dinheiro de volta')
  })
})

describe('links do site', () => {
  it('home/consulta vira "no site da PlacaCompleta"; páginas próprias e relatório do cliente ficam', async () => {
    const { semLinksDoSite } = await import('./regras')
    expect(semLinksDoSite('Para consultar, acesse https://placacompleta.com.br e digite a placa.')).toBe('Para consultar, acesse o site da PlacaCompleta e digite a placa.')
    expect(semLinksDoSite('Digite a placa em https://placacompleta.com.br agora.')).toBe('Digite a placa no site da PlacaCompleta agora.')
    for (const ok of ['https://placacompleta.com.br/ibv', 'https://placacompleta.com.br/tabela-fipe-por-placa', 'https://placacompleta.com.br/carro-de-leilao/como-saber', 'https://placacompleta.com.br/premium/TokFicticio000000000001']) {
      expect(semLinksDoSite(`Veja: ${ok}`)).toBe(`Veja: ${ok}`)
    }
  })
  it('a guarda tira o link da resposta do agente', async () => {
    const s = montar([V({ resposta: 'O relatório sai por R$ 39,90. Compre em https://placacompleta.com.br.' })])
    await s.msg('quanto custa?')
    expect(s.enviados[0]).not.toContain('https://')
    expect(s.enviados[0]).toContain('no site da PlacaCompleta')
  })
  it('prompt: sem URL para consulta; links só das páginas próprias', () => {
    const p = promptDoSistema()
    expect(p).toContain('sem URL')
    expect(p).toContain('https://placacompleta.com.br/ibv')
    expect(p).not.toContain('mande https://placacompleta.com.br e diga')
  })
})

describe('persona Guilherme', () => {
  it('apresenta-se na 1a mensagem de cada atendimento, só uma vez', async () => {
    const s = montar([V({ resposta: 'Oi! O relatório completo custa R$ 39,90.' }), V({ resposta: 'É só digitar a placa no site.' })])
    await s.msg('quanto custa?')
    await s.msg('como compro?')
    expect(s.brutos[0]).toBe(`${TXT.apresentacao}\n\nO relatório completo custa R$ 39,90.`)
    expect(s.brutos[1]).toBe('É só digitar a placa no site.')
  })
  it('vale também para texto fixo (fora de escopo) e não duplica quando o agente já se apresentou', async () => {
    const a = montar([V({ acao: 'fora_escopo' })])
    await a.msg('vocês vendem carro?')
    expect(a.brutos[0]).toBe(`${TXT.apresentacao}\n\n${TXT.foraDeEscopo}`)
    const b = montar([V({ resposta: 'Oi! Aqui é o Guilherme, do time de suporte da PlacaCompleta. Como posso ajudar?' })])
    await b.msg('oi')
    expect(b.brutos[0].match(/Guilherme/g)).toHaveLength(1)
  })
  it('"é robô?": não nega nem afirma; insistiu, passa para a equipe (N1)', async () => {
    const s = montar([V({ resposta: 'Claro!' })])
    await s.msg('tô falando com um robô?')
    expect(s.enviados.at(-1)).toBe(TXT.souGuilherme)
    expect(s.mem.tarefas).toHaveLength(0)
    await s.msg('você é um bot sim ou não?')
    expect(s.enviados.at(-1)).toBe(TXT.passoParaEquipe)
    expect(s.mem.tarefas[0].resumo).toContain('outra pessoa')
    expect(s.mem.conversas[0].status).toBe('aguardando_n1')
  })
  it('resposta do agente que se diz automático vira a fala do Guilherme', async () => {
    const s = montar([V({ resposta: 'Oi' }), V({ resposta: 'Sou um assistente virtual da PlacaCompleta.' })])
    await s.msg('oi')
    await s.msg('quem fala?')
    expect(s.enviados.at(-1)).toBe(TXT.souGuilherme)
  })
  it('prompt: Guilherme, sem "assistente automático"', () => {
    const p = promptDoSistema()
    expect(p).toContain('Você é o Guilherme, do time de suporte da PlacaCompleta')
    expect(p).toContain(TXT.souGuilherme)
    expect(p).not.toMatch(/diga que é um assistente automático/)
  })
  it('detectores', async () => {
    const { perguntaSeERobo, seDizAutomatico } = await import('./regras')
    for (const t of ['você é um robô?', 'é bot?', 'isso é IA?', 'vc é humano?', 'to falando com uma máquina?', 'é inteligência artificial?']) expect(perguntaSeERobo(t)).toBe(true)
    for (const t of ['quanto custa?', 'quero falar com um atendente', 'o relatório é bom?']) expect(perguntaSeERobo(t)).toBe(false)
    expect(seDizAutomatico('Sou um assistente automático')).toBe(true)
    expect(seDizAutomatico('Sou o Guilherme, do suporte')).toBe(false)
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
    expect(s.mem.conversas[0].contadores.categoria).toBe('pedido')
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
    const s = montar([V({ resposta: 'Sou o Guilherme, do suporte. Posso ajudar?' }), V({ resposta: 'x' })])
    await s.msg('quero falar com um atendente')
    expect(s.emails).toHaveLength(0)
    await s.msg('quero falar com uma pessoa de verdade')
    expect(s.emails).toHaveLength(1)
    expect(s.emails[0].texto).toContain('pediu para falar com uma pessoa')
  })
})

describe('cupom e pagamento antes de comprovar o dono', () => {
  it('"tem cupom?" responde que não há e segue; insistiu por desconto, N2', async () => {
    const s = montar([V({ resposta: 'x' })])
    await s.msg('tem cupom de desconto?')
    expect(s.enviados).toEqual([TXT.semCupom])
    expect(s.emails).toHaveLength(0)
    await s.msg('nem um desconto pequeno?')
    expect(s.enviados.at(-1)).toBe(TXT.escalada)
    expect(s.emails[0].texto).toContain('insiste em cupom')
  })
  it('sem dono comprovado o agente não vê se foi pago, e resposta que confirma pagamento é trocada', async () => {
    const pedido = { id: 'p9', placa: 'RBF5A06', plano: 'completa', status: 'pago', pago_em: '2026-10-11T02:10:00Z', entregue_em: null, email: null, token_entrega: 'T9', pagador_hash: 'h' }
    const s = montar([
      V({ acao: 'consultar_pedido', consulta: { email: '', placa: 'RBF5A06', token: '' } }),
      V({ resposta: 'Encontrei o pagamento da placa RBF5A06, confirmado no sistema.' }),
    ], [pedido])
    await s.msg('paguei e não chegou, placa RBF5A06')
    expect(s.histsAgente[1].extra).toContain('"encontrado":true')
    expect(s.histsAgente[1].extra).not.toMatch(/pago_em|"pago"|entregue/)
    expect(s.enviados).toEqual([TXT.precisaConfirmarDono])
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

describe('silêncio do número e conversa descartada', () => {
  it('encerrada com silêncio até 2099: não abre conversa, não grava, não responde', async () => {
    const s = montar([V({ resposta: 'nao deveria' })])
    await s.msg('Oi')
    const c = s.mem.conversas[0]
    Object.assign(c, { status: 'encerrada', silenciado_ate: '2099-01-01T00:00:00Z' })
    const nEnv = s.enviados.length, nMsg = c.mensagens.length
    await s.msg('mensagem particular nova')
    expect(s.mem.conversas).toHaveLength(1)
    expect(s.enviados).toHaveLength(nEnv)
    expect(s.mem.conversas[0].mensagens).toHaveLength(nMsg)
  })
  it('descartada: mesmo sem silêncio, nada acontece', async () => {
    const s = montar([V({ resposta: 'oi' }), V({ resposta: 'nao deveria' })])
    await s.msg('Oi')
    Object.assign(s.mem.conversas[0], { status: 'encerrada', contadores: { ...s.mem.conversas[0].contadores, descartada: true } })
    const nEnv = s.enviados.length
    await s.msg('de novo')
    expect(s.mem.conversas).toHaveLength(1)
    expect(s.enviados).toHaveLength(nEnv)
  })
  it('silêncio já vencido numa encerrada: abre conversa nova normalmente', async () => {
    const s = montar([V({ resposta: 'oi' }), V({ resposta: 'de novo por aqui' })])
    await s.msg('Oi')
    Object.assign(s.mem.conversas[0], { status: 'encerrada', silenciado_ate: '2026-10-01T00:00:00Z' })
    await s.msg('voltei')
    expect(s.mem.conversas).toHaveLength(2)
    expect(s.enviados.at(-1)).toBe('De novo por aqui')
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

describe('corridas', () => {
  it('resposta agendada antes do bloqueio não sai depois dele', async () => {
    const s = montar(Array.from({ length: 5 }, () => V({ resposta: 'oi' })))
    const { receberMensagem, responderConversa } = await import('./fluxo')
    const r = await receberMensagem({ jid: JID, texto: 'spam 0' }, s.deps)
    const velha = JSON.parse(JSON.stringify(r.conversa))
    for (let i = 1; i < 11; i++) await receberMensagem({ jid: JID, texto: `spam ${i}` }, s.deps)
    expect(s.bloquear).toHaveBeenCalled()
    const antes = s.enviados.length
    await responderConversa(velha, JID, null, s.deps)
    expect(s.enviados.length).toBe(antes)
  })
  it('rodada sem mensagem nova do cliente não responde', async () => {
    const s = montar([V({ resposta: 'A' }), V({ resposta: 'B' })])
    await s.msg('oi')
    const { responderConversa } = await import('./fluxo')
    await responderConversa(s.mem.conversas[0], JID, null, s.deps)
    expect(s.enviados).toEqual(['A'])
  })
  it('histórico nunca termina no assistente', () => {
    expect(mensagensParaApi([{ de: 'cliente', texto: 'a' }, { de: 'bot', texto: 'b' }]).at(-1)!.role).toBe('user')
  })
})

describe('freios e falhas', () => {
  it('agente fora do ar de madrugada: N1 (24 h) + mensagem de erro, sem aviso de horário', async () => {
    const madrugada = new Date('2026-10-11T06:00:00Z') // 3h em Brasilia
    const s = montar([], [], madrugada)
    await s.msg('meu relatório não abre')
    expect(s.mem.tarefas[0].resumo).toContain('timeout')
    expect(s.enviados).toEqual([TXT.erro])
  })
  it('N2 de madrugada avisa que uma pessoa responde a partir das 8h; de dia, não', async () => {
    const noite = montar([V({ resposta: 'x' })], [], new Date('2026-10-11T06:00:00Z'))
    await noite.msg('vou no procon')
    expect(noite.enviados[0]).toBe(`${TXT.escalada}\n\n${TXT.foraDoHorarioN2}`)
    const dia = montar([V({ resposta: 'x' })])
    await dia.msg('vou no procon')
    expect(dia.enviados[0]).toBe(TXT.escalada)
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
    const s = montar([V({ resposta: 'A' }), V({ resposta: 'B' })])
    await s.msg('oi', 'X1')
    await s.msg('oi', 'X1')
    expect(s.enviados).toEqual(['A'])
  })
  it('áudio/imagem: pede texto', async () => {
    const s = montar([])
    await s.msg(null)
    expect(s.enviados).toEqual([TXT.soTexto])
  })
  it('N1 sem resposta em 15 min vai ao N2 (uma vez), a qualquer hora', async () => {
    const madrugada = new Date('2026-10-11T06:00:00Z')
    const s = montar([V({ acao: 'chamar_n1', resposta: 'Verificando.', resumo_n1: 'link não abre' })], [], madrugada)
    await s.msg('o link não abre')
    s.mem.tarefas[0].criado_em = new Date(madrugada.getTime() - 20 * 60_000).toISOString()
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

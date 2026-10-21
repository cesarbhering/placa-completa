import { describe, it, expect, vi, afterEach } from 'vitest'
import { buscarFotosNaGeracao, passagemPedeFotoNaGeracao, registrarNoTrace, completarFotosNaGeracao } from './fotos-na-geracao'

const REF = (n: number) => `ref${n}.abcdefABCDEF0123456789`
const ORIGEM = { ordem: 0, url_origem: 'https://lagoasantaleiloes.com/PHPs/x.php?id=1.jpg' }

function passagem(extra: any = {}) {
  return { nivel: 'possivel', fonte: 'lagoa_santa', fonte_tipo: 'privado', lote: '123', ref: 'L1', detalhes: { fotos: [ORIGEM] }, foto_refs: [], fotos: [], ...extra }
}

/** RPC fotos_passagem_gravar de mentira: so registra o que seria gravado. */
function fakeSb() {
  const gravacoes: any[] = []
  return {
    gravacoes,
    async rpc(nome: string, a: any) {
      expect(nome).toBe('fotos_passagem_gravar')
      gravacoes.push(a)
      return { data: 'gravado', error: null }
    },
  }
}

const okFotos = { status: 'ok', fotos: [{ ordem: 0, vista: 'frente', foto_ref: REF(1) }, { ordem: 1, vista: 'traseira', foto_ref: REF(2) }] }

afterEach(() => { vi.useRealTimers() })

describe('passagemPedeFotoNaGeracao', () => {
  it('nossa base, qualquer nivel, foto na origem e sem foto no R2: pede', () => {
    for (const nivel of ['confirmado', 'provavel', 'possivel']) expect(passagemPedeFotoNaGeracao(passagem({ nivel }))).toBe(true)
  })
  it('nunca para a base parceira', () => {
    expect(passagemPedeFotoNaGeracao(passagem({ fonte: 'parceiro', fonte_tipo: 'parceiro' }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ fonte_tipo: 'parceiro' }))).toBe(false)
  })
  it('ja tem foto (foto_refs, fotos ou ref no detalhe), sem lote, sem url_origem ou busca encerrada: nao pede', () => {
    expect(passagemPedeFotoNaGeracao(passagem({ foto_refs: [{ ref: REF(1), ordem: 0, vista: null }] }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ fotos: ['https://fotos.placacompleta.com.br/a.jpg'] }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ detalhes: { fotos: [{ ...ORIGEM, foto_ref: REF(1) }] } }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ lote: '' }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ detalhes: {} }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ detalhes: { fotos: [{ ordem: 0 }] } }))).toBe(false)
    expect(passagemPedeFotoNaGeracao(passagem({ fotos_busca: { status: 'sem_foto', em: 'x' } }))).toBe(false)
  })
})

describe('buscarFotosNaGeracao', () => {
  it('API rapida: grava os foto_refs na passagem e registra o tempo', async () => {
    const sb = fakeSb()
    const buscar = vi.fn(async () => okFotos)
    const r = await buscarFotosNaGeracao({ supabase: sb, pedidoId: 'p1', passagens: [passagem()], buscar, log: () => {} })
    expect(buscar).toHaveBeenCalledWith({ fonte: 'lagoa_santa', lote: '123', ref: 'L1' })
    expect(r).toMatchObject({ etapa: 'fotos-do-lote', alvos: 1, chamadas: 1, gravadas: 1, pendentes: 0, prazo_estourado: false })
    expect(typeof r.ms).toBe('number')
    expect(sb.gravacoes).toHaveLength(1)
    expect(sb.gravacoes[0]).toMatchObject({ p_pedido: 'p1', p_fonte: 'lagoa_santa', p_lote: '123', p_ref: 'L1', p_fotos_busca: null })
    expect(sb.gravacoes[0].p_foto_refs.map((f: any) => f.ref)).toEqual([REF(1), REF(2)])
  })

  it('"buscando" e depois "ok" dentro do prazo: pergunta de novo e grava', async () => {
    const sb = fakeSb()
    const buscar = vi.fn()
      .mockResolvedValueOnce({ status: 'buscando', fotos: [] })
      .mockResolvedValueOnce(okFotos)
    const r = await buscarFotosNaGeracao({ supabase: sb, pedidoId: 'p1', passagens: [passagem()], buscar, intervaloMs: 10, prazoMs: 2000, log: () => {} })
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ chamadas: 2, gravadas: 1, pendentes: 0 })
  })

  it('API lenta: desiste no prazo, nao grava nada e segue (o fotos-depois completa)', async () => {
    const sb = fakeSb()
    const buscar = vi.fn(() => new Promise((ok) => setTimeout(() => ok(okFotos), 2000)))
    const t0 = Date.now()
    const r = await buscarFotosNaGeracao({ supabase: sb, pedidoId: 'p1', passagens: [passagem()], buscar, prazoMs: 80, log: () => {} })
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(r).toMatchObject({ gravadas: 0, pendentes: 1, prazo_estourado: true })
    expect(sb.gravacoes).toHaveLength(0)
  })

  it('"buscando" ate o fim do prazo: pendente, sem gravar', async () => {
    const sb = fakeSb()
    const buscar = vi.fn(async () => ({ status: 'buscando', fotos: [] }))
    const r = await buscarFotosNaGeracao({ supabase: sb, pedidoId: 'p1', passagens: [passagem()], buscar, intervaloMs: 30, prazoMs: 100, log: () => {} })
    expect(r).toMatchObject({ gravadas: 0, pendentes: 1, prazo_estourado: true })
    expect(buscar.mock.calls.length).toBeLessThanOrEqual(4)
    expect(sb.gravacoes).toHaveLength(0)
  })

  it('so a nossa base e chamada; parceiro nunca, mesmo com detalhe de foto', async () => {
    const sb = fakeSb()
    const buscar = vi.fn(async () => okFotos)
    await buscarFotosNaGeracao({ supabase: sb, pedidoId: 'p1', passagens: [passagem({ fonte: 'parceiro', fonte_tipo: 'parceiro', lote: '9' }), passagem({ nivel: 'confirmado', lote: '7' })], buscar, log: () => {} })
    expect(buscar).toHaveBeenCalledTimes(1)
    expect((buscar.mock.calls[0] as any)[0].lote).toBe('7')
  })

  it('sem_foto grava fotos_busca; rota ausente para sem gravar; erro de rede e fail-open', async () => {
    const sb1 = fakeSb()
    const r1 = await buscarFotosNaGeracao({ supabase: sb1, pedidoId: 'p1', passagens: [passagem()], buscar: async () => ({ status: 'sem_foto', fotos: [] }), log: () => {} })
    expect(r1.sem_foto).toBe(1)
    expect(sb1.gravacoes[0].p_fotos_busca.status).toBe('sem_foto')

    const sb2 = fakeSb()
    const r2 = await buscarFotosNaGeracao({ supabase: sb2, pedidoId: 'p1', passagens: [passagem()], buscar: async () => { throw Object.assign(new Error('nf'), { statusCode: 404, data: { detail: 'Not Found' } }) }, log: () => {} })
    expect(r2.motivo).toMatch(/ausente/)
    expect(sb2.gravacoes).toHaveLength(0)

    const sb3 = fakeSb()
    const r3 = await buscarFotosNaGeracao({ supabase: sb3, pedidoId: 'p1', passagens: [passagem()], buscar: async () => { throw new Error('ECONNRESET') }, log: () => {} })
    expect(r3).toMatchObject({ erros: 1, gravadas: 0 })
  })

  it('sem passagem elegivel: nao chama a API', async () => {
    const buscar = vi.fn()
    const r = await buscarFotosNaGeracao({ supabase: fakeSb(), pedidoId: 'p1', passagens: [passagem({ foto_refs: [{ ref: REF(1) }] })], buscar, log: () => {} })
    expect(buscar).not.toHaveBeenCalled()
    expect(r.alvos).toBe(0)
  })
})

describe('registrarNoTrace', () => {
  it('acrescenta ao debug_trace existente', async () => {
    let gravado: any = null
    const sb: any = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { debug_trace: [{ etapa: 'config' }] } }) }) }),
        update: (v: any) => { gravado = v; return { eq: async () => ({}) } },
      }),
    }
    await registrarNoTrace(sb, 'p1', { etapa: 'fotos-do-lote', ms: 1234, alvos: 1, chamadas: 1, gravadas: 1, pendentes: 0, sem_foto: 0, erros: 0, prazo_estourado: false })
    expect(gravado.debug_trace).toEqual([{ etapa: 'config' }, expect.objectContaining({ etapa: 'fotos-do-lote', ms: 1234 })])
  })
  it('nunca lanca', async () => {
    await expect(registrarNoTrace({ from: () => { throw new Error('x') } }, 'p1', {} as any)).resolves.toBeUndefined()
  })
})

describe('completarFotosNaGeracao', () => {
  it('plano basica ou sem passagem elegivel: nada', async () => {
    expect(await completarFotosNaGeracao({}, { id: 'p1', plano: 'basica' }, { historicoLeilao: { passagens: [passagem()] } })).toBeNull()
    expect(await completarFotosNaGeracao({}, { id: 'p1', plano: 'completa' }, { historicoLeilao: { passagens: [] } })).toBeNull()
  })
})

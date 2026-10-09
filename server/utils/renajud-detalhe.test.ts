import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parsearRenajudAl, parsearRenajudGo, sanearRenajud, completarRenajud, RENAJUD_UFS, temRenajud } from './renajud-detalhe'

// Integrado pela DOC da Infosimples (nao havia pedido real AL/GO com RENAJUD
// em 09/out). Os formatos abaixo seguem os campos documentados; nomes de
// pessoa vem de proposito pra provar que nao passam.
const AL = {
  placa: 'ABC1D23', renavam: '00000000000', total_restricoes: 1,
  processos: [{ numero_processo: '0701234-56.2024.8.02.0001', orgao: '3ª VARA CÍVEL DE MACEIÓ', tribunal: 'TJAL',
    restricoes: [{ tipo: 'Transferência', data: '15/03/2025', autor: 'FULANO AUTOR' }], autor: 'FULANO AUTOR', reu: 'CICLANO REU' }],
}
const GO = {
  placa: 'ABC1D23',
  bloqueios_judiciais: [{ tribunal: 'TJGO', comarca: 'GOIÂNIA', numero_processo: '5123456-78.2023.8.09.0051', tipo: 'Circulação', inclusao_data: '02/02/2024', nome_parte: 'FULANO PARTE' }],
  proprietario: 'FULANO DONO',
}

describe('parsers RENAJUD', () => {
  it('AL: tribunal, orgao, processo, tipo e data', () => {
    expect(parsearRenajudAl(AL)).toEqual([{ tribunal: 'TJAL', orgao: '3ª VARA CÍVEL DE MACEIÓ', processo: '0701234-56.2024.8.02.0001', tipo: 'Transferência', data: '15/03/2025' }])
  })
  it('GO: bloqueios_judiciais com a comarca no lugar do orgao', () => {
    expect(parsearRenajudGo(GO)).toEqual([{ tribunal: 'TJGO', orgao: 'GOIÂNIA', processo: '5123456-78.2023.8.09.0051', tipo: 'Circulação', data: '02/02/2024' }])
  })
  it('formato desconhecido ou lista vazia: null (fica o card geral)', () => {
    expect(parsearRenajudAl({ outra: 1 })).toBeNull()
    expect(parsearRenajudGo({ bloqueios_judiciais: [] })).toBeNull()
    expect(parsearRenajudGo({ bloqueios_judiciais: [{ tipo: 'X' }] })).toBeNull()
  })
  it('LGPD: nenhum nome de parte, autor, reu ou dono chega ao bloco', () => {
    const out = JSON.stringify([parsearRenajudAl(AL), parsearRenajudGo(GO), sanearRenajud({ status: 'ok', uf: 'GO', itens: [{ ...parsearRenajudGo(GO)![0], nome: 'FULANO' }] })])
    for (const p of ['FULANO', 'CICLANO', 'autor', 'reu', 'nome', 'proprietario']) expect(out).not.toContain(p)
  })
  it('sanear: status ok so com item valido', () => {
    expect(sanearRenajud({ status: 'ok', uf: 'AL', itens: [] }).status).toBe('indisponivel')
  })
  it('mapa: so AL e GO, custo proprio', () => {
    expect(Object.keys(RENAJUD_UFS).sort()).toEqual(['AL', 'GO'])
    expect(RENAJUD_UFS.GO).toMatchObject({ path: 'detran/go/veiculo', fonteCusto: 'infosimples_renajud_go' })
    expect(RENAJUD_UFS.AL).toMatchObject({ path: 'detran/al/renajud', fonteCusto: 'infosimples_renajud_al' })
  })
  it('indicador', () => {
    expect(temRenajud([{ indicadorRestricaoRenajud: true }])).toBe(true)
    expect(temRenajud({ indicadorRestricaoRenajud: false })).toBe(false)
  })
})

describe('completarRenajud', () => {
  function sb(snap: any = { consulta: {} }) {
    const inserts: any[] = []; const updates: any[] = []
    let atual = snap
    return {
      inserts, updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: atual } }) }) }),
        insert: async (r: any) => { inserts.push(r); return { error: null } },
        update: (r: any) => ({ eq: async () => { updates.push(r); atual = r.relatorio_snapshot; return { error: null } } }),
      }),
    }
  }
  beforeEach(() => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'UEZY', infosimplesPkcs12Pass: 'p' })))
  afterEach(() => { vi.unstubAllGlobals(); vi.spyOn(console, 'warn').mockRestore?.() })

  const RESP = (uf: string, rj = true) => [{ ufJurisdicao: uf, renavam: '12345678901', indicadorRestricaoRenajud: rj }]

  it('GO com RENAJUD: chama /go/veiculo, grava custo proprio e o detalhe', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: 0.28 }, data: [GO] }) }))
    vi.stubGlobal('fetch', f)
    const s = sb()
    const r = await completarRenajud(s, { id: 'p1', placa: 'ABC1D23' }, { response: RESP('GO') })
    expect(r.ok).toBe(true)
    expect(String((f.mock.calls[0] as any)[0])).toMatch(/\/detran\/go\/veiculo$/)
    expect(s.inserts[0]).toMatchObject({ fonte: 'infosimples_renajud_go', preco: 0.28 })
    expect(s.updates[0].relatorio_snapshot.renajudDetalhe).toMatchObject({ status: 'ok', uf: 'GO', itens: [{ processo: '5123456-78.2023.8.09.0051' }] })
  })
  it('gate: sem indicador, UF sem fonte ou ja gravado nao chama', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect((await completarRenajud(sb(), { id: 'p', placa: 'X' }, { response: RESP('GO', false) })).pulado).toBe('sem RENAJUD')
    expect((await completarRenajud(sb(), { id: 'p', placa: 'X' }, { response: RESP('SP') })).ok).toBe(false)
    expect((await completarRenajud(sb({ renajudDetalhe: { status: 'ok' } }), { id: 'p', placa: 'X' }, { response: RESP('AL') })).pulado).toBe('ja tem')
    expect(f).not.toHaveBeenCalled()
  })
  it('formato desconhecido: indisponivel e log so das chaves', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: 0.2 }, data: [{ algo_novo: [{ nome: 'FULANO' }] }] }) })))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = sb()
    const r = await completarRenajud(s, { id: 'p1', placa: 'ABC1D23' }, { response: RESP('AL') })
    expect(r.ok).toBe(false)
    expect(s.updates[0].relatorio_snapshot.renajudDetalhe).toEqual({ status: 'indisponivel', uf: 'AL', itens: [] })
    const log = warn.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(log).toContain('formato-desconhecido')
    expect(log).not.toContain('FULANO')
  })
  it('erro de rede: nao lanca', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede') }))
    const r = await completarRenajud(sb(), { id: 'p1', placa: 'ABC1D23' }, { response: RESP('AL') })
    expect(r.ok).toBe(false)
  })
})

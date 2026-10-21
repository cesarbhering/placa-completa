import { describe, it, expect, vi, afterEach } from 'vitest'
import { completarDetran, completarIpvaSefaz, blocoSemDados, mensagemDaFonte, CODIGO_SEM_DADOS } from './infosimples-detran'

// Regra do Cesar (21/out/2026): 612 "a consulta nao retornou dados" NAO e
// falha: e "nada consta". Fixtures no formato real do erro da Infosimples.
const r612 = (msg: string) => ({ status: 200, json: async () => ({ code: 612, code_message: 'A consulta não retornou dados.', errors: [msg], header: { price: '0.2' }, data: [] }) })

function fakeSb(snapInicial: any = { consulta: {} }) {
  const inserts: any[] = []; const updates: any[] = []; let snap = snapInicial
  return {
    inserts, updates,
    from: (t: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
      insert: async (row: any) => { inserts.push({ t, ...row }); return { error: null } },
      upsert: async () => ({ error: null }),
      update: (row: any) => ({ eq: async () => { updates.push(row); if (row.relatorio_snapshot) snap = row.relatorio_snapshot; return { error: null } } }),
    }),
  }
}
const cfg = () => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p', infosimplesBaCpf: '1', infosimplesBaSenha: 's' }))

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('612 = nada consta', () => {
  it('bloco vazio, totais zero e a frase da fonte', () => {
    expect(CODIGO_SEM_DADOS).toBe(612)
    const b = blocoSemDados('detran_ce', 'Seu veículo não possui multas')
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_ce', multas_itens: [], multas_total_centavos: 0, ipva_total_centavos: 0, licenciamento_centavos: 0, autuacoes_em_andamento: 0, mensagem_fonte: 'Seu veículo não possui multas', sem_dados_fonte: true })
    expect(mensagemDaFonte({ codeMessage: 'A consulta não retornou dados.', erros: ['NENHUM REGISTRO ENCONTRADO'] })).toBe('NENHUM REGISTRO ENCONTRADO')
    expect(mensagemDaFonte({ codeMessage: 'A consulta não retornou dados.', erros: [] })).toBeNull()
  })

  it('CE com 612: grava bloco ok (nao indisponivel) e o custo com o codigo 612', async () => {
    cfg()
    vi.stubGlobal('fetch', vi.fn(async () => r612('Seu veículo não possui multas')))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'JXA3G14' }, { response: [{ ufJurisdicao: 'CE', renavam: '01129294215', chassi: '9BWAG45UXJT036030', indicadorMultaRenainf: true }], ignorarGate: true })
    expect(r.ok).toBe(true)
    const multas = sb.updates.map((u) => u.relatorio_snapshot?.multas).filter(Boolean).pop()
    expect(multas).toMatchObject({ status: 'ok', fonte: 'detran_ce', multas_itens: [], multas_total_centavos: 0, mensagem_fonte: 'Seu veículo não possui multas' })
    expect(sb.inserts.find((i) => i.t === 'premium_custos')).toMatchObject({ fonte: 'infosimples_detran_ce', code: 612, preco: 0.2 })
  })

  it('DF com 612: idem (login gov.br), bloco ok', async () => {
    cfg()
    vi.stubEnv('NUXT_INFOSIMPLES_BA_CPF', '00000000000'); vi.stubEnv('NUXT_INFOSIMPLES_BA_SENHA', 'x')
    vi.stubGlobal('fetch', vi.fn(async () => r612('NENHUM REGISTRO ENCONTRADO')))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p2', placa: 'JIT4C23' }, { response: [{ ufJurisdicao: 'DF', renavam: '01129294215', chassi: '9BWAG45UXJT036030', indicadorMultaRenainf: true }], ignorarGate: true })
    expect(r.ok).toBe(true)
    const multas = sb.updates.map((u) => u.relatorio_snapshot?.multas).filter(Boolean)[0]
    expect(multas).toMatchObject({ status: 'ok', fonte: 'detran_df', multas_total_centavos: 0, mensagem_fonte: 'NENHUM REGISTRO ENCONTRADO' })
    // DF: IPVA nao vem do DETRAN; com 612 a SEFAZ ainda e consultada (sempre)
    expect(multas.ipva_pendente_sefaz).toBe(true)
  })

  it('SEFAZ-DF IPVA com 612: IPVA zerado, sem marcar indisponivel', async () => {
    cfg()
    vi.stubGlobal('fetch', vi.fn(async () => r612('NENHUM REGISTRO ENCONTRADO')))
    const sb = fakeSb({ consulta: {}, multas: { status: 'ok', fonte: 'detran_df', ipva_pendente_sefaz: true } })
    const ok = await completarIpvaSefaz(sb, 'p3', 'DF', { placa: 'PAV4I34', renavam: '01129294215' })
    expect(ok).toBe(true)
    const m = sb.updates.pop().relatorio_snapshot.multas
    expect(m).toMatchObject({ ipva_itens: [], ipva_total_centavos: 0, ipva_fonte: 'sefaz_df' })
    expect(m.ipva_sefaz_indisponivel).toBeUndefined()
  })
})

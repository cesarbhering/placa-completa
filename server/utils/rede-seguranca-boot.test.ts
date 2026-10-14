// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { redeSegurancaBoot, precisaReenfileirar, JANELA_MS } from './rede-seguranca-boot'
import { MAX_CHAMADAS } from './detran-retentativa'

const resp = (o: any) => ({ consulta: { response: [{ renavam: '123456789', ...o }] } })
const PEDIDOS = [
  { id: 'sem-bloco-go', placa: 'SFC8G01', relatorio_snapshot: resp({ ufJurisdicao: 'GO', indicadorMultaRenainf: true }) },
  { id: 'ja-tem-bloco', placa: 'AAA1A11', relatorio_snapshot: { ...resp({ ufJurisdicao: 'GO', indicadorMultaRenainf: true }), multas: { status: 'ok', fonte: 'detran_go' } } },
  { id: 'indisponivel', placa: 'AAA1A12', relatorio_snapshot: { ...resp({ ufJurisdicao: 'GO', indicadorMultaRenainf: true }), multas: { status: 'indisponivel' } } },
  { id: 'sem-renainf', placa: 'BBB2B22', relatorio_snapshot: resp({ ufJurisdicao: 'GO', indicadorMultaRenainf: false }) },
  { id: 'sem-renavam', placa: 'CCC3C33', relatorio_snapshot: { consulta: { response: [{ ufJurisdicao: 'GO', indicadorMultaRenainf: true }] } } },
  { id: 'uf-sem-detran', placa: 'DDD4D44', relatorio_snapshot: resp({ ufJurisdicao: 'TO', indicadorMultaRenainf: true }) },
  { id: 'sp-sempre', placa: 'EEE5E55', relatorio_snapshot: resp({ ufJurisdicao: 'SP' }) },
  { id: 'teto-gasto', placa: 'FFF6F66', relatorio_snapshot: resp({ ufJurisdicao: 'GO', indicadorMultaRenainf: true }) },
  { id: 'sem-snapshot', placa: 'GGG7G77', relatorio_snapshot: null },
]

function sbFalso() {
  const filtros: any[] = []
  const tabela = (nome: string) => {
    const f: any[] = []
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { f.push(['eq', c, v]); if (nome === 'pedidos_premium') filtros.push(['eq', c, v]); return b },
      gte: (c: string, v: any) => { filtros.push(['gte', c, v]); return b },
      then: (res: any, rej: any) => {
        let out: any
        if (nome === 'pedidos_premium') out = { data: PEDIDOS, error: null }
        else {
          const pid = f.find((x) => x[1] === 'pedido_id')?.[2]
          out = { data: pid === 'teto-gasto' ? Array.from({ length: MAX_CHAMADAS }, () => ({})) : [], error: null }
        }
        return Promise.resolve(out).then(res, rej)
      },
    }
    return b
  }
  return { cliente: { from: tabela }, filtros }
}

describe('rede de seguranca do boot', () => {
  it('reenfileira so quem esta sem bloco de multas, com renavam, UF com DETRAN (com ou sem RENAINF) e abaixo do teto', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { cliente, filtros } = sbFalso()
    const disparar = vi.fn()
    const agora = Date.UTC(2026, 9, 13, 18, 22)
    const ids = await redeSegurancaBoot(cliente, { agora, disparar })
    expect(ids).toEqual(['sem-bloco-go', 'sem-renainf', 'sp-sempre'])
    expect(disparar).toHaveBeenCalledTimes(3)
    expect(disparar.mock.calls[0][1]).toEqual({ id: 'sem-bloco-go', placa: 'SFC8G01' })
    expect(filtros).toContainEqual(['eq', 'status', 'entregue'])
    expect(filtros).toContainEqual(['eq', 'ambiente', 'producao'])
    expect(filtros).toContainEqual(['gte', 'entregue_em', new Date(agora - JANELA_MS).toISOString()])
  })

  it('idempotente: rodar de novo depois do bloco gravado nao repete', () => {
    const p = PEDIDOS[0]
    expect(precisaReenfileirar(p)).toBe(true)
    expect(precisaReenfileirar({ relatorio_snapshot: { ...p.relatorio_snapshot, multas: { status: 'ok', fonte: 'detran_go' } } })).toBe(false)
  })

  it('erro de leitura: nao lanca, nao dispara', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const disparar = vi.fn()
    const sb = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'x' } }) }) }) }) }) }
    await expect(redeSegurancaBoot(sb, { disparar })).resolves.toEqual([])
    expect(disparar).not.toHaveBeenCalled()
  })
})

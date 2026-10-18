import { describe, expect, it, vi } from 'vitest'
import { avisarFotosNoRelatorio } from './aviso-fotos'
import { textosAvisoFotos, montarAvisoFotos } from './premium-email'

function sbFake(pedido: any) {
  const linha = { ...pedido }
  const sb = {
    linha,
    from: () => {
      const f: Record<string, any> = {}
      let patch: any = null
      const q: any = {
        select: () => q,
        update: (u: any) => { patch = u; return q },
        eq: (c: string, v: any) => { f[c] = v; return q },
        is: (c: string, v: any) => { f[`is:${c}`] = v; return q },
        maybeSingle: async () => ({ data: { ...linha } }),
        then: (res: any) => {
          // update(...).eq('id').is('aviso_fotos_em', null).select('id')
          let ok = true
          if ('is:aviso_fotos_em' in f) ok = linha.aviso_fotos_em == null
          if (patch && ok) Object.assign(linha, patch)
          return Promise.resolve({ data: ok ? [{ id: linha.id }] : [], error: null }).then(res)
        },
      }
      return q
    },
  }
  return sb
}
const base = { id: 'p1', email: 'cliente@exemplo.com', placa: 'ABC1D23', token_entrega: 'TokFicticio000000000001', status: 'entregue', aviso_fotos_em: null }

describe('aviso de fotos: um e-mail por pedido', () => {
  it('marca antes de enviar; segunda vez = ja_avisado', async () => {
    const sb = sbFake(base)
    const enviar = vi.fn(async () => true)
    expect(await avisarFotosNoRelatorio(sb, 'p1', ['possivel'], { enviar })).toBe('enviado')
    expect(sb.linha.aviso_fotos_em).toBeTruthy()
    expect(await avisarFotosNoRelatorio(sb, 'p1', ['possivel'], { enviar })).toBe('ja_avisado')
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toMatchObject({ email: 'cliente@exemplo.com', placa: 'ABC1D23', niveis: ['possivel'] })
  })
  it('sem e-mail: nao envia nem marca', async () => {
    const sb = sbFake({ ...base, email: null })
    const enviar = vi.fn(async () => true)
    expect(await avisarFotosNoRelatorio(sb, 'p1', ['confirmado'], { enviar })).toBe('sem_email')
    expect(enviar).not.toHaveBeenCalled()
    expect(sb.linha.aviso_fotos_em).toBeNull()
  })
  it('envio falhou: desfaz a marca (tenta de novo na proxima foto)', async () => {
    const sb = sbFake(base)
    expect(await avisarFotosNoRelatorio(sb, 'p1', ['possivel'], { enviar: async () => false })).toBe('falhou')
    expect(sb.linha.aviso_fotos_em).toBeNull()
  })
})

describe('texto do aviso de fotos', () => {
  it('possivel: pode ser outro veiculo, compare as fotos; vistoria cautelar confirma', () => {
    const t = textosAvisoFotos('ABC1D23', ['possivel'])
    expect(t.paragrafos.join(' ')).toMatch(/pode ser outro veículo do mesmo modelo e ano: compare as fotos/)
    expect(t.paragrafos.join(' ')).toMatch(/só uma vistoria cautelar confirma/)
    expect(t.paragrafos.join(' ')).not.toMatch(/anúncio do leilão em que o veículo/)
  })
  it('confirmado/provavel: fotos do anuncio desse leilao', () => {
    for (const n of ['confirmado', 'provavel']) {
      const t = textosAvisoFotos('ABC1D23', [n])
      expect(t.paragrafos[0]).toBe('As fotos do anúncio do leilão em que o veículo de placa ABC1D23 aparece no seu relatório já estão disponíveis.')
      expect(t.paragrafos.join(' ')).not.toMatch(/pode ser outro veículo/)
    }
  })
  it('sem travessao, sem SENATRAN, sem cupom; html e texto com o link', () => {
    const m = montarAvisoFotos({ link: 'https://placacompleta.com.br/premium/TokFicticio000000000001', placa: 'ABC1D23', niveis: ['confirmado', 'possivel'] })
    for (const s of [m.assunto, m.html, m.texto]) {
      expect(s).not.toContain('—')
      expect(s.toUpperCase()).not.toContain('SENATRAN')
      expect(s.toLowerCase()).not.toContain('cupom')
    }
    expect(m.html).toContain('Ver as fotos no relatório')
    expect(m.texto).toContain('https://placacompleta.com.br/premium/TokFicticio000000000001')
  })
})

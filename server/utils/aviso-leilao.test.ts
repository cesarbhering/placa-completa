import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { avisarLeilaoTardio, leilaoSurgiu, avisoLeilaoLigado, infoDoHistorico } from './aviso-leilao'
import { textosAvisoLeilao, montarEmailAviso } from './premium-email'

// Regra do Cesar (21/out/2026): leilao ou indicio de sinistro que aparece
// DEPOIS da entrega vira e-mail ao cliente, uma vez por pedido.
const vazio = { resumo: { tem_indicio: false }, passagens: [] }
const comLeilao = { resumo: { tem_indicio: true }, passagens: [{ nivel: 'confirmado', data_leilao: '2019-08-27', comitente: 'MAPFRE SEGUROS GERAIS S/A' }] }
const soSinistro = { ...vazio, sinistro_parceiro: { indicio: true, mensagem: 'x' } }

let sb: ReturnType<typeof supabaseMemoria>
const enviar = vi.fn(async () => true)
const pedido = (x: any = {}) => sb.tab('pedidos_premium').push({ id: 'p1', email: 'ana@x.com', placa: 'ABC1D23', token_entrega: 'tok', status: 'entregue', aviso_leilao_em: null, ...x })
const avisar = (antes: any, depois: any, x: any = {}) => avisarLeilaoTardio(sb, 'p1', antes, depois, { enviar, ligado: true, log: () => {}, ...x })

beforeEach(() => { sb = supabaseMemoria(); enviar.mockClear(); enviar.mockImplementation(async () => true) })

describe('gatilho', () => {
  it('vazio (ou sem historico) para algo: surge; o resto nao', () => {
    expect(leilaoSurgiu(vazio, comLeilao)).toBe(true)
    expect(leilaoSurgiu(null, comLeilao)).toBe(true)
    expect(leilaoSurgiu(vazio, soSinistro)).toBe(true)
    expect(leilaoSurgiu(comLeilao, { ...comLeilao, passagens: [...comLeilao.passagens, { nivel: 'possivel' }] })).toBe(false)
    expect(leilaoSurgiu(vazio, vazio)).toBe(false)
    expect(leilaoSurgiu(vazio, { ...vazio, sinistro_parceiro: { indicio: false } })).toBe(false)
  })
  it('flag: 1 liga, 0 desliga, sem env so fora do staging/homolog', () => {
    expect(avisoLeilaoLigado({ public: {} }, '1')).toBe(true)
    expect(avisoLeilaoLigado({ public: {} }, '0')).toBe(false)
    expect(avisoLeilaoLigado({ public: {} }, undefined)).toBe(true)
    expect(avisoLeilaoLigado({ public: { staging: true } }, undefined)).toBe(false)
    expect(avisoLeilaoLigado({ public: { gated: true } }, undefined)).toBe(false)
  })
})

describe('envio', () => {
  it('surgiu leilao com e-mail: envia uma vez e marca aviso_leilao_em', async () => {
    pedido()
    expect(await avisar(vazio, comLeilao)).toBe('enviado')
    expect(enviar).toHaveBeenCalledOnce()
    expect((enviar.mock.calls[0] as any)[0]).toMatchObject({ email: 'ana@x.com', placa: 'ABC1D23', token: 'tok', info: { sinistro: false } })
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em).toBeTruthy()
    // nao reenvia
    expect(await avisar(vazio, { ...comLeilao, sinistro_parceiro: { indicio: true } })).toBe('ja_avisado')
    expect(enviar).toHaveBeenCalledOnce()
  })
  it('sem e-mail, sem mudanca, desligado, nao entregue: nao envia', async () => {
    pedido({ email: null })
    expect(await avisar(vazio, comLeilao)).toBe('sem_email')
    expect(await avisar(vazio, vazio)).toBe('sem_mudanca')
    expect(await avisar(vazio, comLeilao, { ligado: false })).toBe('desligado')
    sb.tab('pedidos_premium')[0].status = 'pago'
    expect(await avisar(vazio, comLeilao)).toBe('falhou')
    expect(enviar).not.toHaveBeenCalled()
  })
  it('envio falhou: desfaz a marca para tentar de novo', async () => {
    pedido()
    enviar.mockImplementation(async () => false)
    expect(await avisar(vazio, comLeilao)).toBe('falhou')
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em).toBeNull()
  })
})

describe('texto', () => {
  const tudo = (t: { titulo: string; paragrafos: string[]; assunto: string }) => [t.titulo, t.assunto, ...t.paragrafos].join(' ')
  it('confirmado com data e comitente, linguagem leiga, botao', () => {
    const t = textosAvisoLeilao('ABC1D23', infoDoHistorico(comLeilao))
    expect(t.assunto).toBe('Seu relatório da placa ABC1D23 foi atualizado')
    expect(t.paragrafos[0]).toBe('Consta no seu relatório da placa ABC1D23 um registro de leilão em 27/08/2019, com comitente Mapfre Seguros Gerais S/A. Nível confirmado: a placa ou o chassi são iguais aos deste veículo.')
    const m = montarEmailAviso({ link: 'https://x/premium/tok', ...t, botao: 'Ver relatório atualizado' })
    expect(m.html).toContain('Ver relatório atualizado')
  })
  it('possivel: pode ser outro veiculo; so sinistro: consta indicio', () => {
    expect(textosAvisoLeilao('ABC1D23', { passagens: [{ nivel: 'possivel' }], sinistro: false }).paragrafos[0]).toMatch(/registro possível de leilão\. Ele pode ser outro veículo do mesmo modelo e ano/)
    expect(textosAvisoLeilao('ABC1D23', { passagens: [], sinistro: true }).paragrafos[0]).toBe('Consta no seu relatório da placa ABC1D23 indício de sinistro em base parceira de leilões e sinistros.')
  })
  it('nunca afirma, sem travessao, sem o nome do fornecedor nem orgao federal', () => {
    for (const info of [infoDoHistorico(comLeilao), { passagens: [{ nivel: 'possivel' }], sinistro: true }, { passagens: [], sinistro: true }]) {
      const s = tudo(textosAvisoLeilao('ABC1D23', info))
      expect(s).not.toMatch(new RegExp('—|senatran|' + 'avali' + 'service', 'i'))
      expect(s).not.toMatch(/\bfoi (leiloado|batido|sinistrado)/i)
    }
  })
})

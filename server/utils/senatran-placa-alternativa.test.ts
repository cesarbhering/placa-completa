import { describe, it, expect, beforeEach } from 'vitest'

// A decisao testada aqui e a que evitou um estorno: 404 "Veiculo nao
// encontrado" para a placa pedida nao e falha, e sim um convite a perguntar
// pelo outro formato. A funcao real e usada aqui; o que entra por parametro e
// um dublê no lugar da consulta paga, entao nenhuma consulta real acontece.

const tentativas: string[] = []
let respostaPorPlaca: Record<string, 'ok' | '404' | 'erro'> = {}

function erroDoServidor(placa: string, http: number, corpo: string) {
  const e: any = new Error('SENATRAN retornou HTTP ' + http)
  e.http = http
  e.corpo = corpo
  e.trace = [{ etapa: 'SERPRO consulta', placa, http }]
  return e
}

const { comFallbackDePlaca } = await import('./senatran-consulta')

// O dublê no lugar da consulta paga: mTLS, Supabase e hash de consentimento
// nao entram aqui, e nenhuma consulta real acontece.
async function umaConsulta(placa: string) {
  tentativas.push(placa)
  const r = respostaPorPlaca[placa] || '404'
  if (r === 'ok') return { consultaId: 'c-' + placa, ok: true, response: { placa }, trace: [] as any[] }
  if (r === '404') throw erroDoServidor(placa, 404, '{"detail":"Veículo não encontrado"}')
  throw erroDoServidor(placa, 500, '{"detail":"erro interno"}')
}

const consultar = (placa: string, alternativa?: string | null) => comFallbackDePlaca(placa, alternativa, umaConsulta)

beforeEach(() => { tentativas.length = 0; respostaPorPlaca = {} })

describe('404 do registro e a placa no outro formato', () => {
  it('404 na Mercosul, sucesso na antiga: entrega em vez de estorno', async () => {
    respostaPorPlaca = { RJH1C18: '404', RJH1218: 'ok' }
    const r = await consultar('RJH1C18', 'RJH1218')
    expect(tentativas).toEqual(['RJH1C18', 'RJH1218'])
    expect(r.placaConsultada).toBe('RJH1218')
    expect(r.trace[0]).toMatchObject({ etapa: 'placa alternativa', pedida: 'RJH1C18', consultada: 'RJH1218' })
  })

  it('sem alternativa conhecida, converte sozinho', async () => {
    respostaPorPlaca = { QNA9D03: '404', QNA9303: 'ok' }
    const r = await consultar('QNA9D03')
    expect(tentativas).toEqual(['QNA9D03', 'QNA9303'])
    expect(r.placaConsultada).toBe('QNA9303')
  })

  it('404 nos dois formatos continua sendo falha, e so duas tentativas', async () => {
    respostaPorPlaca = { RJH1C18: '404', RJH1218: '404' }
    await expect(consultar('RJH1C18', 'RJH1218')).rejects.toThrow('HTTP 404')
    expect(tentativas).toEqual(['RJH1C18', 'RJH1218'])
  })

  it('erro que nao e placa inexistente nao vira segunda consulta', async () => {
    respostaPorPlaca = { RJH1C18: 'erro' }
    await expect(consultar('RJH1C18', 'RJH1218')).rejects.toThrow('HTTP 500')
    expect(tentativas).toEqual(['RJH1C18'])
  })

  it('placa sem equivalente possivel nao gasta segunda consulta', async () => {
    respostaPorPlaca = { ABC1Z23: '404' }
    await expect(consultar('ABC1Z23')).rejects.toThrow('HTTP 404')
    expect(tentativas).toEqual(['ABC1Z23'])
  })
})

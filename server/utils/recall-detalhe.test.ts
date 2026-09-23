import { describe, it, expect } from 'vitest'
import { parseResultadoRecall, respostaUtil, temRecallPendente, transmissaoDoRecall } from './recall-detalhe'

const campanha = {
  montadora: 'FIAT', campanha: 'ABC123', descricao: 'Airbag do motorista',
  componente: 'Airbag', data_inicio: '2024-03-01', situacao: 'Pendente',
}

describe('leitura da resposta do agente', () => {
  it('JSON puro', () => {
    const d = parseResultadoRecall(JSON.stringify({ status: 'ok', placa: 'OLO2I01', campanhas: [campanha], texto_pagina: 'x' }))
    expect(d?.status).toBe('ok')
    expect(d?.campanhas).toHaveLength(1)
    expect(d?.campanhas[0]!.montadora).toBe('FIAT')
  })

  it('JSON dentro de cerca de codigo', () => {
    const bruto = 'Segue o resultado:\n```json\n' + JSON.stringify({ status: 'sem_recall', placa: 'ABC1D23', campanhas: [] }) + '\n```'
    const d = parseResultadoRecall(bruto)
    expect(d?.status).toBe('sem_recall')
    expect(d?.campanhas).toEqual([])
  })

  it('JSON com frase em volta, sem cerca', () => {
    const d = parseResultadoRecall('Resultado: ' + JSON.stringify({ status: 'ok', campanhas: [campanha] }) + ' fim.')
    expect(d?.status).toBe('ok')
  })

  it('captcha e uma resposta legivel, mas nao e util', () => {
    const d = parseResultadoRecall(JSON.stringify({ status: 'captcha', campanhas: [] }))
    expect(d?.status).toBe('captcha')
    expect(respostaUtil(d)).toBe(false)
  })

  it('sem_recall e util: evita pagar de novo pela mesma placa', () => {
    expect(respostaUtil(parseResultadoRecall(JSON.stringify({ status: 'sem_recall', campanhas: [] })))).toBe(true)
  })

  it('campanha toda vazia e descartada: nao vira linha em branco no relatorio', () => {
    const d = parseResultadoRecall(JSON.stringify({
      status: 'ok',
      campanhas: [campanha, { montadora: '', campanha: '', descricao: '', componente: '', data_inicio: '', situacao: '' }],
    }))
    expect(d?.campanhas).toHaveLength(1)
  })

  it('texto da pagina fica em 600 caracteres', () => {
    const d = parseResultadoRecall(JSON.stringify({ status: 'ok', campanhas: [], texto_pagina: 'a'.repeat(900) }))
    expect(d?.texto_pagina).toHaveLength(600)
  })

  it('resposta ilegivel vale o mesmo que resposta nenhuma', () => {
    expect(parseResultadoRecall('não consegui abrir a página')).toBeNull()
    expect(parseResultadoRecall('')).toBeNull()
    expect(parseResultadoRecall(null)).toBeNull()
    expect(parseResultadoRecall(JSON.stringify({ status: 'qualquer', campanhas: [] }))).toBeNull()
    expect(respostaUtil(null)).toBe(false)
  })
})

describe('quando a entrega vai ao portal', () => {
  // A resposta paga do SENATRAN traz indicadorRecall solto no topo do objeto.
  const comIndicador = (v: any) => ({ indicadorRecall: v })
  // Por seguranca ainda aceitamos o caminho aninhado, caso alguma resposta
  // venha embrulhada em restricoes.
  const aninhado = (v: any) => ({ restricoes: { indicadorRecall: v } })

  it('so com recall pendente no registro', () => {
    expect(temRecallPendente(comIndicador(true))).toBe(true)
    expect(temRecallPendente(comIndicador(false))).toBe(false)
    expect(temRecallPendente({})).toBe(false)
    expect(temRecallPendente(null)).toBe(false)
  })

  it('aceita o indicador tambem no caminho aninhado restricoes', () => {
    expect(temRecallPendente(aninhado(true))).toBe(true)
    expect(temRecallPendente(aninhado(false))).toBe(false)
  })

  it('resposta achatada num array de um elemento tambem conta', () => {
    expect(temRecallPendente([comIndicador(true)])).toBe(true)
    expect(temRecallPendente([comIndicador(false)])).toBe(false)
    expect(temRecallPendente([aninhado(true)])).toBe(true)
  })
})

describe('transmissaoDoRecall (Camada 2: cambio pelo texto do recall)', () => {
  const camp = (descricao: string, componente = '') => ({
    status: 'ok' as const, placa: 'ABC1D23', texto_pagina: null, url_final: null,
    campanhas: [{ montadora: '', campanha: '', descricao, componente, data_inicio: '', situacao: '' }],
  })

  it('caso real Fiat 500: "EQUIPADOS COM CAMBIO MANUAL" vira manual', () => {
    expect(transmissaoDoRecall(camp('POSSIBILIDADE DE FALHA NO SISTEMA DE EMBREAGEM DOS FIAT 500 EQUIPADOS COM CAMBIO MANUAL.'))).toBe('manual')
  })
  it('"transmissão automática" vira automatico', () => {
    expect(transmissaoDoRecall(camp('defeito na transmissão automática do veículo'))).toBe('automatico')
  })
  it('CONSERVADOR: "manual" solto (ex. manual do proprietario) NAO conta', () => {
    expect(transmissaoDoRecall(camp('consulte o manual do proprietário para detalhes'))).toBeNull()
  })
  it('sem sinal de cambio: null', () => {
    expect(transmissaoDoRecall(camp('possível falha no airbag do motorista'))).toBeNull()
    expect(transmissaoDoRecall(null)).toBeNull()
  })
  it('le tambem o texto_pagina', () => {
    expect(transmissaoDoRecall({ status: 'ok', placa: null, url_final: null, campanhas: [], texto_pagina: 'recall do câmbio manual pendente' })).toBe('manual')
  })
})

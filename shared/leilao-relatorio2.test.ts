import { describe, expect, it } from 'vitest'
import {
  sanearOrigem, sanearAlertas, textoAlerta, sanearDesfecho, sanearLotePublico, sanearContextoJudicial, textoJudicial,
  sanearLinhaDoTempoLeilao, sanearRecorrencia, textoIntervalo,
} from './leilao-relatorio2'

describe('leiloes-api, campos do Relatorio 2.0', () => {
  it('origem: so tipo conhecido; desconhecida some', () => {
    expect(sanearOrigem({ tipo: 'detran_patio', base: 'fonte', uf: 'MG', rotulo: 'Apreendido/removido pelo DETRAN (pátio)' })).toEqual({ tipo: 'detran_patio', rotulo: 'Apreendido/removido pelo DETRAN (pátio)', uf: 'MG' })
    expect(sanearOrigem({ tipo: 'aduaneira', base: 'fonte', uf: null, rotulo: 'Aduaneira (Receita Federal)' })!.rotulo).toBe('Aduaneira (Receita Federal)')
    expect(sanearOrigem({ tipo: 'desconhecida', rotulo: 'x' })).toBeNull()
    expect(sanearOrigem({ tipo: 'novo_tipo', rotulo: 'x' })).toBeNull()
  })
  it('alertas: 8 codigos conhecidos, desconhecido some, sempre "declarado no edital"', () => {
    const a = sanearAlertas([{ codigo: 'chassi_remarcado' }, { codigo: 'placas_falsas' }, { codigo: 'renajud_declarado' }, { codigo: 'alienacao_fiduciaria_declarada' }, { codigo: 'cambio_substituido' }, { codigo: 'xpto' }, { codigo: 'chassi_remarcado' }])
    expect(a.map(textoAlerta)).toEqual([
      'Chassi remarcado (declarado no edital)', 'Placas falsas (declarado no edital)', 'RENAJUD declarado no edital',
      'Alienação fiduciária declarada no edital', 'Câmbio substituído (declarado no edital)',
    ])
  })
  it('desfecho: codigo conhecido, sem valor', () => {
    expect(sanearDesfecho({ codigo: 'sem_licitante', data: '2026-05-06', valor: 1000 })).toEqual({ codigo: 'sem_licitante', rotulo: 'Sem licitante (não foi vendido)', data: '2026-05-06' })
    expect(sanearDesfecho({ codigo: 'outro' })).toBeNull()
    expect(sanearDesfecho(null)).toBeNull()
  })
  it('lote publico: url so vivo, https e visto ha ate 30 dias', () => {
    const agora = new Date('2026-10-14T12:00:00Z')
    expect(sanearLotePublico({ url: 'https://exemplo.com/lote/1', vista_em: '2026-10-01', status: 'vivo' }, agora)!.url).toBe('https://exemplo.com/lote/1')
    expect(sanearLotePublico({ url: 'https://exemplo.com/lote/1', vista_em: '2026-08-01', status: 'vivo' }, agora)!.url).toBeNull()
    expect(sanearLotePublico({ url: 'http://exemplo.com/lote/1', vista_em: '2026-10-01', status: 'vivo' }, agora)!.url).toBeNull()
    expect(sanearLotePublico({ url: null, status: 'encerrado_na_casa' }, agora)).toEqual({ url: null, status: 'encerrado_na_casa', vistaEm: null })
    expect(sanearLotePublico({ status: 'xx' }, agora)).toBeNull()
  })
  it('contexto judicial: texto com o que existir; link so de leiloeira conhecida', () => {
    const c = sanearContextoJudicial({ comarca: null, uf: null, data: '2026-05-06', pagina_publica_url: 'https://www.superbid.net/oferta/4611943' })!
    expect(textoJudicial(c)).toBe('Levado a leilão judicial, 06/05/2026')
    expect(c.paginaPublicaUrl).toBe('https://www.superbid.net/oferta/4611943')
    expect(textoJudicial(sanearContextoJudicial({ comarca: 'Comarca Exemplo', uf: 'SP', data: null })!)).toBe('Levado a leilão judicial em Comarca Exemplo/SP')
    expect(sanearContextoJudicial({ pagina_publica_url: 'https://site-qualquer.com/x' })).toBeNull()
  })
  it('linha do tempo e recorrencia da API', () => {
    const l = sanearLinhaDoTempoLeilao([
      { data: '2022-09-20', data_fim: '2022-09-20', tipo: 'notificado', n_passagens: 1, fontes: ['Detran MG'] },
      { data: '2023-01-01', tipo: 'leilao', n_passagens: 2, fontes: ['Leiloeira particular'] },
      { data: '2023-02-01', tipo: 'tipo_novo' },
    ])!
    expect(l.map((e) => e.tipo)).toEqual(['notificado', 'leilao'])
    expect(sanearRecorrencia({ voltou_a_leilao: true, texto: 'Voltou a leilão 7 meses depois', n_leiloes: 2, intervalos_meses: [7] })).toEqual({ voltouALeilao: true, texto: 'Voltou a leilão 7 meses depois', nLeiloes: 2, intervalosMeses: [7] })
    expect(sanearRecorrencia({ voltou_a_leilao: false, texto: 'x' })!.texto).toBeNull()
    expect(textoIntervalo(7)).toBe('voltou a leilão 7 meses depois')
    expect(textoIntervalo(84)).toBe('voltou a leilão 7 anos depois')
    expect(textoIntervalo(30)).toBe('voltou a leilão 2,5 anos depois')
  })
})

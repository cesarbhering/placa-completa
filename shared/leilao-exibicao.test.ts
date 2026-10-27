import { describe, it, expect } from 'vitest'
import { detalhesLegiveis, semValorEmReais, ROTULO_DETALHE, fonteExibicaoLeilao, passagensSemCanhao } from './leilao-exibicao'

describe('card de leilao sem valor em R$ (decisao 01/out)', () => {
  it('valor_final nao e rotulo exibido', () => {
    expect(Object.keys(ROTULO_DETALHE)).not.toContain('valor_final')
    expect(Object.keys(ROTULO_DETALHE)).not.toContain('valor')
  })
  it('snapshot antigo com valor_final/valor: nao aparece', () => {
    const d = detalhesLegiveis({ sinistro: true, valor_final: 'R$ 18.500,00', valor: 18500, monta: 'Media' })
    expect(d).toEqual([{ rotulo: 'Monta', valor: 'Média' }, { rotulo: 'Sinistro', valor: 'Sim' }])
    expect(JSON.stringify(d)).not.toMatch(/R\$|18\.?500/)
  })
  it('observacao com lance em R$: o trecho sai, o resto fica', () => {
    expect(semValorEmReais('Veiculo com chave. Lance inicial: R$ 12.000,00. Documento ok')).toBe('Veiculo com chave. Documento ok')
    expect(semValorEmReais('Lance minimo R$ 5.000')).toBeNull()
    expect(semValorEmReais('Motor nao funciona - lance de R$ 3.200,00')).toBe('Motor nao funciona')
    expect(semValorEmReais('avaliado em 15000 reais')).toBeNull()
    const d = detalhesLegiveis({ observacao: 'Lance: R$ 9.900,00' })
    expect(d).toEqual([])
  })
  it('texto sem R$ passa igual', () => {
    expect(semValorEmReais('Sem chave; pneus carecas')).toBe('Sem chave; pneus carecas')
  })
})

describe('card de passagem: gravidade e detalhes (18/out/2026, caso GDL8A24)', () => {
  const det = { km: 6978, status: 'encerrado', sucata: false, condicao: 'SINISTRADO MEDIA MONTA', desfecho: 'vendido', judicial: false, combustivel: 'FLEX', possui_chave: true, subcategoria: 'Veículos Sinistrados' }
  it('lista rotulo e valor na ordem, sem status, com acento e km comparado', async () => {
    const { detalhesLegiveis } = await import('./leilao-exibicao')
    const d = detalhesLegiveis(det, { kmAtual: { km: 29418, data: '2026-07-27' }, dataLeilao: '2024-04-05', semDesfecho: true })
    expect(d.map((x) => `${x.rotulo}: ${x.valor}`.replace(/\s/g, ' '))).toEqual([
      'Condição: Sinistrado média monta',
      'Km no leilão: 6.978 km; hoje 29.418 km (leitura de 27/07/2026), 22.440 km rodados desde o leilão',
      'Chave: Sim',
      'Categoria: Veículos Sinistrados',
      'Combustível: Flex',
      'Sucata: Não',
      'Leilão judicial: Não',
    ])
  })
  it('km atual MENOR que o do leilao vira alerta; leitura anterior ao leilao nao compara', async () => {
    const { detalhesLegiveis } = await import('./leilao-exibicao')
    expect(detalhesLegiveis({ km: 50000 }, { kmAtual: { km: 30000, data: '2026-01-01' }, dataLeilao: '2024-01-01' })[0].valor).toMatch(/MENOR que a do leilão/)
    expect(detalhesLegiveis({ km: 50000 }, { kmAtual: { km: 30000, data: '2023-01-01' }, dataLeilao: '2024-01-01' })[0].valor.replace(/\s/g, ' ')).toBe('50.000 km')
  })
  it('campo vazio nao aparece; categoria e subcategoria nao repetem', async () => {
    const { detalhesLegiveis } = await import('./leilao-exibicao')
    expect(detalhesLegiveis({ km: '', possui_chave: null, subcategoria: 'Hatches', categoria: 'Carros' }).map((x) => x.rotulo)).toEqual(['Categoria'])
  })
  it('explicacao por gravidade, sem travessao; desconhecida sem texto', async () => {
    const { explicaGravidade, EXPLICA_GRAVIDADE } = await import('./leilao-exibicao')
    expect(explicaGravidade('media_monta')).toMatch(/declarada pela leiloeira: dano em 2 a 6 peças.*CSV.*"Sinistrado" ou "DMM"/)
    expect(explicaGravidade('desconhecido')).toBeNull()
    for (const t of Object.values(EXPLICA_GRAVIDADE)) expect(t).not.toContain('—')
  })
  it('evidencias com acento', async () => {
    const { comAcentos } = await import('./leilao-exibicao')
    expect(['modelo compativel', 'ano de fabricacao igual', 'UF diferente'].map(comAcentos)).toEqual(['modelo compatível', 'ano de fabricação igual', 'UF diferente'])
  })
})

describe('aviso de fotos chegando nos cards de todos os niveis (18/out/2026)', () => {
  it('confirmado/provavel e possivel tem o aviso "Buscando fotos do anúncio…"', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect((vue.match(/v-else-if="p\.fotosPendente"[^>]*>Buscando fotos do anúncio…/g) || []).length).toBe(2)
  })
})

describe('passagensSemCanhao', () => {
  const detran = { fonte: 'detran_mg', fonte_tipo: 'detran', fonte_exibicao: 'Detran MG', lote: '11', nivel: 'confirmado' }
  const canhao = { fonte: 'canhao:leilao.detran.mg.gov.br', fonte_tipo: 'privado', fonte_exibicao: 'Canhao:leilao.detran.mg.gov.br', lote: '11', nivel: 'confirmado' }

  it('tira o lote do canhao que repete a coleta do orgao (HIY1244)', () => {
    const r = passagensSemCanhao([detran, canhao, { fonte: 'sodre', fonte_tipo: 'privado', lote: '0238' }])
    expect(r.map((p) => p.fonte)).toEqual(['detran_mg', 'sodre'])
  })

  it('edital de DETRAN so do canhao vira Detran UF, orgao oficial', () => {
    const [p] = passagensSemCanhao([{ ...canhao, lote: '12' }])
    expect(p).toMatchObject({ fonte: 'detran_mg', fonte_tipo: 'detran' })
    expect(fonteExibicaoLeilao(p)).toBe('Detran MG')
  })

  it('outro dominio mostra o dominio, nunca "canhao"', () => {
    const [p] = passagensSemCanhao([{ fonte: 'canhao:www.exemplo.com.br', fonte_tipo: 'privado', fonte_exibicao: 'Canhao:www.exemplo.com.br' }])
    expect(fonteExibicaoLeilao(p)).toBe('exemplo.com.br')
  })
})

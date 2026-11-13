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
    expect(explicaGravidade('com_documento')).toMatch(/vendido com documento/)
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

  it('other domain never shows the host nor "canhao": generic label', () => {
    const [p] = passagensSemCanhao([{ fonte: 'canhao:www.exemplo.com.br', fonte_tipo: 'privado', fonte_exibicao: 'Canhao:www.exemplo.com.br' }])
    expect(fonteExibicaoLeilao(p)).toBe('Leiloeira particular')
  })
})


// ---------- One card per auction (13/11/2026) ----------
import { historicoParaExibicao, fonteInterna } from './leilao-exibicao'
import { juntarNotificacoes, linhaNotificacao } from './leilao-notificacao'

const PARECE_HOST = /[a-z0-9]\.[a-z]{2,}(?![a-z])|:\/\/|canh[aã]o/i

describe('source label never shows a host or an internal name', () => {
  it('canhao passage uses the approved name from the API', () => {
    expect(fonteExibicaoLeilao({ fonte: 'canhao:cdn.exemplo-leiloes.com.br', fonte_tipo: 'privado', fonte_exibicao: 'Exemplo Leilões' })).toBe('Exemplo Leilões')
    expect(fonteExibicaoLeilao({ fonte: 'sodre', fonte_tipo: 'privado', fonte_exibicao: 'Exemplo Leilões', via_canhao: true } as any)).toBe('Exemplo Leilões')
  })

  it('canhao passage without an approved name is "Leiloeira particular"', () => {
    for (const fonte_exibicao of [null, '', 'Leiloeira particular', 'Canhao:cdn.exemplo.net', 'cdn.exemplo.net', 'https://exemplo.com.br/x']) {
      expect(fonteExibicaoLeilao({ fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', fonte_exibicao })).toBe('Leiloeira particular')
    }
  })

  it('no path returns host, URL or "canhao" text', () => {
    const casos: any[] = [
      { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado' },
      { fonte: 'canhao:cdn.exemplo.net' },
      { fonte: 'exemplo.com.br', fonte_tipo: 'privado' },
      { fonte: 'casa_x', fonte_tipo: 'privado', fonte_exibicao: 'www.casax.com.br' },
      { fonte: 'detran_mg', fonte_tipo: 'detran', fonte_exibicao: 'Canhao:leilao.detran.mg.gov.br' },
      { fonte: 'canhao', fonte_tipo: 'privado' },
    ]
    for (const c of casos) {
      const r = fonteExibicaoLeilao(c)
      expect(r, JSON.stringify(c)).not.toMatch(PARECE_HOST)
      expect(r).toBeTruthy()
    }
    // Detran with an internal display name still gets the agency name.
    expect(fonteExibicaoLeilao({ fonte: 'detran_mg', fonte_tipo: 'detran', fonte_exibicao: 'Canhao:leilao.detran.mg.gov.br' })).toBe('Detran MG')
  })

  it('fonteInterna flags hosts, URLs and the internal name, not agency or house names', () => {
    expect(fonteInterna('cdn.exemplo.net')).toBe(true)
    expect(fonteInterna('https://x.com')).toBe(true)
    expect(fonteInterna('Canhao:algo')).toBe(true)
    expect(fonteInterna('Detran MG')).toBe(false)
    expect(fonteInterna('Exemplo Leilões S.A.')).toBe(false)
  })
})

describe('same auction from two sources is one card', () => {
  it('canhao passage drops when a direct one has the same lot and auction date, any source type', () => {
    const direta = { fonte: 'casa_x', fonte_tipo: 'privado', lote: '0042', data_leilao: '2026-03-10T00:00:00Z', nivel: 'confirmado' }
    const canhao = { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', lote: '42', data_leilao: '2026-03-10', nivel: 'confirmado' }
    expect(passagensSemCanhao([direta, canhao]).map((p) => p.fonte)).toEqual(['casa_x'])
  })

  it('different date or different lot keeps both', () => {
    const direta = { fonte: 'casa_x', fonte_tipo: 'privado', lote: '42', data_leilao: '2026-03-10', nivel: 'confirmado' }
    expect(passagensSemCanhao([direta, { fonte: 'canhao:cdn.exemplo.net', lote: '42', data_leilao: '2026-04-10' }])).toHaveLength(2)
    expect(passagensSemCanhao([direta, { fonte: 'canhao:cdn.exemplo.net', lote: '43', data_leilao: '2026-03-10' }])).toHaveLength(2)
    expect(passagensSemCanhao([direta, { fonte: 'canhao:cdn.exemplo.net', lote: '42', data_leilao: null }])).toHaveLength(2)
  })

  it('canhao passage alone still shows', () => {
    const r = passagensSemCanhao([{ fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', lote: '42', data_leilao: '2026-03-10' }])
    expect(r).toHaveLength(1)
    expect(fonteExibicaoLeilao(r[0])).toBe('Leiloeira particular')
  })
})

describe('auction notice joins the card of the same agency auction', () => {
  const leilao = { fonte: 'detran_xx', fonte_tipo: 'detran', fonte_uf: 'XX', nivel: 'confirmado', lote: '7', data_leilao: '2026-05-20', detalhes: {} }
  const notif = {
    fonte: 'detran_xx', fonte_tipo: 'detran', fonte_uf: 'XX', nivel: 'confirmado', situacao: 'notificado', data_leilao: '2026-04-01',
    detalhes: { tipo_registro: 'notificacao_leilao', edital_numero: '12/2026', data_publicacao: '2026-04-01', tipo_notificacao: 'Recuperável', orgao: 'DETRAN-XX' },
  }

  it('old snapshot: two passages become the auction card with the notice line', () => {
    const r = juntarNotificacoes([notif, leilao])
    expect(r).toHaveLength(1)
    expect(r[0].lote).toBe('7')
    expect(r[0].detalhes.notificacao).toEqual({ orgao: 'DETRAN-XX', edital_numero: '12/2026', data_publicacao: '2026-04-01', tipo_notificacao: 'Recuperável' })
    expect(linhaNotificacao(r[0])).toBe('Notificado em 01/04/2026 (edital 12/2026)')
  })

  it('new API contract: same line from detalhes.notificacao', () => {
    const novo = { ...leilao, detalhes: { notificacao: { orgao: 'DETRAN-XX', edital_numero: '12/2026', data_publicacao: '2026-04-01' } } }
    expect(juntarNotificacoes([novo])).toHaveLength(1)
    expect(linhaNotificacao(novo)).toBe('Notificado em 01/04/2026 (edital 12/2026)')
    expect(linhaNotificacao({ detalhes: { notificacao: { data_publicacao: '2026-04-01' } } })).toBe('Notificado em 01/04/2026')
    expect(linhaNotificacao({ detalhes: { notificacao: { edital_numero: '12/2026' } } })).toBe('Notificado (edital 12/2026)')
    expect(linhaNotificacao(leilao)).toBeNull()
  })

  it('new API contract plus a leftover notice passage: still one card', () => {
    const novo = { ...leilao, detalhes: { notificacao: { data_publicacao: '2026-04-01' } } }
    expect(juntarNotificacoes([notif, novo])).toHaveLength(1)
  })

  it('in doubt it does not join', () => {
    // different agency
    expect(juntarNotificacoes([notif, { ...leilao, fonte: 'detran_yy' }])).toHaveLength(2)
    // auction before the notice
    expect(juntarNotificacoes([notif, { ...leilao, data_leilao: '2026-03-01' }])).toHaveLength(2)
    // auction without a date
    expect(juntarNotificacoes([notif, { ...leilao, data_leilao: null }])).toHaveLength(2)
    // another candidate of the same agency without a date
    expect(juntarNotificacoes([notif, leilao, { ...leilao, lote: '8', data_leilao: null }])).toHaveLength(3)
    // notice without publication date
    expect(juntarNotificacoes([{ ...notif, data_leilao: null, detalhes: { tipo_registro: 'notificacao_leilao' } }, leilao])).toHaveLength(2)
    // notice alone keeps its own card
    expect(juntarNotificacoes([notif])).toHaveLength(1)
  })

  it('with several dated auctions it joins the first one on or after the notice', () => {
    const depois = { ...leilao, lote: '9', data_leilao: '2026-09-01' }
    const r = juntarNotificacoes([notif, depois, leilao])
    expect(r).toHaveLength(2)
    expect(r.find((p) => p.lote === '7')?.detalhes.notificacao).toBeTruthy()
    expect(r.find((p) => p.lote === '9')?.detalhes.notificacao).toBeUndefined()
  })

  it('does not mutate the snapshot passages', () => {
    const l = { ...leilao, detalhes: {} }
    juntarNotificacoes([notif, l])
    expect(l.detalhes).toEqual({})
  })
})

describe('real shape: Detran edital + canhao document + notice end as one card', () => {
  const h = {
    resumo: { tem_indicio: true, nivel_max: 'confirmado', n_confirmado: 3, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: ['detran_xx', 'canhao:cdn.exemplo-cdn.net'] },
    passagens: [
      { fonte: 'detran_xx', fonte_tipo: 'detran', fonte_uf: 'XX', fonte_exibicao: 'Detran XX', nivel: 'confirmado', lote: '0315', data_leilao: '2026-06-18', ref: '99/2026', leiloeiro: 'Fulano de Exemplo', detalhes: {} },
      { fonte: 'canhao:cdn.exemplo-cdn.net', fonte_tipo: 'privado', fonte_exibicao: 'Canhao:cdn.exemplo-cdn.net', nivel: 'confirmado', lote: '315', data_leilao: '2026-06-18T03:00:00Z', detalhes: {} },
      { fonte: 'detran_xx', fonte_tipo: 'detran', fonte_uf: 'XX', fonte_exibicao: 'Detran XX', nivel: 'confirmado', situacao: 'notificado', data_leilao: '2026-05-02',
        detalhes: { tipo_registro: 'notificacao_leilao', edital_numero: '41/2026', data_publicacao: '2026-05-02', orgao: 'DETRAN-XX' } },
    ],
    linha_do_tempo: [
      { data: '2026-05-02', dataFim: null, tipo: 'notificado', nPassagens: 1, fontes: ['Detran XX'] },
      { data: '2026-06-18', dataFim: null, tipo: 'leilao', nPassagens: 2, fontes: ['Detran XX', 'Canhao:cdn.exemplo-cdn.net'] },
    ],
    recorrencia: null,
  }

  it('one card with the notice line, counts and timeline consistent', () => {
    const r: any = historicoParaExibicao(h)
    expect(r.passagens).toHaveLength(1)
    const [p] = r.passagens
    expect(fonteExibicaoLeilao(p)).toBe('Detran XX')
    expect(linhaNotificacao(p)).toBe('Notificado em 02/05/2026 (edital 41/2026)')
    expect(r.resumo.n_confirmado).toBe(1)
    expect(r.resumo.fontes_com_passagem).toEqual(['detran_xx'])
    // API timeline counted the removed passages: the page rebuilds it per card.
    expect(r.linha_do_tempo).toBeNull()
    expect(JSON.stringify(r.passagens.map(fonteExibicaoLeilao))).not.toMatch(PARECE_HOST)
    // snapshot untouched
    expect(h.passagens).toHaveLength(3)
  })

  it('nothing removed: same object, timeline sources cleaned of internal names', () => {
    const so = { ...h, passagens: [h.passagens[0]], linha_do_tempo: [{ data: '2026-06-18', dataFim: null, tipo: 'leilao', nPassagens: 1, fontes: ['Detran XX', 'Canhao:cdn.exemplo-cdn.net', 'cdn.exemplo-cdn.net'] }] }
    const r: any = historicoParaExibicao(so)
    expect(r.passagens).toHaveLength(1)
    expect(r.linha_do_tempo[0].fontes).toEqual(['Detran XX', 'Leiloeira particular'])
  })
})

describe('page wiring for one card per auction', () => {
  it('page builds the history through historicoParaExibicao and the card shows the notice line', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect(vue).toMatch(/historicoNaTela\(h, \{ modelo: g\('descricaoMarcaModelo'\)/)
    expect(vue).toMatch(/linhaNotificacao: ehNotificacao\(p\) \? null : linhaNotificacao\(p\)/)
    const ficha = readFileSync(join(process.cwd(), 'components/LeilaoFicha.vue'), 'utf8')
    expect(ficha).toMatch(/k: 'Notificação', v: String\(p\.value\.linhaNotificacao\)/)
  })
})

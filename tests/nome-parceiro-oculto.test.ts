import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import REAL from '../server/utils/__fixtures__/parceiro-leilao-real.json'
import { parsearRespostaParceiro, historicoComParceiro } from '../shared/fonte-parceira'
import { historicoLgpd } from '../shared/leilao-lgpd'
import { NOME_FORNECEDOR_RE } from '../server/utils/parceiro-leilao-env'

// Decisao do Cesar (20/out/2026): o nome do fornecedor da base parceira de
// leiloes e sinistros NUNCA aparece em nada publico. So no codigo interno do
// servidor, em premium_custos, fonte_cache e logs.
const NOME = NOME_FORNECEDOR_RE

function arquivos(dir: string, filtro: (f: string) => boolean = () => true): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...arquivos(p, filtro))
    else if (filtro(p)) out.push(p)
  }
  return out
}

describe('nome do fornecedor da base parceira fora de tudo que e publico', () => {
  it('pages/, components/, shared/, e-mails e agente de WhatsApp', () => {
    const alvos = [
      ...arquivos('pages'), ...arquivos('components'), ...arquivos('shared'),
      ...arquivos('server/utils', (f) => /email/i.test(f)), ...arquivos('server/utils/suporte'),
    ].filter((f) => /\.(vue|ts|js|md|html)$/.test(f))
    const comNome = alvos.filter((f) => NOME.test(readFileSync(f, 'utf8')))
    expect(comNome).toEqual([])
  })
  it('o historico que vai no JSON do relatorio nao carrega o nome', () => {
    const r = parsearRespostaParceiro(REAL)!
    const h = historicoLgpd(historicoComParceiro({ resumo: { tem_indicio: false }, passagens: [] }, r, { chassi: null, tipo: 'placa', consultadoEm: '2026-10-20T19:00:00Z' }))
    expect(JSON.stringify(h)).not.toMatch(NOME)
  })
})

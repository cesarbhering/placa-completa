// Test harness for the free lookup handler (server/api/consulta.post.ts).
//
// The handler leans on Nuxt auto-imports and on a handful of modules that
// reach the network (plate source, FIPE, e-mail, WhatsApp, renderer). This
// file stubs the auto-imports, mocks the network modules and keeps the limit
// logic REAL (whitelist, gate, per-IP cap) on top of an in-memory database, so
// a test exercises the same code path production runs.
//
// Every address, plate and e-mail here is fictitious (documentation ranges).
import { vi } from 'vitest'
import { supabaseMemoria } from './supabase-memoria'

export const PLACA_TESTE = 'TST1A23'
export const UA_NAVEGADOR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/** A found vehicle with one FIPE entry, enough for every block of the e-mail. */
export function veiculoTeste(extra: Record<string, any> = {}) {
  return {
    MARCA: 'MARCA', MODELO: 'MODELO TESTE', ano: '2020', anoModelo: '2021', cor: 'Prata',
    situacao: 'Sem restrição', origem: 'NACIONAL', chassi: '*****12345', municipio: 'Cidade', uf: 'SP',
    extra: { combustivel: 'Flex', especie: 'Passageiro', tipo_veiculo: 'Automovel', quantidade_passageiro: '5', sub_segmento: 'HATCH' },
    fipe: { dados: [{ score: 1, texto_valor: 'R$ 50.000,00', texto_modelo: 'MODELO TESTE 1.0', mes_referencia: 'novembro de 2026', codigo_modelo: null }] },
    ...extra,
  }
}

export interface OpcoesHarness {
  /** Runtime config overrides (merged over the defaults below). */
  config?: Record<string, any>
  /** Rows of rate_limit_whitelist. */
  whitelist?: { recipient: string; hourly_limit: number | null }[]
  /** What the plate source answers. Default: a found vehicle. */
  veiculo?: any
  /** Delay of the paid lookup in ms (lets concurrent requests overlap). */
  atrasoConsultaMs?: number
  /** Extra module mocks: path (with the `~` alias) -> factory. */
  mocks?: Record<string, (original: any) => any>
}

export async function montarConsulta(opts: OpcoesHarness = {}) {
  vi.resetModules()
  const agora = () => ({ created_at: new Date().toISOString() })
  const sb = supabaseMemoria({ padroes: { consultas: agora, wdapi_preview_calls: agora, blocked_requests: agora } })
  const premium = supabaseMemoria()
  for (const linha of opts.whitelist || []) sb.tab('rate_limit_whitelist').push({ ...linha })

  const estado = {
    /** Calls that reached the plate source (the paid call). */
    consultasPagas: 0,
    emails: [] as any[],
    alertas: [] as any[],
    htmlRenderizado: [] as string[],
    whatsapp: [] as any[],
  }
  const config: any = {
    public: { homolog: false, gated: false, whatsappEnabled: false },
    resendApiKey: 're_test', turnstileMode: 'off', turnstileSecret: '',
    consultaGratisSemEmail: '', gotenbergUrl: '',
    ...(opts.config || {}),
  }
  if (opts.config?.public) config.public = { homolog: false, gated: false, whatsappEnabled: false, ...opts.config.public }

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('readBody', async (event: any) => event.corpo)
  vi.stubGlobal('getRequestHeaders', (event: any) => event.cabecalhos || {})
  vi.stubGlobal('getRequestHeader', (event: any, nome: string) => (event.cabecalhos || {})[nome])
  vi.stubGlobal('getCookie', () => undefined)
  vi.stubGlobal('setHeader', () => {})
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useSupabaseServer', () => sb)
  vi.stubGlobal('usePremiumSupabase', () => premium)
  vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('network is off in tests') }))
  vi.stubGlobal('sendErrorEmail', async (d: any) => { estado.alertas.push(d) })
  vi.stubGlobal('avisarAbuso', async () => {})
  vi.stubGlobal('contarBloqueiosNaHora', async () => 0)

  vi.doMock('resend', () => ({ Resend: class { emails = { send: async (m: any) => { estado.emails.push(m); return { data: { id: 'e1' }, error: null } } } } }))
  vi.doMock('~/server/utils/supabase', () => ({ useSupabaseServer: () => sb }))
  vi.doMock('~/server/utils/placa-lookup', async (importOriginal: any) => ({
    ...(await importOriginal()),
    consultarPlacaWdapiDetalhado: async () => {
      estado.consultasPagas++
      if (opts.atrasoConsultaMs) await new Promise((r) => setTimeout(r, opts.atrasoConsultaMs))
      const payload = opts.veiculo === undefined ? veiculoTeste() : opts.veiculo
      return { payload, cacheHit: false, fonte: payload ? 'placafipe' : null }
    },
  }))
  vi.doMock('~/server/utils/email-deliverability', () => ({ checkEmailDeliverability: async () => ({ ok: true }) }))
  vi.doMock('~/server/utils/fipe-api', () => ({ fipePriceHistory: async () => ({ bruto: null }), fipeSeguroEstimado: async () => null }))
  vi.doMock('~/server/utils/seguro-estimate', () => ({ getSeguroEstimado: async () => null }))
  vi.doMock('~/server/utils/ip-geo', () => ({ lookupIpGeo: async () => null }))
  vi.doMock('~/server/utils/evolutionApi', () => ({
    normalizePhoneForWhatsApp: (p: string) => { const d = String(p).replace(/\D/g, ''); return d.length >= 10 ? (d.startsWith('55') ? d : `55${d}`) : null },
    sendWhatsAppText: async (...a: any[]) => { estado.whatsapp.push(a); return { ok: true, status: 200 } },
    sendWhatsAppImage: async (...a: any[]) => { estado.whatsapp.push(a); return { ok: true, status: 200 } },
  }))
  vi.doMock('~/server/utils/htmlToImage', () => ({
    renderHtmlToPng: async (html: string) => { estado.htmlRenderizado.push(html); return { ok: true, bytes: Buffer.from('png'), status: 200, durationMs: 1 } },
  }))
  for (const [caminho, fabrica] of Object.entries(opts.mocks || {})) {
    vi.doMock(caminho, async (importOriginal: any) => fabrica(await importOriginal()))
  }

  // Auto-imports that are real code: resolved after the mocks are in place.
  const { escapeHtml } = await import('~/server/utils/htmlEscape')
  const { estaBloqueado } = await import('~/server/utils/blocklist')
  const limiteIp = await import('~/server/utils/ip-wdapi-limit')
  vi.stubGlobal('escapeHtml', escapeHtml)
  vi.stubGlobal('estaBloqueado', estaBloqueado)
  vi.stubGlobal('checarLimiteIpWdapi', limiteIp.checarLimiteIpWdapi)
  vi.stubGlobal('registrarChamadaPreviewWdapi', limiteIp.registrarChamadaPreviewWdapi)

  const handler = (await import('~/server/api/consulta.post')).default as (event: any) => Promise<any>

  /** One request. `ip` goes in the header the edge sets; pass null for none. */
  async function chamar(corpo: Record<string, any> = {}, o: { ip?: string | null; ua?: string; cabecalhos?: Record<string, string> } = {}) {
    const ip = o.ip === undefined ? '203.0.113.10' : o.ip
    const cabecalhos: Record<string, string> = { 'user-agent': o.ua ?? UA_NAVEGADOR, ...(o.cabecalhos || {}) }
    if (ip) cabecalhos['cf-connecting-ip'] = ip
    return handler({ corpo: { placa: PLACA_TESTE, channel: 'tela', ...corpo }, cabecalhos })
  }

  /** Same as `chamar`, but returns the thrown error instead of throwing. */
  async function tentar(corpo: Record<string, any> = {}, o: Parameters<typeof chamar>[1] = {}) {
    try { return { ok: true as const, resposta: await chamar(corpo, o), erro: null as any } }
    catch (erro: any) { return { ok: false as const, resposta: null as any, erro } }
  }

  /** Seeds past lookups straight into the table (what the counts read). */
  function semear(n: number, linha: Record<string, any> = {}, minutosAtras = 10) {
    for (let i = 0; i < n; i++) {
      sb.tab('consultas').push({
        id: `seed-${sb.tab('consultas').length}`,
        created_at: new Date(Date.now() - minutosAtras * 60_000).toISOString(),
        ip_address: '203.0.113.10', channel: 'tela', email: null, phone: null, placa: PLACA_TESTE,
        email_sent: false, whatsapp_sent: false, device_id: null,
        ...linha,
      })
    }
  }

  return { handler, chamar, tentar, semear, sb, premium, estado, config }
}

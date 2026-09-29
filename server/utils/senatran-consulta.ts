import https from 'node:https'
import { placaParaSegundaTentativa } from '../../shared/placa-formato'

// Consulta SENATRAN server-side (homologacao), disparada APOS pagamento
// confirmado. Fluxo: pega a chave GCC ativa -> gera hash de consentimento
// (pago) -> consulta o veiculo no SERPRO gastando o hash (mTLS). Grava tudo no
// Supabase de homologacao. NUNCA chamar de superficie gratuita.

export type Ambiente = 'homolog' | 'producao'

function pemFromEnv(v: string): Buffer | null {
  if (!v) return null
  const s = v.includes('BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8')
  return Buffer.from(s)
}

// Resolve o conjunto de config (GCC + SERPRO) por ambiente. Prod REUSA cert/key
// de homolog quando os de prod estao vazios; cnpj/template idem (fallback).
export function configPorAmbiente(config: any, ambiente: Ambiente) {
  if (ambiente === 'producao') {
    return {
      gccBase: String(config.gccBaseProd || ''),
      senatranUrl: String(config.senatranUrlProd || ''),
      cnpj: String(config.senatranCnpjProvedorProd || config.senatranCnpjProvedor || ''),
      template: String(config.senatranTemplateIdProd || config.senatranTemplateId || ''),
      certPem: String(config.senatranCertPemProd || config.senatranCertPem || ''),
      keyPem: String(config.senatranKeyPemProd || config.senatranKeyPem || ''),
    }
  }
  return {
    gccBase: String(config.gccBase || ''),
    senatranUrl: String(config.senatranUrl || ''),
    cnpj: String(config.senatranCnpjProvedor || ''),
    template: String(config.senatranTemplateId || ''),
    certPem: String(config.senatranCertPem || ''),
    keyPem: String(config.senatranKeyPem || ''),
  }
}

// Todas as chaves candidatas do ambiente pedido, da mais nova pra mais antiga.
// Lista, e nao uma: ja aconteceu de a chave MAIS RECENTE estar expirada no GCC
// com uma valida logo atras. Preso na primeira, o fluxo estornava pedido
// pagavel. O filtro por ambiente so RESTRINGE o conjunto; NUNCA cai pra chave
// de outro ambiente.
export async function chavesCandidatas(supabase: any, ambiente: Ambiente): Promise<{ id: string; api_key: string }[]> {
  const { data } = await supabase.from('gcc_api_keys').select('id,api_key').eq('ambiente', ambiente).eq('status', 'active').order('created_at', { ascending: false })
  if (data && data.length) return data
  const { data: todas } = await supabase.from('gcc_api_keys').select('id,api_key').eq('ambiente', ambiente).order('created_at', { ascending: false }).limit(1)
  return todas || []
}

export function findHash(obj: any): string | null {
  let found: string | null = null
  const walk = (o: any) => {
    if (found || o == null || typeof o !== 'object') return
    for (const k of Object.keys(o)) {
      if (/numero_hash_consulta/i.test(k) && typeof o[k] === 'string') { found = o[k]; return }
      walk(o[k])
    }
  }
  walk(obj)
  return found
}

function senatranGet(opts: { url: string; placa: string; hash: string; cert: Buffer; key: Buffer }): Promise<{ status: number; body: string }> {
  const certEncoded = encodeURIComponent(opts.cert.toString())
  const u = new URL(`${opts.url}?placa=${encodeURIComponent(opts.placa)}&pagina=1`)
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: 'GET', hostname: u.hostname, port: 443, path: u.pathname + u.search, cert: opts.cert, key: opts.key, headers: { accept: '*/*', 'x-ssl-client-cert': certEncoded, 'x-jwt': opts.hash } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode || 0, body: b })) },
    )
    req.on('error', reject)
    req.end()
  })
}

// Executa a consulta paga. Retorna o id da linha em senatran_consultas + o dado.
// ambiente ausente => 'homolog' (comportamento identico ao de hoje).
//
// Uma oscilacao de rede da VPS derrubou o POST do consentimento e um cliente
// que tinha acabado de pagar levou estorno em vez do relatorio. Por isso a
// consulta agora e tentada de novo quando a falha e de TRANSPORTE:
//   - dentro de uma tentativa, cada chamada externa insiste sozinha (o
//     consentimento ate 3 vezes, a consulta ao SERPRO 2 vezes com o MESMO
//     hash, que e barato e seguro enquanto o hash nao foi gasto);
//   - se ainda assim a tentativa morrer de rede, o fluxo INTEIRO recomeca uma
//     vez, com consentimento novo. Isso custa um hash, e o Cesar autorizou:
//     perder a venda de quem ja pagou custa mais.
// Falha de negocio (401, 4xx, SENATRAN respondeu erro) nunca e repetida.
/**
 * "Veiculo nao encontrado" com a placa no outro formato. Um pedido pago caiu
 * assim: a consulta gratis achou a moto como RJH1218 (antiga) e a consulta
 * paga perguntou por RJH1C18 (Mercosul) e levou 404. O registro converte
 * antiga para Mercosul, mas nem sempre o contrario.
 */
export function ehPlacaNaoEncontrada(e: any): boolean {
  if (e?.http !== 404) return false
  const corpo = String(e?.corpo || '')
  return /n[aã]o\s+encontrado/i.test(corpo) || corpo === ''
}

/**
 * A decisao de tentar de novo, isolada de mTLS, Supabase e runtimeConfig: quem
 * executa a consulta entra por parametro. Assim a regra que evitou o estorno
 * pode ser testada sem nenhuma consulta paga.
 */
export async function comFallbackDePlaca<T extends { trace: any[] }>(
  placa: string,
  alternativaConhecida: string | null | undefined,
  executar: (placa: string) => Promise<T>,
): Promise<T & { placaConsultada: string }> {
  try {
    const r = await executar(placa)
    return { ...r, placaConsultada: placa }
  } catch (e: any) {
    // Placa que o registro nao conhece NESTE formato: tenta uma unica vez no
    // outro antes de declarar falha, porque o proximo passo seria estornar a
    // venda de um veiculo que existe.
    if (!ehPlacaNaoEncontrada(e)) throw e
    const outra = placaParaSegundaTentativa(placa, alternativaConhecida)
    if (!outra) throw e
    console.warn(`[senatran] ${placa} nao encontrada; tentando no outro formato: ${outra}`)
    try {
      const r = await executar(outra)
      // O trace guarda os dois formatos: sem isso, a proxima investigacao
      // comeca sem saber que houve troca de placa no meio.
      r.trace.unshift({ etapa: 'placa alternativa', pedida: placa, consultada: outra, motivo: 'registro respondeu nao encontrado para a placa pedida' })
      return { ...r, placaConsultada: outra }
    } catch (e2: any) {
      ;(e2 as any).trace = [
        { etapa: 'placa alternativa', pedida: placa, consultada: outra, resultado: 'tambem nao encontrada' },
        ...((e as any).trace || []),
        ...((e2 as any).trace || []),
      ]
      throw e2
    }
  }
}

export async function consultarSenatran(
  placa: string,
  ambiente: Ambiente = 'homolog',
  // Placa equivalente vista na consulta gratis. Dado observado vale mais do
  // que conversao, entao ela tem preferencia na segunda tentativa.
  opts: { placaAlternativa?: string | null } = {},
): Promise<{ consultaId: string; ok: boolean; response: any; trace: any[]; placaConsultada: string }> {
  return comFallbackDePlaca(placa, opts.placaAlternativa, (p) => umaConsultaComRetryDeRede(p, ambiente))
}

async function umaConsultaComRetryDeRede(placa: string, ambiente: Ambiente): Promise<{ consultaId: string; ok: boolean; response: any; trace: any[] }> {
  try {
    return await tentativaDeConsulta(placa, ambiente)
  } catch (e: any) {
    if (!ehErroDeRede(e)) throw e
    console.warn('[senatran] tentativa caiu por rede; refazendo com consentimento novo:', e?.message || e)
    await esperar(5000)
    return await tentativaDeConsulta(placa, ambiente)
  }
}

async function tentativaDeConsulta(placa: string, ambiente: Ambiente): Promise<{ consultaId: string; ok: boolean; response: any; trace: any[] }> {
  // trace de homologacao: cada chamada externa (GCC + SERPRO) com URL, status e
  // corpo. Anexado ao erro em toda falha e devolvido no sucesso. Pode expor
  // detalhe (ferramenta de teste), mas NUNCA a api-key inteira (so prefixo).
  const trace: any[] = []
  const config = useRuntimeConfig()
  const env = configPorAmbiente(config, ambiente)
  const cert = pemFromEnv(env.certPem)
  const key = pemFromEnv(env.keyPem)
  if (!cert || !key) {
    trace.push({ etapa: 'config', erro: 'Certificados SENATRAN nao configurados.' })
    const err = createError({ statusCode: 503, message: 'Certificados SENATRAN nao configurados.' })
    ;(err as any).trace = trace
    throw err
  }
  const supabase = usePremiumSupabase()

  const chaves = await chavesCandidatas(supabase, ambiente)
  trace.push({ etapa: 'config', ambiente, gccBase: env.gccBase, senatranUrl: env.senatranUrl, cnpj: env.cnpj, template: env.template, chavePrefix: (chaves[0]?.api_key || '').slice(0, 6) })
  if (!chaves.length) {
    trace.push({ etapa: 'chave GCC', erro: 'sem chave ativa pra ambiente ' + ambiente })
    const err = createError({ statusCode: 503, message: 'Sem chave GCC ativa.' })
    ;(err as any).trace = trace
    throw err
  }

  // 1) hash de consentimento (pago). fetch nativo + parse explicito (o ofetch
  // se mostrou fragil aqui; o nativo funciona igual ao CLI que valida).
  // Tenta as chaves em ordem; 401 marca a chave como invalida no banco (pra
  // proxima requisicao nem tentar) e passa pra seguinte.
  let hash: string | null = null
  let chave: { id: string; api_key: string } | null = null
  // Fora do laco: o insert de gcc_consentimentos, mais abaixo, grava a
  // resposta da chave vencedora. Declarada dentro, dava ReferenceError em
  // producao de pedido, e o catch generico transformava isso em estorno.
  let consentResp: any = {}
  let ultimaHttp = 0
  let ultimoTexto = ''
  // RESERVA primeiro: consome um hash JA pronto (imune a queda do GCC e sem o
  // custo do POST). Fail-open — reserva vazia ou erro cai no fluxo de gerar hash
  // na hora, exatamente como antes. consentId != null => veio da reserva (a
  // linha em gcc_consentimentos ja existe, status 'em_uso').
  let consentId: string | null = null
  const reserva = await reivindicarReserva(supabase, ambiente)
  if (reserva?.numero_hash_consulta) {
    hash = reserva.numero_hash_consulta
    consentId = reserva.id
    trace.push({ etapa: 'GCC reserva', usouReserva: true, hashObtido: true })
  }
  for (const candidata of chaves) {
    if (hash) break // reserva ja resolveu: nao gera (nem paga) hash novo
    let consentRes: Response
    let consentText = ''
    try {
      // Repetir aqui e seguro: sem resposta, nao ha hash pra gastar. No pior
      // caso o GCC criou um hash que a gente nunca usou.
      consentRes = await comRetryDeRede(() => fetch(`${env.gccBase}/consentimentos-ciencias`, {
        method: 'POST',
        headers: { accept: 'application/json', 'Api-Key': candidata.api_key, 'Content-Type': 'application/json' },
        // String() obrigatorio: o runtimeConfig do Nitro (destr) converte a string
        // numerica do env em NUMBER, e o GCC exige o CNPJ como STRING.
        body: JSON.stringify({ tipo_titular: null, cpf_cnpj: '', tipo_de_usuario: 1, cnpj_provedor: String(env.cnpj), template_id: String(env.template) }),
      }), {
        onRetry: (n, erro) => trace.push({ etapa: 'GCC consentimento', tentativa: n, repetindo: String(erro?.message || erro) }),
      })
      consentText = await consentRes.text()
    } catch (e: any) {
      trace.push({ etapa: 'GCC consentimento', metodo: 'POST', url: `${env.gccBase}/consentimentos-ciencias`, chavePrefix: candidata.api_key.slice(0, 6), erro: String(e) })
      const err = createError({ statusCode: 502, message: 'Falha de rede no GCC.' })
      ;(err as any).trace = trace
      throw err
    }
    ultimaHttp = consentRes.status
    ultimoTexto = consentText
    consentResp = {}
    try { consentResp = JSON.parse(consentText) } catch { /* deixa vazio */ }
    hash = findHash(consentResp)
    trace.push({ etapa: 'GCC consentimento', metodo: 'POST', url: `${env.gccBase}/consentimentos-ciencias`, chavePrefix: candidata.api_key.slice(0, 6), http: consentRes.status, ok: consentRes.ok, hashObtido: !!hash, resumo: consentText.slice(0, 1200) })
    if (hash) { chave = candidata; break }
    console.error('[senatran] consent sem hash. chave=', candidata.api_key.slice(0, 8), 'status=', consentRes.status, 'body=', consentText.slice(0, 200))
    if (consentRes.status === 401) {
      await supabase.from('gcc_api_keys').update({ status: 'invalid' }).eq('id', candidata.id)
    }
  }
  if (!hash) {
    console.error('[senatran] nenhuma chave obteve hash. status=', ultimaHttp, 'body=', ultimoTexto.slice(0, 300))
    const err = createError({ statusCode: 502, message: 'Nao obtive numero_hash_consulta.' })
    ;(err as any).trace = trace
    throw err
  }
  // Hash NOVO (nao veio da reserva): grava o consentimento agora. Se veio da
  // reserva, a linha ja existe (status 'em_uso', consentId setado) e nao insere
  // de novo — chave pode ser null nesse caso, por isso o guard.
  if (!consentId) {
    const { data: consent } = await supabase
      .from('gcc_consentimentos')
      .insert({ numero_hash_consulta: hash, status: 'created', api_key_id: chave!.id, placa, raw_response: consentResp })
      .select()
      .single()
    consentId = consent?.id ?? null
  }

  // 2) consulta SENATRAN (gasta o hash)
  let out: { status: number; body: string }
  try {
    // Duas tentativas com o MESMO hash: enquanto a resposta nao chega, o hash
    // nao foi marcado como gasto, e repetir e barato. Se as duas cairem por
    // rede, quem recomeca e o consultarSenatran, com hash novo, porque ai nao
    // da pra saber se o SERPRO chegou a receber a primeira.
    out = await comRetryDeRede(() => senatranGet({ url: env.senatranUrl, placa, hash, cert, key }), {
      tentativas: 2,
      pausas: [2000],
      onRetry: (n, erro) => trace.push({ etapa: 'SERPRO consulta', tentativa: n, repetindo: String(erro?.message || erro) }),
    })
  } catch (e: any) {
    trace.push({ etapa: 'SERPRO consulta', metodo: 'GET', url: env.senatranUrl + ' (placa=' + placa + ')', erro: String(e) })
    const err = createError({ statusCode: 502, message: 'Falha de rede no SERPRO.' })
    ;(err as any).trace = trace
    throw err
  }
  let parsed: any
  try { parsed = JSON.parse(out.body) } catch { parsed = { _raw: out.body } }
  const ok = out.status >= 200 && out.status < 300
  trace.push({ etapa: 'SERPRO consulta', metodo: 'GET', url: env.senatranUrl + ' (placa=' + placa + ')', http: out.status, ok, resumo: (out.body || '').slice(0, 1200) })

  const { data: consulta } = await supabase
    .from('senatran_consultas')
    .insert({ placa, consentimento_id: consentId, numero_hash_consulta: hash, http_status: out.status, ok, response: parsed })
    .select()
    .single()
  await supabase.from('gcc_consentimentos').update({ status: ok ? 'spent' : 'error', spent_at: new Date().toISOString() }).eq('id', consentId)

  if (!ok) {
    // O statusCode importa: 502 e lido como falha de TRANSPORTE la fora, e o
    // fluxo inteiro recomeca com consentimento novo. Um 404 "Veiculo nao
    // encontrado" nao muda de resposta por insistencia, e cada volta dessas
    // queimava um consentimento GCC (foram quatro num unico pedido). Resposta
    // de negocio (4xx) sobe com o proprio status e falha na hora.
    const negocio = out.status >= 400 && out.status < 500
    const err = createError({ statusCode: negocio ? out.status : 502, message: 'SENATRAN retornou HTTP ' + out.status })
    ;(err as any).trace = trace
    // Status e corpo ficam no erro para quem chama decidir se vale tentar a
    // placa no outro formato: sem isso, 404 de placa e 500 do SERPRO sao a
    // mesma coisa la fora.
    ;(err as any).http = out.status
    ;(err as any).corpo = (out.body || '').slice(0, 1200)
    throw err
  }
  // Consumiu um hash (reserva ou novo): repoe a reserva ate o teto, sem
  // bloquear a entrega (fire-and-forget). O timer de 10 min e a rede de seguranca.
  reporReservaDepois(supabase, ambiente)

  return { consultaId: consulta.id, ok, response: parsed, trace }
}
